# Gmail integration, OAuth and the email studio

This document records exactly what the GoFox build implements, why the original connect attempt
failed, and what still has to be supplied by the workspace owner.

## 1. Why the connect attempt failed

| Symptom | Root cause | Fix in this build |
| --- | --- | --- |
| `/settings/apps?connect=gmail&connect_error=not_configured` | The Worker had no `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, so `/api/integrations/gmail/connect` refused to build an authorization URL. It redirected back with a machine code and the page never read that code, so the user saw a dead end. | The connect route now redirects back with `connect_error` **and** the page renders a human explanation, the exact redirect URI to register and the missing variable names. Credentials are read only from Worker secrets. |
| “404 when I attempt to connect an application” | Two real gaps: (a) there was no Email accounts page at all, so `/settings/email-accounts` (the path in the reference flow, and the path the Connect card points to) fell through to the SPA not-found view; (b) `/settings/apps/google` rendered `IntegrationDetailPage` with an unknown provider, which prints a 404 card. The route only knew the provider key `gmail`. | `/settings/email-accounts` now exists with a full mailbox dashboard, and `/settings/apps/google` is aliased to the Gmail integration. Deeper API routes (`/api/integrations/google/connect` and `/api/integrations/google/callback`) also exist as aliases for `gmail`. |
| Callback landed on a 404 after Google consent | The callback URL is derived from the request origin; behind the Sites proxy the forwarded host is what Google sees. If `GOOGLE_REDIRECT_URI` was registered with a different host or path, Google rejects the exchange *or* redirects to a host that does not serve the Worker. | `GOOGLE_REDIRECT_URI` is now honoured when present, otherwise `APP_BASE_URL`/`APP_ORIGIN`, otherwise the forwarded origin. The Email accounts page prints the exact URI to register and copies it in one click. |

Nothing is simulated: if credentials are absent, Connect stays disabled/explained; if Google denies
consent, no token row is written; if a refresh token is revoked, sync reports `GMAIL_REVOKED`.

## 2. Environment configuration

Set these as Worker secrets (Freebuff Sites → Secrets) or in `.dev.vars` locally:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | yes | OAuth web client id |
| `GOOGLE_CLIENT_SECRET` | yes | OAuth web client secret |
| `GOOGLE_REDIRECT_URI` | recommended | Exact registered callback, e.g. `https://<site>.freebuff.page/api/integrations/gmail/callback` |
| `APP_BASE_URL` | recommended | Public origin used when `GOOGLE_REDIRECT_URI` is unset |
| `GOOGLE_OAUTH_STATE_SECRET` | recommended | HMAC key for the signed `state` parameter |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | optional | Outlook card |

### Google Cloud Console checklist

1. Create (or select) a project → **APIs & Services → Library → Gmail API → Enable**.
2. **OAuth consent screen**: External (or Internal for Workspace), add the scopes
   `.../auth/gmail.readonly` and `.../auth/gmail.send`. While the app is in *Testing*, add the
   Google account as a test user.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Add the redirect URI shown on **Profile settings → Email accounts** (`/general-settings/email-accounts`, copy button).
5. Paste the client id/secret into Sites → Secrets, redeploy, then open Email accounts and press
   **Connect Gmail**.

The consent screen also drives the account picker seen in the reference screenshots;
`prompt=select_account consent` opens Google's own account chooser and `access_type=offline`
ensures a refresh token is always issued, including on reconnect.

## 3. Scopes

`openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send`

`gmail.modify` is deliberately **not** requested: GoFox never labels, archives or deletes mail.
Read-only + send is the minimum that supports inbox sync and sending.

## 4. Backend endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/integrations/gmail/connect` (alias `/google/connect`) | Builds the Google authorization URL with signed state + HttpOnly cookie |
| GET | `/api/integrations/gmail/callback` (alias `/google/callback`) | Verifies state, exchanges the code server-side, stores tokens, redirects back to the originating page |
| GET | `/api/email/accounts` | Live status for Gmail, Microsoft 365 and IMAP including config gaps |
| GET | `/api/email/gmail/status` | Connection, scopes, history checkpoint and counts |
| POST | `/api/email/gmail/sync` | One bounded sync pass (initial backlog or history delta) |
| POST | `/api/email/gmail/disconnect` | Deletes the token and sync checkpoint |
| GET | `/api/email/messages?folder=inbox\|sent` | Paginated, searchable local mirror |
| GET | `/api/email/messages/:id` | Full message with HTML/text and attachment metadata |
| GET | `/api/email/messages/:id/attachments/:attachmentId` | Proxied attachment download (token stays server-side) |
| POST | `/api/email/send` | Sends via Gmail with Cc/Bcc, HTML + text, attachments |
| POST | `/api/email/render` | Renders a template for a contact and reports missing variables |
| POST | `/api/templates/:id/test` | Sends a real test through Gmail |

## 5. Synchronisation

* First sync pages `users.messages.list` (50 ids per page) and fetches 20 message details per run,
  storing a cursor so the browser can continue (“Sync now”). This respects Worker subrequest limits.
* After the first pass the Gmail `historyId` from `users.getProfile` is stored in `email_sync_state`.
  Later runs call `users.history.list?startHistoryId=…&historyTypes=messageAdded` and only fetch new
  messages — no full mailbox scans.
* If Gmail reports the history id is too old, the code clears the checkpoint and performs a bounded
  resync instead of failing forever.
* Messages are de-duplicated by `(org_id, provider, provider_message_id)` unique index.
* Push notifications via Pub/Sub are not enabled; polling on demand (and on `Sync now`) is the
  supported path. Adding Pub/Sub needs a Google Cloud topic and an unauthenticated push endpoint.
* Google may revoke a grant (`invalid_grant`). The connection is then marked `error`, the UI shows
  the reason and asks for a reconnect — no silent fake success.

## 6. Sending

* RFC 2822 MIME built server-side; `multipart/alternative` for text + HTML, `multipart/mixed` when
  attachments are present (up to 5 files, ~10 MB Gmail limit).
* Header injection is prevented by stripping CR/LF; non-ASCII subjects use RFC 2047 encoding.
* Gmail quota errors are surfaced as `GMAIL_QUOTA` with guidance to use a transactional provider for
  bulk mail. GoFox does **not** treat a personal Gmail account as a bulk marketing SMTP.
* Every send is written to `email_messages` (`folder = sent`) so the Sent view is immediate, and to
  the activity/audit logs.

## 7. Token storage

Tokens live in `integration_tokens` (D1, server-side). The browser only ever receives the account
label, scopes and expiry. Refresh tokens are never sent to client code, never put in URLs, and are
deleted on disconnect. `GOOGLE_OAUTH_STATE_SECRET` HMAC-signs `state`; the HttpOnly cookie is still
required, so a forged callback cannot complete the flow on its own.

## 8. What still requires external configuration

1. Google OAuth client (client id + secret) and the Gmail API enabled.
2. The exact redirect URI registered in Google Cloud Console.
3. For Microsoft 365: an Entra application with redirect
   `/api/integrations/microsoft365/callback` and `Mail.Send`/`Mail.Read` delegated permissions.
4. IMAP mailboxes need an SMTP/IMAP relay (Workers cannot open raw TCP sockets); the card is disabled
   until `IMAP_RELAY_URL` exists.
5. Gmail push notifications need a Pub/Sub topic + subscription and a public push endpoint.
