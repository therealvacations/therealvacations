-- Phase 4: authenticated Stripe Checkout and an idempotent payment ledger.
-- Staged only. Do not apply until the complete portal release is approved.

-- Reconcile the current public trip facts before money can be collected.
update public.trips
set title = 'Mary J. Blige: My Life, My Story',
    slug = 'mary-j-blige-my-life-my-story-las-vegas-oct-22-24-2026',
    dates_start = date '2026-10-22',
    dates_end = date '2026-10-24',
    location = 'Las Vegas, NV',
    deposit_amount = 50000,
    total_cost = 189500,
    updated_at = now()
where slug = 'mary-j-blige-night-1-las-vegas-july-17-2026';

update public.trips
set total_cost = 249500, deposit_amount = 50000, updated_at = now()
where slug = 'essence-festival-new-orleans-july-3-5-2026';

update public.trips
set total_cost = 129500, deposit_amount = 50000, updated_at = now()
where slug = 'keith-sweat-r-and-b-tour-atlanta-august-29-2026';

-- Past trips must never remain purchasable merely because a static page is stale.
update public.trips
set status = 'completed', updated_at = now()
where dates_end < current_date and status = 'active';

create table public.trip_packages (
  package_id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(trip_id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_-]+$'),
  name text not null,
  description text,
  total_amount integer not null check (total_amount > 0),
  deposit_amount integer not null check (deposit_amount > 0 and deposit_amount <= total_amount),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, code)
);

create index trip_packages_active_trip_idx
  on public.trip_packages(trip_id, sort_order)
  where is_active;

insert into public.trip_packages (trip_id, code, name, total_amount, deposit_amount, sort_order)
select trip_id, package.code, package.name, package.total_amount, package.deposit_amount, package.sort_order
from public.trips
cross join lateral (values
  ('general', 'General Package', 249500, 50000, 1),
  ('vip', 'VIP Package', 369500, 50000, 2)
) as package(code, name, total_amount, deposit_amount, sort_order)
where slug = 'essence-festival-new-orleans-july-3-5-2026'
on conflict (trip_id, code) do update
set name = excluded.name,
    total_amount = excluded.total_amount,
    deposit_amount = excluded.deposit_amount,
    sort_order = excluded.sort_order;

insert into public.trip_packages (trip_id, code, name, total_amount, deposit_amount, sort_order)
select trip_id, package.code, package.name, package.total_amount, package.deposit_amount, package.sort_order
from public.trips
cross join lateral (values
  ('general', 'General Package', 189500, 50000, 1),
  ('vip', 'VIP Package', 279500, 50000, 2)
) as package(code, name, total_amount, deposit_amount, sort_order)
where slug = 'mary-j-blige-my-life-my-story-las-vegas-oct-22-24-2026'
on conflict (trip_id, code) do update
set name = excluded.name,
    total_amount = excluded.total_amount,
    deposit_amount = excluded.deposit_amount,
    sort_order = excluded.sort_order;

insert into public.trip_packages (trip_id, code, name, total_amount, deposit_amount, sort_order)
select trip_id, package.code, package.name, package.total_amount, package.deposit_amount, package.sort_order
from public.trips
cross join lateral (values
  ('general', 'General Package', 129500, 50000, 1),
  ('vip', 'VIP Package', 219500, 50000, 2)
) as package(code, name, total_amount, deposit_amount, sort_order)
where slug = 'keith-sweat-r-and-b-tour-atlanta-august-29-2026'
on conflict (trip_id, code) do update
set name = excluded.name,
    total_amount = excluded.total_amount,
    deposit_amount = excluded.deposit_amount,
    sort_order = excluded.sort_order;

alter table public.bookings
  add column package_id uuid references public.trip_packages(package_id) on delete restrict,
  add column payment_plan text not null default 'installments'
    check (payment_plan in ('installments', 'pay_in_full')),
  add column currency text not null default 'usd' check (currency ~ '^[a-z]{3}$');

