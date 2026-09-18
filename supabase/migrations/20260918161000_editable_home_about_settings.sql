alter table public.site_settings
  add column if not exists home_content jsonb not null default '{}'::jsonb,
  add column if not exists about_content jsonb not null default '{}'::jsonb;

comment on column public.site_settings.home_content is
  'Editable homepage copy, links, cards, process steps, and FAQs.';

comment on column public.site_settings.about_content is
  'Editable About page story, values, statistics, and call to action.';
