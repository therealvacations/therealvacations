-- Consolidate Phase 7 SELECT policies so each content table has one policy
-- per role/action while retaining public, traveler, and administrator access.

drop policy if exists "public_reads_active_trips" on public.trips;
drop policy if exists "trip_admins_read_all" on public.trips;
drop policy if exists "travelers_read_booked_trips" on public.trips;

create policy "trips_visible_to_viewer"
on public.trips for select
to anon, authenticated
using (
  status = 'active'
  or (
    (select auth.uid()) is not null
    and (
      exists (
        select 1 from public.admin_users au
        where au.id = (select auth.uid()) and au.can_edit_trips
      )
      or exists (
        select 1 from public.bookings b
        where b.trip_id = trips.trip_id
          and b.user_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists "public_reads_active_trip_packages" on public.trip_packages;
drop policy if exists "trip_admins_manage_packages" on public.trip_packages;

create policy "trip_packages_visible_to_viewer"
on public.trip_packages for select
to anon, authenticated
using (
  (
    is_active and exists (
      select 1 from public.trips t
      where t.trip_id = trip_packages.trip_id and t.status = 'active'
    )
  )
  or exists (
    select 1 from public.admin_users au
    where au.id = (select auth.uid()) and au.can_edit_trips
  )
);
create policy "trip_admins_insert_packages"
on public.trip_packages for insert
to authenticated
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_trips
));
create policy "trip_admins_update_packages"
on public.trip_packages for update
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_trips
))
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_trips
));
create policy "trip_admins_delete_packages"
on public.trip_packages for delete
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_trips
));

drop policy if exists "public_reads_active_resources" on public.resources;
drop policy if exists "resource_admins_manage" on public.resources;

create policy "resources_visible_to_viewer"
on public.resources for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1 from public.admin_users au
    where au.id = (select auth.uid()) and au.can_edit_resources
  )
);
create policy "resource_admins_insert"
on public.resources for insert
to authenticated
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_resources
));
create policy "resource_admins_update"
on public.resources for update
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_resources
))
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_resources
));
create policy "resource_admins_delete"
on public.resources for delete
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_resources
));

drop policy if exists "public_reads_published_blog" on public.blog_posts;
drop policy if exists "blog_admins_manage" on public.blog_posts;

create policy "blog_visible_to_viewer"
on public.blog_posts for select
to anon, authenticated
using (
  is_published
  or exists (
    select 1 from public.admin_users au
    where au.id = (select auth.uid()) and au.can_edit_blog
  )
);
create policy "blog_admins_insert"
on public.blog_posts for insert
to authenticated
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_blog
));
create policy "blog_admins_update"
on public.blog_posts for update
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_blog
))
with check (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_blog
));
create policy "blog_admins_delete"
on public.blog_posts for delete
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid()) and au.can_edit_blog
));
