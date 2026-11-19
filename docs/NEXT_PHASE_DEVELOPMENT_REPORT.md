# GoFox CRM — Next Phase Development Report

**Review date:** 18 November 2026  
**Scope:** All 36 product modules, shared platform, integrations and quality readiness  
**Method:** Reviewed the current source tree, routes, Worker handlers, entity registry, implementation status, traceability and QA documents. `bun run typecheck` and `bun run build` were attempted but Bun is unavailable in this environment. The destructive/live-data `scripts/module-audit.mjs` was not run. This is a source and evidence review, not a fresh runtime acceptance pass.

## Executive assessment

GoFox has a broad and coherent CRM foundation: tenant-scoped generic CRUD, role checks, audit/activity, useful operational flows, public form/page endpoints, workflow execution, dashboards and truthful provider states. The next phase should move from feature breadth to **production readiness**: prove security and recovery behavior in isolated environments, establish repeatable CI/browser QA, make scheduled work reliable, and implement provider integrations only where there is a concrete business need and credentials.

The repository’s `IMPLEMENTATION_STATUS.md` is a useful inventory, but it is not evidence that every interaction or production configuration has been validated. The QA plan itself calls out no automated browser suite, no two-tenant experiment, no load/soak or accessibility work, and no real provider tests. Resolve those gaps before expanding into more modules.

## Module-by-module status

Status below reflects the source and the repository’s existing implementation/QA records. “Implemented” means the product surface and described backend behavior exist; it does not imply this review re-executed every flow.

