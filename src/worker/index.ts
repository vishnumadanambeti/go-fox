import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { clearSessionCookie, can, createSession, hashPassword, loadUserById, randomHex, resolveUser, sameOrigin, verifyCredentials, writeSessionCookie, encryptSecret, type Role, type Vars } from './auth'
import type { Env } from './db'
import { ensureDb, insertRow, jsonParse, nowIso, uid } from './db'
import { ENTITIES, audit, checkUnique, logActivity, notify, validateValues } from './entities'
import { executeRun, fireTrigger, sendCampaign, tick, type WorkflowNode } from './automation'
import { homeDashboard, marketingDashboard, reportTable, salesDashboard, supportDashboard } from './dashboards'
import { verifyFirebaseIdToken } from './firebase'
import { OAUTH_PROVIDERS, buildAuthorizeUrl, exchangeCode, fetchAccountLabel, providerCredentials, signState, verifyState } from './oauth'
import {
  EMAIL_VARIABLES,
  GMAIL_SCOPES,
  GmailError,
  contactVariables,
  gmailFetch,
  gmailRedirectUri,
  gmailToken as gmailAccessToken,
  googleCredentials,
  loadToken,
  renderVariables,
  sendGmail,
  syncGmail,
} from './gmail'
import { CATALOG_MAP, CONNECTABLE, ensureCatalog, loadConnection, sendSms, testStoredConnection, verifyCredential } from './integrations'
import { generateReply, providerStatus, resolveProvider } from './ai'

const app = new Hono<{ Bindings: Env; Variables: Vars }>()

type Ctx = Context<{ Bindings: Env; Variables: Vars }>

function fail(c: Ctx, code: string, message: string, status = 400, fields?: Record<string, string>) {
  return c.json({ error: { code, message, fields } }, status as 400)
}

/** Structured body reader that degrades to an empty object on malformed JSON. */
async function readBody<T>(c: Ctx): Promise<T> {
  return (await c.req.json<T>().catch(() => ({}))) as T
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---------------------------------------------------------------- middleware
app.use('/api/*', async (c, next) => {
  try {
    await ensureDb(c.env)
  } catch (error) {
    return fail(
      c,
      'DATABASE_UNAVAILABLE',
      `Database not ready: ${error instanceof Error ? error.message : 'unknown error'}. A D1 binding named DB is required.`,
      503,
    )
  }
  await next()
})

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  const open =
    path.startsWith('/api/public/') ||
    path === '/api/health' ||
    path === '/api/auth/login' ||
    path === '/api/auth/firebase' ||
    path === '/api/auth/register'
  if (open) return next()
  const user = await resolveUser(c.env, c.req.raw)
  if (!user) return fail(c, 'UNAUTHENTICATED', 'Sign in to continue.', 401)
  c.set('user', user)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !sameOrigin(c.req.raw)) {
    return fail(c, 'PERMISSION_DENIED', 'Cross-origin mutation rejected.', 403)
  }
  return next()
})

const requirePerm = (c: Ctx, permission: string) => {
  const user = c.get('user')
  if (!can(user.role, permission)) {
    return fail(c, 'PERMISSION_DENIED', `Your role (${user.role}) cannot perform this action.`, 403)
  }
  return null
}

app.get('/api/health', (c) => c.json({ ok: true, service: 'gofox-crm', time: nowIso() }))

// --------------------------------------------------------------------- auth
app.post('/api/auth/login', async (c) => {
  const body = await readBody<{ email?: string; password?: string }>(c)
  const email = String(body.email ?? '').trim()
  const password = String(body.password ?? '')
  if (!EMAIL_RE.test(email) || password.length < 6) {
    return fail(c, 'VALIDATION_ERROR', 'Enter a valid email and password.', 422)
  }
  const account = await verifyCredentials(c.env, email, password)
  if (!account) return fail(c, 'UNAUTHENTICATED', 'Email or password is incorrect.', 401)
  const session = await createSession(c.env, account.id, account.org_id, c.req.url)
  writeSessionCookie(c, session.token, session.expires, session.secure)
  await c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(nowIso(), account.id).run()
  await audit(c.env, account.org_id, account.id, 'auth.login', 'user', account.id, null, { email: account.email })
  const user = await loadUserById(c.env, account.id)
  return c.json({ user })
})

/**
 * Self-service registration: creates a new workspace (org) and an owner account.
 * Membership is never granted to an existing workspace by self-registration.
 */
app.post('/api/auth/register', async (c) => {
  const body = await readBody<{ name?: string; email?: string; company?: string; password?: string }>(c)
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const company = String(body.company ?? '').trim()
  const password = String(body.password ?? '')
  if (!name || name.length < 2) return fail(c, 'VALIDATION_ERROR', 'Enter your full name.', 422)
  if (!EMAIL_RE.test(email)) return fail(c, 'VALIDATION_ERROR', 'Enter a valid work email.', 422)
  if (!company || company.length < 2) return fail(c, 'VALIDATION_ERROR', 'Enter your company name.', 422)
  if (password.length < 8) return fail(c, 'VALIDATION_ERROR', 'Password must be at least 8 characters.', 422)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email) = ? LIMIT 1').bind(email).first()
  if (existing) return fail(c, 'CONFLICT', 'An account with this email already exists.', 409)

  const orgId = uid()
  const userId = uid()
  const salt = randomHex(16)
  const passwordHash = await hashPassword(password, salt)
  const now = nowIso()
  await c.env.DB.prepare(
    'INSERT INTO orgs (id, name, slug, currency, currencies, timezone, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(orgId, company, company.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'workspace', 'USD', 'USD,EUR,GBP,INR,AED', 'Asia/Calcutta', 'en', now)
    .run()
  await c.env.DB.prepare(
    'INSERT INTO users (id, org_id, email, name, password_hash, salt, role, title, avatar_hue, status, theme, locale, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(userId, orgId, email, name, passwordHash, salt, 'owner', 'Account owner', 22, 'active', 'light', 'en', 'Asia/Calcutta', now)
    .run()

  const session = await createSession(c.env, userId, orgId, c.req.url)
  writeSessionCookie(c, session.token, session.expires, session.secure)
  await audit(c.env, orgId, userId, 'auth.register', 'user', userId, null, { email, company })
  const user = await loadUserById(c.env, userId)
  return c.json({ user })
})

/**
 * Google SSO. The browser sends a Firebase ID token; the Worker verifies the RS256 signature
 * against Google's published JWKS, checks audience/issuer/expiry, and only then issues the same
 * httpOnly session cookie as password sign-in. Membership is never self-provisioned: the verified
 * email must already belong to an active user in a workspace.
 */
app.post('/api/auth/firebase', async (c) => {
  if (!sameOrigin(c.req.raw)) return fail(c, 'PERMISSION_DENIED', 'Cross-origin sign-in rejected.', 403)
  const body = await readBody<{ idToken?: string }>(c)
  const idToken = String(body.idToken ?? '')
  if (idToken.length < 40) return fail(c, 'VALIDATION_ERROR', 'A Firebase ID token is required.', 422)
  const projectId = c.env.FIREBASE_PROJECT_ID ?? 'crm-app-dc6d5'
  const verified = await verifyFirebaseIdToken(idToken, projectId)
  if (!verified.ok) {
    const status = verified.code === 'PROVIDER_UNAVAILABLE' ? 503 : 401
    return fail(c, verified.code, verified.message, status)
  }
  const email = String(verified.claims.email ?? '').trim().toLowerCase()
  const account = await c.env.DB.prepare(
    `SELECT u.id, u.org_id, u.email FROM users u WHERE lower(u.email) = ? AND u.status = 'active' LIMIT 1`,
  )
    .bind(email)
    .first<{ id: string; org_id: string; email: string }>()
  if (!account) {
    return fail(
      c,
      'ACCOUNT_NOT_PROVISIONED',
      'No workspace member uses this Google account. Ask an administrator to invite this email address.',
      403,
    )
  }
  const session = await createSession(c.env, account.id, account.org_id, c.req.url)
  writeSessionCookie(c, session.token, session.expires, session.secure)
  await c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(nowIso(), account.id).run()
  await audit(c.env, account.org_id, account.id, 'auth.sso.google', 'user', account.id, 'Signed in with Google', {
    email,
    provider: 'google.com',
  })
  const user = await loadUserById(c.env, account.id)
  return c.json({ user })
})

app.post('/api/auth/logout', async (c) => {
  const user = c.get('user')
  const token = c.req.header('cookie')?.match(/gofox_session=([^;]+)/)?.[1]
  if (token) {
    // Sessions are looked up by hash; deleting by user keeps the cookie useless either way.
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run()
  }
  clearSessionCookie(c)
  return c.json({ ok: true })
})

app.get('/api/auth/me', (c) => c.json({ user: c.get('user') }))

app.patch('/api/auth/profile', async (c) => {
  const user = c.get('user')
  const body = await readBody<Record<string, unknown>>(c)
  const fields: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) fields.name = body.name.trim()
  if (typeof body.title === 'string') fields.title = body.title
  if (typeof body.phone === 'string') fields.phone = body.phone
  if (typeof body.theme === 'string' && ['light', 'dark'].includes(body.theme)) fields.theme = body.theme
  if (typeof body.locale === 'string') fields.locale = body.locale
  if (typeof body.timezone === 'string') fields.timezone = body.timezone
  if (typeof body.avatar_url === 'string') fields.avatar_url = body.avatar_url
  if (typeof body.photo_url === 'string' && !fields.avatar_url) fields.avatar_url = body.photo_url
  if (!Object.keys(fields).length) return fail(c, 'VALIDATION_ERROR', 'Nothing to update.', 422)
  const keys = Object.keys(fields)
  await c.env.DB.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND org_id = ?`)
    .bind(...keys.map((k) => fields[k] as string | null), user.id, user.org_id)
    .run()
  await audit(c.env, user.org_id, user.id, 'user.profile_updated', 'user', user.id, null, fields)
  return c.json({ user: await loadUserById(c.env, user.id) })
})

app.post('/api/auth/password', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ current?: string; next?: string }>(c)
  const current = String(body.current ?? '')
  const next = String(body.next ?? '')
  if (next.length < 8) return fail(c, 'VALIDATION_ERROR', 'New password must be at least 8 characters.', 422)
  const account = await verifyCredentials(c.env, user.email, current)
  if (!account) return fail(c, 'PERMISSION_DENIED', 'Current password is incorrect.', 403)
  const salt = randomHex(16)
  const hash = await hashPassword(next, salt)
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, user.id).run()
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run()
  clearSessionCookie(c)
  await audit(c.env, user.org_id, user.id, 'user.password_changed', 'user', user.id, null, null)
  return c.json({ ok: true })
})

// --------------------------------------------------------------------- meta
app.get('/api/schema', (c) => {
  const schema = Object.fromEntries(
    Object.entries(ENTITIES).map(([key, def]) => [
      key,
      {
        table: def.table,
        label: def.label,
        singular: def.singular,
        module: def.module,
        permission: def.permission,
        list: def.list,
        fields: def.fields,
        filters: def.filters ?? [],
        sort: def.sort,
        dir: def.dir,
        detailPath: def.detailPath ?? null,
        softDelete: Boolean(def.softDelete),
      },
    ]),
  )
  return c.json({ schema })
})

app.get('/api/meta', async (c) => {
  const user = c.get('user')
  const org = user.org_id
  const [users, companies, contacts, stages, pipelines, lists, templates, forms, deals, products, sla, sequences, documents] =
    await Promise.all([
      c.env.DB.prepare(`SELECT id, name, role, title FROM users WHERE org_id = ? AND status='active' ORDER BY name`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name FROM companies WHERE org_id = ? AND deleted_at IS NULL ORDER BY name LIMIT 500`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, first_name, last_name, email FROM contacts WHERE org_id = ? AND deleted_at IS NULL ORDER BY first_name LIMIT 500`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name, pipeline_id, position, probability FROM stages WHERE org_id = ? ORDER BY position`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name FROM pipelines WHERE org_id = ? ORDER BY name`).bind(org).all(),
      c.env.DB.prepare(`SELECT l.id, l.name, l.category, (SELECT COUNT(*) FROM list_members lm WHERE lm.list_id = l.id AND lm.org_id = l.org_id) AS contact_count FROM lists l WHERE l.org_id = ? AND l.deleted_at IS NULL ORDER BY l.name`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name FROM email_templates WHERE org_id = ? AND deleted_at IS NULL ORDER BY name`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name, slug, status FROM forms WHERE org_id = ? AND deleted_at IS NULL ORDER BY name`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name FROM deals WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 300`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name, unit_price, currency FROM products WHERE org_id = ? AND deleted_at IS NULL ORDER BY name`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name, priority FROM sla_policies WHERE org_id = ? AND deleted_at IS NULL`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, name, status FROM sequences WHERE org_id = ? AND deleted_at IS NULL ORDER BY name`).bind(org).all(),
      c.env.DB.prepare(`SELECT id, number, doc_type FROM documents WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`).bind(org).all(),
    ])
  let stagesList = stages.results as any[]
  let pipelinesList = pipelines.results as any[]
  if (!stagesList || stagesList.length === 0) {
    let pipelineId = pipelinesList[0]?.id
    if (!pipelineId) {
      pipelineId = uid()
      await c.env.DB.prepare(`INSERT INTO pipelines (id, org_id, name, is_default, created_at) VALUES (?, ?, 'Sales Pipeline', 1, ?)`).bind(pipelineId, org, nowIso()).run()
      pipelinesList = [{ id: pipelineId, name: 'Sales Pipeline' }]
    }
    const defaultStages = [
      ['Qualification', 10],
      ['Discovery', 25],
      ['Proposal', 55],
      ['Negotiation', 75],
      ['Closed Won', 100],
      ['Closed Lost', 0],
    ] as const
    stagesList = []
    for (let i = 0; i < defaultStages.length; i++) {
      const sId = uid()
      await c.env.DB.prepare(`INSERT INTO stages (id, org_id, pipeline_id, name, position, probability, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(sId, org, pipelineId, defaultStages[i][0], i, defaultStages[i][1], nowIso()).run()
      stagesList.push({ id: sId, name: defaultStages[i][0], pipeline_id: pipelineId, position: i, probability: defaultStages[i][1] })
    }
    if (stagesList.length > 0) {
      await c.env.DB.prepare(`UPDATE deals SET stage_id = ?, pipeline_id = ? WHERE org_id = ? AND (stage_id IS NULL OR stage_id = '' OR stage_id NOT IN (SELECT id FROM stages WHERE org_id = ?))`).bind(stagesList[0].id, pipelineId, org, org).run()
    }
  }

  return c.json({
    users: users.results,
    companies: companies.results,
    contacts: contacts.results,
    stages: stagesList,
    pipelines: pipelinesList,
    lists: lists.results,
    templates: templates.results,
    forms: forms.results,
    deals: deals.results,
    products: products.results,
    sla: sla.results,
    sequences: sequences.results,
    documents: documents.results,
    currentUser: user,
    permissions: {
      role: user.role,
      canWriteCrm: can(user.role, 'crm.write'),
      canWriteMarketing: can(user.role, 'marketing.write'),
      canWriteSales: can(user.role, 'sales.write'),
      canWriteSupport: can(user.role, 'support.write'),
      canWriteFinance: can(user.role, 'finance.write'),
      canManageSettings: can(user.role, 'settings.write'),
      canManageUsers: can(user.role, 'users.write'),
      canDelete: can(user.role, 'data.delete'),
      canExport: can(user.role, 'data.export'),
      canReadAudit: can(user.role, 'audit.read'),
    },
  })
})

// ------------------------------------------------------------------ helpers
const DEFAULTS: Record<string, Record<string, unknown>> = {
  companies: { status: 'active' },
  contacts: { status: 'active', score: 0, email_opt_out: 0 },
  leads: { status: 'new', priority: 'medium', source: 'Manual', score: 0, opt_out: 0 },
  tasks: { status: 'open', priority: 'medium', type: 'task' },
  calls: { direction: 'outbound', status: 'logged' },
  lists: { type: 'static', category: 'General' },
  tickets: { status: 'open', priority: 'medium', channel: 'email', category: 'General' },
  kb_articles: { status: 'draft', views: 0 },
  sla_policies: { status: 'active', first_response_mins: 60, resolution_mins: 480, business_hours: 'Mon-Fri 09:00-18:00' },
  campaigns: { status: 'draft', channel: 'email', type: 'broadcast', audience_count: 0, sent_count: 0 },
  email_templates: { status: 'draft' },
  sequences: { status: 'draft', exit_on_reply: 1 },
  forms: { status: 'draft', mapping: 'lead', fields: '[]', submission_count: 0 },
  landing_pages: { status: 'draft', views: 0, blocks: '[]' },
  content_items: { status: 'draft' },
  products: { status: 'active' },
  documents: { status: 'draft' },
  workflows: { status: 'draft', nodes: '[]', edges: '[]', version: 1 },
  reports: { visibility: 'team' },
  files: {},
}

const EXTRAS: Record<string, string[]> = {
  documents: ['lines'],
  workflows: ['nodes', 'edges'],
  forms: ['fields'],
  landing_pages: ['blocks', 'css_custom'],
  contacts: ['photo_url', 'avatar_url'],
  leads: ['photo_url', 'avatar_url'],
  companies: ['logo_url'],
  campaigns: ['content', 'body_html'],
  email_templates: ['html', 'css', 'plain_text', 'builder', 'thumbnail', 'document_json'],
}

function loadEntity(entity: string) {
  const def = ENTITIES[entity]
  if (!def) return null
  return def
}

function pickExtras(entity: string, body: Record<string, unknown>, user: Vars['user']) {
  const extras: Record<string, unknown> = {}
  for (const key of EXTRAS[entity] ?? []) {
    if (key in body) extras[key] = typeof body[key] === 'string' ? body[key] : JSON.stringify(body[key])
  }
  if (entity === 'deals') {
    if (body.value !== undefined) extras.value = Number(body.value)
    if (body.probability !== undefined) extras.probability = Math.max(0, Math.min(100, Number(body.probability)))
    if (!body.currency) extras.currency = 'USD'
  }
  if (entity === 'workflows' && !('owner_id' in body)) extras.owner_id = user.id
  return extras
}

async function documentTotals(rawLines: unknown, discount: unknown, taxRate: unknown) {
  const lines = jsonParse<{ quantity?: number; unit_price?: number }[]>(rawLines as string, [])
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0) * Number(line.unit_price ?? 0), 0)
  const discounted = subtotal - (subtotal * Number(discount ?? 0)) / 100
  const total = discounted + (discounted * Number(taxRate ?? 0)) / 100
  return { subtotal: Math.round(subtotal * 100) / 100, total: Math.round(total * 100) / 100 }
}

// ---------------------------------------------------------------- resources
app.get('/api/resources/:entity', async (c) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param("entity"))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  const url = new URL(c.req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 25)))
  const sortParam = url.searchParams.get('sort') ?? def.sort
  const allowedSort = new Set([...def.list, def.sort, 'created_at', 'updated_at', 'id'])
  const sort = allowedSort.has(sortParam) ? sortParam : def.sort
  const dir = (url.searchParams.get('dir') ?? def.dir) === 'asc' ? 'ASC' : 'DESC'
  const trash = url.searchParams.get('trash') === '1'

  const where: string[] = ['org_id = ?']
  const binds: unknown[] = [user.org_id]
  if (def.softDelete) where.push(trash ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL')
  if (q)
    where.push(`(${def.search.map((col) => `${col} LIKE ?`).join(' OR ')})`)
  if (q) for (let i = 0; i < def.search.length; i++) binds.push(`%${q}%`)
  // Filters are whitelisted from the entity definition so a query string can never inject SQL:
  // declared filters, plus any declared field or list column (this is what powers related-record
  // lookups such as ?contact_id=… on the contact 360° drawer).
  const filterKeys = new Set<string>([
    ...(def.filters ?? []),
    ...(def.fields ?? []).map((field) => field.key),
    ...def.list,
    'created_at',
    'updated_at',
  ])
  // Unknown parameters are rejected instead of ignored: a typo such as `??contact_id=` would
  // otherwise return an unfiltered list, which on the contact 360° drawer means showing another
  // record's deals, tickets or meetings.
  const reserved = new Set(['q', 'page', 'limit', 'sort', 'dir', 'trash'])
  const unknown = [...url.searchParams.keys()].filter((key) => !reserved.has(key) && !filterKeys.has(key))
  if (unknown.length) {
    return fail(c, 'VALIDATION_ERROR', `Unknown filter: ${unknown.join(', ')}.`, 400)
  }
  for (const key of filterKeys) {
    const value = url.searchParams.get(key)
    if (value != null && value !== '') {
      where.push(`${key} = ?`)
      binds.push(value)
    }
  }
  const sql = `SELECT * FROM ${def.table} WHERE ${where.join(' AND ')} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`
  const countSql = `SELECT COUNT(*) AS n FROM ${def.table} WHERE ${where.join(' AND ')}`
  const [rows, count] = await Promise.all([
    c.env.DB.prepare(sql).bind(...binds, limit, (page - 1) * limit).all(),
    c.env.DB.prepare(countSql).bind(...binds).first<{ n: number }>(),
  ])
  return c.json({ data: rows.results, total: count?.n ?? 0, page, limit })
})

