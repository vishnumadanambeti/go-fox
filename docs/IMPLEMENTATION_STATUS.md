# Implementation status

Status legend

- **Implemented** — real, persisted, permission-checked behaviour with no provider dependency.
- **Implemented (sandbox)** — works end to end but the external delivery is a local adapter, labelled as such in the UI.
- **Provider-gated** — the screen, data model and validation exist; the action is disabled and explains that no provider is connected.
- **Partial** — works, with the stated limitation called out.

| Module | Status | What exists | Known limitation |
| --- | --- | --- | --- |
| MOD-001 Application shell and global features | Implemented | Collapsible grouped sidebar, top bar, global search across six entities, quick create, notification bell with unread count, theme toggle, locale/timezone, profile menu, AI panel, dial pad; public marketing site for signed-out visitors | Language switch changes preference/locale formatting, not a full translation catalogue |
| MOD-002 Home dashboard | Implemented | Greeting, KPI cards, my tasks, activity, pipeline widget — all SQL aggregates over tenant records | Widget reorder/resize is not exposed in the UI |
| MOD-003 GoFox AI assistant | Implemented | Panel with history; answers questions from real tenant queries, cites the records it used, offers filtered deep links, refuses when a record is outside the tenant | No language-model provider connected, so no free-form drafting; it states this |
| MOD-004 Companies | Implemented | List, search, filters, create/edit drawer, detail with contacts, deals, activity, files | — |
| MOD-005 Leads | Implemented | List, scoring/priority, owner assignment, status changes, conversion to contact + optional deal, idempotent repeats | — |
| MOD-006 Contacts | Implemented | List, company link, consent flags, owner, lifecycle status, detail with timeline and related deals | — |
| MOD-007 Lists | Implemented | Static lists, add/remove contacts and leads, membership counts | Dynamic/rule-based segments are not built |
| MOD-008 Marketing dashboard | Implemented (sandbox) | Leads by source, campaign funnel, forms, pages, web traffic — SQL aggregates | Delivery/open metrics come from the Sandbox Mail adapter |
| MOD-009 Forms | Implemented | Builder with field types and mapping, publish/unpublish, public `/f/:slug` render, validated submit that creates a lead/contact and records attribution | No per-domain embed allowlist or spam protection |
| MOD-010 Landing pages | Implemented | Block editor, SEO fields, publish/unpublish, public `/p/:slug` render, view counting | No custom-domain mapping |
| MOD-011 Emails and templates | Implemented (sandbox) | Template CRUD, preview, test send through the adapter | No drag-and-drop visual email designer |
| MOD-012 Campaigns | Implemented (sandbox) | Wizard, list audience with consent suppression, schedule/send/pause, per-recipient delivery rows, counters | No real SMTP/ESP provider |
| MOD-013 Email sequences | Implemented (sandbox) | Steps with delays, enrolment with duplicate/opt-out skipping, tick-driven advancement, exit flag, reporting | Reply detection needs a connected mailbox |
| MOD-014 WhatsApp inbox | Provider-gated | Conversation surface, consent-aware send guard, connection state | No Meta Cloud API credentials, so nothing is sent or invented |
| MOD-015 Social media posts | Provider-gated | Compose, schedule, queue and status transitions stored locally | Publishing requires a connected social account |
| MOD-016 Social media ads | Provider-gated | Connection state and account surface | No ad account data is fabricated |
| MOD-017 Content hub | Implemented | Content items with type, slug, body, status, publish date, filters | No public blog reader route |
| MOD-018 Workflow and automation builder | Partial | Canvas with pan/zoom/grid/undo, draggable node cards and bezier connectors; catalogue tabs (Triggers / Actions / Conditions) with search, grouped categories and counts; per-node configuration; server-side validation, publish with immutable versioning, dry-run, run log viewer, replay, pause/resume, scheduler. Executable actions: create task, notify, add note, update field, add/remove tag, add to list, add to sequence, create ticket, send email (sandbox), assign owner | Graph is a linear node list, not an arbitrary multi-branch DAG |
| MOD-019 Web analytics | Implemented | `/tracker.js`, anonymous visitor/session events, page view/referrer capture, contact identification, 30-day aggregates by page/source/day | No rate limiting on the public track endpoint |
| MOD-020 Marketing activities | Implemented | Chronological activity log with type filters | — |
| MOD-021 Files repository | Partial | Upload, list, authenticated download, size/type limits, trash | Stored in D1 for demo scale; no folders or R2 backend |
| MOD-022 Sales dashboard | Implemented | Pipeline value, weighted forecast, win rate, stage funnel, task and activity load, call summary | — |
| MOD-023 Deals | Implemented | Kanban board and list view, stage moves with probability and won/lost handling, owner notification, forecast | Pipeline/stage administration is data-level, not a settings screen |
| MOD-024 Tasks | Implemented | Grouped list, due/overdue states, priority, assignee, link to related record, complete/reopen | — |
| MOD-025 Calendar | Implemented | Month grid from events and dated tasks, create event drawer, record links | Drag-to-reschedule is not implemented |
| MOD-026 Inbox (mail) | Provider-gated | Inbox surface and send guard | Needs a connected mailbox; no mail is invented |
| MOD-027 Proposals, quotes and invoices | Implemented | Line items from products, subtotal/tax/total calculated server-side, statuses, manual payment recording | No PDF rendering or e-signature |
| MOD-028 Products | Implemented | Catalogue CRUD with SKU uniqueness, pricing, tax, billing period, status | — |
| MOD-029 Account settings and users | Implemented | Members with roles, invite and revoke, role changes, deactivation, audit visibility; **Google SSO** through Firebase Auth with server-side ID-token verification (RS256 against Google JWKS), restricted to existing members | Sign-in requires the Google provider and the serving domain to be enabled in the Firebase console; invitation emails are not sent (no mail provider) |
| MOD-030 Profile settings | Implemented | Personal details, timezone, locale, theme; organisation identity and branding fields | Logo upload uses the file store |
| MOD-031 Financial settings and payment gateways | Provider-gated | Currency, tax, invoice identity, gateway connection states | No live gateway; payments are recorded manually with a reference |
| MOD-032 Connected apps and integrations | Implemented | Provider registry per tenant, truthful statuses, **real OAuth 2.0 authorization-code connect** for Gmail and Microsoft 365 (state cookie, server-side code exchange, tokens stored in `integration_tokens`, account label, scopes, audit), sandbox connect for the mail adapter, disconnect that deletes tokens | Other providers still need their own client credentials; without them the UI reports exactly which secrets are missing |
| MOD-033 Support suite | Implemented | Dashboard with SLA metrics, ticket list and thread with internal notes, assignment, priority/status, SLA policies, knowledge base CRUD, support automation runs | Live chat requires a provider |
| MOD-034 Reports | Implemented | Domain reports with aggregates, saved report records, CSV export gated by permission | No ad-hoc report builder UI |
| MOD-035 Notifications | Implemented | Generated on stage changes, assignments, tickets, workflow failures; unread count, mark one/all read, deep links | Per-user channel preferences are minimal |
| MOD-036 Telephony and call logs | Provider-gated | Dial pad with number validation/normalisation, call log CRUD, call metrics on the sales dashboard | No telephony provider; the app never claims a call was placed |

