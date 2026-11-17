# Requirements traceability

The specification defines 36 modules (MOD-001 … MOD-036), 12 cross-module journeys (JRN-001 … JRN-012),
functional requirements FR-001 … FR-190, plus sections on the workflow engine, data architecture,
API/event architecture, integrations, security, non-functional requirements and QA gates.

Traceability is maintained at **module + journey** granularity: FR-level statements are grouped under
the module that owns them, and each row names the route, the server code and the verification used.
A dash means the requirement is not met and is documented as a limitation in
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

## Modules

| Spec | Route(s) | Server implementation | Verified by |
| --- | --- | --- | --- |
| MOD-001 shell, nav, search, quick create, dial pad, AI panel | shell in every workspace route | `src/worker/index.ts` (`/api/meta`, `/api/search`, `/api/notifications`, `/api/telephony/dial`, `/api/ai/chat`) | Nav inventory vs router table; search API check; dial-pad guard |
| MOD-002 home dashboard | `/` | `dashboards.ts` `homeDashboard`, `/api/dashboards/home` | API aggregate check + browser review |
| MOD-003 AI assistant | assistant panel | `/api/ai/chat`, `/api/ai/messages` | Rules over tenant queries; refuses without provider |
| MOD-004 companies | `/companies`, `/companies/:id` | `entities.ts` registry + generic CRUD | Create/duplicate/update checks |
| MOD-005 leads | `/leads`, `/leads/:id` | `/api/leads/:id/convert` | Conversion + idempotent repeat |
| MOD-006 contacts | `/contacts`, `/contacts/:id` | generic CRUD + duplicate-email warning | Duplicate-email warning check |
| MOD-007 lists | `/lists`, `/lists/:id` | `/api/lists/:id/members` | Membership endpoints |
| MOD-008 marketing dashboard | `/marketing` | `marketingDashboard` | Aggregate check (leads, delivered, opened) |
| MOD-009 forms | `/marketing/forms`, builder | `/api/forms/:id/publish`, `/api/public/forms/:slug[/submit]` | Public render + submit check |
| MOD-010 landing pages | `/marketing/landing-pages`, editor | `/api/pages/:id/publish`, `/api/public/pages/:slug` | Publish + public render |
| MOD-011 email templates | `/marketing/emails` | resource CRUD + `/api/templates/:id/test` | Sandbox test send |
| MOD-012 campaigns | `/marketing/campaigns`, wizard, detail | `/api/campaigns/:id/send|schedule|status`, `automation.ts` `sendCampaign` | Send check (`audience: 12`) |
| MOD-013 sequences | `/marketing/sequences`, detail | `/api/sequences/:id[/steps|/enrol]`, `advanceEnrolment` | Tick check |
| MOD-014 WhatsApp | `/marketing/whatsapp` | send blocked without provider | Connection state shown |
| MOD-015 social posts | `/marketing/social` | `social_posts` CRUD, publish blocked | Connection state shown |
| MOD-016 ads | `/marketing/ads` | integration state only | Connection state shown |
| MOD-017 content hub | `/marketing/content` | `content_items` CRUD | Schema + list render |
| MOD-018 workflow builder | `/marketing/workflows`, canvas | `automation.ts` (`fireTrigger`, `executeRun`, `tick`), `/api/workflows/:id/*` | Dry-run, publish validation, runs, replay, tick |
| MOD-019 web analytics | `/marketing/analytics` | `/tracker.js`, `/api/public/track`, `/api/analytics/web` | 220 events aggregated |
| MOD-020 marketing activities | `/marketing/activities` | `/api/activities` | Feed render |
| MOD-021 files | `/files` | `/api/files/upload`, `/api/files/:id/download` | Tenant-scoped download route |
| MOD-022 sales dashboard | `/sales` | `salesDashboard` | Aggregate check + browser review |
| MOD-023 deals | `/sales/deals`, detail | `/api/deals/:id/stage` | Stage move check |
| MOD-024 tasks | `/sales/tasks` | `tasks` CRUD, completion updates activity | CRUD + dashboard reconciliation |
| MOD-025 calendar | `/sales/calendar` | `events` + dated tasks | Render check |
| MOD-026 inbox | `/sales/inbox` | `/api/inbox/send` guarded | Provider-gated |
| MOD-027 proposals/quotes/invoices | `/sales/proposals|quotes|invoices` | `documents`, `payments`; totals server-side | Line-item totals in API |
| MOD-028 products | `/sales/products` | `products` CRUD with SKU uniqueness | Uniqueness validation |
| MOD-029 account/users | `/settings/account` | `/api/users*`, `/api/invitations/:id/revoke` | Role change/deactivation paths |
| MOD-030 profile | `/settings/profile` | `/api/auth/profile`, `/api/org` | Persisted preferences |
| MOD-031 financial settings | `/settings/financial` | `/api/org`, integration states | Gateway states |
| MOD-032 connected apps | `/settings/apps` | `/api/integrations/:provider` | Connect/disconnect + audit |
| MOD-033 support suite | `/support/*` | tickets, messages, SLA, KB, support runs | Thread check, SLA aggregates |
| MOD-034 reports | `/reports` | `/api/reports/:domain`, `/api/export/:entity` | Report rows + export permission denial |
| MOD-035 notifications | bell + `/api/notifications` | notifications on stage change, assignment, tickets, workflow failure | Unread count check |
| MOD-036 telephony | dial pad, `/sales` call metrics | `/api/telephony/dial`, `calls` CRUD | Reports not-connected, never fakes a call |

