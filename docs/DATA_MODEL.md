# Data model

Cloudflare D1 (SQLite). Created idempotently by `src/worker/schema.ts` on the first API request;
demo data is inserted once by `src/worker/seed.ts`. Every business table has:

- `id TEXT PRIMARY KEY` — UUID generated server-side
- `org_id TEXT NOT NULL` — tenant boundary, always derived from the session
- `created_at`, `updated_at TEXT` — ISO timestamps written by the server
- `deleted_at TEXT NULL` — soft delete (records move to `/trash` and are excluded from lists)

Money is stored in integer minor units where a value is financial (`value`, `amount`, `total`);
display formatting and currency come from the organisation record.

## Identity and system

| Table | Purpose | Relationships |
| --- | --- | --- |
| `meta` | Schema/migration markers and seed state | — |
| `orgs` | Tenant: name, currency, timezone, branding, invoice identity, tax settings | Root of every other table |
| `users` | Members of the tenant: name, email, role, title, avatar hue, theme, locale, timezone, active flag | `org_id` → `orgs` |
| `sessions` | Hashed session token, user, expiry, user agent | `user_id` → `users` |
| `invitations` | Pending user invitations: email, role, token, status | `org_id`, inviter |
| `integrations` | Provider registry per tenant: category, status, mode (live/sandbox), account label, last sync | `org_id` |
| `activities` | Append-only business timeline: type, subject, body, entity reference, actor | Polymorphic `entity_type`/`entity_id` |
| `audit_logs` | Append-only mutation audit: actor, action, entity, entity id, summary, IP/user agent | `org_id`, `user_id` |
| `notifications` | In-app alerts: recipient, type, title, body, entity link, read state | `user_id`, polymorphic link |
| `files` | Uploaded documents: name, mime, size, storage key, content, owner | `org_id` |
| `reports` | Saved report definitions: source, filters, visibility, owner | `user_id` |
| `ai_messages` | Assistant conversation history per user | `user_id` |

## CRM

| Table | Purpose | Relationships |
| --- | --- | --- |
| `companies` | Organisations you sell to: name, domain, industry, size, owner, address, status | `owner_id` → `users` |
| `contacts` | People: name, email, phone, title, company, owner, lifecycle status, score, consent flags (`email_opt_out`, `whatsapp_opt_out`, `sms_opt_out`), source | `company_id` → `companies` |
| `leads` | Unqualified prospects: name, email, phone, company name, source, status, priority, score, owner, `converted_contact_id`, `converted_deal_id` | Conversion links to `contacts`/`deals` |
| `lists` | Static or dynamic audience segments | `org_id` |
| `list_members` | Membership join: list, entity type (`contact`/`lead`), entity id | `list_id`, polymorphic member |
| `pipelines` | Sales pipeline definitions | `org_id` |
| `stages` | Ordered stages with probability and type (open/won/lost) | `pipeline_id` → `pipelines` |
| `deals` | Opportunities: name, company, contact, owner, pipeline, stage, value, currency, probability, expected close, status, lost reason | `company_id`, `contact_id`, `stage_id`, `owner_id` |

## Sales operations

| Table | Purpose | Relationships |
| --- | --- | --- |
| `tasks` | Work items: title, notes, due date, priority, status, assignee, related entity | `owner_id`, polymorphic `related_type`/`related_id` |
| `events` | Calendar entries: title, start/end, location, attendees, related entity | `owner_id` |
| `calls` | Call log: direction, number, contact, duration, status, outcome, notes, provider reference | `contact_id`, `owner_id` |
| `products` | Catalogue: SKU, name, description, unit price, tax rate, billing period, status | `org_id` |
| `documents` | Proposals, quotes and invoices: type, number, customer, deal, issue/valid dates, line items (JSON), subtotal, tax, total, currency, status | `company_id`, `contact_id`, `deal_id` |
| `payments` | Payments recorded against invoices: amount, method, reference, status, paid at | `document_id` → `documents` |

## Marketing and outreach

| Table | Purpose | Relationships |
| --- | --- | --- |
| `forms` | Form definitions: name, slug, fields (JSON), mapping (`lead`/`contact`), redirect, status, submission count | Public route `/f/:slug` |
| `form_submissions` | Stored submissions: form, payload (JSON), created entity reference, IP/user agent | `form_id` → `forms` |
| `landing_pages` | Public pages: title, slug, blocks (JSON), SEO fields, status, views | Public route `/p/:slug` |
| `email_templates` | Reusable email copy: name, subject, body, category, status | `org_id` |
| `campaigns` | Broadcast campaigns: name, channel, type, template, list, subject, body, schedule, status, audience/sent/delivered/opened/clicked/bounced counters | `list_id`, `template_id` |
| `sequences` | Multi-step journeys: name, description, status, exit-on-reply, enrolled/completed counters | `org_id` |
| `sequence_steps` | Ordered steps: day offset, channel, subject, body | `sequence_id` → `sequences` |
| `sequence_enrolments` | Contact enrolment: sequence, contact, current step, next run at, status, exit reason | `sequence_id`, `contact_id` |
| `content_items` | Content hub: title, type (blog/FAQ/page), slug, body, status, publish date | `org_id` |
| `social_posts` | Social queue: channel, body, media, scheduled/published time, status, provider reference | `org_id` |
| `web_events` | Tracker events: visitor id, session id, path, referrer, source, event type, contact id, occurred at | `contact_id` (after identification) |

## Automation

| Table | Purpose | Relationships |
| --- | --- | --- |
| `workflows` | Automation graph: name, module, status, version, trigger type, nodes (JSON), owner, counters | `owner_id` |
| `workflow_runs` | Executions: workflow, version, trigger, entity reference, status, current node, idempotency key, log (JSON), timestamps, attempt count | `workflow_id` → `workflows` |

## Support

| Table | Purpose | Relationships |
| --- | --- | --- |
| `tickets` | Requests: subject, description, requester (contact), assignee, status, priority, channel, category, SLA policy, first-response and resolution due/at timestamps, breach flags | `contact_id`, `assignee_id`, `sla_policy_id` |
| `ticket_messages` | Thread messages: body, author (user or customer), internal flag, created at | `ticket_id` → `tickets` |
| `kb_articles` | Knowledge base: title, slug, category, body, status, views | `org_id` |
| `sla_policies` | First-response and resolution targets, business hours, status | `org_id` |

## Indexes and integrity

Indexes exist on every tenant-scoped list query: `(org_id, created_at)`, `(org_id, status)`,
foreign-key-style columns used in joins (`company_id`, `contact_id`, `stage_id`, `deal_id`,
`ticket_id`, `workflow_id`, `list_id`, `form_id`, `sequence_id`), `web_events(org_id, occurred_at)`
and the unique idempotency key on `workflow_runs`.

D1 does not enforce foreign keys by default; referential integrity is enforced in the API layer
(a delete is refused or unlinked explicitly, and soft delete keeps history intact).

## Derived metrics

Dashboards and reports are SQL aggregates, never stored counters that can drift:

- open pipeline value — sum of deal value for open stages, grouped by stage
- weighted forecast — value × stage probability
- win rate — won deals ÷ closed deals in the period
- campaign delivery — campaign counters written by the send adapter, reconciled to sends
- first-response and resolution compliance — ticket timestamps against the SLA policy
- marketing funnel — leads by source, form submissions, campaign events, web sessions
