// Single source of truth for the D1 schema. Applied idempotently on the first
// request an isolate handles (see db.ts). Every business table carries org_id;
// tenant scoping is enforced in queries, never trusted from the client.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  currencies TEXT NOT NULL DEFAULT 'USD,EUR,GBP,INR,AED',
  timezone TEXT NOT NULL DEFAULT 'Asia/Calcutta',
  locale TEXT NOT NULL DEFAULT 'en',
  website TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  tax_id TEXT,
  logo_url TEXT,
  letterhead TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT,
  phone TEXT,
  avatar_hue INTEGER NOT NULL DEFAULT 24,
  status TEXT NOT NULL DEFAULT 'active',
  theme TEXT NOT NULL DEFAULT 'light',
  locale TEXT NOT NULL DEFAULT 'en',
  timezone TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size TEXT,
  rating REAL DEFAULT 0,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  owner_id TEXT,
  description TEXT,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS companies_org_idx ON companies(org_id, deleted_at);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  designation TEXT,
  company_id TEXT,
  email TEXT,
  email_opt_out INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  tags TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  linkedin TEXT,
  twitter TEXT,
  owner_id TEXT,
  source TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  from_lead_id TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts(org_id, deleted_at);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  lead_type TEXT NOT NULL DEFAULT 'person',
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  job_title TEXT,
  source TEXT NOT NULL DEFAULT 'Manual',
  status TEXT NOT NULL DEFAULT 'new',
  owner_id TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  address TEXT,
  website TEXT,
  description TEXT,
  tags TEXT,
  birthday TEXT,
  value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  industry TEXT,
  opt_out INTEGER NOT NULL DEFAULT 0,
  converted_contact_id TEXT,
  converted_deal_id TEXT,
  converted_company_id TEXT,
  converted_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_org_idx ON leads(org_id, deleted_at);

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'static',
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  owner_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS list_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'contact',
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS list_members_uniq ON list_members(list_id, entity_id);

CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  probability INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_id TEXT,
  company_id TEXT,
  pipeline_id TEXT,
  stage_id TEXT,
  value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  probability INTEGER NOT NULL DEFAULT 10,
  expected_close TEXT,
  owner_id TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deals_org_idx ON deals(org_id, deleted_at);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'task',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  owner_id TEXT,
  assignee_id TEXT,
  due_date TEXT,
  recurrence TEXT,
  related_type TEXT,
  related_id TEXT,
  completed_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_org_idx ON tasks(org_id, deleted_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  all_day INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  meeting_url TEXT,
  type TEXT NOT NULL DEFAULT 'meeting',
  owner_id TEXT,
  attendees TEXT,
  related_type TEXT,
  related_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_org_idx ON events(org_id, start_at);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  number TEXT NOT NULL,
  contact_id TEXT,
  owner_id TEXT,
  started_at TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'logged',
  outcome TEXT,
  notes TEXT,
  provider TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sla_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  first_response_mins INTEGER NOT NULL DEFAULT 60,
  resolution_mins INTEGER NOT NULL DEFAULT 480,
  business_hours TEXT NOT NULL DEFAULT 'Mon-Fri 09:00-18:00',
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  contact_id TEXT,
  company_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  category TEXT NOT NULL DEFAULT 'General',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  assignee_id TEXT,
  sla_policy_id TEXT,
  first_response_due TEXT,
  resolution_due TEXT,
  first_response_at TEXT,
  resolved_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_org_idx ON tickets(org_id, deleted_at);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  author_type TEXT NOT NULL DEFAULT 'agent',
  author_id TEXT,
  body TEXT NOT NULL,
  internal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kb_articles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  views INTEGER NOT NULL DEFAULT 0,
  author_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  subject TEXT,
  preview_text TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  owner_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  type TEXT NOT NULL DEFAULT 'broadcast',
  category TEXT NOT NULL DEFAULT 'General',
  sender TEXT,
  list_id TEXT,
  template_id TEXT,
  subject TEXT,
  content TEXT,
  scheduled_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'draft',
  audience_count INTEGER NOT NULL DEFAULT 0,
  suppressed_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  clicked INTEGER NOT NULL DEFAULT 0,
  bounced INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  sent_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  exit_on_reply INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  body TEXT,
  delay_days INTEGER NOT NULL DEFAULT 0,
  template_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequence_enrolments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  fields TEXT NOT NULL DEFAULT '[]',
  success_message TEXT,
  mapping TEXT NOT NULL DEFAULT 'lead',
  consent_text TEXT,
  submission_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS forms_slug_org_idx ON forms(org_id, slug) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  data TEXT NOT NULL,
  contact_id TEXT,
  lead_id TEXT,
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS landing_pages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  template TEXT NOT NULL DEFAULT 'lead-magnet',
  blocks TEXT NOT NULL DEFAULT '[]',
  form_id TEXT,
  seo_title TEXT,
  seo_description TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_org_idx ON landing_pages(org_id, slug) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'blog',
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT,
  excerpt TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  author_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT 'All files',
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'local',
  data TEXT,
  related_type TEXT,
  related_id TEXT,
  owner_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  type TEXT NOT NULL DEFAULT 'service',
  description TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'quote',
  number TEXT NOT NULL,
  title TEXT,
  contact_id TEXT,
  company_id TEXT,
  deal_id TEXT,
  issue_date TEXT,
  due_date TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  discount REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  lines TEXT NOT NULL DEFAULT '[]',
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  terms TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'marketing',
  status TEXT NOT NULL DEFAULT 'draft',
  trigger_type TEXT NOT NULL,
  trigger_config TEXT NOT NULL DEFAULT '{}',
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  owner_id TEXT,
  description TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  trigger_event TEXT,
  entity_type TEXT,
  entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  current_node TEXT,
  log TEXT NOT NULL DEFAULT '[]',
  resume_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS wf_runs_idem_idx ON workflow_runs(idempotency_key);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_connected',
  mode TEXT NOT NULL DEFAULT 'live',
  account TEXT,
  scopes TEXT,
  note TEXT,
  last_sync TEXT,
  config TEXT,
  created_at TEXT NOT NULL
);

