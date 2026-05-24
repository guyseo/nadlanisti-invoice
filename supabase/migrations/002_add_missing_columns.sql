-- Add columns missing from initial migration

-- clients: email fields, EZCount customer name, automation toggle
alter table clients
  add column if not exists invoice_email          text,
  add column if not exists report_email           text,
  add column if not exists invoice_email_subject  text,
  add column if not exists invoice_email_body     text,
  add column if not exists ezcount_customer_name  text,
  add column if not exists automation_active      boolean not null default false;

-- app_settings: global email template fields
alter table app_settings
  add column if not exists invoice_email_subject  text,
  add column if not exists invoice_email_body     text;