## Cross-module journeys

| Journey | Status |
| --- | --- |
| JRN-001 Lead to opportunity | Implemented and tested |
| JRN-002 Company and contacts | Implemented |
| JRN-003 Form to CRM | Implemented and tested (public submit → record) |
| JRN-004 Campaign send | Implemented with the sandbox adapter |
| JRN-005 Sequence | Implemented (tick-driven) |
| JRN-006 Workflow | Implemented (trigger → run → log → replay) |
| JRN-007 Deal and invoice | Implemented up to invoice and manual payment; no gateway |
| JRN-008 Support | Implemented (ticket → SLA → thread → resolve) |
| JRN-009 Visitor analytics | Implemented (tracker → session → identification) |
| JRN-010 Social publishing | Blocked at provider connection by design |
| JRN-011 Mailbox sync | Blocked at provider connection by design |
| JRN-012 Task/calendar | Implemented |

## Deliberate non-goals in this build

Real outbound email/WhatsApp/SMS, social publishing, ad spend ingestion, telephony, payment capture,
OAuth authorisation, PDF generation, e-signature, full localisation, and per-record ACLs. Each of
these is surfaced in the UI as a connection requirement rather than simulated.

---

## Master-prompt pass (this turn)

- Design tokens updated to the master prompt palette: accent `#FF7417`, canvas `#F7F8FA`, ink `#182230`, muted `#687386`, line `#E7EAF0`, plus new navy/teal/purple tokens.
- Contact details now open in a slide-over drawer (760px) with Overview/Activity/Deals/Tasks tabs, quick actions (email, call, create task/deal), tags, status, score, company, owner and audit timestamps. Clicking a contact row in the list opens the drawer; "Open full page" remains available.
- Firebase Google SSO: the Worker already verifies Firebase ID tokens against Google JWKS and issues the session cookie. The remaining blocker is a Firebase Console step — add `site-d1b4feb6014b416f94b9eeb74b01295c.freebuff.page` (and the preview hostname) to Firebase Authentication → Settings → Authorized domains. Without this, Google sign-in returns "This domain is not yet authorised in Firebase Authentication." No code change can bypass domain verification.
- Build + typecheck + deploy to preview succeeded.

