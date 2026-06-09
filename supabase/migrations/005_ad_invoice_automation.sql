-- ════════════════════════════════════════════════════════════════════
-- Ad-Platform Invoice Automation  (SEPARATE PRODUCT — isolated from the
-- invoice/report flow). Pulls invoice PDFs from Facebook/Google ad
-- accounts via BrowserAct and forwards them to clients.
-- ════════════════════════════════════════════════════════════════════

-- ── Single-row settings (mirrors app_settings, but fully separate) ──
create table if not exists ad_automation_settings (
  id                  smallint primary key default 1 check (id = 1),
  browseract_api_key  text not null default '',
  facebook_workflow_id text not null default '',
  google_workflow_id  text not null default '',
  browseract_profile_id text not null default '',   -- persistent logged-in session
  scrape_day          smallint not null default 6 check (scrape_day between 1 and 28),
  session_healthy     boolean not null default false,
  last_run_at         timestamptz,
  email_subject       text,                          -- separate template, not the invoice one
  email_body          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into ad_automation_settings (id) values (1) on conflict (id) do nothing;

-- ── Per-client ad-account mapping (which accounts to scrape) ──
create table if not exists ad_accounts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  platform        text not null check (platform in ('facebook', 'google')),
  account_id      text not null,                     -- FB ad account id / Google customer id
  account_label   text,                              -- optional friendly name
  recipient_email text,                              -- override; falls back to client email
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, platform, account_id)
);

create index if not exists idx_ad_accounts_client on ad_accounts(client_id);

-- ── Scraped invoice drafts awaiting review (the queue of THIS product) ──
create table if not exists ad_invoice_drafts (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  ad_account_id     uuid references ad_accounts(id) on delete set null,
  platform          text not null check (platform in ('facebook', 'google')),
  billing_month     date not null,                   -- always YYYY-MM-01
  account_label     text,
  pdf_path          text,                            -- Supabase Storage path
  pdf_filename      text,
  amount            numeric,
  currency          text,
  recipient_email   text,
  status            text not null default 'pending_review'
                      check (status in ('pending_review','sent','failed','skipped')),
  browseract_task_id text,
  error_message     text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (client_id, platform, billing_month)
);

create index if not exists idx_ad_invoice_drafts_status on ad_invoice_drafts(status);
create index if not exists idx_ad_invoice_drafts_month  on ad_invoice_drafts(billing_month);

-- ── RLS (same pattern as the rest of the schema) ──
alter table ad_automation_settings enable row level security;
alter table ad_accounts            enable row level security;
alter table ad_invoice_drafts      enable row level security;

create policy "authenticated full access" on ad_automation_settings
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ad_accounts
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ad_invoice_drafts
  for all to authenticated using (true) with check (true);

-- ── Private storage bucket for the downloaded PDFs ──
insert into storage.buckets (id, name, public)
values ('ad-invoices', 'ad-invoices', false)
on conflict (id) do nothing;

create policy "authenticated read ad-invoices"
  on storage.objects for select to authenticated
  using (bucket_id = 'ad-invoices');
create policy "authenticated write ad-invoices"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-invoices');
