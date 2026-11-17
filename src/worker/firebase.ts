/**
 * Server-side Firebase ID token verification.
 *
 * The browser gets an ID token from Firebase Auth; this module proves it really came from Google's
 * secure-token service before any session is created. It is written against WebCrypto so it runs
 * in a Cloudflare Worker with no Node dependency:
 *
 *  - the token header must be RS256 and carry a key id
 *  - the signature is checked against Google's published JWKS (cached at the edge)
 *  - audience must be the Firebase project id, issuer must be that project's secure-token issuer
 *  - exp/iat are enforced, the subject must be present, and the email must be verified
 */

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

export type FirebaseClaims = {
  sub: string
  aud: string
  iss: string
  exp: number
  iat: number
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  auth_time?: number
  user_id?: string
}

export type FirebaseVerifyResult =
  | { ok: true; claims: FirebaseClaims }
  | { ok: false; code: 'INVALID_TOKEN' | 'EMAIL_NOT_VERIFIED' | 'PROVIDER_UNAVAILABLE'; message: string }

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T
}

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<FirebaseVerifyResult> {
  const invalid = (message = 'The Google sign-in token is not valid.'): FirebaseVerifyResult => ({
    ok: false,
    code: 'INVALID_TOKEN',
    message,
  })

  const parts = token.split('.')
  if (parts.length !== 3) return invalid('Malformed token.')

  let header: { alg?: string; kid?: string }
  try {
    header = decodeSegment<{ alg?: string; kid?: string }>(parts[0])
  } catch {
    return invalid('Unreadable token header.')
  }
  if (header.alg !== 'RS256' || !header.kid) return invalid('Unexpected signing algorithm.')

  let jwks: { keys?: (JsonWebKey & { kid?: string })[] }
  try {
    const response = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit)
    if (!response.ok) {
      return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'Firebase key service is unreachable. Try again shortly.' }
    }
    jwks = (await response.json()) as { keys?: (JsonWebKey & { kid?: string })[] }
  } catch {
    return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'Firebase key service is unreachable. Try again shortly.' }
  }

  const jwk = jwks.keys?.find((key) => key.kid === header.kid)
  if (!jwk) return invalid('Signing key not published by Firebase.')

  let verified = false
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(parts[2]) as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as BufferSource,
    )
  } catch {
    return invalid('Signature could not be verified.')
  }
  if (!verified) return invalid('Signature does not match the token payload.')

  let claims: FirebaseClaims
  try {
    claims = decodeSegment<FirebaseClaims>(parts[1])
  } catch {
    return invalid('Unreadable token payload.')
  }

  const now = Math.floor(Date.now() / 1000)
  if (claims.aud !== projectId) return invalid('Token was issued for another Firebase project.')
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) return invalid('Unexpected token issuer.')
  if (!claims.sub || typeof claims.exp !== 'number' || claims.exp < now) return invalid('Token has expired.')
  if (typeof claims.iat === 'number' && claims.iat > now + 300) return invalid('Token is not valid yet.')
  if (!claims.email) return invalid('The Google account did not expose an email address.')
  if (claims.email_verified !== true) {
    return { ok: false, code: 'EMAIL_NOT_VERIFIED', message: 'Verify the Google account email address before signing in.' }
  }

  return { ok: true, claims }
}