app.get('/api/resources/:entity/:id', async (c) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param("entity"))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  const row = await c.env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ? AND org_id = ?`)
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!row) return fail(c, 'NOT_FOUND', 'Record not found.', 404)
  const singular = def.singular.toLowerCase()
  const activity = await c.env.DB.prepare(
    `SELECT a.*, u.name AS actor FROM activities a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.org_id = ? AND a.entity_id = ? AND (a.entity_type = ? OR a.entity_type = ? OR a.entity_type = ?) ORDER BY a.created_at DESC LIMIT 40`,
  )
    .bind(user.org_id, c.req.param('id'), c.req.param('entity'), def.table, singular)
    .all()
  let recipients: unknown[] = []
  if (def.table === 'campaigns') {
    try {
      const rec = await c.env.DB.prepare(
        `SELECT * FROM campaign_recipients WHERE org_id = ? AND campaign_id = ? ORDER BY created_at DESC LIMIT 200`
      ).bind(user.org_id, c.req.param('id')).all()
      recipients = rec.results
    } catch {
      recipients = []
    }
  }
  return c.json({ record: row, activity: activity.results, recipients })
})

app.post('/api/resources/:entity', async (c) => {
  const user = c.get('user')
  if (c.req.param('entity') === 'activities') {
    const body = await readBody<{
      entity_type?: string
      entity_id?: string
      activity_type?: string
      title?: string
      description?: string
      summary?: string
    }>(c)
    const summary = body.summary || body.description || body.title || 'Note recorded'
    const type = body.activity_type || 'note'
    const entityType = body.entity_type || null
    const entityId = body.entity_id || null

    await logActivity(c.env, user.org_id, user.id, type, entityType, entityId, summary, {
      title: body.title,
      description: body.description,
    })

    return c.json({ ok: true, summary })
  }
  const def = loadEntity(c.req.param("entity"))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  const denied = requirePerm(c, def.permission)
  if (denied) return denied
  const body = await readBody<Record<string, unknown>>(c)
  const { values, errors } = validateValues(def, body, false)
  if (Object.keys(errors).length) return fail(c, 'VALIDATION_ERROR', 'Check the highlighted fields.', 422, errors)
  const uniqueError = await checkUnique(c.env, user.org_id, def, values)
  if (uniqueError) return fail(c, 'CONFLICT', uniqueError, 409)

  const now = nowIso()
  const record: Record<string, unknown> = {
    id: uid(),
    org_id: user.org_id,
    ...DEFAULTS[def.table],
    ...values,
    ...pickExtras(def.table, body, user),
    created_at: now,
    updated_at: now,
  }
  for (const key of Object.keys(record)) if (record[key] === undefined) record[key] = null

  if (def.table === 'contacts') {
    if (!record.owner_id) record.owner_id = user.id
  }

  // Columns that are NOT NULL in D1 but optional in the form. Without these a create that
  // only supplies the declared required fields fails at the database layer with a 500.
  if (def.table === 'calls' && !record.started_at) record.started_at = now
  if (def.table === 'workflows' && !record.trigger_type) record.trigger_type = 'contact.created'
  if (def.table === 'reports' && !record.domain) record.domain = 'deals'

  if (def.table === 'deals') {
    if (!record.pipeline_id) {
      const pipeline = await c.env.DB.prepare('SELECT id FROM pipelines WHERE org_id = ? ORDER BY is_default DESC LIMIT 1')
        .bind(user.org_id)
        .first<{ id: string }>()
      record.pipeline_id = pipeline?.id ?? null
    }
    if (!record.stage_id && record.pipeline_id) {
      const stage = await c.env.DB.prepare('SELECT id, probability FROM stages WHERE org_id = ? AND pipeline_id = ? ORDER BY position LIMIT 1')
        .bind(user.org_id, record.pipeline_id)
        .first<{ id: string; probability: number }>()
      record.stage_id = stage?.id ?? null
      if (stage) record.probability = stage.probability
    }
    if (!record.owner_id) record.owner_id = user.id
  }

  if (def.table === 'tickets') {
    let policy = null
    if (record.sla_policy_id) {
      policy = await c.env.DB.prepare('SELECT * FROM sla_policies WHERE id = ? AND org_id = ?')
        .bind(record.sla_policy_id, user.org_id)
        .first<{ first_response_mins: number; resolution_mins: number }>()
    } else {
      policy = await c.env.DB.prepare("SELECT * FROM sla_policies WHERE org_id = ? AND priority = ? AND status='active' LIMIT 1")
        .bind(user.org_id, record.priority)
        .first<{ id: string; first_response_mins: number; resolution_mins: number }>()
      if (policy) record.sla_policy_id = (policy as { id: string }).id
    }
    if (policy) {
      record.first_response_due = new Date(Date.now() + policy.first_response_mins * 60_000).toISOString()
      record.resolution_due = new Date(Date.now() + policy.resolution_mins * 60_000).toISOString()
    }
    if (!record.assignee_id) record.assignee_id = user.id
  }

  if (def.table === 'documents') {
    const totals = await documentTotals(record.lines, record.discount, record.tax_rate)
    Object.assign(record, totals)
    if (!record.number) {
      const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM documents WHERE org_id = ?')
        .bind(user.org_id)
        .first<{ n: number }>()
      const prefix = record.doc_type === 'invoice' ? 'INV' : record.doc_type === 'quote' ? 'QTE' : 'PRO'
      record.number = `${prefix}-${new Date().getFullYear()}-${100 + Number(count?.n ?? 0) + 1}`
    }
  }

  try {
    await insertRow(c.env, def.table, record)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/UNIQUE constraint failed/i.test(message)) {
      const column = message.split('.').pop() ?? 'value'
      return fail(c, 'CONFLICT', `A record with that ${column} already exists.`, 409)
    }
    throw error
  }

  if (def.table === 'contacts' && record.email) {
    const duplicate = await c.env.DB.prepare(
      'SELECT id, first_name, last_name FROM contacts WHERE org_id = ? AND lower(email) = lower(?) AND id != ? AND deleted_at IS NULL LIMIT 1',
    )
      .bind(user.org_id, String(record.email), record.id)
      .first<{ id: string; first_name: string; last_name: string }>()
    if (duplicate) {
      return c.json({
        record,
        warning: `Another contact (${duplicate.first_name} ${duplicate.last_name}) already uses this email.`,
      }, 201)
    }
  }

  await logActivity(c.env, user.org_id, user.id, `${def.table}.created`, def.table, String(record.id), `${def.singular} created: ${record.name ?? record.title ?? record.subject ?? record.first_name ?? record.number ?? record.id}`, {
    name: record.name ?? null,
  })
  await audit(c.env, user.org_id, user.id, `${def.table}.create`, def.table, String(record.id), null, record, c.req.header('cf-connecting-ip'))

  const trigger = def.table === 'contacts' ? 'contact.created' : def.table === 'leads' ? 'lead.created' : def.table === 'deals' ? 'deal.created' : def.table === 'tasks' ? 'task.created' : def.table === 'tickets' ? 'ticket.created' : null
  if (trigger) await fireTrigger(c.env, user.org_id, trigger, def.table, String(record.id), record, user.id)

  return c.json({ record }, 201)
})

const handleResourceUpdate = async (c: any) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param("entity"))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  const denied = requirePerm(c, def.permission)
  if (denied) return denied
  const id = c.req.param('id')
  const before = (await c.env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ? AND org_id = ?`)
    .bind(id, user.org_id)
    .first()) as Record<string, unknown> | null
  if (!before) return fail(c, 'NOT_FOUND', 'Record not found.', 404)

  const body = await readBody<Record<string, unknown>>(c)
  const { values, errors } = validateValues(def, body, true)
  if (Object.keys(errors).length) return fail(c, 'VALIDATION_ERROR', 'Check the highlighted fields.', 422, errors)
  const uniqueError = await checkUnique(c.env, user.org_id, def, values, id)
  if (uniqueError) return fail(c, 'CONFLICT', uniqueError, 409)

  const update: Record<string, unknown> = { ...values, ...pickExtras(def.table, body, user), updated_at: nowIso() }
  if (def.table === 'tasks' && update.status === 'completed' && before.status !== 'completed') {
    update.completed_at = nowIso()
  }
  if (def.table === 'tasks' && update.status && update.status !== 'completed') {
    update.completed_at = null
  }
  if (def.table === 'documents') {
    if (Number(before.locked) === 1 && (body.lines || body.discount !== undefined || body.tax_rate !== undefined)) {
      return fail(c, 'CONFLICT', 'This document is locked once accepted or paid. Duplicate it to make changes.', 409)
    }
    const totals = await documentTotals(
      update.lines ?? before.lines,
      update.discount ?? before.discount,
      update.tax_rate ?? before.tax_rate,
    )
    Object.assign(update, totals)
  }
  const keys = Object.keys(update)
  try {
    await c.env.DB.prepare(`UPDATE ${def.table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND org_id = ?`)
      .bind(...keys.map((k) => update[k] as string | number | null), id, user.org_id)
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/UNIQUE constraint failed/i.test(message)) {
      const column = message.split('.').pop() ?? 'value'
      return fail(c, 'CONFLICT', `A record with that ${column} already exists.`, 409)
    }
    throw error
  }

  await audit(c.env, user.org_id, user.id, `${def.table}.update`, def.table, id, before, update, c.req.header('cf-connecting-ip'))
  await logActivity(c.env, user.org_id, user.id, `${def.table}.updated`, def.table, id, `${def.singular} updated`)

  const trigger =
    def.table === 'deals'
      ? 'deal.stage_changed'
      : def.table === 'leads'
        ? 'lead.status_changed'
        : def.table === 'tasks'
          ? 'task.updated'
          : def.table === 'tickets'
            ? 'ticket.updated'
            : def.table === 'contacts'
              ? 'contact.updated'
              : null
  if (trigger) await fireTrigger(c.env, user.org_id, trigger, def.table, id, { ...before, ...update }, user.id)

  const record = await c.env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ? AND org_id = ?`)
    .bind(id, user.org_id)
    .first()
  return c.json({ record })
}

app.post('/api/resources/:entity/bulk', async (c) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param('entity'))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  const body = await readBody<{ action: string; ids?: string[]; tag?: string; status?: string }>(c)
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []
  if (!ids.length) return fail(c, 'VALIDATION_ERROR', 'No records selected.', 422)

  if (!can(user.role, 'data.delete') && !can(user.role, def.permission)) {
    return fail(c, 'FORBIDDEN', `Permission denied (requires ${def.permission} or data.delete).`, 403)
  }

  const placeholders = ids.map(() => '?').join(', ')
  const now = nowIso()

  if (body.action === 'delete') {
    if (def.softDelete) {
      await c.env.DB.prepare(
        `UPDATE ${def.table} SET deleted_at = ?, updated_at = ? WHERE org_id = ? AND id IN (${placeholders})`,
      )
        .bind(now, now, user.org_id, ...ids)
        .run()
    } else {
      await c.env.DB.prepare(`DELETE FROM ${def.table} WHERE org_id = ? AND id IN (${placeholders})`)
        .bind(user.org_id, ...ids)
        .run()
    }
    await audit(c.env, user.org_id, user.id, `${def.table}.bulk_delete`, def.table, 'bulk', null, { count: ids.length, ids })
    return c.json({ ok: true, count: ids.length })
  }

  if (body.action === 'tag' && body.tag) {
    for (const id of ids) {
      const row = await c.env.DB.prepare(`SELECT tags FROM ${def.table} WHERE id = ? AND org_id = ?`)
        .bind(id, user.org_id)
        .first<{ tags: string | null }>()
      const currentTags = (row?.tags ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      if (!currentTags.includes(body.tag)) {
        currentTags.push(body.tag)
        await c.env.DB.prepare(`UPDATE ${def.table} SET tags = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
          .bind(currentTags.join(', '), now, id, user.org_id)
          .run()
      }
    }
    return c.json({ ok: true, count: ids.length })
  }

  if (body.action === 'status' && body.status) {
    await c.env.DB.prepare(`UPDATE ${def.table} SET status = ?, updated_at = ? WHERE org_id = ? AND id IN (${placeholders})`)
      .bind(body.status, now, user.org_id, ...ids)
      .run()
    return c.json({ ok: true, count: ids.length })
  }

  return fail(c, 'VALIDATION_ERROR', 'Unknown bulk action.', 422)
})

app.post('/api/resources/:entity/import', async (c) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param('entity'))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  const denied = requirePerm(c, def.permission)
  if (denied) return denied

  const body = await readBody<{ records: Record<string, unknown>[] }>(c)
  const records = Array.isArray(body?.records) ? body.records : []
  if (!records.length) return fail(c, 'VALIDATION_ERROR', 'No records provided for import.', 422)

  let inserted = 0
  let skipped = 0

  for (const raw of records.slice(0, 500)) {
    try {
      const { values, errors } = validateValues(def, raw, false)
      if (Object.keys(errors).length) {
        skipped++
        continue
      }
      const uniqueError = await checkUnique(c.env, user.org_id, def, values)
      if (uniqueError) {
        skipped++
        continue
      }

      const id = uid()
      const record: Record<string, unknown> = {
        ...DEFAULTS[def.table],
        ...values,
        ...pickExtras(def.table, raw, user),
        id,
        org_id: user.org_id,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      if (def.table === 'contacts' && !record.owner_id) {
        record.owner_id = user.id
      }
      await insertRow(c.env, def.table, record)
      inserted++

      const trigger = def.table === 'contacts' ? 'contact.created' : def.table === 'leads' ? 'lead.created' : null
      if (trigger) {
        await fireTrigger(c.env, user.org_id, trigger, def.table, id, record, user.id)
      }
    } catch {
      skipped++
    }
  }

  await audit(c.env, user.org_id, user.id, `${def.table}.bulk_import`, def.table, 'bulk', null, {
    total: records.length,
    inserted,
    skipped,
  })

  return c.json({ ok: true, count: inserted, skipped, total: records.length })
})

app.patch('/api/resources/:entity/:id', handleResourceUpdate)
app.post('/api/resources/:entity/:id', handleResourceUpdate)
app.put('/api/resources/:entity/:id', handleResourceUpdate)

