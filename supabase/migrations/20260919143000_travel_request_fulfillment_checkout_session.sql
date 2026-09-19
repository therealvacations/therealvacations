alter table public.travel_request_fulfillments
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists travel_request_fulfillments_checkout_unique
  on public.travel_request_fulfillments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
