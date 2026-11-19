/**
 * Gmail integration: OAuth token lifecycle, incremental mailbox synchronisation and sending.
 *
 * Everything here talks to the real Gmail API (`gmail.googleapis.com`). There is no sandbox
 * fallback in this module: when Google is not configured or the grant was revoked the call
 * returns a typed failure and the UI reports it, rather than inventing a connection.
 *
 * Tokens live in `integration_tokens` (server-side only). The browser never receives an access
 * token, refresh token or client secret.
 */
import { nowIso, uid, type Env } from './db'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

export type GmailFailure = { ok: false; code: string; message: string; status?: number }
export type GmailToken = { ok: true; token: string; account: string; email?: string }

type TokenRow = {
  id: string
  account: string | null
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

function envString(env: Env, key: string): string {
  const value = (env as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function googleCredentials(env: Env): { clientId: string; clientSecret: string } | null {
  const clientId = envString(env, 'GOOGLE_CLIENT_ID')
  const clientSecret = envString(env, 'GOOGLE_CLIENT_SECRET')
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** The exact redirect URI Google must have registered. Explicit env wins over the request origin. */
export function gmailRedirectUri(env: Env, requestUrl: string, forwardedProto?: string | null, forwardedHost?: string | null): string {
  const explicit = envString(env, 'GOOGLE_REDIRECT_URI')
  if (explicit) return explicit
  const base = envString(env, 'APP_BASE_URL') || envString(env, 'APP_ORIGIN')
  if (base) return new URL('/api/integrations/gmail/callback', base).toString()
  const url = new URL(requestUrl)
  const proto = forwardedProto || url.protocol.replace(':', '')
  const host = forwardedHost || url.host
  return `${proto}://${host}/api/integrations/gmail/callback`
}

export async function loadToken(env: Env, orgId: string, accountId?: string): Promise<TokenRow | null> {
  if (accountId) {
    const acc = await env.DB.prepare(
      `SELECT id, account_email as account, access_token, refresh_token, expires_at FROM email_accounts
       WHERE org_id = ? AND id = ? AND provider = 'gmail' AND connection_status = 'connected' LIMIT 1`,
    ).bind(orgId, accountId).first<TokenRow>()
    if (acc) return acc
  }
  const defaultAcc = await env.DB.prepare(
    `SELECT id, account_email as account, access_token, refresh_token, expires_at FROM email_accounts
     WHERE org_id = ? AND provider = 'gmail' AND connection_status = 'connected' ORDER BY is_default DESC, created_at ASC LIMIT 1`,
  ).bind(orgId).first<TokenRow>()
  if (defaultAcc) return defaultAcc

  return env.DB.prepare(
    `SELECT id, account, access_token, refresh_token, expires_at FROM integration_tokens
     WHERE org_id = ? AND provider = 'gmail' LIMIT 1`,
  )
    .bind(orgId)
    .first<TokenRow>()
}

/** Exchanges a stored refresh token for a fresh access token and persists it. */
export async function refreshAccessToken(env: Env, row: TokenRow): Promise<GmailToken | GmailFailure> {
  if (!row.refresh_token) {
    return {
      ok: false,
      code: 'NEEDS_RECONNECT',
      message: 'Gmail access expired and no refresh token is stored. Reconnect Gmail to grant offline access.',
      status: 409,
    }
  }
  const creds = googleCredentials(env)
  if (!creds) {
    return {
      ok: false,
      code: 'GMAIL_NOT_CONFIGURED',
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set on this deployment, so the token cannot be refreshed.',
      status: 503,
    }
  }
  let response: Response
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
    })
  } catch {
    return { ok: false, code: 'GMAIL_UNREACHABLE', message: 'Could not reach Google to refresh the Gmail token.', status: 502 }
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || !payload.access_token) {
    const errorCode = String(payload.error ?? '')
    const revoked = errorCode === 'invalid_grant'
    return {
      ok: false,
      code: revoked ? 'GMAIL_REVOKED' : 'GMAIL_TOKEN_ERROR',
      message: revoked
        ? 'Google revoked this Gmail connection (invalid_grant). Reconnect Gmail to restore access.'
        : `Google rejected the token refresh: ${String(payload.error_description ?? (errorCode || `HTTP ${response.status}`))}`,
      status: revoked ? 409 : 502,
    }
  }
  const expiresIn = Number(payload.expires_in ?? 3600)
  const expiresAt = new Date(Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000).toISOString()
  await env.DB.prepare('UPDATE integration_tokens SET access_token = ?, expires_at = ?, token_type = ?, updated_at = ? WHERE id = ?')
    .bind(String(payload.access_token), expiresAt, String(payload.token_type ?? 'Bearer'), nowIso(), row.id)
    .run()
  return { ok: true, token: String(payload.access_token), account: row.account ?? '' }
}

export async function gmailToken(env: Env, orgId: string, force = false): Promise<GmailToken | GmailFailure> {
  const row = await loadToken(env, orgId)
  if (!row) {
    return {
      ok: false,
      code: 'GMAIL_NOT_CONNECTED',
      message: 'No Gmail account is connected to this workspace. Connect Gmail in Settings → Email accounts.',
      status: 409,
    }
  }
  const expires = row.expires_at ? Date.parse(row.expires_at) : 0
  if (!force && row.access_token && Number.isFinite(expires) && expires > Date.now() + 60_000) {
    return { ok: true, token: row.access_token, account: row.account ?? '' }
  }
  if (!force && row.access_token && !row.expires_at) {
    return { ok: true, token: row.access_token, account: row.account ?? '' }
  }
  return refreshAccessToken(env, row)
}

export class GmailError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 502) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** Authenticated Gmail API call with one automatic refresh-and-retry on 401. */
export async function gmailFetch<T = unknown>(
  env: Env,
  orgId: string,
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const auth = await gmailToken(env, orgId, retried)
  if (!auth.ok) throw new GmailError(auth.code, auth.message, auth.status ?? 409)
  let response: Response
  try {
    response = await fetch(`${GMAIL_API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${auth.token}`,
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw new GmailError('GMAIL_UNREACHABLE', 'Could not reach the Gmail API.', 502)
  }
  if (response.status === 401 && !retried) return gmailFetch<T>(env, orgId, path, init, true)
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string; status?: string } }
    const message = payload?.error?.message ?? `Gmail API returned HTTP ${response.status}`
    const rateLimited = response.status === 429
    throw new GmailError(rateLimited ? 'GMAIL_RATE_LIMITED' : 'GMAIL_API_ERROR', message, response.status)
  }
  return (await response.json()) as T
}