create index bookings_package_id_idx on public.bookings(package_id);

alter table public.booking_payments
  add column payment_number integer,
  add column kind text not null default 'installment'
    check (kind in ('deposit', 'installment', 'pay_in_full', 'adjustment')),
  add column currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  add column stripe_checkout_session_id text,
  add column checkout_attempt integer not null default 0 check (checkout_attempt >= 0),
  add column checkout_started_at timestamptz,
  add column stripe_event_id text,
  add column failure_code text,
  add column failure_message text;

alter table public.booking_payments
  add constraint booking_payments_amounts_check
    check (scheduled_amount > 0 and paid_amount >= 0),
  add constraint booking_payments_status_check
    check (status in ('scheduled', 'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'));

create unique index booking_payments_checkout_session_unique
  on public.booking_payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index booking_payments_payment_intent_unique
  on public.booking_payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index booking_payments_booking_status_idx
  on public.booking_payments(booking_id, status, scheduled_for);
create index booking_payments_due_idx
  on public.booking_payments(scheduled_for, booking_id)
  where status in ('scheduled', 'failed');

create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  payment_id uuid references public.booking_payments(payment_id) on delete set null,
  processed_at timestamptz not null default now()
);

create index stripe_webhook_events_payment_id_idx
  on public.stripe_webhook_events(payment_id)
  where payment_id is not null;

create trigger trip_packages_set_updated_at
before update on public.trip_packages
for each row execute function private.set_trv_updated_at();

