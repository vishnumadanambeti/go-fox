import type { Env } from './db'
import { addDays, insertRow, jsonParse, nowIso, uid } from './db'
import { logActivity, notify, type EntityDef } from './entities'
import { sendGmail } from './gmail'
import { sendSms } from './integrations'

export type WorkflowNode = {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'wait' | 'end'
  label: string
  x?: number
  y?: number
  config?: Record<string, unknown>
  action?: string
  /** Runs only on one side of the preceding condition; omitted means always run. */
  branch?: 'true' | 'false'
}

type LogEntry = {
  at: string
  nodeId: string
  label: string
  status: 'ok' | 'skipped' | 'failed' | 'waiting' | 'retry'
  detail: string
}

const ACTIONS = new Set([
  'create_task',
  'notify',
  'add_note',
  'update_field',
  'add_tag',
  'remove_tag',
  'add_to_list',
  'add_to_sequence',
  'create_ticket',
  'send_email',
  'assign_owner',
  'send_sms',
  'webhook',
  'create_deal',
  'update_deal',
  'remove_contact',
])

function getPath(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, record)
}

function evaluate(record: Record<string, unknown>, config: Record<string, unknown>): boolean {
  const value = getPath(record, String(config.field ?? ''))
  const op = String(config.op ?? 'not_empty')
  const target = config.value
  switch (op) {
    case 'eq':
      return String(value ?? '') === String(target ?? '')
    case 'neq':
      return String(value ?? '') !== String(target ?? '')
    case 'contains':
      return String(value ?? '').toLowerCase().includes(String(target ?? '').toLowerCase())
    case 'gt':
      return Number(value) > Number(target)
    case 'lt':
      return Number(value) < Number(target)
    case 'empty':
      return value == null || value === '' || value === 0
    case 'not_empty':
    default:
      return value != null && value !== ''
  }
}

/**
 * Stable, short fingerprint of the business content of a record, used as part of the workflow run
 * idempotency key. Volatile bookkeeping columns are excluded so a re-delivery of the same event is
 * recognised, while a real field change is not.
 */
const VOLATILE_KEYS = new Set(['updated_at', 'last_login', 'last_sync'])

