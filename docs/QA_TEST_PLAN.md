# QA test plan and results

## How this was verified

1. `bun run typecheck` — TypeScript across client, worker and config.
2. `bun run build` — production client bundle + Worker bundle.
3. A scripted HTTP pass against the running Worker (`curl`, cookie jar, preview hostname) covering
   the checks below.
4. Browser inspection of the running SPA: sign-in, home dashboard, deals board, and the rendered
   heading of the marketing dashboard, forms, campaigns, workflows, web analytics, sales dashboard,
   support dashboard, reports and connected-apps screens.

Everything below was executed against the local D1 database; nothing was mocked at the HTTP layer.

## Authentication and session

| # | Check | Result |
| --- | --- | --- |
| A1 | Valid credentials return the user, role and tenant | Pass (`owner@gofox.dev`, role `owner`) |
| A2 | Wrong password is rejected with a generic message | Pass (`UNAUTHENTICATED`) |
| A3 | Unauthenticated API call is refused | Pass (`UNAUTHENTICATED`) |
| A4 | Session cookie is `HttpOnly`, `SameSite=Lax` | Pass (observed in response headers) |
| A5 | Sign-out deletes the session | Pass (manual check on logout endpoint) |

## Tenancy and permissions

| # | Check | Result |
| --- | --- | --- |
| B1 | Sales role cannot export customer data | Pass (`PERMISSION_DENIED`) |
| B2 | Support role cannot change organisation settings | Pass (`PERMISSION_DENIED`) |
| B3 | Tenant id is taken from the session, not the body | Pass (writes stamped with session tenant) |
| B4 | Cross-tenant id lookup returns not-found | Covered by tenant-scoped queries (`org_id` in every predicate) |

## CRM

| # | Check | Result |
| --- | --- | --- |
| C1 | Companies list paginates and reports a total | Pass (12 seeded rows) |
| C2 | Create company persists and returns the record | Pass |
| C3 | Duplicate company name is rejected case-insensitively | Pass (`CONFLICT`) |
| C4 | Update persists and writes activity/audit | Pass |
| C5 | Duplicate contact email returns a warning, not a silent duplicate | Pass (`warning` returned) |
| C6 | Lead conversion creates contact + deal and links both | Pass (new lead → contact, deal "Converted smoke deal") |
| C7 | Repeating a conversion is idempotent | Pass (`alreadyConverted`, same ids) |
| C8 | Deal stage move updates stage/probability and notifies owner | Pass |

## Marketing and automation

| # | Check | Result |
| --- | --- | --- |
| D1 | Marketing dashboard aggregates leads, sends, opens, clicks | Pass (SQL aggregates: 11 new leads, 1 788 delivered, 813 opened) |
| D2 | Campaign send resolves an audience and respects suppression | Pass (`audience: 12, suppressed: 0`) |
| D3 | Campaign send records delivery and moves status to sent | Pass |
| D4 | Workflow dry-run executes real condition logic without sending | Pass (node-by-node preview, `dryRun: true`) |
| D5 | Scheduler tick resumes waits/sends/sequences idempotently | Pass (`resumed: 0, campaigns: 0, sequences: 0` when nothing due) |
| D6 | Public form renders for an unpublished/published slug correctly | Pass (form definition returned) |
| D7 | Public form submission creates a record and returns a confirmation | Pass |
| D8 | Web analytics aggregate events by day/page/source | Pass (220 events, 5 pages, 30-day window) |
| D9 | Reports return aggregate rows for a domain | Pass (deal report rows) |

## Support

| # | Check | Result |
| --- | --- | --- |
| E1 | Support dashboard reports open/resolved/breached counts | Pass (16 total, 9 open, 7 breached) |
| E2 | Ticket reply is stored and returned in the thread | Pass |
| E3 | Internal notes are excluded from customer-visible output | Implemented in the thread endpoint (`internal` flag) |
| E4 | Telephony without a provider reports not-connected and never claims a call | Implemented (`/api/telephony/dial` guard) |

## Shell and navigation

| # | Check | Result |
| --- | --- | --- |
| F1 | All sidebar links resolve to a registered route | Pass (nav inventory compared against the router table) |
| F2 | Unknown route shows the in-app 404 with a way back | Pass |
| F3 | Global search groups results by type and respects tenancy | Pass (`companies, contacts, deals, tasks` groups) |
| F4 | Theme toggle applies a dark token set | Implemented; dark tokens verified in CSS, not screenshot-reviewed |
| F5 | Notifications expose unread count and mark-read | Pass (unread 6) |

## Integration and automation checks (latest pass)

| # | Check | Result |
| --- | --- | --- |
| G1 | `GET /api/integrations/gmail/connect` without server credentials redirects to `/settings/apps?connect=gmail&connect_error=not_configured&vars=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET` | Pass |
| G2 | Callback with a forged `state` redirects with `connect_error=state` and no session is created | Pass |
| G3 | A provider with no OAuth client (telephony) redirects with `connect_error=no_oauth` | Pass |
| G4 | Connect route without a session is refused | Pass (401) |
| G5 | A workflow using Add to list + Create ticket + Add to sequence publishes and executes on `contact.created` | Pass — run log: “Added to list Newsletter subscribers”, “Ticket created”, “Enrolled in Dormant re-engagement” |
| G6 | Publishing a node whose list/sequence is not chosen is rejected with an actionable message | Pass |
| G7 | Disconnect deletes the stored token row as well as flipping the status | Implemented (not exercised against a live provider) |

## Not covered by this pass

Stated plainly so the gap is not mistaken for success:

- No automated browser suite. Visual review covered the sign-in page, home dashboard, deals board and
  heading-level rendering of the other main screens; every list/table/drawer interaction was not
  clicked through individually.
- No second tenant was created, so cross-tenant isolation is verified by code review of the query
  builder and by tenant-scoped predicates, not by a two-organisation experiment.
- No load, soak or accessibility (WCAG) testing.
- Provider integrations were not tested against real APIs because none is connected; the sandbox
  adapter and the honest connection states are what exist.
- Scheduled background execution in production requires an external trigger (Cron Trigger or
  scheduled fetch) to call `/api/scheduler/tick`; the endpoint is implemented and tested by hand.

## Regression checklist before shipping a change

1. `bun run typecheck` and `bun run build`.
2. Sign in as owner; create, edit and delete a contact; confirm trash and restore.
3. Convert a lead; confirm one contact and one deal, and that a repeat call does not duplicate.
4. Move a deal stage; confirm dashboard and forecast change.
5. Send a campaign; confirm status, counters and audience suppression.
6. Publish a workflow, trigger it, inspect the run, and replay it; confirm no duplicate task.
7. Submit the public form as an anonymous visitor; confirm the lead, the activity and the attribution.
8. Sign in as sales and as support; confirm export and settings are denied server-side.