| ID | Module | Current state | Next-phase direction |
|---|---|---|---|
| MOD-001 | Application shell and global features | Implemented | Accessibility and responsive-navigation pass; complete localization only if required. |
| MOD-002 | Home dashboard | Implemented; persisted aggregates and configurable local layout documented | Validate aggregate reconciliation and consider server-saved layouts for multi-device use. |
| MOD-003 | GoFox AI assistant | Tenant-query fallback works; provider-backed model path exists but is configuration-gated | Define data-use policy, provider failure handling and usage limits before enabling in production. |
| MOD-004 | Companies | Implemented through generic resource CRUD and detail relationships | Add lifecycle/ownership edge-case coverage. |
| MOD-005 | Leads | Implemented; conversion and idempotency documented/tested | Add duplicate/concurrent conversion and reassignment coverage. |
| MOD-006 | Contacts | Implemented; detail drawer, timeline, relationships and consent fields | Add import/deduplication and consent-change audit scenarios. |
| MOD-007 | Lists | Static lists implemented | Build dynamic segments only if marketing needs them; test membership consistency. |
| MOD-008 | Marketing dashboard | Implemented; send/open figures derive from sandbox events | Separate sandbox metrics from live provider metrics in reports. |
| MOD-009 | Forms | Builder, publish and public submission implemented | Add abuse controls: rate limits, spam mitigation, embed/domain policy and validation hardening. |
| MOD-010 | Landing pages | Editor, publish, public rendering and view count implemented | Add custom domains, safe HTML policy and production cache/SEO verification as needed. |
| MOD-011 | Emails and templates | CRUD, preview and sandbox test send; visual email editor absent | Decide whether a block editor is needed; verify rendering across email clients. |
| MOD-012 | Campaigns | Scheduling/send and suppression implemented through sandbox adapter | Integrate a selected ESP; add bounce, complaint, unsubscribe and retry handling. |
| MOD-013 | Email sequences | Tick-driven steps/enrolment implemented in sandbox mode | Add mailbox reply detection and robust background execution after provider selection. |
| MOD-014 | WhatsApp inbox | Provider-gated; send guard and connection state | Select Meta Cloud API or another supported provider; implement webhook verification and consent lifecycle. |
| MOD-015 | Social posts | Queue/status surface exists; publishing provider-gated | Select target networks and add OAuth, token refresh, publishing and webhook/error reconciliation. |
| MOD-016 | Social ads | Connection/account surface only | Prioritize only with a defined ads reporting/sync use case and provider scope. |
| MOD-017 | Content hub | Content CRUD implemented | Add public reader/publishing workflow if this is intended to be a CMS. |
| MOD-018 | Workflow builder | Canvas and linear execution, conditions, waits, actions, logs and replay documented; not a general branching DAG | Improve graph semantics/validation; add durable queues, concurrency limits and operational monitoring. |
| MOD-019 | Web analytics | Tracker and aggregate endpoints implemented | Rate-limit and abuse-protect public collection; document consent/privacy retention. |
| MOD-020 | Marketing activities | Activity feed implemented | Check pagination/retention and event taxonomy consistency. |
| MOD-021 | Files repository | Upload/download/trash implemented; D1 storage, no folders/R2 | Move binary storage to R2/object storage; add lifecycle, quota and malware scanning policy. |
| MOD-022 | Sales dashboard | Aggregate dashboard implemented | Reconcile KPI calculations against fixtures and date/time-zone boundaries. |
| MOD-023 | Deals | Pipeline board, stage transitions and forecast implemented | Add pipeline/stage administration and concurrency/transition validation if required. |
| MOD-024 | Tasks | CRUD, due/overdue and completion flow implemented | Add recurring tasks and notification/reminder scheduling if needed. |
| MOD-025 | Calendar | Events and dated tasks displayed; drag rescheduling absent | Add rescheduling and timezone/DST test coverage. |
| MOD-026 | Mail inbox | Surface and send guards exist; Gmail integration path present, provider-gated without credentials | Validate OAuth scopes, sync cursor/history recovery, attachment limits and send behavior with a test tenant. |
| MOD-027 | Proposals, quotes and invoices | Server-calculated totals and manual payments implemented | Add PDF output, tax/rounding coverage, and e-sign/payment provider only after selection. |
| MOD-028 | Products | CRUD and SKU uniqueness implemented | Add currency/price precision and archive behavior coverage. |
| MOD-029 | Account settings and users | Roles, members, audit and Firebase SSO implemented; invitation delivery absent | Validate invite lifecycle and SSO in configured domains; add recovery/owner-transfer policy. |
| MOD-030 | Profile settings | Profile, locale, timezone, theme and org identity implemented | Verify preference persistence and locale/timezone edge cases. |
| MOD-031 | Financial settings/payment gateways | Settings exist; manual payments; gateways provider-gated | Select gateway and implement signed webhooks, idempotent payment reconciliation and refunds if required. |
| MOD-032 | Connected apps/integrations | Provider registry, Gmail/Microsoft OAuth paths and sandbox adapter documented | Add secret rotation, token refresh/revocation checks, reconnect UX and provider contract tests. |
| MOD-033 | Support suite | Tickets, messages, SLA, knowledge base and support dashboard implemented; live chat gated | Validate SLA clock semantics, escalation delivery, customer-visible/internal-message separation. |
| MOD-034 | Reports | Domain aggregates, saved report records and CSV export implemented; no ad-hoc builder | Add export privacy/size tests and report filters/builder if demanded by users. |
| MOD-035 | Notifications | In-app notifications and read state implemented | Add channel preferences and durable email/push delivery only with configured providers. |
| MOD-036 | Telephony/call logs | Call log and dial pad; placing calls provider-gated | Choose telephony provider and implement signed callback/events before claiming call completion. |

## Cross-cutting findings

### Strengths visible in the repository

- A single entity registry drives server validation and client resource screens, reducing schema drift.
- Tenant identity is described as session-derived, with server-side role enforcement, same-origin mutation checks, audit records and soft deletion.
- Provider-gated features state their connection requirement; the mail sandbox is explicitly labeled rather than presented as external delivery.
- The API has a substantial set of concrete routes for auth, resources, workflows, reports, integrations, files, email, support and public endpoints.
- Existing documentation describes meaningful journeys including lead conversion, form-to-CRM, campaign sending, workflow runs, support and analytics.

### Risks and evidence gaps to close