/* ------------------------------------------------------------------ parsing */

type GmailPart = {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: { name: string; value: string }[]
  body?: { attachmentId?: string; size?: number; data?: string }
  parts?: GmailPart[]
}

export type GmailAttachment = { id: string; filename: string; mimeType: string; size: number }
export type ParsedMessage = {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  subject: string
  fromName: string
  fromEmail: string
  to: string[]
  cc: string[]
  bcc: string[]
  date: string
  bodyHtml: string
  bodyText: string
  attachments: GmailAttachment[]
  rfcMessageId: string
  unread: boolean
  starred: boolean
}

const header = (headers: { name: string; value: string }[] | undefined, name: string): string => {
  const match = headers?.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
  return match?.value ?? ''
}

function decodeBase64Url(data: string): string {
  try {
    const normalised = data.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

function collectParts(part: GmailPart | undefined, acc: { html: string[]; text: string[]; attachments: GmailAttachment[] }) {
  if (!part) return
  const mime = String(part.mimeType ?? '')
  if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({
      id: part.body.attachmentId,
      filename: part.filename,
      mimeType: mime || 'application/octet-stream',
      size: Number(part.body.size ?? 0),
    })
  } else if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data)
    if (mime === 'text/html') acc.html.push(decoded)
    else if (mime === 'text/plain') acc.text.push(decoded)
  }
  for (const child of part.parts ?? []) collectParts(child, acc)
}

function parseAddress(value: string): { name: string; email: string } {
  const angle = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (angle) return { name: angle[1].trim(), email: angle[2].trim().toLowerCase() }
  return { name: '', email: value.trim().toLowerCase() }
}

function splitAddresses(value: string): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => parseAddress(entry).email)
    .filter(Boolean)
}