## Journeys

| Journey | Where it is enforced | Result |
| --- | --- | --- |
| JRN-001 lead → opportunity | `POST /api/leads/:id/convert` (transactional create/update, idempotency) | Pass |
| JRN-002 company and contacts | company detail joins, contact `company_id` | Pass |
| JRN-003 form → CRM | public submit → lead/contact + activity + workflow trigger | Pass |
| JRN-004 campaign send | audience resolution + suppression + adapter + counters | Pass (sandbox) |
| JRN-005 sequence | enrol → tick → advance → exit | Pass |
| JRN-006 workflow | trigger → run record → node log → replay | Pass |
| JRN-007 deal → invoice | deal → document line items → totals → manual payment | Partial (no gateway) |
| JRN-008 support | ticket → SLA fields → thread → resolve | Pass |
| JRN-009 visitor analytics | tracker → event → identification | Pass |
| JRN-010 social publishing | requires provider | Blocked by design |
| JRN-011 mailbox sync | requires provider | Blocked by design |
| JRN-012 task/calendar | task date → calendar, completion → activity | Pass |

## Cross-cutting requirements

| Requirement (spec §5.1, §9, §10) | Implementation | Evidence |
| --- | --- | --- |
| Tenant id from authenticated context only | `org_id` from session in every query; body value ignored | Code review; write stamping |
| Audit on create/update/delete/send/export/settings | `audit_logs` + `activities` written by helpers | `/api/audit` returns entries after mutations |
| Consent and suppression before sends | `email_opt_out`/`whatsapp_opt_out`/`sms_opt_out` filtered in audience resolution | Campaign send reports `suppressed` count |
| UTC storage with timezone context | ISO timestamps, org/user timezone for display | Schema + formatting helpers |
| Soft delete with restore | `deleted_at`, `/api/trash`, restore endpoint | Trash route |
| Server-side financial calculation | Document subtotal/tax/total computed on write | API response totals |
| Dashboard values reconcile to records | Aggregates over the same tables the lists read | API counts match list totals |
| Workflow idempotency and versioning | Idempotency key, immutable published version, replay guard | Dry-run/run records |
| No fabricated integrations or delivery | Connection states + sandbox adapter label | UI states, send records |
| RBAC enforced server-side | `ROLE_PERMS` + `can()` in every privileged route | Sales export and support settings denied |
| Same-origin mutation guard | `sameOrigin()` on POST/PATCH/DELETE | 403 for foreign Origin |

## Gaps against the letter of the specification

- FR-001…FR-190 are not itemised individually; they are covered through the module table above.
- External-delivery FRs (real email/WhatsApp/SMS/social/telephony/payment) are **provider-gated**, not
  implemented, because no credentials exist in this environment.
- Pipeline/stage administration, custom fields, teams, custom roles, approval workflows, PDF generation
  and per-record ACLs are not built; they are listed in the status document.
