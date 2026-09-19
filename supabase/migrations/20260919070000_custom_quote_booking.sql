create table if not exists public.custom_bookings (
  custom_booking_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.travel_quotes(quote_id) on delete cascade,
  option_id uuid not null references public.travel_quote_options(option_id) on delete restrict,
  request_id uuid not null references public.travel_requests(request_id) on delete cascade,
  user_id uuid not null references public.users(user_id) on delete cascade,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','deposit_paid','paid_in_full','cancelled')),
  currency text not null default 'usd',
  total_amount integer not null check (total_amount > 0),
  deposit_amount integer,
  amount_paid integer not null default 0 check (amount_paid >= 0),
  balance_due integer not null check (balance_due >= 0),
  payment_plan text check (payment_plan in ('deposit','pay_in_full','balance')),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_booking_payments (
  payment_id uuid primary key default gen_random_uuid(),
  custom_booking_id uuid not null references public.custom_bookings(custom_booking_id) on delete cascade,
  amount integer not null check (amount > 0),
  kind text not null check (kind in ('deposit','balance','pay_in_full')),
  status text not null default 'open' check (status in ('open','succeeded','failed','expired')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_bookings_user_id_idx on public.custom_bookings(user_id);
create index if not exists custom_bookings_request_id_idx on public.custom_bookings(request_id);
create index if not exists custom_booking_payments_booking_id_idx on public.custom_booking_payments(custom_booking_id);

alter table public.custom_bookings enable row level security;
alter table public.custom_booking_payments enable row level security;

create policy "travelers_read_own_custom_bookings"
on public.custom_bookings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "admins_manage_custom_bookings"
on public.custom_bookings for all to authenticated
using (exists (select 1 from public.admin_users au where au.id=(select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id=(select auth.uid())));

create policy "travelers_read_own_custom_payments"
on public.custom_booking_payments for select to authenticated
using (exists (
  select 1 from public.custom_bookings b
  where b.custom_booking_id=custom_booking_payments.custom_booking_id
  and b.user_id=(select auth.uid())
));

create policy "admins_manage_custom_payments"
on public.custom_booking_payments for all to authenticated
using (exists (select 1 from public.admin_users au where au.id=(select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id=(select auth.uid())));

create or replace function private.create_custom_booking_from_quote_response()
returns trigger language plpgsql security definer set search_path=''
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
  if q.quote_id is null or o.option_id is null or r.user_id is null or r.user_id <> new.user_id then return new; end if;
  insert into public.custom_bookings (
    quote_id,option_id,request_id,user_id,status,currency,total_amount,deposit_amount,amount_paid,balance_due
  ) values (
    q.quote_id,o.option_id,r.request_id,r.user_id,'awaiting_payment',
    lower(coalesce(q.currency,'USD')),o.total_amount,o.deposit_amount,0,o.total_amount
  )
  on conflict (quote_id) do update set
    option_id=excluded.option_id,total_amount=excluded.total_amount,deposit_amount=excluded.deposit_amount,
    balance_due=greatest(excluded.total_amount-public.custom_bookings.amount_paid,0),updated_at=now();
  return new;
end;
$$;

revoke all on function private.create_custom_booking_from_quote_response() from public,anon,authenticated;

create trigger travel_quote_responses_create_custom_booking
after insert or update of decision, option_id on public.travel_quote_responses
for each row execute function private.create_custom_booking_from_quote_response();