export function parseGmailMessage(raw: {
  id: string
  threadId?: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: GmailPart
}): ParsedMessage {
  const headers = raw.payload?.headers ?? []
  const from = parseAddress(header(headers, 'from'))
  const acc = { html: [] as string[], text: [] as string[], attachments: [] as GmailAttachment[] }
  collectParts(raw.payload, acc)
  const labels = raw.labelIds ?? []
  return {
    id: raw.id,
    threadId: raw.threadId ?? raw.id,
    labelIds: labels,
    snippet: raw.snippet ?? '',
    subject: header(headers, 'subject') || '(no subject)',
    fromName: from.name || from.email,
    fromEmail: from.email,
    to: splitAddresses(header(headers, 'to')),
    cc: splitAddresses(header(headers, 'cc')),
    bcc: splitAddresses(header(headers, 'bcc')),
    date: raw.internalDate ? new Date(Number(raw.internalDate)).toISOString() : nowIso(),
    bodyHtml: acc.html.join('\n'),
    bodyText: acc.text.join('\n'),
    attachments: acc.attachments,
    rfcMessageId: header(headers, 'message-id'),
    unread: labels.includes('UNREAD'),
    starred: labels.includes('STARRED'),
  }
}

/* ------------------------------------------------------------------- storage */

export async function storeParsedMessages(env: Env, orgId: string, account: string, messages: ParsedMessage[]): Promise<number> {
  if (!messages.length) return 0
  const now = nowIso()
  const statements = messages.map((message) => {
    const folder = message.labelIds.includes('SENT') ? 'sent' : message.labelIds.includes('DRAFT') ? 'draft' : 'inbox'
    return env.DB.prepare(
      `INSERT INTO email_messages (
         id, org_id, provider, account, provider_message_id, thread_id, direction, folder,
         from_email, from_name, to_emails, cc_emails, bcc_emails, subject, snippet,
         body_html, body_text, attachments, labels, has_attachments, unread, starred,
         rfc_message_id, received_at, created_at, updated_at
       ) VALUES (?, ?, 'gmail', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, provider, provider_message_id) DO UPDATE SET
         thread_id = excluded.thread_id, folder = excluded.folder, from_email = excluded.from_email,
         from_name = excluded.from_name, to_emails = excluded.to_emails, cc_emails = excluded.cc_emails,
         bcc_emails = excluded.bcc_emails, subject = excluded.subject, snippet = excluded.snippet,
         body_html = excluded.body_html, body_text = excluded.body_text, attachments = excluded.attachments,
         labels = excluded.labels, has_attachments = excluded.has_attachments, unread = excluded.unread,
         starred = excluded.starred, received_at = excluded.received_at, updated_at = excluded.updated_at`,
    ).bind(
      uid(),
      orgId,
      account,
      message.id,
      message.threadId,
      folder === 'sent' ? 'outbound' : 'inbound',
      folder,
      message.fromEmail,
      message.fromName,
      JSON.stringify(message.to),
      JSON.stringify(message.cc),
      JSON.stringify(message.bcc),
      message.subject,
      message.snippet,
      message.bodyHtml,
      message.bodyText,
      JSON.stringify(message.attachments),
      JSON.stringify(message.labelIds),
      message.attachments.length ? 1 : 0,
      message.unread ? 1 : 0,
      message.starred ? 1 : 0,
      message.rfcMessageId,
      message.date,
      now,
      now,
    )
  })
  for (let i = 0; i < statements.length; i += 20) {
    await env.DB.batch(statements.slice(i, i + 20))
  }
  return messages.length
}

export type SyncResult = {
  status: 'idle' | 'running' | 'complete' | 'error'
  initial: boolean
  fetched: number
  stored: number
  remaining: number
  historyId: string | null
  lastSync: string | null
  message: string
  error?: string
}

type SyncStateRow = {
  id: string
  history_id: string | null
  status: string
  last_sync: string | null
  last_error: string | null
  messages_synced: number
  cursor: string | null
}

type SyncCursor = { ids: string[]; pageToken?: string | null; done?: boolean }

async function ensureSyncState(env: Env, orgId: string): Promise<SyncStateRow> {
  const existing = await env.DB.prepare('SELECT * FROM email_sync_state WHERE org_id = ?').bind(orgId).first<SyncStateRow>()
  if (existing) return existing
  const now = nowIso()
  await env.DB.prepare(
    `INSERT INTO email_sync_state (id, org_id, provider, status, messages_synced, created_at, updated_at)
     VALUES (?, ?, 'gmail', 'idle', 0, ?, ?)`,
  )
    .bind(uid(), orgId, now, now)
    .run()
  return {
    id: '',
    history_id: null,
    status: 'idle',
    last_sync: null,
    last_error: null,
    messages_synced: 0,
    cursor: null,
  }
}

