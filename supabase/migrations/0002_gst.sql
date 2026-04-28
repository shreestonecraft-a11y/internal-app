-- Add GST / Tax support
-- Defaults: 18% GST, HSN 6802 (worked monumental/building stone)

-- =========================================
-- Business settings (singleton)
-- =========================================
create table if not exists public.business_settings (
  id int primary key default 1,
  business_name text not null default 'Shree Stone Craft',
  gstin text not null default '',
  address text not null default '',
  state text not null default '',
  phone text not null default '',
  email text not null default '',
  default_gst_percent numeric not null default 18,
  default_hsn text not null default '6802',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into public.business_settings (id) values (1)
  on conflict (id) do nothing;

alter table public.business_settings enable row level security;

drop policy if exists "business_settings_read" on public.business_settings;
create policy "business_settings_read" on public.business_settings
  for select to authenticated using (true);

drop policy if exists "business_settings_owner_write" on public.business_settings;
create policy "business_settings_owner_write" on public.business_settings
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- =========================================
-- Invoice GST columns
-- =========================================
alter table public.invoices
  add column if not exists customer_gstin text not null default '',
  add column if not exists customer_address text not null default '',
  add column if not exists is_inter_state boolean not null default false,
  add column if not exists cgst_amount numeric not null default 0,
  add column if not exists sgst_amount numeric not null default 0,
  add column if not exists igst_amount numeric not null default 0,
  add column if not exists tax_total numeric not null default 0;

alter table public.invoice_line_items
  add column if not exists hsn_code text not null default '6802',
  add column if not exists gst_percent numeric not null default 18;

-- =========================================
-- Updated create_invoice RPC with GST math
-- =========================================
drop function if exists public.create_invoice(text, text, date, jsonb) cascade;

create or replace function public.create_invoice(
  p_customer_name text,
  p_customer_notes text,
  p_customer_gstin text,
  p_customer_address text,
  p_is_inter_state boolean,
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
  v_tax_total numeric := 0;
  v_cgst numeric := 0;
  v_sgst numeric := 0;
  v_igst numeric := 0;
  v_item jsonb;
  v_line_qty numeric;
  v_line_rate numeric;
  v_line_amount numeric;
  v_line_gst_pct numeric;
  v_line_tax numeric;
  v_stone public.stones;
  v_pos int := 0;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_user_email from public.profiles where id = auth.uid();

  -- Compute totals + tax
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_line_rate := coalesce((v_item->>'rate')::numeric, 0);
    v_line_gst_pct := coalesce((v_item->>'gst_percent')::numeric, 18);
    v_line_amount := v_line_qty * v_line_rate;
    v_line_tax := v_line_amount * v_line_gst_pct / 100;

    v_subtotal := v_subtotal + v_line_amount;
    v_tax_total := v_tax_total + v_line_tax;
  end loop;

  if p_is_inter_state then
    v_igst := v_tax_total;
  else
    v_cgst := v_tax_total / 2;
    v_sgst := v_tax_total / 2;
  end if;

  v_number := next_invoice_number();

  insert into public.invoices (
    number, date, customer_name, customer_notes, customer_gstin, customer_address,
    is_inter_state, subtotal, cgst_amount, sgst_amount, igst_amount, tax_total, total, created_by
  )
  values (
    v_number,
    coalesce(p_date, current_date),
    coalesce(p_customer_name, ''),
    coalesce(p_customer_notes, ''),
    coalesce(p_customer_gstin, ''),
    coalesce(p_customer_address, ''),
    coalesce(p_is_inter_state, false),
    v_subtotal,
    v_cgst,
    v_sgst,
    v_igst,
    v_tax_total,
    v_subtotal + v_tax_total,
    auth.uid()
  )
  returning * into v_invoice;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_line_rate := coalesce((v_item->>'rate')::numeric, 0);
    v_pos := v_pos + 1;

    insert into public.invoice_line_items (
      invoice_id, stone_id, name, size, packing,
      quantity, rate, image_url, position, hsn_code, gst_percent
    )
    values (
      v_invoice.id,
      nullif(v_item->>'stone_id','')::uuid,
      coalesce(v_item->>'name', ''),
      coalesce(v_item->>'size', ''),
      coalesce(v_item->>'packing', ''),
      v_line_qty,
      v_line_rate,
      v_item->>'image_url',
      v_pos,
      coalesce(v_item->>'hsn_code', '6802'),
      coalesce((v_item->>'gst_percent')::numeric, 18)
    );

    -- deduct stock if linked
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
