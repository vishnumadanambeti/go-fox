import type { Env } from './db'

type Row = Record<string, unknown>
const num = (value: unknown) => Number(value ?? 0)

async function all(env: Env, sql: string, ...binds: unknown[]): Promise<Row[]> {
  const { results } = await env.DB.prepare(sql).bind(...binds).all<Row>()
  return results
}

async function one(env: Env, sql: string, ...binds: unknown[]): Promise<Row> {
  return (await env.DB.prepare(sql).bind(...binds).first<Row>()) ?? {}
}

/** A widget that throws is isolated by the API layer; the client retries it. */
export async function homeDashboard(env: Env, orgId: string, userId: string, days = 7) {
  const [tasks, counts, pipeline, activity, gettingStarted, quota] = await Promise.all([
    all(
      env,
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.related_type, t.related_id
       FROM tasks t WHERE t.org_id = ? AND t.deleted_at IS NULL AND t.status IN ('open','in_progress')
         AND (t.assignee_id = ? OR t.owner_id = ?)
       ORDER BY (t.due_date IS NULL), t.due_date ASC LIMIT 6`,
      orgId,
      userId,
      userId,
    ),
    one(
      env,
      `SELECT
        (SELECT COUNT(*) FROM contacts WHERE org_id = ? AND deleted_at IS NULL) AS contacts,
        (SELECT COUNT(*) FROM companies WHERE org_id = ? AND deleted_at IS NULL) AS companies,
        (SELECT COUNT(*) FROM leads WHERE org_id = ? AND deleted_at IS NULL) AS leads,
        (SELECT COUNT(*) FROM leads WHERE org_id = ? AND deleted_at IS NULL AND status = 'new') AS new_leads,
        (SELECT COUNT(*) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status = 'open') AS open_deals,
        (SELECT COALESCE(SUM(value),0) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status = 'open') AS pipeline_value,
        (SELECT COUNT(*) FROM tickets WHERE org_id = ? AND deleted_at IS NULL AND status IN ('open','pending')) AS open_tickets,
        (SELECT COUNT(*) FROM tasks WHERE org_id = ? AND deleted_at IS NULL AND status IN ('open','in_progress') AND assignee_id = ?) AS my_open_tasks`,
      orgId, orgId, orgId, orgId, orgId, orgId, orgId, orgId, userId,
    ),
    all(
      env,
      `SELECT s.id, s.name, s.position, COUNT(d.id) AS deal_count, COALESCE(SUM(d.value),0) AS value
       FROM stages s
       LEFT JOIN deals d ON d.stage_id = s.id AND d.org_id = s.org_id AND d.deleted_at IS NULL AND d.status = 'open'
       WHERE s.org_id = ? GROUP BY s.id ORDER BY s.position`,
      orgId,
    ),
    all(
      env,
      `SELECT a.id, a.type, a.summary, a.created_at, a.entity_type, a.entity_id, u.name AS actor
       FROM activities a LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.org_id = ? ORDER BY a.created_at DESC LIMIT 8`,
      orgId,
    ),
    one(
      env,
      `SELECT
        (SELECT COUNT(*) FROM companies WHERE org_id = ?) AS companies,
        (SELECT COUNT(*) FROM contacts WHERE org_id = ?) AS contacts,
        (SELECT COUNT(*) FROM forms WHERE org_id = ? AND status = 'published') AS published_forms,
        (SELECT COUNT(*) FROM campaigns WHERE org_id = ? AND status = 'sent') AS sent_campaigns,
        (SELECT COUNT(*) FROM workflows WHERE org_id = ? AND status = 'live') AS live_workflows,
        (SELECT COUNT(*) FROM integrations WHERE org_id = ? AND status = 'connected') AS connected_apps`,
      orgId, orgId, orgId, orgId, orgId, orgId,
    ),
    one(
      env,
      `SELECT COUNT(*) AS total FROM activities WHERE org_id = ? AND created_at >= datetime('now','-7 day')`,
      orgId,
    ),
  ])
  // Real per-day activity counts, oldest first. Days with no activity are returned as zero rather
  // than being invented, so the chart can never show fabricated volume.
  const window = [7, 14, 30].includes(days) ? days : 7
  const byDay = await all(
    env,
    `SELECT date(created_at) AS day, COUNT(*) AS value FROM activities
     WHERE org_id = ? AND created_at >= date('now', ?) GROUP BY date(created_at)`,
    orgId,
    `-${window - 1} day`,
  )
  const lookup = new Map(byDay.map((row) => [String(row.day), num(row.value)]))
  const activityByDay = Array.from({ length: window }, (_, index) => {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() - (window - 1 - index))
    const key = day.toISOString().slice(0, 10)
    return { day: key, value: lookup.get(key) ?? 0 }
  })
  // Premium command-centre data. Every series is a direct aggregation over persisted rows.
  const [leadFunnel, wonLost, leadSources, meetings, comms, integrations, overdue, revenueTrend, teamPerformance] = await Promise.all([
    all(
      env,
      `SELECT status, COUNT(*) AS value FROM leads WHERE org_id = ? AND deleted_at IS NULL GROUP BY status`,
      orgId,
    ),
    one(
      env,
      `SELECT
        (SELECT COUNT(*) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='won') AS won_count,
        (SELECT COALESCE(SUM(value),0) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='won') AS won_value,
        (SELECT COUNT(*) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='lost') AS lost_count,
        (SELECT COALESCE(SUM(value),0) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='lost') AS lost_value,
        (SELECT COALESCE(SUM(value),0) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='won' AND updated_at >= datetime('now','-30 day')) AS won_value_30`,
      orgId, orgId, orgId, orgId, orgId,
    ),
    all(
      env,
      `SELECT COALESCE(NULLIF(TRIM(source),''),'Unknown') AS source, COUNT(*) AS value
       FROM leads WHERE org_id = ? AND deleted_at IS NULL GROUP BY source ORDER BY value DESC LIMIT 6`,
      orgId,
    ),
    all(
      env,
      `SELECT e.id, e.title, e.start_at, e.end_at, e.location, e.attendees, e.meeting_url
       FROM events e WHERE e.org_id = ? AND e.deleted_at IS NULL AND e.start_at >= datetime('now')
       ORDER BY e.start_at ASC LIMIT 5`,
      orgId,
    ),
    all(
      env,
      `SELECT a.id, a.type, a.summary, a.created_at, a.entity_type, a.entity_id, u.name AS actor
       FROM activities a LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.org_id = ? AND a.type IN ('email','call','sms','ticket','form')
       ORDER BY a.created_at DESC LIMIT 5`,
      orgId,
    ),
    all(
      env,
      `SELECT provider, label, category, status, account, last_sync, note FROM integrations WHERE org_id = ? ORDER BY (status='error') DESC, label`,
      orgId,
    ),
    one(
      env,
      `SELECT COUNT(*) AS value FROM tasks WHERE org_id = ? AND deleted_at IS NULL
        AND status IN ('open','in_progress') AND due_date IS NOT NULL AND due_date < date('now')`,
      orgId,
    ),
    all(
      env,
      `SELECT strftime('%Y-%m', COALESCE(updated_at, created_at)) AS month, COALESCE(SUM(value),0) AS value
       FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='won'
         AND COALESCE(updated_at, created_at) >= datetime('now','-180 day')
       GROUP BY month ORDER BY month`,
      orgId,
    ),
    all(
      env,
      `SELECT u.id, u.name, u.avatar_hue,
        (SELECT COALESCE(SUM(d.value),0) FROM deals d WHERE d.owner_id = u.id AND d.org_id = u.org_id AND d.deleted_at IS NULL AND d.status='won') AS won_value,
        (SELECT COUNT(*) FROM tasks t WHERE t.owner_id = u.id AND t.org_id = u.org_id AND t.deleted_at IS NULL AND t.status IN ('open','in_progress')) AS open_tasks
       FROM users u WHERE u.org_id = ? AND u.status='active' ORDER BY won_value DESC LIMIT 5`,
      orgId,
    ),
  ])
  const leadOrder = ['new', 'contacted', 'qualified', 'converted', 'lost']
  const funnel = leadOrder
    .map((status) => ({ label: status, value: num(leadFunnel.find((row) => String(row.status) === status)?.value) }))
    .filter((step) => step.value > 0)
  return {
    tasks,
    counts: { ...counts, overdue_tasks: num(overdue.value) },
    pipeline,
    activity,
    gettingStarted,
    weeklyActivity: num(quota.total),
    activityByDay,
    charts: {
      funnel,
      wonLost,
      leadSources: leadSources.map((row) => ({ label: String(row.source), value: num(row.value) })),
      revenueTrend: revenueTrend.map((row) => ({ label: String(row.month), value: num(row.value) })),
    },
    meetings,
    comms,
    integrations: integrations.map((row) => ({
      provider: row.provider,
      label: row.label,
      category: row.category,
      status: row.status,
      account: row.account,
      last_sync: row.last_sync,
      note: row.note,
    })),
    teamPerformance,
  }
}

export async function marketingDashboard(env: Env, orgId: string) {
  const [summary, trend, channels, funnel, recentLeads, sources, topPages, activity] = await Promise.all([
    one(
      env,
      `SELECT
        (SELECT COUNT(*) FROM leads WHERE org_id = ? AND deleted_at IS NULL AND created_at >= datetime('now','-30 day')) AS new_leads,
        (SELECT COUNT(*) FROM contacts WHERE org_id = ? AND deleted_at IS NULL) AS contacts,
        (SELECT COUNT(*) FROM campaigns WHERE org_id = ? AND deleted_at IS NULL AND status = 'sent') AS campaigns_sent,
        (SELECT COALESCE(SUM(delivered),0) FROM campaigns WHERE org_id = ?) AS delivered,
        (SELECT COALESCE(SUM(opened),0) FROM campaigns WHERE org_id = ?) AS opened,
        (SELECT COALESCE(SUM(clicked),0) FROM campaigns WHERE org_id = ?) AS clicked,
        (SELECT COUNT(*) FROM form_submissions WHERE org_id = ? AND created_at >= datetime('now','-30 day')) AS submissions,
        (SELECT COUNT(*) FROM web_events WHERE org_id = ? AND created_at >= datetime('now','-30 day')) AS web_events,
        (SELECT COALESCE(SUM(views),0) FROM landing_pages WHERE org_id = ?) AS page_views`,
      orgId, orgId, orgId, orgId, orgId, orgId, orgId, orgId, orgId,
    ),
    all(
      env,
      `SELECT date(created_at) AS day, COUNT(*) AS value FROM leads
       WHERE org_id = ? AND deleted_at IS NULL AND created_at >= datetime('now','-29 day')
       GROUP BY day ORDER BY day`,
      orgId,
    ),
    all(
      env,
      `SELECT channel, COUNT(*) AS campaigns, COALESCE(SUM(sent_count),0) AS sent,
              COALESCE(SUM(opened),0) AS opened, COALESCE(SUM(clicked),0) AS clicked
       FROM campaigns WHERE org_id = ? AND deleted_at IS NULL GROUP BY channel`,
      orgId,
    ),
    all(
      env,
      `SELECT status, COUNT(*) AS value FROM leads WHERE org_id = ? AND deleted_at IS NULL GROUP BY status`,
      orgId,
    ),
    all(
      env,
      `SELECT id, first_name, last_name, email, company_name, source, status, created_at
       FROM leads WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`,
      orgId,
    ),
    all(
      env,
      `SELECT COALESCE(utm_source,'direct') AS source, COUNT(*) AS value FROM web_events
       WHERE org_id = ? AND created_at >= datetime('now','-30 day') GROUP BY source ORDER BY value DESC LIMIT 6`,
      orgId,
    ),
    all(
      env,
      `SELECT id, name, slug, status, views FROM landing_pages WHERE org_id = ? AND deleted_at IS NULL ORDER BY views DESC LIMIT 5`,
      orgId,
    ),
    all(
      env,
      `SELECT a.id, a.type, a.summary, a.created_at, u.name AS actor FROM activities a
       LEFT JOIN users u ON u.id = a.actor_id WHERE a.org_id = ? ORDER BY a.created_at DESC LIMIT 8`,
      orgId,
    ),
  ])
  return { summary, trend, channels, funnel, recentLeads, sources, topPages, activity }
}

export async function salesDashboard(env: Env, orgId: string) {
  const [totals, byStage, byOwner, tasks, calls, docs, closesSoon, products, trend] = await Promise.all([
    one(
      env,
      `SELECT
        (SELECT COUNT(*) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='open') AS open_deals,
        (SELECT COALESCE(SUM(value),0) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='open') AS open_value,
        (SELECT COALESCE(SUM(value * probability / 100.0),0) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='open') AS weighted_value,
        (SELECT COALESCE(SUM(value),0) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='won') AS won_value,
        (SELECT COUNT(*) FROM deals WHERE org_id = ? AND deleted_at IS NULL AND status='won') AS won_count,
        (SELECT COUNT(*) FROM tasks WHERE org_id = ? AND deleted_at IS NULL AND status IN ('open','in_progress')) AS open_tasks,
        (SELECT COUNT(*) FROM tasks WHERE org_id = ? AND deleted_at IS NULL AND status IN ('open','in_progress') AND due_date < date('now')) AS overdue_tasks,
        (SELECT COUNT(*) FROM calls WHERE org_id = ? AND deleted_at IS NULL) AS calls,
        (SELECT COALESCE(SUM(duration),0) FROM calls WHERE org_id = ? AND deleted_at IS NULL) AS call_seconds,
        (SELECT COUNT(*) FROM documents WHERE org_id = ? AND doc_type='quote') AS quotes,
        (SELECT COUNT(*) FROM documents WHERE org_id = ? AND doc_type='invoice' AND status='paid') AS paid_invoices,
        (SELECT COALESCE(SUM(total),0) FROM documents WHERE org_id = ? AND doc_type='invoice' AND status='paid') AS paid_value`,
      ...Array(12).fill(orgId),
    ),
    all(
      env,
      `SELECT s.id, s.name, s.position, COUNT(d.id) AS deal_count, COALESCE(SUM(d.value),0) AS value,
              COALESCE(SUM(d.value * d.probability / 100.0),0) AS weighted
       FROM stages s LEFT JOIN deals d ON d.stage_id = s.id AND d.org_id = s.org_id
         AND d.deleted_at IS NULL AND d.status='open'
       WHERE s.org_id = ? GROUP BY s.id ORDER BY s.position`,
      orgId,
    ),
    all(
      env,
      `SELECT u.id, u.name, u.title,
        (SELECT COUNT(*) FROM deals d WHERE d.owner_id = u.id AND d.org_id = u.org_id AND d.deleted_at IS NULL AND d.status='open') AS deals,
        (SELECT COALESCE(SUM(d.value),0) FROM deals d WHERE d.owner_id = u.id AND d.org_id = u.org_id AND d.deleted_at IS NULL AND d.status='open') AS value,
        (SELECT COUNT(*) FROM deals d WHERE d.owner_id = u.id AND d.org_id = u.org_id AND d.deleted_at IS NULL AND d.status='won') AS won
       FROM users u WHERE u.org_id = ? AND u.status='active' ORDER BY value DESC`,
      orgId,
    ),
    all(
      env,
      `SELECT status, COUNT(*) AS value FROM tasks WHERE org_id = ? AND deleted_at IS NULL GROUP BY status`,
      orgId,
    ),
    all(
      env,
      `SELECT direction, COUNT(*) AS calls, COALESCE(SUM(duration),0) AS seconds FROM calls
       WHERE org_id = ? AND deleted_at IS NULL GROUP BY direction`,
      orgId,
    ),
    all(
      env,
      `SELECT doc_type, status, COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM documents
       WHERE org_id = ? AND deleted_at IS NULL GROUP BY doc_type, status`,
      orgId,
    ),
    all(
      env,
      `SELECT d.id, d.name, d.value, d.probability, d.expected_close, c.name AS company
       FROM deals d LEFT JOIN companies c ON c.id = d.company_id
       WHERE d.org_id = ? AND d.deleted_at IS NULL AND d.status='open'
         AND d.expected_close IS NOT NULL AND d.expected_close <= date('now','+21 day')
       ORDER BY d.expected_close ASC LIMIT 6`,
      orgId,
    ),
    all(env, `SELECT id, name, unit_price, currency, type FROM products WHERE org_id = ? AND deleted_at IS NULL ORDER BY unit_price DESC LIMIT 6`, orgId),
    all(
      env,
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS deals, COALESCE(SUM(value),0) AS value
       FROM deals WHERE org_id = ? AND deleted_at IS NULL AND created_at >= datetime('now','-180 day')
       GROUP BY month ORDER BY month`,
      orgId,
    ),
  ])
  return { totals, byStage, byOwner, tasks, calls, docs, closesSoon, products, trend }
}

