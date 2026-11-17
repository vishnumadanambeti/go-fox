#!/usr/bin/env node
/**
 * Verifies workflow retry-with-backoff against a live server: a failing node is retried by the
 * scheduler tick with exponential delay and the run only ends as failed after MAX_ATTEMPTS.
 *
 * Usage: BASE_URL=http://127.0.0.1:3001 bun scripts/qa-retry.mjs
 */
const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
const PASSWORD = process.env.DEMO_PASSWORD ?? 'gofox1234'

let cookie = ''
async function api(method, path, body) {
  const headers = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(',').map((p) => p.split(';')[0]).join('; ')
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* html */
  }
  return { status: response.status, json }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

await api('POST', '/api/auth/login', { email: 'owner@gofox.dev', password: PASSWORD })
const stamp = Date.now()
const flow = await api('POST', '/api/resources/workflows', {
  name: `QA retry ${stamp}`,
  module: 'crm',
  trigger_type: 'contact.created',
  nodes: [
    { id: 'n1', type: 'trigger', label: 'Contact created', config: {} },
    {
      id: 'n2',
      type: 'action',
      action: 'update_field',
      label: 'Write a column that does not exist',
      config: { field: 'no_such_column', value: 'x' },
    },
  ],
})
const workflowId = flow.json?.record?.id
const published = await api('POST', `/api/workflows/${workflowId}/publish`)
console.log('workflow', workflowId, 'publish', published.status)

const contact = await api('POST', '/api/resources/contacts', {
  first_name: 'Retry',
  last_name: String(stamp),
  email: `retry${stamp}@example.com`,
})
const contactId = contact.json?.record?.id
console.log('contact', contactId)

await wait(1500)
const runsFor = async () =>
  ((await api('GET', '/api/workflow-runs')).json?.data ?? []).filter(
    (run) => run.workflow_id === workflowId && run.entity_id === contactId,
  )

let [run] = await runsFor()
console.log('after first attempt:', { status: run?.status, attempts: run?.attempts, resume_at: run?.resume_at })

// The first retry is scheduled 30s out; tick before it is due must do nothing.
await api('POST', '/api/scheduler/tick')
let [early] = await runsFor()
console.log('tick before due:', { status: early?.status, attempts: early?.attempts })

await wait(32_000)
const tick1 = await api('POST', '/api/scheduler/tick')
let [second] = await runsFor()
console.log('tick after due:', { resumed: tick1.json?.resumed, status: second?.status, attempts: second?.attempts })

await wait(62_000)
const tick2 = await api('POST', '/api/scheduler/tick')
let [third] = await runsFor()
console.log('tick after second backoff:', { resumed: tick2.json?.resumed, status: third?.status, attempts: third?.attempts, finished_at: third?.finished_at })

const log = (() => {
  try {
    return JSON.parse(third?.log ?? '[]')
  } catch {
    return []
  }
})()
console.log('log:', log.map((entry) => `${entry.status}:${entry.detail}`))

await api('DELETE', `/api/resources/workflows/${workflowId}`)