1. **Repeatable verification:** Bun is unavailable here, so current typecheck/build results are unknown. The repo should run those checks in CI on every change and attach results to releases.
2. **No automated UI regression suite:** add browser coverage for critical journeys and role-specific visibility/denials. Existing notes say browser review was partial and mostly heading-level for many screens.
3. **Tenant isolation proof:** create two isolated tenants in test fixtures and attempt list, detail, search, export, download, workflow and analytics access across tenant boundaries.
4. **Public endpoint abuse controls:** forms and analytics accept anonymous traffic; add rate limits, payload bounds, spam protections and retention controls.
5. **Background processing:** scheduler advancement currently depends on an authenticated app-load tick according to the status document. Production scheduling needs a Cloudflare Cron Trigger or a reliable external scheduler, with retry/lease/duplicate-delivery tests.
6. **Production storage and recovery:** files are stored in D1 at demo scale; define object storage, backup, restore and migration practices before real customer files/data.
7. **Integration lifecycle:** OAuth connection flows need configured end-to-end tests covering callback errors, token refresh, disconnect/revoke, secret rotation and provider outages.
8. **Accessibility and load behavior:** no WCAG or load/soak testing is recorded; add keyboard/screen-reader checks and representative multi-tenant load tests.
9. **Product gaps:** custom fields/roles, approvals, dynamic segments, branching workflows, ad-hoc reports and PDF/e-sign are documented gaps. Decide based on user priority instead of implementing all at once.

## Recommended next-phase sequence

### Phase 0 — Establish a trustworthy baseline

- Install/use the project’s intended Bun version and run `bun run typecheck` and `bun run build` in CI.
- Run regression tests against an ephemeral local D1 database; ensure test data is isolated and cleaned up.
- Split the existing broad audit into safe read-only checks and explicit mutation checks against disposable fixtures.
- Reconcile README and status claims with the latest CI run; add commit/date and environment to QA evidence.

**Exit gate:** reproducible green build/typecheck and deterministic regression run on a clean database.

### Phase 1 — Security, tenancy and public-surface hardening

- Add a two-tenant isolation test suite across CRUD, search, reports, export, files, AI context and workflow triggers.
- Add rate limits and payload/attachment limits to anonymous endpoints; decide spam, consent and privacy retention controls.
- Review cookie, CORS/origin, OAuth state/PKCE, secret handling and user/invitation lifecycle in deployment configuration.
- Define D1 backup, restore, migration and file-object storage strategy; move uploads to R2 before scaling customer use.

**Exit gate:** tenant-boundary and public abuse tests pass; backup/restore procedure has been exercised.

### Phase 2 — Reliable operations and core UX quality

- Configure a real scheduled trigger for workflow waits, campaigns and sequences; add observability for retries, failures and queue lag.
- Add browser tests for login/logout, contacts/leads/deals, campaign suppression, workflow publish/run/replay, tickets, exports and role denials.
- Run accessibility and responsive checks across high-use screens; address keyboard navigation, labels, contrast and reduced motion.
- Add reconciliation tests for dashboard/report values and timezone/DST boundaries.

**Exit gate:** critical journeys pass in browser and scheduled jobs run independently of user page loads.

### Phase 3 — Provider-backed capabilities, selected by product priority

Choose one provider path at a time (email, then whichever of payments, telephony, WhatsApp or social is most valuable). For each: credentials and scopes, token/webhook lifecycle, idempotency, retry/backoff, observability, sandbox/test account, permission/consent checks, user-facing failure states, and reconciliation tests. Keep unconfigured capabilities visibly gated.

**Exit gate:** an end-to-end provider scenario succeeds and recovers from timeout, duplicate webhook, revoked token and partial failure.

### Phase 4 — Targeted product expansion

Use customer feedback to prioritize the documented gaps: branching workflow DAG, dynamic segments, pipeline administration, custom fields/roles, report builder, public content reader, PDF/e-sign, or full localization. Avoid treating the entire gap list as one release.

## Suggested first sprint

1. Pin Bun and add CI build/typecheck gates.
2. Create clean test database fixtures, including two organizations, and add isolation regression cases.
3. Convert the current module audit to fixture-safe operation and report per-module outcomes as machine-readable artifacts.
4. Configure a scheduled production tick and verify wait/campaign/sequence idempotency.
5. Add browser tests for the top three customer journeys selected by product (recommended baseline: lead conversion, campaign/form flow, support ticket resolution).

## Verification limitations for this report

- `bun run typecheck` and `bun run build` could not execute because `bun` is not installed in this environment.
- The API module audit was not executed because it mutates records and sends actions to its configured base URL; no disposable endpoint was running.
- No files were changed by an audit run. This report is based on source and the repository’s recorded test outcomes; rerun gates in the project’s intended environment before release.
