-- Keep custom-quote approval and payment status handoffs systematic.
-- Approval creates/updates the custom booking and marks the quote/request approved.
-- Successful custom payments advance the quote workflow to payment_plan or paid.

create or replace function private.create_custom_booking_from_quote_response()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  q public.travel_quotes%rowtype;
  o public.travel_quote_options%rowtype;
  r public.travel_requests%rowtype;
begin
  if new.decision <> 'approved' or new.option_id is null then return new; end if;

  select * into q from public.travel_quotes where quote_id=new.quote_id;
  select * into o from public.travel_quote_options where option_id=new.option_id and quote_id=new.quote_id;
  select * into r from public.travel_requests where request_id=q.request_id;

  if q.quote_id is null or o.option_id is null or r.user_id is null or r.user_id <> new.user_id then
    return new;
  end if;

  insert into public.custom_bookings (
    quote_id,option_id,request_id,user_id,status,currency,total_amount,deposit_amount,amount_paid,balance_due
  ) values (
    q.quote_id,o.option_id,r.request_id,r.user_id,'awaiting_payment',
    lower(coalesce(q.currency,'USD')),o.total_amount,o.deposit_amount,0,o.total_amount
  )
  on conflict (quote_id) do update set
    option_id=excluded.option_id,
    total_amount=excluded.total_amount,
    deposit_amount=excluded.deposit_amount,
    balance_due=greatest(excluded.total_amount-public.custom_bookings.amount_paid,0),
    updated_at=now();

  update public.travel_quotes
  set status='approved', workflow_status='approved', updated_at=now()
  where quote_id=q.quote_id;

  update public.travel_requests
  set status='approved', updated_at=now()
  where request_id=r.request_id;

  return new;
end;
$$;

revoke all on function private.create_custom_booking_from_quote_response() from public,anon,authenticated;

create or replace function public.complete_custom_booking_payment(
  p_payment_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_total integer,
  p_customer_id text
)
returns uuid
language plpgsql
set search_path=''
as $$
declare
  payment_row public.custom_booking_payments%rowtype;
  booking_row public.custom_bookings%rowtype;
  paid_total integer;
  next_balance integer;
begin
  select * into payment_row
  from public.custom_booking_payments
  where payment_id=p_payment_id
  for update;

  if payment_row.payment_id is null then raise exception 'Unknown custom payment'; end if;

  select * into booking_row
  from public.custom_bookings
  where custom_booking_id=payment_row.custom_booking_id
  for update;

  if booking_row.custom_booking_id is null then raise exception 'Unknown custom booking'; end if;
  if payment_row.amount <> p_amount_total then raise exception 'Custom payment amount mismatch'; end if;

  if payment_row.status <> 'succeeded' then
    update public.custom_booking_payments
    set status='succeeded',
        stripe_checkout_session_id=coalesce(stripe_checkout_session_id,p_checkout_session_id),
        stripe_payment_intent_id=p_payment_intent_id,
        paid_at=coalesce(paid_at,now()),
        updated_at=now()
    where payment_id=p_payment_id;
  end if;

  select coalesce(sum(amount),0)::integer into paid_total
  from public.custom_booking_payments
  where custom_booking_id=booking_row.custom_booking_id
    and status='succeeded';

  paid_total := least(paid_total, booking_row.total_amount);
  next_balance := greatest(booking_row.total_amount-paid_total,0);

  update public.custom_bookings
  set amount_paid=paid_total,
      balance_due=next_balance,
      status=case when next_balance=0 then 'paid_in_full' else 'deposit_paid' end,
      stripe_customer_id=coalesce(stripe_customer_id,p_customer_id),
      updated_at=now()
  where custom_booking_id=booking_row.custom_booking_id;

  update public.travel_quotes
  set status='approved',
      workflow_status=case when next_balance=0 then 'paid' else 'payment_plan' end,
      updated_at=now()
  where quote_id=booking_row.quote_id;

  update public.travel_requests
  set status='approved', updated_at=now()
  where request_id=booking_row.request_id;

  return booking_row.custom_booking_id;
end;
$$;