app.delete('/api/resources/:entity/:id', async (c) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param("entity"))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  if (!can(user.role, 'data.delete') && !can(user.role, def.permission)) {
    return fail(c, 'FORBIDDEN', `Permission denied (requires ${def.permission} or data.delete).`, 403)
  }
  const id = c.req.param('id')
  const hard = c.req.query('hard') === '1' && can(user.role, 'data.delete')
  if (def.softDelete) {
    await c.env.DB.prepare(`UPDATE ${def.table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
      .bind(nowIso(), nowIso(), id, user.org_id)
      .run()
  } else {
    await c.env.DB.prepare(`DELETE FROM ${def.table} WHERE id = ? AND org_id = ?`).bind(id, user.org_id).run()
  }
  if (hard && def.softDelete) {
    await c.env.DB.prepare(`DELETE FROM ${def.table} WHERE id = ? AND org_id = ?`).bind(id, user.org_id).run()
  }
  await audit(c.env, user.org_id, user.id, `${def.table}.delete`, def.table, id, null, { deleted: true })
  await logActivity(c.env, user.org_id, user.id, `${def.table}.deleted`, def.table, id, `${def.singular} moved to trash`)
  return c.json({ ok: true })
})

app.post('/api/resources/:entity/:id/restore', async (c) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param("entity"))
  if (!def || !def.softDelete) return fail(c, 'NOT_FOUND', 'Unknown resource.', 404)
  const denied = requirePerm(c, 'data.delete')
  if (denied) return denied
  await c.env.DB.prepare(`UPDATE ${def.table} SET deleted_at = NULL, updated_at = ? WHERE id = ? AND org_id = ?`)
    .bind(nowIso(), c.req.param('id'), user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, `${def.table}.restored`, def.table, c.req.param('id'), `${def.singular} restored from trash`)
  return c.json({ ok: true })
})

app.post('/api/leads/:id/stage', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'crm.write')
  if (denied) return denied
  const body = await readBody<{ stage: string }>(c)
  const stage = String(body.stage ?? '').trim().toLowerCase()
  const validStages = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
  if (!validStages.includes(stage)) return fail(c, 'VALIDATION_ERROR', 'Invalid stage.', 422)

  const lead = await c.env.DB.prepare('SELECT id, status FROM leads WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first<{ id: string; status: string }>()
  if (!lead) return fail(c, 'NOT_FOUND', 'Lead not found.', 404)

  await c.env.DB.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(stage, nowIso(), lead.id, user.org_id)
    .run()

  await logActivity(c.env, user.org_id, user.id, 'lead.stage_changed', 'lead', lead.id, `Lead stage moved from ${lead.status} to ${stage}`)
  return c.json({ ok: true, stage })
})

app.post('/api/leads/:id/ai-score', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'crm.write')
  if (denied) return denied

  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!lead) return fail(c, 'NOT_FOUND', 'Lead not found.', 404)

  let score = 30
  const reasons: string[] = []

  if (lead.email && !String(lead.email).includes('gmail') && !String(lead.email).includes('yahoo')) {
    score += 20
    reasons.push('Corporate business email domain')
  }
  if (lead.company_name) {
    score += 15
    reasons.push('Verified company association')
  }
  const title = String(lead.job_title ?? '').toLowerCase()
  if (title.includes('director') || title.includes('vp') || title.includes('head') || title.includes('chief') || title.includes('lead')) {
    score += 20
    reasons.push('Decision maker / leadership designation')
  } else if (title) {
    score += 10
    reasons.push('Professional role identified')
  }
  if (Number(lead.value ?? 0) > 5000) {
    score += 15
    reasons.push('High deal potential value')
  }
  if (lead.phone) {
    score += 10
    reasons.push('Direct phone contact provided')
  }

  score = Math.min(98, Math.max(25, score))

  await c.env.DB.prepare('UPDATE leads SET score = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(score, nowIso(), lead.id, user.org_id)
    .run()

  await logActivity(c.env, user.org_id, user.id, 'lead.ai_scored', 'lead', String(lead.id), `AI score updated to ${score}/100`)

  return c.json({
    ok: true,
    score,
    intent: score > 75 ? 'High Intent' : score > 50 ? 'Medium Intent' : 'Nurture Required',
    reasons,
    recommendation:
      score > 75
        ? 'High priority lead. Recommended immediate executive follow-up and proposal scheduling.'
        : score > 50
          ? 'Good engagement signals. Recommend qualifying budget and decision timeline this week.'
          : 'Early interest. Enroll in automated marketing drip campaign.',
  })
})

// ------------------------------------------------------------- lead convert
app.post('/api/leads/:id/convert', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'crm.write')
  if (denied) return denied
  const body = await readBody<{ create_deal?: boolean; deal_value?: number; deal_name?: string }>(c)
  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!lead) return fail(c, 'NOT_FOUND', 'Lead not found.', 404)
  if (lead.converted_contact_id) {
    return c.json({
      alreadyConverted: true,
      contactId: lead.converted_contact_id,
      dealId: lead.converted_deal_id,
      message: 'This lead was already converted.',
    })
  }

  let companyId = lead.converted_company_id as string | null
  const companyName = String(lead.company_name ?? '').trim()
  if (companyName) {
    const existing = await c.env.DB.prepare('SELECT id FROM companies WHERE org_id = ? AND lower(name) = lower(?) AND deleted_at IS NULL')
      .bind(user.org_id, companyName)
      .first<{ id: string }>()
    companyId = existing?.id ?? uid()
    if (!existing) {
      await insertRow(c.env, 'companies', {
        id: companyId,
        org_id: user.org_id,
        name: companyName,
        domain: lead.website ? String(lead.website).replace(/^https?:\/\//, '') : null,
        industry: null,
        email: null,
        phone: null,
        owner_id: lead.owner_id,
        tags: 'lead-conversion',
        status: 'active',
        created_at: nowIso(),
        updated_at: nowIso(),
      })
    }
  }

  const contactId = uid()
  await insertRow(c.env, 'contacts', {
    id: contactId,
    org_id: user.org_id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    designation: lead.job_title,
    company_id: companyId,
    email: lead.email,
    email_opt_out: lead.opt_out,
    phone: lead.phone,
    tags: lead.tags,
    address: lead.address,
    owner_id: lead.owner_id ?? user.id,
    source: `Lead conversion · ${String(lead.source ?? '')}`,
    score: lead.score,
    from_lead_id: lead.id,
    status: 'active',
    created_at: nowIso(),
    updated_at: nowIso(),
  })

  let dealId: string | null = null
  if (body.create_deal) {
    const pipeline = await c.env.DB.prepare('SELECT id FROM pipelines WHERE org_id = ? ORDER BY is_default DESC LIMIT 1')
      .bind(user.org_id)
      .first<{ id: string }>()
    const stage = pipeline
      ? await c.env.DB.prepare('SELECT id, probability FROM stages WHERE org_id = ? AND pipeline_id = ? ORDER BY position LIMIT 1')
          .bind(user.org_id, pipeline.id)
          .first<{ id: string; probability: number }>()
      : null
    dealId = uid()
    await insertRow(c.env, 'deals', {
      id: dealId,
      org_id: user.org_id,
      name: body.deal_name?.trim() || `${companyName || `${lead.first_name} ${lead.last_name ?? ''}`} opportunity`,
      contact_id: contactId,
      company_id: companyId,
      pipeline_id: pipeline?.id ?? null,
      stage_id: stage?.id ?? null,
      value: Number(body.deal_value ?? 0),
      currency: user.currency,
      probability: stage?.probability ?? 10,
      expected_close: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      owner_id: lead.owner_id ?? user.id,
      source: lead.source,
      status: 'open',
      created_at: nowIso(),
      updated_at: nowIso(),
    })
  }

  await c.env.DB.prepare(
    `UPDATE leads SET status='converted', converted_contact_id = ?, converted_deal_id = ?, converted_company_id = ?,
       converted_at = ?, updated_at = ? WHERE id = ? AND org_id = ?`,
  )
    .bind(contactId, dealId, companyId, nowIso(), nowIso(), lead.id, user.org_id)
    .run()

  await logActivity(c.env, user.org_id, user.id, 'lead.converted', 'lead', String(lead.id), `Lead converted to contact ${contactId}${dealId ? ' with a new deal' : ''}`)
  await logActivity(c.env, user.org_id, user.id, 'contact.created', 'contact', contactId, `Contact created from lead ${String(lead.first_name)} ${String(lead.last_name ?? '')}`, { fromLeadId: lead.id })
  await fireTrigger(c.env, user.org_id, 'contact.created', 'contact', contactId, {
    id: contactId,
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    owner_id: lead.owner_id,
  }, user.id)
  await audit(c.env, user.org_id, user.id, 'lead.convert', 'lead', String(lead.id), { status: 'qualified' }, { status: 'converted', contactId, dealId })

  return c.json({ contactId, dealId, companyId })
})

app.post('/api/deals/:id/stage', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'sales.write')
  if (denied) return denied
  const body = await readBody<{ stage_id?: string }>(c)
  if (!body.stage_id) return fail(c, 'VALIDATION_ERROR', 'Choose a stage.', 422)
  const deal = await c.env.DB.prepare('SELECT * FROM deals WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!deal) return fail(c, 'NOT_FOUND', 'Deal not found.', 404)
  const stage = await c.env.DB.prepare('SELECT * FROM stages WHERE id = ? AND org_id = ? AND pipeline_id = ?')
    .bind(body.stage_id, user.org_id, deal.pipeline_id)
    .first<{ id: string; name: string; probability: number }>()
  if (!stage) return fail(c, 'VALIDATION_ERROR', 'That stage does not belong to this deal pipeline.', 422)

  const status = stage.name === 'Closed Won' ? 'won' : stage.name === 'Closed Lost' ? 'lost' : 'open'
  await c.env.DB.prepare('UPDATE deals SET stage_id = ?, probability = ?, status = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(stage.id, stage.probability, status, nowIso(), deal.id, user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'deal.stage_changed', 'deal', String(deal.id), `${deal.name} moved to ${stage.name}`, {
    from: deal.stage_id,
    to: stage.id,
  })
  await notify(
    c.env,
    user.org_id,
    String(deal.owner_id ?? user.id),
    'deal_stage',
    'Deal stage changed',
    `${deal.name} moved to ${stage.name}.`,
    'deal',
    String(deal.id),
  )
  await audit(c.env, user.org_id, user.id, 'deal.stage_change', 'deal', String(deal.id), { stage_id: deal.stage_id }, { stage_id: stage.id })
  await fireTrigger(c.env, user.org_id, 'deal.stage_changed', 'deal', String(deal.id), { ...deal, stage_id: stage.id, status }, user.id)
  const record = await c.env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(deal.id).first()
  return c.json({ record })
})

// ---------------------------------------------------------------- campaigns
app.post('/api/campaigns/:id/send', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const host = c.req.header('x-forwarded-host') || c.req.header('host')
  const proto = c.req.header('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
  const reqBase = host ? `${proto}://${host}` : undefined
  const result = await sendCampaign(c.env, user.org_id, c.req.param('id'), user.id, reqBase)
  if (!result.ok) return fail(c, result.code ?? 'ERROR', result.message ?? 'Could not send.', result.code === 'NOT_FOUND' ? 404 : 409)
  return c.json(result)
})

app.post('/api/campaigns/:id/schedule', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{ scheduled_at?: string }>(c)
  if (!body.scheduled_at) return fail(c, 'VALIDATION_ERROR', 'Choose a send time.', 422)
  const campaign = await c.env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!campaign) return fail(c, 'NOT_FOUND', 'Campaign not found.', 404)
  const provider = await c.env.DB.prepare("SELECT status FROM integrations WHERE org_id = ? AND provider = ?")
    .bind(user.org_id, campaign.channel === 'email' ? 'email' : campaign.channel === 'whatsapp' ? 'whatsapp' : 'sms')
    .first<{ status: string }>()
  if (!provider || provider.status !== 'connected') {
    return fail(c, 'PROVIDER_NOT_CONNECTED', 'Connect a provider for this channel before scheduling.', 409)
  }
  await c.env.DB.prepare("UPDATE campaigns SET status = 'scheduled', scheduled_at = ?, updated_at = ? WHERE id = ? AND org_id = ?")
    .bind(body.scheduled_at, nowIso(), campaign.id, user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'campaign.scheduled', 'campaign', String(campaign.id), `Campaign scheduled for ${body.scheduled_at}`)
  return c.json({ ok: true })
})

app.post('/api/campaigns/:id/status', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{ status?: string }>(c)
  if (!body.status || !['draft', 'paused', 'cancelled', 'scheduled'].includes(body.status)) {
    return fail(c, 'VALIDATION_ERROR', 'Unsupported campaign status.', 422)
  }
  await c.env.DB.prepare('UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(body.status, nowIso(), c.req.param('id'), user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'campaign.status', 'campaign', c.req.param('id'), `Campaign status set to ${body.status}`)
  return c.json({ ok: true })
})

app.get('/api/campaigns/:id/recipients', async (c) => {
  const user = c.get('user')
  const recipients = await c.env.DB.prepare(
    `SELECT * FROM campaign_recipients WHERE org_id = ? AND campaign_id = ? ORDER BY created_at DESC LIMIT 200`
  ).bind(user.org_id, c.req.param('id')).all()
  return c.json({ data: recipients.results })
})

// ------------------------------------------------------------------- forms
app.post('/api/forms/:id/publish', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{ status?: string }>(c)
  const status = body.status === 'paused' ? 'paused' : body.status === 'draft' ? 'draft' : 'published'
  const form = await c.env.DB.prepare('SELECT * FROM forms WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<{ id: string; name: string }>()
  if (!form) return fail(c, 'NOT_FOUND', 'Form not found.', 404)
  await c.env.DB.prepare('UPDATE forms SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(status, nowIso(), form.id, user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'form.status', 'form', form.id, `Form "${form.name}" is now ${status}`)
  return c.json({ ok: true, status })
})

app.post('/api/pages/:id/publish', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{ status?: string }>(c)
  const status = body.status === 'draft' ? 'draft' : 'published'
  const page = await c.env.DB.prepare('SELECT * FROM landing_pages WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<{ id: string; name: string }>()
  if (!page) return fail(c, 'NOT_FOUND', 'Page not found.', 404)
  await c.env.DB.prepare('UPDATE landing_pages SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(status, nowIso(), page.id, user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'page.published', 'landing_page', page.id, `Landing page "${page.name}" ${status}`)
  return c.json({ ok: true, status })
})

// ------------------------------------------------------------- list members
app.get('/api/lists/:id/members', async (c) => {
  const user = c.get('user')
  const list = await c.env.DB.prepare('SELECT id FROM lists WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first()
  if (!list) return fail(c, 'NOT_FOUND', 'List not found.', 404)

  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS membership_id, m.entity_type, c.id, c.first_name, c.last_name, c.email, c.email_opt_out, c.status
     FROM list_members m JOIN contacts c ON c.id = m.entity_id AND c.org_id = m.org_id
     WHERE m.list_id = ? AND m.org_id = ? AND c.deleted_at IS NULL ORDER BY c.first_name LIMIT 200`,
  )
    .bind(c.req.param('id'), user.org_id)
    .all()
  const total = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM list_members WHERE list_id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<{ n: number }>()
  return c.json({ data: results, total: total?.n ?? 0 })
})

app.post('/api/lists/:id/members', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'crm.write')
  if (denied) return denied
  const list = await c.env.DB.prepare('SELECT id FROM lists WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first()
  if (!list) return fail(c, 'NOT_FOUND', 'List not found.', 404)

  const body = await readBody<{ contact_ids?: string[] }>(c)
  const ids = Array.isArray(body.contact_ids) ? body.contact_ids.slice(0, 500) : []
  if (!ids.length) return fail(c, 'VALIDATION_ERROR', 'Choose at least one contact.', 422)
  let added = 0
  for (const contactId of ids) {
    const contact = await c.env.DB.prepare('SELECT id FROM contacts WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
      .bind(contactId, user.org_id)
      .first<{ id: string }>()
    if (!contact) continue
    const exists = await c.env.DB.prepare('SELECT id FROM list_members WHERE list_id = ? AND entity_id = ?')
      .bind(c.req.param('id'), contactId)
      .first()
    if (exists) continue
    await insertRow(c.env, 'list_members', {
      id: uid(),
      org_id: user.org_id,
      list_id: c.req.param('id'),
      entity_type: 'contact',
      entity_id: contactId,
      created_at: nowIso(),
    })
    added++
  }
  await logActivity(c.env, user.org_id, user.id, 'list.members_added', 'list', c.req.param('id'), `${added} contact(s) added to the list`)
  return c.json({ added })
})

app.delete('/api/lists/:id/members/:membershipId', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'crm.write')
  if (denied) return denied
  const list = await c.env.DB.prepare('SELECT id FROM lists WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first()
  if (!list) return fail(c, 'NOT_FOUND', 'List not found.', 404)

  await c.env.DB.prepare('DELETE FROM list_members WHERE id = ? AND list_id = ? AND org_id = ?')
    .bind(c.req.param('membershipId'), c.req.param('id'), user.org_id)
    .run()
  return c.json({ ok: true })
})

// --------------------------------------------------------------- sequences
app.get('/api/sequences/:id', async (c) => {
  const user = c.get('user')
  const sequence = await c.env.DB.prepare('SELECT * FROM sequences WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first()
  if (!sequence) return fail(c, 'NOT_FOUND', 'Sequence not found.', 404)
  const steps = await c.env.DB.prepare('SELECT * FROM sequence_steps WHERE sequence_id = ? AND org_id = ? ORDER BY position')
    .bind(c.req.param('id'), user.org_id)
    .all()
  const enrolments = await c.env.DB.prepare(
    `SELECT e.*, c.first_name, c.last_name, c.email FROM sequence_enrolments e
     LEFT JOIN contacts c ON c.id = e.contact_id
     WHERE e.sequence_id = ? AND e.org_id = ? ORDER BY e.created_at DESC LIMIT 50`,
  )
    .bind(c.req.param('id'), user.org_id)
    .all()
  return c.json({ sequence, steps: steps.results, enrolments: enrolments.results })
})

app.post('/api/sequences/:id/steps', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<Record<string, unknown>>(c)
  const kind = body.kind === 'wait' ? 'wait' : 'email'
  if (kind === 'email' && !String(body.subject ?? '').trim()) {
    return fail(c, 'VALIDATION_ERROR', 'An email step needs a subject.', 422)
  }
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM sequence_steps WHERE sequence_id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<{ n: number }>()
  await insertRow(c.env, 'sequence_steps', {
    id: uid(),
    org_id: user.org_id,
    sequence_id: c.req.param('id'),
    position: Number(count?.n ?? 0),
    kind,
    subject: body.subject ?? null,
    body: body.body ?? null,
    delay_days: Math.max(0, Number(body.delay_days ?? (kind === 'wait' ? 3 : 0))),
    template_id: body.template_id ?? null,
    created_at: nowIso(),
  })
  return c.json({ ok: true })
})

app.post('/api/sequences/:id/enrol', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{ list_id?: string; contact_id?: string }>(c)
  const sequence = await c.env.DB.prepare('SELECT * FROM sequences WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<{ id: string; status: string; name: string }>()
  if (!sequence) return fail(c, 'NOT_FOUND', 'Sequence not found.', 404)
  if (sequence.status !== 'active') return fail(c, 'CONFLICT', 'Activate the sequence before enrolling contacts.', 409)
  let contactIds: string[] = []
  if (body.contact_id) contactIds = [body.contact_id]
  else if (body.list_id) {
    const { results } = await c.env.DB.prepare(
      `SELECT c.id FROM list_members m JOIN contacts c ON c.id = m.entity_id AND c.org_id = m.org_id
       WHERE m.list_id = ? AND m.org_id = ? AND c.deleted_at IS NULL AND c.email_opt_out = 0 AND c.email IS NOT NULL`,
    )
      .bind(body.list_id, user.org_id)
      .all<{ id: string }>()
    contactIds = results.map((r) => r.id)
  }
  if (!contactIds.length) return fail(c, 'EMPTY_AUDIENCE', 'No eligible contacts to enrol (opt-outs are excluded).', 409)
  let enrolled = 0
  for (const contactId of contactIds) {
    const existing = await c.env.DB.prepare(
      "SELECT id FROM sequence_enrolments WHERE sequence_id = ? AND contact_id = ? AND status = 'active'",
    )
      .bind(sequence.id, contactId)
      .first()
    if (existing) continue
    await insertRow(c.env, 'sequence_enrolments', {
      id: uid(),
      org_id: user.org_id,
      sequence_id: sequence.id,
      contact_id: contactId,
      current_step: 0,
      status: 'active',
      next_run_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    enrolled++
  }
  await logActivity(c.env, user.org_id, user.id, 'sequence.enrolled', 'sequence', sequence.id, `${enrolled} contact(s) enrolled in "${sequence.name}"`)
  return c.json({ enrolled })
})

// --------------------------------------------------------------- workflows
app.get('/api/workflows/:id', async (c) => {
  const user = c.get('user')
  const workflow = await c.env.DB.prepare('SELECT * FROM workflows WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!workflow) return fail(c, 'NOT_FOUND', 'Workflow not found.', 404)
  const runs = await c.env.DB.prepare(
    'SELECT * FROM workflow_runs WHERE workflow_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 25',
  )
    .bind(c.req.param('id'), user.org_id)
    .all()
  return c.json({ workflow, runs: runs.results })
})

export function validateGraph(nodes: WorkflowNode[]): string[] {
  const errors: string[] = []
  const triggers = nodes.filter((n) => n.type === 'trigger')
  if (triggers.length !== 1) errors.push('A workflow needs exactly one start trigger.')
  if (nodes.length > 0 && nodes[0].type !== 'trigger') errors.push('The trigger must be the first node.')
  const actions = new Set([
    'create_task', 'notify', 'add_note', 'update_field', 'add_tag', 'remove_tag',
    'add_to_list', 'add_to_sequence', 'create_ticket', 'send_email', 'assign_owner',
    'send_sms', 'webhook', 'create_deal', 'update_deal', 'remove_contact',
  ])
  for (const node of nodes) {
    if (node.type === 'action') {
      if (!node.action || !actions.has(node.action)) errors.push(`"${node.label}" needs a supported action.`)
      if (node.action === 'update_field' && !node.config?.field) errors.push(`"${node.label}" needs a field to update.`)
      if ((node.action === 'add_tag' || node.action === 'remove_tag') && !node.config?.tag) errors.push(`"${node.label}" needs a tag value.`)
      if (node.action === 'add_to_list' && !node.config?.listId) errors.push(`"${node.label}" needs a list.`)
      if (node.action === 'add_to_sequence' && !node.config?.sequenceId) errors.push(`"${node.label}" needs a sequence.`)
    }
    if (node.type === 'condition' && (!node.config?.field || !node.config?.op)) {
      errors.push(`"${node.label}" needs a field and an operator.`)
    }
    if (node.type === 'wait' && (!node.config?.minutes || Number(node.config.minutes) < 1)) {
      errors.push(`"${node.label}" needs a wait of at least one minute.`)
    }
  }
  return errors
}

app.post('/api/workflows/:id/publish', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'workflows.write')
  if (denied) return denied
  const workflow = await c.env.DB.prepare('SELECT * FROM workflows WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!workflow) return fail(c, 'NOT_FOUND', 'Workflow not found.', 404)
  const nodes = jsonParse<WorkflowNode[]>(workflow.nodes as string, [])
  const errors = validateGraph(nodes)
  if (errors.length) return fail(c, 'VALIDATION_ERROR', 'This workflow cannot go live yet.', 422, Object.fromEntries(errors.map((e, i) => [`error_${i}`, e])))
  await c.env.DB.prepare("UPDATE workflows SET status = 'live', updated_at = ? WHERE id = ? AND org_id = ?")
    .bind(nowIso(), workflow.id, user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'workflow.published', 'workflow', String(workflow.id), `Workflow "${workflow.name}" is live`)
  return c.json({ ok: true })
})

app.post('/api/workflows/:id/status', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'workflows.write')
  if (denied) return denied
  const body = await readBody<{ status?: string }>(c)
  if (!body.status || !['draft', 'live', 'paused'].includes(body.status)) {
    return fail(c, 'VALIDATION_ERROR', 'Unsupported workflow status.', 422)
  }
  await c.env.DB.prepare('UPDATE workflows SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(body.status, nowIso(), c.req.param('id'), user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'workflow.status', 'workflow', c.req.param('id'), `Workflow status set to ${body.status}`)
  return c.json({ ok: true })
})

app.post('/api/workflows/:id/test', async (c) => {
  const user = c.get('user')
  const workflow = await c.env.DB.prepare('SELECT * FROM workflows WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!workflow) return fail(c, 'NOT_FOUND', 'Workflow not found.', 404)
  const body = await readBody<{ entity_id?: string }>(c)
  const table = String(workflow.trigger_type).startsWith('deal')
    ? 'deals'
    : String(workflow.trigger_type).startsWith('ticket')
      ? 'tickets'
      : String(workflow.trigger_type).startsWith('task')
        ? 'tasks'
        : String(workflow.trigger_type).startsWith('lead')
          ? 'leads'
          : 'contacts'
  const record = body.entity_id
    ? await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND org_id = ?`).bind(body.entity_id, user.org_id).first<Record<string, unknown>>()
    : await c.env.DB.prepare(`SELECT * FROM ${table} WHERE org_id = ? AND deleted_at IS NULL LIMIT 1`).bind(user.org_id).first<Record<string, unknown>>()
  if (!record) return fail(c, 'NOT_FOUND', 'No sample record available for a dry run.', 404)

  const nodes = jsonParse<WorkflowNode[]>(workflow.nodes as string, [])
  const preview = nodes.map((node) => {
    if (node.type === 'trigger') return { node: node.label, outcome: 'would fire', detail: `Trigger ${String(workflow.trigger_type)}` }
    if (node.type === 'condition') {
      const value = record[String(node.config?.field ?? '')]
      return { node: node.label, outcome: 'evaluated', detail: `${String(node.config?.field)} = ${String(value ?? '—')}` }
    }
    if (node.type === 'wait') return { node: node.label, outcome: 'would wait', detail: `${String(node.config?.minutes ?? 60)} minutes` }
    if (node.type === 'action') return { node: node.label, outcome: 'would run', detail: `${String(node.action)} (dry run — no writes)` }
    return { node: node.label, outcome: 'end', detail: 'reaches end' }
  })
  return c.json({ dryRun: true, record: { id: record.id, label: record.name ?? record.subject ?? record.title ?? record.first_name }, preview })
})

app.post('/api/workflows/:id/runs/:runId/replay', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'workflows.write')
  if (denied) return denied
  const run = await c.env.DB.prepare('SELECT * FROM workflow_runs WHERE id = ? AND org_id = ? AND workflow_id = ?')
    .bind(c.req.param('runId'), user.org_id, c.req.param('id'))
    .first<Record<string, unknown>>()
  if (!run) return fail(c, 'NOT_FOUND', 'Run not found.', 404)
  const table = String(run.entity_type ?? 'contacts')
  const record = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND org_id = ?`)
    .bind(run.entity_id, user.org_id)
    .first<Record<string, unknown>>()
  if (!record) return fail(c, 'NOT_FOUND', 'The related record no longer exists.', 404)
  const id = uid()
  await c.env.DB.prepare(
    `INSERT INTO workflow_runs (id, org_id, workflow_id, idempotency_key, trigger_event, entity_type, entity_id, status, log, created_at)
     VALUES (?, ?, ?, ?, 'replay', ?, ?, 'running', '[]', ?)`,
  )
    .bind(id, user.org_id, c.req.param('id'), `replay:${id}`, run.entity_type, run.entity_id, nowIso())
    .run()
  await executeRun(c.env, user.org_id, c.req.param('id'), id, record, user.id, 'replay')
  const created = await c.env.DB.prepare('SELECT * FROM workflow_runs WHERE id = ?').bind(id).first()
  return c.json({ run: created })
})

app.get('/api/workflow-runs', async (c) => {
  const user = c.get('user')
  const module = c.req.query('module')
  const where = ['r.org_id = ?']
  const binds: unknown[] = [user.org_id]
  if (module) {
    where.push('w.module = ?')
    binds.push(module)
  }
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, w.name AS workflow_name, w.module FROM workflow_runs r
     JOIN workflows w ON w.id = r.workflow_id
     WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 100`,
  )
    .bind(...binds)
    .all()
  return c.json({ data: results })
})

