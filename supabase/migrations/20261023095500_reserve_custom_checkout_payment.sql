-- Reserve or reuse one custom checkout payment under a per-booking lock.
-- Deploy on Supabase staging before the corresponding API change.
create or replace function public.reserve_custom_checkout_payment(
  p_booking_id uuid, p_user_id uuid, p_plan text
)
returns table(payment_id uuid, amount integer, kind text, checkout_session_id text)
language plpgsql security definer set search_path=''
as $$
declare
  b public.custom_bookings%rowtype;
  p public.custom_booking_payments%rowtype;
  v_amount integer;
  v_kind text;
begin
  if p_plan not in ('deposit','balance','pay_in_full') then raise exception 'Invalid payment plan'; end if;
  select * into b from public.custom_bookings
  where custom_booking_id=p_booking_id for update;
  if b.custom_booking_id is null or b.user_id <> p_user_id then
    raise exception 'Booking not available';
  end if;
  if b.status = 'cancelled' or b.balance_due <= 0 then raise exception 'Booking is not payable'; end if;

  if p_plan='deposit' then
    if b.amount_paid > 0 or coalesce(b.deposit_amount,0)<=0 then raise exception 'Deposit is not available'; end if;
    v_amount := least(b.deposit_amount,b.balance_due); v_kind := 'deposit';
  elsif p_plan='balance' then v_amount := b.balance_due; v_kind := 'balance';
  else v_amount := b.balance_due; v_kind := 'pay_in_full';
  end if;

  -- Existing open records for the same payable amount are reused, preventing
  -- a double-click from generating multiple Stripe checkout sessions.
  select * into p from public.custom_booking_payments
  where custom_booking_id=p_booking_id and status='open'
    and amount=v_amount and kind=v_kind
  order by created_at asc limit 1 for update;
  if p.payment_id is null then
    insert into public.custom_booking_payments(custom_booking_id,amount,kind,status)
    values(p_booking_id,v_amount,v_kind,'open')
    returning * into p;
  end if;

  return query select p.payment_id,p.amount,p.kind,p.stripe_checkout_session_id;
end;
$$;
revoke all on function public.reserve_custom_checkout_payment(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_custom_checkout_payment(uuid,uuid,text) to service_role;
