-- Return slips — adds stock back (opposite of invoices which deduct stock)

-- =========================================
-- Tables
-- =========================================
create table if not exists public.return_slips (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists return_slips_created_at_idx on public.return_slips(created_at desc);

create sequence if not exists public.return_slip_number_seq start 1001;

create table if not exists public.return_slip_line_items (
  id uuid primary key default gen_random_uuid(),
  return_slip_id uuid not null references public.return_slips(id) on delete cascade,
  stone_id uuid references public.stones(id) on delete set null,
  name text not null,
  size text not null default '',
  packing text not null default '',
  quantity numeric not null default 0,
  image_url text,
  position int not null default 0
);

create index if not exists return_slip_line_items_slip_idx on public.return_slip_line_items(return_slip_id);

-- =========================================
-- Atomic return slip creation (add stock + log + insert in one transaction)
-- =========================================
create or replace function public.create_return_slip(
  p_notes text,
  p_date date,
  p_items jsonb
)
returns public.return_slips
language plpgsql
security definer set search_path = public
as $$
declare
  v_slip public.return_slips;
  v_number text;
  v_item jsonb;
  v_line_qty numeric;
  v_stone public.stones;
  v_pos int := 0;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_user_email from public.profiles where id = auth.uid();

  v_number := 'RET-' || lpad(nextval('public.return_slip_number_seq')::text, 4, '0');

  insert into public.return_slips (number, date, notes, created_by)
  values (v_number, coalesce(p_date, current_date), coalesce(p_notes, ''), auth.uid())
  returning * into v_slip;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_pos := v_pos + 1;

    insert into public.return_slip_line_items (return_slip_id, stone_id, name, size, packing, quantity, image_url, position)
    values (
      v_slip.id,
      nullif(v_item->>'stone_id', '')::uuid,
      coalesce(v_item->>'name', ''),
      coalesce(v_item->>'size', ''),
      coalesce(v_item->>'packing', ''),
      v_line_qty,
      v_item->>'image_url',
      v_pos
    );

    -- add stock back if item is linked to a stone
    if (v_item->>'stone_id') is not null and (v_item->>'stone_id') <> '' then
      update public.stones
        set quantity = quantity + v_line_qty
        where id = (v_item->>'stone_id')::uuid
        returning * into v_stone;

      if v_stone.id is not null then
        insert into public.stock_logs (stone_id, stone_name, field, old_value, new_value, user_id, user_email)
        values (
          v_stone.id, v_stone.name, 'quantity',
          (v_stone.quantity - v_line_qty)::text,
          v_stone.quantity::text || ' (return ' || v_slip.number || ')',
          auth.uid(), v_user_email
        );
      end if;
    end if;
  end loop;

  return v_slip;
end;
$$;

-- =========================================
-- Row Level Security
-- =========================================
alter table public.return_slips enable row level security;
alter table public.return_slip_line_items enable row level security;

create policy "return_slips_all" on public.return_slips
  for all to authenticated using (true) with check (true);

create policy "return_slip_line_items_all" on public.return_slip_line_items
  for all to authenticated using (true) with check (true);