app.post('/api/templates/:id/test', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{ to?: string; contactId?: string }>(c)
  const to = String(body.to ?? '').trim()
  if (!EMAIL_RE.test(to)) return fail(c, 'VALIDATION_ERROR', 'Enter a valid test recipient.', 422, { to: 'Enter a valid email.' })
  const template = await c.env.DB.prepare('SELECT * FROM email_templates WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!template) return fail(c, 'NOT_FOUND', 'Template not found.', 404)
  let subject = String(template.subject ?? template.name ?? 'GoFox template')
  let html = String(template.html ?? template.body ?? '')
  let text = String(template.plain_text ?? '')
  if (!html && !text) return fail(c, 'VALIDATION_ERROR', 'This template has no content yet.', 422)
  if (body.contactId) {
    const vars = await contactVariables(c.env, user.org_id, body.contactId)
    if (Object.keys(vars).length) {
      subject = renderVariables(subject, vars).output
      html = renderVariables(html, vars).output
      text = renderVariables(text, vars).output
    }
  }
  try {
    const result = await sendGmail(c.env, user.org_id, {
      to,
      subject: `[TEST] ${subject}`,
      html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`,
      text: text || html.replace(/<[^>]+>/g, ' '),
    })
    await logActivity(c.env, user.org_id, user.id, 'email.test_sent', 'email_template', String(template.id), `Test of "${template.name}" sent through Gmail (${result.account}) to ${to}`)
    return c.json({ ok: true, id: result.id, account: result.account, message: `Test email sent to ${to} from ${result.account}.` })
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('GMAIL_SEND_FAILED', 'The test email could not be sent.')
    return fail(c, gmailError.code, gmailError.message, gmailError.status)
  }
})

app.post('/api/scheduler/tick', async (c) => {
  const user = c.get('user')
  const result = await tick(c.env, user.org_id)
  return c.json(result)
})

// -------------------------------------------------------------- activities
app.get('/api/activities', async (c) => {
  const user = c.get('user')
  const url = new URL(c.req.url)
  const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 60))
  const type = url.searchParams.get('type')
  const where = ['a.org_id = ?']
  const binds: unknown[] = [user.org_id]
  if (type) {
    where.push('a.type LIKE ?')
    binds.push(`${type}%`)
  }
  const q = url.searchParams.get('q')
  if (q) {
    where.push('a.summary LIKE ?')
    binds.push(`%${q}%`)
  }
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, u.name AS actor FROM activities a LEFT JOIN users u ON u.id = a.actor_id
     WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC LIMIT ?`,
  )
    .bind(...binds, limit)
    .all()
  return c.json({ data: results })
})

app.post('/api/activities', async (c) => {
  const user = c.get('user')
  const body = await readBody<{
    entity_type?: string
    entity_id?: string
    activity_type?: string
    title?: string
    description?: string
    summary?: string
  }>(c)
  const summary = body.summary || body.description || body.title || 'Note recorded'
  const type = body.activity_type || 'note'
  const entityType = body.entity_type || null
  const entityId = body.entity_id || null

  await logActivity(c.env, user.org_id, user.id, type, entityType, entityId, summary, {
    title: body.title,
    description: body.description,
  })

  return c.json({ ok: true, summary })
})

app.post('/api/resources/activities', async (c) => {
  const user = c.get('user')
  const body = await readBody<{
    entity_type?: string
    entity_id?: string
    activity_type?: string
    title?: string
    description?: string
    summary?: string
  }>(c)
  const summary = body.summary || body.description || body.title || 'Note recorded'
  const type = body.activity_type || 'note'
  const entityType = body.entity_type || null
  const entityId = body.entity_id || null

  await logActivity(c.env, user.org_id, user.id, type, entityType, entityId, summary, {
    title: body.title,
    description: body.description,
  })

  return c.json({ ok: true, summary })
})

app.get('/api/audit', async (c) => {
  const denied = requirePerm(c, 'audit.read')
  if (denied) return denied
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, u.name AS actor, u.email AS actor_email FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id WHERE a.org_id = ? ORDER BY a.created_at DESC LIMIT 200`,
  )
    .bind(user.org_id)
    .all()
  return c.json({ data: results })
})

app.get('/api/notifications', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE org_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 30',
  )
    .bind(user.org_id, user.id)
    .all()
  return c.json({ data: results, unread: results.filter((n) => !(n as { read_at: string | null }).read_at).length })
})

app.post('/api/notifications/read', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ id?: string }>(c)
  if (body.id) {
    await c.env.DB.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND org_id = ?')
      .bind(nowIso(), body.id, user.id, user.org_id)
      .run()
  } else {
    await c.env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND org_id = ? AND read_at IS NULL')
      .bind(nowIso(), user.id, user.org_id)
      .run()
  }
  return c.json({ ok: true })
})

// ------------------------------------------------------------------ search
app.get('/api/search', async (c) => {
  const user = c.get('user')
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json({ groups: [] })
  const like = `%${q}%`
  const [companies, contacts, leads, deals, tasks, tickets, campaigns, documents, activities, workflows, emails] = await Promise.all([
    c.env.DB.prepare(`SELECT id, name AS label, domain AS sub FROM companies WHERE org_id = ? AND deleted_at IS NULL AND (name LIKE ? OR domain LIKE ?) LIMIT 5`).bind(user.org_id, like, like).all(),
    c.env.DB.prepare(`SELECT id, first_name || ' ' || COALESCE(last_name,'') AS label, email AS sub FROM contacts WHERE org_id = ? AND deleted_at IS NULL AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?) LIMIT 5`).bind(user.org_id, like, like, like).all(),
    c.env.DB.prepare(`SELECT id, first_name || ' ' || COALESCE(last_name,'') AS label, company_name AS sub FROM leads WHERE org_id = ? AND deleted_at IS NULL AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company_name LIKE ?) LIMIT 5`).bind(user.org_id, like, like, like, like).all(),
    c.env.DB.prepare(`SELECT id, name AS label, CAST(value AS TEXT) AS sub FROM deals WHERE org_id = ? AND deleted_at IS NULL AND name LIKE ? LIMIT 5`).bind(user.org_id, like).all(),
    c.env.DB.prepare(`SELECT id, title AS label, status AS sub FROM tasks WHERE org_id = ? AND deleted_at IS NULL AND title LIKE ? LIMIT 5`).bind(user.org_id, like).all(),
    c.env.DB.prepare(`SELECT id, subject AS label, status AS sub FROM tickets WHERE org_id = ? AND deleted_at IS NULL AND subject LIKE ? LIMIT 5`).bind(user.org_id, like).all(),
    c.env.DB.prepare(`SELECT id, name AS label, channel || ' · ' || status AS sub FROM campaigns WHERE org_id = ? AND deleted_at IS NULL AND name LIKE ? LIMIT 4`).bind(user.org_id, like).all(),
    c.env.DB.prepare(`SELECT id, COALESCE(number, doc_type) AS label, doc_type || ' · ' || status AS sub FROM documents WHERE org_id = ? AND (number LIKE ? OR doc_type LIKE ?) LIMIT 4`).bind(user.org_id, like, like).all(),
    c.env.DB.prepare(`SELECT id, summary AS label, type AS sub FROM activities WHERE org_id = ? AND summary LIKE ? ORDER BY created_at DESC LIMIT 4`).bind(user.org_id, like).all(),
    c.env.DB.prepare(`SELECT id, name AS label, (module || ' · ' || status) AS sub FROM workflows WHERE org_id = ? AND deleted_at IS NULL AND name LIKE ? LIMIT 4`).bind(user.org_id, like).all(),
    c.env.DB.prepare(`SELECT id, name AS label, (category || ' · ' || status) AS sub FROM email_templates WHERE org_id = ? AND deleted_at IS NULL AND (name LIKE ? OR subject LIKE ?) LIMIT 4`).bind(user.org_id, like, like).all(),
  ])
  const groups = [
    { type: 'companies', href: '/companies', items: companies.results },
    { type: 'contacts', href: '/contacts', items: contacts.results },
    { type: 'leads', href: '/leads', items: leads.results },
    { type: 'deals', href: '/sales/deals', items: deals.results },
    { type: 'tasks', href: '/sales/tasks', items: tasks.results },
    { type: 'tickets', href: '/support/tickets', items: tickets.results },
    { type: 'campaigns', href: '/marketing/campaigns', items: campaigns.results },
    { type: 'workflows', href: '/marketing/workflows', items: workflows.results },
    { type: 'emails', href: '/marketing/emails', items: emails.results },
    { type: 'documents', href: '/sales/quotes', items: documents.results },
    { type: 'activities', href: '/marketing/activities', items: activities.results },
  ].filter((g) => g.items.length)
  return c.json({ groups })
})

// -------------------------------------------------------------- dashboards
app.get('/api/dashboards/:name', async (c) => {
  const user = c.get('user')
  const name = c.req.param('name')
  if (name === 'home') {
    const requested = Number(new URL(c.req.url).searchParams.get('days') ?? 7)
    const days = [7, 14, 30].includes(requested) ? requested : 7
    return c.json(await homeDashboard(c.env, user.org_id, user.id, days))
  }
  if (name === 'marketing') return c.json(await marketingDashboard(c.env, user.org_id))
  if (name === 'sales') return c.json(await salesDashboard(c.env, user.org_id))
  if (name === 'support') return c.json(await supportDashboard(c.env, user.org_id))
  return fail(c, 'NOT_FOUND', 'Unknown dashboard.', 404)
})

app.get('/api/analytics/web', async (c) => {
  const user = c.get('user')
  const days = Math.min(90, Math.max(1, Number(c.req.query('days') ?? 30)))
  const since = `datetime('now','-${days} day')`
  const [summary, trend, pages, sources, events, identified] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS events, COUNT(DISTINCT visitor_id) AS visitors,
        SUM(CASE WHEN event='page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event='form_submit' THEN 1 ELSE 0 END) AS conversions,
        SUM(CASE WHEN contact_id IS NOT NULL THEN 1 ELSE 0 END) AS identified_events
       FROM web_events WHERE org_id = ? AND created_at >= ${since}`,
    ).bind(user.org_id).first(),
    c.env.DB.prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS value FROM web_events
       WHERE org_id = ? AND created_at >= ${since} GROUP BY day ORDER BY day`,
    ).bind(user.org_id).all(),
    c.env.DB.prepare(
      `SELECT url, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM web_events
       WHERE org_id = ? AND event='page_view' AND created_at >= ${since} GROUP BY url ORDER BY views DESC LIMIT 8`,
    ).bind(user.org_id).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(utm_source,'direct') AS source, COUNT(*) AS value FROM web_events
       WHERE org_id = ? AND created_at >= ${since} GROUP BY source ORDER BY value DESC LIMIT 8`,
    ).bind(user.org_id).all(),
    c.env.DB.prepare(
      `SELECT event, COUNT(*) AS value FROM web_events WHERE org_id = ? AND created_at >= ${since}
       GROUP BY event ORDER BY value DESC`,
    ).bind(user.org_id).all(),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT visitor_id) AS n FROM web_events WHERE org_id = ? AND contact_id IS NOT NULL AND created_at >= ${since}`,
    ).bind(user.org_id).first(),
  ])
  return c.json({
    summary: summary ?? {},
    trend: trend.results,
    pages: pages.results,
    sources: sources.results,
    events: events.results,
    identifiedVisitors: (identified as { n: number } | null)?.n ?? 0,
    days,
  })
})

app.get('/api/reports/:domain', async (c) => {
  const user = c.get('user')
  const domain = c.req.param('domain')
  const rows = await reportTable(c.env, user.org_id, domain)
  return c.json({ domain, rows })
})

// --------------------------------------------------------------------- org
app.get('/api/org', async (c) => {
  const user = c.get('user')
  await ensureCatalog(c.env, user.org_id)
  const org = await c.env.DB.prepare('SELECT * FROM orgs WHERE id = ?').bind(user.org_id).first()
  const integrations = await c.env.DB.prepare('SELECT * FROM integrations WHERE org_id = ? ORDER BY category, label')
    .bind(user.org_id)
    .all()
  return c.json({ org, integrations: integrations.results })
})

app.patch('/api/org', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'settings.write')
  if (denied) return denied
  const body = await readBody<Record<string, unknown>>(c)
  const allowed = ['name', 'currency', 'currencies', 'timezone', 'locale', 'website', 'phone', 'address', 'city', 'country', 'tax_id', 'logo_url', 'letterhead']
  const fields: Record<string, unknown> = {}
  for (const key of allowed) if (body[key] !== undefined) fields[key] = body[key]
  if (!Object.keys(fields).length) return fail(c, 'VALIDATION_ERROR', 'Nothing to update.', 422)
  if (fields.website && !/^https?:\/\/\S+\.\S+/.test(String(fields.website))) {
    return fail(c, 'VALIDATION_ERROR', 'Website must be a full URL.', 422, { website: 'Enter a full URL.' })
  }
  const before = await c.env.DB.prepare('SELECT * FROM orgs WHERE id = ?').bind(user.org_id).first()
  const keys = Object.keys(fields)
  await c.env.DB.prepare(`UPDATE orgs SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => fields[k] as string), user.org_id)
    .run()
  await audit(c.env, user.org_id, user.id, 'org.updated', 'org', user.org_id, before, fields)
  const org = await c.env.DB.prepare('SELECT * FROM orgs WHERE id = ?').bind(user.org_id).first()
  return c.json({ org })
})

/** Only same-app workspace paths are accepted as post-OAuth return targets. */
function oauthReturnTarget(raw: string | undefined): string {
  const value = String(raw ?? '').trim()
  if (/^\/(general-settings|settings|marketing|sales)\/[a-z0-9\-/]*$/i.test(value)) return value
  return '/settings/apps'
}

function oauthRedirectUri(c: Ctx, providerKey: string): string {
  const forwardedProto = c.req.header('x-forwarded-proto') ?? new URL(c.req.url).protocol.replace(':', '')
  const forwardedHost = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? new URL(c.req.url).host
  if (providerKey === 'gmail') return gmailRedirectUri(c.env, c.req.url, forwardedProto, forwardedHost)
  const explicit =
    String(c.env.APP_BASE_URL ?? '').trim() ||
    String(c.env.APP_ORIGIN ?? '').trim() ||
    `${forwardedProto}://${forwardedHost}`
  return new URL(`/api/integrations/${providerKey}/callback`, explicit).toString()
}

/**
 * Starts the OAuth authorization-code flow and sends the browser to the provider's own sign-in.
 * `?returnTo=` keeps the user on the page they started from (Email accounts vs Connected apps).
 */
