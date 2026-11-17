# GoFox CRM

A multi-tenant CRM, marketing-automation and support workspace built to the supplied
**GoFox CRM Complete End-to-End Product Development Specification** (36 modules, MOD-001 … MOD-036).

Light workspace, white cards, orange primary actions, grouped left navigation, top utility bar,
right-hand drawers and a working workflow canvas — backed by a real database, server-side
authentication, role-based access control, an audit trail and an automation engine. No dashboard
figure in this app is hardcoded; every number is a SQL aggregate over persisted, tenant-scoped rows.

---

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript, Vite 8, Tailwind CSS v4 |
| Router | Small history-based router in `src/lib/router.tsx` (no dependency) |
| API | Cloudflare Worker with Hono 4 (`src/worker/`) |
| Database | Cloudflare D1 (SQLite), schema created idempotently on first request |
| Auth | Email + password (PBKDF2-SHA256, 100 000 iterations), hashed session tokens, httpOnly cookie, plus Google SSO via Firebase Auth (ID tokens verified in the Worker) |
| Charts | Hand-built SVG components (no chart dependency) |

## Getting started

```bash
bun install
bun run dev          # http://localhost:3001
```

The first request creates the schema and seeds a demo tenant ("Northwind Trading") with 6 users,
12 companies, 38 contacts, 27 leads, 23 deals, tickets, campaigns, sequences, forms, landing pages,
workflows, integration records and 30 days of website analytics events.

To start from a clean database, stop the dev server and delete the local D1 state:

```bash
rm -rf .wrangler/state   # development only — the seed runs again on next start
```

### Demo accounts

Password for every account: `gofox1234`

| Email | Role | What to try |
| --- | --- | --- |
| `owner@gofox.dev` | owner | Everything, including account settings and integrations |
| `admin@gofox.dev` | admin | User administration, audit log, all data |
| `manager@gofox.dev` | manager | Dashboards, reports, pipeline, approvals |
| `sales@gofox.dev` | sales | Leads, contacts, deals, tasks — export is denied |
| `marketer@gofox.dev` | marketer | Campaigns, forms, pages, sequences, analytics |
| `support@gofox.dev` | support | Tickets, SLA, knowledge base — settings are denied |

### Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite dev server with the Worker runtime (port 3001) |
| `bun run build` | Client build + Worker build into `dist/` |
| `bun run typecheck` | `tsc --noEmit` over the whole project |
| `bun run preview` | Vite preview of a production build |

---

## Architecture

```
src/
  worker/
    index.ts        Hono app: auth, resources, actions, public endpoints, tracker, AI
    schema.ts       ~42 tables + indexes, applied idempotently
    seed.ts         Demo tenant, deterministic ids, realistic cross-links
    entities.ts     Whitelisted resource registry (fields, validation, uniqueness, labels)
    auth.ts         PBKDF2, sessions, permission matrix, same-origin guard
    automation.ts   Workflow execution, campaign sends, sequence advancement, scheduler tick
    dashboards.ts   Home / marketing / sales / support aggregates + report tables
    db.ts           D1 helpers, migrations, inserts, pagination
  lib/
    api.ts          Typed fetch wrapper, ApiError, CSV download
    app-context.tsx Session, permissions, toasts, option lists, label helpers
    router.tsx      History router, Link, matchPath
  components/       UI kit, charts, resource pages, shell (sidebar/topbar/search/AI/dial pad)
  pages/            One module per screen group (crm, sales, marketing, automation, support, …)
```

### One registry, two consumers

`src/worker/entities.ts` is the single source of truth for CRM resources. The API uses it to
validate, filter, sort, paginate and audit generic CRUD (`/api/resources/:entity`), and the client
uses `/api/schema` to render lists, forms, filters and detail pages from the same definitions.
Adding a field is a one-file change and cannot drift between client and server.

### Workflow engine

A workflow is a linear node list with exactly one trigger and `condition` / `wait` / `action` / `end`
nodes. Publishing validates the graph server-side. Triggered runs are recorded in `workflow_runs`
with an idempotency key (`workflowId:trigger:entityId:version`), so duplicate event delivery cannot
create duplicate tasks or messages. Waits resume from `/api/scheduler/tick`, which also sends due
campaigns and advances sequence enrolments. Dry-run executes the real condition logic against a
sample record and never sends, charges or calls anything.

### Security model

Every business table carries `org_id`; every query and mutation derives the tenant from the session,
never from the request body. Mutations require a same-origin `Origin`/`Referer` and are written to
`audit_logs` plus the record's activity feed. Roles map to permissions on the server
(`ROLE_PERMS` in `auth.ts`) — the client hides actions it cannot perform, but the server is the
authority. Passwords are PBKDF2-SHA256 with per-user salts; session tokens are stored only as
SHA-256 hashes and delivered in an httpOnly, SameSite=Lax cookie. See `docs/SECURITY_MODEL.md`.

### Integrations are honest

