alter table public.site_settings
  add column if not exists contact_email text not null default 'kc@therealvacations.com',
  add column if not exists contact_phone text,
  add column if not exists contact_heading text not null default 'Get In Touch',
  add column if not exists contact_intro text not null default 'Ready to book your next adventure? We are here to help!',
  add column if not exists business_hours text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.site_settings enable row level security;

drop policy if exists "Admins can manage site settings" on public.site_settings;
drop policy if exists "Anyone can read site settings" on public.site_settings;

insert into public.site_settings
  (id, contact_email, contact_phone, contact_heading, contact_intro, business_hours)
values
  (1, 'kc@therealvacations.com', null, 'Get In Touch',
   'Ready to book your next adventure? We are here to help!',
   'Monday - Friday: 9:00 AM - 6:00 PM EST\nSaturday: 10:00 AM - 4:00 PM EST\nSunday: Closed')
on conflict (id) do update
set contact_email = excluded.contact_email, contact_phone = null, updated_at = now();

drop policy if exists "public_reads_contact_settings" on public.site_settings;
create policy "public_reads_contact_settings"
on public.site_settings for select
to anon, authenticated
using (id = 1);

drop policy if exists "admins_insert_contact_settings" on public.site_settings;
create policy "admins_insert_contact_settings"
on public.site_settings for insert
to authenticated
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

drop policy if exists "admins_update_contact_settings" on public.site_settings;
create policy "admins_update_contact_settings"
on public.site_settings for update
to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
