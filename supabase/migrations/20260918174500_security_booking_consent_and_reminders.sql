-- Harden legacy admin authorization and retain an auditable booking agreement.

drop policy if exists "Admin full access bookings" on public.bookings;
drop policy if exists "Admin full access codes" on public.discount_codes;
drop policy if exists "Admin full access profiles" on public.profiles;

drop policy if exists "Profiles insert" on public.profiles;
create policy "Profiles insert"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id and coalesce(is_admin, false) = false);

drop policy if exists "Profiles update" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and coalesce(is_admin, false) = false);

drop policy if exists "admins_manage_profiles" on public.profiles;
create policy "admins_manage_profiles"
on public.profiles for all
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.id = (select auth.uid()) and au.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.id = (select auth.uid()) and au.role = 'admin'
  )
);

-- RLS filters rows; column grants stop a traveler from setting legacy admin flags.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, email, updated_at) on public.profiles to authenticated;

create table if not exists private.booking_acceptances (
  booking_id uuid primary key references public.bookings(booking_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signer_name text not null check (char_length(signer_name) between 2 and 160),
  accepted_at timestamptz not null default now(),
  booking_terms_version text not null,
  privacy_policy_version text not null,
  refund_policy_version text not null,
  automatic_payment_authorized boolean not null default false,
  automatic_payment_terms_version text,
  trip_title text not null,
  package_name text not null,
  payment_plan text not null check (payment_plan in ('installments', 'pay_in_full')),
  amount_due_now integer not null check (amount_due_now > 0),
  currency text not null,
  source_ip text,
  user_agent text,
  agreement_urls jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

revoke all on table private.booking_acceptances from public, anon, authenticated;
grant select, insert, update on table private.booking_acceptances to service_role;

create or replace function public.record_booking_acceptance(
  p_booking_id uuid, p_user_id uuid, p_signer_name text,
  p_booking_terms_version text, p_privacy_policy_version text, p_refund_policy_version text,
  p_automatic_payment_authorized boolean, p_automatic_payment_terms_version text,
  p_trip_title text, p_package_name text, p_payment_plan text,
  p_amount_due_now integer, p_currency text, p_source_ip text, p_user_agent text,
  p_agreement_urls jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into private.booking_acceptances (
    booking_id, user_id, signer_name, booking_terms_version, privacy_policy_version,
    refund_policy_version, automatic_payment_authorized, automatic_payment_terms_version,
    trip_title, package_name, payment_plan, amount_due_now, currency, source_ip, user_agent,
    agreement_urls, updated_at
  ) values (
    p_booking_id, p_user_id, p_signer_name, p_booking_terms_version, p_privacy_policy_version,
    p_refund_policy_version, p_automatic_payment_authorized, p_automatic_payment_terms_version,
    p_trip_title, p_package_name, p_payment_plan, p_amount_due_now, p_currency, p_source_ip,
    p_user_agent, p_agreement_urls, now()
  )
  on conflict (booking_id) do update set
    signer_name = excluded.signer_name, accepted_at = now(),
    booking_terms_version = excluded.booking_terms_version,
    privacy_policy_version = excluded.privacy_policy_version,
    refund_policy_version = excluded.refund_policy_version,
    automatic_payment_authorized = excluded.automatic_payment_authorized,
    automatic_payment_terms_version = excluded.automatic_payment_terms_version,
    trip_title = excluded.trip_title, package_name = excluded.package_name,
    payment_plan = excluded.payment_plan, amount_due_now = excluded.amount_due_now,
    currency = excluded.currency, source_ip = excluded.source_ip,
    user_agent = excluded.user_agent, agreement_urls = excluded.agreement_urls,
    updated_at = now();
$$;

revoke all on function public.record_booking_acceptance(uuid, uuid, text, text, text, text, boolean, text, text, text, text, integer, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_booking_acceptance(uuid, uuid, text, text, text, text, boolean, text, text, text, text, integer, text, text, text, jsonb) to service_role;

-- A separate daily reminder run keeps notices independent from the charge job.
select cron.unschedule(jobid)
from cron.job
where jobname = 'trv-payment-reminders-daily';

select cron.schedule(
  'trv-payment-reminders-daily',
  '15 15 * * *',
  $$
  select net.http_post(
    url := 'https://lqdflvnkiskzmvvknmmh.supabase.co/functions/v1/send-payment-reminders',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'autopay_cron_secret')
    ),
    body := jsonb_build_object('scheduled_at', now())
  );
  $$
);
