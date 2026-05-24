-- Add per-client email routing columns
alter table clients
  add column if not exists invoice_email         text,
  add column if not exists report_email          text,
  add column if not exists invoice_email_subject text,
  add column if not exists invoice_email_body    text,
  add column if not exists ezcount_customer_name text,
  add column if not exists automation_active     boolean not null default true;

-- Add global email template columns to app_settings
alter table app_settings
  add column if not exists invoice_email_subject text,
  add column if not exists invoice_email_body    text;
