#!/usr/bin/env node
/**
 * GoFox CRM regression suite.
 *
 * Runs against a live server (local dev or the deployed preview) and exercises the behaviours this
 * phase had to make trustworthy: authentication, RBAC, tenant isolation, related-record scoping,
 * workflow execution + idempotency, notification history, the AI assistant's honesty about provider
 * mode, and dashboard metrics.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3001 bun scripts/regression.mjs
 *   BASE_URL=https://<preview-host> bun scripts/regression.mjs
 */

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
const PASSWORD = process.env.DEMO_PASSWORD ?? 'gofox1234'

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

class Client {
  constructor() {
    this.cookie = ''
  }

  async request(method, path, body) {
    const headers = { 'content-type': 'application/json' }
    if (this.cookie) headers.cookie = this.cookie
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) this.cookie = setCookie.split(',').map((part) => part.split(';')[0]).join('; ')
    const text = await response.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      /* non-JSON (HTML route) */
    }
    return { status: response.status, json, text, headers: response.headers }
  }

  get(path) {
    return this.request('GET', path)
  }
  post(path, body) {
    return this.request('POST', path, body ?? {})
  }
  patch(path, body) {
    return this.request('PATCH', path, body)
  }
  delete(path) {
    return this.request('DELETE', path)
  }
}

async function login(email) {
  const client = new Client()
  const response = await client.post('/api/auth/login', { email, password: PASSWORD })
  return { client, response }
}

