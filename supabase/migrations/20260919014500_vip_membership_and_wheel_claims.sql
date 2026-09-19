-- TRV VIP membership, subscriber prize expiration, and protected offer access.

alter table public.subscribers
  add column if not exists spin_expires_at timestamptz;

create unique index if not exists subscribers_email_lower_unique
  on public.subscribers (lower(email));

alter table public.bookings
  add column if not exists promo_code text,
  add column if not exists promo_description text,
  add column if not exists promo_discount_amount integer not null default 0,
  add column if not exists promo_redeemed_at timestamptz;

create table if not exists public.vip_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive'
    check (status in ('inactive','trialing','active','past_due','cancelled','expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  paid_through timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  qualifying_booking_id uuid references public.bookings(booking_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vip_memberships enable row level security;

drop policy if exists "vip_members_read_own" on public.vip_memberships;
create policy "vip_members_read_own"
on public.vip_memberships for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "admins_manage_vip_memberships" on public.vip_memberships;
create policy "admins_manage_vip_memberships"
on public.vip_memberships for all
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.role = 'admin'
))
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.role = 'admin'
));

create table if not exists public.vip_offers (
  offer_id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null
    check (category in ('trip','cruise','rental_car','hotel','flight','travel_item','experience','other')),
  description text,
  display_price text,
  image_url text,
  target_url text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vip_offers enable row level security;

drop policy if exists "paid_vip_can_view_offer_cards" on public.vip_offers;
create policy "paid_vip_can_view_offer_cards"
on public.vip_offers for select
to authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
  and exists (
    select 1 from public.vip_memberships vm
    where vm.user_id = (select auth.uid())
      and (
        (vm.status = 'trialing' and vm.trial_ends_at > now())
        or (vm.status = 'active' and (vm.paid_through is null or vm.paid_through > now()))
      )
  )
);

drop policy if exists "admins_manage_vip_offers" on public.vip_offers;
create policy "admins_manage_vip_offers"
on public.vip_offers for all
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.role = 'admin'
))
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.role = 'admin'
));

revoke select (target_url) on public.vip_offers from anon, authenticated;
grant select (offer_id,title,category,description,display_price,image_url,starts_at,ends_at,is_active,sort_order,created_at,updated_at)
on public.vip_offers to authenticated;

drop policy if exists "Anyone can read discount codes" on public.discount_codes;
revoke select on public.discount_codes from anon;
grant select on public.discount_codes to authenticated;
