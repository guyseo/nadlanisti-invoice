-- Change additional_emails from plain text to structured jsonb
-- Each entry: { "email": "...", "type": "invoices" | "reports" | "both" }
alter table clients drop column if exists additional_emails;
alter table clients add column additional_emails jsonb not null default '[]';
