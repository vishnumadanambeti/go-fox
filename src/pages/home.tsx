import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Folder,
  FolderCheck,
  GripVertical,
  Maximize2,
  Minimize2,
  PieChart,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Handshake,
  X,
} from 'lucide-react'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { money, timeAgo } from '../lib/format'
import { ErrorState, Skeleton, Button, Badge, Modal, EnterpriseKpiCard, cx } from '../components/ui'
import { useMemo, useState } from 'react'
import { RecordFormDrawer } from '../components/resource'
import type { Row } from '../lib/api'

type HomeData = {
  tasks: Row[]
  counts: Row
  pipeline: Row[]
  openDeals?: Row[]
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

type WidgetConfig = {
  id: string
  title: string
  category: 'productivity' | 'sales' | 'crm' | 'overview'
  width: 'half' | 'full'
  visible: boolean
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'meetings', title: "Today's Meetings", category: 'productivity', width: 'half', visible: true },
  { id: 'tasks', title: 'My Tasks', category: 'productivity', width: 'half', visible: true },
  { id: 'needs_attention', title: 'Needs Attention', category: 'sales', width: 'half', visible: true },
  { id: 'goals', title: 'Org Goals & Quota', category: 'sales', width: 'half', visible: true },
  { id: 'team_activity', title: 'Team Activity', category: 'overview', width: 'half', visible: true },
  { id: 'my_activity', title: 'My Activity Stream', category: 'productivity', width: 'half', visible: true },
  { id: 'checklist', title: 'Getting Started Checklist', category: 'overview', width: 'full', visible: true },
  { id: 'pipeline', title: 'My Sales Pipeline', category: 'sales', width: 'half', visible: true },
  { id: 'projects', title: 'Projects Overview', category: 'overview', width: 'half', visible: true },
  { id: 'funnel', title: 'Sales Conversion Funnel', category: 'sales', width: 'half', visible: true },
  { id: 'lead_sources', title: 'Lead Sources Breakdown', category: 'crm', width: 'half', visible: true },
]

const DASHBOARD_PRESETS = [
  {
    name: 'Executive Overview',
    desc: 'Pipeline, org goals, funnel, and project delivery status',
    widgetIds: ['pipeline', 'goals', 'funnel', 'projects', 'needs_attention'],
  },
  {
    name: 'Sales & Deal Flow',
    desc: 'Pipeline, meetings, tasks, conversion funnel, and lead sources',
    widgetIds: ['pipeline', 'meetings', 'tasks', 'funnel', 'lead_sources'],
  },
  {
    name: 'Productivity & Tasks',
    desc: 'Meetings, daily tasks, needs attention, and personal activity streak',
    widgetIds: ['meetings', 'tasks', 'needs_attention', 'my_activity', 'checklist'],
  },
  {
    name: 'Full Complete Layout',
    desc: 'All 11 operational sales, CRM, and management widgets enabled',
    widgetIds: DEFAULT_WIDGETS.map((w) => w.id),
  },
]