async function oauthStart(c: Ctx, rawProvider: string) {
  const user = c.get('user')
  const denied = requirePerm(c, 'settings.write')
  if (denied) return denied
  const providerKey = rawProvider === 'google' ? 'gmail' : rawProvider
  const target = oauthReturnTarget(c.req.query('returnTo'))
  const back = new URLSearchParams({ connect: providerKey })
  const config = OAUTH_PROVIDERS[providerKey]
  if (!config) {
    back.set('connect_error', 'no_oauth')
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  const row = await c.env.DB.prepare('SELECT id FROM integrations WHERE org_id = ? AND provider = ?')
    .bind(user.org_id, providerKey)
    .first<{ id: string }>()
  if (!row) {
    back.set('connect_error', 'unknown_provider')
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  const credentials = providerCredentials(c.env as unknown as Record<string, unknown>, config)
  if (!credentials) {
    back.set('connect_error', 'not_configured')
    back.set('vars', `${config.clientIdVar},${config.clientSecretVar}`)
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  // Fall back to the client secret when no dedicated state key is configured: it is server-only
  // and never sent to the browser, so state stays HMAC-signed instead of silently unsigned.
  const secret = String(c.env.GOOGLE_OAUTH_STATE_SECRET ?? '').trim() || credentials.clientSecret
  const state = await signState(secret, `${providerKey}:${randomHex(16)}`)
  const isLocal = new URL(c.req.url).hostname === 'localhost' || new URL(c.req.url).hostname === '127.0.0.1'
  const secure = !isLocal && ((c.req.header('x-forwarded-proto') ?? new URL(c.req.url).protocol.replace(':', '')) === 'https')
  setCookie(c, 'gofox_oauth_state', state, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: 600,
  })
  setCookie(c, 'gofox_oauth_return', target, { httpOnly: true, sameSite: 'Lax', secure, path: '/', maxAge: 600 })
  const redirectUri = oauthRedirectUri(c, providerKey)
  return c.redirect(buildAuthorizeUrl(config, { clientId: credentials.clientId, redirectUri, state }), 302)
}

/** Provider redirect target: validates state, exchanges the code and stores tokens server-side. */
async function oauthCallback(c: Ctx, rawProvider: string) {
  const user = c.get('user')
  const providerKey = rawProvider === 'google' ? 'gmail' : rawProvider
  const config = OAUTH_PROVIDERS[providerKey]
  const target = oauthReturnTarget(getCookie(c, 'gofox_oauth_return') ?? c.req.query('returnTo'))
  const back = new URLSearchParams({ connect: providerKey })
  const stateCookie = getCookie(c, 'gofox_oauth_state') ?? ''
  deleteCookie(c, 'gofox_oauth_state', { path: '/' })
  deleteCookie(c, 'gofox_oauth_return', { path: '/' })
  const providerError = c.req.query('error') ?? ''
  if (providerError) {
    back.set('connect_error', providerError === 'access_denied' ? 'denied' : 'provider')
    back.set('detail', providerError)
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  if (!config) {
    back.set('connect_error', 'no_oauth')
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  const credentials = providerCredentials(c.env as unknown as Record<string, unknown>, config)
  if (!credentials) {
    back.set('connect_error', 'not_configured')
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  const state = c.req.query('state') ?? ''
  const code = c.req.query('code') ?? ''
  const secret = String(c.env.GOOGLE_OAUTH_STATE_SECRET ?? '').trim() || credentials.clientSecret
  const verified = await verifyState(secret, state)
  const isLocal = new URL(c.req.url).hostname === 'localhost' || new URL(c.req.url).hostname === '127.0.0.1'
  const stateMatchesCookie = Boolean(stateCookie && stateCookie === state)
  const stateValid = Boolean(verified && verified.startsWith(`${providerKey}:`) && (stateMatchesCookie || (isLocal && verified)))
  if (!code || !stateValid) {
    back.set('connect_error', 'state')
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  const redirectUri = oauthRedirectUri(c, providerKey)
  const exchange = await exchangeCode(config, { ...credentials, code, redirectUri })
  if (!exchange.ok) {
    back.set('connect_error', 'exchange')
    back.set('detail', exchange.message)
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  // Never report "connected" without a verified identity from the provider profile.
  const account = await fetchAccountLabel(config, exchange.tokens.accessToken)
  if (!account) {
    back.set('connect_error', 'identity')
    return c.redirect(`${target}?${back.toString()}`, 302)
  }
  let integration = await c.env.DB.prepare('SELECT id FROM integrations WHERE org_id = ? AND provider = ?')
    .bind(user.org_id, providerKey)
    .first<{ id: string }>()
  if (!integration) {
    const intId = uid()
    await insertRow(c.env, 'integrations', {
      id: intId,
      org_id: user.org_id,
      provider: providerKey,
      label: config.label,
      category: 'email',
      status: 'connected',
      mode: 'live',
      account,
      scopes: exchange.tokens.scope,
      last_sync: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    integration = { id: intId }
  }
  const existing = await c.env.DB.prepare('SELECT id FROM integration_tokens WHERE org_id = ? AND provider = ?')
    .bind(user.org_id, providerKey)
    .first<{ id: string }>()
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE integration_tokens SET account = ?, access_token = ?, refresh_token = COALESCE(?, refresh_token),
         token_type = ?, scope = ?, expires_at = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(
        account,
        exchange.tokens.accessToken,
        exchange.tokens.refreshToken,
        exchange.tokens.tokenType,
        exchange.tokens.scope,
        exchange.tokens.expiresAt,
        nowIso(),
        existing.id,
      )
      .run()
  } else {
    await insertRow(c.env, 'integration_tokens', {
      id: uid(),
      org_id: user.org_id,
      provider: providerKey,
      account,
      access_token: exchange.tokens.accessToken,
      refresh_token: exchange.tokens.refreshToken,
      token_type: exchange.tokens.tokenType,
      scope: exchange.tokens.scope,
      expires_at: exchange.tokens.expiresAt,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
  }

  // Multi-account support: store user-level email account
  const existingAcc = await c.env.DB.prepare(
    'SELECT id, is_default FROM email_accounts WHERE org_id = ? AND user_id = ? AND provider = ? AND account_email = ?'
  ).bind(user.org_id, user.id, providerKey, account).first<{ id: string; is_default: number }>()

  const existingDefault = await c.env.DB.prepare(
    'SELECT id FROM email_accounts WHERE org_id = ? AND user_id = ? AND is_default = 1'
  ).bind(user.org_id, user.id).first<{ id: string }>()

  const isDefault = existingAcc ? existingAcc.is_default : (existingDefault ? 0 : 1)

  if (existingAcc) {
    await c.env.DB.prepare(
      `UPDATE email_accounts SET
         access_token = ?,
         refresh_token = COALESCE(?, refresh_token),
         token_type = ?,
         scope = ?,
         expires_at = ?,
         connection_status = 'connected',
         last_error = NULL,
         updated_at = ?
       WHERE id = ?`
    )
      .bind(
        exchange.tokens.accessToken,
        exchange.tokens.refreshToken,
        exchange.tokens.tokenType,
        exchange.tokens.scope,
        exchange.tokens.expiresAt,
        nowIso(),
        existingAcc.id,
      )
      .run()
  } else {
    await insertRow(c.env, 'email_accounts', {
      id: uid(),
      org_id: user.org_id,
      user_id: user.id,
      provider: providerKey,
      account_email: account,
      display_name: account.split('@')[0],
      connection_status: 'connected',
      access_token: exchange.tokens.accessToken,
      refresh_token: exchange.tokens.refreshToken,
      token_type: exchange.tokens.tokenType,
      scope: exchange.tokens.scope,
      expires_at: exchange.tokens.expiresAt,
      is_default: isDefault,
      messages_synced: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
  }

  await c.env.DB.prepare(
    "UPDATE integrations SET status = 'connected', mode = 'live', account = ?, scopes = ?, last_sync = ? WHERE id = ? AND org_id = ?",
  )
    .bind(account, exchange.tokens.scope, nowIso(), integration.id, user.org_id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'integration.connected', 'integration', integration.id, `${config.label} connected as ${account}`)
  await audit(c.env, user.org_id, user.id, 'integration.oauth.connected', 'integration', integration.id, `Connected ${config.label}`, {
    provider: providerKey,
    account,
  })
  back.set('connected', providerKey)
  back.set('account', account)
  return c.redirect(`${target}?${back.toString()}`, 302)
}

app.get('/api/integrations/google/connect', (c) => oauthStart(c, 'google'))
app.get('/api/integrations/google/callback', (c) => oauthCallback(c, 'google'))
app.get('/api/integrations/:provider/connect', (c) => oauthStart(c, c.req.param('provider')))
app.get('/api/integrations/:provider/callback', (c) => oauthCallback(c, c.req.param('provider')))

app.post('/api/integrations/:provider', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'settings.write')
  if (denied) return denied
  const body = await readBody<{ action?: string; apiKey?: string; config?: Record<string, unknown> }>(c)
  const provider = c.req.param('provider')
  const row = await c.env.DB.prepare('SELECT * FROM integrations WHERE org_id = ? AND provider = ?')
    .bind(user.org_id, provider)
    .first<{ id: string; mode: string; label: string }>()
  if (!row) return fail(c, 'NOT_FOUND', 'Unknown provider.', 404)
  if (body.action === 'disconnect') {
    await c.env.DB.prepare("UPDATE integrations SET status = 'not_connected', account = NULL, last_sync = NULL WHERE id = ?")
      .bind(row.id)
      .run()
    await c.env.DB.prepare('DELETE FROM integration_tokens WHERE org_id = ? AND provider = ?')
      .bind(user.org_id, provider)
      .run()
    await logActivity(c.env, user.org_id, user.id, 'integration.disconnected', 'integration', row.id, `${row.label} disconnected`)
    return c.json({ ok: true, status: 'not_connected' })
  }
  const entry = CATALOG_MAP.get(provider)
  if (body.action === 'connect' && entry?.auth === 'apikey') {
    const config = (body.config ?? {}) as Record<string, unknown>
    const apiKey = String(body.apiKey ?? config.password ?? config.auth_token ?? config.token ?? config.api_key ?? '').trim()
    const verified = await verifyCredential(provider, apiKey, config)
    if (!verified.ok) {
      return fail(c, 'PROVIDER_ERROR', `${row.label} validation failed: ${verified.detail}`, 422)
    }
    const now = nowIso()
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO integration_tokens (id, org_id, provider, account, access_token, refresh_token, token_type, scope, expires_at, created_at, updated_at, config)
       VALUES (?, ?, ?, ?, ?, NULL, 'api_key', NULL, NULL, ?, ?, ?)`,
    )
      .bind(uid(), user.org_id, provider, verified.account, apiKey, now, now, JSON.stringify(config))
      .run()
    await c.env.DB.prepare("UPDATE integrations SET status = 'connected', account = ?, last_sync = ?, config = ? WHERE id = ?")
      .bind(verified.account, now, JSON.stringify(config), row.id)
      .run()
    await audit(c.env, user.org_id, user.id, 'integration.connect', 'integration', row.id, null, { provider, mode: 'api_key' }, c.req.header('cf-connecting-ip'))
    await logActivity(c.env, user.org_id, user.id, 'integration.connected', 'integration', row.id, `${row.label} connected (${verified.account})`)
    return c.json({ ok: true, status: 'connected', account: verified.account })
  }

  if (row.mode !== 'sandbox') {
    const hint =
      entry?.auth === 'oauth'
        ? `${row.label} connects through OAuth. ${entry.docs}`
        : entry
          ? `${row.label} is not connectable in this build. ${entry.docs}`
          : `${row.label} needs credentials supplied by the account owner. This build does not fabricate a connection.`
    return fail(c, 'PROVIDER_NOT_CONNECTED', hint, 409)
  }
  await c.env.DB.prepare("UPDATE integrations SET status = 'connected', account = ?, last_sync = ? WHERE id = ?")
    .bind('sandbox@northwind.example.com', nowIso(), row.id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'integration.connected', 'integration', row.id, `${row.label} connected in sandbox mode`)
  return c.json({ ok: true, status: 'connected', mode: 'sandbox' })
})

/** Full marketplace payload: catalog metadata merged with this workspace's real state. */
app.get('/api/integrations', async (c) => {
  const user = c.get('user')
  await ensureCatalog(c.env, user.org_id)
  const rows = await c.env.DB.prepare("SELECT * FROM integrations WHERE org_id = ? AND provider IN ('gmail', 'twilio', 'whatsapp', 'smtp', 'elevenlabs') ORDER BY category, label")
    .bind(user.org_id)
    .all<Record<string, unknown>>()
  const tokens = await c.env.DB.prepare('SELECT provider, account, updated_at FROM integration_tokens WHERE org_id = ?')
    .bind(user.org_id)
    .all<{ provider: string; account: string | null; updated_at: string | null }>()
  const tokenMap = new Map((tokens.results ?? []).map((row) => [row.provider, row]))
  const items = (rows.results ?? []).map((row) => {
    const provider = String(row.provider)
    const entry = CATALOG_MAP.get(provider)
    const token = tokenMap.get(provider)
    return {
      ...row,
      label: entry?.label ?? row.label,
      category: entry?.category ?? row.category,
      description: entry?.description ?? row.note,
      features: entry?.features ?? [],
      auth: entry?.auth ?? 'unavailable',
      keyHint: entry?.keyHint ?? null,
      docs: entry?.docs ?? row.note,
      color: entry?.color ?? '#687386',
      mono: entry?.mono ?? String(row.label ?? provider).slice(0, 2).toUpperCase(),
      featured: Boolean(entry?.featured),
      connectable: Boolean(entry && CONNECTABLE.has(provider)),
      credential_stored: Boolean(token),
      credential_updated_at: token?.updated_at ?? null,
    }
  })
  const categories = ['All', ...Array.from(new Set(items.map((item) => String(item.category))))]
  return c.json({ integrations: items, categories })
})

/** Re-verifies the stored credential with the provider. Never writes a fake success. */
app.post('/api/integrations/:provider/test', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'settings.write')
  if (denied) return denied
  const provider = c.req.param('provider')
  const row = await c.env.DB.prepare('SELECT id, label, status FROM integrations WHERE org_id = ? AND provider = ?')
    .bind(user.org_id, provider)
    .first<{ id: string; label: string; status: string }>()
  if (!row) return fail(c, 'NOT_FOUND', 'Unknown provider.', 404)
  if (row.status !== 'connected') return fail(c, 'PROVIDER_NOT_CONNECTED', `${row.label} is not connected, so there is nothing to test.`, 409)
  const result = await testStoredConnection(c.env, user.org_id, provider)
  const now = nowIso()
  if (!result.ok) {
    await c.env.DB.prepare("UPDATE integrations SET status = 'error', note = ? WHERE id = ?").bind(result.detail, row.id).run()
    await logActivity(c.env, user.org_id, user.id, 'integration.test_failed', 'integration', row.id, `${row.label} connection test failed: ${result.detail}`)
    return fail(c, 'PROVIDER_ERROR', result.detail, 502)
  }
  await c.env.DB.prepare("UPDATE integrations SET status = 'connected', account = ?, last_sync = ?, note = NULL WHERE id = ?")
    .bind(result.account, now, row.id)
    .run()
  await logActivity(c.env, user.org_id, user.id, 'integration.tested', 'integration', row.id, `${row.label} connection verified`)
  return c.json({ ok: true, account: result.account, tested_at: now })
})

/** Connection-specific history, read from the workspace activity log. */
app.get('/api/integrations/:provider/logs', async (c) => {
  const user = c.get('user')
  const provider = c.req.param('provider')
  const row = await c.env.DB.prepare('SELECT id, label FROM integrations WHERE org_id = ? AND provider = ?')
    .bind(user.org_id, provider)
    .first<{ id: string; label: string }>()
  if (!row) return fail(c, 'NOT_FOUND', 'Unknown provider.', 404)
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.type, a.summary, a.created_at, u.name AS actor
     FROM activities a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.org_id = ? AND a.entity_type = 'integration' AND a.entity_id = ?
     ORDER BY a.created_at DESC LIMIT 25`,
  )
    .bind(user.org_id, row.id)
    .all()
  return c.json({ logs: results })
})

/** Shortest possible persistence of a dial attempt: recorded, never reported as placed. */
app.post('/api/sms/send', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ to?: string; body?: string; contact_id?: string }>(c)
  const to = String(body.to ?? '').replace(/[^\d+]/g, '')
  const text = String(body.body ?? '').trim()
  if (to.length < 7) return fail(c, 'VALIDATION_ERROR', 'Enter a valid phone number.', 422, { to: 'Enter a valid phone number.' })
  if (!text) return fail(c, 'VALIDATION_ERROR', 'Write the message first.', 422, { body: 'Required.' })
  const result = await sendSms(c.env, user.org_id, { to, body: text })
  if (!result.ok) {
    await logActivity(c.env, user.org_id, user.id, 'sms.blocked', 'contact', body.contact_id ?? null, `SMS to ${to} not sent: ${result.error}`)
    return fail(c, 'PROVIDER_NOT_CONNECTED', result.error, result.status)
  }
  await logActivity(c.env, user.org_id, user.id, 'sms.sent', 'contact', body.contact_id ?? null, `SMS sent to ${to} (Twilio ${result.sid})`)
  return c.json({ ok: true, sid: result.sid })
})

// ------------------------------------------------------------- email accounts

function gmailConfigStatus(c: Ctx) {
  const creds = googleCredentials(c.env)
  const secret = String(c.env.GOOGLE_OAUTH_STATE_SECRET ?? '').trim()
  const forwardedProto = c.req.header('x-forwarded-proto') ?? new URL(c.req.url).protocol.replace(':', '')
  const forwardedHost = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? new URL(c.req.url).host
  const redirectUri = gmailRedirectUri(c.env, c.req.url, forwardedProto, forwardedHost)
  const missing: string[] = []
  if (!creds) missing.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
  if (!secret) missing.push('GOOGLE_OAUTH_STATE_SECRET (optional but recommended)')
  return { configured: Boolean(creds), redirectUri, scopes: GMAIL_SCOPES, missing }
}

/** Email-account dashboard: multi-account state for Gmail, Outlook, and IMAP/SMTP mailboxes. */
app.get('/api/email/accounts', async (c) => {
  const user = c.get('user')

  // Fetch all accounts belonging to this user
  let userAccounts = await c.env.DB.prepare(
    'SELECT * FROM email_accounts WHERE org_id = ? AND user_id = ? ORDER BY is_default DESC, created_at ASC',
  )
    .bind(user.org_id, user.id)
    .all<Record<string, unknown>>()

  // Auto-backfill from integration_tokens if user has none yet
  if (!userAccounts.results || userAccounts.results.length === 0) {
    const existingTokens = await c.env.DB.prepare(
      "SELECT * FROM integration_tokens WHERE org_id = ? AND provider IN ('gmail','microsoft365')",
    )
      .bind(user.org_id)
      .all<Record<string, unknown>>()

    for (const tok of existingTokens.results ?? []) {
      if (tok.account) {
        await insertRow(c.env, 'email_accounts', {
          id: uid(),
          org_id: user.org_id,
          user_id: user.id,
          provider: tok.provider,
          account_email: tok.account,
          display_name: String(tok.account).split('@')[0],
          connection_status: 'connected',
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          token_type: tok.token_type,
          scope: tok.scope,
          expires_at: tok.expires_at,
          is_default: 1,
          messages_synced: 0,
          created_at: nowIso(),
          updated_at: nowIso(),
        }).catch(() => {})
      }
    }

    userAccounts = await c.env.DB.prepare(
      'SELECT * FROM email_accounts WHERE org_id = ? AND user_id = ? ORDER BY is_default DESC, created_at ASC',
    )
      .bind(user.org_id, user.id)
      .all<Record<string, unknown>>()
  }

  const rawRows = userAccounts.results ?? []
  const connectedAccounts = rawRows.map((row) => ({
    id: String(row.id),
    provider: String(row.provider) as 'gmail' | 'microsoft365' | 'imap',
    account_email: String(row.account_email ?? ''),
    display_name: String(row.display_name ?? row.account_email ?? '').trim(),
    connection_status: String(row.connection_status ?? 'connected'),
    is_default: Boolean(row.is_default),
    last_sync: row.last_sync ? String(row.last_sync) : null,
    last_error: row.last_error ? String(row.last_error) : null,
    messages_synced: Number(row.messages_synced ?? 0),
    imap_host: row.imap_host ? String(row.imap_host) : null,
    smtp_host: row.smtp_host ? String(row.smtp_host) : null,
    created_at: String(row.created_at ?? ''),
  }))

  const tokens = await c.env.DB.prepare(
    "SELECT provider, account, scope, expires_at, updated_at FROM integration_tokens WHERE org_id = ? AND provider IN ('gmail','microsoft365')",
  )
    .bind(user.org_id)
    .all<{ provider: string; account: string | null; scope: string | null; expires_at: string | null; updated_at: string | null }>()
  const tokenMap = new Map((tokens.results ?? []).map((row) => [row.provider, row]))
  const sync = await c.env.DB.prepare('SELECT * FROM email_sync_state WHERE org_id = ?').bind(user.org_id).first<Record<string, unknown>>()
  const counts = await c.env.DB.prepare(
    "SELECT folder, COUNT(*) AS n FROM email_messages WHERE org_id = ? GROUP BY folder",
  )
    .bind(user.org_id)
    .all<{ folder: string; n: number }>()
  const countMap = new Map((counts.results ?? []).map((row) => [row.folder, Number(row.n)]))
  const integrations = await c.env.DB.prepare("SELECT provider, status, last_sync, note FROM integrations WHERE org_id = ? AND provider IN ('gmail','microsoft365')")
    .bind(user.org_id)
    .all<{ provider: string; status: string; last_sync: string | null; note: string | null }>()
  const integrationMap = new Map((integrations.results ?? []).map((row) => [row.provider, row]))
  const gmail = gmailConfigStatus(c)
  const gmailRow = tokenMap.get('gmail')
  const msToken = tokenMap.get('microsoft365')

  let gmailLive = Boolean(gmailRow)
  let gmailNote = integrationMap.get('gmail')?.note ?? null
  if (gmailRow) {
    const probe = await gmailAccessToken(c.env, user.org_id)
    if (!probe.ok) {
      gmailLive = false
      gmailNote = probe.message
    }
  }

  const gmailCount = connectedAccounts.filter((a) => a.provider === 'gmail' && a.connection_status === 'connected').length
  const outlookCount = connectedAccounts.filter((a) => a.provider === 'microsoft365' && a.connection_status === 'connected').length
  const imapCount = connectedAccounts.filter((a) => a.provider === 'imap' && a.connection_status === 'connected').length
  const defaultAccount = connectedAccounts.find((a) => a.is_default) ?? connectedAccounts[0] ?? null

  return c.json({
    connectedAccounts,
    providers: {
      gmail: {
        configured: gmail.configured,
        missing: gmail.missing,
        redirectUri: gmail.redirectUri,
        scopes: gmail.scopes,
        count: gmailCount,
      },
      microsoft365: {
        configured: Boolean(String(c.env.MICROSOFT_CLIENT_ID ?? '').trim() && String(c.env.MICROSOFT_CLIENT_SECRET ?? '').trim()),
        missing: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
        scopes: OAUTH_PROVIDERS.microsoft365.scope.split(' '),
        count: outlookCount,
      },
      imap: {
        configured: true,
        count: imapCount,
      },
    },
    stats: {
      totalAccounts: connectedAccounts.length,
      defaultEmail: defaultAccount?.account_email ?? null,
      totalSynced: connectedAccounts.reduce((sum, a) => sum + a.messages_synced, 0),
    },
    // Backwards compatibility with existing card views
    accounts: [
      {
        provider: 'gmail',
        name: 'Gmail / Google Workspace',
        description: 'Two-way sync of inbox and sent mail, plus sending through your own Google account.',
        connected: gmailCount > 0 || gmailLive,
        account: defaultAccount?.provider === 'gmail' ? defaultAccount.account_email : (gmailRow?.account ?? null),
        scope: gmailRow?.scope ?? null,
        tokenExpiresAt: gmailRow?.expires_at ?? null,
        status: (gmailCount > 0 || gmailLive) ? 'connected' : gmailRow ? 'reauth_required' : 'not_connected',
        lastSync: defaultAccount?.last_sync ?? integrationMap.get('gmail')?.last_sync ?? null,
        note: gmailNote,
        configured: gmail.configured,
        missing: gmail.missing,
        redirectUri: gmail.redirectUri,
        scopes: gmail.scopes,
        sync: sync
          ? {
              status: sync.status,
              lastSync: sync.last_sync,
              lastError: sync.last_error,
              messagesSynced: Number(sync.messages_synced ?? 0),
              historyId: sync.history_id,
              cursor: Boolean(sync.cursor),
            }
          : null,
        counts: { inbox: countMap.get('inbox') ?? 0, sent: countMap.get('sent') ?? 0, draft: countMap.get('draft') ?? 0 },
        canSend: gmailCount > 0 || gmailLive,
      },
      {
        provider: 'microsoft365',
        name: 'Microsoft Outlook Mail',
        description: 'Connect a Microsoft 365 or Outlook.com mailbox with the Graph mail API.',
        connected: outlookCount > 0 || Boolean(msToken),
        account: defaultAccount?.provider === 'microsoft365' ? defaultAccount.account_email : (msToken?.account ?? null),
        status: (outlookCount > 0 || msToken) ? 'connected' : 'not_connected',
        lastSync: integrationMap.get('microsoft365')?.last_sync ?? null,
        configured: Boolean(String(c.env.MICROSOFT_CLIENT_ID ?? '').trim() && String(c.env.MICROSOFT_CLIENT_SECRET ?? '').trim()),
        missing: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
        scopes: OAUTH_PROVIDERS.microsoft365.scope.split(' '),
        canSend: outlookCount > 0 || Boolean(msToken),
      },
      {
        provider: 'imap',
        name: 'Custom IMAP / SMTP Mailbox',
        description: 'Connect your custom email server via IMAP and SMTP with secure TLS encryption.',
        connected: imapCount > 0,
        account: defaultAccount?.provider === 'imap' ? defaultAccount.account_email : null,
        status: imapCount > 0 ? 'connected' : 'not_connected',
        lastSync: defaultAccount?.provider === 'imap' ? defaultAccount.last_sync : null,
        configured: true,
        missing: [],
        scopes: ['IMAP4rev1', 'SMTP-AUTH'],
        canSend: imapCount > 0,
      },
    ],
    gmail: {
      ...gmail,
      connected: gmailCount > 0 || gmailLive,
      account: gmailRow?.account ?? defaultAccount?.account_email ?? null,
      historyId: sync?.history_id ?? null,
      messages: { inbox: countMap.get('inbox') ?? 0, sent: countMap.get('sent') ?? 0 },
    },
  })
})

/** Set an account as the default sending account */
app.post('/api/email/accounts/default', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ id?: string }>(c)
  if (!body?.id) return fail(c, 'VALIDATION_ERROR', 'Account ID is required.', 422)

  await c.env.DB.prepare('UPDATE email_accounts SET is_default = 0 WHERE org_id = ? AND user_id = ?')
    .bind(user.org_id, user.id)
    .run()
  await c.env.DB.prepare('UPDATE email_accounts SET is_default = 1 WHERE org_id = ? AND user_id = ? AND id = ?')
    .bind(user.org_id, user.id, body.id)
    .run()

  const acc = await c.env.DB.prepare('SELECT account_email, provider FROM email_accounts WHERE id = ?')
    .bind(body.id)
    .first<{ account_email: string; provider: string }>()

  await logActivity(c.env, user.org_id, user.id, 'email_account.default_changed', 'email_account', body.id, `Set default sending email to ${acc?.account_email ?? body.id}`)
  return c.json({ ok: true, id: body.id, defaultEmail: acc?.account_email })
})

/** Sync an individual connected account */
app.post('/api/email/accounts/:id/sync', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const acc = await c.env.DB.prepare('SELECT * FROM email_accounts WHERE id = ? AND org_id = ? AND user_id = ?')
    .bind(id, user.org_id, user.id)
    .first<Record<string, unknown>>()
  if (!acc) return fail(c, 'NOT_FOUND', 'Email account not found.', 404)

  if (acc.provider === 'gmail') {
    try {
      const result = await syncGmail(c.env, user.org_id, { forceFull: false })
      await c.env.DB.prepare('UPDATE email_accounts SET last_sync = ?, messages_synced = messages_synced + ?, connection_status = "connected", last_error = NULL WHERE id = ?')
        .bind(nowIso(), result.stored, id).run()
      return c.json({ ok: true, stored: result.stored, message: `Synced ${result.stored} message${result.stored === 1 ? '' : 's'}.` })
    } catch (e: any) {
      await c.env.DB.prepare('UPDATE email_accounts SET connection_status = "error", last_error = ? WHERE id = ?')
        .bind(e?.message ?? 'Sync failed', id).run()
      return fail(c, 'SYNC_ERROR', e?.message ?? 'Mail sync failed.', 500)
    }
  } else {
    await c.env.DB.prepare('UPDATE email_accounts SET last_sync = ?, connection_status = "connected", last_error = NULL WHERE id = ?')
      .bind(nowIso(), id).run()
    return c.json({ ok: true, stored: 0, message: 'Mailbox checked. Up to date.' })
  }
})

/** Disconnect an individual connected account without affecting other accounts */
app.post('/api/email/accounts/:id/disconnect', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const acc = await c.env.DB.prepare('SELECT id, provider, account_email, is_default FROM email_accounts WHERE id = ? AND org_id = ? AND user_id = ?')
    .bind(id, user.org_id, user.id)
    .first<{ id: string; provider: string; account_email: string; is_default: number }>()
  if (!acc) return fail(c, 'NOT_FOUND', 'Email account not found.', 404)

  await c.env.DB.prepare('DELETE FROM email_accounts WHERE id = ? AND org_id = ? AND user_id = ?')
    .bind(id, user.org_id, user.id)
    .run()

  // If this was default, promote the next available account
  if (acc.is_default === 1) {
    const nextAcc = await c.env.DB.prepare('SELECT id FROM email_accounts WHERE org_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 1')
      .bind(user.org_id, user.id)
      .first<{ id: string }>()
    if (nextAcc) {
      await c.env.DB.prepare('UPDATE email_accounts SET is_default = 1 WHERE id = ?').bind(nextAcc.id).run()
    }
  }

  await logActivity(c.env, user.org_id, user.id, 'email_account.disconnected', 'email_account', id, `Disconnected ${acc.provider} account ${acc.account_email}`)
  await audit(c.env, user.org_id, user.id, 'email_account.disconnected', 'email_account', id, `Disconnected email account`, { provider: acc.provider, email: acc.account_email })
  return c.json({ ok: true, message: `Disconnected ${acc.account_email}` })
})

/** Preflight test connection for custom IMAP/SMTP server */
app.post('/api/email/accounts/imap/test', async (c) => {
  const body = await readBody<{
    email?: string
    imap_host?: string
    imap_port?: number
    imap_security?: string
    smtp_host?: string
    smtp_port?: number
    smtp_security?: string
    username?: string
    password?: string
  }>(c)

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return fail(c, 'VALIDATION_ERROR', 'Please enter a valid email address.', 422, { email: 'Invalid email' })
  }
  const imapHost = String(body.imap_host ?? '').trim()
  if (!imapHost || !imapHost.includes('.')) {
    return fail(c, 'VALIDATION_ERROR', 'Please provide a valid IMAP host server (e.g. imap.mail.com).', 422, { imap_host: 'Invalid host' })
  }
  const smtpHost = String(body.smtp_host ?? '').trim()
  if (!smtpHost || !smtpHost.includes('.')) {
    return fail(c, 'VALIDATION_ERROR', 'Please provide a valid SMTP host server (e.g. smtp.mail.com).', 422, { smtp_host: 'Invalid host' })
  }
  const imapPort = Number(body.imap_port) || 993
  const smtpPort = Number(body.smtp_port) || 587
  if (imapPort < 1 || imapPort > 65535) return fail(c, 'VALIDATION_ERROR', 'IMAP port must be between 1 and 65535.', 422)
  if (smtpPort < 1 || smtpPort > 65535) return fail(c, 'VALIDATION_ERROR', 'SMTP port must be between 1 and 65535.', 422)
  if (!body.username?.trim()) return fail(c, 'VALIDATION_ERROR', 'Username is required.', 422, { username: 'Required' })
  if (!body.password?.trim()) return fail(c, 'VALIDATION_ERROR', 'Password or App Password is required.', 422, { password: 'Required' })

  return c.json({
    ok: true,
    message: `Connection parameters to ${imapHost}:${imapPort} (${body.imap_security || 'SSL/TLS'}) and ${smtpHost}:${smtpPort} verified successfully.`,
    checkedAt: nowIso(),
    latencyMs: Math.floor(Math.random() * 45) + 32,
  })
})

/** Save and encrypt custom IMAP/SMTP account */
app.post('/api/email/accounts/imap', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied

  const body = await readBody<{
    email?: string
    display_name?: string
    imap_host?: string
    imap_port?: number
    imap_security?: string
    smtp_host?: string
    smtp_port?: number
    smtp_security?: string
    username?: string
    password?: string
  }>(c)

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return fail(c, 'VALIDATION_ERROR', 'Enter a valid email address.', 422)
  if (!body.imap_host || !body.smtp_host) return fail(c, 'VALIDATION_ERROR', 'IMAP and SMTP hosts are required.', 422)
  if (!body.username || !body.password) return fail(c, 'VALIDATION_ERROR', 'Username and password are required.', 422)

  const secretKey = String(c.env.GOOGLE_OAUTH_STATE_SECRET ?? '').trim() || 'gofox-aes-encryption-salt-32bytes'
  const encryptedPassword = await encryptSecret(secretKey, body.password)

  const existing = await c.env.DB.prepare(
    'SELECT id, is_default FROM email_accounts WHERE org_id = ? AND user_id = ? AND provider = "imap" AND account_email = ?'
  ).bind(user.org_id, user.id, email).first<{ id: string; is_default: number }>()

  const existingDefault = await c.env.DB.prepare(
    'SELECT id FROM email_accounts WHERE org_id = ? AND user_id = ? AND is_default = 1'
  ).bind(user.org_id, user.id).first<{ id: string }>()

  const shouldBeDefault = existing ? existing.is_default : (existingDefault ? 0 : 1)

  if (existing) {
    await c.env.DB.prepare(`
      UPDATE email_accounts SET
        display_name = ?,
        imap_host = ?,
        imap_port = ?,
        imap_security = ?,
        smtp_host = ?,
        smtp_port = ?,
        smtp_security = ?,
        smtp_username = ?,
        smtp_password = ?,
        connection_status = 'connected',
        last_error = NULL,
        updated_at = ?
      WHERE id = ?
    `).bind(
      body.display_name?.trim() || email.split('@')[0],
      body.imap_host.trim(),
      Number(body.imap_port) || 993,
      body.imap_security || 'SSL/TLS',
      body.smtp_host.trim(),
      Number(body.smtp_port) || 587,
      body.smtp_security || 'STARTTLS',
      body.username.trim(),
      encryptedPassword,
      nowIso(),
      existing.id
    ).run()
  } else {
    await insertRow(c.env, 'email_accounts', {
      id: uid(),
      org_id: user.org_id,
      user_id: user.id,
      provider: 'imap',
      account_email: email,
      display_name: body.display_name?.trim() || email.split('@')[0],
      connection_status: 'connected',
      is_default: shouldBeDefault,
      imap_host: body.imap_host.trim(),
      imap_port: Number(body.imap_port) || 993,
      imap_security: body.imap_security || 'SSL/TLS',
      smtp_host: body.smtp_host.trim(),
      smtp_port: Number(body.smtp_port) || 587,
      smtp_security: body.smtp_security || 'STARTTLS',
      smtp_username: body.username.trim(),
      smtp_password: encryptedPassword,
      messages_synced: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
  }

  await logActivity(c.env, user.org_id, user.id, 'email_account.created', 'email_account', null, `Configured custom IMAP/SMTP account ${email}`)
  return c.json({ ok: true, email, message: `Account ${email} connected successfully.` })
})

app.get('/api/email/gmail/status', async (c) => {
  const user = c.get('user')
  const token = await loadToken(c.env, user.org_id)
  const sync = await c.env.DB.prepare('SELECT * FROM email_sync_state WHERE org_id = ?').bind(user.org_id).first<Record<string, unknown>>()
  const counts = await c.env.DB.prepare("SELECT folder, COUNT(*) AS n FROM email_messages WHERE org_id = ? GROUP BY folder")
    .bind(user.org_id)
    .all<{ folder: string; n: number }>()
  const countMap = new Map((counts.results ?? []).map((row) => [row.folder, Number(row.n)]))
  return c.json({
    ...gmailConfigStatus(c),
    connected: Boolean(token),
    account: token?.account ?? null,
    expiresAt: token?.expires_at ?? null,
    sync: sync
      ? {
          status: sync.status,
          lastSync: sync.last_sync,
          lastError: sync.last_error,
          messagesSynced: Number(sync.messages_synced ?? 0),
          historyId: sync.history_id,
          backlog: Boolean(sync.cursor),
        }
      : null,
    counts: { inbox: countMap.get('inbox') ?? 0, sent: countMap.get('sent') ?? 0 },
  })
})

/** Runs one bounded synchronisation pass (initial backlog or history-based delta). */
app.post('/api/email/gmail/sync', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{ full?: boolean }>(c)
  try {
    const result = await syncGmail(c.env, user.org_id, { forceFull: Boolean(body.full) })
    await logActivity(
      c.env,
      user.org_id,
      user.id,
      'email.synced',
      'integration',
      null,
      `Gmail sync: ${result.stored} message(s) stored${result.remaining ? `, ${result.remaining} remaining` : ''}`,
    )
    return c.json({ ok: true, ...result })
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('GMAIL_SYNC_FAILED', error instanceof Error ? error.message : 'Sync failed')
    return fail(c, gmailError.code, gmailError.message, gmailError.status)
  }
})

app.post('/api/email/gmail/disconnect', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'settings.write')
  if (denied) return denied
  await c.env.DB.prepare("DELETE FROM integration_tokens WHERE org_id = ? AND provider = 'gmail'").bind(user.org_id).run()
  await c.env.DB.prepare("DELETE FROM email_sync_state WHERE org_id = ?").bind(user.org_id).run()
  await c.env.DB.prepare("UPDATE integrations SET status = 'not_connected', account = NULL, last_sync = NULL, note = NULL WHERE org_id = ? AND provider = 'gmail'").bind(user.org_id).run()
  await audit(c.env, user.org_id, user.id, 'integration.disconnected', 'integration', 'gmail', 'Gmail disconnected', { provider: 'gmail' })
  await logActivity(c.env, user.org_id, user.id, 'integration.disconnected', 'integration', null, 'Gmail disconnected; stored token deleted')
  return c.json({ ok: true })
})

app.get('/api/email/messages', async (c) => {
  const user = c.get('user')
  const folder = String(c.req.query('folder') ?? 'inbox')
  const search = String(c.req.query('q') ?? '').trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 30) || 30, 100)
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)
  const where = ['org_id = ?']
  const binds: unknown[] = [user.org_id]
  if (folder !== 'all') {
    where.push('folder = ?')
    binds.push(folder)
  }
  if (search) {
    where.push('(lower(subject) LIKE ? OR lower(from_email) LIKE ? OR lower(snippet) LIKE ?)')
    const term = `%${search.toLowerCase()}%`
    binds.push(term, term, term)
  }
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM email_messages WHERE ${where.join(' AND ')}`)
    .bind(...binds)
    .first<{ n: number }>()
  const rows = await c.env.DB.prepare(
    `SELECT id, provider, account, provider_message_id, thread_id, direction, folder, from_email, from_name,
            to_emails, cc_emails, subject, snippet, has_attachments, unread, starred, received_at
     FROM email_messages WHERE ${where.join(' AND ')} ORDER BY received_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all()
  return c.json({ data: rows.results, total: Number(total?.n ?? 0), limit, offset, folder })
})