async function setSyncState(env: Env, orgId: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch)
  if (!keys.length) return
  const now = nowIso()
  await env.DB.prepare(`UPDATE email_sync_state SET ${keys.map((key) => `${key} = ?`).join(', ')}, updated_at = ? WHERE org_id = ?`)
    .bind(...keys.map((key) => patch[key] as string | number | null), now, orgId)
    .run()
}

async function upsertAccount(env: Env, orgId: string, account: string, status: string, lastError: string | null = null) {
  await env.DB.prepare("UPDATE integrations SET status = ?, account = ?, last_sync = ?, note = ? WHERE org_id = ? AND provider = 'gmail'")
    .bind(status, account, nowIso(), lastError, orgId)
    .run()
}

async function fetchDetails(env: Env, orgId: string, ids: string[]): Promise<ParsedMessage[]> {
  const messages: ParsedMessage[] = []
  const chunk = ids.slice(0, 20)
  for (let i = 0; i < chunk.length; i += 8) {
    const batch = await Promise.all(
      chunk.slice(i, i + 8).map(async (id) => {
        try {
          const raw = await gmailFetch<Record<string, unknown>>(env, orgId, `/messages/${id}?format=full`)
          return parseGmailMessage(raw as Parameters<typeof parseGmailMessage>[0])
        } catch {
          return null
        }
      }),
    )
    for (const message of batch) if (message) messages.push(message)
  }
  return messages
}

export async function syncGmail(env: Env, orgId: string, options: { forceFull?: boolean } = {}): Promise<SyncResult> {
  const state = await ensureSyncState(env, orgId)
  const token = await gmailToken(env, orgId)
  if (!token.ok) throw new GmailError(token.code, token.message, token.status ?? 409)

  const account = token.account || 'gmail'
  await setSyncState(env, orgId, { status: 'running' })
  await upsertAccount(env, orgId, account, 'connected')

  try {
    let cursor: SyncCursor = { ids: [], pageToken: null }
    try {
      cursor = state.cursor ? (JSON.parse(state.cursor) as SyncCursor) : cursor
    } catch {
      cursor = { ids: [], pageToken: null }
    }
    if (options.forceFull) {
      cursor = { ids: [], pageToken: null }
      await setSyncState(env, orgId, { history_id: null })
    }

    // Incremental path: we have a bookmark and no backlog.
    if (state.history_id && !cursor.ids.length && !cursor.pageToken && !options.forceFull) {
      try {
        const history = await gmailFetch<{ historyId?: string; history?: { messages?: { id: string }[] }[] }>(
          env,
          orgId,
          `/history?startHistoryId=${encodeURIComponent(state.history_id)}&historyTypes=messageAdded`,
        )
        const ids = new Set<string>()
        for (const entry of history.history ?? []) for (const message of entry.messages ?? []) ids.add(message.id)
        const parsed = await fetchDetails(env, orgId, [...ids])
        const stored = await storeParsedMessages(env, orgId, account, parsed)
        const latest = history.historyId ?? state.history_id
        await setSyncState(env, orgId, {
          status: 'idle',
          history_id: latest,
          last_sync: nowIso(),
          last_error: null,
          messages_synced: state.messages_synced + stored,
        })
        await upsertAccount(env, orgId, account, 'connected')
        return {
          status: 'idle',
          initial: false,
          fetched: ids.size,
          stored,
          remaining: 0,
          historyId: latest,
          lastSync: nowIso(),
          message: stored ? `Synced ${stored} new message${stored === 1 ? '' : 's'}.` : 'Mailbox already up to date.',
        }
      } catch (error) {
        // An expired historyId is normal after a long pause; fall back to a bounded full resync.
        if (error instanceof GmailError && /history/i.test(error.message) && /404|too old|invalid/i.test(error.message)) {
          await setSyncState(env, orgId, { history_id: null, cursor: JSON.stringify({ ids: [], pageToken: null }) })
          cursor = { ids: [], pageToken: null }
        } else {
          throw error
        }
      }
    }

    // Initial / backlog path. 20 detail fetches per run keeps us well inside Worker subrequest limits.
    if (!cursor.ids.length && cursor.pageToken !== null) {
      const list = await gmailFetch<{ messages?: { id: string }[]; nextPageToken?: string }>(
        env,
        orgId,
        `/messages?maxResults=50&q=${encodeURIComponent('-in:spam -in:trash')}${cursor.pageToken ? `&pageToken=${encodeURIComponent(cursor.pageToken)}` : ''}`,
      )
      cursor.ids = (list.messages ?? []).map((message) => message.id)
      cursor.pageToken = list.nextPageToken ?? null
    }

    const batchIds = cursor.ids.splice(0, 20)
    const parsed = await fetchDetails(env, orgId, batchIds)
    const stored = await storeParsedMessages(env, orgId, account, parsed)
    const backlog = cursor.ids.length + (cursor.pageToken ? 1 : 0)
    const done = backlog === 0
    let historyId = state.history_id
    if (done) {
      const profile = await gmailFetch<{ historyId?: string; emailAddress?: string }>(env, orgId, '/profile')
      historyId = profile.historyId ? String(profile.historyId) : historyId
    }
    await setSyncState(env, orgId, {
      status: done ? 'idle' : 'running',
      cursor: JSON.stringify(cursor),
      history_id: historyId,
      last_sync: nowIso(),
      last_error: null,
      messages_synced: state.messages_synced + stored,
    })
    await upsertAccount(env, orgId, account, 'connected')
    return {
      status: done ? 'idle' : 'running',
      initial: true,
      fetched: batchIds.length,
      stored,
      remaining: cursor.ids.length + (cursor.pageToken ? 25 : 0),
      historyId: historyId ?? null,
      lastSync: nowIso(),
      message: done
        ? `Initial synchronisation complete · ${stored} messages stored.`
        : `Synchronised ${stored} messages · more available, run Sync again to continue.`,
    }
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('GMAIL_SYNC_FAILED', error instanceof Error ? error.message : 'Sync failed')
    await setSyncState(env, orgId, { status: 'error', last_error: gmailError.message, last_sync: nowIso() })
    if (gmailError.code === 'GMAIL_REVOKED' || gmailError.code === 'NEEDS_RECONNECT') {
      await upsertAccount(env, orgId, account, 'error', gmailError.message)
    }
    throw gmailError
  }
}

