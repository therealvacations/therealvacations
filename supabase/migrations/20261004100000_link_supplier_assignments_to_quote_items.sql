alter table public.supplier_assignments
  add column if not exists quote_item_id uuid references public.travel_quote_items(item_id) on delete cascade;

create unique index if not exists supplier_assignments_quote_item_unique
  on public.supplier_assignments(quote_item_id)
  where quote_item_id is not null;
