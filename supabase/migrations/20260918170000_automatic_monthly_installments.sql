-- True automatic monthly installments. The deposit card is saved by Stripe for
-- off-session use; every remaining installment is due no later than 60 days
-- before departure.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.bookings
  add column if not exists auto_pay_authorized_at timestamptz,
  add column if not exists auto_pay_terms_version text;

create table if not exists private.booking_autopay_methods (
  booking_id uuid primary key references public.bookings(booking_id) on delete cascade,
  stripe_customer_id text not null,
  stripe_payment_method_id text not null,
  updated_at timestamptz not null default now()
);

revoke all on private.booking_autopay_methods from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on private.booking_autopay_methods to service_role;

drop function if exists public.prepare_stripe_booking_checkout(uuid, text, text, text);
create function public.prepare_stripe_booking_checkout(
  p_user_id uuid,
  p_trip_slug text,
  p_package_code text,
  p_payment_plan text,
  p_auto_pay_consent boolean
)
returns table (
  payment_id uuid,
  booking_id uuid,
  trip_title text,
  package_name text,
  amount integer,
  currency text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  trip_row public.trips%rowtype;
  package_row public.trip_packages%rowtype;
  booking_row public.bookings%rowtype;
  payment_row public.booking_payments%rowtype;
  new_booking_id uuid;
  new_payment_id uuid;
  checkout_amount integer;
  checkout_kind text;
  final_deadline date;
begin
  if p_payment_plan not in ('installments', 'pay_in_full') then
    raise exception 'Unsupported payment plan';
  end if;
  if p_payment_plan = 'installments' and not coalesce(p_auto_pay_consent, false) then
    raise exception 'Automatic payment authorization is required';
  end if;

  select * into trip_row
  from public.trips
  where slug = p_trip_slug and status = 'active'
  for share;

  if trip_row.trip_id is null or trip_row.dates_end < current_date then
    raise exception 'Trip is not available for booking';
  end if;

  select * into package_row
  from public.trip_packages
  where trip_id = trip_row.trip_id and code = p_package_code and is_active
  for share;

  if package_row.package_id is null then
    raise exception 'Package is not available';
  end if;

  final_deadline := trip_row.dates_start - 60;
  if p_payment_plan = 'installments' and final_deadline <= current_date then
    raise exception 'Installment plan is no longer available';
  end if;

  checkout_amount := case when p_payment_plan = 'pay_in_full' then package_row.total_amount else package_row.deposit_amount end;
  checkout_kind := case when p_payment_plan = 'pay_in_full' then 'pay_in_full' else 'deposit' end;

  select * into booking_row
  from public.bookings
  where user_id = p_user_id and trip_id = trip_row.trip_id
  for update;

  if booking_row.booking_id is not null then
    if booking_row.amount_paid > 0 then raise exception 'A booking already exists for this trip'; end if;

    select * into payment_row
    from public.booking_payments
    where public.booking_payments.booking_id = booking_row.booking_id
    order by created_at limit 1 for update;

    if payment_row.stripe_checkout_session_id is not null
       and (booking_row.package_id is distinct from package_row.package_id or booking_row.payment_plan is distinct from p_payment_plan) then
      raise exception 'Finish or cancel the existing checkout before changing the package';
    end if;

    update public.bookings
    set package_id = package_row.package_id,
        total_amount = package_row.total_amount,
        deposit_amount = package_row.deposit_amount,
        balance_due = package_row.total_amount,
        auto_pay_deadline = final_deadline,
        final_payment_deadline = final_deadline,
        days_until_zero_balance = greatest(final_deadline - current_date, 0),
        payment_plan = p_payment_plan,
        currency = package_row.currency,
        auto_pay_authorized_at = case when p_payment_plan = 'installments' then now() else null end,
        auto_pay_terms_version = case when p_payment_plan = 'installments' then '2026-09-auto-monthly-v1' else null end,
        updated_at = now()
    where public.bookings.booking_id = booking_row.booking_id;
    new_booking_id := booking_row.booking_id;

    if payment_row.payment_id is null then
      insert into public.booking_payments (booking_id, scheduled_amount, scheduled_for, payment_number, kind, currency, status)
      values (new_booking_id, checkout_amount, current_date, 0, checkout_kind, package_row.currency, 'pending')
      returning public.booking_payments.payment_id into new_payment_id;
    else
      update public.booking_payments
      set scheduled_amount = checkout_amount, kind = checkout_kind, currency = package_row.currency,
          status = case when stripe_checkout_session_id is null then 'pending' else status end, updated_at = now()
      where public.booking_payments.payment_id = payment_row.payment_id
      returning public.booking_payments.payment_id into new_payment_id;
    end if;
  else
    insert into public.bookings (
      user_id, trip_id, package_id, status, total_amount, deposit_amount,
      balance_due, amount_paid, auto_pay_deadline, final_payment_deadline,
      days_until_zero_balance, payment_plan, currency, auto_pay_authorized_at,
      auto_pay_terms_version
    ) values (
      p_user_id, trip_row.trip_id, package_row.package_id, 'pending', package_row.total_amount,
      package_row.deposit_amount, package_row.total_amount, 0, final_deadline, final_deadline,
      greatest(final_deadline - current_date, 0), p_payment_plan, package_row.currency,
      case when p_payment_plan = 'installments' then now() else null end,
      case when p_payment_plan = 'installments' then '2026-09-auto-monthly-v1' else null end
    ) returning public.bookings.booking_id into new_booking_id;

    insert into public.booking_payments (booking_id, scheduled_amount, scheduled_for, payment_number, kind, currency, status)
    values (new_booking_id, checkout_amount, current_date, 0, checkout_kind, package_row.currency, 'pending')
    returning public.booking_payments.payment_id into new_payment_id;
  end if;

  return query select new_payment_id, new_booking_id, trip_row.title, package_row.name, checkout_amount, package_row.currency;
end;
$$;

revoke all on function public.prepare_stripe_booking_checkout(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.prepare_stripe_booking_checkout(uuid, text, text, text, boolean) to service_role;

drop function if exists public.complete_stripe_booking_payment(text, text, boolean, uuid, text, text, integer, text, text);
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
  p_payment_method_id text
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
    select booking_id into linked_booking_id from public.booking_payments where payment_id = p_payment_id;
    return linked_booking_id;
  end if;

  select * into payment_row from public.booking_payments where payment_id = p_payment_id for update;
  if payment_row.payment_id is null then raise exception 'Unknown payment'; end if;
  if payment_row.scheduled_amount <> p_amount_total then raise exception 'Payment amount mismatch'; end if;
  if lower(payment_row.currency) <> lower(p_currency) then raise exception 'Payment currency mismatch'; end if;

  update public.booking_payments
  set status = 'succeeded', paid_amount = p_amount_total, paid_at = now(),
      stripe_checkout_session_id = coalesce(p_checkout_session_id, stripe_checkout_session_id),
      stripe_payment_intent_id = p_payment_intent_id, stripe_event_id = p_event_id,
      failure_code = null, failure_message = null, updated_at = now()
  where payment_id = p_payment_id;

  select coalesce(sum(paid_amount), 0)::integer into paid_total
  from public.booking_payments where booking_id = payment_row.booking_id and status = 'succeeded';

  update public.bookings
  set amount_paid = paid_total, balance_due = greatest(total_amount - paid_total, 0),
      status = case when paid_total >= deposit_amount then 'confirmed' else status end,
      stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
      paid_in_full_at = case when paid_total >= total_amount then coalesce(paid_in_full_at, now()) else null end,
      days_until_zero_balance = greatest(final_payment_deadline - current_date, 0), updated_at = now()
  where booking_id = payment_row.booking_id returning * into booking_row;

  if booking_row.payment_plan = 'installments' and p_customer_id is not null and p_payment_method_id is not null then
    insert into private.booking_autopay_methods (booking_id, stripe_customer_id, stripe_payment_method_id)
    values (payment_row.booking_id, p_customer_id, p_payment_method_id)
    on conflict (booking_id) do update
      set stripe_customer_id = excluded.stripe_customer_id,
          stripe_payment_method_id = excluded.stripe_payment_method_id,
          updated_at = now();
  end if;

  if payment_row.kind = 'deposit' then perform private.ensure_booking_installments(payment_row.booking_id); end if;
  return payment_row.booking_id;
end;
$$;

revoke all on function public.complete_stripe_booking_payment(text, text, boolean, uuid, text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_stripe_booking_payment(text, text, boolean, uuid, text, text, integer, text, text, text) to service_role;

create or replace function public.claim_due_auto_payments(p_limit integer default 25)
returns table (
  payment_id uuid, booking_id uuid, amount integer, currency text,
  stripe_customer_id text, stripe_payment_method_id text,
  trip_title text, checkout_attempt integer
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
  set status = 'processing', checkout_started_at = now(),
      checkout_attempt = bp.checkout_attempt + case when bp.status = 'scheduled' then 1 else 0 end,
      updated_at = now()
  from due, public.bookings b, public.trips t, private.booking_autopay_methods ap
  where bp.payment_id = due.payment_id and b.booking_id = bp.booking_id
    and t.trip_id = b.trip_id and ap.booking_id = b.booking_id
  returning bp.payment_id, bp.booking_id, bp.scheduled_amount, bp.currency,
    ap.stripe_customer_id, ap.stripe_payment_method_id, t.title, bp.checkout_attempt;
end;
$$;

revoke all on function public.claim_due_auto_payments(integer) from public, anon, authenticated;
grant execute on function public.claim_due_auto_payments(integer) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'autopay_cron_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'autopay_cron_secret', 'Authenticates the automatic installment Edge Function');
  end if;
end;
$$;

create or replace function public.verify_autopay_cron_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'autopay_cron_secret' and decrypted_secret = p_secret
  );
$$;

revoke all on function public.verify_autopay_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_autopay_cron_secret(text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'trv-daily-automatic-installments';
select cron.schedule(
  'trv-daily-automatic-installments',
  '0 13 * * *',
  $job$
  select net.http_post(
    url := 'https://lqdflvnkiskzmvvknmmh.supabase.co/functions/v1/charge-scheduled-payments',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'autopay_cron_secret')
    ),
    body := jsonb_build_object('source', 'supabase-cron'),
    timeout_milliseconds := 120000
  );
  $job$
);