Provider records start `not_connected` and the UI shows that state. Outbound email runs through a
clearly labelled **Sandbox Mail** adapter (seeded as connected, `mode: sandbox`) that records sends
and events locally instead of pretending to deliver mail. WhatsApp, social publishing, ads, mail
sync, telephony, payment gateways and the LLM assistant have no provider connected, so those
screens show "Not connected" and disable the action rather than faking success. The AI panel is a
deterministic assistant over real tenant queries and says so.

---

### Public site and Google SSO

`/` renders a premium marketing site for signed-out visitors (`/welcome` is an alias); signed-in users
get the workspace. Sign-in lives at `/login` and offers **Continue with Google** alongside email and
password, with the six demo roles one click away.

Firebase web configuration lives in `src/lib/firebase.ts` — public identifiers that ship in every
Firebase web client, not secrets. Override any of them with `VITE_FIREBASE_*` build variables, and
restrict the API key by HTTP referrer in Google Cloud for production.

The Worker (`src/worker/firebase.ts`) verifies the Firebase ID token before a session exists: the
signature is checked against Google's published JWKS with WebCrypto, and audience, issuer, `exp`,
`iat`, subject and `email_verified` are all enforced. `FIREBASE_PROJECT_ID` is set in
`wrangler.jsonc` under `vars`. **Membership is never self-provisioned** — the verified email must
already belong to an active user in a workspace, otherwise the API answers
`ACCOUNT_NOT_PROVISIONED` and tells the user to ask an administrator.

Three console steps are required for Google sign-in to work on a new domain:

1. Firebase Console → Authentication → Sign-in method → enable **Google**.
2. Firebase Console → Authentication → Settings → **Authorised domains** → add the hostname you serve
   from (for example the `*.style.dev` preview host and your production domain).
3. Optional but recommended: Google Cloud Console → Credentials → restrict the browser API key to
   your HTTP referrers.

Firebase Analytics is initialised lazily from the public pages and is best-effort: if measurement is
unsupported or blocked, the app continues without it.

### Provider connections (real OAuth)

**Settings → Connected apps → Connect with OAuth** starts a genuine OAuth 2.0 authorization-code flow
for Gmail and Microsoft 365. The browser is sent to the provider's own sign-in screen; the Worker mints
a random `state` into a short-lived httpOnly cookie, validates it on the callback, exchanges the code
server-side and stores the tokens in `integration_tokens` — the client never receives them.

Required Worker secrets: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (or `MICROSOFT_CLIENT_ID` /
`MICROSOFT_CLIENT_SECRET`). Optional: `APP_ORIGIN` to build deterministic redirect URIs. Register
`<origin>/api/integrations/<provider>/callback` with the provider. Without the secrets the endpoint
redirects back with `connect_error=not_configured` and names the missing variables — it never reports a
connection that does not exist. Disconnecting deletes the stored token.

## Routes

`/` marketing site for visitors, workspace home when signed in (`/welcome` alias) · `/login` ·
`/companies` `/leads` `/contacts` `/lists` · `/marketing` (dashboard, forms, landing
pages, emails, campaigns, sequences, whatsapp, social, ads, content, automations, workflows, web
analytics, activities) · `/sales` (dashboard, deals, tasks, calendar, inbox, automations, proposals,
quotes, invoices, products) · `/support` (dashboard, tickets, automations, live chat, knowledge base,
activities, SLA) · `/reports` · `/settings` (account, profile, financial, apps, audit) · `/files`
`/trash` · public `/f/:slug` forms, `/p/:slug` landing pages, `/tracker.js`.

## Verification

- `bun run typecheck` — clean.
- `bun run build` — client and Worker bundles build.
- A scripted API pass covered sign-in, wrong-password rejection, tenant-scoped reads, CRUD,
  duplicate-name rejection, duplicate-email warning, lead conversion (including idempotent repeat),
  deal stage moves, campaign send through the sandbox adapter, workflow dry-run, ticket replies,
  public form submission, analytics/report aggregates, permission denials for sales/support, and the
  scheduler tick. Details and results are in `docs/QA_TEST_PLAN.md`.

## Documentation

- [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) — module-by-module status, honestly stated
- [`docs/REQUIREMENTS_TRACEABILITY.md`](docs/REQUIREMENTS_TRACEABILITY.md) — spec requirement → code → check
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — tables, relationships, tenancy rules
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — endpoints and permissions
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — provider states, sandbox adapter, adding a provider
- [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md) — auth, RBAC, tenant isolation, audit
- [`docs/QA_TEST_PLAN.md`](docs/QA_TEST_PLAN.md) — automated checks, journeys, known gaps

## Deployment

The app is a Worker plus static assets. `wrangler.jsonc` binds the D1 database as `DB`;
replace the placeholder `database_id` with your own database (`wrangler d1 create gofox-crm`).
`deploy.json` describes the built bundle for the Freebuff Sites pipeline. The schema and seed run
automatically on the first request to a fresh database, so no separate migration step is required.
