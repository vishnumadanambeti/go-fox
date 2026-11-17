import { useEffect, useState } from 'react'
import { BookOpen, Headphones, MessageSquare, Plus, Send, Ticket as TicketIcon, Timer, Users } from 'lucide-react'
import { post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link } from '../lib/router'
import { formatDate, formatDateTime, number, titleCase } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  FormRow,
  Kpi,
  PageHeader,
  Skeleton,
  Spinner,
  StatusBadge,
  TableSkeleton,
  Tabs,
  cx,
} from '../components/ui'
import { Donut } from '../components/charts'
import { RecordDetailPage, ResourcePage } from '../components/resource'
import { WorkflowRunsPage } from './automation'

/* --------------------------------------------------------------- dashboard */
export function SupportDashboardPage() {
  const { data, loading, error, reload } = useFetch<any>('/api/dashboards/support')
  if (loading) return <div className="space-y-4 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (error || !data) return <ErrorState message={error?.message ?? 'Support dashboard unavailable'} onRetry={reload} />
  const totals = data.totals

  return (
    <div className="space-y-4 p-5">
      <PageHeader title="Support dashboard" subtitle="Ticket volume, SLA clocks and agent workload" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open tickets" value={totals.open} hint={`${totals.total} total`} icon={<TicketIcon size={15} />} tone={Number(totals.open) > 0 ? 'accent' : 'good'} />
        <Kpi label="SLA breached" value={totals.breached} hint={`${totals.first_response_breached} no first response`} icon={<Timer size={15} />} tone={Number(totals.breached) > 0 ? 'danger' : 'good'} />
        <Kpi label="Avg first response" value={totals.avg_first_response_mins ? `${number(totals.avg_first_response_mins)}m` : '—'} hint={`${totals.resolved} resolved`} icon={<Headphones size={15} />} tone="info" />
        <Kpi label="Avg resolution" value={totals.avg_resolution_mins ? `${Math.round(Number(totals.avg_resolution_mins) / 60)}h` : '—'} hint={`${totals.published_articles} KB articles`} icon={<BookOpen size={15} />} tone="good" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Recent tickets" subtitle="Newest first" action={<Link to="/support/tickets" className="text-[12px] text-accent hover:underline">All tickets</Link>} />
          <table className="gx-table">
            <thead><tr><th>Subject</th><th>Requester</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {data.recent.map((ticket: Row) => {
                const overdue = ticket.resolution_due && new Date(ticket.resolution_due) < new Date() && ['open', 'pending'].includes(ticket.status)
                return (
                  <tr key={ticket.id}>
                    <td><Link to={`/support/tickets/${ticket.id}`} className="font-medium hover:text-accent">{ticket.subject}</Link></td>
                    <td>{`${ticket.first_name ?? ''} ${ticket.last_name ?? ''}`.trim() || '—'}</td>
                    <td><StatusBadge value={ticket.priority} /></td>
                    <td><StatusBadge value={ticket.status} /></td>
                    <td className={overdue ? 'font-medium text-danger' : 'text-muted'}>{ticket.resolution_due ? formatDate(ticket.resolution_due, 'day') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Agent workload" subtitle="Open tickets per agent" />
          <div className="space-y-2 p-4">
            {data.workload.map((agent: Row) => (
              <div key={agent.id} className="flex items-center gap-2">
                <span className="w-28 truncate text-[12px]">{agent.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Number(agent.open_tickets) * 18)}%` }} />
                </div>
                <span className="w-6 text-right text-[11px]">{agent.open_tickets}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tickets by priority" subtitle="All statuses" />
          <div className="p-4">
            <Donut
              data={data.byPriority.reduce((acc: Row[], row: Row) => {
                const existing = acc.find((item) => item.label === row.priority)
                if (existing) existing.value += Number(row.value)
                else acc.push({ label: String(row.priority), value: Number(row.value) })
                return acc
              }, []).map((row: Row) => ({ label: titleCase(row.label), value: row.value }))}
              centerLabel="tickets"
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="SLA policies" subtitle="Targets and breaches" action={<Link to="/support/sla" className="text-[12px] text-accent hover:underline">Manage</Link>} />
          <div className="space-y-2 p-4">
            {data.sla.map((policy: Row) => (
              <div key={policy.name} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate">{policy.name}</span>
                <span className="flex items-center gap-1.5">
                  <Badge>{policy.first_response_mins}m first</Badge>
                  <Badge>{Math.round(Number(policy.resolution_mins) / 60)}h resolve</Badge>
                  <Badge tone={Number(policy.breaches) ? 'danger' : 'good'}>{policy.breaches} breaches</Badge>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ tickets */
export function TicketsPage() {
  const { meta } = useApp()
  const [status, setStatus] = useState('open')
  const [priority, setPriority] = useState('')
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/tickets?limit=100&sort=created_at&dir=desc')
  const rows = (data?.data ?? [])
    .filter((ticket) => (status === 'open' ? ['open', 'pending'].includes(ticket.status) : status === 'all' ? true : ticket.status === status))
    .filter((ticket) => (priority ? ticket.priority === priority : true))

  const now = Date.now()
  const breached = rows.filter((ticket) => ticket.resolution_due && new Date(ticket.resolution_due).getTime() < now)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Tickets" subtitle={`${rows.length} in view · ${breached.length} past the resolution target`}>
        <select className="gx-select w-auto" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">All priorities</option>
          {['urgent', 'high', 'medium', 'low'].map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
        </select>
        <Link to="/support/tickets?new=1" className="gx-btn gx-btn-primary gx-btn-sm" onClick={() => undefined}>
          <Plus size={14} /> New ticket
        </Link>
      </PageHeader>
      <div className="border-b border-line px-5">
        <Tabs
          tabs={[
            { key: 'open', label: 'Open' },
            { key: 'resolved', label: 'Resolved' },
            { key: 'closed', label: 'Closed' },
            { key: 'all', label: 'All' },
          ]}
          active={status}
          onChange={setStatus}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : rows.length === 0 ? (
          <EmptyState icon={<TicketIcon size={18} />} title="No tickets in this view" description="Tickets created manually, by email or by the live chat widget appear here with their SLA clocks." />
        ) : (
          <table className="gx-table">
            <thead><tr><th>Subject</th><th>Requester</th><th>Priority</th><th>Status</th><th>Assignee</th><th>First response</th><th>Resolution</th></tr></thead>
            <tbody>
              {rows.map((ticket) => {
                const responseLate = !ticket.first_response_at && ticket.first_response_due && new Date(ticket.first_response_due) < new Date()
                const resolutionLate = ticket.resolution_due && new Date(ticket.resolution_due) < new Date() && ['open', 'pending'].includes(ticket.status)
                return (
                  <tr key={ticket.id} className="clickable" onClick={() => { window.location.assign(`/support/tickets/${ticket.id}`) }}>
                    <td>
                      <div className="font-medium">{ticket.subject}</div>
                      <div className="text-[10.5px] text-muted">{ticket.category} · {ticket.channel}</div>
                    </td>
                    <td>{meta?.contacts.find((c) => c.id === ticket.contact_id)?.first_name ?? '—'}</td>
                    <td><StatusBadge value={ticket.priority} /></td>
                    <td><StatusBadge value={ticket.status} /></td>
                    <td>{meta?.users.find((u) => u.id === ticket.assignee_id)?.name ?? 'Unassigned'}</td>
                    <td className={responseLate ? 'text-danger' : 'text-muted'}>{ticket.first_response_at ? formatDate(ticket.first_response_at, 'day') : responseLate ? 'Overdue' : 'Pending'}</td>
                    <td className={resolutionLate ? 'text-danger' : 'text-muted'}>{ticket.resolved_at ? formatDate(ticket.resolved_at, 'day') : formatDate(ticket.resolution_due, 'day')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function TicketDetailPage({ id }: { id: string }) {
  const { meta, toast } = useApp()
  return (
    <RecordDetailPage
      id={id}
      backTo="/support/tickets"
      backLabel="Tickets"
      config={{
        entity: 'tickets',
        title: (record) => String(record.subject ?? 'Ticket'),
        subtitle: (record) => `${record.category} · ${record.channel} · ${record.status}`,
        summary: ['contact_id', 'company_id', 'priority', 'status', 'assignee_id', 'sla_policy_id', 'first_response_due', 'resolution_due'],
        avatar: () => (
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><TicketIcon size={19} /></span>
        ),
        related: [],
      }}
      tabs={[
        {
          key: 'conversation',
          label: 'Conversation',
          render: (record) => <TicketThread ticketId={String(record.id)} toast={toast} userName={meta?.currentUser.name ?? 'Agent'} />,
        },
        {
          key: 'sla',
          label: 'SLA',
          render: (record) => {
            const responseLate = !record.first_response_at && record.first_response_due && new Date(record.first_response_due) < new Date()
            return (
              <div className="space-y-2 text-[12.5px]">
                <div className="flex justify-between"><span className="text-muted">First response due</span><span>{record.first_response_due ? formatDateTime(record.first_response_due) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted">First response at</span><span>{record.first_response_at ? formatDateTime(record.first_response_at) : 'Not yet'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Resolution due</span><span>{record.resolution_due ? formatDateTime(record.resolution_due) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Resolved at</span><span>{record.resolved_at ? formatDateTime(record.resolved_at) : 'Open'}</span></div>
                <div className={cx('rounded-lg px-3 py-2', responseLate ? 'bg-danger-soft text-danger' : 'bg-good-soft text-good')}>
                  {responseLate ? 'First response target has been missed.' : 'First response is inside the target window.'}
                </div>
              </div>
            )
          },
        },
      ]}
    />
  )
}

function TicketThread({ ticketId, toast, userName }: { ticketId: string; toast: (message: string, tone?: 'info' | 'good' | 'bad') => void; userName: string }) {
  const { data, loading, reload } = useFetch<{ data: Row[] }>(`/api/tickets/${ticketId}/messages`)
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!body.trim()) return
    setBusy(true)
    try {
      await post(`/api/tickets/${ticketId}/messages`, { body, internal })
      setBody('')
      toast(internal ? 'Internal note added.' : 'Reply recorded.', 'good')
      reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not send the message.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading conversation" />
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {(data?.data ?? []).map((message) => (
          <div key={message.id} className={cx('rounded-xl border p-2.5', Number(message.internal) === 1 ? 'border-warn bg-warn-soft' : 'border-line bg-surface-2')}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium">
                {message.author_type === 'customer' ? 'Customer' : message.author_name ?? userName}
                {Number(message.internal) === 1 ? <Badge tone="warn" className="ml-1">internal</Badge> : null}
              </span>
              <span className="text-muted">{formatDateTime(message.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap text-[12.5px]">{message.body}</p>
          </div>
        ))}
        {(data?.data ?? []).length === 0 ? <p className="text-[12.5px] text-muted">No messages yet. Reply below — the first reply sets the first-response timestamp.</p> : null}
      </div>
      <div className="rounded-xl border border-line p-2.5">
        <textarea className="gx-textarea" rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder={internal ? 'Internal note (customers never see this)' : 'Reply to the customer…'} />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <input type="checkbox" className="size-3.5 accent-[var(--color-accent)]" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
            Internal note
          </label>
          <Button size="sm" variant="primary" onClick={() => void send()} loading={busy}>
            <Send size={12} /> {internal ? 'Add note' : 'Send reply'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- live chat */
export function LiveChatPage() {
  return (
    <div className="p-5">
      <PageHeader title="Live chat" subtitle="Website widget, queue and agent assignment" />
      <Card className="mt-4 p-6 text-center">
        <Headphones size={24} className="mx-auto text-faint" />
        <h2 className="mt-2 text-[15px] font-semibold">No chat provider connected</h2>
        <p className="mx-auto mt-1 max-w-xl text-[12.5px] text-muted">
          Live chat needs a websocket-backed visitor widget and a provider for persistence. This build does not ship a chat backend, so the
          screen reports no queue rather than showing simulated conversations. Tickets capture the same conversations synchronously.
        </p>
        <Link to="/support/tickets" className="gx-btn gx-btn-primary gx-btn-sm mt-4">Open tickets</Link>
      </Card>
      <Card className="mt-4 p-4">
        <h3 className="text-[13px] font-semibold">What is wired today</h3>
        <ul className="mt-2 space-y-1 text-[12.5px] text-muted">
          <li>• Ticket threads with customer and agent messages plus internal notes.</li>
          <li>• First response and resolution timestamps feeding SLA reporting.</li>
          <li>• Knowledge base articles with draft and published states.</li>
          <li>• Support automations through the shared workflow engine.</li>
        </ul>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------- knowledge base */
export function KnowledgeBasePage() {
  const { toast } = useApp()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/kb_articles?limit=100')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const categories = [...new Set((data?.data ?? []).map((article) => String(article.category)))]
  const rows = (data?.data ?? []).filter(
    (article) => (category ? article.category === category : true) && (q ? String(article.title).toLowerCase().includes(q.toLowerCase()) : true),
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Knowledge base" subtitle={`${rows.length} articles · published articles are visible to customers`}>
        <input className="gx-input w-56" placeholder="Search articles…" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="gx-select w-auto" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((article) => (
              <Card key={article.id} className="p-3.5">
                <div className="flex items-start justify-between">
                  <BookOpen size={15} className="text-faint" />
                  <StatusBadge value={article.status} />
                </div>
                <h3 className="mt-2 line-clamp-2 text-[13px] font-semibold">{article.title}</h3>
                <p className="mt-1 text-[11.5px] text-muted">{article.category} · {article.views} views</p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await post(`/api/resources/kb_articles/${article.id}/restore`).catch(() => undefined)
                        await fetch(`/api/resources/kb_articles/${article.id}`, {
                          method: 'PATCH',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ status: article.status === 'published' ? 'draft' : 'published' }),
                        })
                        toast('Article status updated.', 'good')
                        reload()
                      } catch {
                        toast('Could not update the article.', 'bad')
                      }
                    }}
                  >
                    {article.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>
              </Card>
            ))}
            {rows.length === 0 ? <EmptyState title="No articles" description="Published articles answer common questions and can be linked from tickets." /> : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- SLA */
export function SlaPoliciesPage() {
  return <ResourcePage entity="sla_policies" title="SLA policies" subtitle="First response and resolution targets by priority" />
}

/* --------------------------------------------------------------- automations */
export function SupportAutomationsPage() {
  return <WorkflowRunsPage module="support" />
}

export function SupportChannelsCard() {
  const { data } = useFetch<{ integrations: Row[] }>('/api/org')
  const messaging = (data?.integrations ?? []).filter((i) => i.category === 'Messaging')
  return (
    <Card>
      <CardHeader title="Channels" subtitle="Support inbox sources" />
      <div className="space-y-1.5 p-4 text-[12.5px]">
        {messaging.map((integration) => (
          <div key={integration.id} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5"><MessageSquare size={12} className="text-muted" /> {integration.label}</span>
            <StatusBadge value={integration.status} />
          </div>
        ))}
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted"><Users size={12} /> Tickets and email are active in this build.</div>
      </div>
    </Card>
  )
}

export function TicketForm({ onCreated }: { onCreated?: () => void }) {
  const { meta } = useApp()
  const [subject, setSubject] = useState('')
  const [contactId, setContactId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSubject('')
  }, [])

  return (
    <div className="space-y-3">
      <FormRow label="Subject">
        <input className="gx-input" value={subject} onChange={(event) => setSubject(event.target.value)} />
      </FormRow>
      <FormRow label="Requester">
        <select className="gx-select" value={contactId} onChange={(event) => setContactId(event.target.value)}>
          <option value="">Select contact…</option>
          {meta?.contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</option>
          ))}
        </select>
      </FormRow>
      <Button
        size="sm"
        variant="primary"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await post('/api/resources/tickets', { subject, contact_id: contactId })
            onCreated?.()
          } finally {
            setBusy(false)
          }
        }}
      >
        Create ticket
      </Button>
    </div>
  )
}
