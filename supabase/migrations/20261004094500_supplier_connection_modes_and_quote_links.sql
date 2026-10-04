alter table public.suppliers
  add column if not exists connection_mode text not null default 'admin_managed'
    check (connection_mode in ('portal_account','admin_managed')),
  add column if not exists booking_instructions text,
  add column if not exists required_traveler_information text;

alter table public.travel_quote_items
  add column if not exists supplier_id uuid references public.suppliers(supplier_id) on delete set null,
  add column if not exists image_url text;

alter table public.travel_request_fulfillments
  add column if not exists supplier_id uuid references public.suppliers(supplier_id) on delete set null;

create index if not exists travel_quote_items_supplier_id_idx on public.travel_quote_items(supplier_id);
create index if not exists travel_request_fulfillments_supplier_id_idx on public.travel_request_fulfillments(supplier_id);