-- OAuth tokens live server-side only, never sent to the client.
CREATE TABLE IF NOT EXISTS integration_tokens (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT,
  scope TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_tokens_org_provider ON integration_tokens (org_id, provider);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_org_idx ON activities(org_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(org_id, user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  metrics TEXT,
  filters TEXT,
  visibility TEXT NOT NULL DEFAULT 'team',
  owner_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS web_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  visitor_id TEXT,
  event TEXT NOT NULL,
  url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  contact_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'linkedin',
  content TEXT,
  media TEXT,
  account TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  provider_id TEXT,
  error TEXT,
  author_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  sources TEXT,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------- Gmail
-- Synchronised mailbox messages. Provider ids are unique per tenant+provider so a re-sync
-- never duplicates a message. Bodies are stored server-side and the raw MIME is not persisted.
CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  account TEXT,
  provider_message_id TEXT NOT NULL,
  thread_id TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  folder TEXT NOT NULL DEFAULT 'inbox',
  from_email TEXT,
  from_name TEXT,
  to_emails TEXT,
  cc_emails TEXT,
  bcc_emails TEXT,
  subject TEXT,
  snippet TEXT,
  body_html TEXT,
  body_text TEXT,
  attachments TEXT,
  labels TEXT,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  unread INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0,
  rfc_message_id TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_provider_idx ON email_messages(org_id, provider, provider_message_id);
CREATE INDEX IF NOT EXISTS email_messages_list_idx ON email_messages(org_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_thread_idx ON email_messages(org_id, thread_id);

-- Checkpoint for Gmail history-based incremental sync.
CREATE TABLE IF NOT EXISTS email_sync_state (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'gmail',
  account TEXT,
  history_id TEXT,
  cursor TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  last_sync TEXT,
  last_error TEXT,
  messages_synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- User-level multi-account email integrations (Gmail, Microsoft Outlook, IMAP/SMTP).
CREATE TABLE IF NOT EXISTS email_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_email TEXT NOT NULL,
  display_name TEXT,
  connection_status TEXT NOT NULL DEFAULT 'connected',
  access_token TEXT,
  refresh_token TEXT,
  encrypted_refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  expires_at TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  imap_host TEXT,
  imap_port INTEGER,
  imap_security TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_security TEXT,
  smtp_username TEXT,
  smtp_password TEXT,
  last_sync TEXT,
  last_error TEXT,
  messages_synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_accounts_org_user ON email_accounts (org_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_user_provider_email ON email_accounts (org_id, user_id, provider, account_email);
`;
