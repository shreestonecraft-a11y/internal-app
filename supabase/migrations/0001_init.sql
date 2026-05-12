-- Shree Stone Command — initial schema
-- Single business, two roles: owner (manages users), staff (full app access)
-- Safe to re-run: uses IF NOT EXISTS everywhere, no DROP TABLE statements.

-- =========================================
-- Clean slate for functions/types only
-- (tables are never dropped — data is preserved)
-- =========================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_invoice(text, text, date, jsonb) cascade;
drop function if exists public.next_invoice_number() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.is_owner() cascade;

-- Storage policies (bucket itself is left in place)
drop policy if exists "stone_images_public_read" on storage.objects;
drop policy if exists "stone_images_authed_write" on storage.objects;
drop policy if exists "stone_images_authed_update" on storage.objects;
drop policy if exists "stone_images_authed_delete" on storage.objects;

-- =========================================
-- Extensions
-- =========================================
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- =========================================
-- Profiles (mirrors auth.users with role)
-- =========================================
do $$ begin
  create type public.user_role as enum ('owner', 'staff');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is current user an owner?
create or replace function public.is_owner()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- =========================================
-- Locations
-- =========================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================
-- Stones (inventory)
-- =========================================
do $$ begin
  create type public.stone_status as enum ('active', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.stones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size text not null default '',
  packing text not null default '',
  quantity numeric not null default 0,
  location_id uuid references public.locations(id) on delete set null,
  category text not null default '',
  variant text not null default '',
  sku text not null default '',
  notes text not null default '',
  image_url text,
  status public.stone_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists stones_location_idx on public.stones(location_id);
create index if not exists stones_status_idx on public.stones(status);
create index if not exists stones_name_trgm_idx on public.stones using gin (name gin_trgm_ops);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stones_touch_updated_at on public.stones;
create trigger stones_touch_updated_at
  before update on public.stones
  for each row execute function public.touch_updated_at();

-- =========================================
-- Stock logs (audit trail for stone changes)
-- =========================================
create table if not exists public.stock_logs (
  id uuid primary key default gen_random_uuid(),
  stone_id uuid references public.stones(id) on delete set null,
  stone_name text not null,
  field text not null,
  old_value text not null default '',
  new_value text not null default '',
  user_id uuid references public.profiles(id) on delete set null,
  user_email text,
  created_at timestamptz not null default now()
);

create index if not exists stock_logs_stone_idx on public.stock_logs(stone_id);
create index if not exists stock_logs_created_at_idx on public.stock_logs(created_at desc);

-- =========================================
-- Invoices
-- =========================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  date date not null default current_date,
  customer_name text not null default '',
  customer_notes text not null default '',
  subtotal numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists invoices_date_idx on public.invoices(date desc);
create index if not exists invoices_created_at_idx on public.invoices(created_at desc);

create sequence if not exists public.invoice_number_seq start 1001;

create or replace function public.next_invoice_number()
returns text language sql as $$
  select 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
$$;

-- =========================================
-- Invoice line items
-- =========================================
create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  stone_id uuid references public.stones(id) on delete set null,
  name text not null,
  size text not null default '',
  packing text not null default '',
  quantity numeric not null default 0,
  rate numeric not null default 0,
  image_url text,
  position int not null default 0
);

create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id);

-- =========================================
-- Atomic invoice creation (deduct stock + log + insert in one transaction)
-- =========================================
create or replace function public.create_invoice(
  p_customer_name text,
  p_customer_notes text,
  p_date date,
  p_items jsonb
)
returns public.invoices
language plpgsql
security definer set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_number text;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_line_qty numeric;
  v_line_rate numeric;
  v_stone public.stones;
  v_pos int := 0;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_user_email from public.profiles where id = auth.uid();

  -- compute subtotal
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_line_rate := coalesce((v_item->>'rate')::numeric, 0);
    v_subtotal := v_subtotal + (v_line_qty * v_line_rate);
  end loop;

  v_number := next_invoice_number();

  insert into public.invoices (number, date, customer_name, customer_notes, subtotal, total, created_by)
  values (v_number, coalesce(p_date, current_date), coalesce(p_customer_name, ''), coalesce(p_customer_notes, ''), v_subtotal, v_subtotal, auth.uid())
  returning * into v_invoice;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_line_rate := coalesce((v_item->>'rate')::numeric, 0);
    v_pos := v_pos + 1;

    insert into public.invoice_line_items (invoice_id, stone_id, name, size, packing, quantity, rate, image_url, position)
    values (
      v_invoice.id,
      nullif(v_item->>'stone_id','')::uuid,
      coalesce(v_item->>'name', ''),
      coalesce(v_item->>'size', ''),
      coalesce(v_item->>'packing', ''),
      v_line_qty,
      v_line_rate,
      v_item->>'image_url',
      v_pos
    );

    -- deduct stock if linked, with audit log
    if (v_item->>'stone_id') is not null and (v_item->>'stone_id') <> '' then
      update public.stones
        set quantity = greatest(0, quantity - v_line_qty)
        where id = (v_item->>'stone_id')::uuid
        returning * into v_stone;

      if v_stone.id is not null then
        insert into public.stock_logs (stone_id, stone_name, field, old_value, new_value, user_id, user_email)
        values (
          v_stone.id, v_stone.name, 'quantity',
          (v_stone.quantity + v_line_qty)::text,
          v_stone.quantity::text || ' (invoice ' || v_invoice.number || ')',
          auth.uid(), v_user_email
        );
      end if;
    end if;
  end loop;

  return v_invoice;
end;
$$;

-- =========================================
-- Row Level Security
-- =========================================
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.stones enable row level security;
alter table public.stock_logs enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;

-- Drop and recreate policies (safe — policies hold no data)
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_owner_all" on public.profiles;
drop policy if exists "locations_select" on public.locations;
drop policy if exists "locations_write" on public.locations;
drop policy if exists "stones_all" on public.stones;
drop policy if exists "stock_logs_select" on public.stock_logs;
drop policy if exists "stock_logs_insert" on public.stock_logs;
drop policy if exists "invoices_all" on public.invoices;
drop policy if exists "invoice_line_items_all" on public.invoice_line_items;

create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_owner_all" on public.profiles
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "locations_select" on public.locations
  for select to authenticated using (true);
create policy "locations_write" on public.locations
  for all to authenticated using (true) with check (true);

create policy "stones_all" on public.stones
  for all to authenticated using (true) with check (true);

create policy "stock_logs_select" on public.stock_logs
  for select to authenticated using (true);
create policy "stock_logs_insert" on public.stock_logs
  for insert to authenticated with check (true);

create policy "invoices_all" on public.invoices
  for all to authenticated using (true) with check (true);
create policy "invoice_line_items_all" on public.invoice_line_items
  for all to authenticated using (true) with check (true);

-- =========================================
-- Storage bucket for stone images
-- =========================================
insert into storage.buckets (id, name, public)
values ('stone-images', 'stone-images', true)
on conflict (id) do nothing;

create policy "stone_images_public_read"
  on storage.objects for select
  using (bucket_id = 'stone-images');

create policy "stone_images_authed_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stone-images');

create policy "stone_images_authed_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'stone-images');

create policy "stone_images_authed_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'stone-images');
