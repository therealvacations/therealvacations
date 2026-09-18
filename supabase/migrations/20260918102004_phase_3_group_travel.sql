-- Phase 3: group leaders, invitations, memberships, and individual shares.
-- Staged only. Do not apply until the complete portal release is approved.

create table public.travel_groups (
  group_id uuid primary key default gen_random_uuid(),
  request_id uuid unique references public.travel_requests(request_id) on delete set null,
  quote_id uuid references public.travel_quotes(quote_id) on delete set null,
  trip_id uuid references public.trips(trip_id) on delete set null,
  leader_user_id uuid not null references public.users(user_id) on delete restrict,
  name text not null,
  group_type text,
  status text not null default 'planning'
    check (status in ('planning', 'inviting', 'confirmed', 'traveling', 'completed', 'cancelled')),
  separate_payments boolean not null default true,
  target_travelers integer check (target_travelers is null or target_travelers > 0),
  target_rooms integer check (target_rooms is null or target_rooms > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.travel_group_members (
  membership_id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.travel_groups(group_id) on delete cascade,
  user_id uuid references public.users(user_id) on delete set null,
  invited_email text,
  display_name text,
  role text not null default 'member' check (role in ('leader', 'member')),
  status text not null default 'invited'
    check (status in ('invited', 'joined', 'declined', 'removed')),
  booking_id uuid references public.bookings(booking_id) on delete set null,
  share_total integer check (share_total is null or share_total >= 0),
  share_paid integer not null default 0 check (share_paid >= 0),
  share_status text not null default 'unassigned'
    check (share_status in ('unassigned', 'pending', 'partial', 'paid', 'waived')),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or invited_email is not null)
);

create table public.travel_group_invitations (
  invitation_id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.travel_groups(group_id) on delete cascade,
  invited_by uuid not null references public.users(user_id) on delete restrict,
  invited_email text,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_by uuid references public.users(user_id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index travel_groups_leader_idx on public.travel_groups(leader_user_id);
create index travel_groups_trip_idx on public.travel_groups(trip_id);
create index travel_group_members_group_idx on public.travel_group_members(group_id, status);
create unique index travel_group_members_user_unique
  on public.travel_group_members(group_id, user_id)
  where user_id is not null;
create index travel_group_members_invited_email_idx
  on public.travel_group_members(group_id, lower(invited_email))
  where invited_email is not null;
create index travel_group_invitations_group_idx
  on public.travel_group_invitations(group_id, status, expires_at);

create trigger travel_groups_set_updated_at
before update on public.travel_groups
for each row execute function private.set_trv_updated_at();

create trigger travel_group_members_set_updated_at
before update on public.travel_group_members
for each row execute function private.set_trv_updated_at();

create trigger travel_group_invitations_set_updated_at
before update on public.travel_group_invitations
for each row execute function private.set_trv_updated_at();

-- A linked Tally group request becomes a planning group automatically.
create or replace function private.ensure_travel_group_for_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_group_id uuid;
begin
  if new.is_group_request and new.user_id is not null then
    insert into public.travel_groups (
      request_id,
      leader_user_id,
      name,
      group_type,
      separate_payments,
      target_travelers,
      target_rooms
    ) values (
      new.request_id,
      new.user_id,
      coalesce(nullif(trim(new.destination), ''), 'TRV') || ' Travel Group',
      coalesce(
        nullif(new.answers ->> 'What type of group?', ''),
        nullif(new.answers ->> 'What type of group is this?', '')
      ),
      coalesce(new.separate_group_payments, true),
      new.expected_group_travelers,
      new.expected_group_rooms
    )
    on conflict (request_id) do update
      set leader_user_id = excluded.leader_user_id,
          separate_payments = excluded.separate_payments,
          target_travelers = excluded.target_travelers,
          target_rooms = excluded.target_rooms
    returning group_id into linked_group_id;

    insert into public.travel_group_members (
      group_id, user_id, invited_email, role, status, joined_at
    )
    select
      linked_group_id,
      new.user_id,
      lower(au.email),
      'leader',
      'joined',
      now()
    from auth.users au
    where au.id = new.user_id
    on conflict (group_id, user_id) where user_id is not null do update
      set role = 'leader', status = 'joined', joined_at = coalesce(public.travel_group_members.joined_at, now());
  end if;

  return new;
end;
$$;

revoke all on function private.ensure_travel_group_for_request() from public, anon, authenticated;

create trigger travel_requests_ensure_group
after insert or update of user_id, is_group_request on public.travel_requests
for each row execute function private.ensure_travel_group_for_request();

-- Called only by the authenticated join Edge Function through the service role.
-- SECURITY INVOKER keeps the function atomic without elevating API callers.
create or replace function public.accept_travel_group_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invitation public.travel_group_invitations%rowtype;
  linked_membership_id uuid;
begin
  select * into invitation
  from public.travel_group_invitations
  where token_hash = p_token_hash
  for update;

  if invitation.invitation_id is null
     or invitation.status <> 'pending'
     or invitation.expires_at <= now() then
    raise exception 'Invitation is invalid or expired';
  end if;

  if invitation.invited_email is not null
     and lower(invitation.invited_email) <> lower(p_email) then
    raise exception 'Invitation belongs to another email address';
  end if;

  if not exists (select 1 from public.users u where u.user_id = p_user_id) then
    raise exception 'Traveler profile is not ready';
  end if;

  select membership_id into linked_membership_id
  from public.travel_group_members
  where group_id = invitation.group_id and user_id = p_user_id
  for update;

  if linked_membership_id is null and invitation.invited_email is not null then
    select membership_id into linked_membership_id
    from public.travel_group_members
    where group_id = invitation.group_id
      and user_id is null
      and lower(invited_email) = lower(invitation.invited_email)
      and status = 'invited'
    order by created_at desc
    limit 1
    for update;
  end if;

  if linked_membership_id is null then
    insert into public.travel_group_members (
      group_id, user_id, invited_email, role, status, joined_at
    ) values (
      invitation.group_id, p_user_id, lower(p_email), 'member', 'joined', now()
    );
  else
    update public.travel_group_members
    set user_id = p_user_id,
        invited_email = lower(p_email),
        status = 'joined',
        joined_at = coalesce(joined_at, now())
    where membership_id = linked_membership_id;
  end if;

  update public.travel_group_invitations
  set status = 'accepted', accepted_by = p_user_id, accepted_at = now()
  where invitation_id = invitation.invitation_id;

  return invitation.group_id;
end;
$$;

revoke all on function public.accept_travel_group_invitation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_travel_group_invitation(text, uuid, text) to service_role;

-- Policy helpers avoid recursive policies while keeping private tables private.
create or replace function private.is_travel_group_participant(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.travel_groups g
    where g.group_id = p_group_id and g.leader_user_id = p_user_id
  ) or exists (
    select 1 from public.travel_group_members m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
      and m.status = 'joined'
  );
$$;

create or replace function private.is_travel_group_leader(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.travel_groups g
    where g.group_id = p_group_id and g.leader_user_id = p_user_id
  );
$$;

revoke all on function private.is_travel_group_participant(uuid, uuid) from public, anon;
revoke all on function private.is_travel_group_leader(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_travel_group_participant(uuid, uuid) to authenticated;
grant execute on function private.is_travel_group_leader(uuid, uuid) to authenticated;

alter table public.travel_groups enable row level security;
alter table public.travel_group_members enable row level security;
alter table public.travel_group_invitations enable row level security;

grant select, insert, update, delete on public.travel_groups to authenticated;
grant select, insert, update, delete on public.travel_group_members to authenticated;
grant select, insert, update, delete on public.travel_group_invitations to authenticated;

create policy "participants_read_travel_groups"
on public.travel_groups for select to authenticated
using (private.is_travel_group_participant(group_id, (select auth.uid())));

create policy "admins_manage_travel_groups"
on public.travel_groups for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

create policy "members_read_self_or_leader_reads_group"
on public.travel_group_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_travel_group_leader(group_id, (select auth.uid()))
);

create policy "admins_manage_travel_group_members"
on public.travel_group_members for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

create policy "admins_manage_travel_group_invitations"
on public.travel_group_invitations for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));