-- Generate monthly installments only after the deposit is actually paid.
create or replace function private.ensure_booking_installments(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  first_due date;
  due_date date;
  installment_count integer;
  installment_amount integer;
  installment_remainder integer;
  remaining_amount integer;
  payment_index integer;
begin
  select * into booking_row
  from public.bookings
  where booking_id = p_booking_id
  for update;

  if booking_row.payment_plan <> 'installments' then return; end if;

  remaining_amount := greatest(booking_row.total_amount - booking_row.amount_paid, 0);
  if remaining_amount = 0 then return; end if;

  first_due := (date_trunc('month', current_date) + interval '1 month')::date;
  if booking_row.final_payment_deadline < first_due then
    first_due := booking_row.final_payment_deadline;
  end if;
  if first_due <= current_date then
    raise exception 'Installment deadline has passed';
  end if;

  installment_count := greatest(
    1,
    ((extract(year from booking_row.final_payment_deadline)::integer - extract(year from first_due)::integer) * 12)
      + extract(month from booking_row.final_payment_deadline)::integer
      - extract(month from first_due)::integer
      + 1
  );
  installment_amount := remaining_amount / installment_count;
  installment_remainder := remaining_amount % installment_count;

  for payment_index in 1..installment_count loop
    due_date := least(
      (first_due + ((payment_index - 1) || ' months')::interval)::date,
      booking_row.final_payment_deadline
    );
    insert into public.booking_payments (
      booking_id, scheduled_amount, scheduled_for, payment_number, kind, currency, status
    ) values (
      p_booking_id,
      installment_amount + case when payment_index <= installment_remainder then 1 else 0 end,
      due_date,
      payment_index,
      'installment',
      booking_row.currency,
      'scheduled'
    )
    on conflict (booking_id, scheduled_for) do nothing;
  end loop;
end;
$$;

revoke all on function private.ensure_booking_installments(uuid) from public, anon, authenticated;

-- Called only by the verified Stripe webhook through the service role.
create or replace function public.complete_stripe_booking_payment(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payment_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_total integer,
  p_currency text,
  p_customer_id text
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
    from public.booking_payments where payment_id = p_payment_id;
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
      stripe_checkout_session_id = p_checkout_session_id,
      stripe_payment_intent_id = p_payment_intent_id,
      stripe_event_id = p_event_id,
      failure_code = null,
      failure_message = null
  where payment_id = p_payment_id;

  select coalesce(sum(paid_amount), 0)::integer into paid_total
  from public.booking_payments
  where booking_id = payment_row.booking_id and status = 'succeeded';

  update public.bookings
  set amount_paid = paid_total,
      balance_due = greatest(total_amount - paid_total, 0),
      status = case when paid_total >= deposit_amount then 'confirmed' else status end,
      stripe_customer_id = coalesce(stripe_customer_id, p_customer_id),
      paid_in_full_at = case when paid_total >= total_amount then coalesce(paid_in_full_at, now()) else null end,
      updated_at = now()
  where booking_id = payment_row.booking_id
  returning * into booking_row;

  if payment_row.kind = 'deposit' then
    perform private.ensure_booking_installments(payment_row.booking_id);
  end if;

  return payment_row.booking_id;
end;
$$;

revoke all on function public.complete_stripe_booking_payment(text, text, boolean, uuid, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.complete_stripe_booking_payment(text, text, boolean, uuid, text, text, integer, text, text) to service_role;

create or replace function public.sync_stripe_booking_payment_status(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payment_id uuid,
  p_status text,
  p_failure_code text default null,
  p_failure_message text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_booking_id uuid;
  paid_total integer;
begin
  if p_status not in ('failed', 'cancelled', 'refunded') then
    raise exception 'Unsupported payment status';
  end if;

  insert into public.stripe_webhook_events (event_id, event_type, livemode, payment_id)
  values (p_event_id, p_event_type, p_livemode, p_payment_id)
  on conflict (event_id) do nothing;
  if not found then return null; end if;

  update public.booking_payments
  set status = p_status,
      paid_amount = case when p_status = 'refunded' then 0 else paid_amount end,
      failure_code = p_failure_code,
      failure_message = p_failure_message,
      stripe_event_id = p_event_id
  where payment_id = p_payment_id
  returning booking_id into linked_booking_id;

  if linked_booking_id is null then raise exception 'Unknown payment'; end if;

  select coalesce(sum(paid_amount), 0)::integer into paid_total
  from public.booking_payments
  where booking_id = linked_booking_id and status = 'succeeded';

  update public.bookings
  set amount_paid = paid_total,
      balance_due = greatest(total_amount - paid_total, 0),
      status = case when paid_total >= deposit_amount then 'confirmed' else 'pending' end,
      paid_in_full_at = case when paid_total >= total_amount then paid_in_full_at else null end,
      updated_at = now()
  where booking_id = linked_booking_id;

  return linked_booking_id;
end;
$$;

revoke all on function public.sync_stripe_booking_payment_status(text, text, boolean, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sync_stripe_booking_payment_status(text, text, boolean, uuid, text, text, text) to service_role;

-- Atomically prepares the canonical booking and first payment. The Edge
-- Function supplies the authenticated user ID; package prices never come from
-- browser input.
create or replace function public.prepare_stripe_booking_checkout(
  p_user_id uuid,
  p_trip_slug text,
  p_package_code text,
  p_payment_plan text
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

  checkout_amount := case
    when p_payment_plan = 'pay_in_full' then package_row.total_amount
    else package_row.deposit_amount
  end;
  checkout_kind := case
    when p_payment_plan = 'pay_in_full' then 'pay_in_full'
    else 'deposit'
  end;

  select * into booking_row
  from public.bookings
  where user_id = p_user_id and trip_id = trip_row.trip_id
  for update;

  if booking_row.booking_id is not null then
    if booking_row.amount_paid > 0 then
      raise exception 'A booking already exists for this trip';
    end if;

    select * into payment_row
    from public.booking_payments
    where public.booking_payments.booking_id = booking_row.booking_id
    order by created_at
    limit 1
    for update;

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
        updated_at = now()
    where public.bookings.booking_id = booking_row.booking_id;
    new_booking_id := booking_row.booking_id;

    if payment_row.payment_id is null then
      insert into public.booking_payments (
        booking_id, scheduled_amount, scheduled_for, payment_number, kind, currency, status
      ) values (
        new_booking_id, checkout_amount, current_date, 0, checkout_kind,
        package_row.currency, 'pending'
      ) returning public.booking_payments.payment_id into new_payment_id;
    else
      update public.booking_payments
      set scheduled_amount = checkout_amount,
          kind = checkout_kind,
          currency = package_row.currency,
          status = case when stripe_checkout_session_id is null then 'pending' else status end,
          updated_at = now()
      where public.booking_payments.payment_id = payment_row.payment_id
      returning public.booking_payments.payment_id into new_payment_id;
    end if;
  else
    insert into public.bookings (
      user_id, trip_id, package_id, status, total_amount, deposit_amount,
      balance_due, amount_paid, auto_pay_deadline, final_payment_deadline,
      days_until_zero_balance, payment_plan, currency
    ) values (
      p_user_id, trip_row.trip_id, package_row.package_id, 'pending',
      package_row.total_amount, package_row.deposit_amount,
      package_row.total_amount, 0, final_deadline, final_deadline,
      greatest(final_deadline - current_date, 0), p_payment_plan, package_row.currency
    ) returning public.bookings.booking_id into new_booking_id;

    insert into public.booking_payments (
      booking_id, scheduled_amount, scheduled_for, payment_number, kind, currency, status
    ) values (
      new_booking_id, checkout_amount, current_date, 0, checkout_kind,
      package_row.currency, 'pending'
    ) returning public.booking_payments.payment_id into new_payment_id;
  end if;

  return query select
    new_payment_id,
    new_booking_id,
    trip_row.title,
    package_row.name,
    checkout_amount,
    package_row.currency;
end;
$$;

revoke all on function public.prepare_stripe_booking_checkout(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.prepare_stripe_booking_checkout(uuid, text, text, text) to service_role;

create or replace function public.claim_stripe_booking_payment(
  p_user_id uuid,
  p_payment_id uuid
)
returns table (
  payment_id uuid,
  booking_id uuid,
  trip_title text,
  package_name text,
  amount integer,
  currency text,
  checkout_attempt integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  update public.booking_payments bp
  set checkout_attempt = bp.checkout_attempt + 1,
      checkout_started_at = now(),
      status = 'pending',
      stripe_checkout_session_id = null,
      failure_code = null,
      failure_message = null,
      updated_at = now()
  from public.bookings b
  join public.trips t on t.trip_id = b.trip_id
  left join public.trip_packages tp on tp.package_id = b.package_id
  where bp.payment_id = p_payment_id
    and bp.booking_id = b.booking_id
    and b.user_id = p_user_id
    and (
      bp.status in ('scheduled', 'failed', 'cancelled')
      or (bp.status = 'pending' and (
        bp.checkout_started_at is null
        or bp.checkout_started_at < now() - interval '2 minutes'
      ))
    )
  returning bp.payment_id, bp.booking_id, t.title,
    coalesce(tp.name, 'Travel Package'), bp.scheduled_amount,
    bp.currency, bp.checkout_attempt;
end;
$$;

revoke all on function public.claim_stripe_booking_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_stripe_booking_payment(uuid, uuid) to service_role;

alter table public.trip_packages enable row level security;
alter table public.stripe_webhook_events enable row level security;

grant select on public.trip_packages to anon, authenticated;
grant insert, update, delete on public.trip_packages to authenticated;
grant select on public.booking_payments to authenticated;

create policy "anyone_reads_active_trip_packages"
on public.trip_packages for select to anon, authenticated
using (is_active and exists (
  select 1 from public.trips t
  where t.trip_id = trip_packages.trip_id and t.status = 'active'
));

create policy "admins_manage_trip_packages"
on public.trip_packages for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

create policy "admins_read_stripe_webhook_events"
on public.stripe_webhook_events for select to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));
