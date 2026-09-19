-- Booking-style travel requests require a real Stripe-saved payment method
-- plus an auditable request-specific authorization.

alter table public.user_payment_methods
  add column if not exists stripe_payment_method_id text,
  add column if not exists brand text,
  add column if not exists exp_month integer,
  add column if not exists exp_year integer,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists user_payment_methods_stripe_pm_unique
  on public.user_payment_methods(stripe_payment_method_id)
  where stripe_payment_method_id is not null;

create index if not exists user_payment_methods_user_default_idx
  on public.user_payment_methods(user_id, is_default);

create table if not exists private.travel_request_authorizations (
  authorization_id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.travel_requests(request_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  method_id uuid not null references public.user_payment_methods(method_id) on delete restrict,
  signer_name text not null check (char_length(trim(signer_name)) between 2 and 160),
  supplier_confirmation_authorized boolean not null default false,
  payment_after_confirmation_authorized boolean not null default false,
  expedited_fee_acknowledged boolean not null default false,
  terms_version text not null,
  source_ip text,
  user_agent text,
  authorized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on private.travel_request_authorizations from public, anon, authenticated;
grant select, insert, update on private.travel_request_authorizations to service_role;

create or replace function public.record_travel_request_authorization(
  p_request_id uuid,
  p_user_id uuid,
  p_method_id uuid,
  p_signer_name text,
  p_supplier_confirmation_authorized boolean,
  p_payment_after_confirmation_authorized boolean,
  p_expedited_fee_acknowledged boolean,
  p_terms_version text,
  p_source_ip text,
  p_user_agent text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare auth_id uuid;
begin
  if not exists (
    select 1 from public.travel_requests r
    where r.request_id=p_request_id and r.user_id=p_user_id
  ) then raise exception 'Travel request does not belong to user'; end if;

  if not exists (
    select 1 from public.user_payment_methods m
    where m.method_id=p_method_id and m.user_id=p_user_id
      and m.stripe_payment_method_id is not null
  ) then raise exception 'Saved payment method not found'; end if;

  if coalesce(p_supplier_confirmation_authorized,false) is not true
     or coalesce(p_payment_after_confirmation_authorized,false) is not true
  then raise exception 'Required authorization is missing'; end if;

  insert into private.travel_request_authorizations (
    request_id,user_id,method_id,signer_name,
    supplier_confirmation_authorized,payment_after_confirmation_authorized,
    expedited_fee_acknowledged,terms_version,source_ip,user_agent,updated_at
  ) values (
    p_request_id,p_user_id,p_method_id,trim(p_signer_name),
    p_supplier_confirmation_authorized,p_payment_after_confirmation_authorized,
    p_expedited_fee_acknowledged,p_terms_version,p_source_ip,p_user_agent,now()
  )
  on conflict (request_id) do update set
    method_id=excluded.method_id,
    signer_name=excluded.signer_name,
    supplier_confirmation_authorized=excluded.supplier_confirmation_authorized,
    payment_after_confirmation_authorized=excluded.payment_after_confirmation_authorized,
    expedited_fee_acknowledged=excluded.expedited_fee_acknowledged,
    terms_version=excluded.terms_version,
    source_ip=excluded.source_ip,
    user_agent=excluded.user_agent,
    authorized_at=now(),
    updated_at=now()
  returning authorization_id into auth_id;
  return auth_id;
end;
$$;

revoke all on function public.record_travel_request_authorization(uuid,uuid,uuid,text,boolean,boolean,boolean,text,text,text)
  from public,anon,authenticated;
grant execute on function public.record_travel_request_authorization(uuid,uuid,uuid,text,boolean,boolean,boolean,text,text,text)
  to service_role;