/* ---------------------------------------------------------------------- send */

export type SendAttachment = { filename: string; mimeType?: string; content: string }

export type SendPayload = {
  to: string
  cc?: string
  bcc?: string
  subject: string
  html: string
  text?: string
  attachments?: SendAttachment[]
  threadId?: string
}

const encodeHeader = (value: string): string => (/([\u0080-\uffff])/.test(value) ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(value)))}?=` : value)

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildMimeMessage(from: string, payload: SendPayload): string {
  const boundary = `gofox_${Math.random().toString(36).slice(2)}`
  const altBoundary = `${boundary}_alt`
  const safe = (value: string) => value.replace(/[\r\n]+/g, ' ').trim()
  const lines: string[] = [
    `From: ${safe(from)}`,
    `To: ${safe(payload.to)}`,
    ...(payload.cc ? [`Cc: ${safe(payload.cc)}`] : []),
    ...(payload.bcc ? [`Bcc: ${safe(payload.bcc)}`] : []),
    `Subject: ${encodeHeader(safe(payload.subject))}`,
    'MIME-Version: 1.0',
  ]
  const text = payload.text ?? payload.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const alternative = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(text))),
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(payload.html))),
    `--${altBoundary}--`,
  ].join('\r\n')

  if (!payload.attachments?.length) {
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`, '', alternative)
    return lines.join('\r\n')
  }
  const parts = [
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    alternative,
  ]
  for (const attachment of payload.attachments.slice(0, 5)) {
    const content = attachment.content.includes(',') ? attachment.content.split(',').pop() ?? '' : attachment.content
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType ?? 'application/octet-stream'}; name="${safe(attachment.filename).replace(/"/g, '')}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safe(attachment.filename).replace(/"/g, '')}"`,
      '',
      content,
    )
  }
  parts.push(`--${boundary}--`)
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '', parts.join('\r\n'))
  return lines.join('\r\n')
}

export async function sendGmail(
  env: Env,
  orgId: string,
  payload: SendPayload,
): Promise<{ id: string; threadId: string; account: string }> {
  const token = await gmailToken(env, orgId)
  if (!token.ok) throw new GmailError(token.code, token.message, token.status ?? 409)
  const account = token.account || 'me'
  const totalAttachment = (payload.attachments ?? []).reduce((sum, attachment) => sum + attachment.content.length, 0)
  if (totalAttachment > 11_000_000) {
    throw new GmailError('ATTACHMENT_TOO_LARGE', 'Attachments exceed Gmail’s 10 MB message limit. Remove or compress a file.', 413)
  }
  const raw = buildMimeMessage(`${account}`, payload)
  let response: { id?: string; threadId?: string }
  try {
    response = await gmailFetch<{ id?: string; threadId?: string }>(env, orgId, '/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw: base64Url(raw), ...(payload.threadId ? { threadId: payload.threadId } : {}) }),
    })
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('GMAIL_SEND_FAILED', 'Gmail rejected the message.')
    if (/quota|limit|rate/i.test(gmailError.message)) {
      throw new GmailError('GMAIL_QUOTA', 'Gmail sending limit reached for this account. Wait and retry, or connect a transactional provider for bulk mail.', 429)
    }
    throw gmailError
  }
  const id = String(response.id ?? '')
  const threadId = String(response.threadId ?? id)
  const now = nowIso()
  await env.DB.prepare(
    `INSERT INTO email_messages (
       id, org_id, provider, account, provider_message_id, thread_id, direction, folder,
       from_email, from_name, to_emails, cc_emails, bcc_emails, subject, snippet,
       body_html, body_text, attachments, labels, has_attachments, unread, starred,
       rfc_message_id, received_at, created_at, updated_at
     ) VALUES (?, ?, 'gmail', ?, ?, ?, 'outbound', 'sent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
  )
    .bind(
      uid(),
      orgId,
      account,
      id,
      threadId,
      account,
      account,
      JSON.stringify(payload.to.split(',').map((entry) => entry.trim())),
      JSON.stringify((payload.cc ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)),
      JSON.stringify((payload.bcc ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)),
      payload.subject,
      payload.html.replace(/<[^>]+>/g, ' ').slice(0, 180),
      payload.html,
      payload.text ?? '',
      JSON.stringify((payload.attachments ?? []).map((attachment) => ({ filename: attachment.filename, mimeType: attachment.mimeType ?? 'application/octet-stream' }))),
      JSON.stringify(['SENT']),
      (payload.attachments ?? []).length ? 1 : 0,
      '',
      now,
      now,
      now,
    )
    .run()
  await env.DB.prepare("UPDATE integrations SET last_sync = ? WHERE org_id = ? AND provider = 'gmail'").bind(now, orgId).run()
  return { id, threadId, account }
}

