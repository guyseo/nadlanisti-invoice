-- Add additional CC email addresses per client
alter table clients
  add column if not exists additional_emails text not null default '';
