-- Phase 5: auditable, idempotent transactional email delivery.
-- Staged only. SendGrid secrets are configured only at coordinated release.

create table public.email_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  template_type text not null check (template_type in (
    'request_received', 'group_invitation', 'booking_confirmation',
    'payment_receipt', 'payment_failed', 'payment_refunded', 'payment_reminder'
  )),
  recipient_email text not null,
  subject text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  related_table text,
  related_id text,
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  attempted_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_deliveries_status_attempted_idx
  on public.email_deliveries(status, attempted_at)
  where status in ('pending', 'failed');
create index email_deliveries_related_idx
  on public.email_deliveries(related_table, related_id)
  where related_id is not null;

create trigger email_deliveries_set_updated_at
before update on public.email_deliveries
for each row execute function private.set_trv_updated_at();

alter table public.email_deliveries enable row level security;

grant select on public.email_deliveries to authenticated;

create policy "admins_read_email_deliveries"
on public.email_deliveries for select to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.id = (select auth.uid())
));

create or replace function public.claim_email_delivery(
  p_idempotency_key text,
  p_template_type text,
  p_recipient_email text,
  p_subject text,
  p_related_table text default null,
  p_related_id text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  if p_template_type not in (
    'request_received', 'group_invitation', 'booking_confirmation',
    'payment_receipt', 'payment_failed', 'payment_refunded', 'payment_reminder'
  ) then raise exception 'Unsupported email template'; end if;
  if p_recipient_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid recipient email';
  end if;

  insert into public.email_deliveries (
    idempotency_key, template_type, recipient_email, subject,
    related_table, related_id
  ) values (
    p_idempotency_key, p_template_type, lower(p_recipient_email), p_subject,
    p_related_table, p_related_id
  ) on conflict (idempotency_key) do nothing;

  update public.email_deliveries
  set status = 'sending',
      attempt_count = attempt_count + 1,
      attempted_at = now(),
      last_error = null
  where idempotency_key = p_idempotency_key
    and status <> 'sent'
    and (
      status <> 'sending'
      or attempted_at is null
      or attempted_at < now() - interval '5 minutes'
    )
  returning delivery_id into claimed_id;

  return claimed_id;
end;
$$;

revoke all on function public.claim_email_delivery(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_email_delivery(text, text, text, text, text, text) to service_role;
