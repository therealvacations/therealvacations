-- Avoid policy recursion through legacy bookings/profile policies while still
-- allowing an authenticated traveler to read a trip attached to their booking.
create or replace function private.can_view_trv_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    else
      exists (
        select 1 from public.admin_users au
        where au.id = (select auth.uid()) and au.can_edit_trips
      )
      or exists (
        select 1 from public.bookings b
        where b.trip_id = p_trip_id
          and b.user_id = (select auth.uid())
      )
  end;
$$;

revoke all on function private.can_view_trv_trip(uuid) from public;
grant execute on function private.can_view_trv_trip(uuid) to anon, authenticated;

drop policy if exists "trips_visible_to_viewer" on public.trips;
create policy "trips_visible_to_viewer"
on public.trips for select
to anon, authenticated
using (
  status = 'active'
  or (select private.can_view_trv_trip(trip_id))
);
