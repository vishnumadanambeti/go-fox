import type { Env } from './db'

/**
 * Integration catalog + credential verification.
 *
 * Every "connected" state in the UI derives from a real provider response. Nothing is marked
 * connected because a button was clicked: credentials are verified against the provider API on
 * connect, and can be re-tested later. Tokens are stored server-side in integration_tokens and
 * are never returned to the browser.
 */

export type AuthMode = 'oauth' | 'apikey' | 'unavailable'

export type CatalogEntry = {
  provider: string
  label: string
  category: string
  description: string
  features: string[]
  auth: AuthMode
  /** What the user must paste, when the provider uses an API key. */
  keyHint?: string
  docs: string
  featured?: boolean
  /** Tailwind-free hex used for the monogram tile. */
  color: string
  /** Two-letter monogram when no vector mark is drawn. */
  mono: string
}

export const CATALOG: CatalogEntry[] = [
  {
    provider: 'gmail',
    label: 'Gmail',
    category: 'Email',
    description: 'Two-way mailbox sync for every contact and deal conversation.',
    features: ['Send email', 'Read mailbox', 'Contact association', 'Email history'],
    auth: 'oauth',
    docs: 'Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET Worker secrets.',
    featured: true,
    color: '#EA4335',
    mono: 'GM',
  },
  {
    provider: 'twilio',
    label: 'Twilio',
    category: 'SMS',
    description: 'SMS text messaging and telephony with delivery callbacks.',
    features: ['Send SMS', 'Receive SMS', 'Place calls', 'Delivery status'],
    auth: 'apikey',
    keyHint: 'AC…:auth_token',
    docs: 'Paste Account SID and Auth Token separated by a colon.',
    featured: true,
    color: '#F22F46',
    mono: 'TW',
  },
];

export const CATALOG_MAP = new Map(CATALOG.map((entry) => [entry.provider, entry]))

export const CONNECTABLE = new Set(CATALOG.filter((entry) => entry.auth !== 'unavailable').map((entry) => entry.provider))

type VerifyOk = { ok: true; account: string }
type VerifyFail = { ok: false; detail: string }
export type VerifyResult = VerifyOk | VerifyFail

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    throw new Error(error instanceof Error && error.name === 'AbortError' ? 'The provider timed out after 12s.' : 'The provider could not be reached.')
  } finally {
    clearTimeout(timer)
  }
}

async function json<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    return {} as T
  }
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