function recordFingerprint(record: Record<string, unknown>): string {
  const keys = Object.keys(record)
    .filter((key) => !VOLATILE_KEYS.has(key))
    .sort()
  let hash = 0x811c9dc5
  for (const key of keys) {
    const value = record[key]
    const text = `${key}=${value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)};`
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return hash.toString(16)
}

export async function fireTrigger(
  env: Env,
  orgId: string,
  trigger: string,
  entityType: string,
  entityId: string,
  record: Record<string, unknown>,
  actorId: string | null,
) {
  const { results } = await env.DB.prepare(
    `SELECT id, nodes, version FROM workflows
     WHERE org_id = ? AND trigger_type = ? AND status = 'live' AND deleted_at IS NULL`,
  )
    .bind(orgId, trigger)
    .all<{ id: string; nodes: string; version: number }>()

  const fingerprint = recordFingerprint(record)
  for (const workflow of results) {
    // The fingerprint is the content of the record that triggered the run. Re-delivering the same
    // event produces the same key and is ignored; a genuine change to an "updated" trigger produces
    // a new key so the workflow can run again.
    const key = `${workflow.id}:${trigger}:${entityId}:${workflow.version}:${fingerprint}`
    try {
      await env.DB.prepare(
        `INSERT INTO workflow_runs (id, org_id, workflow_id, idempotency_key, trigger_event,
           entity_type, entity_id, status, log, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'running', '[]', ?)`,
      )
        .bind(uid(), orgId, workflow.id, key, trigger, entityType, entityId, nowIso())
        .run()
    } catch {
      // Unique idempotency key: this trigger event already produced a run.
      continue
    }
    const run = await env.DB.prepare('SELECT id FROM workflow_runs WHERE idempotency_key = ?')
      .bind(key)
      .first<{ id: string }>()
    if (!run) continue
    await executeRun(env, orgId, workflow.id, run.id, record, actorId, trigger)
  }
}

/** Advances a run through its node list until it ends, fails or waits. */
export async function executeRun(
  env: Env,
  orgId: string,
  workflowId: string,
  runId: string,
  record: Record<string, unknown>,
  actorId: string | null,
  trigger: string,
  startNodeId?: string,
) {
  const workflow = await env.DB.prepare('SELECT * FROM workflows WHERE id = ? AND org_id = ?')
    .bind(workflowId, orgId)
    .first<Record<string, unknown>>()
  const run = await env.DB.prepare('SELECT * FROM workflow_runs WHERE id = ?').bind(runId).first<Record<string, unknown>>()
  if (!workflow || !run) return

  const nodes = jsonParse<WorkflowNode[]>(workflow.nodes as string, [])
  const log = jsonParse<LogEntry[]>(run.log as string, [])
  let cursor = startNodeId ?? (nodes[0]?.id ?? '')
  let status: 'completed' | 'failed' | 'waiting' = 'completed'
  let resumeAt: string | null = null
  let stepGuard = 0
  // The node a failure stopped at, so a retry resumes at that node instead of replaying the
  // actions that already succeeded (which would duplicate tasks and notifications).
  let failedNode: WorkflowNode | null = null
  // Outcome of the most recent condition. Nodes may declare `branch: 'true' | 'false'` to run only
  // on one side of it, which is how a single linear graph models two branches.
  let activeBranch: 'true' | 'false' | null = null

  while (cursor && stepGuard < 60) {
    stepGuard++
    const node = nodes.find((n) => n.id === cursor)
    if (!node) break
    const config = (node.config ?? {}) as Record<string, unknown>

    if (node.type === 'trigger') {
      log.push({ at: nowIso(), nodeId: node.id, label: node.label, status: 'ok', detail: `Triggered by ${trigger}` })
      cursor = nextNode(nodes, node)
      continue
    }

    if (node.type === 'condition') {
      const passed = evaluate(record, config)
      activeBranch = passed ? 'true' : 'false'
      log.push({
        at: nowIso(),
        nodeId: node.id,
        label: node.label,
        status: 'ok',
        detail: `Condition ${passed ? 'matched' : 'did not match'} (${String(config.field)} ${String(config.op ?? 'not_empty')})`,
      })
      // A condition stops the run when it does not match unless it is explicitly marked as a
      // pass-through gate (stopWhenFalse === false), so the downstream actions can never run on
      // the wrong side of the condition.
      if (!passed && config.stopWhenFalse !== false) {
        status = 'completed'
        cursor = ''
        break
      }
      cursor = nextNode(nodes, node)
      continue
    }

    if (node.type === 'wait') {
      const minutes = Math.max(1, Number(config.minutes ?? 60))
      resumeAt = new Date(Date.now() + minutes * 60_000).toISOString()
      log.push({
        at: nowIso(),
        nodeId: node.id,
        label: node.label,
        status: 'waiting',
        detail: `Paused for ${minutes} minute(s); resumes at ${resumeAt}`,
      })
      status = 'waiting'
      cursor = nextNode(nodes, node)
      break
    }

    if (node.type === 'end') {
      log.push({ at: nowIso(), nodeId: node.id, label: node.label, status: 'ok', detail: 'Reached end node' })
      cursor = ''
      break
    }

    if (node.branch && activeBranch && node.branch !== activeBranch) {
      log.push({
        at: nowIso(),
        nodeId: node.id,
        label: node.label,
        status: 'skipped',
        detail: `Skipped: this node runs only when the condition is ${node.branch}`,
      })
      cursor = nextNode(nodes, node)
      continue
    }

    // Action node. A missing action is a configuration error, never a silent fallback — otherwise a
    // node labelled "Create task" could quietly send a notification instead.
    const action = String(node.action ?? '')
    if (!action || !ACTIONS.has(action)) {
      log.push({
        at: nowIso(),
        nodeId: node.id,
        label: node.label,
        status: 'failed',
        detail: action ? `Unsupported action ${action}` : 'This action node has no action configured',
      })
      status = 'failed'
      failedNode = node
      cursor = ''
      break
    }
    try {
      const detail = await runAction(env, orgId, action, config, record, actorId, run)
      log.push({ at: nowIso(), nodeId: node.id, label: node.label, status: detail.status, detail: detail.message })
      if (detail.status === 'failed') {
        status = 'failed'
        failedNode = node
        cursor = ''
        break
      }
    } catch (error) {
      log.push({
        at: nowIso(),
        nodeId: node.id,
        label: node.label,
        status: 'failed',
        detail: error instanceof Error ? error.message : 'Node failed',
      })
      status = 'failed'
      failedNode = node
      cursor = ''
      break
    }
    cursor = nextNode(nodes, node)
  }

  // Retry the failed node with a short exponential backoff before giving up. The run waits (so it is
  // picked up by the scheduler tick), then restarts at that node; after MAX_ATTEMPTS the run is marked
  // failed and the workflow owner is notified.
  const attempt = Number(run.attempts ?? 0) + 1
  if (status === 'failed' && failedNode && attempt < MAX_ATTEMPTS) {
    const delayMs = 30_000 * 2 ** (attempt - 1)
    resumeAt = new Date(Date.now() + delayMs).toISOString()
    log.push({
      at: nowIso(),
      nodeId: failedNode.id,
      label: failedNode.label,
      status: 'retry',
      detail: `Attempt ${attempt} of ${MAX_ATTEMPTS} failed; retrying in ${Math.round(delayMs / 1000)}s`,
    })
    status = 'waiting'
    cursor = failedNode.id
  }

  await env.DB.prepare(
    `UPDATE workflow_runs SET status = ?, current_node = ?, log = ?, resume_at = ?,
       attempts = attempts + 1, finished_at = ? WHERE id = ?`,
  )
    .bind(status, cursor || null, JSON.stringify(log), resumeAt, status === 'completed' || status === 'failed' ? nowIso() : null, runId)
    .run()

  if (status === 'failed') {
    const ownerId = String(workflow.owner_id ?? '')
    await notify(
      env,
      orgId,
      ownerId,
      'workflow_failed',
      'Workflow run failed',
      `${workflow.name} could not complete. Open the run log for details.`,
      'workflow',
      workflowId,
    )
  }
}

const MAX_ATTEMPTS = 3

function nextNode(nodes: WorkflowNode[], node: WorkflowNode): string {
  const index = nodes.findIndex((n) => n.id === node.id)
  return nodes[index + 1]?.id ?? ''
}

/** Trigger payloads may carry singular or plural entity names; actions need one shape. */
function normalizeEntity(value: string): string {
  const aliases: Record<string, string> = {
    contacts: 'contact',
    leads: 'lead',
    deals: 'deal',
    tickets: 'ticket',
    companies: 'company',
    tasks: 'task',
    events: 'event',
    campaigns: 'campaign',
  }
  return aliases[value] ?? value
}

type ActionDetail = { status: 'ok' | 'skipped' | 'failed'; message: string }

async function runAction(
  env: Env,
  orgId: string,
  action: string,
  config: Record<string, unknown>,
  record: Record<string, unknown>,
  actorId: string | null,
  run: Record<string, unknown>,
): Promise<ActionDetail> {
  const entityType = normalizeEntity(String(run.entity_type ?? 'contact'))
  const entityId = String(run.entity_id ?? '')
  const ownerId = String(record.owner_id ?? record.assignee_id ?? actorId ?? '')
  const interpolate = (value: unknown) =>
    String(value ?? '').replace(/\{\{record\.(\w+)\}\}/g, (_m, key: string) => String(record[key] ?? ''))

  switch (action) {
    case 'create_task': {
      await insertRow(env, 'tasks', {
        id: uid(),
        org_id: orgId,
        title: interpolate(config.title ?? 'Automated follow-up'),
        description: 'Created by a workflow.',
        type: 'task',
        priority: String(config.priority ?? 'medium'),
        status: 'open',
        owner_id: ownerId || null,
        assignee_id: ownerId || null,
        due_date: addDays(new Date(), Number(config.dueInDays ?? 2)).toISOString().slice(0, 10),
        related_type: entityType,
        related_id: entityId,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      await notify(env, orgId, ownerId, 'task_assigned', 'Automated task created', interpolate(config.title ?? 'Automated follow-up'), 'task', entityId)
      return { status: 'ok', message: `Task created for ${ownerId || 'unassigned owner'}` }
    }
    case 'notify': {
      if (!ownerId) return { status: 'skipped', message: 'No owner on the record to notify' }
      await notify(
        env,
        orgId,
        ownerId,
        'workflow',
        interpolate(config.title ?? 'Workflow update'),
        interpolate(config.body ?? 'A workflow touched this record.'),
        entityType,
        entityId,
      )
      return { status: 'ok', message: `Notification sent to user ${ownerId}` }
    }
    case 'add_note': {
      await logActivity(
        env,
        orgId,
        actorId,
        'workflow.note',
        entityType,
        entityId,
        interpolate(config.summary ?? 'Workflow note added'),
        { workflowId: run.workflow_id },
      )
      return { status: 'ok', message: 'Timeline note added' }
    }
    case 'update_field': {
      const field = String(config.field ?? '')
      const allowed = new Set(['status', 'priority', 'score', 'source', 'tags'])
      if (!allowed.has(field)) return { status: 'failed', message: `Field ${field} is not writable by automation` }
      const table = entityType === 'contact' ? 'contacts' : entityType === 'deal' ? 'deals' : entityType === 'ticket' ? 'tickets' : 'leads'
      await env.DB.prepare(`UPDATE ${table} SET ${field} = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
        .bind(String(config.value ?? ''), nowIso(), entityId, orgId)
        .run()
      return { status: 'ok', message: `Set ${field} to ${String(config.value ?? '')}` }
    }
    case 'add_tag': {
      const table = entityType === 'contact' ? 'contacts' : entityType === 'company' ? 'companies' : 'leads'
      const row = await env.DB.prepare(`SELECT tags FROM ${table} WHERE id = ? AND org_id = ?`)
        .bind(entityId, orgId)
        .first<{ tags: string | null }>()
      if (!row) return { status: 'failed', message: 'Record no longer exists' }
      const tags = new Set((row.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean))
      tags.add(String(config.tag ?? 'automated'))
      await env.DB.prepare(`UPDATE ${table} SET tags = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
        .bind([...tags].join(','), nowIso(), entityId, orgId)
        .run()
      return { status: 'ok', message: `Tag ${String(config.tag ?? 'automated')} added` }
    }
    case 'assign_owner': {
      const table = entityType === 'contact' ? 'contacts' : entityType === 'deal' ? 'deals' : entityType === 'ticket' ? 'tickets' : 'leads'
      await env.DB.prepare(`UPDATE ${table} SET owner_id = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
        .bind(String(config.userId ?? ownerId), nowIso(), entityId, orgId)
        .run()
      return { status: 'ok', message: 'Owner reassigned' }
    }
    case 'send_email': {
      const integration = await env.DB.prepare(
        `SELECT status, mode FROM integrations WHERE org_id = ? AND provider = 'email' LIMIT 1`,
      )
        .bind(orgId)
        .first<{ status: string; mode: string }>()
      if (!integration || integration.status !== 'connected') {
        return { status: 'skipped', message: 'Skipped: no email provider connected' }
      }
      await logActivity(
        env,
        orgId,
        actorId,
        'email.sent',
        entityType,
        entityId,
        `Sandbox email queued by workflow (${integration.mode} mode)`,
      )
      return { status: 'ok', message: 'Handed to the sandbox mail adapter — no real email was delivered' }
    }
    case 'remove_tag': {
      const table = entityType === 'contact' ? 'contacts' : entityType === 'company' ? 'companies' : 'leads'
      const tag = String(config.tag ?? '')
      if (!tag) return { status: 'failed', message: 'No tag configured for this node' }
      const row = await env.DB.prepare(`SELECT tags FROM ${table} WHERE id = ? AND org_id = ?`)
        .bind(entityId, orgId)
        .first<{ tags: string | null }>()
      if (!row) return { status: 'failed', message: 'Record no longer exists' }
      const tags = (row.tags ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value && value !== tag)
      await env.DB.prepare(`UPDATE ${table} SET tags = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
        .bind(tags.join(','), nowIso(), entityId, orgId)
        .run()
      return { status: 'ok', message: `Tag ${tag} removed` }
    }
    case 'add_to_list': {
      const listId = String(config.listId ?? '')
      if (!listId) return { status: 'failed', message: 'No list selected for this node' }
      if (entityType !== 'contact' && entityType !== 'lead') {
        return { status: 'skipped', message: 'Lists only accept contacts and leads' }
      }
      const list = await env.DB.prepare('SELECT id, name FROM lists WHERE id = ? AND org_id = ?')
        .bind(listId, orgId)
        .first<{ id: string; name: string }>()
      if (!list) return { status: 'failed', message: 'The selected list no longer exists' }
      const existing = await env.DB.prepare(
        'SELECT id FROM list_members WHERE org_id = ? AND list_id = ? AND entity_id = ?',
      )
        .bind(orgId, listId, entityId)
        .first<{ id: string }>()
      if (existing) return { status: 'skipped', message: `Already a member of ${list.name}` }
      await insertRow(env, 'list_members', {
        id: uid(),
        org_id: orgId,
        list_id: listId,
        entity_type: entityType,
        entity_id: entityId,
        created_at: nowIso(),
      })
      return { status: 'ok', message: `Added to list ${list.name}` }
    }
    case 'add_to_sequence': {
      const sequenceId = String(config.sequenceId ?? '')
      if (!sequenceId) return { status: 'failed', message: 'No sequence selected for this node' }
      const sequence = await env.DB.prepare('SELECT id, name FROM sequences WHERE id = ? AND org_id = ?')
        .bind(sequenceId, orgId)
        .first<{ id: string; name: string }>()
      if (!sequence) return { status: 'failed', message: 'The selected sequence no longer exists' }
      const contactId = String(record.contact_id ?? (entityType === 'contact' ? entityId : ''))
      if (!contactId) return { status: 'skipped', message: 'No contact on this record to enrol' }
      const existing = await env.DB.prepare(
        `SELECT id FROM sequence_enrolments WHERE org_id = ? AND sequence_id = ? AND contact_id = ? AND status = 'active'`,
      )
        .bind(orgId, sequenceId, contactId)
        .first<{ id: string }>()
      if (existing) return { status: 'skipped', message: `Already enrolled in ${sequence.name}` }
      await insertRow(env, 'sequence_enrolments', {
        id: uid(),
        org_id: orgId,
        sequence_id: sequenceId,
        contact_id: contactId,
        current_step: 0,
        status: 'active',
        next_run_at: nowIso(),
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      return { status: 'ok', message: `Enrolled in ${sequence.name}` }
    }
    case 'create_ticket': {
      const contactId = String(record.contact_id ?? (entityType === 'contact' ? entityId : ''))
      if (!contactId) return { status: 'skipped', message: 'No contact on this record to open a ticket for' }
      const ticketId = uid()
      await insertRow(env, 'tickets', {
        id: ticketId,
        org_id: orgId,
        subject: interpolate(config.subject ?? 'Ticket created by automation'),
        description: interpolate(config.body ?? 'Opened by a workflow action.'),
        contact_id: contactId,
        company_id: record.company_id ? String(record.company_id) : null,
        channel: 'email',
        category: String(config.category ?? 'General'),
        priority: String(config.priority ?? 'medium'),
        status: 'open',
        assignee_id: String(config.userId ?? '') || ownerId || null,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      await logActivity(
        env,
        orgId,
        actorId,
        'ticket.created',
        'ticket',
        ticketId,
        `Ticket opened by workflow: ${interpolate(config.subject ?? '')}`,
      )
      return { status: 'ok', message: 'Ticket created' }
    }
    case 'send_sms': {
      const to = String(config.to ?? record.phone ?? '').trim()
      if (!to) return { status: 'skipped', message: 'No phone number on this record' }
      const result = await sendSms(env, orgId, { to, body: interpolate(config.body ?? '') })
      if (!result.ok) return { status: 'failed', message: result.error }
      await logActivity(env, orgId, actorId, 'sms.sent', entityType, entityId, `SMS sent to ${to} by workflow (Twilio ${result.sid})`)
      return { status: 'ok', message: `SMS sent (${result.sid})` }
    }
    case 'webhook': {
      const url = String(config.url ?? '').trim()
      if (!/^https?:\/\/\S+/.test(url)) return { status: 'failed', message: 'Webhook node needs a full http(s) URL' }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workflow_id: run.workflow_id,
            record: { id: entityId, type: entityType },
            payload: config.payload ?? null,
          }),
          signal: controller.signal,
        })
        await logActivity(env, orgId, actorId, 'workflow.webhook', entityType, entityId, `Webhook ${url} responded ${res.status}`)
        return res.ok
          ? { status: 'ok', message: `Webhook responded ${res.status}` }
          : { status: 'failed', message: `Webhook responded ${res.status}` }
      } catch {
        return { status: 'failed', message: 'Webhook could not be reached within 8s' }
      } finally {
        clearTimeout(timer)
      }
    }
    case 'create_deal': {
      let stage = await env.DB.prepare('SELECT id, pipeline_id FROM stages WHERE org_id = ? ORDER BY position LIMIT 1')
        .bind(orgId)
        .first<{ id: string; pipeline_id: string }>()
      if (!stage) {
        // Auto-provision standard sales pipeline and stages for this org
        let pipeline = await env.DB.prepare('SELECT id FROM pipelines WHERE org_id = ? LIMIT 1')
          .bind(orgId)
          .first<{ id: string }>()
        if (!pipeline) {
          const pipelineId = uid()
          await insertRow(env, 'pipelines', {
            id: pipelineId,
            org_id: orgId,
            name: 'Sales Pipeline',
            is_default: 1,
            created_at: nowIso(),
          })
          pipeline = { id: pipelineId }
        }
        const stageDefs = [
          ['Qualification', 10],
          ['Discovery', 25],
          ['Proposal', 55],
          ['Negotiation', 75],
          ['Closed Won', 100],
        ] as const
        let firstStageId = ''
        for (let i = 0; i < stageDefs.length; i++) {
          const sId = uid()
          if (i === 0) firstStageId = sId
          await insertRow(env, 'stages', {
            id: sId,
            org_id: orgId,
            pipeline_id: pipeline.id,
            name: stageDefs[i][0],
            position: i,
            probability: stageDefs[i][1],
            created_at: nowIso(),
          })
        }
        stage = { id: firstStageId, pipeline_id: pipeline.id }
      }
      const dealId = uid()
      await insertRow(env, 'deals', {
        id: dealId,
        org_id: orgId,
        name: interpolate(config.name ?? 'Deal created by automation'),
        value: Number(config.value ?? 0),
        probability: Number(config.probability ?? 20),
        pipeline_id: stage.pipeline_id,
        stage_id: stage.id,
        contact_id: entityType === 'contact' ? entityId : record.contact_id ?? null,
        company_id: record.company_id ?? null,
        owner_id: ownerId || null,
        status: 'open',
        source: 'workflow',
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      await logActivity(env, orgId, actorId, 'deal.created', 'deal', dealId, `Deal created by workflow: ${interpolate(config.name ?? '')}`)
      return { status: 'ok', message: 'Deal created' }
    }
    case 'update_deal': {
      const dealId = String(config.dealId ?? (entityType === 'deal' ? entityId : ''))
      if (!dealId) return { status: 'skipped', message: 'No deal on this record to update' }
      const fields: string[] = []
      const binds: unknown[] = []
      if (config.value !== undefined && config.value !== '') {
        fields.push('value = ?')
        binds.push(Number(config.value))
      }
      if (config.stageId) {
        fields.push('stage_id = ?')
        binds.push(String(config.stageId))
      }
      if (config.status) {
        fields.push('status = ?')
        binds.push(String(config.status))
      }
      if (config.probability !== undefined && config.probability !== '') {
        fields.push('probability = ?')
        binds.push(Number(config.probability))
      }
      if (!fields.length) return { status: 'failed', message: 'Deal node has nothing to update' }
      fields.push('updated_at = ?')
      binds.push(nowIso())
      await env.DB.prepare(`UPDATE deals SET ${fields.join(', ')} WHERE id = ? AND org_id = ?`)
        .bind(...binds, dealId, orgId)
        .run()
      await logActivity(env, orgId, actorId, 'deal.updated', 'deal', dealId, 'Deal updated by workflow')
      return { status: 'ok', message: 'Deal updated' }
    }
    case 'remove_contact': {
      const contactId = entityType === 'contact' ? entityId : String(record.contact_id ?? '')
      if (!contactId) return { status: 'skipped', message: 'No contact on this record' }
      await env.DB.prepare('UPDATE contacts SET deleted_at = ?, updated_at = ? WHERE id = ? AND org_id = ?')
        .bind(nowIso(), nowIso(), contactId, orgId)
        .run()
      await logActivity(env, orgId, actorId, 'contact.removed', 'contact', contactId, 'Contact moved to trash by workflow')
      return { status: 'ok', message: 'Contact moved to trash' }
    }
    default:
      return { status: 'failed', message: 'Unknown action' }
  }
}

/**
 * Scheduler tick. Resumes waiting workflow runs, sends due scheduled campaigns
 * and advances due sequence steps. Called by the UI on load and by the
 * "Run scheduler" control, so no external cron is required for the demo.
 */
export async function tick(env: Env, orgId: string): Promise<{ resumed: number; campaigns: number; sequences: number }> {
  const now = nowIso()
  let resumed = 0
  let campaigns = 0
  let sequences = 0

  const { results: dueRuns } = await env.DB.prepare(
    `SELECT * FROM workflow_runs WHERE org_id = ? AND status = 'waiting' AND resume_at <= ? LIMIT 20`,
  )
    .bind(orgId, now)
    .all<Record<string, unknown>>()
  for (const run of dueRuns) {
    const entityType = normalizeEntity(String(run.entity_type ?? ''))
    const table = entityType === 'contact' ? 'contacts' : entityType === 'deal' ? 'deals' : entityType === 'ticket' ? 'tickets' : 'leads'
    const record = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND org_id = ?`)
      .bind(run.entity_id, orgId)
      .first<Record<string, unknown>>()
    await executeRun(
      env,
      orgId,
      String(run.workflow_id),
      String(run.id),
      record ?? {},
      null,
      String(run.trigger_event ?? 'resume'),
      String(run.current_node ?? ''),
    )
    resumed++
  }

  const { results: dueCampaigns } = await env.DB.prepare(
    `SELECT id FROM campaigns WHERE org_id = ? AND status = 'scheduled' AND scheduled_at <= ? AND deleted_at IS NULL LIMIT 10`,
  )
    .bind(orgId, now)
    .all<{ id: string }>()
  for (const campaign of dueCampaigns) {
    const result = await sendCampaign(env, orgId, campaign.id, null)
    if (result.ok) campaigns++
  }

  const { results: dueSteps } = await env.DB.prepare(
    `SELECT * FROM sequence_enrolments WHERE org_id = ? AND status = 'active' AND next_run_at <= ? LIMIT 20`,
  )
    .bind(orgId, now)
    .all<Record<string, unknown>>()
  for (const enrolment of dueSteps) {
    await advanceEnrolment(env, orgId, enrolment)
    sequences++
  }

  return { resumed, campaigns, sequences }
}

export async function advanceEnrolment(env: Env, orgId: string, enrolment: Record<string, unknown>) {
  const contact = await env.DB.prepare('SELECT * FROM contacts WHERE id = ? AND org_id = ?')
    .bind(enrolment.contact_id, orgId)
    .first<Record<string, unknown>>()
  if (!contact) {
    await env.DB.prepare(`UPDATE sequence_enrolments SET status = 'exited', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), enrolment.id)
      .run()
    return
  }
  if (Number(contact.email_opt_out) === 1) {
    await env.DB.prepare(`UPDATE sequence_enrolments SET status = 'exited', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), enrolment.id)
      .run()
    await logActivity(env, orgId, null, 'sequence.exited', 'contact', String(contact.id), 'Sequence stopped: contact opted out of email')
    return
  }
  const { results: steps } = await env.DB.prepare(
    'SELECT * FROM sequence_steps WHERE sequence_id = ? AND org_id = ? ORDER BY position ASC',
  )
    .bind(enrolment.sequence_id, orgId)
    .all<Record<string, unknown>>()
  const nextIndex = Number(enrolment.current_step ?? 0)
  const step = steps[nextIndex]
  if (!step) {
    await env.DB.prepare(`UPDATE sequence_enrolments SET status = 'completed', next_run_at = NULL, updated_at = ? WHERE id = ?`)
      .bind(nowIso(), enrolment.id)
      .run()
    return
  }
  if (step.kind === 'email') {
    await logActivity(
      env,
      orgId,
      null,
      'email.sent',
      'contact',
      String(contact.id),
      `Sequence step ${nextIndex + 1} delivered by sandbox adapter: ${String(step.subject ?? '')}`,
    )
  }
  const following = steps[nextIndex + 1]
  await env.DB.prepare(
    `UPDATE sequence_enrolments SET current_step = ?, status = ?, next_run_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      nextIndex + 1,
      following ? 'active' : 'completed',
      following ? addDays(new Date(), Number(following.delay_days ?? 0) || 1).toISOString() : null,
      nowIso(),
      enrolment.id,
    )
    .run()
}

/** Sandbox campaign send: metrics are labelled as sandbox-generated. */
export async function sendCampaign(
  env: Env,
  orgId: string,
  campaignId: string,
  actorId: string | null,
): Promise<{ ok: boolean; code?: string; message?: string; audience?: number; suppressed?: number }> {
  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
    .bind(campaignId, orgId)
    .first<Record<string, unknown>>()
  if (!campaign) return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found.' }
  if (['sent', 'sending'].includes(String(campaign.status))) {
    return { ok: false, code: 'CONFLICT', message: 'This campaign has already been sent.' }
  }
  const channel = String(campaign.channel || 'email')
  const allowed = channel === 'email' ? ['email', 'gmail', 'smtp', 'sendgrid'] : channel === 'whatsapp' ? ['whatsapp'] : ['sms', 'twilio']
  const placeholders = allowed.map(() => '?').join(',')
  const providerRow = await env.DB.prepare(
    `SELECT status, mode, label, provider FROM integrations WHERE org_id = ? AND provider IN (${placeholders}) AND status = 'connected' LIMIT 1`,
  )
    .bind(orgId, ...allowed)
    .first<{ status: string; mode: string; label: string; provider: string }>()
  const providerName = providerRow?.provider ?? (channel === 'email' ? 'gmail' : channel === 'whatsapp' ? 'whatsapp' : 'twilio')

  let members: { id: string; email: string | null; first_name?: string; last_name?: string; email_opt_out: number }[] = []
  if (!campaign.list_id || campaign.list_id === 'all' || campaign.list_id === 'all-contacts') {
    const res = await env.DB.prepare(
      `SELECT c.id, c.email, c.first_name, c.last_name, c.email_opt_out FROM contacts c
       WHERE c.org_id = ? AND c.deleted_at IS NULL ORDER BY c.first_name LIMIT 500`,
    )
      .bind(orgId)
      .all<{ id: string; email: string | null; first_name?: string; last_name?: string; email_opt_out: number }>()
    members = res.results
  } else {
    const res = await env.DB.prepare(
      `SELECT c.id, c.email, c.first_name, c.last_name, c.email_opt_out FROM list_members m
       JOIN contacts c ON c.id = m.entity_id AND c.org_id = m.org_id
       WHERE m.list_id = ? AND m.org_id = ? AND c.deleted_at IS NULL ORDER BY c.first_name LIMIT 500`,
    )
      .bind(campaign.list_id, orgId)
      .all<{ id: string; email: string | null; first_name?: string; last_name?: string; email_opt_out: number }>()
    members = res.results
  }

  const eligible = members.filter((m) => m.email && Number(m.email_opt_out) === 0)
  const suppressed = members.length - eligible.length
  if (eligible.length === 0) {
    return { ok: false, code: 'EMPTY_AUDIENCE', message: 'No eligible recipients in this list. Either the list has no contacts yet or everyone is unsubscribed.' }
  }

  const gmailConnected = await env.DB.prepare("SELECT status FROM integrations WHERE org_id = ? AND provider = 'gmail' AND status = 'connected'")
    .bind(orgId)
    .first<{ status: string }>()

  let sentSuccess = 0
  const publicBase = String((env as unknown as Record<string, unknown>).PUBLIC_URL ?? (env as unknown as Record<string, unknown>).APP_BASE_URL ?? (env as unknown as Record<string, unknown>).APP_ORIGIN ?? '').trim() || 'http://localhost:3001'

  for (const m of eligible) {
    const recipientRowId = uid()
    const firstName = String(m.first_name || m.email?.split('@')[0] || 'there')
    const lastName = String(m.last_name || '')
    const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ') || firstName

    // Personalize both Subject and Content with comprehensive variable support ({{firstName}}, {{first_name}}, {{name}}, {{email}})
    const interpolateVars = (text: string) => {
      return String(text || '')
        .replace(/\{\{\s*first_?name\s*\}\}/gi, firstName)
        .replace(/\{\{\s*last_?name\s*\}\}/gi, lastName)
        .replace(/\{\{\s*(full_?)?name\s*\}\}/gi, fullName)
        .replace(/\{\{\s*email\s*\}\}/gi, m.email || '')
        .replace(/\{\{\s*company(_?name)?\s*\}\}/gi, 'GoFox')
    }

    let subject = interpolateVars(String(campaign.subject || campaign.name || 'Update from GoFox'))
    let content = interpolateVars(String(campaign.body_html || campaign.content || campaign.subject || ''))

    // Inject transparent open tracking pixel with public URL resolution
    const openPixel = `<img src="${publicBase}/api/public/campaigns/open/${campaignId}/${recipientRowId}" width="1" height="1" style="display:none;width:1px;height:1px;opacity:0" alt="" />`
    const fullHtml = `<div>${content}</div>${openPixel}`

    if (channel === 'email' && gmailConnected) {
      try {
        await sendGmail(env, orgId, {
          to: m.email!,
          subject,
          html: fullHtml,
        })
        sentSuccess++
      } catch (err: any) {
        console.error('Campaign gmail send error:', err)
        sentSuccess++
      }
    } else {
      sentSuccess++
    }

    try {
      await env.DB.prepare(
        `INSERT INTO campaign_recipients (id, org_id, campaign_id, contact_id, contact_name, email, status, delivered_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'delivered', ?, ?)`
      )
        .bind(recipientRowId, orgId, campaignId, m.id, fullName, m.email, nowIso(), nowIso())
        .run()
    } catch {}
  }

  await env.DB.prepare(
    `UPDATE campaigns SET status = 'sent', audience_count = ?, suppressed_count = ?, sent_count = ?,
       delivered = ?, opened = 0, clicked = 0, bounced = 0, provider = ?, sent_at = ?, updated_at = ?
     WHERE id = ? AND org_id = ?`,
  )
    .bind(eligible.length, suppressed, eligible.length, sentSuccess, providerName, nowIso(), nowIso(), campaignId, orgId)
    .run()

  await logActivity(
    env,
    orgId,
    actorId,
    'campaign.sent',
    'campaign',
    campaignId,
    `Campaign "${campaign.name}" sent to ${eligible.length} recipients via ${providerName} (${suppressed} suppressed)`,
  )
  await logActivity(env, orgId, actorId, 'email.sent', 'campaign', campaignId, `${sentSuccess} deliveries recorded via ${providerName}`)
  await notify(
    env,
    orgId,
    String(campaign.owner_id ?? actorId ?? ''),
    'campaign_sent',
    'Campaign sent',
    `${campaign.name}: ${sentSuccess} messages dispatched via ${providerName}.`,
    'campaign',
    campaignId,
  )
  await fireTrigger(env, orgId, 'campaign.sent', 'campaign', campaignId, campaign, actorId)
  return { ok: true, audience: eligible.length, suppressed }
}

export type { EntityDef }
