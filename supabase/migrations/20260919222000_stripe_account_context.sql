-- Persist the Stripe account context used by Checkout so webhook reconciliation
-- and future automatic installment charges use the same Stripe account.

alter table private.booking_autopay_methods
  add column if not exists stripe_account_id text;

drop function if exists public.complete_stripe_booking_payment(
  text, text, boolean, uuid, text, text, integer, text, text, text
);

create function public.complete_stripe_booking_payment(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payment_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_total integer,
  p_currency text,
  p_customer_id text,
  p_payment_method_id text,
  p_stripe_account_id text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment_row public.booking_payments%rowtype;
  booking_row public.bookings%rowtype;
  linked_booking_id uuid;
  paid_total integer;
begin
  insert into public.stripe_webhook_events (event_id, event_type, livemode, payment_id)
  values (p_event_id, p_event_type, p_livemode, p_payment_id)
  on conflict (event_id) do nothing;

  if not found then
    select booking_id into linked_booking_id
    from public.booking_payments
    where payment_id = p_payment_id;
    return linked_booking_id;
  end if;

  select * into payment_row
  from public.booking_payments
  where payment_id = p_payment_id
  for update;

  if payment_row.payment_id is null then raise exception 'Unknown payment'; end if;
  if payment_row.scheduled_amount <> p_amount_total then raise exception 'Payment amount mismatch'; end if;
  if lower(payment_row.currency) <> lower(p_currency) then raise exception 'Payment currency mismatch'; end if;

  update public.booking_payments
  set status = 'succeeded',
      paid_amount = p_amount_total,
      paid_at = now(),
      stripe_checkout_session_id = coalesce(p_checkout_session_id, stripe_checkout_session_id),
      stripe_payment_intent_id = p_payment_intent_id,
      stripe_event_id = p_event_id,
      failure_code = null,
      failure_message = null,
      updated_at = now()
  where payment_id = p_payment_id;

  select coalesce(sum(paid_amount), 0)::integer into paid_total
  from public.booking_payments
  where booking_id = payment_row.booking_id
    and status = 'succeeded';

  update public.bookings
  set amount_paid = paid_total,
      balance_due = greatest(total_amount - paid_total, 0),
      status = case when paid_total >= deposit_amount then 'confirmed' else status end,
      stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
      paid_in_full_at = case
        when paid_total >= total_amount then coalesce(paid_in_full_at, now())
        else null
      end,
      days_until_zero_balance = greatest(final_payment_deadline - current_date, 0),
      updated_at = now()
  where booking_id = payment_row.booking_id
  returning * into booking_row;

  if booking_row.payment_plan = 'installments'
     and p_customer_id is not null
     and p_payment_method_id is not null then
    insert into private.booking_autopay_methods (
      booking_id,
      stripe_customer_id,
      stripe_payment_method_id,
      stripe_account_id
    ) values (
      payment_row.booking_id,
      p_customer_id,
      p_payment_method_id,
      p_stripe_account_id
    )
    on conflict (booking_id) do update
      set stripe_customer_id = excluded.stripe_customer_id,
          stripe_payment_method_id = excluded.stripe_payment_method_id,
          stripe_account_id = excluded.stripe_account_id,
          updated_at = now();
  end if;

  if payment_row.kind = 'deposit' then
    perform private.ensure_booking_installments(payment_row.booking_id);
  end if;

  return payment_row.booking_id;
end;
$$;

revoke all on function public.complete_stripe_booking_payment(
  text, text, boolean, uuid, text, text, integer, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.complete_stripe_booking_payment(
  text, text, boolean, uuid, text, text, integer, text, text, text, text
) to service_role;

drop function if exists public.claim_due_auto_payments(integer);

create function public.claim_due_auto_payments(p_limit integer default 25)
returns table (
  payment_id uuid,
  booking_id uuid,
  amount integer,
  currency text,
  stripe_customer_id text,
  stripe_payment_method_id text,
  stripe_account_id text,
  trip_title text,
  checkout_attempt integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with due as (
    select bp.payment_id
    from public.booking_payments bp
    join public.bookings b on b.booking_id = bp.booking_id
    join private.booking_autopay_methods ap on ap.booking_id = b.booking_id
    where bp.kind = 'installment'
      and bp.scheduled_for <= current_date
      and b.payment_plan = 'installments'
      and b.auto_pay_authorized_at is not null
      and b.balance_due > 0
      and (
        bp.status = 'scheduled'
        or (bp.status = 'processing' and bp.checkout_started_at < now() - interval '30 minutes')
      )
    order by bp.scheduled_for, bp.created_at
    for update of bp skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.booking_payments bp
  set status = 'processing',
      checkout_started_at = now(),
      checkout_attempt = bp.checkout_attempt + case when bp.status = 'scheduled' then 1 else 0 end,
      updated_at = now()
  from due, public.bookings b, public.trips t, private.booking_autopay_methods ap
  where bp.payment_id = due.payment_id
    and b.booking_id = bp.booking_id
    and t.trip_id = b.trip_id
    and ap.booking_id = b.booking_id
  returning bp.payment_id,
            bp.booking_id,
            bp.scheduled_amount,
            bp.currency,
            ap.stripe_customer_id,
            ap.stripe_payment_method_id,
            ap.stripe_account_id,
            t.title,
            bp.checkout_attempt;
end;
$$;

revoke all on function public.claim_due_auto_payments(integer) from public, anon, authenticated;
grant execute on function public.claim_due_auto_payments(integer) to service_role;