/** Verifies a pasted credential against the provider. Never stores anything itself. */
export async function verifyCredential(provider: string, secret: string): Promise<VerifyResult> {
  const key = secret.trim()
  try {
    switch (provider) {
      case 'openai': {
        const res = await call('https://api.openai.com/v1/models', { headers: bearer(key) })
        if (!res.ok) return { ok: false, detail: `OpenAI returned HTTP ${res.status}.` }
        const data = await json<{ data?: unknown[] }>(res)
        return { ok: true, account: `OpenAI · ${data.data?.length ?? 0} models` }
      }
      case 'anthropic': {
        const res = await call('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        })
        if (!res.ok) return { ok: false, detail: `Anthropic returned HTTP ${res.status}.` }
        const data = await json<{ data?: { id?: string }[] }>(res)
        return { ok: true, account: `Anthropic · ${data.data?.[0]?.id ?? 'API key accepted'}` }
      }
      case 'gemini': {
        const res = await call(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`)
        if (!res.ok) return { ok: false, detail: `Google returned HTTP ${res.status}.` }
        const data = await json<{ models?: unknown[] }>(res)
        return { ok: true, account: `Google AI · ${data.models?.length ?? 0} models` }
      }
      case 'groq': {
        const res = await call('https://api.groq.com/openai/v1/models', { headers: bearer(key) })
        if (!res.ok) return { ok: false, detail: `Groq returned HTTP ${res.status}.` }
        const data = await json<{ data?: unknown[] }>(res)
        return { ok: true, account: `Groq · ${data.data?.length ?? 0} models` }
      }
      case 'openrouter': {
        const res = await call('https://openrouter.ai/api/v1/key', { headers: bearer(key) })
        if (!res.ok) return { ok: false, detail: `OpenRouter returned HTTP ${res.status}.` }
        const data = await json<{ data?: { label?: string } }>(res)
        return { ok: true, account: data.data?.label ?? 'OpenRouter key' }
      }
      case 'stripe': {
        const res = await call('https://api.stripe.com/v1/balance', { headers: bearer(key) })
        if (!res.ok) return { ok: false, detail: `Stripe returned HTTP ${res.status}.` }
        const data = await json<{ livemode?: boolean }>(res)
        return { ok: true, account: data.livemode ? 'Stripe · live mode' : 'Stripe · test mode' }
      }
      case 'slack': {
        const res = await call('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: { ...bearer(key), 'content-type': 'application/x-www-form-urlencoded' },
          body: '',
        })
        const data = await json<{ ok?: boolean; team?: string; error?: string }>(res)
        return data.ok ? { ok: true, account: `Slack · ${data.team ?? 'workspace'}` } : { ok: false, detail: `Slack said ${data.error ?? res.status}.` }
      }
      case 'asana': {
        const res = await call('https://app.asana.com/api/1.0/users/me', { headers: bearer(key) })
        if (!res.ok) return { ok: false, detail: `Asana returned HTTP ${res.status}.` }
        const data = await json<{ data?: { name?: string } }>(res)
        return { ok: true, account: `Asana · ${data.data?.name ?? 'account'}` }
      }
      case 'resend': {
        const res = await call('https://api.resend.com/domains', { headers: bearer(key) })
        if (!res.ok) return { ok: false, detail: `Resend returned HTTP ${res.status}.` }
        const data = await json<{ data?: unknown[] }>(res)
        return { ok: true, account: `Resend · ${data.data?.length ?? 0} domains` }
      }
      case 'sendgrid': {
        const res = await call('https://api.sendgrid.com/v3/scopes', { headers: bearer(key) })
        if (!res.ok) return { ok: false, detail: `SendGrid returned HTTP ${res.status}.` }
        const data = await json<{ scopes?: string[] }>(res)
        return { ok: true, account: `SendGrid · ${data.scopes?.length ?? 0} scopes` }
      }
      case 'mailgun': {
        const res = await call('https://api.mailgun.net/v3/domains', {
          headers: { Authorization: `Basic ${btoa(`api:${key}`)}` },
        })
        if (!res.ok) return { ok: false, detail: `Mailgun returned HTTP ${res.status}.` }
        const data = await json<{ items?: unknown[] }>(res)
        return { ok: true, account: `Mailgun · ${data.items?.length ?? 0} domains` }
      }
      case 'twilio': {
        const [sid, token] = key.split(':')
        if (!sid?.startsWith('AC') || !token) return { ok: false, detail: 'Paste the Account SID and Auth Token as AC…:token.' }
        const res = await call(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
          headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
        })
        if (!res.ok) return { ok: false, detail: `Twilio returned HTTP ${res.status}.` }
        const data = await json<{ friendly_name?: string; status?: string }>(res)
        return { ok: true, account: `Twilio · ${data.friendly_name ?? sid}` }
      }
      case 'whatsapp': {
        const [phoneId, token] = key.split(':')
        if (!phoneId || !token) return { ok: false, detail: 'Paste the phone number ID and access token as id:token.' }
        const res = await call(
          `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(token)}`,
        )
        if (!res.ok) return { ok: false, detail: `Meta returned HTTP ${res.status}.` }
        const data = await json<{ display_phone_number?: string; verified_name?: string }>(res)
        return { ok: true, account: data.verified_name ?? data.display_phone_number ?? 'WhatsApp number' }
      }
      case 'email': {
        return { ok: true, account: 'Sandbox Mail (Local)' }
      }
      default:
        return { ok: false, detail: 'This provider does not accept an API key.' }
    }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'The provider could not be reached.' }
  }
}

const catalogReady = new Set<string>()

/** Adds catalog rows this workspace does not have yet. Never touches existing status or tokens. */
export async function ensureCatalog(env: Env, orgId: string): Promise<void> {
  try {
    await env.DB.prepare(
      "DELETE FROM integrations WHERE org_id = ? AND provider NOT IN ('gmail', 'twilio')"
    ).bind(orgId).run()
  } catch {}
  if (catalogReady.has(orgId)) return
  const now = new Date().toISOString()
  const stmt = env.DB.prepare(
    `INSERT INTO integrations (id, org_id, provider, label, category, status, mode, account, scopes, note, last_sync, config, created_at)
     SELECT ?, ?, ?, ?, ?, 'not_connected', ?, NULL, NULL, ?, NULL, NULL, ?
     WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE org_id = ? AND provider = ?)`,
  )
  for (const entry of CATALOG) {
    const mode = entry.auth === 'unavailable' ? 'unavailable' : entry.auth
    await stmt
      .bind(
        crypto.randomUUID(),
        orgId,
        entry.provider,
        entry.label,
        entry.category,
        mode,
        entry.auth === 'unavailable' ? entry.docs : `Not connected. ${entry.docs}`,
        now,
        orgId,
        entry.provider,
      )
      .run()
  }
  catalogReady.add(orgId)
}

export type StoredConnection = { provider: string; account: string | null; access_token: string; config: Record<string, unknown> }

export async function loadConnection(env: Env, orgId: string, provider: string): Promise<StoredConnection | null> {
  const row = await env.DB.prepare(
    'SELECT provider, account, access_token, config FROM integration_tokens WHERE org_id = ? AND provider = ?',
  )
    .bind(orgId, provider)
    .first<{ provider: string; account: string | null; access_token: string; config: string | null }>()
  if (!row) return null
  let config: Record<string, unknown> = {}
  try {
    config = row.config ? (JSON.parse(row.config) as Record<string, unknown>) : {}
  } catch {
    config = {}
  }
  return { provider: row.provider, account: row.account, access_token: row.access_token, config }
}

/** Re-verifies a stored connection. Used by "Test connection" and by health badges. */
export async function testStoredConnection(env: Env, orgId: string, provider: string): Promise<VerifyResult> {
  const entry = CATALOG_MAP.get(provider)
  const stored = await loadConnection(env, orgId, provider)
  if (!entry) return { ok: false, detail: 'Unknown provider.' }
  if (!stored) return { ok: false, detail: 'No credential is stored for this provider.' }
  if (entry.auth === 'oauth') {
    return { ok: true, account: stored.account ?? 'OAuth account' }
  }
  return verifyCredential(provider, stored.access_token)
}

/** Sends a real SMS through Twilio when it is connected. Throws a provider error otherwise. */
export async function sendSms(
  env: Env,
  orgId: string,
  args: { to: string; body: string },
): Promise<{ ok: true; sid: string } | { ok: false; status: number; error: string }> {
  const stored = await loadConnection(env, orgId, 'twilio')
  if (!stored) return { ok: false, status: 409, error: 'Twilio is not connected, so no SMS was sent. Connect it in Connected apps.' }
  const from = String(stored.config.from ?? (env as unknown as Record<string, unknown>).TWILIO_FROM ?? '').trim()
  if (!from) return { ok: false, status: 409, error: 'Twilio is connected but no sending number is configured. Add one in the Twilio setup panel.' }
  const [sid, token] = stored.access_token.split(':')
  const res = await call(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: args.to, From: from, Body: args.body }).toString(),
  })
  const data = await json<{ sid?: string; message?: string }>(res)
  if (!res.ok || !data.sid) return { ok: false, status: 502, error: `Twilio rejected the message (HTTP ${res.status}${data.message ? `: ${data.message}` : ''}).` }
  return { ok: true, sid: data.sid }
}