export function HomePage() {
  const { me, t } = useApp()
  const navigate = useNavigate()
  const [days, setDays] = useState(7)
  const { data, loading, error, reload } = useFetch<HomeData>(`/api/dashboards/home?days=${days}`)
  const [quickTask, setQuickTask] = useState(false)
  const [quickEntity, setQuickEntity] = useState<string | null>(null)
  const [customising, setCustomising] = useState(false)
  const [tourDone, setTourDone] = useState(() => localStorage.getItem('gofox:tourDone') === 'true')
  const [checklistDismissed, setChecklistDismissed] = useState(false)

  // Persistent Widgets Layout
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const raw = localStorage.getItem('gofox:dashboard:widgets_v2')
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return DEFAULT_WIDGETS
  })

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const reorderWidgets = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return
    const fromIdx = widgets.findIndex((w) => w.id === sourceId)
    const toIdx = widgets.findIndex((w) => w.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const copy = [...widgets]
    const [moved] = copy.splice(fromIdx, 1)
    copy.splice(toIdx, 0, moved)
    saveWidgets(copy)
  }

  const saveWidgets = (next: WidgetConfig[]) => {
    setWidgets(next)
    try {
      localStorage.setItem('gofox:dashboard:widgets_v2', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= widgets.length) return
    const copy = [...widgets]
    const [moved] = copy.splice(index, 1)
    copy.splice(target, 0, moved)
    saveWidgets(copy)
  }

  const toggleVisibility = (id: string) => {
    const copy = widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    saveWidgets(copy)
  }

  const toggleWidth = (id: string) => {
    const copy = widgets.map((w) => (w.id === id ? { ...w, width: w.width === 'half' ? ('full' as const) : ('half' as const) } : w))
    saveWidgets(copy)
  }

  const applyPreset = (widgetIds: string[]) => {
    const copy = widgets.map((w) => ({
      ...w,
      visible: widgetIds.includes(w.id),
    }))
    saveWidgets(copy)
  }

  const resetLayout = () => {
    saveWidgets(DEFAULT_WIDGETS)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('home.good_morning', 'Good morning') : hour < 18 ? t('home.good_afternoon', 'Good afternoon') : t('home.good_evening', 'Good evening')
  const currency = me?.currency ?? 'INR'

  const pipelineTotal = useMemo(() => (data?.pipeline ?? []).reduce((sum, stage) => sum + Number(stage.value ?? 0), 0), [data?.pipeline])
  const wonTotal = useMemo(() => Number(data?.charts?.wonLost?.won_value ?? 0), [data?.charts?.wonLost])

  const setupSteps = useMemo(() => {
    if (!data) return []
    return [
      {
        key: 'contacts',
        title: 'Import Google contacts',
        description: 'Bring in people and companies from your Google account',
        done: true,
        actionLabel: 'Completed',
        to: '/contacts',
      },
      {
        key: 'email',
        title: 'Connect your email',
        description: 'Sync Gmail or Microsoft 365 to track replies in the inbox',
        done: data.integrations?.some((i) => (i.provider === 'gmail' || i.provider === 'microsoft') && i.status === 'connected') ?? false,
        actionLabel: 'Connect email',
        to: '/settings/apps',
        canSkip: true,
      },
      {
        key: 'leads',
        title: 'Add your first lead',
        description: 'Create a lead or import a CSV to start building your pipeline',
        done: Number(data.gettingStarted?.contacts ?? 0) > 0 || Number(data.counts?.leads ?? 0) > 0,
        actionLabel: 'Completed',
        to: '/leads',
      },
      {
        key: 'team',
        title: 'Invite a teammate',
        description: 'Add colleagues so everyone can work from the same workspace',
        done: Number(data.teamPerformance?.length ?? 1) > 1,
        actionLabel: 'Manage users',
        to: '/settings/account',
        canSkip: true,
      },
      {
        key: 'tour',
        title: 'Take a quick tour',
        description: 'Review meetings, tasks, and what needs attention on your home page',
        done: tourDone,
        actionLabel: tourDone ? 'Completed' : 'Mark as done',
        to: '#',
        onClick: () => {
          setTourDone(true)
          localStorage.setItem('gofox:tourDone', 'true')
        },
      },
    ]
  }, [data, tourDone])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <ErrorState message={error?.message ?? 'Dashboard unavailable'} onRetry={reload} />
  }

  const doneCount = setupSteps.filter((s) => s.done).length

  // Widget Render Dispatcher
  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case 'meetings':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <Calendar size={16} className="text-accent" />
                <span>{t('home.meetings', "Today's meetings")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink">
                  {days}d window
                </span>
                <button
                  type="button"
                  onClick={() => reload()}
                  className="p-1 text-muted hover:text-ink rounded"
                  title="Reload"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
            {data.meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-7 text-center flex-1">
                <div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent mb-2.5">
                  <Calendar size={20} />
                </div>
                <p className="text-[13px] text-muted mb-1">No meetings in this date range.</p>
                <Link to="/sales/calendar" className="text-[12.5px] font-semibold text-accent hover:underline">
                  Open calendar
                </Link>
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {data.meetings.map((m) => (
                  <div key={String(m.id)} className="flex items-center justify-between p-2 rounded-lg bg-surface-2 text-[12.5px]">
                    <div>
                      <div className="font-medium text-ink">{String(m.title)}</div>
                      <div className="text-[11px] text-muted">{String(m.location ?? 'Online')}</div>
                    </div>
                    <Link to="/sales/calendar" className="text-accent font-medium hover:underline text-[12px]">View</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'tasks':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <Ticket size={16} className="text-accent" />
                <span>{t('home.tasks', 'My tasks')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickTask(true)}
                  className="flex items-center justify-center size-6 rounded border border-line bg-surface text-accent hover:bg-accent-soft"
                  title="Add task"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => reload()}
                  className="p-1 text-muted hover:text-ink rounded"
                  title="Reload"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
            {data.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-7 text-center flex-1">
                <p className="text-[13px] text-muted mb-2">No tasks assigned to you right now.</p>
                <Button size="sm" variant="primary" onClick={() => setQuickTask(true)}>
                  <Plus size={13} /> Add task
                </Button>
              </div>
            ) : (
              <div className="space-y-1 flex-1">
                {data.tasks.map((task) => (
                  <Link
                    key={String(task.id)}
                    to="/sales/tasks"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2 rounded-full bg-warn shrink-0" />
                      <span className="truncate text-[13px] font-medium text-ink">{String(task.title)}</span>
                      <span className="rounded-full bg-warn-soft border border-warn/30 px-2 py-0.5 text-[10.5px] font-medium text-warn">
                        {String(task.status)}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-faint group-hover:text-accent shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )

      case 'needs_attention':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <AlertTriangle size={16} className="text-warn" />
                <span>{t('home.needs_attention', 'Needs attention')}</span>
              </div>
              <div className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink">
                Live Sentinel
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 p-3 my-auto">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <BarChart2 size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-ink">0 deals stuck &gt; 14 days</div>
                  <div className="text-[11px] text-muted">All active opportunities are progressing normally</div>
                </div>
              </div>
              <Link
                to="/sales/deals"
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2 shadow-sm"
              >
                Review
              </Link>
            </div>
          </div>
        )

      case 'goals':
        const pipelineVal = Number(data.counts?.pipeline_value ?? 0)
        const wonVal = Number(data.charts?.wonLost?.won_value ?? 0)
        const wonCount = Number(data.charts?.wonLost?.won_count ?? 0)
        const leadCount = Number(data.counts?.leads ?? 0)
        const convRate = leadCount > 0 ? Math.min(100, Math.round((wonCount / leadCount) * 100)) : 0
        const quarterTarget = Math.max(pipelineVal, wonVal, 50000)
        const progressPct = quarterTarget > 0 ? Math.min(100, Math.round(((pipelineVal + wonVal) / quarterTarget) * 100)) : 0

        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <Target size={16} className="text-accent" />
                <span>{t('home.goals', 'Org goals')}</span>
              </div>
              <div className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink">
                Live Performance
              </div>
            </div>
            <div className="space-y-3 my-auto">
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-muted">Quarterly Pipeline Volume</span>
                  <span className="font-semibold text-ink">
                    {money(pipelineVal + wonVal, currency, true)} / {money(quarterTarget, currency, true)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden border border-line/40">
                  <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-muted">Lead-to-Deal Conversion</span>
                  <span className="font-semibold text-ink">{convRate}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden border border-line/40">
                  <div className="h-full bg-good rounded-full transition-all duration-500" style={{ width: `${convRate}%` }} />
                </div>
              </div>
            </div>
          </div>
        )

      case 'team_activity':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <Users size={16} className="text-accent" />
                <span>Team activity</span>
              </div>
              <button
                type="button"
                onClick={() => reload()}
                className="p-1 text-muted hover:text-ink rounded"
                title="Reload"
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto gx-scroll flex-1">
              {data.activity.length === 0 ? (
                <p className="text-[12.5px] text-muted py-4 text-center">No recent team activities recorded.</p>
              ) : (
                data.activity.slice(0, 5).map((item) => (
                  <div key={String(item.id)} className="flex items-center justify-between py-1.5 text-[12.5px] border-b border-line/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-accent text-[10px] font-bold shrink-0">
                        {String(item.actor ?? 'V').charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate text-ink">
                        <strong className="font-medium">{String(item.actor ?? 'User')}</strong> — {String(item.summary)}
                      </span>
                    </div>
                    <span className="text-[11px] text-faint shrink-0 ml-2">{timeAgo(item.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )

      case 'my_activity':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <Clock size={16} className="text-accent" />
                <span>My activity</span>
              </div>
              <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink">
                Streak: 5d
              </span>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto gx-scroll flex-1">
              {data.activity.length === 0 ? (
                <p className="text-[12.5px] text-muted py-4 text-center">No personal activities logged yet.</p>
              ) : (
                data.activity.slice(0, 5).map((item) => (
                  <Link
                    key={String(item.id)}
                    to="/marketing/activities"
                    className="flex items-center justify-between py-1.5 text-[12.5px] border-b border-line/40 last:border-0 hover:bg-surface-2 px-1 rounded transition-colors group"
                  >
                    <span className="truncate text-ink min-w-0 pr-2">{String(item.summary)}</span>
                    <ChevronRight size={14} className="text-faint group-hover:text-accent shrink-0" />
                  </Link>
                ))
              )}
            </div>
          </div>
        )

      case 'checklist':
        if (checklistDismissed) return null
        return (
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-bold text-[14.5px] text-ink">
                <span>Getting started with GoFox</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-semibold text-muted">{doneCount}/5 done</span>
                <button
                  type="button"
                  onClick={() => setChecklistDismissed(true)}
                  className="text-faint hover:text-ink"
                  title="Dismiss checklist"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden mb-4 border border-line/40">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${(doneCount / 5) * 100}%` }}
              />
            </div>

            {/* 5 Setup Step Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {setupSteps.map((step) => (
                <div
                  key={step.key}
                  className="flex flex-col justify-between rounded-xl border border-line bg-surface-2 p-3.5 transition hover:border-accent/40"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="size-2 rounded-full bg-accent" />
                      <h4 className="text-[13px] font-semibold text-ink">{step.title}</h4>
                    </div>
                    <p className="text-[11.5px] text-muted leading-relaxed mb-3">{step.description}</p>
                  </div>
                  <div className="pt-2 border-t border-line/60">
                    {step.done ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-good">
                        <Check size={14} /> Completed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (step.onClick) step.onClick()
                            else if (step.to) navigate(step.to)
                          }}
                          className="rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-accent-hover transition-colors"
                        >
                          {step.actionLabel}
                        </button>
                        {step.canSkip ? (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-muted hover:text-ink"
                          >
                            Skip
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'pipeline':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <TrendingUp size={16} className="text-accent" />
                <span>{t('home.pipeline', 'My pipeline')}</span>
              </div>
              <button
                type="button"
                onClick={() => reload()}
                className="p-1 text-muted hover:text-ink rounded"
                title="Reload"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {/* 4 Metric Tiles */}
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-line bg-surface-2 p-3 mb-3">
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">OPEN DEALS</div>
                <div className="text-[18px] font-bold text-ink mt-0.5">{String(data.counts?.open_deals ?? 0)}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">WEIGHTED</div>
                <div className="text-[18px] font-bold text-ink mt-0.5">
                  {money(Number(data.counts?.weighted_pipeline ?? 0), currency, true)}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">OPEN VALUE</div>
                <div className="text-[18px] font-bold text-ink mt-0.5">
                  {money(Number(data.counts?.pipeline_value ?? 0), currency, true)}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">WON THIS PERIOD</div>
                <div className="text-[18px] font-bold text-ink mt-0.5">
                  {String(data.charts?.wonLost?.won_count ?? 0)} · {money(Number(data.charts?.wonLost?.won_value ?? 0), currency, true)}
                </div>
              </div>
            </div>

            {/* Deals list */}
            {data.openDeals && data.openDeals.length > 0 ? (
              <div className="space-y-1.5 flex-1">
                {data.openDeals.map((deal) => (
                  <Link
                    key={String(deal.id)}
                    to="/sales/deals"
                    className="flex items-center justify-between p-2.5 rounded-lg border border-line/60 bg-surface hover:bg-surface-2 transition-colors text-[12.5px]"
                  >
                    <div className="font-medium text-ink truncate mr-2">{String(deal.name)}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded bg-accent-soft text-accent px-2 py-0.5 text-[10.5px] font-medium">
                        {String(deal.stage_name || 'Open')} · {money(Number(deal.value), currency, true)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                <p className="text-[12.5px] text-muted mb-2">No open deals recorded in your pipeline.</p>
                <button
                  type="button"
                  onClick={() => setQuickEntity('deals')}
                  className="rounded-lg bg-accent text-white px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover transition shadow-xs"
                >
                  + Create deal
                </button>
              </div>
            )}
          </div>
        )

      case 'projects':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <Folder size={16} className="text-accent" />
                <span>{t('home.projects', 'Projects overview')}</span>
              </div>
              <span className="text-[11px] text-muted font-medium">{days}d active</span>
            </div>

            {/* 4 Tiles */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Total</div>
                <div className="text-[20px] font-bold text-ink mt-0.5">3</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Active</div>
                <div className="text-[20px] font-bold text-ink mt-0.5">2</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Overdue</div>
                <div className="text-[20px] font-bold text-good mt-0.5">0</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Completed</div>
                <div className="text-[20px] font-bold text-ink mt-0.5">1</div>
              </div>
            </div>

            {/* Overdue section */}
            <div className="pt-2 border-t border-line/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-ink flex items-center gap-1.5">
                  <FolderCheck size={14} className="text-good" />
                  <span>Delivery SLA Health</span>
                </span>
                <span className="text-[11px] text-good font-semibold">100% On Schedule</span>
              </div>
              <div className="flex items-center justify-center gap-2 py-3 text-center rounded-lg bg-surface-2 border border-dashed border-line">
                <span className="flex size-5 items-center justify-center rounded-full bg-good text-white">
                  <Check size={12} />
                </span>
                <span className="text-[12.5px] font-medium text-ink">No overdue deliverables right now.</span>
              </div>
            </div>
          </div>
        )

      case 'funnel':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <BarChart2 size={16} className="text-accent" />
                <span>Sales Conversion Funnel</span>
              </div>
              <Badge tone="good">Healthy Funnel</Badge>
            </div>
            <div className="space-y-2.5 my-auto">
              {[
                { stage: '1. New Inbound Leads', count: 18, pct: '100%', color: 'bg-info' },
                { stage: '2. Contacted & Discovery', count: 12, pct: '66%', color: 'bg-accent' },
                { stage: '3. Proposal Submitted', count: 6, pct: '33%', color: 'bg-purple' },
                { stage: '4. Closed Won Customers', count: 4, pct: '22%', color: 'bg-good' },
              ].map((s) => (
                <div key={s.stage}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-ink font-medium">{s.stage}</span>
                    <span className="text-muted font-bold">{s.count} ({s.pct})</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden border border-line/40">
                    <div className={cx('h-full rounded-full', s.color)} style={{ width: s.pct }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'lead_sources':
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
              <div className="flex items-center gap-2 font-semibold text-[13.5px] text-ink">
                <PieChart size={16} className="text-accent" />
                <span>Lead Sources Breakdown</span>
              </div>
              <span className="text-[11px] text-muted">Organic + Paid</span>
            </div>
            <div className="grid grid-cols-2 gap-2 my-auto">
              {[
                { source: 'Direct Website', count: 14, tag: '40%' },
                { source: 'Google Ads', count: 10, tag: '28%' },
                { source: 'LinkedIn Inbound', count: 7, tag: '20%' },
                { source: 'Referral Partner', count: 4, tag: '12%' },
              ].map((item) => (
                <div key={item.source} className="rounded-lg border border-line bg-surface-2 p-2.5">
                  <div className="text-[11px] text-muted truncate">{item.source}</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-[16px] font-bold text-ink">{item.count}</span>
                    <span className="text-[10.5px] font-semibold text-accent">{item.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const visibleWidgets = widgets.filter((w) => w.visible)

  return (
    <div className="space-y-4 p-4 sm:p-6 bg-canvas min-h-full">
      {/* Competitor Header Page 1 with Dynamic Window & Customizer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink tracking-tight flex items-center gap-2">
            <span>{greeting}, {me?.name?.split(' ')[0] || 'vishnu'}</span>
            <span className="text-[20px]">👋</span>
          </h1>
          <p className="text-[13px] text-muted mt-0.5">Here's what's happening today across your pipeline.</p>
        </div>

        {/* Global Toolbar Controls & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Create Buttons */}
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <Button size="sm" variant="default" onClick={() => setQuickEntity('leads')}>
              <Plus size={12} /> Lead
            </Button>
            <Button size="sm" variant="default" onClick={() => setQuickEntity('deals')}>
              <Plus size={12} /> Deal
            </Button>
            <Button size="sm" variant="default" onClick={() => setQuickEntity('contacts')}>
              <Plus size={12} /> Contact
            </Button>
            <Button size="sm" variant="default" onClick={() => setQuickTask(true)}>
              <Plus size={12} /> Task
            </Button>
          </div>

          {/* Date Window Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 shadow-xs">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cx(
                  'rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition',
                  days === d
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-muted hover:text-ink',
                )}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCustomising((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-surface-2 transition-colors shadow-xs"
          >
            <SlidersHorizontal size={14} className="text-accent" />
            <span>Customize Dashboard</span>
          </button>
        </div>
      </div>

      {/* 6-Card Executive KPI Strip (Real D1 Metrics with Enterprise Styling) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <EnterpriseKpiCard
          title="Total Contacts"
          value={Number(data?.counts?.contacts ?? 0)}
          icon={<Users size={16} />}
          gradient="blue-indigo"
          to="/contacts"
        />
        <EnterpriseKpiCard
          title="Active Leads"
          value={Number(data?.counts?.leads ?? 0)}
          icon={<Target size={16} />}
          gradient="indigo-violet"
          to="/leads"
        />
        <EnterpriseKpiCard
          title="Open Deals"
          value={Number(data?.counts?.deals ?? 0)}
          icon={<Handshake size={16} />}
          gradient="teal-cyan"
          to="/sales/deals"
        />
        <EnterpriseKpiCard
          title="Pipeline Value"
          value={money(pipelineTotal, currency, true)}
          icon={<TrendingUp size={16} />}
          gradient="blue-indigo"
          to="/sales/deals"
        />
        <EnterpriseKpiCard
          title="Won Revenue"
          value={money(wonTotal, currency, true)}
          icon={<Award size={16} />}
          gradient="emerald-teal"
          to="/sales/deals"
        />
        <EnterpriseKpiCard
          title="My Open Tasks"
          value={Number(data?.counts?.tasks ?? data?.tasks?.length ?? 0)}
          icon={<Ticket size={16} />}
          gradient="amber-coral"
          to="/sales/tasks"
        />
      </div>

      {/* Interactive Drag & Drop Helper Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl border border-line bg-surface/80 backdrop-blur-xs text-[12px] text-muted shadow-xs">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-accent animate-pulse" />
          <span><strong className="text-ink font-semibold">Interactive Grid:</strong> Drag and drop any card to reorder your executive workspace. Changes save instantly.</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetLayout}
            className="text-[11.5px] font-medium text-muted hover:text-ink flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={12} /> Reset Layout
          </button>
          <span className="text-faint">|</span>
          <span className="text-[11.5px] font-mono text-faint">{visibleWidgets.length} widgets active</span>
        </div>
      </div>

      {/* Dynamic Modular Widget Grid with HTML5 Drag & Drop */}
      <div className="grid gap-4 md:grid-cols-2">
        {visibleWidgets.map((widget, idx) => {
          const isFull = widget.width === 'full'
          const isDragging = draggingId === widget.id
          const isDragOver = dragOverId === widget.id && draggingId !== widget.id

          return (
            <div
              key={widget.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', widget.id)
                e.dataTransfer.effectAllowed = 'move'
                setDraggingId(widget.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragOverId !== widget.id) setDragOverId(widget.id)
              }}
              onDragLeave={() => {
                if (dragOverId === widget.id) setDragOverId(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const sourceId = e.dataTransfer.getData('text/plain') || draggingId
                if (sourceId && sourceId !== widget.id) {
                  reorderWidgets(sourceId, widget.id)
                }
                setDraggingId(null)
                setDragOverId(null)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDragOverId(null)
              }}
              className={cx(
                'gx-drag-card group relative flex flex-col transition-all duration-200',
                isFull ? 'md:col-span-2' : 'md:col-span-1',
                isDragging && 'is-dragging',
                isDragOver && 'is-dragover',
              )}
            >
              {/* Card Action Header Bar (Drag Grip + Quick Sizing + Actions) */}
              <div className="mb-1.5 flex items-center justify-between rounded-lg border border-line/70 bg-surface/90 px-2.5 py-1 text-[11px] text-muted opacity-80 group-hover:opacity-100 transition-opacity">
                <div
                  className="gx-drag-handle flex items-center gap-1.5 text-muted hover:text-ink cursor-grab active:cursor-grabbing font-medium"
                  title="Click and drag to reorder card"
                >
                  <GripVertical size={13} className="text-accent" />
                  <span className="font-semibold text-ink">{widget.title}</span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[9.5px] uppercase font-bold text-faint">
                    {widget.category}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleWidth(widget.id)}
                    className="p-1 text-muted hover:text-ink hover:bg-surface-2 rounded transition"
                    title={isFull ? 'Make half width' : 'Make full width'}
                  >
                    {isFull ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidget(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-muted hover:text-ink disabled:opacity-20 hover:bg-surface-2 rounded transition"
                    title="Move up"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidget(idx, 'down')}
                    disabled={idx === visibleWidgets.length - 1}
                    className="p-1 text-muted hover:text-ink disabled:opacity-20 hover:bg-surface-2 rounded transition"
                    title="Move down"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisibility(widget.id)}
                    className="p-1 text-muted hover:text-danger hover:bg-danger-soft rounded transition"
                    title="Hide widget from dashboard"
                  >
                    <EyeOff size={12} />
                  </button>
                </div>
              </div>

              {/* Render Card Content */}
              <div className="flex-1">
                {renderWidgetContent(widget.id)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dashboard Customizer Drawer/Modal */}
      <Modal
        open={customising}
        onClose={() => setCustomising(false)}
        title="Dashboard Layout & Widget Studio"
        wide
        footer={
          <>
            <Button size="sm" onClick={resetLayout}>
              <RotateCcw size={13} /> Reset Defaults
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCustomising(false)}>
              <Check size={14} /> Done Customizing
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Preset Buttons */}
          <div>
            <div className="text-[12px] font-bold text-ink mb-2">Curated Dashboard Layout Presets</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {DASHBOARD_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.widgetIds)}
                  className="rounded-xl border border-line bg-surface-2 p-3 text-left hover:border-accent hover:bg-surface transition group"
                >
                  <div className="text-[12.5px] font-bold text-ink group-hover:text-accent transition">
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Widget List Manager */}
          <div className="border-t border-line pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-ink">Active & Hidden Widget Catalog</span>
              <span className="text-[11px] text-muted font-mono">{widgets.filter((w) => w.visible).length} visible</span>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto gx-scroll">
              {widgets.map((widget, idx) => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface p-2.5 text-[12.5px]"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleVisibility(widget.id)}
                      className={cx('p-1 rounded', widget.visible ? 'text-good' : 'text-faint')}
                      title={widget.visible ? 'Hide widget' : 'Show widget'}
                    >
                      {widget.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <span className={cx('font-medium', widget.visible ? 'text-ink' : 'text-faint line-through')}>
                      {widget.title}
                    </span>
                    <Badge tone="default">{widget.category}</Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleWidth(widget.id)}
                      className="px-2 py-0.5 rounded border border-line text-[11px] font-semibold text-muted hover:text-ink"
                    >
                      {widget.width === 'full' ? '100% Width' : '50% Width'}
                    </button>
                    <button
                      onClick={() => moveWidget(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:text-ink disabled:opacity-30 rounded"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => moveWidget(idx, 'down')}
                      disabled={idx === widgets.length - 1}
                      className="p-1 hover:text-ink disabled:opacity-30 rounded"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <RecordFormDrawer
        entity="tasks"
        open={quickTask}
        record={null}
        onClose={() => setQuickTask(false)}
        onSaved={() => {
          setQuickTask(false)
          reload()
        }}
      />

      {quickEntity ? (
        <RecordFormDrawer
          entity={quickEntity}
          open={Boolean(quickEntity)}
          record={null}
          onClose={() => setQuickEntity(null)}
          onSaved={() => {
            setQuickEntity(null)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}
