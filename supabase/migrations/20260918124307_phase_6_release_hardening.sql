-- Phase 6: release hardening for the new portal relationships.
-- These covering indexes keep foreign-key checks and portal joins efficient.

create index if not exists bookings_trip_id_idx
  on public.bookings(trip_id);
create index if not exists trip_packages_trip_id_idx
  on public.trip_packages(trip_id);
create index if not exists travel_request_history_changed_by_idx
  on public.travel_request_status_history(changed_by)
  where changed_by is not null;
create index if not exists travel_quotes_created_by_idx
  on public.travel_quotes(created_by)
  where created_by is not null;
create index if not exists travel_quote_responses_option_id_idx
  on public.travel_quote_responses(option_id)
  where option_id is not null;
create index if not exists travel_quote_responses_user_id_idx
  on public.travel_quote_responses(user_id);
create index if not exists travel_groups_quote_id_idx
  on public.travel_groups(quote_id)
  where quote_id is not null;
create index if not exists travel_group_members_user_id_idx
  on public.travel_group_members(user_id)
  where user_id is not null;
create index if not exists travel_group_members_booking_id_idx
  on public.travel_group_members(booking_id)
  where booking_id is not null;
create index if not exists travel_group_invitations_invited_by_idx
  on public.travel_group_invitations(invited_by);
create index if not exists travel_group_invitations_accepted_by_idx
  on public.travel_group_invitations(accepted_by)
  where accepted_by is not null;