/* ----------------------------------------------------------------- variables */

export const EMAIL_VARIABLES = [
  'first_name',
  'last_name',
  'email',
  'company_name',
  'phone',
  'owner_name',
  'deal_name',
] as const

export type TemplateVars = Record<string, string>

export function renderVariables(template: string, vars: TemplateVars): { output: string; missing: string[] } {
  const missing = new Set<string>()
  const output = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*([^}]*))?\}\}/g, (_match, key: string, fallback: string | undefined) => {
    const value = vars[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value)
    if (fallback !== undefined && fallback.trim() !== '') return fallback.trim()
    missing.add(key)
    return ''
  })
  return { output, missing: [...missing] }
}

/** Builds personalisation variables for a contact (and its company/owner/deal) inside the tenant. */
export async function contactVariables(env: Env, orgId: string, contactId: string): Promise<TemplateVars> {
  const contact = await env.DB.prepare(
    `SELECT c.*, co.name AS company_name, u.name AS owner_name,
            (SELECT d.name FROM deals d WHERE d.contact_id = c.id AND d.org_id = c.org_id AND d.deleted_at IS NULL ORDER BY d.updated_at DESC LIMIT 1) AS deal_name
     FROM contacts c
     LEFT JOIN companies co ON co.id = c.company_id AND co.org_id = c.org_id
     LEFT JOIN users u ON u.id = c.owner_id AND u.org_id = c.org_id
     WHERE c.id = ? AND c.org_id = ?`,
  )
    .bind(contactId, orgId)
    .first<Record<string, unknown>>()
  if (!contact) return {}
  return {
    first_name: String(contact.first_name ?? ''),
    last_name: String(contact.last_name ?? ''),
    email: String(contact.email ?? ''),
    phone: String(contact.phone ?? ''),
    company_name: String(contact.company_name ?? ''),
    owner_name: String(contact.owner_name ?? ''),
    deal_name: String(contact.deal_name ?? ''),
  }
}
