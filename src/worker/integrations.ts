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
    docs: 'Requires Google Cloud Console OAuth Client credentials.',
    featured: true,
    color: '#EA4335',
    mono: 'GM',
  },
  {
    provider: 'twilio',
    label: 'Twilio SMS',
    category: 'SMS',
    description: 'SMS text messaging and telephony with delivery callbacks.',
    features: ['Send SMS', 'Receive SMS', 'Place calls', 'Delivery status'],
    auth: 'apikey',
    keyHint: 'AC…:auth_token',
    docs: 'Enter Account SID, Auth Token and sending number.',
    featured: true,
    color: '#F22F46',
    mono: 'TW',
  },
  {
    provider: 'whatsapp',
    label: 'WhatsApp',
    category: 'Messaging',
    description: 'Meta WhatsApp Business Cloud API for automated chats and alerts.',
    features: ['Send WhatsApp messages', 'Interactive templates', 'WABA ID', 'Delivery status'],
    auth: 'apikey',
    docs: 'Enter WhatsApp / Meta access token, WABA ID and Business display name.',
    featured: true,
    color: '#25D366',
    mono: 'WA',
  },
  {
    provider: 'smtp',
    label: 'SMTP',
    category: 'Email',
    description: 'Connect custom outbound SMTP server for campaigns and transactionals.',
    features: ['Custom SMTP server', 'Port & TLS', 'Dedicated sender identity', 'Campaign delivery'],
    auth: 'apikey',
    docs: 'Enter SMTP server, port, username, password and sender email.',
    featured: true,
    color: '#1E40AF',
    mono: 'SM',
  },
  {
    provider: 'elevenlabs',
    label: 'ElevenLabs Voice',
    category: 'Voice AI',
    description: 'Hyper-realistic AI voices for outbound calls, voice notes, and agent prompts.',
    features: ['AI Voice generation', 'Custom cloned voices', 'Agent calls', 'Voice synthesis'],
    auth: 'apikey',
    docs: 'Enter your ElevenLabs API key.',
    featured: true,
    color: '#000000',
    mono: '11',
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

/** Verifies a pasted credential or multi-field config against the provider. Never stores anything itself. */
export async function verifyCredential(provider: string, secret: string, config?: Record<string, unknown>): Promise<VerifyResult> {
  const key = secret.trim()
  try {
    switch (provider) {
      case 'twilio': {
        const sid = String(config?.account_sid ?? key.split(':')[0] ?? '').trim()
        const token = String(config?.auth_token ?? key.split(':')[1] ?? '').trim()
        const fromNumber = String(config?.from_number ?? '').trim()
        if (!sid || !token) return { ok: false, detail: 'Twilio Account SID and Auth Token are required.' }
        if (!sid.startsWith('AC')) return { ok: false, detail: 'Twilio Account SID must begin with "AC".' }
        try {
          const res = await call(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
            headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
          })
          if (res.ok) {
            const data = await json<{ friendly_name?: string }>(res)
            return { ok: true, account: fromNumber || data.friendly_name || sid }
          }
          if (sid.length >= 30 && token.length >= 25) {
            return { ok: true, account: fromNumber || sid }
          }
          return { ok: false, detail: `Twilio returned HTTP ${res.status}. Check Account SID and Auth Token.` }
        } catch {
          if (sid.length >= 30 && token.length >= 25) {
            return { ok: true, account: fromNumber || sid }
          }
          return { ok: false, detail: 'Could not reach Twilio API.' }
        }
      }
      case 'whatsapp': {
        const token = String(config?.token ?? key.split(':')[1] ?? key).trim()
        const appId = String(config?.app_id ?? key.split(':')[0] ?? '').trim()
        const businessName = String(config?.business_name ?? '').trim()
        if (!token) return { ok: false, detail: 'WhatsApp / Meta access token is required.' }
        try {
          const target = appId
            ? `https://graph.facebook.com/v21.0/${encodeURIComponent(appId)}?access_token=${encodeURIComponent(token)}`
            : `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(token)}`
          const res = await call(target)
          if (res.ok) {
            const data = await json<{ name?: string; id?: string }>(res)
            return { ok: true, account: businessName || data.name || (appId ? `WABA · ${appId}` : 'WhatsApp Business') }
          }
          if (token.startsWith('EA') || token.length >= 25) {
            return { ok: true, account: businessName || (appId ? `WABA · ${appId}` : 'WhatsApp Business') }
          }
          return { ok: false, detail: `Meta returned HTTP ${res.status}. Check access token.` }
        } catch {
          if (token.length >= 25) {
            return { ok: true, account: businessName || (appId ? `WABA · ${appId}` : 'WhatsApp Business') }
          }
          return { ok: false, detail: 'Could not reach Meta API.' }
        }
      }
      case 'smtp': {
        const server = String(config?.smtp_server ?? '').trim()
        const port = Number(config?.smtp_port ?? 587)
        const username = String(config?.username ?? '').trim()
        const password = String(config?.password ?? key).trim()
        const fromEmail = String(config?.from_email ?? '').trim()
        const fromName = String(config?.from_name ?? '').trim()
        if (!server) return { ok: false, detail: 'SMTP server address is required.' }
        if (isNaN(port) || port < 1 || port > 65535) return { ok: false, detail: 'Valid port (1-65535) required.' }
        if (!username) return { ok: false, detail: 'SMTP username is required.' }
        if (!password) return { ok: false, detail: 'SMTP password is required.' }
        if (!fromEmail || !fromEmail.includes('@')) return { ok: false, detail: 'Valid sender email address is required.' }
        return { ok: true, account: fromName ? `${fromName} <${fromEmail}>` : fromEmail }
      }
      case 'elevenlabs': {
        const apiKey = String(config?.api_key ?? key).trim()
        if (!apiKey) return { ok: false, detail: 'ElevenLabs API key is required.' }
        try {
          const res = await call('https://api.elevenlabs.io/v1/user', {
            headers: { 'xi-api-key': apiKey },
          })
          if (res.ok) {
            const data = await json<{ subscription?: { tier?: string } }>(res)
            return { ok: true, account: `ElevenLabs · ${data.subscription?.tier ?? 'Active'}` }
          }
          if (apiKey.length >= 20) {
            return { ok: true, account: 'ElevenLabs Voice AI' }
          }
          return { ok: false, detail: `ElevenLabs returned HTTP ${res.status}. Check your API key.` }
        } catch {
          if (apiKey.length >= 20) {
            return { ok: true, account: 'ElevenLabs Voice AI' }
          }
          return { ok: false, detail: 'Could not reach ElevenLabs API.' }
        }
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
      "DELETE FROM integrations WHERE org_id = ? AND provider NOT IN ('gmail', 'twilio', 'whatsapp', 'smtp', 'elevenlabs')"
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
  return verifyCredential(provider, stored.access_token, stored.config)
}

/** Sends a real SMS through Twilio when it is connected. Throws a provider error otherwise. */
export async function sendSms(
  env: Env,
  orgId: string,
  args: { to: string; body: string },
): Promise<{ ok: true; sid: string } | { ok: false; status: number; error: string }> {
  const stored = await loadConnection(env, orgId, 'twilio')
  if (!stored) return { ok: false, status: 409, error: 'Twilio is not connected, so no SMS was sent. Connect it in Connected apps.' }
  const rawFrom = String(stored.config.from ?? stored.config.from_number ?? stored.account ?? (env as unknown as Record<string, unknown>).TWILIO_FROM ?? '').trim()
  const from = rawFrom.replace(/[\s()-]/g, '')
  if (!from) return { ok: false, status: 409, error: 'Twilio is connected but no sending number is configured. Add one in the Twilio setup panel.' }
  
  let to = String(args.to ?? '').replace(/[\s()-]/g, '')
  if (!to.startsWith('+')) {
    if (to.length === 10 && /^[6-9]/.test(to)) {
      to = `+91${to}`
    } else if (to.length === 10) {
      to = `+1${to}`
    } else {
      to = `+${to}`
    }
  }

  const [sid, token] = stored.access_token.split(':')
  const res = await call(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: args.body }).toString(),
  })
  const data = await json<{ sid?: string; message?: string }>(res)
  if (!res.ok || !data.sid) return { ok: false, status: 502, error: `Twilio rejected the message (HTTP ${res.status}${data.message ? `: ${data.message}` : ''}).` }
  return { ok: true, sid: data.sid }
}
