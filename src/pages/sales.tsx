import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSignature,
  Handshake,
  MoreHorizontal,
  Package,
  Plus,
  Receipt,
  Target,
  TrendingUp,
} from 'lucide-react'
import { patch, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDate, formatDateTime, money, number, titleCase } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  FormRow,
  IconButton,
  Kpi,
  MenuItem,
  PageHeader,
  Skeleton,
  Spinner,
  StatusBadge,
  TableSkeleton,
  Tabs,
  cx,
} from '../components/ui'
import { BarChart, Donut, Funnel, LineChart } from '../components/charts'
import { RecordDetailPage, RecordFormDrawer, ResourcePage } from '../components/resource'

/* --------------------------------------------------------------- dashboard */
export function SalesDashboardPage() {
  const { me } = useApp()
  const { data, loading, error, reload } = useFetch<any>('/api/dashboards/sales')
  const currency = me?.currency ?? 'USD'

  if (loading) return <div className="space-y-4 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (error || !data) return <ErrorState message={error?.message ?? 'Sales dashboard unavailable'} onRetry={reload} />

  const totals = data.totals
  return (
    <div className="space-y-4 p-5">
      <PageHeader title="Sales dashboard" subtitle="Pipeline, activity and commercial documents — all derived from live records" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open pipeline" value={money(totals.open_value, currency, true)} hint={`${totals.open_deals} deals`} icon={<Target size={15} />} />
        <Kpi label="Weighted forecast" value={money(totals.weighted_value, currency, true)} hint="Value × probability" icon={<TrendingUp size={15} />} tone="info" />
        <Kpi label="Won" value={money(totals.won_value, currency, true)} hint={`${totals.won_count} closed won`} icon={<Handshake size={15} />} tone="good" />
        <Kpi label="Overdue tasks" value={totals.overdue_tasks} hint={`${totals.open_tasks} open`} icon={<Check size={15} />} tone={Number(totals.overdue_tasks) ? 'danger' : 'good'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Pipeline by stage" subtitle="Open deals only" action={<Link to="/sales/deals" className="text-[12px] text-accent hover:underline">Open board</Link>} />
          <div className="space-y-3 p-4">
            {data.byStage.map((stage: Row) => (
              <div key={stage.id}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-muted">{stage.name}</span>
                  <span className="font-medium">
                    {money(stage.value, currency, true)} <span className="text-faint">· {stage.deal_count}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (Number(stage.value) / Math.max(1, Number(totals.open_value))) * 100)}%`,
                      background: stage.name === 'Closed Won' ? 'var(--color-good)' : 'var(--color-accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Owner performance" subtitle="Open pipeline by rep" />
          <div className="p-4">
            <Donut
              data={data.byOwner.filter((row: Row) => Number(row.value) > 0).map((row: Row) => ({ label: row.name, value: Number(row.value) }))}
              centerLabel="open value"
              centerValue={money(totals.open_value, currency, true)}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Deals created" subtitle="Last six months" />
          <div className="p-4">
            <BarChart data={data.trend.map((row: Row) => ({ label: String(row.month).slice(5), value: Number(row.deals) }))} height={130} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Calls" subtitle={`${totals.calls} logged · ${Math.round(Number(totals.call_seconds) / 60)} minutes`} />
          <div className="space-y-2 p-4">
            {data.calls.length === 0 ? (
              <p className="text-[12px] text-muted">No calls logged yet.</p>
            ) : (
              data.calls.map((row: Row) => (
                <div key={row.direction} className="flex items-center justify-between text-[12.5px]">
                  <span className="capitalize text-muted">{row.direction}</span>
                  <span>
                    {row.calls} calls · {Math.round(Number(row.seconds) / 60)} min
                  </span>
                </div>
              ))
            )}
            <div className="mt-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-[11px] text-muted">
              Dial pad calls require a telephony provider. Manual call logs are recorded above.
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Commercial documents" subtitle="Quotes, proposals and invoices" />
          <div className="space-y-2 p-4">
            {data.docs.map((row: Row) => (
              <div key={`${row.doc_type}-${row.status}`} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-1.5 text-muted">
                  {row.doc_type === 'invoice' ? <Receipt size={12} /> : row.doc_type === 'quote' ? <FileSignature size={12} /> : <FileSignature size={12} />}
                  <span className="capitalize">{row.doc_type}</span>
                  <StatusBadge value={row.status} />
                </span>
                <span>
                  {row.count} · {money(row.total, currency, true)}
                </span>
              </div>
            ))}
            <div className="mt-2 text-[11.5px] text-muted">Paid invoices: {totals.paid_invoices} · {money(totals.paid_value, currency, true)}</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Closing in the next 21 days" subtitle="Expected close dates from open deals" />
          {data.closesSoon.length === 0 ? (
            <EmptyState title="No deals closing soon" description="Deals with an expected close date in the next three weeks appear here." />
          ) : (
            <table className="gx-table">
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Company</th>
                  <th>Value</th>
                  <th>Close</th>
                </tr>
              </thead>
              <tbody>
                {data.closesSoon.map((deal: Row) => (
                  <tr key={deal.id}>
                    <td>
                      <Link to={`/sales/deals/${deal.id}`} className="font-medium hover:text-accent">
                        {deal.name}
                      </Link>
                    </td>
                    <td>{deal.company ?? '—'}</td>
                    <td>{money(deal.value, currency, true)}</td>
                    <td>{formatDate(deal.expected_close, 'day')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <CardHeader title="Products" subtitle="Catalogue used by documents" action={<Link to="/sales/products" className="text-[12px] text-accent hover:underline">Manage</Link>} />
          <div className="p-4">
            <ul className="divide-y divide-line">
              {data.products.map((product: Row) => (
                <li key={product.id} className="flex items-center justify-between py-2 text-[12.5px]">
                  <span className="flex items-center gap-2">
                    <Package size={13} className="text-muted" />
                    {product.name}
                  </span>
                  <span className="font-medium">{money(product.unit_price, product.currency, true)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- deals */
export function DealsPage() {
  const { meta, toast, refreshMeta } = useApp()
  const navigate = useNavigate()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>('/api/resources/deals?limit=100&sort=value&dir=desc')

  const stages = meta?.stages ?? []
  const openDeals = (data?.data ?? []).filter((deal) => deal.status !== 'lost')

  const move = async (deal: Row, stageId: string) => {
    if (deal.stage_id === stageId) return
    try {
      await post(`/api/deals/${deal.id}/stage`, { stage_id: stageId })
      reload()
      refreshMeta()
    } catch (err: any) {
      toast(err?.message ?? 'Could not move the deal.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Deals" subtitle={`${data?.total ?? 0} deals · ${money(openDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0), meta?.currentUser.currency)} open`}>
        <div className="flex overflow-hidden rounded-lg border border-line">
          {(['board', 'list'] as const).map((option) => (
            <button key={option} className={cx('px-2.5 py-1 text-[12px] capitalize', view === option ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2')} onClick={() => setView(option)}>
              {option}
            </button>
          ))}
        </div>
        <IconButton label="Refresh" onClick={reload}>
          <Download size={15} className="rotate-180" />
        </IconButton>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={14} /> New deal
        </Button>
      </PageHeader>

      {view === 'list' ? (
        <div className="min-h-0 flex-1">
          <ResourcePage entity="deals" title="Deal list" hideCreate />
        </div>
      ) : loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto gx-scroll p-4">
          <div className="flex min-h-[320px] gap-3">
            {stages.map((stage) => {
              const deals = openDeals.filter((deal) => deal.stage_id === stage.id)
              const value = deals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0)
              return (
                <div
                  key={stage.id}
                  className="flex min-w-[170px] flex-1 basis-0 flex-col rounded-xl border border-line bg-surface-2/60"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const id = event.dataTransfer.getData('text/plain')
                    const deal = openDeals.find((d) => d.id === id)
                    if (deal) void move(deal, stage.id)
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <div className="text-[12px] font-semibold">{stage.name}</div>
                      <div className="text-[10.5px] text-muted">
                        {deals.length} · {money(value, meta?.currentUser.currency, true)}
                      </div>
                    </div>
                    <Badge>{stage.probability}%</Badge>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto gx-scroll px-2 pb-2">
                    {deals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData('text/plain', deal.id)}
                        className="cursor-grab rounded-lg border border-line bg-surface p-2.5 shadow-[var(--shadow-card)] active:cursor-grabbing"
                        onClick={() => navigate(`/sales/deals/${deal.id}`)}
                      >
                        <div className="line-clamp-2 text-[12px] font-medium">{deal.name}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[11.5px] font-semibold">{money(deal.value, deal.currency, true)}</span>
                          <span className="text-[10.5px] text-muted">{formatDate(deal.expected_close, 'day')}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10.5px] text-muted">
                          <span className="truncate">{meta?.companies.find((c) => c.id === deal.company_id)?.name ?? '—'}</span>
                          <span>{meta?.users.find((u) => u.id === deal.owner_id)?.name?.split(' ')[0]}</span>
                        </div>
                      </div>
                    ))}
                    {deals.length === 0 ? <p className="px-1 py-4 text-center text-[11px] text-faint">Drop deals here</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted">Drag a card between columns to change its stage. Each move writes an activity, a notification for the owner and an audit entry.</p>
        </div>
      )}

      <RecordFormDrawer
        entity="deals"
        open={formOpen}
        record={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          reload()
          refreshMeta()
        }}
      />
    </div>
  )
}

export function DealDetailPage({ id }: { id: string }) {
  const { meta, toast } = useApp()

  return (
    <RecordDetailPage
      id={id}
      backTo="/sales/deals"
      backLabel="Deals"
      config={{
        entity: 'deals',
        title: (record) => String(record.name ?? 'Deal'),
        subtitle: (record) => [meta?.companies.find((c) => c.id === record.company_id)?.name, meta?.contacts.find((c) => c.id === record.contact_id)?.first_name].filter(Boolean).join(' · '),
        summary: ['value', 'stage_id', 'probability', 'expected_close', 'owner_id', 'status', 'source'],
        avatar: () => (
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Handshake size={19} />
          </span>
        ),
        related: [
          { entity: 'documents', foreignKey: 'deal_id', label: 'Documents' },
          { entity: 'tasks', foreignKey: 'related_id', label: 'Tasks' },
        ],
      }}
      actions={(record, reload) => (
        <>
          <select
            className="gx-select w-auto"
            value={String(record.stage_id ?? '')}
            onChange={async (event) => {
              try {
                await post(`/api/deals/${record.id}/stage`, { stage_id: event.target.value })
                toast('Stage updated.', 'good')
                reload()
              } catch (error: any) {
                toast(error?.message ?? 'Could not change the stage.', 'bad')
              }
            }}
          >
            {meta?.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await patch(`/api/resources/deals/${record.id}`, { status: 'won' })
                toast('Deal marked won.', 'good')
                reload()
              } catch (error: any) {
                toast(error?.message ?? 'Could not update the deal.', 'bad')
              }
            }}
          >
            Mark won
          </Button>
        </>
      )}
      tabs={[
        {
          key: 'quote',
          label: 'Commercial',
          render: (record) => (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Link to="/sales/quotes" className="gx-btn gx-btn-sm">
                  <FileSignature size={13} /> New quote
                </Link>
                <Link to="/sales/invoices" className="gx-btn gx-btn-sm">
                  <Receipt size={13} /> New invoice
                </Link>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-3 text-[12.5px] text-muted">
                Create a quote from this deal and convert an accepted quote into an invoice. Line items snapshot the product price at creation time.
              </div>
              <div className="text-[12.5px]">
                Value <strong>{money(record.value, record.currency)}</strong> · probability {record.probability}% · forecast{' '}
                <strong>{money((Number(record.value) * Number(record.probability)) / 100, record.currency)}</strong>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}

/* ------------------------------------------------------------------- tasks */
export function TasksPage() {
  const { meta, toast } = useApp()
  const [filter, setFilter] = useState<'mine' | 'all' | 'overdue' | 'done'>('mine')
  const [assignee, setAssignee] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/tasks?limit=100&sort=due_date&dir=asc')

  const tasks = (data?.data ?? []).filter((task) => {
    if (filter === 'mine') return task.assignee_id === meta?.currentUser.id && task.status !== 'completed' && task.status !== 'cancelled'
    if (filter === 'overdue') return task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date(new Date().toDateString())
    if (filter === 'done') return task.status === 'completed'
    return true
  }).filter((task) => (assignee ? task.assignee_id === assignee : true))

  const groups = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
  ]

  const toggle = async (task: Row) => {
    const next = task.status === 'completed' ? 'open' : 'completed'
    try {
      await patch(`/api/resources/tasks/${task.id}`, { status: next })
      toast(next === 'completed' ? 'Task completed.' : 'Task reopened.', 'good')
      reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not update the task.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Tasks" subtitle={`${tasks.length} shown · ${(data?.data ?? []).filter((t) => t.status !== 'completed').length} open in workspace`}>
        <select className="gx-select w-auto" value={assignee} onChange={(event) => setAssignee(event.target.value)} aria-label="Filter by assignee">
          <option value="">Everyone</option>
          {meta?.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={14} /> New task
        </Button>
      </PageHeader>

      <div className="border-b border-line px-5 py-2">
        <Tabs
          tabs={[
            { key: 'mine', label: 'My open' },
            { key: 'all', label: 'All' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'done', label: 'Completed' },
          ]}
          active={filter}
          onChange={(key) => setFilter(key as typeof filter)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<Check size={18} />}
            title="No tasks in this view"
            description="Tasks you create, receive from a teammate or get from a workflow appear here."
            action={
              <Button size="sm" variant="primary" onClick={() => setFormOpen(true)}>
                Create a task
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => {
              const rows = tasks.filter((task) => task.status === group.key)
              if (!rows.length) return null
              return (
                <div key={group.key}>
                  <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-faint">
                    {group.label} · {rows.length}
                  </h3>
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                      {rows.map((task) => {
                        const overdue = task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date(new Date().toDateString())
                        return (
                          <li key={task.id} className="flex items-start gap-3 px-4 py-2.5">
                            <button
                              className={cx(
                                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                                task.status === 'completed' ? 'border-good bg-good text-white' : 'border-line-strong hover:border-accent',
                              )}
                              onClick={() => void toggle(task)}
                              aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}
                            >
                              {task.status === 'completed' ? <Check size={11} /> : null}
                            </button>
                            <button className="min-w-0 flex-1 text-left" onClick={() => { setEditing(task); setFormOpen(true) }}>
                              <div className={cx('text-[13px] font-medium', task.status === 'completed' && 'text-muted line-through')}>{task.title}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                                <StatusBadge value={task.priority} />
                                <span className="capitalize text-muted">{task.type}</span>
                                <span className={overdue ? 'font-medium text-danger' : 'text-muted'}>{task.due_date ? formatDate(task.due_date, 'day') : 'No due date'}</span>
                                <span className="text-muted">· {meta?.users.find((u) => u.id === task.assignee_id)?.name ?? 'Unassigned'}</span>
                              </div>
                            </button>
                            <Dropdown
                              trigger={({ toggle: openMenu }) => (
                                <IconButton label="Task actions" onClick={openMenu}>
                                  <MoreHorizontal size={15} />
                                </IconButton>
                              )}
                            >
                              {(close) => (
                                <>
                                  <MenuItem onClick={() => { close(); setEditing(task); setFormOpen(true) }}>
                                    Edit task
                                  </MenuItem>
                                  {task.related_type === 'deal' && task.related_id ? (
                                    <MenuItem onClick={() => { close(); window.location.assign(`/sales/deals/${task.related_id}`) }}>Open related deal</MenuItem>
                                  ) : null}
                                </>
                              )}
                            </Dropdown>
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <RecordFormDrawer
        entity="tasks"
        open={formOpen}
        record={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          reload()
        }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- calendar */
export function CalendarPage() {
  const { meta } = useApp()
  const [cursor, setCursor] = useState(() => new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [preset, setPreset] = useState<Row | undefined>()
  const { data, loading, reload } = useFetch<{ data: Row[] }>('/api/resources/events?limit=200&sort=start_at&dir=asc')

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const events = data?.data ?? []

  const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const today = isoDay(new Date())

  const openCreate = (day: Date) => {
    const start = new Date(day)
    start.setHours(10, 0, 0, 0)
    const end = new Date(start.getTime() + 30 * 60_000)
    setPreset({ start_at: start.toISOString(), end_at: end.toISOString(), timezone: meta?.currentUser.timezone ?? 'UTC', status: 'scheduled', title: '' })
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Calendar" subtitle={`Meetings, calls and follow-ups · ${meta?.currentUser.timezone ?? 'UTC'}`}>
        <Button size="sm" onClick={() => setCursor(new Date())}>
          Today
        </Button>
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={16} />
          </IconButton>
          <span className="min-w-[130px] text-center text-[13px] font-medium">
            {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <IconButton label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setPreset(undefined)
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={14} /> New event
        </Button>
      </PageHeader>

      {loading ? (
        <Spinner label="Loading calendar" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-[10.5px] font-semibold uppercase tracking-wide text-faint">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="px-2 py-1.5">
                {day}
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto gx-scroll">
            <div className="grid grid-cols-7 auto-rows-[minmax(96px,1fr)]">
              {Array.from({ length: cells }).map((_, index) => {
                const dayNumber = index - startOffset + 1
                const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth
                const date = new Date(year, month, dayNumber)
                const key = isoDay(date)
                const dayEvents = events.filter((event) => isoDay(new Date(event.start_at)) === key)
                return (
                  <div
                    key={index}
                    className={cx('min-h-[96px] border-b border-r border-line p-1.5', !inMonth && 'bg-surface-2/40', key === today && 'bg-accent-soft/40')}
                    onDoubleClick={() => inMonth && openCreate(date)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={cx('text-[11.5px]', key === today ? 'font-bold text-accent' : 'text-muted')}>{inMonth ? dayNumber : ''}</span>
                      {inMonth ? (
                        <button className="text-[10px] text-faint hover:text-accent" onClick={() => openCreate(date)} aria-label="Add event">
                          +
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          className="w-full truncate rounded bg-accent-soft px-1.5 py-0.5 text-left text-[10.5px] text-accent hover:bg-accent hover:text-white"
                          onClick={() => {
                            setEditing(event)
                            setPreset(undefined)
                            setFormOpen(true)
                          }}
                          title={`${event.title} · ${formatDateTime(event.start_at)}`}
                        >
                          {new Date(event.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {event.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 ? <div className="text-[10px] text-faint">+{dayEvents.length - 3} more</div> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="border-t border-line px-5 py-2 text-[11px] text-muted">
            Double-click a day to create an event. Events are stored with a timezone and rendered in {meta?.currentUser.timezone ?? 'UTC'}.
          </div>
        </div>
      )}

      <RecordFormDrawer
        entity="events"
        open={formOpen}
        record={editing}
        preset={preset}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          reload()
        }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- products */
export function ProductsPage() {
  return <ResourcePage entity="products" title="Products" subtitle="Catalogue for quotes, proposals and invoices" />
}

/* --------------------------------------------------------------- documents */
export function DocumentsPage({ docType }: { docType: 'quote' | 'invoice' | 'proposal' }) {
  const { meta, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>(`/api/resources/documents?doc_type=${docType}&limit=100&sort=created_at&dir=desc`)
  const currency = meta?.currentUser.currency ?? 'USD'
  const label = docType === 'invoice' ? 'Invoices' : docType === 'quote' ? 'Quotes' : 'Proposals'
  const rows = data?.data ?? []

  const changeStatus = async (record: Row, status: string) => {
    try {
      await patch(`/api/resources/documents/${record.id}`, { status })
      toast(`Marked ${status}.`, 'good')
      reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not update the document.', 'bad')
    }
  }

  const convert = async (record: Row) => {
    try {
      const lines = JSON.parse(record.lines ?? '[]')
      const result = await post<{ record: Row }>('/api/resources/documents', {
        doc_type: 'invoice',
        title: `Invoice from ${record.number}`,
        contact_id: record.contact_id,
        company_id: record.company_id,
        deal_id: record.deal_id,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        currency: record.currency,
        discount: record.discount,
        tax_rate: record.tax_rate,
        lines,
        status: 'draft',
        notes: record.notes,
        terms: record.terms,
      })
      toast(`Invoice ${result.record.number} created.`, 'good')
      reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not convert the document.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={label} subtitle={`${data?.total ?? 0} ${label.toLowerCase()} · totals calculated server-side`}>
        <Button size="sm" variant="primary" onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus size={14} /> New {docType}
        </Button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileSignature size={18} />}
            title={`No ${label.toLowerCase()} yet`}
            description="Create one from scratch or from a deal, then reuse the same line items when you convert a quote into an invoice."
            action={
              <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                New {docType}
              </Button>
            }
          />
        ) : (
          <table className="gx-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Customer</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Total</th>
                <th>Status</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-[11.5px] font-medium">{row.number}</td>
                  <td>
                    <div className="text-[12.5px]">{meta?.contacts.find((c) => c.id === row.contact_id)?.first_name ?? '—'}</div>
                    <div className="text-[10.5px] text-muted">{meta?.companies.find((c) => c.id === row.company_id)?.name ?? ''}</div>
                  </td>
                  <td>{formatDate(row.issue_date, 'day')}</td>
                  <td>{formatDate(row.due_date, 'day')}</td>
                  <td className="font-medium">{money(row.total, row.currency ?? currency)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge value={row.status} />
                      {Number(row.locked) === 1 ? <span title="Locked after acceptance">🔒</span> : null}
                    </div>
                  </td>
                  <td>
                    <Dropdown
                      trigger={({ toggle }) => (
                        <IconButton label="Document actions" onClick={toggle}>
                          <MoreHorizontal size={15} />
                        </IconButton>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem onClick={() => { close(); setEditing(row); setOpen(true) }}>
                            Edit document
                          </MenuItem>
                          {row.status === 'draft' ? <MenuItem onClick={() => { close(); void changeStatus(row, 'sent') }}>Mark as sent</MenuItem> : null}
                          {row.status === 'sent' && docType !== 'invoice' ? (
                            <MenuItem onClick={() => { close(); void changeStatus(row, 'accepted') }}>Mark accepted</MenuItem>
                          ) : null}
                          {docType !== 'invoice' ? (
                            <MenuItem onClick={() => { close(); void convert(row) }}>
                              Convert to invoice
                            </MenuItem>
                          ) : null}
                          {docType === 'invoice' && row.status !== 'paid' ? (
                            <MenuItem onClick={() => { close(); void changeStatus(row, 'paid') }}>Record manual payment</MenuItem>
                          ) : null}
                        </>
                      )}
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DocumentEditor
        open={open}
        record={editing}
        docType={docType}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          reload()
        }}
      />
    </div>
  )
}

function DocumentEditor({
  open,
  record,
  docType,
  onClose,
  onSaved,
}: {
  open: boolean
  record: Row | null
  docType: 'quote' | 'invoice' | 'proposal'
  onClose: () => void
  onSaved: () => void
}) {
  const { meta, toast } = useApp()
  const [form, setForm] = useState<Row>({})
  const [lines, setLines] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      record ?? {
        doc_type: docType,
        contact_id: '',
        company_id: '',
        deal_id: '',
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        currency: meta?.currentUser.currency ?? 'USD',
        discount: 0,
        tax_rate: 0,
        status: 'draft',
        notes: '',
        title: '',
      },
    )
    setLines(record ? JSON.parse(record.lines ?? '[]') : [])
    setDirty(false)
  }, [open, record, docType, meta])

  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0) * Number(line.unit_price ?? 0), 0)
  const taxed = subtotal - (subtotal * Number(form.discount ?? 0)) / 100
  const total = taxed + (taxed * Number(form.tax_rate ?? 0)) / 100
  const locked = Number(record?.locked) === 1

  const set = (key: string, value: unknown) => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload: Row = { ...form, lines }
      delete payload.id
      delete payload.org_id
      delete payload.created_at
      delete payload.updated_at
      if (record) await patch(`/api/resources/documents/${record.id}`, payload)
      else await post('/api/resources/documents', payload)
      toast(`${titleCase(docType)} saved.`, 'good')
      setDirty(false)
      onSaved()
    } catch (error: any) {
      toast(error?.message ?? 'Could not save the document.', 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={record ? `${record.number}` : `New ${docType}`}
      subtitle="Totals are recomputed on the server from the line items"
      wide
      dirty={dirty}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()} loading={saving} disabled={locked}>
            Save {docType}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {locked ? (
          <div className="rounded-lg border border-transparent bg-warn-soft px-3 py-2 text-[12px] text-warn">
            This document is locked because it has been accepted or paid. Duplicate it to make changes.
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormRow label="Title" className="sm:col-span-2">
            <input className="gx-input" value={String(form.title ?? '')} onChange={(event) => set('title', event.target.value)} />
          </FormRow>
          <FormRow label="Customer">
            <select className="gx-select" value={String(form.contact_id ?? '')} onChange={(event) => set('contact_id', event.target.value)}>
              <option value="">Select contact…</option>
              {(meta?.contacts ?? []).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Company">
            <select className="gx-select" value={String(form.company_id ?? '')} onChange={(event) => set('company_id', event.target.value)}>
              <option value="">Select company…</option>
              {(meta?.companies ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Deal">
            <select className="gx-select" value={String(form.deal_id ?? '')} onChange={(event) => set('deal_id', event.target.value)}>
              <option value="">None</option>
              {(meta?.deals ?? []).map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Currency">
            <select className="gx-select" value={String(form.currency ?? 'USD')} onChange={(event) => set('currency', event.target.value)}>
              {['USD', 'EUR', 'GBP', 'INR', 'AED'].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Issue date">
            <input className="gx-input" type="date" value={String(form.issue_date ?? '')} onChange={(event) => set('issue_date', event.target.value)} />
          </FormRow>
          <FormRow label="Due date">
            <input className="gx-input" type="date" value={String(form.due_date ?? '')} onChange={(event) => set('due_date', event.target.value)} />
          </FormRow>
          <FormRow label="Discount %">
            <input className="gx-input" type="number" value={String(form.discount ?? 0)} onChange={(event) => set('discount', Number(event.target.value))} />
          </FormRow>
          <FormRow label="Tax %">
            <input className="gx-input" type="number" value={String(form.tax_rate ?? 0)} onChange={(event) => set('tax_rate', Number(event.target.value))} />
          </FormRow>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold">Line items</span>
            <Button
              size="sm"
              onClick={() =>
                setLines((current) => [...current, { description: '', quantity: 1, unit_price: 0, product_id: '' }])
              }
              disabled={locked}
            >
              <Plus size={13} /> Add line
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-1.5">
                <select
                  className="gx-select col-span-5"
                  value={String(line.product_id ?? '')}
                  onChange={(event) => {
                    const product = meta?.products.find((p) => p.id === event.target.value)
                    setLines((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, product_id: event.target.value, description: product?.name ?? item.description, unit_price: product?.unit_price ?? item.unit_price }
                          : item,
                      ),
                    )
                    setDirty(true)
                  }}
                >
                  <option value="">Custom line…</option>
                  {(meta?.products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <input
                  className="gx-input col-span-3"
                  placeholder="Description"
                  value={String(line.description ?? '')}
                  onChange={(event) => {
                    setLines((current) => current.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)))
                    setDirty(true)
                  }}
                />
                <input
                  className="gx-input col-span-1"
                  type="number"
                  min={1}
                  value={Number(line.quantity ?? 1)}
                  onChange={(event) => {
                    setLines((current) => current.map((item, i) => (i === index ? { ...item, quantity: Number(event.target.value) } : item)))
                    setDirty(true)
                  }}
                  aria-label="Quantity"
                />
                <input
                  className="gx-input col-span-2"
                  type="number"
                  step="0.01"
                  value={Number(line.unit_price ?? 0)}
                  onChange={(event) => {
                    setLines((current) => current.map((item, i) => (i === index ? { ...item, unit_price: Number(event.target.value) } : item)))
                    setDirty(true)
                  }}
                  aria-label="Unit price"
                />
                <button
                  className="col-span-1 text-[15px] text-muted hover:text-danger"
                  onClick={() => {
                    setLines((current) => current.filter((_, i) => i !== index))
                    setDirty(true)
                  }}
                  aria-label="Remove line"
                  disabled={locked}
                >
                  ×
                </button>
              </div>
            ))}
            {lines.length === 0 ? <p className="text-[12px] text-muted">Add at least one line item.</p> : null}
          </div>
          <div className="mt-3 space-y-1 rounded-lg border border-line bg-surface-2 p-3 text-[12.5px]">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(subtotal, form.currency)}</span></div>
            <div className="flex justify-between text-muted"><span>Discount</span><span>−{money(subtotal - taxed, form.currency)}</span></div>
            <div className="flex justify-between text-muted"><span>Tax</span><span>{money(total - taxed, form.currency)}</span></div>
            <div className="flex justify-between border-t border-line pt-1 font-semibold"><span>Total</span><span>{money(total, form.currency)}</span></div>
          </div>
        </div>

        <FormRow label="Notes">
          <textarea className="gx-textarea" value={String(form.notes ?? '')} onChange={(event) => set('notes', event.target.value)} />
        </FormRow>
      </div>
    </Drawer>
  )
}

/* ------------------------------------------------------------------- calls */
export function CallsPanel() {
  const { data, loading } = useFetch<{ data: Row[] }>('/api/resources/calls?limit=20')
  if (loading) return <Spinner />
  return (
    <Card>
      <CardHeader title="Recent calls" subtitle="Manual logs and provider callbacks" />
      <table className="gx-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Direction</th>
            <th>When</th>
            <th>Duration</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {(data?.data ?? []).map((call) => (
            <tr key={call.id}>
              <td className="font-mono text-[11.5px]">{call.number}</td>
              <td className="capitalize">{call.direction}</td>
              <td>{formatDate(call.started_at, 'day')}</td>
              <td>{Math.round(Number(call.duration) / 60)}m</td>
              <td>{call.outcome ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export function UnusedCalendarHeader() {
  return (
    <Fragment>
      <CalendarIcon size={14} />
      <span>{number(0)}</span>
    </Fragment>
  )
}

export function DealStageLegend() {
  const { meta } = useApp()
  const stages = useMemo(() => meta?.stages ?? [], [meta])
  return (
    <div className="flex gap-2">
      {stages.map((stage) => (
        <Badge key={stage.id}>{stage.name}</Badge>
      ))}
    </div>
  )
}

export function useEmptyState() {
  return <ArrowLeft size={14} />
}

export { ConfirmDialog, LineChart, Funnel }
