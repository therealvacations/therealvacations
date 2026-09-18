-- Phase 1: make public.users the canonical traveler record and prevent
-- browser clients from changing booking/payment financial truth.

create schema if not exists private;

create or replace function private.handle_new_trv_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  full_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  first_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  last_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
  trip_interest text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'trip_interest', '')), '');
begin
  if first_name is null and full_name is not null then
    first_name := split_part(full_name, ' ', 1);
  end if;

  if last_name is null and full_name is not null and position(' ' in full_name) > 0 then
    last_name := trim(substr(full_name, position(' ' in full_name) + 1));
  end if;

  insert into public.users (user_id, first_name, last_name, phone, trip_interests)
  values (
    new.id,
    coalesce(first_name, 'Traveler'),
    coalesce(last_name, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    case when trip_interest is null then null else jsonb_build_array(trip_interest) end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_trv_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_create_traveler on auth.users;
create trigger on_auth_user_created_create_traveler
after insert on auth.users
for each row execute function private.handle_new_trv_user();

-- Backfill Auth accounts created before the trigger existed.
insert into public.users (user_id, first_name, last_name, phone, trip_interests)
select
  au.id,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'first_name'), ''),
    nullif(split_part(coalesce(au.raw_user_meta_data ->> 'full_name', p.full_name, ''), ' ', 1), ''),
    'Traveler'
  ),
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'last_name'), ''),
    case
      when position(' ' in coalesce(au.raw_user_meta_data ->> 'full_name', p.full_name, '')) > 0
      then trim(substr(
        coalesce(au.raw_user_meta_data ->> 'full_name', p.full_name, ''),
        position(' ' in coalesce(au.raw_user_meta_data ->> 'full_name', p.full_name, '')) + 1
      ))
      else ''
    end
  ),
  nullif(trim(coalesce(au.raw_user_meta_data ->> 'phone', '')), ''),
  case
    when nullif(trim(coalesce(au.raw_user_meta_data ->> 'trip_interest', '')), '') is null then null
    else jsonb_build_array(trim(au.raw_user_meta_data ->> 'trip_interest'))
  end
from auth.users au
left join public.profiles p on p.id = au.id
on conflict (user_id) do nothing;

-- Traveler profile access: authenticated travelers may read/update only their row.
drop policy if exists "Users can create own profile" on public.users;
drop policy if exists "Users can see their own data" on public.users;
drop policy if exists "Users can update own profile" on public.users;

create policy "travelers_read_own_profile"
on public.users for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "travelers_update_own_profile"
on public.users for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Booking and payment amounts/statuses are managed by admins and trusted
-- server/webhook code. Travelers receive read-only access to their own rows.
drop policy if exists "Authenticated users can create bookings" on public.bookings;
drop policy if exists "user_own_bookings_modify" on public.bookings;
drop policy if exists "user_own_bookings_update" on public.bookings;
drop policy if exists "user_own_bookings_delete" on public.bookings;
drop policy if exists "Users can see their own bookings" on public.bookings;
drop policy if exists "Users see own bookings" on public.bookings;
drop policy if exists "user_own_bookings_select" on public.bookings;

create policy "travelers_read_own_bookings"
on public.bookings for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "user_own_booking_payments_insert" on public.booking_payments;
drop policy if exists "user_own_booking_payments_update" on public.booking_payments;
drop policy if exists "user_own_booking_payments_delete" on public.booking_payments;
drop policy if exists "user_own_booking_payments_select" on public.booking_payments;
drop policy if exists "bp: user read own bookings" on public.booking_payments;

create policy "travelers_read_own_booking_payments"
on public.booking_payments for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.booking_id = booking_payments.booking_id
      and b.user_id = (select auth.uid())
  )
);

drop policy if exists "Authenticated users insert own payment methods" on public.user_payment_methods;
drop policy if exists "Users can update own payment methods" on public.user_payment_methods;
