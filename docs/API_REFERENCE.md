# API reference

All application endpoints are served by the Cloudflare Worker (`src/worker/index.ts`) under `/api`.
The SPA is served from the same origin, so the session cookie is sent automatically.

## Conventions

- **Auth**: `gofox_session` httpOnly cookie. Missing/expired session → `401 UNAUTHENTICATED`.
- **Tenant**: derived from the session. `org_id` in a request body is ignored.
- **Content type**: `application/json` for requests and responses (except CSV and file downloads).
- **Mutations**: `POST`/`PATCH`/`DELETE` require a same-origin `Origin`/`Referer`, otherwise
  `403 CROSS_ORIGIN_BLOCKED`.
- **Errors**: `{ "error": { "code": "CONFLICT", "message": "A record with that company name already exists." } }`
  with codes such as `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `PERMISSION_DENIED`,
  `UNAUTHENTICATED`, `RATE_LIMITED`, `DATABASE_UNAVAILABLE`.
- **Lists**: `GET /api/resources/:entity?q=&status=&owner_id=&sort=&dir=&page=&limit=`
  returns `{ data: Row[], total, page, limit }`. `deleted=1` switches to trashed rows.
- **Timestamps** are ISO-8601 UTC; timezone-sensitive display uses the organisation/user setting.

## Session and context

| Method | Path | Permission | Behaviour |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | public | Verifies password, creates session, sets cookie |
| POST | `/api/auth/logout` | session | Deletes the session and clears the cookie |
| GET | `/api/auth/me` | session | Current user, role, tenant, permissions, theme |
| PATCH | `/api/auth/profile` | session | Name, title, timezone, locale, theme, avatar hue |
| POST | `/api/auth/password` | session | Current password + new password (min 8), revokes other sessions |
| GET | `/api/meta` | session | Option lists (users, companies, stages, lists, templates, …) for the UI |
| GET | `/api/schema` | session | Entity registry used by the client to render lists/forms |
| GET | `/api/search?q=` | session | Grouped search across companies, contacts, leads, deals, tasks, tickets |
| GET | `/api/health` | public | Liveness probe |

## Generic resources

`/api/resources/:entity` — whitelisted entities only:
`companies, contacts, leads, lists, deals, tasks, events, calls, tickets, kb_articles, sla_policies,
campaigns, email_templates, sequences, forms, landing_pages, content_items, products, documents,
workflows, social_posts, reports, files`.

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/api/resources/:entity` | Tenant-scoped list with filters, sort, pagination |
| GET | `/api/resources/:entity/:id` | Single record plus its activity feed |
| POST | `/api/resources/:entity` | Validated create, uniqueness check, activity + audit; duplicate warnings returned as `warning` |
| PATCH | `/api/resources/:entity/:id` | Validated partial update, activity + audit |
| DELETE | `/api/resources/:entity/:id` | Soft delete (moves to trash), audit |
| POST | `/api/resources/:entity/:id/restore` | Restore from trash (`data.delete`) |

## CRM actions

| Method | Path | Behaviour |
| --- | --- | --- |
| POST | `/api/leads/:id/convert` | Creates/links contact and optional deal, marks lead converted; repeat calls return `alreadyConverted` with the existing ids |
| POST | `/api/lists/:id/members` | Add a contact or lead to a list (idempotent) |
| GET | `/api/lists/:id/members` | Members with display labels |
| DELETE | `/api/lists/:id/members/:membershipId` | Remove membership |

## Sales

| Method | Path | Behaviour |
| --- | --- | --- |
| POST | `/api/deals/:id/stage` | Moves a deal to another stage in the same pipeline, updates probability, records activity, notifies the owner, applies won/lost status |
| GET | `/api/export/:entity` | CSV export (`data.export`) with tenant scope |

## Marketing and automation

