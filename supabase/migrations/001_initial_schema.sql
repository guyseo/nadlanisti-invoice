-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── clients ───────────────────────────────────────────────────────────────────
create table clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text not null,
  phone               text,
  billing_type        text not null check (billing_type in ('fixed', 'media_commission', 'auto_cc')),
  email_delivery_mode text not null default 'separate' check (email_delivery_mode in ('combined', 'separate')),
  monthly_fee         numeric(10,2),
  commission_rate     numeric(5,4) default 0.09,
  doc_type            integer not null default 320 check (doc_type in (300, 305, 320, 400)),
  ezcount_client_id   text,
  active              boolean not null default true,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── invoice_line_templates ───────────────────────────────────────────────────
create table invoice_line_templates (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  description text not null,
  amount      numeric(10,2) not null,
  quantity    integer not null default 1,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_line_templates_client on invoice_line_templates(client_id);

-- ─── invoice_drafts ───────────────────────────────────────────────────────────
create table invoice_drafts (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id) on delete restrict,
  status               text not null default 'pending_review'
                         check (status in (
                           'pending_review','approved','sent','failed',
                           'skipped','invoiced_pending_combined','invoiced_email_failed'
                         )),
  billing_month        date not null,
  line_items           jsonb not null default '[]',
  subtotal             numeric(10,2) not null default 0,
  vat                  numeric(10,2) not null default 0,
  total                numeric(10,2) not null default 0,
  doc_type             integer not null check (doc_type in (300, 305, 320, 400)),
  ezcount_doc_number   text,
  ezcount_doc_url      text,
  approved_at          timestamptz,
  sent_at              timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_drafts_client on invoice_drafts(client_id);
create index idx_drafts_status on invoice_drafts(status);
create index idx_drafts_billing_month on invoice_drafts(billing_month);
-- ensure one draft per client per billing month (non-skipped)
create unique index idx_drafts_unique_active on invoice_drafts(client_id, billing_month)
  where status not in ('skipped', 'sent');

-- ─── invoices_sent ────────────────────────────────────────────────────────────
create table invoices_sent (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete restrict,
  draft_id      uuid references invoice_drafts(id) on delete set null,
  billing_month date not null,
  doc_type      integer not null check (doc_type in (300, 305, 320, 400)),
  doc_number    text not null,
  doc_url       text,
  subtotal      numeric(10,2) not null,
  vat           numeric(10,2) not null,
  total         numeric(10,2) not null,
  sent_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index idx_invoices_sent_client on invoices_sent(client_id);
create index idx_invoices_sent_month on invoices_sent(billing_month);

-- ─── email_log ────────────────────────────────────────────────────────────────
create table email_log (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete set null,
  draft_id      uuid references invoice_drafts(id) on delete set null,
  email_type    text not null check (email_type in ('monthly_report','invoice','combined','media_invoices','manual')),
  to_email      text not null,
  subject       text not null,
  status        text not null check (status in ('sent','failed')),
  error_message text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_email_log_client on email_log(client_id);
create index idx_email_log_draft on email_log(draft_id);

-- ─── ads_invoices ─────────────────────────────────────────────────────────────
create table ads_invoices (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete restrict,
  billing_month     date not null,
  platform          text not null check (platform in ('google_ads','facebook_ads')),
  spend_amount      numeric(10,2) not null,
  commission_rate   numeric(5,4) not null,
  commission_amount numeric(10,2) not null,
  vat               numeric(10,2) not null,
  total             numeric(10,2) not null,
  doc_number        text,
  status            text not null default 'pending' check (status in ('pending','invoiced')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_ads_invoices_client on ads_invoices(client_id);
create index idx_ads_invoices_month on ads_invoices(billing_month);

-- ─── app_settings ─────────────────────────────────────────────────────────────
create table app_settings (
  id                    integer primary key default 1 check (id = 1),
  ezcount_api_key       text not null default '',
  ezcount_api_email     text not null default '',
  gmail_refresh_token   text,
  vat_rate              numeric(5,4) not null default 0.18,
  report_send_day       integer not null default 1 check (report_send_day between 1 and 28),
  invoice_generate_day  integer not null default 1 check (invoice_generate_day between 1 and 28),
  cron_secret           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Insert default row
insert into app_settings (id) values (1);

-- ─── updated_at triggers ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

create trigger trg_drafts_updated_at
  before update on invoice_drafts
  for each row execute function set_updated_at();

create trigger trg_ads_invoices_updated_at
  before update on ads_invoices
  for each row execute function set_updated_at();

create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table clients               enable row level security;
alter table invoice_line_templates enable row level security;
alter table invoice_drafts        enable row level security;
alter table invoices_sent         enable row level security;
alter table email_log             enable row level security;
alter table ads_invoices          enable row level security;
alter table app_settings          enable row level security;

-- Single-user app: authenticated user can do everything
create policy "authenticated full access" on clients
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on invoice_line_templates
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on invoice_drafts
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on invoices_sent
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on email_log
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ads_invoices
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on app_settings
  for all to authenticated using (true) with check (true);
