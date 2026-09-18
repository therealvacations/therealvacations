-- Phase 2: Tally intake -> traveler request -> quote -> traveler response.
-- This migration is staged only and must not be applied to production until
-- the complete portal release is approved.

create table public.travel_requests (
  request_id uuid primary key default gen_random_uuid(),
  tally_event_id text unique,
  tally_submission_id text not null unique,
  tally_form_id text not null,
  user_id uuid references public.users(user_id) on delete set null,
  requester_email text not null,
  requester_phone text,
  primary_first_name text,
  primary_middle_name text,
  primary_last_name text,
  primary_date_of_birth date,
  request_types text[] not null default '{}',
  origin text,
  destination text,
  departure_date date,
  return_date date,
  dates_flexible text,
  traveler_count integer,
  contact_preference text,
  urgency text,
  is_group_request boolean not null default false,
  expected_group_travelers integer,
  expected_group_rooms integer,
  separate_group_payments boolean,
  service_fee_status text not null default 'not_answered'
    check (service_fee_status in ('not_answered', 'accepted', 'question')),
  status text not null default 'received'
    check (status in ('received', 'reviewing', 'awaiting_information', 'quote_in_progress', 'quote_ready', 'approved', 'closed', 'cancelled')),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.travel_request_status_history (
  history_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.travel_requests(request_id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.travel_quotes (
  quote_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.travel_requests(request_id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'viewed', 'approved', 'declined', 'expired', 'withdrawn')),
  currency text not null default 'USD',
  total_amount integer,
  deposit_amount integer,
  valid_until timestamptz,
  ready_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.travel_quote_options (
  option_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.travel_quotes(quote_id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  total_amount integer not null,
  deposit_amount integer,
  is_recommended boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.travel_quote_responses (
  response_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.travel_quotes(quote_id) on delete cascade,
  option_id uuid references public.travel_quote_options(option_id) on delete restrict,
  user_id uuid not null references public.users(user_id) on delete cascade,
  decision text not null check (decision in ('approved', 'declined', 'changes_requested')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, user_id)
);

create index travel_requests_user_id_idx on public.travel_requests(user_id);
create index travel_requests_requester_email_lower_idx on public.travel_requests(lower(requester_email));
create index travel_requests_status_idx on public.travel_requests(status);
create index travel_quotes_request_id_idx on public.travel_quotes(request_id);
create index travel_quotes_status_idx on public.travel_quotes(status);
create index travel_quote_options_quote_id_idx on public.travel_quote_options(quote_id, sort_order);
create index travel_request_history_request_id_idx on public.travel_request_status_history(request_id, created_at);

create or replace function private.set_trv_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger travel_requests_set_updated_at
before update on public.travel_requests
for each row execute function private.set_trv_updated_at();

create trigger travel_quotes_set_updated_at
before update on public.travel_quotes
for each row execute function private.set_trv_updated_at();

create trigger travel_quote_options_set_updated_at
before update on public.travel_quote_options
for each row execute function private.set_trv_updated_at();

create trigger travel_quote_responses_set_updated_at
before update on public.travel_quote_responses
for each row execute function private.set_trv_updated_at();

create or replace function private.log_travel_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.travel_request_status_history (request_id, status, changed_by)
    values (new.request_id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.log_travel_request_status() from public, anon, authenticated;

create trigger travel_requests_log_status
after insert or update of status on public.travel_requests
for each row execute function private.log_travel_request_status();

create or replace function private.apply_traveler_quote_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_request_id uuid;
begin
  select request_id into linked_request_id
  from public.travel_quotes
  where quote_id = new.quote_id;

  update public.travel_quotes
  set
    status = case
      when new.decision = 'approved' then 'approved'
      when new.decision = 'declined' then 'declined'
      else 'viewed'
    end,
    approved_at = case when new.decision = 'approved' then now() else null end,
    declined_at = case when new.decision = 'declined' then now() else null end
  where quote_id = new.quote_id;

  update public.travel_requests
  set status = case
    when new.decision = 'approved' then 'approved'
    when new.decision = 'changes_requested' then 'awaiting_information'
    else 'reviewing'
  end
  where request_id = linked_request_id;

  return new;
end;
$$;

revoke all on function private.apply_traveler_quote_response() from public, anon, authenticated;

create trigger travel_quote_responses_apply_decision
after insert or update of decision, option_id on public.travel_quote_responses
for each row execute function private.apply_traveler_quote_response();

-- Link a request immediately when it matches an already-confirmed traveler.
create or replace function private.match_travel_request_to_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    select u.user_id into new.user_id
    from public.users u
    join auth.users au on au.id = u.user_id
    where au.email_confirmed_at is not null
      and lower(au.email) = lower(new.requester_email)
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function private.match_travel_request_to_confirmed_user() from public, anon, authenticated;

create trigger travel_requests_match_confirmed_user
before insert or update of requester_email on public.travel_requests
for each row execute function private.match_travel_request_to_confirmed_user();

-- Link earlier requests after the traveler verifies the same email address.
-- The zz_ prefix ensures the Phase 1 traveler-row trigger runs first on signup.
create or replace function private.link_confirmed_user_travel_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and new.email is not null then
    update public.travel_requests
    set user_id = new.id
    where user_id is null
      and lower(requester_email) = lower(new.email)
      and exists (select 1 from public.users u where u.user_id = new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.link_confirmed_user_travel_requests() from public, anon, authenticated;

create trigger zz_on_auth_user_link_travel_requests
after insert or update of email_confirmed_at on auth.users
for each row execute function private.link_confirmed_user_travel_requests();

alter table public.travel_requests enable row level security;
alter table public.travel_request_status_history enable row level security;
alter table public.travel_quotes enable row level security;
alter table public.travel_quote_options enable row level security;
alter table public.travel_quote_responses enable row level security;

grant select on public.travel_requests to authenticated;
grant select on public.travel_request_status_history to authenticated;
grant select on public.travel_quotes to authenticated;
grant select on public.travel_quote_options to authenticated;
grant select, insert, update on public.travel_quote_responses to authenticated;

create policy "travelers_read_own_requests"
on public.travel_requests for select to authenticated
using ((select auth.uid()) = user_id);

create policy "admins_manage_travel_requests"
on public.travel_requests for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

create policy "travelers_read_own_request_history"
on public.travel_request_status_history for select to authenticated
using (exists (
  select 1 from public.travel_requests r
  where r.request_id = travel_request_status_history.request_id
    and r.user_id = (select auth.uid())
));

create policy "admins_manage_request_history"
on public.travel_request_status_history for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

create policy "travelers_read_ready_quotes"
on public.travel_quotes for select to authenticated
using (
  status in ('ready', 'viewed', 'approved', 'declined', 'expired')
  and exists (
    select 1 from public.travel_requests r
    where r.request_id = travel_quotes.request_id
      and r.user_id = (select auth.uid())
  )
);

create policy "admins_manage_travel_quotes"
on public.travel_quotes for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

create policy "travelers_read_quote_options"
on public.travel_quote_options for select to authenticated
using (exists (
  select 1
  from public.travel_quotes q
  join public.travel_requests r on r.request_id = q.request_id
  where q.quote_id = travel_quote_options.quote_id
    and q.status in ('ready', 'viewed', 'approved', 'declined', 'expired')
    and r.user_id = (select auth.uid())
));

create policy "admins_manage_quote_options"
on public.travel_quote_options for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

create policy "travelers_read_own_quote_responses"
on public.travel_quote_responses for select to authenticated
using ((select auth.uid()) = user_id);

create policy "travelers_create_own_quote_responses"
on public.travel_quote_responses for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.travel_quotes q
    join public.travel_requests r on r.request_id = q.request_id
    where q.quote_id = travel_quote_responses.quote_id
      and r.user_id = (select auth.uid())
      and q.status in ('ready', 'viewed')
      and (travel_quote_responses.option_id is null or exists (
        select 1 from public.travel_quote_options qo
        where qo.option_id = travel_quote_responses.option_id
          and qo.quote_id = q.quote_id
      ))
  )
);

create policy "travelers_update_own_quote_responses"
on public.travel_quote_responses for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.travel_quotes q
    join public.travel_requests r on r.request_id = q.request_id
    where q.quote_id = travel_quote_responses.quote_id
      and r.user_id = (select auth.uid())
      and q.status in ('ready', 'viewed')
      and (travel_quote_responses.option_id is null or exists (
        select 1 from public.travel_quote_options qo
        where qo.option_id = travel_quote_responses.option_id
          and qo.quote_id = q.quote_id
      ))
  )
);

create policy "admins_manage_quote_responses"
on public.travel_quote_responses for all to authenticated
using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));
