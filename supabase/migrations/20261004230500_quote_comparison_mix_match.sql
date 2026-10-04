alter table public.travel_quote_options
  add column if not exists allow_mix_and_match boolean not null default true;

alter table public.travel_quote_items
  add column if not exists selection_group text,
  add column if not exists selection_rule text not null default 'fixed',
  add column if not exists client_visible boolean not null default true,
  add column if not exists attachments jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'travel_quote_items_selection_rule_check'
  ) then
    alter table public.travel_quote_items
      add constraint travel_quote_items_selection_rule_check
      check (selection_rule in ('fixed','choose_one','optional'));
  end if;
end $$;

alter table public.travel_quotes
  add column if not exists quote_kind text not null default 'comparison',
  add column if not exists source_quote_id uuid references public.travel_quotes(quote_id) on delete set null,
  add column if not exists workflow_status text not null default 'draft';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'travel_quotes_quote_kind_check'
  ) then
    alter table public.travel_quotes
      add constraint travel_quotes_quote_kind_check
      check (quote_kind in ('comparison','custom_selection','final'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'travel_quotes_workflow_status_check'
  ) then
    alter table public.travel_quotes
      add constraint travel_quotes_workflow_status_check
      check (workflow_status in ('draft','published','client_selecting','selection_submitted','admin_review','final_quote_ready','approved','paid','payment_plan'));
  end if;
end $$;

create table if not exists public.travel_quote_client_selections (
  selection_id uuid primary key default gen_random_uuid(),
  source_quote_id uuid not null references public.travel_quotes(quote_id) on delete cascade,
  generated_quote_id uuid references public.travel_quotes(quote_id) on delete set null,
  user_id uuid not null references public.users(user_id) on delete cascade,
  selected_item_ids jsonb not null default '[]'::jsonb,
  selected_option_ids jsonb not null default '[]'::jsonb,
  total_amount integer not null default 0,
  status text not null default 'submitted',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_quote_client_selections_status_check
    check (status in ('submitted','admin_review','finalized','cancelled'))
);

alter table public.travel_quote_client_selections enable row level security;

drop policy if exists "travelers view own quote selections" on public.travel_quote_client_selections;
create policy "travelers view own quote selections"
on public.travel_quote_client_selections for select
using (
  user_id = auth.uid()
  or exists (select 1 from public.admin_users a where a.id = auth.uid())
);

drop policy if exists "admins manage quote selections" on public.travel_quote_client_selections;
create policy "admins manage quote selections"
on public.travel_quote_client_selections for all
using (exists (select 1 from public.admin_users a where a.id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.id = auth.uid()));

create index if not exists travel_quote_client_selections_source_idx
  on public.travel_quote_client_selections(source_quote_id, created_at desc);
create index if not exists travel_quotes_source_quote_idx
  on public.travel_quotes(source_quote_id);