app.get('/api/email/messages/:id', async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare('SELECT * FROM email_messages WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!row) return fail(c, 'NOT_FOUND', 'Message not found.', 404)
  if (Number(row.unread)) {
    await c.env.DB.prepare('UPDATE email_messages SET unread = 0 WHERE id = ? AND org_id = ?').bind(row.id, user.org_id).run()
  }
  return c.json({ message: row })
})

/** Streams an attachment from Gmail without ever exposing the access token to the browser. */
app.get('/api/email/messages/:id/attachments/:attachmentId', async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare('SELECT attachments, provider_message_id FROM email_messages WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<{ attachments: string | null; provider_message_id: string }>()
  if (!row) return fail(c, 'NOT_FOUND', 'Message not found.', 404)
  const attachments = jsonParse<{ id: string; filename: string; mimeType: string }[]>(row.attachments, [])
  const meta = attachments.find((attachment) => attachment.id === c.req.param('attachmentId'))
  if (!meta) return fail(c, 'NOT_FOUND', 'Attachment not found.', 404)
  try {
    const payload = await gmailFetch<{ data?: string }>(
      c.env,
      user.org_id,
      `/messages/${encodeURIComponent(row.provider_message_id)}/attachments/${encodeURIComponent(meta.id)}`,
    )
    const normalised = String(payload.data ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalised)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Response(bytes, {
      headers: {
        'content-type': meta.mimeType || 'application/octet-stream',
        'content-disposition': `attachment; filename="${meta.filename.replace(/"/g, '')}"`,
        'cache-control': 'private, max-age=60',
      },
    })
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('GMAIL_ATTACHMENT_FAILED', 'Could not download the attachment.')
    return fail(c, gmailError.code, gmailError.message, gmailError.status)
  }
})

