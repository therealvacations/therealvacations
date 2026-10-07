create table if not exists public.travel_quote_item_variants (
  variant_id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.travel_quote_items(item_id) on delete cascade,
  label text not null,
  description text,
  amount integer not null check (amount >= 0),
  sort_order integer not null default 0,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_quote_item_variants_item_idx
  on public.travel_quote_item_variants(item_id,sort_order);

create table if not exists public.travel_quote_item_variant_admin (
  variant_id uuid primary key references public.travel_quote_item_variants(variant_id) on delete cascade,
  supplier_id uuid references public.suppliers(supplier_id) on delete set null,
  supplier_cost integer,
  booking_url text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.travel_quote_responses
  add column if not exists selected_item_variants jsonb not null default '{}'::jsonb;

alter table public.custom_bookings
  add column if not exists selection_snapshot jsonb not null default '{}'::jsonb;

alter table public.travel_quote_item_variants enable row level security;
alter table public.travel_quote_item_variant_admin enable row level security;

drop policy if exists admins_manage_quote_item_variants on public.travel_quote_item_variants;
create policy admins_manage_quote_item_variants on public.travel_quote_item_variants
for all to authenticated
using (exists (select 1 from public.admin_users au where au.id=(select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id=(select auth.uid())));

drop policy if exists travelers_read_quote_item_variants on public.travel_quote_item_variants;
create policy travelers_read_quote_item_variants on public.travel_quote_item_variants
for select to authenticated
using (
  active=true and exists (
    select 1
    from public.travel_quote_items i
    join public.travel_quote_options o on o.option_id=i.option_id
    join public.travel_quotes q on q.quote_id=o.quote_id
    join public.travel_requests r on r.request_id=q.request_id
    where i.item_id=travel_quote_item_variants.item_id
      and i.client_visible is distinct from false
      and q.status in ('ready','viewed','approved','declined','expired')
      and r.user_id=(select auth.uid())
  )
);

drop policy if exists admins_manage_quote_item_variant_admin on public.travel_quote_item_variant_admin;
create policy admins_manage_quote_item_variant_admin on public.travel_quote_item_variant_admin
for all to authenticated
using (exists (select 1 from public.admin_users au where au.id=(select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id=(select auth.uid())));

grant select,insert,update,delete on public.travel_quote_item_variants to authenticated;
grant select,insert,update,delete on public.travel_quote_item_variant_admin to authenticated;
grant all on public.travel_quote_item_variants to service_role;
grant all on public.travel_quote_item_variant_admin to service_role;
