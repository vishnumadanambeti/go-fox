# Integrations

The product rule from the specification is explicit: **never fabricate a successful external
integration, delivery, payment or call.** Every provider therefore has a real, visible state and the
UI disables actions it cannot honestly perform.

## Provider states

| State | Meaning in the UI |
| --- | --- |
| `not_connected` | Shown with a Connect action and an explanation of what connecting requires. Actions that need the provider are disabled or return a clear error. |
| `sandbox` | Connected, but to a local adapter that records activity instead of contacting the outside world. Always labelled "Sandbox". |
| `connected` | Reserved for a real provider with stored credentials. Requires `wrangler secret put` or environment configuration. |
| `error` | Last sync/authorisation failed; the error is shown and the action is disabled. |

Records live in the `integrations` table (category, provider, status, mode, account label, last sync),
seeded per tenant in `src/worker/seed.ts` and managed in **Settings → Connected apps** and
**Settings → Financial settings**.

## What is seeded, and what it really does

| Category | Provider | State | Honest behaviour |
| --- | --- | --- | --- |
| Email sending | Sandbox Mail | `sandbox` | Campaign sends are recorded in the database: recipient count, per-recipient delivery rows, and campaign counters. Nothing leaves the machine. Clearly labelled on the campaign screen. |
| Mailbox sync (Inbox) | Gmail / Microsoft 365 | `not_connected` | Inbox shows the connection requirement; no messages are invented. |
| WhatsApp | Meta WhatsApp Cloud API | `not_connected` | Conversation list is empty with a connection prompt; sending is blocked. |
| Social publishing | LinkedIn / X / Facebook | `not_connected` | Posts can be drafted and scheduled locally; publishing is blocked with a provider error instead of a fake success. |
| Social ads | Meta / Google Ads | `not_connected` | Ad accounts and spend are not fabricated; the screen shows the connection state. |
| Telephony | Twilio | `not_connected` | The dial pad validates and normalises the number, then reports that no telephony provider is connected. No call is ever claimed as placed. |
| Payments | Stripe | `not_connected` | Invoices can be issued and payments recorded manually with a reference; no gateway charge is simulated as successful. |
| AI | OpenAI | `not_connected` | The assistant answers from real CRM queries with deterministic rules and states that no language-model provider is connected. |
| Storage | Local D1 files | `sandbox` | Uploads are stored in the `files` table and served through an authenticated download route. Suitable for demos; swap for R2 for production volumes. |
| Gmail / Microsoft 365 | OAuth 2.0 authorization code | `not_connected` until you authorise | The Connect button sends the browser to the provider's own sign-in screen. The Worker validates state, exchanges the code server-side, stores tokens in `integration_tokens` and marks the provider connected with the account label. Requires `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (or the Microsoft pair) as Worker secrets. |
| Identity / SSO | Google via Firebase Auth | `configured (client)` | The browser obtains a Firebase ID token; the Worker verifies the RS256 signature against Google's JWKS, then checks audience, issuer, expiry and `email_verified`. The verified email must already belong to an active workspace user — no self-provisioning. |
| Product analytics | Firebase Analytics | `configured (client)` | Initialised lazily on public pages; measurement only, and skipped when the browser does not support it. |

CRM-owned functionality — records, pipelines, campaigns, forms, pages, workflows, sequences, tickets,
reports, analytics — is fully local and does not depend on any provider.

## Sandbox Mail adapter

`sendCampaign()` in `src/worker/automation.ts`:

1. resolves the campaign audience from the selected list, excluding opted-out and suppressed contacts;
2. refuses to send when the campaign has no audience, subject or body;
3. writes a delivery record per recipient and increments `sent_count`, `delivered_count`;
4. marks the campaign `sent` with a timestamp, and writes an activity and audit entry.

Because the adapter is the only send path, replacing it with a real provider (Resend, Postmark,
SES…) means implementing one function — the campaign UI, metrics and suppression rules stay as they are.

## Adding a real provider

1. Store credentials as Worker secrets (`wrangler secret put PROVIDER_KEY`) — never in the database,
   the client bundle or source control.
2. Add the provider to the `integrations` registry for the tenant with state `not_connected`.
3. Implement a small server module with `connect`, `send`/`publish`/`call`, and webhook verification.
4. Route the corresponding action through it, returning the provider's real result and persisting
   its identifiers so retries are idempotent.
5. Flip the record to `connected` only after a successful authenticated probe, and write an audit entry.
6. Webhooks: verify signature, deduplicate by provider event id, then apply the state change.

## OAuth connect flow (Gmail, Microsoft 365)

1. **Settings → Connected apps → Connect with OAuth** navigates to
   `GET /api/integrations/:provider/connect`.
2. That route requires a signed-in owner/admin (`settings.write`), checks the provider registry, reads
   the client credentials from Worker secrets, mints a random `state`, stores it in a short-lived
   httpOnly cookie and redirects to the provider's authorize URL.
3. The provider returns to `GET /api/integrations/:provider/callback`. The route compares the
   returned `state` with the cookie, exchanges the code at the provider's token endpoint, reads the
   account label (email / mail) and upserts the token row.
4. Only then is `integrations.status` set to `connected` (with the account and granted scopes) and an
   `integration.oauth.connected` audit entry written. The browser lands back on
   `/settings/apps?connected=gmail`.
5. **Disconnect** deletes the stored token row as well as flipping the status.

Tokens never reach the browser: the client only ever sees status, account label and scopes.

### Setup for Gmail

1. Google Cloud Console → APIs & Services → enable the **Gmail API**.
2. OAuth consent screen → add the scope `https://www.googleapis.com/auth/gmail.send` and the test
   users (or complete verification for public use — `gmail.send` is a sensitive scope).
3. Credentials → Create OAuth client ID → Web application → add the redirect URI
   `https://<your-host>/api/integrations/gmail/callback`.
4. Store the credentials as Worker secrets:
   `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET`.
5. Optional: set `APP_ORIGIN` (for example `https://crm.example.com`) so redirect URIs are built from
   a fixed origin instead of request headers.

If the secrets are absent the connect route redirects back with `connect_error=not_configured` and
names the missing variables — it never reports a connection that does not exist. Microsoft 365 works
the same way with `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` and the Graph `Mail.Send` scope.

## Firebase setup

The Firebase web config is public client configuration (it ships in every Firebase web app). It lives
in `src/lib/firebase.ts` and can be overridden with `VITE_FIREBASE_*` variables. The Worker needs only
`FIREBASE_PROJECT_ID`, which is declared under `vars` in `wrangler.jsonc`.

For Google sign-in to complete on a given origin:

1. Enable the **Google** provider in Firebase Authentication → Sign-in method.
2. Add the serving hostname to Authentication → Settings → **Authorised domains** (the preview host and
   the production domain), otherwise Firebase rejects the popup with `auth/unauthorized-domain` and the
   login screen shows exactly that message.
3. Recommended: restrict the browser API key by HTTP referrer in Google Cloud Console.

No service-account key, admin SDK or client secret is used. The only trust boundary is the signed ID
token, which is verified on every SSO sign-in.

## Security notes for integrations

- Provider secrets never reach the browser; all calls are made from the Worker.
- Outbound HTTP must be allowlisted per provider to avoid SSRF through workflow HTTP actions.
- Suppression and consent (`email_opt_out`, `whatsapp_opt_out`, `sms_opt_out`) are applied before any send.
- Every send, publish and connect action writes an `audit_logs` row with the acting user.