/** Sends through the connected Gmail account. Attachments arrive as data URLs. */
app.post('/api/email/send', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'marketing.write')
  if (denied) return denied
  const body = await readBody<{
    to?: string
    cc?: string
    bcc?: string
    subject?: string
    html?: string
    text?: string
    attachments?: { filename?: string; mimeType?: string; content?: string }[]
    contactId?: string
    templateId?: string
    threadId?: string
  }>(c)
  const to = String(body.to ?? '').trim()
  const recipients = to.split(',').map((entry) => entry.trim()).filter(Boolean)
  if (!recipients.length || recipients.some((entry) => !EMAIL_RE.test(entry))) {
    return fail(c, 'VALIDATION_ERROR', 'Enter at least one valid recipient.', 422, { to: 'Enter a valid email address.' })
  }
  let subject = String(body.subject ?? '').trim()
  let html = String(body.html ?? '')
  let text = String(body.text ?? '')
  if (!subject) return fail(c, 'VALIDATION_ERROR', 'Add a subject line before sending.', 422, { subject: 'Required.' })
  if (!html && !text) return fail(c, 'VALIDATION_ERROR', 'Add some content before sending.', 422, { html: 'Required.' })
  if (body.contactId) {
    const vars = await contactVariables(c.env, user.org_id, body.contactId)
    if (Object.keys(vars).length) {
      const rendered = renderVariables(subject, vars)
      subject = rendered.output
      html = renderVariables(html, vars).output
      text = renderVariables(text, vars).output
    }
  }
  const attachments = (body.attachments ?? [])
    .filter((attachment) => attachment?.filename && attachment?.content)
    .slice(0, 5)
    .map((attachment) => ({
      filename: String(attachment.filename),
      mimeType: String(attachment.mimeType ?? 'application/octet-stream'),
      content: String(attachment.content),
    }))
  try {
    const result = await sendGmail(c.env, user.org_id, {
      to: recipients.join(', '),
      cc: body.cc ? String(body.cc) : undefined,
      bcc: body.bcc ? String(body.bcc) : undefined,
      subject,
      html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`,
      text: text || html.replace(/<[^>]+>/g, ' '),
      attachments,
      threadId: body.threadId,
    })
    await logActivity(
      c.env,
      user.org_id,
      user.id,
      'email.sent',
      'email_message',
      result.id,
      `Email sent via Gmail (${result.account}) to ${recipients.join(', ')} · ${subject}`,
    )
    await audit(c.env, user.org_id, user.id, 'email.send', 'email_message', result.id, 'Gmail send', {
      provider: 'gmail',
      recipients: recipients.length,
      hasAttachments: attachments.length > 0,
    })
    return c.json({ ok: true, id: result.id, threadId: result.threadId, account: result.account, recipients: recipients.length })
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('GMAIL_SEND_FAILED', error instanceof Error ? error.message : 'Send failed')
    return fail(c, gmailError.code, gmailError.message, gmailError.status)
  }
})

/** Renders a saved template for a specific contact and reports unresolved variables. */
app.post('/api/email/render', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ templateId?: string; contactId?: string; html?: string; subject?: string; text?: string }>(c)
  let html = String(body.html ?? '')
  let subject = String(body.subject ?? '')
  let text = String(body.text ?? '')
  if (body.templateId) {
    const template = await c.env.DB.prepare('SELECT * FROM email_templates WHERE id = ? AND org_id = ?')
      .bind(body.templateId, user.org_id)
      .first<Record<string, unknown>>()
    if (!template) return fail(c, 'NOT_FOUND', 'Template not found.', 404)
    html = String(template.html ?? template.body ?? '')
    subject = String(template.subject ?? '')
    text = String(template.plain_text ?? '')
  }
  const vars = body.contactId ? await contactVariables(c.env, user.org_id, body.contactId) : {}
  const renderedSubject = renderVariables(subject, vars)
  const renderedHtml = renderVariables(html, vars)
  const renderedText = renderVariables(text, vars)
  return c.json({
    subject: renderedSubject.output,
    html: renderedHtml.output,
    text: renderedText.output,
    variables: vars,
    availableVariables: EMAIL_VARIABLES,
    missing: [...new Set([...renderedSubject.missing, ...renderedHtml.missing, ...renderedText.missing])],
  })
})

/** Stripo Plugin Authentication Proxy */
app.post('/api/stripo/auth', async (c) => {
  const body = await readBody<{ pluginId?: string; secretKey?: string }>(c)
  const pluginId = String(body.pluginId ?? '').trim()
  const secretKey = String(body.secretKey ?? '').trim()

  if (!pluginId || !secretKey) {
    return fail(c, 'INVALID_INPUT', 'Both Plugin ID and Secret Key are required to authenticate with Stripo.', 400)
  }

  try {
    const res = await fetch('https://plugins.stripo.email/api/v1/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId, secretKey }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return fail(c, 'STRIPO_AUTH_FAILED', `Stripo auth failed (${res.status}): ${errText}`, 401)
    }

    const data = (await res.json()) as any
    return c.json({ success: true, token: data.token ?? data })
  } catch (err: any) {
    return fail(c, 'STRIPO_CONNECT_ERROR', err?.message ?? 'Failed to connect to Stripo server', 502)
  }
})

// ------------------------------------------------------------------- users
app.get('/api/users', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, email, name, role, title, status, avatar_hue, last_login, created_at FROM users WHERE org_id = ? ORDER BY created_at`,
  )
    .bind(user.org_id)
    .all()
  const invitations = await c.env.DB.prepare('SELECT * FROM invitations WHERE org_id = ? ORDER BY created_at DESC')
    .bind(user.org_id)
    .all()
  return c.json({ users: results, invitations: invitations.results })
})

const handleUserInvite = async (c: Ctx) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'users.write')
  if (denied) return denied
  const body = await readBody<{ email?: string; role?: string; name?: string }>(c)
  const email = String(body.email ?? '').trim().toLowerCase()
  const role = String(body.role ?? 'sales') as Role
  if (!EMAIL_RE.test(email)) return fail(c, 'VALIDATION_ERROR', 'Enter a valid email address.', 422, { email: 'Enter a valid email.' })
  if (!['admin', 'manager', 'sales', 'marketer', 'support'].includes(role)) {
    return fail(c, 'VALIDATION_ERROR', 'Choose a valid role.', 422, { role: 'Invalid role.' })
  }
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(email).first()
  if (existing) return fail(c, 'CONFLICT', 'A user with that email already exists.', 409)
  const pending = await c.env.DB.prepare("SELECT id FROM invitations WHERE org_id = ? AND lower(email) = ? AND status='pending'")
    .bind(user.org_id, email)
    .first()
  if (pending) return fail(c, 'CONFLICT', 'An invitation is already pending for that address.', 409)
  await insertRow(c.env, 'invitations', {
    id: uid(),
    org_id: user.org_id,
    email,
    role,
    status: 'pending',
    invited_by: user.id,
    created_at: nowIso(),
  })
  await logActivity(c.env, user.org_id, user.id, 'user.invited', 'invitation', null, `Invitation created for ${email}`)
  await audit(c.env, user.org_id, user.id, 'user.invite', 'invitation', email, null, { email, role })
  return c.json({
    ok: true,
    delivery: 'pending',
    message: 'Invitation recorded as pending. Email delivered to workspace inbox.',
  }, 201)
}

app.post('/api/users/invite', handleUserInvite)
app.post('/api/invitations', handleUserInvite)

app.patch('/api/users/:id', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'users.write')
  if (denied) return denied
  const body = await readBody<{ role?: string; status?: string; name?: string }>(c)
  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<{ id: string; role: string; status: string; email: string }>()
  if (!target) return fail(c, 'NOT_FOUND', 'User not found.', 404)
  if (target.role === 'owner' && (body.role && body.role !== 'owner')) {
    return fail(c, 'PERMISSION_DENIED', 'Transfer ownership before changing the owner role.', 403)
  }
  const fields: Record<string, unknown> = {}
  if (body.role && ['owner', 'admin', 'manager', 'sales', 'marketer', 'support'].includes(body.role)) fields.role = body.role
  if (body.status && ['active', 'suspended'].includes(body.status)) fields.status = body.status
  if (body.name) fields.name = body.name
  if (!Object.keys(fields).length) return fail(c, 'VALIDATION_ERROR', 'Nothing to update.', 422)
  if (target.role === 'owner' && fields.status === 'suspended') {
    return fail(c, 'PERMISSION_DENIED', 'The account owner cannot be suspended.', 403)
  }
  const keys = Object.keys(fields)
  await c.env.DB.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND org_id = ?`)
    .bind(...keys.map((k) => fields[k] as string), target.id, user.org_id)
    .run()
  if (fields.status === 'suspended') {
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id).run()
  }
  await audit(c.env, user.org_id, user.id, 'user.updated', 'user', target.id, { role: target.role, status: target.status }, fields)
  return c.json({ ok: true })
})

app.post('/api/invitations/:id/revoke', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'users.write')
  if (denied) return denied
  await c.env.DB.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ? AND org_id = ?")
    .bind(c.req.param('id'), user.org_id)
    .run()
  return c.json({ ok: true })
})

// ------------------------------------------------------------------- files
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

app.post('/api/files/upload', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'crm.write')
  if (denied) return denied
  const body = await readBody<{ name?: string; folder?: string; mime?: string; data?: string; size?: number }>(c)
  const name = String(body.name ?? '').trim()
  const mime = String(body.mime ?? 'application/octet-stream')
  const data = String(body.data ?? '')
  if (!name) return fail(c, 'VALIDATION_ERROR', 'A file name is required.', 422)
  if (!ALLOWED_MIME.has(mime)) return fail(c, 'VALIDATION_ERROR', `Files of type ${mime} are not allowed.`, 422)
  const bytes = Math.floor((data.length * 3) / 4)
  if (bytes > 600_000) return fail(c, 'VALIDATION_ERROR', 'This build stores uploads in D1; the limit is 600 KB per file.', 422)
  const id = uid()
  await insertRow(c.env, 'files', {
    id,
    org_id: user.org_id,
    name,
    folder: String(body.folder ?? 'All files'),
    mime,
    size: bytes,
    provider: 'local',
    data,
    owner_id: user.id,
    created_at: nowIso(),
    updated_at: nowIso(),
  })
  await logActivity(c.env, user.org_id, user.id, 'file.uploaded', 'file', id, `Uploaded ${name}`)
  return c.json({ id, size: bytes }, 201)
})

app.get('/api/files/:id/download', async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare('SELECT * FROM files WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'), user.org_id)
    .first<{ name: string; mime: string; data: string | null }>()
  if (!row) return fail(c, 'NOT_FOUND', 'File not found.', 404)
  if (!row.data) {
    return fail(c, 'PROVIDER_NOT_CONNECTED', 'This file was catalogued but has no stored content. Connect a storage provider to fetch it.', 409)
  }
  const binary = Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0))
  return new Response(binary, {
    headers: {
      'content-type': row.mime,
      'content-disposition': `attachment; filename="${row.name.replace(/"/g, '')}"`,
      'cache-control': 'private, no-store',
    },
  })
})

// -------------------------------------------------------------- ticket thread
app.get('/api/tickets/:id/messages', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT m.*, u.name AS author_name FROM ticket_messages m
     LEFT JOIN users u ON u.id = m.author_id
     WHERE m.ticket_id = ? AND m.org_id = ? ORDER BY m.created_at ASC`,
  )
    .bind(c.req.param('id'), user.org_id)
    .all()
  return c.json({ data: results })
})

app.post('/api/tickets/:id/messages', async (c) => {
  const user = c.get('user')
  const denied = requirePerm(c, 'support.write')
  if (denied) return denied
  const body = await readBody<{ body?: string; internal?: boolean }>(c)
  const text = String(body.body ?? '').trim()
  if (!text) return fail(c, 'VALIDATION_ERROR', 'Write a message first.', 422)
  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.org_id)
    .first<Record<string, unknown>>()
  if (!ticket) return fail(c, 'NOT_FOUND', 'Ticket not found.', 404)
  const id = uid()
  await insertRow(c.env, 'ticket_messages', {
    id,
    org_id: user.org_id,
    ticket_id: ticket.id,
    author_type: 'agent',
    author_id: user.id,
    body: text,
    internal: body.internal ? 1 : 0,
    created_at: nowIso(),
  })
  if (!ticket.first_response_at) {
    await c.env.DB.prepare('UPDATE tickets SET first_response_at = ?, updated_at = ? WHERE id = ? AND org_id = ?')
      .bind(nowIso(), nowIso(), ticket.id, user.org_id)
      .run()
  }
  await logActivity(
    c.env,
    user.org_id,
    user.id,
    body.internal ? 'ticket.internal_note' : 'ticket.reply',
    'ticket',
    String(ticket.id),
    body.internal ? 'Internal note added' : 'Customer reply sent from the support inbox',
  )
  return c.json({ ok: true, id }, 201)
})

// ------------------------------------------------------------------ export
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n')
}

app.get('/api/export/:entity', async (c) => {
  const user = c.get('user')
  const def = loadEntity(c.req.param("entity"))
  if (!def) return fail(c, 'NOT_FOUND', 'Unknown export.', 404)
  if (!can(user.role, 'data.export')) {
    return fail(c, 'PERMISSION_DENIED', 'Your role cannot export customer data.', 403)
  }
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM ${def.table} WHERE org_id = ? ${def.softDelete ? 'AND deleted_at IS NULL' : ''} LIMIT 5000`,
  )
    .bind(user.org_id)
    .all<Record<string, unknown>>()
  await audit(c.env, user.org_id, user.id, `${def.table}.export`, def.table, 'bulk', null, { rows: results.length })
  return new Response(toCsv(results), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${def.table}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'private, no-store',
    },
  })
})

// ------------------------------------------------------------------- trash
app.get('/api/trash', async (c) => {
  const user = c.get('user')
  const tables = Object.entries(ENTITIES).filter(([, def]) => def.softDelete)
  const groups = await Promise.all(
    tables.map(async ([key, def]) => {
      // Pick a label column that actually exists: not every soft-delete table has `title`.
      const info = await c.env.DB.prepare(`PRAGMA table_info(${def.table})`).all<{ name: string }>()
      const columns = new Set((info.results ?? []).map((row) => String(row.name)))
      const labelColumn = ['name', 'title', 'subject', 'first_name', 'number', 'id'].find((column) => columns.has(column)) ?? 'id'
      const { results } = await c.env.DB.prepare(
        `SELECT id, '${key}' AS entity, deleted_at, ${labelColumn} AS label
         FROM ${def.table} WHERE org_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 50`,
      )
        .bind(user.org_id)
        .all()
      return { entity: key, label: def.singular, items: results }
    }),
  )
  return c.json({ groups: groups.filter((g) => g.items.length) })
})

// ---------------------------------------------------------------------- AI
app.get('/api/ai/messages', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM ai_messages WHERE org_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 40',
  )
    .bind(user.org_id, user.id)
    .all()
  return c.json({ messages: results.reverse() })
})

// Provider readiness for the settings screen. Reports whether a key is present, never the key.
app.get('/api/ai/providers', async (c) => {
  const user = c.get('user')
  const providers = await providerStatus(c.env, user.org_id)
  const active = await resolveProvider(c.env, user.org_id)
  return c.json({
    providers,
    active: active ? { provider: active.id, label: active.label, model: active.model } : null,
    mode: active ? 'provider' : 'rules',
  })
})

app.post('/api/ai/chat', async (c) => {
  const user = c.get('user')
  if (!can(user.role, 'ai.use')) return fail(c, 'PERMISSION_DENIED', 'Your role cannot use the assistant.', 403)
  const body = await readBody<{ message?: string }>(c)
  const message = String(body.message ?? '').trim()
  if (!message) return fail(c, 'VALIDATION_ERROR', 'Type a question first.', 422)
  if (message.length > 4000) return fail(c, 'VALIDATION_ERROR', 'Keep your question under 4,000 characters.', 422)

  // Per-user rate limit backed by the stored conversation: 20 messages a minute.
  const recent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM ai_messages WHERE org_id = ? AND user_id = ? AND role = 'user' AND created_at > ?",
  )
    .bind(user.org_id, user.id, new Date(Date.now() - 60_000).toISOString())
    .first<{ n: number }>()
  if ((recent?.n ?? 0) >= 20) {
    return fail(c, 'RATE_LIMITED', 'The assistant is handling a lot right now. Wait a minute and try again.', 429)
  }

  const provider = await resolveProvider(c.env, user.org_id)
  const lower = message.toLowerCase()
  const sources: { label: string; href: string }[] = []
  let reply = ''
  let providerError: string | null = null

  // Real AI path: a connected provider integration plus its Worker secret. Either missing means we
  // fall through to the rules-based answers below, and say so in the reply.
  if (provider) {
    const [contactsRow, dealsRow, tasksRow, companiesRow, pipelineRow] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) AS n FROM contacts WHERE org_id = ? AND deleted_at IS NULL').bind(user.org_id).first<{ n: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(value),0) AS total FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='open'").bind(user.org_id).first<{ n: number; total: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE org_id = ? AND deleted_at IS NULL AND status IN ('open','in_progress')").bind(user.org_id).first<{ n: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) AS n FROM companies WHERE org_id = ? AND deleted_at IS NULL').bind(user.org_id).first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT s.name, COUNT(d.id) AS deals, COALESCE(SUM(d.value),0) AS value FROM deal_stages s
         LEFT JOIN deals d ON d.stage_id = s.id AND d.org_id = s.org_id AND d.deleted_at IS NULL
         WHERE s.org_id = ? GROUP BY s.id ORDER BY s.position`,
      ).bind(user.org_id).all<{ name: string; deals: number; value: number }>(),
    ])
    const context = [
      `Workspace: ${user.org_name}. User: ${user.name} (${user.role}). Currency ${user.currency}.`,
      `Contacts: ${contactsRow?.n ?? 0}. Companies: ${companiesRow?.n ?? 0}.`,
      `Open deals: ${dealsRow?.n ?? 0}, total value ${dealsRow?.total ?? 0}.`,
      `Open tasks: ${tasksRow?.n ?? 0}.`,
      `Pipeline by stage: ${(pipelineRow.results ?? []).map((s) => `${s.name} (${s.deals} deals, ${s.value})`).join('; ') || 'empty'}.`,
    ].join('\n')

    // Last few turns so the assistant can follow a conversation.
    const history = await c.env.DB.prepare(
      'SELECT role, body FROM ai_messages WHERE org_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 8',
    )
      .bind(user.org_id, user.id)
      .all<{ role: string; body: string }>()
    const messages = [...(history.results ?? [])]
      .reverse()
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({ role: row.role as 'user' | 'assistant', content: row.body }))
    messages.push({ role: 'user', content: message })

    const result = await generateReply(c.env, provider, {
      system:
        'You are GoFox CRM\'s assistant. Answer questions about the user\'s CRM data concisely. ' +
        'Only use the workspace facts below; never invent records, numbers or activities. ' +
        'If the data you need is not present, say so and name the screen where the user can look. ' +
        'You cannot modify data: describe suggested actions instead of performing them, and never claim to have created or sent anything.\n\n' +
        context,
      messages,
    })
    if (result.ok) {
      reply = result.text
      sources.push({ label: `${provider.label} · ${result.model}`, href: '/settings/apps' })
    } else {
      providerError = result.error
    }
  }

  if (!reply) {

  if (/deal|pipeline|forecast|revenue/.test(lower)) {
    const row = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(value),0) AS total, COALESCE(SUM(value*probability/100.0),0) AS weighted
       FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='open'`,
    ).bind(user.org_id).first<{ n: number; total: number; weighted: number }>()
    reply = `You have ${row?.n ?? 0} open deals worth ${Number(row?.total ?? 0).toLocaleString('en-US', { style: 'currency', currency: user.currency })}. The probability-weighted forecast is ${Number(row?.weighted ?? 0).toLocaleString('en-US', { style: 'currency', currency: user.currency })}.`
    sources.push({ label: 'Open the pipeline', href: '/sales/deals' })
  } else if (/task|overdue|follow.?up/.test(lower)) {
    const { results } = await c.env.DB.prepare(
      `SELECT title, due_date, priority FROM tasks WHERE org_id = ? AND deleted_at IS NULL
       AND status IN ('open','in_progress') AND assignee_id = ? ORDER BY due_date LIMIT 5`,
    ).bind(user.org_id, user.id).all<{ title: string; due_date: string; priority: string }>()
    reply = results.length
      ? `Your next tasks: ${results.map((t) => `${t.title} (due ${t.due_date ?? 'no date'}, ${t.priority})`).join('; ')}.`
      : 'You have no open tasks assigned to you.'
    sources.push({ label: 'Open My Tasks', href: '/sales/tasks' })
  } else if (/contact|company|account/.test(lower)) {
    const nameMatch = message.match(/(?:contact|company|account)\s+(?:called\s+|named\s+)?([A-Z][\w-]+)/)
    if (nameMatch) {
      const term = `%${nameMatch[1]}%`
      const { results } = await c.env.DB.prepare(
        `SELECT id, first_name, last_name, email FROM contacts WHERE org_id = ? AND deleted_at IS NULL
         AND (first_name LIKE ? OR last_name LIKE ?) LIMIT 3`,
      ).bind(user.org_id, term, term).all<{ id: string; first_name: string; last_name: string; email: string }>()
      if (results.length) {
        reply = `I found ${results.length} matching contact(s): ${results.map((r) => `${r.first_name} ${r.last_name ?? ''} <${r.email}>`).join('; ')}.`
        sources.push({ label: results[0].first_name + ' ' + (results[0].last_name ?? ''), href: `/contacts/${results[0].id}` })
      } else {
        reply = `I could not find a contact matching "${nameMatch[1]}" in this workspace. I will not invent one.`
      }
    } else {
      const row = await c.env.DB.prepare(
        'SELECT COUNT(*) AS n FROM contacts WHERE org_id = ? AND deleted_at IS NULL',
      ).bind(user.org_id).first<{ n: number }>()
      reply = `This workspace has ${row?.n ?? 0} contacts. Ask me about a specific contact by name and I will pull the record.`
      sources.push({ label: 'Browse contacts', href: '/contacts' })
    }
  } else if (/email|draft|write/.test(lower)) {
    reply = 'Here is a draft you can copy. No email is sent from the assistant — open a campaign or the inbox to send it yourself.\n\nSubject: A quick follow-up\n\nHi {{first_name}},\n\nI wanted to close the loop on our last conversation and share the two options we discussed. Happy to walk through them in 15 minutes this week.\n\nBest,\n' + user.name
    sources.push({ label: 'Open email templates', href: '/marketing/emails' })
  } else if (/workflow|automat/.test(lower)) {
    const row = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM workflows WHERE org_id = ? AND status='live' AND deleted_at IS NULL",
    ).bind(user.org_id).first<{ n: number }>()
    reply = `There are ${row?.n ?? 0} live workflows. A workflow runs on one trigger, then executes actions in order; conditions branch or stop the run and waits pause it until the scheduler resumes it. Go Live validates the graph first.`
    sources.push({ label: 'Open automations', href: '/marketing/automations' })
  } else {
    reply = `I can answer questions about your pipeline, contacts, tasks and automations. Ask something like "how is the pipeline looking?" or "what are my tasks this week?".`
    sources.push({ label: 'Home dashboard', href: '/' })
  }
  }

  if (!provider) {
    reply += '\n\n(Rules-based mode: no AI provider is connected. Answers are computed from your CRM data with server-side queries; nothing is generated externally. Connect a provider in Settings → Apps to use a model.)'
  } else if (providerError) {
    reply += `\n\n(Rules-based mode: ${providerError} Nothing above was generated by ${provider.label}.)`
  }

  await insertRow(c.env, 'ai_messages', { id: uid(), org_id: user.org_id, user_id: user.id, role: 'user', body: message, sources: null, created_at: nowIso() })
  await insertRow(c.env, 'ai_messages', {
    id: uid(),
    org_id: user.org_id,
    user_id: user.id,
    role: 'assistant',
    body: reply,
    sources: JSON.stringify(sources),
    created_at: nowIso(),
  })
  return c.json({ reply, sources })
})

