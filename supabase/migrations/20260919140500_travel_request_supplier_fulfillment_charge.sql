-- Live schema applied through Supabase on 2026-09-19.
-- Source-of-truth copy for request supplier confirmations and authorized off-session charges.

create table if not exists public.travel_request_fulfillments (
  fulfillment_id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.travel_requests(request_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  method_id uuid not null references public.user_payment_methods(method_id) on delete restrict,
  supplier_name text,
  supplier_subtotal integer not null check (supplier_subtotal >= 0),
  service_fee integer not null default 0 check (service_fee >= 0),
  total_amount integer not null check (total_amount > 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  confirmation_details text,
  status text not null default 'ready_to_charge'
    check (status in ('ready_to_charge','processing','requires_customer_action','paid','failed','cancelled')),
  stripe_payment_intent_id text unique,
  failure_code text,
  failure_message text,
  charged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_request_fulfillments_user_idx
  on public.travel_request_fulfillments(user_id,status);

alter table public.travel_request_fulfillments enable row level security;

drop policy if exists "admins_manage_travel_request_fulfillments" on public.travel_request_fulfillments;
create policy "admins_manage_travel_request_fulfillments"
on public.travel_request_fulfillments for all to authenticated
using (exists (select 1 from public.admin_users au where au.id=(select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id=(select auth.uid())));

drop policy if exists "travelers_read_own_travel_request_fulfillments" on public.travel_request_fulfillments;
create policy "travelers_read_own_travel_request_fulfillments"
on public.travel_request_fulfillments for select to authenticated
using ((select auth.uid())=user_id);
