/**
 * OAuth 2.0 authorization-code flow for provider connections.
 *
 * The browser is redirected to the provider's own sign-in screen. After consent the provider calls
 * back with a code; the Worker exchanges it for tokens server-side. Tokens are written to
 * `integration_tokens` and are never returned to the client — the UI only ever sees the connection
 * state and the account label.
 *
 * Client credentials are Worker secrets (never database rows, never the bundle):
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET        (Gmail / Google Workspace)
 *   MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET  (Microsoft 365 / Outlook)
 *
 * Without those secrets the connect endpoint refuses with `NOT_CONFIGURED` and the UI explains
 * exactly which variables are missing rather than pretending the provider is connected.
 */

export type OAuthProviderConfig = {
  key: string
  label: string
  authorizeUrl: string
  tokenUrl: string
  profileUrl: string
  scope: string
  clientIdVar: string
  clientSecretVar: string
  authParams?: Record<string, string>
  /** Where the account label comes from in the profile payload. */
  accountField: string
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  gmail: {
    key: 'gmail',
    label: 'Google Workspace (Gmail)',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    // Read-only + send is the least privilege set that supports inbox sync and sending.
    // gmail.modify is deliberately not requested: GoFox never mutates or deletes mail.
    scope:
      'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    clientIdVar: 'GOOGLE_CLIENT_ID',
    clientSecretVar: 'GOOGLE_CLIENT_SECRET',
    // select_account shows Google's own account chooser first. `consent` is combined with it so
    // Google always issues a refresh token (offline access); without it a repeat authorisation
    // returns no refresh_token and the connection would silently expire.
    authParams: { access_type: 'offline', prompt: 'select_account consent', include_granted_scopes: 'true' },
    accountField: 'email',
  },
  microsoft365: {
    key: 'microsoft365',
    label: 'Microsoft 365 (Outlook)',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    profileUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'openid email profile offline_access https://graph.microsoft.com/Mail.Send',
    clientIdVar: 'MICROSOFT_CLIENT_ID',
    clientSecretVar: 'MICROSOFT_CLIENT_SECRET',
    authParams: { response_mode: 'query', prompt: 'select_account' },
    accountField: 'mail',
  },
}

export type OAuthEnv = Record<string, unknown>

/**
 * Signs the OAuth `state` parameter with HMAC-SHA256 when GOOGLE_OAUTH_STATE_SECRET is set.
 * The state cookie is still required, so a forged callback fails validation even if the secret
 * is missing; the signature adds defence in depth against cookie fixation.
 */
export async function signState(secret: string, value: string): Promise<string> {
  if (!secret) return value
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return `${value}.${[...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export async function verifyState(secret: string, signed: string): Promise<string | null> {
  if (!secret) return signed
  const index = signed.lastIndexOf('.')
  if (index < 0) return null
  const value = signed.slice(0, index)
  const expected = await signState(secret, value)
  if (expected.length !== signed.length) return null
  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ signed.charCodeAt(i)
  return mismatch === 0 ? value : null
}

export function providerCredentials(env: OAuthEnv, provider: OAuthProviderConfig): { clientId: string; clientSecret: string } | null {
  const clientId = String(env[provider.clientIdVar] ?? '').trim()
  const clientSecret = String(env[provider.clientSecretVar] ?? '').trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function buildAuthorizeUrl(
  provider: OAuthProviderConfig,
  options: { clientId: string; redirectUri: string; state: string },
): string {
  const url = new URL(provider.authorizeUrl)
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', provider.scope)
  url.searchParams.set('state', options.state)
  for (const [key, value] of Object.entries(provider.authParams ?? {})) url.searchParams.set(key, value)
  return url.toString()
}

export type OAuthTokens = {
  accessToken: string
  refreshToken: string | null
  tokenType: string | null
  scope: string | null
  expiresAt: string | null
}

export type TokenExchangeResult =
  | { ok: true; tokens: OAuthTokens; raw: Record<string, unknown> }
  | { ok: false; message: string }

export async function exchangeCode(
  provider: OAuthProviderConfig,
  options: { clientId: string; clientSecret: string; code: string; redirectUri: string },
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: options.code,
    redirect_uri: options.redirectUri,
    client_id: options.clientId,
    client_secret: options.clientSecret,
  })

  let response: Response
  try {
    response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: body.toString(),
    })
  } catch {
    return { ok: false, message: 'Could not reach the provider token endpoint.' }
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || !payload.access_token) {
    const detail = String(payload.error_description ?? payload.error ?? `HTTP ${response.status}`)
    return { ok: false, message: `The provider rejected the authorization code: ${detail}` }
  }

  const expiresIn = Number(payload.expires_in ?? 0)
  return {
    ok: true,
    tokens: {
      accessToken: String(payload.access_token),
      refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
      tokenType: payload.token_type ? String(payload.token_type) : null,
      scope: payload.scope ? String(payload.scope) : provider.scope,
      expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    },
    raw: payload,
  }
}

/** Reads the connected account label (email / mail / userPrincipalName) from the provider profile. */
export async function fetchAccountLabel(
  provider: OAuthProviderConfig,
  accessToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(provider.profileUrl, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    })
    if (!response.ok) return null
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const value =
      payload[provider.accountField] ??
      payload.email ??
      payload.mail ??
      payload.userPrincipalName ??
      payload.name ??
      payload.sub
    return value ? String(value) : null
  } catch {
    return null
  }
}
