create or replace function private.sync_travel_request_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.travel_requests
      set requester_email = lower(new.email),
          updated_at = now()
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trv_sync_requester_email_on_auth_change on auth.users;
create trigger trv_sync_requester_email_on_auth_change
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.sync_travel_request_email_from_auth();

revoke all on function private.sync_travel_request_email_from_auth() from public, anon, authenticated;
