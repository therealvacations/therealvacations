alter table public.travel_quote_items
add column if not exists supplier_payment_url text;

comment on column public.travel_quote_items.supplier_payment_url is
'Admin-only exact supplier cart, checkout, or payment URL for this quote item.';