| Method | Path | Behaviour |
| --- | --- | --- |
| POST | `/api/campaigns/:id/send` | Resolves the audience (consent-aware), sends through the Sandbox Mail adapter, writes delivery rows and counters |
| POST | `/api/campaigns/:id/schedule` | Stores the scheduled time and marks the campaign scheduled |
| POST | `/api/campaigns/:id/status` | Pause/resume/cancel transitions |
| POST | `/api/templates/:id/test` | Renders a test send through the adapter (labelled sandbox) |
| POST | `/api/forms/:id/publish` | Publishes/unpublishes a form after validating fields |
| POST | `/api/pages/:id/publish` | Publishes/unpublishes a landing page after validating blocks and slug |
| GET | `/api/sequences/:id` | Sequence with steps and enrolment counts |
| POST | `/api/sequences/:id/steps` | Add/replace steps |
| POST | `/api/sequences/:id/enrol` | Enrols contacts, skipping opted-out and enrolled ones |
| GET | `/api/analytics/web?days=` | Sessions, page views, top pages, sources, conversions, daily series |
| GET | `/api/tracker/snippet` | Copy-ready snippet containing the tenant tracker key |
| GET | `/api/workflows/:id` | Workflow graph, validation state and recent runs |
| POST | `/api/workflows/:id/publish` | Server-side graph validation, then publish (immutable version) |
| POST | `/api/workflows/:id/status` | Activate/pause; paused workflows ignore new triggers |
| POST | `/api/workflows/:id/test` | Dry-run against a sample record — never sends, charges or calls |
| GET | `/api/workflow-runs` | Run history with node logs and errors |
| POST | `/api/workflows/:id/runs/:runId/replay` | Idempotent manual replay |
| POST | `/api/scheduler/tick` | Resumes waits, sends due campaigns, advances sequences (idempotent) |

## Support

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/api/tickets/:id/messages` | Thread, hiding internal notes from customer-visible contexts |
| POST | `/api/tickets/:id/messages` | Adds a reply or internal note, updates first-response/resolution timestamps, notifies |
| POST | `/api/telephony/dial` | Validates/normalises a number and reports `not_connected` when no telephony provider exists |
| POST | `/api/inbox/send` | Blocked with a provider-connection error when no mailbox is connected |

## Dashboards and reports

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/api/dashboards/:name` | `home`, `marketing`, `sales`, `support` — SQL aggregates over the tenant |
| GET | `/api/reports/:domain` | Report table for `deals`, `leads`, `contacts`, `campaigns`, `tickets`, `activities` |
| GET | `/api/activities` | Marketing/sales/support activity timeline |
| GET | `/api/audit` | Audit log (`audit.read`) |
| GET | `/api/trash` | Soft-deleted records by entity |
| GET | `/api/notifications` | Notifications plus unread count |
| POST | `/api/notifications/read` | Mark one or all read |

## Administration

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/api/org` | Tenant settings |
| PATCH | `/api/org` | Update tenant settings (`settings.write`) |
| GET | `/api/users` | Members with roles and status |
| POST | `/api/users/invite` | Create an invitation (`users.write`); no email is sent without a provider |
| PATCH | `/api/users/:id` | Change role or deactivate (`users.write`) |
| POST | `/api/invitations/:id/revoke` | Revoke a pending invitation |
| POST | `/api/integrations/:provider` | Connect in sandbox / disconnect a provider, with an audit entry |
| POST | `/api/files/upload` | Multipart upload into the tenant file store |
| GET | `/api/files/:id/download` | Authenticated download scoped to the tenant |
| POST | `/api/ai/chat` | Deterministic assistant over real tenant queries; states when no model provider is connected |
| GET | `/api/ai/messages` | Assistant history for the current user |

## Public endpoints (no session)

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/api/public/forms/:slug` | Published form definition and its fields |
| POST | `/api/public/forms/:slug/submit` | Validates required fields and consent, stores the submission, creates or matches a lead/contact, records attribution |
| GET | `/api/public/pages/:slug` | Published landing page blocks |
| POST | `/api/public/track` | Records a page view/event against a visitor and optional contact id |
| GET | `/tracker.js` | Tracking script that posts to `/api/public/track` |

Public endpoints return only published content and never expose CRM records; slugs are unique per tenant.
