import type { Context } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from './db'
import { nowIso, uid } from './db'

export type Role = 'owner' | 'admin' | 'manager' | 'sales' | 'marketer' | 'support'

export type SessionUser = {
  id: string
  org_id: string
  email: string
  name: string
  role: Role
  title: string | null
  avatar_hue: number
  theme: string
  locale: string
  timezone: string | null
  org_name: string
  currency: string
  org_timezone: string
}

export type Vars = { user: SessionUser }

const ROLE_PERMS: Record<Role, string[]> = {
  owner: ['*'],
  admin: [
    'crm.write', 'marketing.write', 'sales.write', 'support.write', 'finance.write',
    'settings.write', 'users.write', 'data.delete', 'data.export', 'audit.read',
    'workflows.write', 'ai.use',
  ],
  manager: [
    'crm.write', 'marketing.write', 'sales.write', 'support.write', 'workflows.write',
    'data.delete', 'data.export', 'audit.read', 'ai.use',
  ],
  sales: ['crm.write', 'sales.write', 'workflows.write', 'ai.use'],
  marketer: ['crm.write', 'marketing.write', 'workflows.write', 'ai.use'],
  support: ['crm.write', 'support.write', 'ai.use'],
}

export function can(role: Role, permission: string): boolean {
  const perms = ROLE_PERMS[role] ?? []
  return perms.includes('*') || perms.includes(permission)
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Account owner',
  admin: 'Administrator',
  manager: 'Manager',
  sales: 'Sales user',
  marketer: 'Marketer',
  support: 'Support agent',
}

export function randomHex(bytes = 16): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function sha256(value: string): Promise<string> {
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const SESSION_COOKIE = 'gofox_session'
const SESSION_DAYS = 7

export async function createSession(env: Env, userId: string, orgId: string, requestUrl: string) {
  const token = randomHex(32)
  const tokenHash = await sha256(token)
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, org_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(uid(), userId, orgId, tokenHash, expires.toISOString(), nowIso())
    .run()
  return { token, expires, secure: new URL(requestUrl).protocol === 'https:' }
}

export function writeSessionCookie(c: Context, token: string, expires: Date, secure: boolean) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    expires,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

const USER_SELECT = `
  SELECT u.id, u.org_id, u.email, u.name, u.role, u.title, u.avatar_hue, u.theme, u.locale,
         u.timezone, o.name AS org_name, o.currency, o.timezone AS org_timezone
  FROM users u JOIN orgs o ON o.id = u.org_id
  WHERE u.status = 'active'`

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export async function resolveUser(env: Env, request: Request): Promise<SessionUser | null> {
  const header = request.headers.get('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null
  const token = readCookie(request, SESSION_COOKIE) || bearer
  if (!token) return null
  const hash = await sha256(token)
  const row = await env.DB.prepare(
    `SELECT s.expires_at AS session_expires, u.id, u.org_id, u.email, u.name, u.role, u.title,
            u.avatar_hue, u.theme, u.locale, u.timezone, o.name AS org_name, o.currency,
            o.timezone AS org_timezone
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN orgs o ON o.id = u.org_id
     WHERE s.token_hash = ? AND u.status = 'active'
     LIMIT 1`,
  )
    .bind(hash)
    .first<SessionUser & { session_expires: string }>()
  if (!row) return null
  if (new Date(row.session_expires).getTime() < Date.now()) return null
  const { session_expires: _drop, ...user } = row
  void _drop
  return user
}

/** Login check: password hash + active status + tenant context. */
export async function verifyCredentials(env: Env, email: string, password: string) {
  const row = await env.DB.prepare(
    `SELECT u.id, u.org_id, u.email, u.name, u.role, u.password_hash, u.salt, u.status
     FROM users u WHERE lower(u.email) = lower(?) LIMIT 1`,
  )
    .bind(email.trim())
    .first<{ id: string; org_id: string; email: string; name: string; role: Role; password_hash: string; salt: string; status: string }>()
  if (!row || row.status !== 'active') return null
  const attempt = await hashPassword(password, row.salt)
  if (!safeEqual(attempt, row.password_hash)) return null
  return row
}

export async function loadUserById(env: Env, id: string): Promise<SessionUser | null> {
  const row = await env.DB.prepare(`${USER_SELECT} AND u.id = ?`).bind(id).first<SessionUser>()
  return row ?? null
}

/** Prevents CSRF on cookie-authenticated mutations from foreign origins. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}