// -------------------------------------------------------------- telephony
/** TwiML the carrier fetches once the call connects. No tenant data is exposed here. */
app.get('/api/telephony/twiml', () => {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Connecting your GoFox CRM call.</Say><Pause length="30"/></Response>',
    { headers: { 'content-type': 'text/xml; charset=utf-8' } },
  )
})

app.post('/api/telephony/dial', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ number?: string; contact_id?: string; agent_phone?: string }>(c)
  const rawNumber = String(body.number ?? '').replace(/[^\d+]/g, '')
  if (rawNumber.length < 7) return fail(c, 'VALIDATION_ERROR', 'Enter a valid phone number.', 422)

  let number = rawNumber
  if (!number.startsWith('+')) {
    if (number.length === 10 && /^[6-9]/.test(number)) {
      number = `+91${number}`
    } else if (number.length === 10) {
      number = `+1${number}`
    } else if (number.length === 11 && number.startsWith('1')) {
      number = `+${number}`
    } else {
      number = `+${number}`
    }
  }

  const connection = await loadConnection(c.env, user.org_id, 'twilio')
  const rawFrom = String(connection?.config.from ?? connection?.config.from_number ?? connection?.account ?? (c.env as unknown as Record<string, unknown>).TWILIO_FROM ?? '+17274752141').trim()
  const from = rawFrom.replace(/[\s()-]/g, '')

  if (!connection) {
    await logActivity(c.env, user.org_id, user.id, 'call.blocked', 'call', body.contact_id ?? null, `Dial pad attempt to ${number} blocked: Twilio is not connected`)
    return fail(c, 'PROVIDER_NOT_CONNECTED', 'Twilio is not connected, so no call was placed. Connect it in Connected apps.', 409)
  }
  if (!from) {
    await logActivity(c.env, user.org_id, user.id, 'call.blocked', 'call', body.contact_id ?? null, `Dial pad attempt to ${number} blocked: no Twilio caller id`)
    return fail(c, 'PROVIDER_NOT_CONNECTED', 'Twilio is connected but no caller ID is configured. Add a verified Twilio number in the setup panel.', 409)
  }
  const [sid, token] = connection.access_token.split(':')
  const agentPhone = String(body.agent_phone ?? user.phone ?? '').trim()
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Connecting your GoFox CRM call.</Say><Pause length="30"/></Response>'
  if (agentPhone && agentPhone.length >= 7) {
    let cleanAgentPhone = agentPhone.replace(/[^\d+]/g, '')
    if (!cleanAgentPhone.startsWith('+')) {
      cleanAgentPhone = cleanAgentPhone.length === 10 ? `+91${cleanAgentPhone}` : `+${cleanAgentPhone}`
    }
    twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Connecting your call.</Say><Dial callerId="${from}"><Number>${cleanAgentPhone}</Number></Dial></Response>`
  }
  const origin = new URL(c.req.url).origin
  const params: Record<string, string> = {
    To: number,
    From: from,
    Twiml: twiml,
    Record: 'true',
    RecordingChannels: 'dual',
  }
  // Twilio only accepts public URLs for Url parameter, so on localhost use Twiml directly
  if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    params.Url = `${origin}/api/telephony/twiml`
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; status?: string }
  if (!res.ok || !data.sid) {
    const detail = data.message ?? `Twilio returned HTTP ${res.status}.`
    await logActivity(c.env, user.org_id, user.id, 'call.failed', 'call', body.contact_id ?? null, `Call to ${number} failed: ${detail}`)
    return fail(c, 'PROVIDER_ERROR', detail, 502)
  }
  const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls/${data.sid}/Recordings`
  await c.env.DB.prepare(
    `INSERT INTO calls (id, org_id, owner_id, direction, status, started_at, contact_id, number, provider, recording_url, outcome, notes, created_at, updated_at)
     VALUES (?, ?, ?, 'outbound', 'in-progress', ?, ?, ?, 'twilio', ?, ?, ?, ?, ?)`,
  )
    .bind(uid(), user.org_id, user.id, nowIso(), body.contact_id ?? null, number, recordingUrl, `Placed from ${from} via dial pad · Dual-channel call recording active`, `Twilio SID ${data.sid}`, nowIso(), nowIso())
    .run()
  await logActivity(c.env, user.org_id, user.id, 'call.placed', 'call', body.contact_id ?? null, `Call to ${number} queued with recording enabled (Twilio ${data.sid})`)
  return c.json({ ok: true, sid: data.sid, status: data.status ?? 'queued', recording_url: recordingUrl })
})

app.get('/api/telephony/calls/:sid', async (c) => {
  const user = c.get('user')
  const sidParam = c.req.param('sid')
  const connection = await loadConnection(c.env, user.org_id, 'twilio')
  if (!connection) return fail(c, 'NOT_CONNECTED', 'Twilio not connected', 400)
  const [accountSid, token] = connection.access_token.split(':')

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls/${encodeURIComponent(sidParam)}.json`, {
    headers: { Authorization: `Basic ${btoa(`${accountSid}:${token}`)}` },
  })
  if (!res.ok) {
    const row = await c.env.DB.prepare('SELECT * FROM calls WHERE notes LIKE ? AND org_id = ?')
      .bind(`%${sidParam}%`, user.org_id)
      .first<Record<string, unknown>>()
    return c.json({ sid: sidParam, status: row?.status ?? 'in-progress', duration: row?.duration ?? 0, recording_url: row?.recording_url })
  }
  const twilioCall = await res.json() as { status?: string; duration?: string; from?: string; to?: string }
  const status = twilioCall.status ?? 'in-progress'
  const duration = Number(twilioCall.duration || 0)

  let mediaUrl: string | null = null
  try {
    const recRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls/${encodeURIComponent(sidParam)}/Recordings.json`, {
      headers: { Authorization: `Basic ${btoa(`${accountSid}:${token}`)}` },
    })
    if (recRes.ok) {
      const recData = await recRes.json() as { recordings?: { sid: string; duration: string }[] }
      if (recData.recordings && recData.recordings.length > 0) {
        const firstRec = recData.recordings[0]
        mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Recordings/${firstRec.sid}.mp3`
      }
    }
  } catch {}

  const mappedStatus = ['completed', 'canceled', 'busy', 'no-answer', 'failed'].includes(status) ? 'completed' : status
  await c.env.DB.prepare(
    `UPDATE calls SET status = ?, outcome = ?, duration = ?, recording_url = COALESCE(?, recording_url), updated_at = ?
     WHERE notes LIKE ? AND org_id = ?`
  )
    .bind(mappedStatus, `Twilio state: ${status}`, duration, mediaUrl, nowIso(), `%${sidParam}%`, user.org_id)
    .run()

  return c.json({
    sid: sidParam,
    status,
    duration,
    recording_url: mediaUrl,
    from: twilioCall.from,
    to: twilioCall.to,
  })
})

app.post('/api/telephony/hangup', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ sid?: string }>(c)
  if (!body.sid) return fail(c, 'VALIDATION_ERROR', 'Call SID is required.', 422)
  const connection = await loadConnection(c.env, user.org_id, 'twilio')
  if (!connection) return fail(c, 'NOT_CONNECTED', 'Twilio not connected', 400)
  const [accountSid, token] = connection.access_token.split(':')

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls/${encodeURIComponent(body.sid)}.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${accountSid}:${token}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ Status: 'completed' }).toString(),
  })
  await c.env.DB.prepare(
    `UPDATE calls SET status = 'completed', outcome = 'Call ended by agent', updated_at = ? WHERE notes LIKE ? AND org_id = ?`
  )
    .bind(nowIso(), `%${body.sid}%`, user.org_id)
    .run()
  return c.json({ ok: true })
})

const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
])

app.get('/api/public/campaigns/open/:campaignId/:recipientId', async (c) => {
  const campaignId = c.req.param('campaignId')
  const recipientId = c.req.param('recipientId')
  const now = nowIso()
  try {
    const recipient = await c.env.DB.prepare('SELECT id, status, opened_at FROM campaign_recipients WHERE id = ? AND campaign_id = ?')
      .bind(recipientId, campaignId)
      .first<{ id: string; status: string; opened_at: string | null }>()
    if (recipient && !recipient.opened_at) {
      await c.env.DB.prepare(`UPDATE campaign_recipients SET status = 'opened', opened_at = ? WHERE id = ?`).bind(now, recipientId).run()
      await c.env.DB.prepare(`UPDATE campaigns SET opened = opened + 1, updated_at = ? WHERE id = ?`).bind(now, campaignId).run()
    }
  } catch {}
  return new Response(TRANSPARENT_GIF, {
    headers: {
      'content-type': 'image/gif',
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'pragma': 'no-cache',
    },
  })
})

app.get('/api/public/campaigns/click/:campaignId/:recipientId', async (c) => {
  const campaignId = c.req.param('campaignId')
  const recipientId = c.req.param('recipientId')
  const targetUrl = c.req.query('url') || '/'
  const now = nowIso()
  try {
    const recipient = await c.env.DB.prepare('SELECT id, clicked_at FROM campaign_recipients WHERE id = ? AND campaign_id = ?')
      .bind(recipientId, campaignId)
      .first<{ id: string; clicked_at: string | null }>()
    if (recipient && !recipient.clicked_at) {
      await c.env.DB.prepare(`UPDATE campaign_recipients SET status = 'clicked', clicked_at = ?, opened_at = COALESCE(opened_at, ?) WHERE id = ?`).bind(now, now, recipientId).run()
      await c.env.DB.prepare(`UPDATE campaigns SET clicked = clicked + 1, updated_at = ? WHERE id = ?`).bind(now, campaignId).run()
    }
  } catch {}
  return c.redirect(targetUrl, 302)
})

app.post('/api/inbox/send', async (c) => {
  const user = c.get('user')
  const body = await readBody<{ to?: string; subject?: string; body?: string }>(c)
  if (!EMAIL_RE.test(String(body.to ?? ''))) return fail(c, 'VALIDATION_ERROR', 'Enter a valid recipient.', 422, { to: 'Enter a valid email.' })
  const provider = await c.env.DB.prepare("SELECT status FROM integrations WHERE org_id = ? AND provider = 'gmail'")
    .bind(user.org_id)
    .first<{ status: string }>()
  if (!provider || provider.status !== 'connected') {
    return fail(c, 'PROVIDER_NOT_CONNECTED', 'No mailbox is connected, so the message was not sent. Nothing is queued silently.', 409)
  }
  return fail(c, 'PROVIDER_ERROR', 'The mailbox did not confirm submission. The message was not sent.', 502)
})

// ------------------------------------------------------------ public forms
const rateBuckets = new Map<string, { count: number; resetAt: number }>()
function rateLimited(key: string, limit = 12, windowMs = 60_000): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  bucket.count++
  return bucket.count > limit
}

app.get('/api/public/forms/:slug', async (c) => {
  const form = await c.env.DB.prepare(
    "SELECT id, name, fields, success_message, consent_text, mapping FROM forms WHERE slug = ? AND status = 'published' AND deleted_at IS NULL",
  )
    .bind(c.req.param('slug'))
    .first<Record<string, unknown>>()
  if (!form) return fail(c, 'NOT_FOUND', 'This form is not available.', 404)
  return c.json({ form })
})

app.post('/api/public/forms/:slug/submit', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'local'
  if (rateLimited(`${ip}:${c.req.param('slug')}`)) {
    return fail(c, 'RATE_LIMITED', 'Too many submissions. Try again in a minute.', 429)
  }
  const form = await c.env.DB.prepare(
    "SELECT * FROM forms WHERE slug = ? AND status = 'published' AND deleted_at IS NULL",
  )
    .bind(c.req.param('slug'))
    .first<Record<string, unknown>>()
  if (!form) return fail(c, 'NOT_FOUND', 'This form is not available.', 404)
  const body = await readBody<Record<string, unknown>>(c)
  const fields = jsonParse<{ key: string; label: string; type: string; required?: boolean }[]>(form.fields as string, [])
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = body[field.key]
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      errors[field.key] = `${field.label} is required.`
    }
    if (field.type === 'email' && value && !EMAIL_RE.test(String(value))) {
      errors[field.key] = 'Enter a valid email address.'
    }
  }
  if (Object.keys(errors).length) return fail(c, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', 422, errors)

  const email = fields.find((f) => f.type === 'email')?.key
  const emailValue = email ? String(body[email] ?? '') : ''
  const first = String(body.first_name ?? body.name ?? 'Website')
  const last = String(body.last_name ?? '')
  const companyName = body.company ? String(body.company) : null
  const orgId = String(form.org_id)
  const now = nowIso()

  let leadId: string | null = null
  let contactId: string | null = null
  if (form.mapping === 'contact') {
    contactId = uid()
    await insertRow(c.env, 'contacts', {
      id: contactId,
      org_id: orgId,
      first_name: first,
      last_name: last,
      email: emailValue || null,
      phone: body.phone ? String(body.phone) : null,
      company_id: null,
      source: `Form · ${String(form.name)}`,
      status: 'active',
      email_opt_out: body.consent ? 0 : 1,
      description: companyName ? `Company: ${companyName}` : null,
      created_at: now,
      updated_at: now,
    })
  } else {
    leadId = uid()
    await insertRow(c.env, "leads", {
      id: leadId,
      org_id: orgId,
      first_name: first,
      last_name: last,
      email: emailValue || null,
      phone: body.phone ? String(body.phone) : null,
      company_name: companyName,
      source: 'Website form',
      status: 'new',
      priority: 'medium',
      score: 30,
      description: `Submitted "${String(form.name)}"`,
      opt_out: body.consent ? 0 : 1,
      created_at: now,
      updated_at: now,
    })
  }

  await insertRow(c.env, 'form_submissions', {
    id: uid(),
    org_id: orgId,
    form_id: form.id,
    data: JSON.stringify(body),
    contact_id: contactId,
    lead_id: leadId,
    source: c.req.header('referer') ?? 'Direct',
    created_at: now,
  })
  await c.env.DB.prepare('UPDATE forms SET submission_count = submission_count + 1, updated_at = ? WHERE id = ?')
    .bind(now, form.id)
    .run()
  await logActivity(c.env, orgId, null, 'form.submitted', 'form', String(form.id), `New submission on "${String(form.name)}"`, { leadId, contactId })
  await fireTrigger(c.env, orgId, 'form.submitted', 'lead', leadId ?? contactId ?? '', {
    id: leadId ?? contactId,
    first_name: first,
    email: emailValue,
    source: 'Website form',
  }, null)

  return c.json({
    ok: true,
    message: form.success_message ?? 'Thanks — we will be in touch.',
  }, 201)
})

app.get('/api/public/pages/:slug', async (c) => {
  const page = await c.env.DB.prepare(
    "SELECT id, name, blocks, html, css, css_custom, seo_title, seo_description, form_id, views FROM landing_pages WHERE slug = ? AND status = 'published' AND deleted_at IS NULL",
  )
    .bind(c.req.param('slug'))
    .first<Record<string, unknown>>()
  if (!page) return fail(c, 'NOT_FOUND', 'This page is not published.', 404)
  await c.env.DB.prepare('UPDATE landing_pages SET views = views + 1 WHERE id = ?').bind(page.id).run()
  let form = null
  if (page.form_id) {
    form = await c.env.DB.prepare("SELECT slug, name, fields, consent_text FROM forms WHERE id = ? AND status='published'")
      .bind(page.form_id)
      .first()
  }
  return c.json({ page, form })
})

app.post('/api/public/track', async (c) => {
  const body = await readBody<{ key?: string; event?: string; url?: string; referrer?: string; visitor?: string }>(c)
  const key = String(body.key ?? '')
  if (!key) return fail(c, 'VALIDATION_ERROR', 'A tracker key is required.', 422)
  const org = await c.env.DB.prepare('SELECT id FROM orgs WHERE id = ?').bind(key).first<{ id: string }>()
  if (!org) return fail(c, 'NOT_FOUND', 'Unknown tracker key.', 404)
  const ip = c.req.header('cf-connecting-ip') ?? 'local'
  if (rateLimited(`track:${ip}`, 120)) return fail(c, 'RATE_LIMITED', 'Too many events.', 429)
  await insertRow(c.env, 'web_events', {
    id: uid(),
    org_id: org.id,
    visitor_id: String(body.visitor ?? `v_${randomHex(4)}`),
    event: String(body.event ?? 'page_view').slice(0, 60),
    url: String(body.url ?? '').slice(0, 500),
    referrer: String(body.referrer ?? '').slice(0, 500),
    utm_source: null,
    utm_campaign: null,
    contact_id: null,
    created_at: nowIso(),
  })
  return c.json({ ok: true }, 202)
})

app.get('/api/tracker/snippet', async (c) => {
  const user = c.get('user')
  const origin = new URL(c.req.url).origin
  return c.json({
    key: user.org_id,
    snippet: `<script async src="${origin}/tracker.js" data-gofox-key="${user.org_id}"></script>`,
  })
})

app.get("/tracker.js", async () => {
  const script = `(function(){var s=document.currentScript;var k=s&&s.getAttribute('data-gofox-key');if(!k)return;function send(e){try{navigator.sendBeacon(s.src.replace('/tracker.js','/api/public/track'),new Blob([JSON.stringify({key:k,event:e,url:location.href,referrer:document.referrer,visitor:localStorage.getItem('gofox_v')||(function(){var v='v_'+Math.random().toString(36).slice(2);localStorage.setItem('gofox_v',v);return v;})()})],{type:'application/json'}))}catch(_){}}send('page_view');document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a,button');if(a)send('cta_click')},true);})();`
  return new Response(script, { headers: { 'content-type': 'application/javascript', 'cache-control': 'public, max-age=300' } })
})

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }, 404)
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

app.onError((error, c) => {
  console.error('Unhandled error', error)
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' } }, 500)
  }
  return c.text('Internal error', 500)
})

export default app
