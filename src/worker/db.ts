import { SCHEMA } from './schema'

export type Env = {
  ASSETS: Fetcher
  DB: D1Database
  /** Public Firebase project id used to verify Google SSO ID tokens. */
  FIREBASE_PROJECT_ID?: string
  /** Canonical public origin for OAuth redirect URIs (falls back to request headers). */
  APP_ORIGIN?: string
  /** Alternative public base URL used to build OAuth redirect URIs. */
  APP_BASE_URL?: string
  /** Google OAuth web client. Both values are required for Gmail to connect. */
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** Exact redirect URI registered in Google Cloud Console. */
  GOOGLE_REDIRECT_URI?: string
  /** Optional HMAC secret used to sign the OAuth state parameter. */
  GOOGLE_OAUTH_STATE_SECRET?: string
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_SECRET?: string
}

export const nowIso = () => new Date().toISOString()
export const uid = () => crypto.randomUUID()

export function jsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback
  if (typeof raw !== 'string') return raw as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function toJson(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null)
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000)
}

/** Deterministic PRNG so seeded demo data is stable between resets. */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Applies the schema once per isolate and seeds the demo organisation on an
 * empty database. Schema statements are idempotent, so a cold start after a
 * deployment is safe.
 */
let ready: Promise<void> | null = null

export function ensureDb(env: Env): Promise<void> {
  if (!ready) {
    ready = (async () => {
      // Strip SQL comments before splitting: a `;` inside a comment would otherwise cut a
      // statement in half and D1 would reject the fragment with a syntax error.
      const statements = SCHEMA.replace(/--[^\n]*/g, '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => env.DB.prepare(s))
      for (let i = 0; i < statements.length; i += 40) {
        await env.DB.batch(statements.slice(i, i + 40))
      }
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM orgs').first<{ n: number }>()
      if (!row || row.n === 0) {
        const { seed } = await import('./seed')
        await seed(env)
      }
      // Columns added after the first deployment. ALTER TABLE has no IF NOT EXISTS in D1, so a
      // duplicate-column error means the migration already ran and is safe to ignore.
      for (const statement of [
        'ALTER TABLE integrations ADD COLUMN config TEXT',
        'ALTER TABLE integration_tokens ADD COLUMN config TEXT',
        'ALTER TABLE workflows ADD COLUMN edges TEXT',
        'ALTER TABLE landing_pages ADD COLUMN html TEXT',
        'ALTER TABLE landing_pages ADD COLUMN css TEXT',
        'ALTER TABLE landing_pages ADD COLUMN css_custom TEXT',
        'ALTER TABLE email_templates ADD COLUMN html TEXT',
        'ALTER TABLE email_templates ADD COLUMN css TEXT',
        'ALTER TABLE email_templates ADD COLUMN plain_text TEXT',
        'ALTER TABLE email_templates ADD COLUMN builder TEXT',
        'ALTER TABLE email_templates ADD COLUMN thumbnail TEXT',
        'ALTER TABLE companies ADD COLUMN size TEXT',
        'ALTER TABLE companies ADD COLUMN rating REAL DEFAULT 0',
        'ALTER TABLE leads ADD COLUMN lead_type TEXT NOT NULL DEFAULT "person"',
        'ALTER TABLE leads ADD COLUMN birthday TEXT',
        'ALTER TABLE leads ADD COLUMN value REAL NOT NULL DEFAULT 0',
        'ALTER TABLE leads ADD COLUMN currency TEXT NOT NULL DEFAULT "USD"',
        'ALTER TABLE leads ADD COLUMN industry TEXT',
        // Slugs were globally unique, which broke tenant isolation and made re-creating a
        // soft-deleted slug throw a 500. Scope them per organisation and ignore deleted rows.
        'DROP INDEX IF EXISTS pages_slug_idx',
        'DROP INDEX IF EXISTS forms_slug_idx',
        'CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_org_idx ON landing_pages(org_id, slug) WHERE deleted_at IS NULL',
        'CREATE UNIQUE INDEX IF NOT EXISTS forms_slug_org_idx ON forms(org_id, slug) WHERE deleted_at IS NULL',
      ]) {
        try {
          await env.DB.prepare(statement).run()
        } catch {
          /* column already exists */
        }
      }
      await repairLegacyWorkflowActions(env)
    })().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

/**
 * One-off, idempotent data repair for demo workflows written by an earlier seed: their action nodes
 * had no `action` field, so the engine fell back to sending a notification and a node labelled
 * "Create follow-up task" never created a task. Records are rewritten in place — nothing is deleted.
 * Safe to run on every cold start: it only touches nodes that still have no action.
 */
async function repairLegacyWorkflowActions(env: Env) {
  const { results } = await env.DB.prepare('SELECT id, nodes FROM workflows').all<{ id: string; nodes: string }>()
  if (!results?.length) return
  const infer = (label: string): string | null => {
    const text = label.toLowerCase()
    if (text.includes('create') && text.includes('task')) return 'create_task'
    if (text.includes('escalation') || text.includes('escalate')) return 'create_task'
    if (text.includes('notify')) return 'notify'
    if (text.includes('tag')) return 'add_tag'
    if (text.includes('assign')) return 'assign_owner'
    if (text.includes('note') || text.includes('timeline') || text.includes('activity')) return 'add_note'
    return null
  }
  for (const workflow of results) {
    let nodes: { type?: string; action?: string; label?: string }[]
    try {
      nodes = JSON.parse(workflow.nodes) as typeof nodes
    } catch {
      continue
    }
    let changed = false
    for (const node of nodes) {
      if (node.type !== 'action' || node.action) continue
      const action = infer(String(node.label ?? ''))
      if (action) {
        node.action = action
        changed = true
      }
    }
    if (changed) {
      await env.DB.prepare('UPDATE workflows SET nodes = ? WHERE id = ?')
        .bind(JSON.stringify(nodes), workflow.id)
        .run()
    }
  }
}

export async function insertRow(env: Env, table: string, values: Record<string, unknown>) {
  const keys = Object.keys(values)
  const placeholders = keys.map(() => '?').join(', ')
  const binds = keys.map((k) => {
    const v = values[k]
    if (v === undefined || v === null) return null
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'object') return JSON.stringify(v)
    return v as string | number
  })
  await env.DB.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
    .bind(...binds)
    .run()
}

export async function insertMany(env: Env, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const stmts = rows.map((values) => {
    const keys = Object.keys(values)
    const binds = keys.map((k) => {
      const v = values[k]
      if (v === undefined || v === null) return null
      if (typeof v === 'boolean') return v ? 1 : 0
      if (typeof v === 'object') return JSON.stringify(v)
      return v as string | number
    })
    return env.DB.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    ).bind(...binds)
  })
  for (let i = 0; i < stmts.length; i += 40) {
    await env.DB.batch(stmts.slice(i, i + 40))
  }
}
