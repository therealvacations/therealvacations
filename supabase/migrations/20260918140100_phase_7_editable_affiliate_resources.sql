-- Make every promotional/affiliate resource box configurable from Admin.
alter table public.resources
  add column if not exists is_featured boolean not null default false;

create index if not exists resources_featured_listing_idx
  on public.resources (is_featured desc, sort_order, resource_id)
  where is_active;

comment on column public.resources.link_url is
  'Destination URL, including the agency affiliate tracking URL when applicable.';
comment on column public.resources.is_featured is
  'Displays the resource as a prominent affiliate/search box above the standard resource groups.';

