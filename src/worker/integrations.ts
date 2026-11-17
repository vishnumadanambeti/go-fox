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
    provider: 'microsoft365',
    label: 'Microsoft 365',
    category: 'Email',
    description: 'Outlook mail and calendar through Microsoft Graph.',
    features: ['Send email', 'Read mailbox', 'Calendar sync'],
    auth: 'oauth',
    docs: 'Requires MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET Worker secrets.',
    color: '#2564CF',
    mono: 'MS',
  },
  {
    provider: 'resend',
    label: 'Resend',
    category: 'Email',
    description: 'Transactional email API with delivery events.',
    features: ['Send email', 'Delivery events', 'Domain management'],
    auth: 'apikey',
    keyHint: 're_…',
    docs: 'Create an API key in the Resend dashboard with sending access.',
    featured: true,
    color: '#111827',
    mono: 'RE',
  },
  {
    provider: 'sendgrid',
    label: 'SendGrid',
    category: 'Email',
    description: 'High-volume transactional and marketing delivery.',
    features: ['Send email', 'Templates', 'Bounce tracking'],
    auth: 'apikey',
    keyHint: 'SG.…',
    docs: 'Create a restricted API key with Mail Send access.',
    color: '#1A82E2',
    mono: 'SG',
  },
  {
    provider: 'mailgun',
    label: 'Mailgun',
    category: 'Email',
    description: 'Email delivery with inbound routing and logs.',
    features: ['Send email', 'Inbound routing', 'Delivery logs'],
    auth: 'apikey',
    keyHint: 'key-…',
    docs: 'Use a private API key from Settings → API keys.',
    color: '#C1282D',
    mono: 'MG',
  },
  {
    provider: 'twilio',
    label: 'Twilio',
    category: 'SMS',
    description: 'SMS and voice with delivery callbacks.',
    features: ['Send SMS', 'Receive SMS', 'Place calls', 'Delivery status'],
    auth: 'apikey',
    keyHint: 'AC…:auth_token',
    docs: 'Paste Account SID and Auth Token separated by a colon.',
    featured: true,
    color: '#F22F46',
    mono: 'TW',
  },
  {
    provider: 'exotel',
    label: 'Exotel',
    category: 'Telephony',
    description: 'Cloud telephony for calling and IVR in India and SEA.',
    features: ['Place calls', 'Call recording', 'IVR'],
    auth: 'unavailable',
    docs: 'Exotel needs an account SID, API key and subdomain. Not wired in this build.',
    color: '#0B5FFF',
    mono: 'EX',
  },
  {
    provider: 'whatsapp',
    label: 'WhatsApp Business Cloud',
    category: 'WhatsApp',
    description: 'Template messages and two-way conversations via Meta.',
    features: ['Send messages', 'Templates', 'Delivery status'],
    auth: 'apikey',
    keyHint: 'phone_number_id:access_token',
    docs: 'Paste the phone number ID and a permanent access token separated by a colon.',
    color: '#25D366',
    mono: 'WA',
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    category: 'AI',
    description: 'Powers assistant answers, drafting and summaries.',
    features: ['Assistant', 'Email drafting', 'Record summaries'],
    auth: 'apikey',
    keyHint: 'sk-…',
    docs: 'Create a project API key at platform.openai.com.',
    featured: true,
    color: '#10A37F',
    mono: 'AI',
  },
  {
    provider: 'anthropic',
    label: 'Claude (Anthropic)',
    category: 'AI',
    description: 'Alternative model provider for the assistant.',
    features: ['Assistant', 'Long-context analysis'],
    auth: 'apikey',
    keyHint: 'sk-ant-…',
    docs: 'Create an API key in the Anthropic console.',
    color: '#D97757',
    mono: 'CL',
  },
  {
    provider: 'gemini',
    label: 'Google Gemini',
    category: 'AI',
    description: 'Gemini models through the Generative Language API.',
    features: ['Assistant', 'Summaries'],
    auth: 'apikey',
    keyHint: 'AIza…',
    docs: 'Create an API key in Google AI Studio.',
    color: '#8E75B2',
    mono: 'GE',
  },
  {
    provider: 'groq',
    label: 'Groq',
    category: 'AI',
    description: 'Very fast open-model inference.',
    features: ['Assistant', 'Low-latency drafting'],
    auth: 'apikey',
    keyHint: 'gsk_…',
    docs: 'Create an API key in the Groq console.',
    color: '#F55036',
    mono: 'GQ',
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    category: 'AI',
    description: 'One key for many model providers.',
    features: ['Assistant', 'Model routing'],
    auth: 'apikey',
    keyHint: 'sk-or-…',
    docs: 'Create a key at openrouter.ai/keys.',
    color: '#6366F1',
    mono: 'OR',
  },
  {
    provider: 'stripe',
    label: 'Stripe',
    category: 'Payments',
    description: 'Invoices, payment links and subscription billing.',
    features: ['Invoices', 'Payment links', 'Balance'],
    auth: 'apikey',
    keyHint: 'sk_live_… or sk_test_…',
    docs: 'Use a restricted key with read access to start; nothing leaves this workspace.',
    featured: true,
    color: '#635BFF',
    mono: 'ST',
  },
  {
    provider: 'razorpay',
    label: 'Razorpay',
    category: 'Payments',
    description: 'Payments for India including UPI and cards.',
    features: ['Payment links', 'Orders'],
    auth: 'unavailable',
    docs: 'Razorpay needs a key id and key secret pair. Not wired in this build.',
    color: '#0C2451',
    mono: 'RZ',
  },
  {
    provider: 'paypal',
    label: 'PayPal',
    category: 'Payments',
    description: 'Checkout and invoicing through PayPal.',
    features: ['Checkout', 'Invoicing'],
    auth: 'unavailable',
    docs: 'Needs a REST app client id and secret. Not wired in this build.',
    color: '#003087',
    mono: 'PP',
  },
  {
    provider: 'google_calendar',
    label: 'Google Calendar',
    category: 'Meetings',
    description: 'Meeting sync and scheduling links.',
    features: ['Two-way sync', 'Availability'],
    auth: 'unavailable',
    docs: 'Shares the Google OAuth client with Gmail. Configure GOOGLE_CLIENT_ID first.',
    color: '#4285F4',
    mono: 'GC',
  },
  {
    provider: 'microsoft_calendar',
    label: 'Microsoft Calendar',
    category: 'Meetings',
    description: 'Outlook calendar sync.',
    features: ['Two-way sync', 'Availability'],
    auth: 'unavailable',
    docs: 'Shares the Microsoft OAuth client with Microsoft 365.',
    color: '#0078D4',
    mono: 'MC',
  },
  {
    provider: 'zoom',
    label: 'Zoom',
    category: 'Meetings',
    description: 'Create meetings from deals and tasks.',
    features: ['Create meetings', 'Recording links'],
    auth: 'unavailable',
    docs: 'Zoom Server-to-Server OAuth needs account id, client id and secret.',
    color: '#2D8CFF',
    mono: 'ZM',
  },
  {
    provider: 'calendly',
    label: 'Calendly',
    category: 'Meetings',
    description: 'Share booking links and capture scheduled meetings.',
    features: ['Booking links', 'Event webhooks'],
    auth: 'unavailable',
    docs: 'Calendly needs a personal access token plus webhook signing key.',
    color: '#006BFF',
    mono: 'CA',
  },
  {
    provider: 'slack',
    label: 'Slack',
    category: 'Productivity',
    description: 'Notify channels from workflows and mentions.',
    features: ['Send messages', 'Workflow actions'],
    auth: 'apikey',
    keyHint: 'xoxb-…',
    docs: 'Install a Slack app to the workspace and paste its bot token.',
    featured: true,
    color: '#4A154B',
    mono: 'SL',
  },
  {
    provider: 'asana',
    label: 'Asana',
    category: 'Productivity',
    description: 'Mirror CRM tasks into Asana projects.',
    features: ['Create tasks', 'Projects'],
    auth: 'apikey',
    keyHint: '1/…',
    docs: 'Create a personal access token in Asana developer settings.',
    color: '#F06A6A',
    mono: 'AS',
  },
  {
    provider: 'trello',
    label: 'Trello',
    category: 'Productivity',
    description: 'Push deals and tasks to Trello boards.',
    features: ['Create cards', 'Boards'],
    auth: 'unavailable',
    docs: 'Trello needs an API key and user token pair. Not wired in this build.',
    color: '#0052CC',
    mono: 'TR',
  },
  {
    provider: 'shopify',
    label: 'Shopify',
    category: 'E-Commerce',
    description: 'Sync customers and orders into the CRM.',
    features: ['Customer sync', 'Order history'],
    auth: 'unavailable',
    docs: 'Shopify needs a store domain plus an Admin API access token.',
    color: '#95BF47',
    mono: 'SH',
  },
  {
    provider: 'woocommerce',
    label: 'WooCommerce',
    category: 'E-Commerce',
    description: 'Sync WordPress store customers and orders.',
    features: ['Customer sync', 'Order history'],
    auth: 'unavailable',
    docs: 'WooCommerce needs a store URL plus consumer key and secret.',
    color: '#7F54B3',
    mono: 'WO',
  },
  {
    provider: 'meta',
    label: 'Meta (Facebook / Instagram)',
    category: 'Social',
    description: 'Publish posts and run lead ads.',
    features: ['Publishing', 'Lead ads'],
    auth: 'unavailable',
    docs: 'Requires an approved Meta app with pages_manage_posts.',
    color: '#1877F2',
    mono: 'ME',
  },
  {
    provider: 'linkedin',
    label: 'LinkedIn',
    category: 'Social',
    description: 'Publish from organisation pages.',
    features: ['Publishing'],
    auth: 'unavailable',
    docs: 'LinkedIn marketing API access requires partner approval.',
    color: '#0A66C2',
    mono: 'LI',
  },
  {
    provider: 'x',
    label: 'X (Twitter)',
    category: 'Social',
    description: 'Publish short-form updates.',
    features: ['Publishing'],
    auth: 'unavailable',
    docs: 'X API access requires a paid developer plan.',
    color: '#111827',
    mono: 'X',
  },
  {
    provider: 'google_ads',
    label: 'Google Ads',
    category: 'Marketing',
    description: 'Import campaign spend and conversions.',
    features: ['Spend import', 'Conversion tracking'],
    auth: 'unavailable',
    docs: 'Requires a developer token plus OAuth client.',
    color: '#4285F4',
    mono: 'GA',
  },
  {
    provider: 'google_drive',
    label: 'Google Drive',
    category: 'Storage',
    description: 'Store proposals and attachments in Drive.',
    features: ['File upload', 'Shared links'],
    auth: 'unavailable',
    docs: 'Uses the Google OAuth client with drive.file scope.',
    color: '#0F9D58',
    mono: 'GD',
  },
  {
    provider: 's3',
    label: 'AWS S3',
    category: 'Storage',
    description: 'Bring your own bucket for files.',
    features: ['File storage', 'Signed URLs'],
    auth: 'unavailable',
    docs: 'Needs bucket, region, access key and secret. Use R2 storage today.',
    color: '#FF9900',
    mono: 'S3',
  },
  {
    provider: 'email',
    label: 'Sandbox Mail',
    category: 'Email',
    description: 'Built-in test sender. Records sends without delivering to real inboxes.',
    features: ['Campaign previews', 'Send simulation'],
    auth: 'unavailable',
    docs: 'Enabled by default. Replace it by connecting a real email provider.',
    color: '#159C91',
    mono: 'SB',
  },
]

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
