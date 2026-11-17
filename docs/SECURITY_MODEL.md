# Security model

## Authentication

- Email + password. Passwords are hashed with **PBKDF2-SHA256, 100 000 iterations**, using a
  16-byte random per-user salt (`src/worker/auth.ts`). Plaintext passwords are never stored or logged.
- A successful login creates a 32-byte random session token. Only its SHA-256 hash is stored in
  `sessions`; the raw token is sent to the browser in the cookie `gofox_session` with
  `HttpOnly; SameSite=Lax; Path=/` and `Secure` whenever the request arrives over HTTPS.
- Sessions expire after 7 days and are deleted on sign-out. Deactivated users cannot resolve a session.
- Failed logins return a single generic message (`Email or password is incorrect.`) so the endpoint
  does not disclose whether an address exists.
- Every request re-resolves the session server-side and loads the user's `org_id` and role. The
  client is never trusted for identity or tenant.

### Google SSO (Firebase Authentication)

`POST /api/auth/firebase` accepts a Firebase ID token from the browser and performs the full check
before any session is created (`src/worker/firebase.ts`):

1. the token must be a three-part JWT with `alg: RS256` and a `kid`;
2. the signature is verified with WebCrypto against Google's published JWKS for secure tokens
   (`securetoken@system.gserviceaccount.com`), cached at the edge for an hour;
3. `aud` must equal the Firebase project id and `iss` must be
   `https://securetoken.google.com/<projectId>`;
4. `exp` must be in the future, `iat` must not be in the future beyond a 5-minute clock skew, and
   `sub` must be present;
5. `email_verified` must be `true` and an email must be present.

Only then is the email matched against an **existing active user**: membership is never
self-provisioned, so a valid Google token for an unknown address returns
`403 ACCOUNT_NOT_PROVISIONED` instead of creating a user or joining a tenant. The route also enforces
the same-origin check, and a successful sign-in writes an `auth.sso.google` audit entry. Errors are
specific (`INVALID_TOKEN`, `EMAIL_NOT_VERIFIED`, `PROVIDER_UNAVAILABLE`) so the UI can explain what
happened without leaking token contents.

## Authorisation

The server owns permissions. `ROLE_PERMS` in `src/worker/auth.ts`:

| Capability | owner | admin | manager | sales | marketer | support |
| --- | --- | --- | --- | --- | --- | --- |
| `crm.write` (companies, contacts, leads, lists) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.write` (deals, tasks, events, documents, products) | ✓ | ✓ | ✓ | ✓ | | |
| `marketing.write` (forms, pages, templates, campaigns, sequences, content, social) | ✓ | ✓ | ✓ | | ✓ | |
| `support.write` (tickets, SLA, knowledge base) | ✓ | ✓ | ✓ | | | ✓ |
| `finance.write` (financial settings, payment records) | ✓ | ✓ | | | | |
| `workflows.write` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `settings.write` (organisation settings) | ✓ | ✓ | | | | |
| `users.write` (invite, change role, deactivate) | ✓ | ✓ | | | | |
| `data.delete` (trash, restore, purge) | ✓ | ✓ | ✓ | | | |
| `data.export` (CSV exports) | ✓ | ✓ | ✓ | | | |
| `audit.read` | ✓ | ✓ | ✓ | | | |
| `ai.use` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`owner` holds `*`. The realm is deny-by-default: an unknown role or capability is refused.
The client hides actions a user cannot perform, but every endpoint re-checks on the server — the
API rejects a sales export and a support settings change even when called directly with curl
(verified in the QA pass).

## Tenant isolation

- Every business table has `org_id`. Reads, updates, deletes and joins add `org_id = ?` from the
  authenticated session; ids supplied by the client are matched together with the tenant id, so a
  guessed id from another tenant returns `NOT_FOUND` rather than another tenant's data.
- Writes ignore any `org_id` in the request body and stamp the session tenant.
- Public endpoints (`/api/public/forms/:slug`, `/api/public/pages/:slug`, `/api/public/track`) resolve
  the tenant from the slug/domain record, expose only published content and never return CRM rows.
- Related-record lookups (owner, company, contact, stage, list, template) are validated against the
  tenant before use, preventing cross-tenant reference injection.

## Request integrity

- Mutations (`POST`, `PATCH`, `DELETE`) require a same-origin `Origin`/`Referer`; the API answers
  `403 CROSS_ORIGIN_BLOCKED` otherwise. Combined with `SameSite=Lax` cookies this blocks classic CSRF.
- Request bodies are parsed with a size-bounded JSON reader and validated per field (type, length,
  enum membership, number ranges, email/URL syntax). Unknown fields are dropped rather than persisted.
- Resource names are whitelisted in the entity registry; there is no dynamic SQL table name from input.
- All SQL uses bound parameters; no string interpolation of user values.
- Uniqueness is enforced server-side (company name, deal name per company, product SKU, form/page slug)
  and reported as `CONFLICT`.

### Provider OAuth tokens

Connecting Gmail or Microsoft 365 uses the authorization-code flow with a random `state` value stored
in a short-lived, httpOnly, SameSite=Lax cookie and compared on the callback. The code exchange happens
server-side; access and refresh tokens are written to `integration_tokens` and are never serialised to
the browser. Disconnect deletes the token row. Client credentials are Worker secrets
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`), never
database fields or bundle constants, and the callback refuses to proceed when the state does not match.

## Data protection

- Soft delete keeps records recoverable in `/trash`; purge requires `data.delete`.
- File downloads require an authenticated session in the owning tenant; files are served from a
  Worker route, not a public bucket path.
- Provider secrets are never stored in the database or shipped to the client. Real providers are
  configured through Worker secrets (`wrangler secret put`), and the UI only ever receives a
  connection state and account label.
- Consent flags on contacts/leads (`email_opt_out`, `whatsapp_opt_out`, `sms_opt_out`) are applied
  before any campaign, sequence or workflow send.

## Audit and activity

- Every mutation writes an `audit_logs` row (actor, action, entity, entity id, human summary,
  user agent) and, for customer-facing records, an `activities` timeline entry.
- Audit and activity rows are append-only: they are not editable or deletable through the API.
- Emails sent, workflows published/triggered, exports, invites and settings changes are audited.
- The audit log is visible to owner, admin and manager only (`audit.read`).

## Known limitations

These are deliberate scope boundaries of this build, not silent gaps:

- No rate limiting on public form/track endpoints (add a Durable Object or KV counter before
  production traffic).
- No password reset, email verification, 2FA or SSO. Invitations are recorded and shown in-app; no
  invitation email is sent because no mail provider is connected.
- No per-record ACLs: every member of a tenant can read tenant records; roles gate actions, not rows.
- CSRF relies on `SameSite=Lax` plus the origin check rather than per-request tokens.
- File storage is the D1 `files` table (demo-scale), not R2; large uploads should move to R2.
- Provider webhooks are not implemented because no provider is connected, so their signature
  verification and replay protection are not exercised.
