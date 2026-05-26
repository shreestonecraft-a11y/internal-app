-- Edit + restore-on-delete for dispatch notes and return slips.
-- All changes are ADDITIVE — no tables dropped, no data touched.
-- All RPCs are atomic (single transaction); failure rolls back stock changes.

-- =========================================
-- DELETE dispatch note + restore deducted stock (audited)
-- =========================================
create or replace function public.delete_invoice_with_restore(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_item record;
  v_stone public.stones;
  v_user_email text;
  v_inv_number text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_user_email from public.profiles where id = auth.uid();
  select number into v_inv_number from public.invoices where id = p_id;

  if v_inv_number is null then
    raise exception 'invoice not found';
  end if;

  -- Add back stock for every linked line item, with audit log
  for v_item in
    select stone_id, quantity from public.invoice_line_items where invoice_id = p_id
  loop
    if v_item.stone_id is not null then
      update public.stones
        set quantity = quantity + v_item.quantity
        where id = v_item.stone_id
        returning * into v_stone;

      if v_stone.id is not null then
        insert into public.stock_logs (stone_id, stone_name, field, old_value, new_value, user_id, user_email)
        values (
          v_stone.id, v_stone.name, 'quantity',
          (v_stone.quantity - v_item.quantity)::text,
          v_stone.quantity::text || ' (dispatch ' || v_inv_number || ' deleted)',
          auth.uid(), v_user_email
        );
      end if;
    end if;
  end loop;

  -- Cascade-deletes line items
  delete from public.invoices where id = p_id;
end;
$$;

-- =========================================
-- DELETE return slip + re-deduct (reverse the addition), audited
-- =========================================
create or replace function public.delete_return_slip_with_rededuct(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_item record;
  v_stone public.stones;
  v_user_email text;
  v_slip_number text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_user_email from public.profiles where id = auth.uid();
  select number into v_slip_number from public.return_slips where id = p_id;

  if v_slip_number is null then
    raise exception 'return slip not found';
  end if;

  for v_item in
    select stone_id, quantity from public.return_slip_line_items where return_slip_id = p_id
  loop
    if v_item.stone_id is not null then
      update public.stones
        set quantity = greatest(0, quantity - v_item.quantity)
        where id = v_item.stone_id
        returning * into v_stone;

      if v_stone.id is not null then
        insert into public.stock_logs (stone_id, stone_name, field, old_value, new_value, user_id, user_email)
        values (
          v_stone.id, v_stone.name, 'quantity',
          (v_stone.quantity + v_item.quantity)::text,
          v_stone.quantity::text || ' (return ' || v_slip_number || ' deleted)',
          auth.uid(), v_user_email
        );
      end if;
    end if;
  end loop;

  delete from public.return_slips where id = p_id;
end;
$$;

-- =========================================
-- UPDATE dispatch note — atomic: reverse old line items, apply new ones
-- =========================================
create or replace function public.update_invoice(
  p_id uuid,
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
  v_old record;
  v_new jsonb;
  v_line_qty numeric;
  v_line_rate numeric;
  v_subtotal numeric := 0;
  v_pos int := 0;
  v_user_email text;
  v_stone public.stones;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_user_email from public.profiles where id = auth.uid();

  -- Lock the invoice row to serialize concurrent edits
  perform 1 from public.invoices where id = p_id for update;

  if not found then
    raise exception 'invoice not found';
  end if;

  -- 1. Reverse stock for every existing line item (add back)
  for v_old in
    select stone_id, quantity from public.invoice_line_items where invoice_id = p_id
  loop
    if v_old.stone_id is not null then
      update public.stones
        set quantity = quantity + v_old.quantity
        where id = v_old.stone_id;
    end if;
  end loop;

  -- 2. Wipe old line items
  delete from public.invoice_line_items where invoice_id = p_id;

  -- 3. Insert new line items + deduct stock
  for v_new in select * from jsonb_array_elements(p_items) loop
    v_line_qty := coalesce((v_new->>'quantity')::numeric, 0);
    v_line_rate := coalesce((v_new->>'rate')::numeric, 0);
    v_subtotal := v_subtotal + (v_line_qty * v_line_rate);
    v_pos := v_pos + 1;

    insert into public.invoice_line_items (invoice_id, stone_id, name, size, packing, quantity, rate, image_url, position)
    values (
      p_id,
      nullif(v_new->>'stone_id','')::uuid,
      coalesce(v_new->>'name',''),
      coalesce(v_new->>'size',''),
      coalesce(v_new->>'packing',''),
      v_line_qty,
      v_line_rate,
      v_new->>'image_url',
      v_pos
    );

    if (v_new->>'stone_id') is not null and (v_new->>'stone_id') <> '' then
      update public.stones
        set quantity = greatest(0, quantity - v_line_qty)
        where id = (v_new->>'stone_id')::uuid
        returning * into v_stone;

      if v_stone.id is not null then
        insert into public.stock_logs (stone_id, stone_name, field, old_value, new_value, user_id, user_email)
        values (
          v_stone.id, v_stone.name, 'quantity',
          'edited',
          v_stone.quantity::text || ' (dispatch edit)',
          auth.uid(), v_user_email
        );
      end if;
    end if;
  end loop;

  -- 4. Update header
  update public.invoices
    set
      customer_name = coalesce(p_customer_name, customer_name),
      customer_notes = coalesce(p_customer_notes, customer_notes),
      date = coalesce(p_date, date),
      subtotal = v_subtotal,
      total = v_subtotal
    where id = p_id
    returning * into v_invoice;

  return v_invoice;
end;
$$;

-- =========================================
-- UPDATE return slip — atomic: reverse old, apply new
-- =========================================
create or replace function public.update_return_slip(
  p_id uuid,
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
  v_old record;
  v_new jsonb;
  v_line_qty numeric;
  v_pos int := 0;
  v_user_email text;
  v_stone public.stones;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_user_email from public.profiles where id = auth.uid();

  perform 1 from public.return_slips where id = p_id for update;

  if not found then
    raise exception 'return slip not found';
  end if;

  -- 1. Reverse stock for every existing line item (subtract what was previously added back)
  for v_old in
    select stone_id, quantity from public.return_slip_line_items where return_slip_id = p_id
  loop
    if v_old.stone_id is not null then
      update public.stones
        set quantity = greatest(0, quantity - v_old.quantity)
        where id = v_old.stone_id;
    end if;
  end loop;

  delete from public.return_slip_line_items where return_slip_id = p_id;

  -- 2. Insert new line items + add stock back
  for v_new in select * from jsonb_array_elements(p_items) loop
    v_line_qty := coalesce((v_new->>'quantity')::numeric, 0);
    v_pos := v_pos + 1;

    insert into public.return_slip_line_items (return_slip_id, stone_id, name, size, packing, quantity, image_url, position)
    values (
      p_id,
      nullif(v_new->>'stone_id','')::uuid,
      coalesce(v_new->>'name',''),
      coalesce(v_new->>'size',''),
      coalesce(v_new->>'packing',''),
      v_line_qty,
      v_new->>'image_url',
      v_pos
    );

    if (v_new->>'stone_id') is not null and (v_new->>'stone_id') <> '' then
      update public.stones
        set quantity = quantity + v_line_qty
        where id = (v_new->>'stone_id')::uuid
        returning * into v_stone;

      if v_stone.id is not null then
        insert into public.stock_logs (stone_id, stone_name, field, old_value, new_value, user_id, user_email)
        values (
          v_stone.id, v_stone.name, 'quantity',
          'edited',
          v_stone.quantity::text || ' (return edit)',
          auth.uid(), v_user_email
        );
      end if;
    end if;
  end loop;

  -- 3. Update header
  update public.return_slips
    set
      notes = coalesce(p_notes, notes),
      date = coalesce(p_date, date)
    where id = p_id
    returning * into v_slip;

  return v_slip;
end;
$$;

-- =========================================
-- Grants (security definer functions still need execute grants for authenticated users)
-- =========================================
grant execute on function public.delete_invoice_with_restore(uuid) to authenticated;
grant execute on function public.delete_return_slip_with_rededuct(uuid) to authenticated;
grant execute on function public.update_invoice(uuid, text, text, date, jsonb) to authenticated;
grant execute on function public.update_return_slip(uuid, text, date, jsonb) to authenticated;
