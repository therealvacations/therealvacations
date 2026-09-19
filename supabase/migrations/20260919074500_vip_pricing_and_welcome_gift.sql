alter table public.vip_memberships
  add column if not exists billing_plan text
    check (billing_plan is null or billing_plan in ('monthly','annual')),
  add column if not exists welcome_gift_status text not null default 'not_eligible'
    check (welcome_gift_status in ('not_eligible','pending','processing','sent')),
  add column if not exists welcome_gift_note text,
  add column if not exists welcome_gift_size text,
  add column if not exists welcome_gift_shipping jsonb,
  add column if not exists welcome_gift_sent_at timestamptz;

create index if not exists vip_memberships_welcome_gift_status_idx
  on public.vip_memberships(welcome_gift_status);