export async function supportDashboard(env: Env, orgId: string) {
  const [totals, byPriority, workload, recent, sla] = await Promise.all([
    one(
      env,
      `SELECT
        (SELECT COUNT(*) FROM tickets WHERE org_id = ? AND deleted_at IS NULL) AS total,
        (SELECT COUNT(*) FROM tickets WHERE org_id = ? AND deleted_at IS NULL AND status IN ('open','pending')) AS open,
        (SELECT COUNT(*) FROM tickets WHERE org_id = ? AND deleted_at IS NULL AND status='resolved') AS resolved,
        (SELECT COUNT(*) FROM tickets WHERE org_id = ? AND deleted_at IS NULL AND status IN ('open','pending')
            AND resolution_due < datetime('now')) AS breached,
        (SELECT COUNT(*) FROM tickets WHERE org_id = ? AND deleted_at IS NULL AND first_response_at IS NULL
            AND status IN ('open','pending') AND first_response_due < datetime('now')) AS first_response_breached,
        (SELECT ROUND(AVG((julianday(first_response_at) - julianday(created_at)) * 1440)) FROM tickets
            WHERE org_id = ? AND first_response_at IS NOT NULL) AS avg_first_response_mins,
        (SELECT ROUND(AVG((julianday(resolved_at) - julianday(created_at)) * 1440)) FROM tickets
            WHERE org_id = ? AND resolved_at IS NOT NULL) AS avg_resolution_mins,
        (SELECT COUNT(*) FROM kb_articles WHERE org_id = ? AND status='published') AS published_articles`,
      ...Array(8).fill(orgId),
    ),
    all(
      env,
      `SELECT priority, status, COUNT(*) AS value FROM tickets WHERE org_id = ? AND deleted_at IS NULL
       GROUP BY priority, status`,
      orgId,
    ),
    all(
      env,
      `SELECT u.id, u.name,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.org_id = u.org_id
          AND t.deleted_at IS NULL AND t.status IN ('open','pending')) AS open_tickets
       FROM users u WHERE u.org_id = ? AND u.status='active'
       ORDER BY open_tickets DESC LIMIT 6`,
      orgId,
    ),
    all(
      env,
      `SELECT t.id, t.subject, t.priority, t.status, t.created_at, t.resolution_due, c.first_name, c.last_name
       FROM tickets t LEFT JOIN contacts c ON c.id = t.contact_id
       WHERE t.org_id = ? AND t.deleted_at IS NULL ORDER BY t.created_at DESC LIMIT 6`,
      orgId,
    ),
    all(
      env,
      `SELECT p.name, p.priority, p.first_response_mins, p.resolution_mins,
        (SELECT COUNT(*) FROM tickets t WHERE t.sla_policy_id = p.id AND t.deleted_at IS NULL) AS tickets,
        (SELECT COUNT(*) FROM tickets t WHERE t.sla_policy_id = p.id AND t.deleted_at IS NULL
          AND t.resolution_due < datetime('now') AND t.status IN ('open','pending')) AS breaches
       FROM sla_policies p WHERE p.org_id = ? AND p.deleted_at IS NULL`,
      orgId,
    ),
  ])
  return { totals, byPriority, workload, recent, sla }
}

