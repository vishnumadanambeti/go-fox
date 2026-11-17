#!/usr/bin/env node
/**
 * Full module audit: every major module, CRUD + module-specific actions.
 *
 * Usage: BASE_URL=https://... node scripts/module-audit.mjs
 */
const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
const PASSWORD = process.env.DEMO_PASSWORD ?? 'gofox1234'
const UA = 'Mozilla/5.0 (compatible; GoFoxAudit/1.0)'

let cookie = ''
const results = []
const suffix = Date.now().toString(36).slice(-5)

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'user-agent': UA,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let json = null
  const text = await res.text()
  try { json = JSON.parse(text) } catch { json = null }
  return { status: res.status, json, text }
}

function check(module, name, ok, detail = '') {
  results.push({ module, name, ok, detail })
  const line = `${ok ? 'PASS' : 'FAIL'} ${module} · ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
}

async function expect(module, name, method, path, body, statuses = [200, 201]) {
  try {
    const res = await req(method, path, body)
    const ok = statuses.includes(res.status)
    check(module, name, ok, ok ? '' : `HTTP ${res.status} ${(res.text ?? '').slice(0, 160)}`)
    return { res, ok }
  } catch (error) {
    check(module, name, false, String(error?.message ?? error))
    return { res: null, ok: false }
  }
}

await expect('auth', 'login', 'POST', '/api/auth/login', { email: 'owner@gofox.dev', password: PASSWORD })

const schemaRes = await req('GET', '/api/schema')
const schema = schemaRes.json?.schema ?? {}
const metaRes = await req('GET', '/api/meta')
const meta = metaRes.json ?? {}
const me = (await req('GET', '/api/auth/me')).json?.user

function refValue(entity) {
  const map = {
    companies: meta.companies, contacts: meta.contacts, users: meta.users, lists: meta.lists,
    pipelines: meta.pipelines, stages: meta.stages, forms: meta.forms, landing_pages: meta.landingPages,
    sla_policies: meta.slaPolicies, products: meta.products, deals: meta.deals, tickets: meta.tickets,
    campaigns: meta.campaigns, sequences: meta.sequences, email_templates: meta.emailTemplates,
    workflows: meta.workflows, organizations: meta.org ? [meta.org] : [], companies_ref: meta.companies,
  }
  const list = map[entity] ?? []
  return list[0]?.id ?? null
}

function valueFor(field) {
  switch (field.type) {
    case 'number': case 'money': return 12
    case 'checkbox': return false
    case 'email': return `qa.${suffix}.${field.key}@example.com`
    case 'url': return 'https://example.com/qa'
    case 'tel': return '+15550100123'
    case 'select': return field.options?.[0] ?? 'active'
    case 'json': return '{}'
    case 'textarea': return `QA ${field.key}`
    case 'ref': return refValue(field.ref)
    case 'date': return new Date().toISOString().slice(0, 10)
    case 'datetime': return new Date().toISOString()
    default: return `QA ${field.label} ${suffix}`
  }
}

function payloadFor(def) {
  const payload = {}
  for (const field of def.fields ?? []) {
    if (field.required) payload[field.key] = valueFor(field)
  }
  return payload
}

for (const [entity, def] of Object.entries(schema)) {
  const list = await expect(entity, 'list', 'GET', `/api/resources/${entity}?limit=5`)
  if (!list.ok) continue
  const payload = payloadFor(def)
  let created = null
  if (Object.keys(payload).length) {
    const res = await req('POST', `/api/resources/${entity}`, payload)
    if ([200, 201].includes(res.status) && res.json?.record?.id) {
      created = res.json.record
      check(entity, 'create', true)
      await expect(entity, 'read', 'GET', `/api/resources/${entity}/${created.id}`)
      const patch = await req('PATCH', `/api/resources/${entity}/${created.id}`, {})
      check(entity, 'update', patch.status === 200, patch.status === 200 ? '' : `HTTP ${patch.status}`)
      await expect(entity, 'delete', 'DELETE', `/api/resources/${entity}/${created.id}`)
    } else {
      check(entity, 'create', false, `HTTP ${res.status} ${JSON.stringify(payload).slice(0, 120)} → ${(res.text ?? '').slice(0, 140)}`)
    }
  }
}

// ---- module endpoints
const getEndpoints = [
  ['home', '/api/dashboards/home'],
  ['reports', '/api/reports/crm'],
  ['reports-sales', '/api/reports/sales'],
  ['reports-marketing', '/api/reports/marketing'],
  ['reports-support', '/api/reports/support'],
  ['notifications', '/api/notifications'],
  ['search', '/api/search?q=qa'],
  ['activities', '/api/activities?limit=5'],
  ['audit', '/api/audit?limit=5'],
  ['trash', '/api/trash'],
  ['files', '/api/resources/files?limit=5'],
  ['integrations', '/api/org'],
  ['ai-providers', '/api/ai/providers'],
  ['ai-messages', '/api/ai/messages'],
  ['workflow-runs', '/api/workflow-runs?limit=5'],
  ['analytics', '/api/analytics/web'],
  ['users', '/api/users'],
  ['tracker', '/api/tracker/snippet'],
  ['export-contacts', '/api/export/contacts'],
]
for (const [name, path] of getEndpoints) await expect('modules', name, 'GET', path)

// ---- workflows
const wf = await req('POST', '/api/resources/workflows', {
  name: `QA workflow ${suffix}`, status: 'draft', trigger_type: 'contact.created',
  nodes: JSON.stringify([{ id: 'n1', type: 'trigger', label: 'Contact created', config: { trigger: 'contact.created' }, x: 120, y: 40 }]),
})
if (wf.json?.record?.id) {
  const id = wf.json.record.id
  await expect('workflows', 'publish', 'POST', `/api/workflows/${id}/publish`, {})
  await expect('workflows', 'test-run', 'POST', `/api/workflows/${id}/test`, {})
  await req('DELETE', `/api/resources/workflows/${id}`)
} else check('workflows', 'create', false, `HTTP ${wf.status} ${(wf.text ?? '').slice(0, 120)}`)

// ---- campaigns
const cmp = await req('POST', '/api/resources/campaigns', {
  name: `QA campaign ${suffix}`, subject: 'QA subject', status: 'draft', type: 'email',
})
if (cmp.json?.record?.id) {
  const id = cmp.json.record.id
  await expect('campaigns', 'status', 'POST', `/api/campaigns/${id}/status`, { status: 'paused' })
  await expect('campaigns', 'send', 'POST', `/api/campaigns/${id}/send`, {}, [200, 201, 409])
  await req('DELETE', `/api/resources/campaigns/${id}`)
} else check('campaigns', 'create', false, `HTTP ${cmp.status}`)

// ---- forms publish + public submit
const form = await req('POST', '/api/resources/forms', {
  name: `QA form ${suffix}`, slug: `qa-form-${suffix}`, status: 'draft', mapping: 'lead',
  fields: JSON.stringify([{ key: 'email', label: 'Email', type: 'email', required: true }]),
})
if (form.json?.record?.id) {
  const id = form.json.record.id
  await expect('forms', 'publish', 'POST', `/api/forms/${id}/publish`, {})
  const pub = await req('GET', `/api/public/forms/qa-form-${suffix}`)
  check('forms', 'public fetch', pub.status === 200, `HTTP ${pub.status}`)
  const submit = await req('POST', `/api/public/forms/qa-form-${suffix}/submit`, { email: `qa.lead.${suffix}@example.com` })
  check('forms', 'public submit', [200, 201].includes(submit.status), `HTTP ${submit.status} ${(submit.text ?? '').slice(0, 100)}`)
  await req('DELETE', `/api/resources/forms/${id}`)
} else check('forms', 'create', false, `HTTP ${form.status} ${(form.text ?? '').slice(0, 100)}`)

// ---- landing page publish + public
const page = await req('POST', '/api/resources/landing_pages', {
  name: `QA page ${suffix}`, slug: `qa-page-${suffix}`, status: 'draft', template: 'blank', blocks: '[]',
})
if (page.json?.record?.id) {
  const id = page.json.record.id
  await expect('landing', 'publish', 'POST', `/api/pages/${id}/publish`, {})
  const pub = await req('GET', `/api/public/pages/qa-page-${suffix}`)
  check('landing', 'public fetch', pub.status === 200, `HTTP ${pub.status}`)
  await req('DELETE', `/api/resources/landing_pages/${id}`)
} else check('landing', 'create', false, `HTTP ${page.status}`)

// ---- lists + members
const list = await req('POST', '/api/resources/lists', { name: `QA list ${suffix}`, type: 'static' })
if (list.json?.record?.id) {
  const id = list.json.record.id
  const add = await req('POST', `/api/lists/${id}/members`, { contact_ids: [refValue('contacts')].filter(Boolean) })
  check('lists', 'add member', [200, 201].includes(add.status), `HTTP ${add.status} ${(add.text ?? '').slice(0, 100)}`)
  await expect('lists', 'members', 'GET', `/api/lists/${id}/members`)
  await req('DELETE', `/api/resources/lists/${id}`)
} else check('lists', 'create', false, `HTTP ${list.status}`)

// ---- deals stage
const deal = (await req('GET', `/api/resources/deals?limit=1`)).json?.data?.[0]
if (deal) {
  const stages = meta.stages ?? []
  const target = stages.find((s) => s.id !== deal.stage_id)
  if (target) await expect('deals', 'move stage', 'POST', `/api/deals/${deal.id}/stage`, { stage_id: target.id })
} else check('deals', 'seed deal present', false, 'no deals to test')

// ---- tickets messages
const ticket = (await req('GET', `/api/resources/tickets?limit=1`)).json?.data?.[0]
if (ticket) {
  await expect('support', 'ticket messages', 'GET', `/api/tickets/${ticket.id}/messages`)
  await expect('support', 'add message', 'POST', `/api/tickets/${ticket.id}/messages`, { body: 'QA reply', direction: 'outbound' })
} else check('support', 'seed ticket present', false, 'no tickets to test')

// ---- leads convert
const lead = (await req('GET', `/api/resources/leads?limit=1`)).json?.data?.[0]
if (lead) await expect('leads', 'convert', 'POST', `/api/leads/${lead.id}/convert`, {})

// ---- AI
await expect('ai', 'chat', 'POST', '/api/ai/chat', { message: 'What is my pipeline value?' })

// ---- inbox + telephony
await expect('inbox', 'send', 'POST', '/api/inbox/send', { to: 'qa@example.com', subject: 'QA', body: 'QA' }, [200, 201, 409])
await expect('telephony', 'dial', 'POST', '/api/telephony/dial', { number: '+15550100123' }, [200, 201, 409, 502])

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
if (failed.length) {
  console.log('\nFailures:')
  for (const f of failed) console.log(`- ${f.module} · ${f.name}: ${f.detail}`)
  process.exitCode = 1
}