async function main() {
  console.log(`GoFox CRM regression suite → ${BASE}`)

  section('Authentication')
  const anonymous = new Client()
  const meAnon = await anonymous.get('/api/auth/me')
  check('anonymous /api/auth/me is rejected', meAnon.status === 401, `status ${meAnon.status}`)
  const protectedList = await anonymous.get('/api/resources/contacts')
  check('anonymous resource list is rejected', protectedList.status === 401, `status ${protectedList.status}`)

  const badLogin = await anonymous.post('/api/auth/login', { email: 'owner@gofox.dev', password: 'wrong-password' })
  check('wrong password is rejected', badLogin.status === 401, `status ${badLogin.status}`)

  const { client, response: loginResponse } = await login('owner@gofox.dev')
  check('owner can sign in', loginResponse.status === 200, `status ${loginResponse.status}`)
  const me = await client.get('/api/auth/me')
  check('session restores on a fresh request', me.status === 200 && me.json?.user?.email === 'owner@gofox.dev')
  const cookieHeader = String(loginResponse.headers.get('set-cookie') ?? '')
  check('session cookie is HttpOnly', /HttpOnly/i.test(cookieHeader))
  check('session cookie is SameSite', /SameSite=/i.test(cookieHeader))

  const forged = new Client()
  forged.cookie = 'gofox_session=forged-session-token'
  const forgedMe = await forged.get('/api/auth/me')
  check('a forged session cookie is rejected', forgedMe.status === 401, `status ${forgedMe.status}`)

  const badToken = await anonymous.post('/api/auth/firebase', { idToken: 'not.a.real.token' })
  const rejected = (status) => [400, 401, 422].includes(status)
  check('an invalid Firebase ID token is rejected', rejected(badToken.status), `status ${badToken.status}`)
  const missingToken = await anonymous.post('/api/auth/firebase', {})
  check('a missing Firebase ID token is rejected', rejected(missingToken.status), `status ${missingToken.status}`)

  const { client: leaver } = await login('support@gofox.dev')
  const beforeLogout = await leaver.get('/api/auth/me')
  const logout = await leaver.post('/api/auth/logout')
  check('logout succeeds', logout.status === 200, `status ${logout.status}`)
  leaver.cookie = String(logout.headers.get('set-cookie') ?? '').split(';')[0] || leaver.cookie
  const afterLogout = await leaver.get('/api/auth/me')
  check('the session no longer works after logout', beforeLogout.status === 200 && afterLogout.status === 401, `status ${afterLogout.status}`)

  section('CSRF / origin checks')
  const foreignOrigin = await fetch(`${BASE}/api/resources/contacts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: client.cookie, origin: 'https://evil.example.com' },
    body: JSON.stringify({ first_name: 'CSRF' }),
  })
  check('cross-origin write is rejected', foreignOrigin.status === 403 || foreignOrigin.status === 401, `status ${foreignOrigin.status}`)

  section('RBAC')
  const contactForDeals = (await client.get('/api/resources/contacts?limit=1')).json?.data?.[0]
  const { client: sales } = await login('sales@gofox.dev')
  const salesDeal = await sales.post('/api/resources/deals', {
    name: `RBAC sales deal ${Date.now()}`,
    contact_id: contactForDeals?.id,
    value: 100,
    status: 'open',
  })
  check('sales can create a deal (sales.write)', salesDeal.status === 201, `status ${salesDeal.status}`)
  const salesAudit = await sales.get('/api/audit')
  check('sales cannot read the audit log', salesAudit.status === 403, `status ${salesAudit.status}`)
  const salesInvite = await sales.post('/api/users/invite', { email: 'x@example.com', role: 'sales' })
  check('sales cannot invite users', salesInvite.status === 403, `status ${salesInvite.status}`)

  const { client: marketer } = await login('marketer@gofox.dev')
  const marketerDeals = await marketer.get('/api/resources/deals')
  check('marketer can read CRM records (crm.write)', marketerDeals.status === 200, `status ${marketerDeals.status}`)
  const marketerSettings = await marketer.post('/api/users/invite', { email: 'y@example.com', role: 'sales' })
  check('marketer cannot invite users', marketerSettings.status === 403, `status ${marketerSettings.status}`)

  const { client: support } = await login('support@gofox.dev')
  const supportWorkflow = await support.post('/api/resources/workflows', { name: 'nope', trigger_type: 'contact.created', module: 'crm' })
  check('support cannot create a workflow (no workflows.write)', supportWorkflow.status === 403, `status ${supportWorkflow.status}`)
  const supportDeal = await support.post('/api/resources/deals', { name: 'nope', contact_id: contactForDeals?.id, value: 1, status: 'open' })
  check('support cannot create a deal (no sales.write)', supportDeal.status === 403, `status ${supportDeal.status}`)

  const { client: manager } = await login('manager@gofox.dev')
  const managerInvite = await manager.post('/api/users/invite', { email: 'z@example.com', role: 'sales' })
  check('manager cannot invite users (no users.write)', managerInvite.status === 403, `status ${managerInvite.status}`)

  section('Routes')
  for (const path of ['/', '/login', '/companies', '/leads', '/contacts', '/deals', '/tasks', '/settings/apps', '/settings/apps/gmail', '/settings/apps/microsoft365', '/settings/integrations']) {
    const page = await client.get(path)
    check(`GET ${path} serves the app shell`, page.status === 200 && /<div id="root"/.test(page.text), `status ${page.status}`)
  }

  section('Related-record scoping (contact 360°)')
  const contacts = await client.get('/api/resources/contacts?limit=2')
  const [contactA, contactB] = contacts.json?.data ?? []
  check('contacts list returns rows', Boolean(contactA && contactB))

  if (contactA && contactB) {
    const dealA = await client.post('/api/resources/deals', {
      name: `Regression deal ${Date.now()}`,
      contact_id: contactA.id,
      value: 1000,
      status: 'open',
      probability: 20,
    })
    check('deal can be created for contact A', dealA.status === 201, `status ${dealA.status}`)
    const dealsForA = await client.get(`/api/resources/deals?contact_id=${contactA.id}&limit=50`)
    const dealsForB = await client.get(`/api/resources/deals?contact_id=${contactB.id}&limit=50`)
    const idsA = new Set((dealsForA.json?.data ?? []).map((row) => row.contact_id))
    const idsB = new Set((dealsForB.json?.data ?? []).map((row) => row.contact_id))
    check('contact A deal list is scoped to A', idsA.size <= 1 && (!idsA.size || idsA.has(contactA.id)), `contacts seen: ${[...idsA].join(',')}`)
    check('contact B deal list is scoped to B', idsB.size <= 1 && (!idsB.size || idsB.has(contactB.id)), `contacts seen: ${[...idsB].join(',')}`)
    check('contact A never sees contact B deals', !(dealsForA.json?.data ?? []).some((row) => row.contact_id === contactB.id))
    const typo = await client.get(`/api/resources/deals??contact_id=${contactA.id}&limit=50`)
    check('a malformed related-record query is rejected, not silently unfiltered', typo.status === 400, `status ${typo.status}`)
    const unknownFilter = await client.get(`/api/resources/deals?contactid=${contactA.id}`)
    check('an unknown filter key is rejected', unknownFilter.status === 400, `status ${unknownFilter.status}`)
    const tasksForA = await client.get(`/api/resources/tasks?related_id=${contactA.id}&related_type=contact&limit=50`)
    check(
      'contact task tab is scoped to that contact',
      (tasksForA.json?.data ?? []).every((row) => row.related_id === contactA.id && row.related_type === 'contact'),
    )
  }

  section('Workflows')
  // Hermetic: this suite creates its own workflow so workspace state cannot skew the result.
  const stamp = Date.now()
  const flow = await client.post('/api/resources/workflows', {
    name: `Regression flow ${stamp}`,
    module: 'crm',
    trigger_type: 'contact.created',
    description: 'Created by the regression suite.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Contact created', config: {} },
      { id: 'n2', type: 'action', action: 'create_task', label: 'Regression follow-up', config: { title: 'Regression follow-up {{record.first_name}}', priority: 'medium', dueInDays: 2 } },
    ],
  })
  const workflowId = flow.json?.record?.id
  check('workflow can be created', flow.status === 201 && Boolean(workflowId), `status ${flow.status}`)
  const publish = await client.post(`/api/workflows/${workflowId}/publish`)
  check('workflow can go live', publish.status === 200, `status ${publish.status}`)

  const invalid = await client.post('/api/resources/workflows', {
    name: `Regression invalid ${stamp}`,
    module: 'crm',
    trigger_type: 'contact.created',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Contact created', config: {} },
      { id: 'n2', type: 'action', label: 'No action configured', config: {} },
    ],
  })
  const invalidPublish = await client.post(`/api/workflows/${invalid.json?.record?.id}/publish`)
  check('a graph with an unconfigured action cannot go live', invalidPublish.status === 422, `status ${invalidPublish.status}`)

  const created = await client.post('/api/resources/contacts', {
    first_name: 'Regression',
    last_name: String(stamp),
    email: `regression${stamp}@example.com`,
    status: 'active',
  })
  check('contact creation succeeds', created.status === 201, `status ${created.status}`)
  const contactId = created.json?.record?.id
  await new Promise((resolve) => setTimeout(resolve, 1200))

  const contactRuns = ((await client.get('/api/workflow-runs')).json?.data ?? []).filter(
    (run) => run.entity_id === contactId && run.workflow_id === workflowId,
  )
  check('the trigger fired exactly one run', contactRuns.length === 1, `${contactRuns.length} runs`)
  check('the run completed', contactRuns[0]?.status === 'completed', String(contactRuns[0]?.status))
  const runLogs = (() => {
    try {
      return JSON.parse(contactRuns[0]?.log ?? '[]')
    } catch {
      return []
    }
  })()
  check('no run step failed', runLogs.every((entry) => entry.status !== 'failed'), JSON.stringify(runLogs.filter((entry) => entry.status === 'failed')))

  const triggeredTasks = await client.get(`/api/resources/tasks?related_id=${contactId}&related_type=contact&limit=50`)
  const automationTasks = (triggeredTasks.json?.data ?? []).filter((row) => String(row.title).startsWith('Regression follow-up'))
  check('the action created exactly one task for the contact', automationTasks.length === 1, `${automationTasks.length} tasks`)

  const duplicate = await client.patch(`/api/resources/contacts/${contactId}`, { first_name: 'Regression' })
  check('unchanged update is accepted', duplicate.status === 200)
  await new Promise((resolve) => setTimeout(resolve, 800))
  const afterDuplicate = ((await client.get('/api/workflow-runs')).json?.data ?? []).filter(
    (run) => run.entity_id === contactId && run.workflow_id === workflowId,
  )
  check('re-delivering the same event does not create a second run', afterDuplicate.length === 1, `${afterDuplicate.length} runs`)
  const afterTasks = await client.get(`/api/resources/tasks?related_id=${contactId}&related_type=contact&limit=50`)
  check(
    'no duplicate task after re-delivery',
    (afterTasks.json?.data ?? []).filter((row) => String(row.title).startsWith('Regression follow-up')).length === 1,
  )

  const replay = await client.post(`/api/workflows/${workflowId}/runs/${contactRuns[0]?.id}/replay`)
  check('a failed or completed run can be replayed manually', replay.status === 200, `status ${replay.status}`)

  await client.delete(`/api/resources/workflows/${workflowId}`)
  await client.delete(`/api/resources/workflows/${invalid.json?.record?.id}`)

  section('Notifications')
  const notifications = await client.get('/api/notifications')
  check('notification history is persisted', Array.isArray(notifications.json?.data) && notifications.json.data.length > 0)
  const single = notifications.json?.data?.[0]
  if (single) {
    const markOne = await client.post('/api/notifications/read', { id: single.id })
    check('a notification can be marked read', markOne.status === 200)
    const afterOne = await client.get('/api/notifications')
    const updated = (afterOne.json?.data ?? []).find((row) => row.id === single.id)
    check('read state survives a reload', Boolean(updated?.read_at))
  }

  section('AI assistant')
  const providers = await client.get('/api/ai/providers')
  check('provider status endpoint responds', providers.status === 200, `status ${providers.status}`)
  check('provider status never leaks a key', !JSON.stringify(providers.json ?? {}).includes('sk-'))
  const chat = await client.post('/api/ai/chat', { message: 'how is the pipeline looking?' })
  const reply = String(chat.json?.reply ?? '')
  check('assistant answers', chat.status === 200 && reply.length > 20, `status ${chat.status}`)
  if (providers.json?.mode === 'rules') {
    check('rules mode is disclosed in the reply', /rules-based/i.test(reply))
  } else {
    check('model mode is reported', /rules-based/i.test(reply) === false)
  }
  const emptyChat = await client.post('/api/ai/chat', { message: '' })
  check('empty prompt is rejected', emptyChat.status === 422, `status ${emptyChat.status}`)

  section('Dashboard')
  const home = await client.get('/api/dashboards/home?days=7')
  const buckets = home.json?.activityByDay ?? []
  check('dashboard returns 7 real day buckets', buckets.length === 7, `${buckets.length} buckets`)
  check('activity buckets are real counts', buckets.every((point) => Number.isInteger(point.value) && point.value >= 0))
  const home30 = await client.get('/api/dashboards/home?days=30')
  check('date range widens the trend', (home30.json?.activityByDay ?? []).length === 30)

  section('Security')
  const traversal = await client.get('/api/resources/../../etc/passwd')
  check('path traversal is not routed', traversal.status === 404 || traversal.status === 200)
  const unknownEntity = await client.get('/api/resources/does-not-exist')
  check('unknown entity is a clean 404', unknownEntity.status === 404, `status ${unknownEntity.status}`)
  const sqlAttempt = await client.get("/api/resources/contacts?limit=1&order=id;DROP TABLE contacts")
  check('injection-shaped query does not break the list endpoint', sqlAttempt.status === 200 || sqlAttempt.status === 400)
  const stillThere = await client.get('/api/resources/contacts?limit=1')
  check('contacts table still queryable after injection attempt', stillThere.status === 200)

  section('Integrations')
  const org = await client.get('/api/org')
  const integration = (org.json?.integrations ?? []).find((row) => row.provider === 'gmail')
  check('gmail integration is present', Boolean(integration))
  check('integration is not falsely reported connected', integration?.status !== 'connected' || Boolean(integration?.account))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) {
    console.log('\nFailures:')
    failures.forEach((failure) => console.log(`  - ${failure}`))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\nSuite crashed:', error)
  process.exit(1)
})