export async function reportTable(env: Env, orgId: string, domain: string) {
  switch (domain) {
    case 'deals':
      return all(
        env,
        `SELECT s.name AS stage, COUNT(d.id) AS deals, COALESCE(SUM(d.value),0) AS value,
                COALESCE(SUM(d.value * d.probability / 100.0),0) AS weighted
         FROM stages s LEFT JOIN deals d ON d.stage_id = s.id AND d.org_id = s.org_id
           AND d.deleted_at IS NULL AND d.status = 'open'
         WHERE s.org_id = ? GROUP BY s.id ORDER BY s.position`,
        orgId,
      )
    case 'leads':
      return all(
        env,
        `SELECT source, COUNT(*) AS leads,
                SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) AS converted,
                ROUND(100.0 * SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) / COUNT(*), 1) AS conversion_rate
         FROM leads WHERE org_id = ? AND deleted_at IS NULL GROUP BY source ORDER BY leads DESC`,
        orgId,
      )
    case 'campaigns':
      return all(
        env,
        `SELECT name, channel, status, sent_count AS sent, delivered, opened, clicked,
                CASE WHEN sent_count > 0 THEN ROUND(100.0 * opened / sent_count, 1) ELSE 0 END AS open_rate,
                CASE WHEN sent_count > 0 THEN ROUND(100.0 * clicked / sent_count, 1) ELSE 0 END AS click_rate
         FROM campaigns WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
        orgId,
      )
    case 'tickets':
      return all(
        env,
        `SELECT priority, COUNT(*) AS tickets,
                SUM(CASE WHEN status IN ('open','pending') THEN 1 ELSE 0 END) AS open_tickets,
                SUM(CASE WHEN resolution_due < datetime('now') AND status IN ('open','pending') THEN 1 ELSE 0 END) AS breached,
                ROUND(AVG(CASE WHEN first_response_at IS NOT NULL
                  THEN (julianday(first_response_at) - julianday(created_at)) * 1440 END)) AS avg_first_response_mins
         FROM tickets WHERE org_id = ? AND deleted_at IS NULL GROUP BY priority`,
        orgId,
      )
    case 'contacts':
      return all(
        env,
        `SELECT source, COUNT(*) AS contacts, SUM(email_opt_out) AS opted_out
         FROM contacts WHERE org_id = ? AND deleted_at IS NULL GROUP BY source ORDER BY contacts DESC`,
        orgId,
      )
    default:
      return all(
        env,
        `SELECT type, COUNT(*) AS events FROM activities WHERE org_id = ?
         AND created_at >= datetime('now','-30 day') GROUP BY type ORDER BY events DESC`,
        orgId,
      )
  }
}