---

## Phase 3 — production stabilization pass

Verification is against the deployed preview (`https://site-d1b4feb6014b416f94b9eeb74b01295c.freebuff.page`)
and `scripts/regression.mjs` (69 API checks, all passing on the preview).

### Fixed root causes

| Defect | Root cause | Fix |
| --- | --- | --- |
| Seeded "Create follow-up task" workflows sent a notification instead of creating a task | Seeded nodes carried no `action`, so the executor fell back to `notify` | `action` is now stored on every seeded node; a missing/unsupported action fails the run instead of defaulting; `repairLegacyWorkflowActions()` rewrites existing rows from their labels (no deletes) |
| Both branches of a conditional workflow ran | The executor had no branch state | Nodes may carry `branch: 'true' \| 'false'`; non-matching nodes are skipped and logged; conditions stop the run when false unless `stopWhenFalse: false` |
| Re-delivery of the same event re-ran workflows, small edits never re-ran them | Idempotency key was event + record id only | Key now includes an FNV-1a fingerprint of the record's content fields (excluding `updated_at`, `last_login`, `last_sync`) |
| Contact 360° related tabs showed other contacts' records | The client requested `…/deals??contact_id=…` (double `?`), and the list endpoint silently ignored unknown filters | Client URL fixed; the list endpoint now rejects unknown filter keys with `400 VALIDATION_ERROR` instead of returning an unfiltered list |
| Contact Tasks tab was empty | Tasks relate through `related_type`/`related_id`, not `contact_id` | `RelatedList` accepts extra filters and the contact drawer passes `related_type=contact` |
| Home dashboard chart was invented data | The trend series was generated, not queried | `homeDashboard` returns real zero-filled activity counts for 7/14/30 days; the range selector drives the query |
| Signed-out deep link landed on the marketing page | Unauthenticated workspace routes redirected to `/` | They now redirect to `/login` |
| `/deals` and `/tasks` were 404s | Only `/sales/deals` and `/sales/tasks` existed | Short paths redirect to the canonical routes |

### AI assistant

`src/worker/ai.ts` resolves a provider from Worker secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or Azure
OpenAI) and only uses it while the matching integration row is `connected`. Requests time out after 20 s and
provider errors surface verbatim. With no key the assistant answers from CRM data with server-side queries and
says so in every reply — it never presents rule output as model output. `GET /api/ai/providers` reports the
configured provider, model name, secret name and whether the secret is present (never a value).

### Accepted limitations

- Google SSO cannot complete until `site-d1b4feb6014b416f94b9eeb74b01295c.freebuff.page` is added to Firebase
  Authentication → Settings → Authorized domains. The app now names the exact host and the console path in the UI.
- Gmail / Microsoft 365 sync needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` or
  `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` as Worker secrets; both pages report `Not connected` until then.
- Dashboard layout is stored per user in `localStorage` on that browser, not on the server.
- Scheduled workflow continuation is driven by the authenticated `POST /api/scheduler/tick` call the app makes on
  load, not by a Cloudflare cron trigger. That is also what drives delay nodes and the retry backoff.
- A failed action node is retried twice (30 s, then 60 s) starting at the failed node, then the run is marked
  failed and the workflow owner is notified. Manual replay of any run stays available.
