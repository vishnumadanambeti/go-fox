import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, CircleDashed, LayoutGrid, Mail, Megaphone, Plus, Sparkles, Target, Ticket, Users, Workflow } from 'lucide-react'
import { useApp, useFetch } from '../lib/app-context'
import { Link } from '../lib/router'
import { formatDate, dueLabel, money, timeAgo } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, EmptyState, ErrorState, Kpi, Skeleton, StatusBadge, Button } from '../components/ui'
import { BarChart, Donut, Funnel, LineChart } from '../components/charts'
import { CheckCircle2 as GoodIcon, Plug, TriangleAlert, Video } from 'lucide-react'
import { titleCase } from '../lib/format'
import { ActivityFeed } from '../components/resource'
import { cx } from '../components/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { RecordFormDrawer } from '../components/resource'
import type { Row } from '../lib/api'

type HomeData = {
  tasks: Row[]
  counts: Row
  pipeline: Row[]
  activity: Row[]
  gettingStarted: Row
  weeklyActivity: number
  activityByDay: { day: string; value: number }[]
  charts: {
    funnel: { label: string; value: number }[]
    wonLost: { won_count: number; won_value: number; lost_count: number; lost_value: number; won_value_30: number }
    leadSources: { label: string; value: number }[]
    revenueTrend: { label: string; value: number }[]
  }
  meetings: Row[]
  comms: Row[]
  integrations: Row[]
  teamPerformance: Row[]
}

type WidgetId =
  | 'kpis'
  | 'revenue'
  | 'funnel'
  | 'sources'
  | 'tasks'
  | 'pipeline'
  | 'meetings'
  | 'activity'
  | 'team'
  | 'health'
  | 'gettingStarted'
  | 'week'
  | 'shortcuts'

const WIDGETS: { id: WidgetId; label: string }[] = [
  { id: 'kpis', label: 'Headline metrics' },
  { id: 'revenue', label: 'Revenue performance' },
  { id: 'funnel', label: 'Lead conversion funnel' },
  { id: 'sources', label: 'Lead sources' },
  { id: 'tasks', label: 'My tasks' },
  { id: 'meetings', label: 'Upcoming meetings' },
  { id: 'team', label: 'Team performance' },
  { id: 'health', label: 'Integration health' },
  { id: 'pipeline', label: 'My pipeline' },
  { id: 'activity', label: 'Team activity' },
  { id: 'gettingStarted', label: 'Getting started' },
  { id: 'week', label: 'Activity trend' },
  { id: 'shortcuts', label: 'Shortcuts' },
]

const DEFAULT_LAYOUT: WidgetId[] = WIDGETS.map((widget) => widget.id)

/** Layout is stored per user on this browser, so a teammate's dashboard is never affected. */
function layoutKey(userId?: string) {
  return `gofox:dashboard:${userId ?? 'anon'}`
}

