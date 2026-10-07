alter table public.travel_group_members
  add column if not exists deposit_required integer
    check (deposit_required is null or deposit_required >= 0),
  add column if not exists deposit_due_at timestamptz,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists stripe_deposit_session_id text;

create unique index if not exists travel_group_members_stripe_deposit_session_unique
  on public.travel_group_members(stripe_deposit_session_id)
  where stripe_deposit_session_id is not null;
