-- Preserve quote-option deposits when proposal item totals are recalculated.
create or replace function public.recalculate_quote_option_totals(p_option_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_quote_id uuid;
  v_total integer;
begin
  select quote_id into v_quote_id
  from public.travel_quote_options
  where option_id = p_option_id;

  if v_quote_id is null then return; end if;

  select coalesce(sum(
    coalesce(
      (
        select v.amount
        from public.travel_quote_item_variants v
        where v.item_id = i.item_id
          and v.active = true
          and v.is_default = true
        order by v.sort_order, v.created_at
        limit 1
      ),
      i.amount,
      0
    )
  ),0)::integer
  into v_total
  from public.travel_quote_items i
  where i.option_id = p_option_id
    and i.builder_managed = true
    and coalesce(i.client_visible,true) = true;

  update public.travel_quote_options
  set total_amount = v_total,
      deposit_amount = case
        when deposit_amount is null then null
        when deposit_amount > v_total then v_total
        else deposit_amount
      end,
      updated_at = now()
  where option_id = p_option_id;

  update public.travel_quotes q
  set total_amount = (
        select coalesce(min(o.total_amount),0)
        from public.travel_quote_options o
        where o.quote_id = v_quote_id
      ),
      deposit_amount = (
        select min(o.deposit_amount)
        from public.travel_quote_options o
        where o.quote_id = v_quote_id
          and o.deposit_amount is not null
      ),
      updated_at = now()
  where q.quote_id = v_quote_id;
end;
$$;