function readLayout(userId?: string): WidgetId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(layoutKey(userId)) ?? 'null') as { order?: string[]; hidden?: string[] } | null
    if (!raw) return DEFAULT_LAYOUT
    const order = (raw.order ?? []).filter((id): id is WidgetId => DEFAULT_LAYOUT.includes(id as WidgetId))
    const missing = DEFAULT_LAYOUT.filter((id) => !order.includes(id))
    const hidden = new Set(raw.hidden ?? [])
    return [...order, ...missing].filter((id) => !hidden.has(id))
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function HomePage() {
  const { me, meta } = useApp()
  const [days, setDays] = useState(7)
  const { data, loading, error, reload } = useFetch<HomeData>(`/api/dashboards/home?days=${days}`)
  const [quickTask, setQuickTask] = useState(false)
  const [customising, setCustomising] = useState(false)
  const [layout, setLayout] = useState<WidgetId[]>(() => readLayout(me?.id))

  useEffect(() => {
    setLayout(readLayout(me?.id))
  }, [me?.id])

  const saveLayout = (next: WidgetId[]) => {
    setLayout(next)
    const hidden = DEFAULT_LAYOUT.filter((id) => !next.includes(id))
    try {
      localStorage.setItem(layoutKey(me?.id), JSON.stringify({ order: next, hidden }))
    } catch {
      /* storage may be blocked; the layout still applies for this session */
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const currency = me?.currency ?? 'USD'

  const setupSteps = useMemo(() => {
    if (!data) return []
    return [
      { key: 'companies', label: 'Add your first company', done: Number(data.gettingStarted.companies) > 0, to: '/companies' },
      { key: 'contacts', label: 'Add a contact', done: Number(data.gettingStarted.contacts) > 0, to: '/contacts' },
      { key: 'forms', label: 'Publish a capture form', done: Number(data.gettingStarted.published_forms) > 0, to: '/marketing/forms' },
      { key: 'campaigns', label: 'Send a campaign', done: Number(data.gettingStarted.sent_campaigns) > 0, to: '/marketing/campaigns' },
      { key: 'workflows', label: 'Put a workflow live', done: Number(data.gettingStarted.live_workflows) > 0, to: '/marketing/workflows' },
      { key: 'apps', label: 'Connect an app', done: Number(data.gettingStarted.connected_apps) > 0, to: '/settings/apps' },
    ]
  }, [data])

  if (loading) {
    return (
      <div className="p-5">
        <Skeleton className="mb-4 h-7 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px]" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    )
  }
  if (error || !data) return <ErrorState message={error?.message ?? 'Dashboard unavailable'} onRetry={reload} />

  const doneCount = setupSteps.filter((step) => step.done).length

  const widgets: Record<WidgetId, { span: string; node: ReactNode }> = {
    kpis: {
      span: 'lg:col-span-2 xl:col-span-3',
      node: (
        <div className="grid gap-3 sm:grid-cols-2 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Kpi label="Open pipeline" value={money(data.counts.pipeline_value, currency, true)} hint={`${data.counts.open_deals} open deals`} icon={<Target size={15} />} tone="accent" />
          <Kpi label="Contacts" value={data.counts.contacts} hint={`${data.counts.companies} companies`} icon={<Users size={15} />} tone="teal" />
          <Kpi label="New leads" value={data.counts.new_leads} hint={`${data.counts.leads} total leads`} icon={<Sparkles size={15} />} tone="purple" />
          <Kpi
            label="Overdue tasks"
            value={data.counts.overdue_tasks}
            hint={`${data.counts.my_open_tasks} open for you`}
            icon={<Ticket size={15} />}
            tone={Number(data.counts.overdue_tasks) > 0 ? 'danger' : 'good'}
          />
          <Kpi label="Won · 30 days" value={money(data.charts.wonLost.won_value_30, currency, true)} hint={`${data.counts.open_tickets} open tickets`} icon={<GoodIcon size={15} />} tone="good" />
          <Kpi label="Integrations" value={`${data.integrations.filter((row) => row.status === 'connected').length}/${data.integrations.length}`} hint="Apps connected" icon={<Plug size={15} />} tone="info" />
        </div>
      ),
    },
    tasks: {
      span: 'lg:col-span-2',
      node: (
        <Card>
          <CardHeader
            title="My tasks"
            subtitle={`${data.counts.my_open_tasks} open · ${data.weeklyActivity} activities this week`}
            action={
              <Link to="/sales/tasks" className="text-[12px] text-accent hover:underline">
                All tasks
              </Link>
            }
          />
          {data.tasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={18} />}
              title="Nothing assigned to you"
              description="Tasks created here, by a teammate or by an automation show up in this list."
              action={
                <Button size="sm" variant="primary" onClick={() => setQuickTask(true)}>
                  <Plus size={14} /> New task
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.tasks.map((task) => {
                const due = dueLabel(task.due_date)
                return (
                  <li key={task.id} className="flex items-start gap-3 px-4 py-2.5">
                    <CircleDashed size={16} className="mt-0.5 shrink-0 text-faint" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{task.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11.5px]">
                        <StatusBadge value={task.priority} />
                        <span className={due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-warn' : 'text-muted'}>{due.text}</span>
                      </div>
                    </div>
                    <Link to="/sales/tasks" className="text-[11.5px] text-muted hover:text-accent">
                      Open
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ),
    },
    pipeline: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader
            title="My pipeline"
            subtitle="Open deals by stage"
            action={
              <Link to="/sales/deals" className="text-[12px] text-accent hover:underline">
                Board
              </Link>
            }
          />
          <div className="space-y-2.5 p-4">
            {data.pipeline.filter((stage) => stage.name !== 'Closed Lost').map((stage) => {
              const max = Math.max(1, ...data.pipeline.map((s) => Number(s.value)))
              return (
                <div key={stage.id}>
                  <div className="mb-1 flex items-center justify-between text-[11.5px]">
                    <span className="text-muted">{stage.name}</span>
                    <span className="font-medium">
                      {money(stage.value, currency, true)} <span className="text-faint">· {stage.deal_count}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (Number(stage.value) / max) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ),
    },
    activity: {
      span: 'lg:col-span-2',
      node: (
        <Card>
          <CardHeader title="Team activity" subtitle="Recent CRM events across the workspace" action={<Link to="/marketing/activities" className="text-[12px] text-accent hover:underline">All activity</Link>} />
          <div className="p-4">
            <ActivityFeed items={data.activity} />
          </div>
        </Card>
      ),
    },
    gettingStarted: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader
            title="Getting started"
            subtitle={`${doneCount} of ${setupSteps.length} steps done`}
            action={<Badge tone={doneCount === setupSteps.length ? 'good' : 'accent'}>{Math.round((doneCount / setupSteps.length) * 100)}%</Badge>}
          />
          <ul className="divide-y divide-line">
            {setupSteps.map((step) => (
              <li key={step.key}>
                <Link to={step.to} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2">
                  {step.done ? <CheckCircle2 size={15} className="text-good" /> : <CircleDashed size={15} className="text-faint" />}
                  <span className={`flex-1 text-[12.5px] ${step.done ? 'text-muted line-through' : ''}`}>{step.label}</span>
                  <ArrowRight size={13} className="text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ),
    },
    week: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader
            title="Activity trend"
            subtitle={`Recorded activities · last ${days} days`}
            action={
              <select className="gx-select h-7 w-auto text-[11px]" value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Date range">
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            }
          />
          <div className="p-4">
            <BarChart
              data={data.activityByDay.map((point) => ({
                label: new Date(`${point.day}T00:00:00Z`).toLocaleDateString('en-US', days === 7 ? { weekday: 'narrow' } : { month: 'numeric', day: 'numeric' }),
                value: point.value,
              }))}
              height={90}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Mail size={11} /> Email · campaigns · tickets
              </span>
              <span>{data.weeklyActivity} events this week</span>
            </div>
          </div>
        </Card>
      ),
    },
    revenue: {
      span: 'lg:col-span-2',
      node: (
        <Card>
          <CardHeader
            title="Revenue performance"
            subtitle={`Won value last 6 months · ${money(data.charts.wonLost.won_value_30, currency, true)} won in 30 days`}
            action={
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-good">
                  <GoodIcon size={12} /> {data.charts.wonLost.won_count} won · {money(data.charts.wonLost.won_value, currency, true)}
                </span>
                <span className="flex items-center gap-1 text-danger">
                  <TriangleAlert size={12} /> {Number(data.charts.wonLost.lost_count)} lost
                </span>
              </div>
            }
          />
          <div className="p-4">
            {data.charts.revenueTrend.length === 0 ? (
              <EmptyState
                title="No closed-won deals yet"
                description="Mark a deal as won and its value appears here, straight from the deals table."
                action={
                  <Link to="/sales/deals" className="gx-btn gx-btn-sm">
                    Open pipeline
                  </Link>
                }
              />
            ) : (
              <LineChart
                data={data.charts.revenueTrend.map((point) => ({ label: point.label, value: point.value }))}
                height={150}
                format={(value) => money(value, currency, true)}
              />
            )}
          </div>
        </Card>
      ),
    },
    funnel: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader title="Lead conversion" subtitle="Leads by lifecycle status" action={<Link to="/leads" className="text-[12px] text-accent hover:underline">Leads</Link>} />
          <div className="p-4">
            {data.charts.funnel.length === 0 ? (
              <p className="text-[12px] text-muted">No leads recorded yet.</p>
            ) : (
              <Funnel steps={data.charts.funnel.map((step) => ({ label: titleCase(step.label), value: step.value }))} />
            )}
          </div>
        </Card>
      ),
    },
    sources: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader title="Lead sources" subtitle="Where your leads come from" />
          <div className="p-4">
            {data.charts.leadSources.length === 0 ? (
              <p className="text-[12px] text-muted">No lead sources recorded yet.</p>
            ) : (
              <div className="flex items-center gap-4">
                <Donut data={data.charts.leadSources.map((slice) => ({ label: slice.label, value: slice.value }))} size={120} />
                <ul className="min-w-0 flex-1 space-y-1 text-[11.5px]">
                  {data.charts.leadSources.slice(0, 5).map((slice, index) => (
                    <li key={slice.label} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: ['#FF7417', '#159C91', '#7357D9', '#17243A', '#9AA1AC'][index % 5] }} />
                        <span className="truncate text-muted">{titleCase(slice.label)}</span>
                      </span>
                      <span className="font-medium">{slice.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      ),
    },
    meetings: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader title="Upcoming meetings" subtitle="From the shared calendar" action={<Link to="/sales/calendar" className="text-[12px] text-accent hover:underline">Calendar</Link>} />
          {data.meetings.length === 0 ? (
            <EmptyState icon={<Video size={17} />} title="Nothing scheduled" description="Meetings created on the calendar show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {data.meetings.map((meeting) => (
                <li key={String(meeting.id)} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple/10 text-purple">
                    <Video size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{String(meeting.title)}</span>
                    <span className="block text-[11px] text-muted">{formatDate(meeting.start_at)} · {String(meeting.location ?? 'Online')}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ),
    },
    team: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader title="Team performance" subtitle="Won value by owner" />
          {data.teamPerformance.length === 0 ? (
            <p className="p-4 text-[12px] text-muted">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.teamPerformance.map((member) => (
                <li key={String(member.id)} className="flex items-center gap-2.5 px-4 py-2">
                  <Avatar name={member.name} hue={Number(member.avatar_hue ?? 22)} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{String(member.name)}</span>
                    <span className="block text-[10.5px] text-muted">{Number(member.open_tasks)} open tasks</span>
                  </span>
                  <span className="text-[12px] font-semibold">{money(member.won_value, currency, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ),
    },
    health: {
      span: 'lg:col-span-1',
      node: (
        <Card>
          <CardHeader
            title="Integration health"
            subtitle={`${data.integrations.filter((row) => row.status === 'connected').length} connected · ${data.integrations.filter((row) => row.status === 'error').length} need attention`}
            action={<Link to="/settings/apps" className="text-[12px] text-accent hover:underline">Manage</Link>}
          />
          <ul className="divide-y divide-line">
            {data.integrations.slice(0, 5).map((row) => (
              <li key={String(row.provider)} className="flex items-center gap-2 px-4 py-2">
                <span
                  className={cx(
                    'size-1.5 shrink-0 rounded-full',
                    row.status === 'connected' ? 'bg-good' : row.status === 'error' ? 'bg-danger' : 'bg-line-strong',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">{String(row.label)}</span>
                <Badge tone={row.status === 'connected' ? 'good' : row.status === 'error' ? 'danger' : 'default'}>{titleCase(row.status)}</Badge>
              </li>
            ))}
            {data.integrations.length === 0 ? <li className="px-4 py-3 text-[12px] text-muted">No integrations configured.</li> : null}
          </ul>
        </Card>
      ),
    },
    shortcuts: {
      span: 'lg:col-span-2 xl:col-span-3',
      node: (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { to: '/marketing/campaigns', icon: <Megaphone size={15} />, title: 'Campaigns', text: `${meta?.templates.length ?? 0} templates ready` },
            { to: '/marketing/workflows', icon: <Workflow size={15} />, title: 'Automations', text: `${data.gettingStarted.live_workflows} live workflows` },
            { to: '/support/tickets', icon: <Ticket size={15} />, title: 'Support', text: `${data.counts.open_tickets} tickets open` },
            { to: '/reports', icon: <Target size={15} />, title: 'Reports', text: 'Reconcile with source lists' },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="gx-card flex items-center gap-3 p-3.5 transition hover:border-accent">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium">{item.title}</span>
                <span className="block truncate text-[11px] text-muted">{item.text}</span>
              </span>
            </Link>
          ))}
        </div>
      ),
    },
  }

  const hiddenAll = layout.length === 0

  return (
    <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
      <div className="gx-hero">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="gx-hero-pill">
              <Sparkles size={12} /> {me?.org_name} workspace
            </div>
            <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-white">
              {greeting}, {me?.name.split(' ')[0]}
            </h1>
            <p className="mt-1 text-[12.5px] text-[#a9bcd4]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
              {money(data.counts.pipeline_value, currency, true)} open pipeline · {Number(data.counts.overdue_tasks)} overdue tasks
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="primary" onClick={() => setQuickTask(true)}>
                <Plus size={14} /> New task
              </Button>
              <Link to="/sales/deals" className="gx-hero-pill hover:bg-white/15">
                View pipeline <ArrowRight size={13} />
              </Link>
              <Link to="/contacts" className="gx-hero-pill hover:bg-white/15">
                Add contact
              </Link>
              <button className="gx-hero-pill hover:bg-white/15" onClick={() => setCustomising((value) => !value)}>
                <LayoutGrid size={12} /> Customise
              </button>
              <div className="ml-1 flex items-center gap-1">
                {[7, 14, 30].map((value) => (
                  <button
                    key={value}
                    className="gx-hero-pill"
                    data-active={days === value}
                    onClick={() => setDays(value)}
                  >
                    {value}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden shrink-0 items-end gap-5 pb-1 xl:flex">
            {[
              { label: 'Avg. deal', value: money(Number(data.counts.pipeline_value) / Math.max(1, Number(data.counts.open_deals)), currency, true) },
              { label: 'Won · 30d', value: money(data.charts.wonLost.won_value_30, currency, true) },
              { label: 'Overdue', value: String(Number(data.counts.overdue_tasks)) },
            ].map((stat) => (
              <div key={stat.label} className="border-l border-white/10 pl-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8fa6c3]">{stat.label}</div>
                <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {customising ? (
        <Card>
          <CardHeader
            title="Dashboard layout"
            subtitle="Show, hide and reorder widgets. The layout is saved for this user on this browser."
            action={
              <Button size="sm" variant="ghost" onClick={() => saveLayout(DEFAULT_LAYOUT)}>
                Reset
              </Button>
            }
          />
          <ul className="divide-y divide-line">
            {DEFAULT_LAYOUT.map((id) => {
              const widget = WIDGETS.find((item) => item.id === id)!
              const index = layout.indexOf(id)
              const visible = index >= 0
              return (
                <li key={id} className="flex items-center gap-2 px-4 py-2">
                  <label className="flex flex-1 items-center gap-2 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(event) => saveLayout(event.target.checked ? [...layout, id] : layout.filter((item) => item !== id))}
                    />
                    {widget.label}
                  </label>
                  <button
                    className="rounded border border-line p-1 text-muted disabled:opacity-40"
                    aria-label={`Move ${widget.label} up`}
                    disabled={!visible || index === 0}
                    onClick={() => {
                      const next = [...layout]
                      next.splice(index - 1, 0, next.splice(index, 1)[0])
                      saveLayout(next)
                    }}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    className="rounded border border-line p-1 text-muted disabled:opacity-40"
                    aria-label={`Move ${widget.label} down`}
                    disabled={!visible || index === layout.length - 1}
                    onClick={() => {
                      const next = [...layout]
                      next.splice(index + 1, 0, next.splice(index, 1)[0])
                      saveLayout(next)
                    }}
                  >
                    <ChevronDown size={12} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {hiddenAll ? (
        <Card>
          <EmptyState
            icon={<LayoutGrid size={18} />}
            title="Every widget is hidden"
            description="Open Customise to bring dashboard widgets back."
            action={
              <Button size="sm" variant="primary" onClick={() => saveLayout(DEFAULT_LAYOUT)}>
                Restore widgets
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {layout.map((id) => (
            <div key={id} className={widgets[id].span}>
              {widgets[id].node}
            </div>
          ))}
        </div>
      )}

      <RecordFormDrawer entity="tasks" open={quickTask} record={null} onClose={() => setQuickTask(false)} onSaved={() => { setQuickTask(false); reload() }} />
    </div>
  )
}

export function lastSeen(value: unknown) {
  return value ? timeAgo(value) : '—'
}

export function formatShort(value: unknown) {
  return formatDate(value, 'day')
}
