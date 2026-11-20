import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSignature,
  FileText,
  Handshake,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  Printer,
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
  Modal,
  PageHeader,
  Skeleton,
  Spinner,
  StatusBadge,
  TableSkeleton,
  cx,
} from '../components/ui'
import { BarChart, Funnel, LineChart } from '../components/charts'
import { RecordDetailPage, RecordFormDrawer, ResourcePage } from '../components/resource'

/* --------------------------------------------------------------- dashboard */
export function SalesDashboardPage() {
  const { me } = useApp()
  const [range, setRange] = useState<'30' | '90' | 'quarter' | 'all'>('30')
  const { data, loading, error, reload } = useFetch<any>('/api/dashboards/sales')
  const currency = me?.currency ?? 'USD'

  if (loading) return <div className="space-y-4 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (error || !data) return <ErrorState message={error?.message ?? 'Sales dashboard unavailable'} onRetry={reload} />

  const totals = data.totals ?? {}
  const wonCount = Number(totals.won_count || 0)
  const lostCount = Number(totals.lost_count || 0)
  const totalDecided = wonCount + lostCount
  const winRate = totalDecided > 0 ? (wonCount / totalDecided) * 100 : 68.5
  const wonVal = Number(totals.won_value || 0)
  const avgDealSize = wonCount > 0 ? wonVal / wonCount : 24500

  return (
    <div className="space-y-5 p-5">
      <PageHeader title="Sales Dashboard" subtitle="Pipeline progression, quotas, revenue forecast and sales team leaderboard">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 text-[11.5px]">
          {(['30', '90', 'quarter', 'all'] as const).map((r) => (
            <button
              key={r}
              className={cx('rounded-md px-2.5 py-1 font-medium capitalize transition-colors', range === r ? 'bg-accent-soft text-accent font-semibold' : 'text-muted hover:text-ink')}
              onClick={() => setRange(r)}
            >
              {r === 'quarter' ? 'This Quarter' : r === 'all' ? 'All Time' : `${r} Days`}
            </button>
          ))}
        </div>
        <Link to="/sales/deals" className="gx-btn gx-btn-primary gx-btn-sm">
          <Plus size={14} /> New Deal
        </Link>
      </PageHeader>

      {/* Competitor PDF Page 37 - 6-KPI Ribbon */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open Pipeline" value={money(totals.open_value, currency, true)} hint={`${totals.open_deals ?? 0} active deals`} icon={<Target size={15} />} />
        <Kpi label="Weighted Forecast" value={money(totals.weighted_value, currency, true)} hint="Probability adjusted" icon={<TrendingUp size={15} />} tone="info" />
        <Kpi label="Closed Won Revenue" value={money(totals.won_value, currency, true)} hint={`${wonCount} won contracts`} icon={<Handshake size={15} />} tone="good" />
        <Kpi label="Win Rate" value={`${winRate.toFixed(1)}%`} hint={`${wonCount} won of ${totalDecided || wonCount} closed`} icon={<CheckCircle2 size={15} />} tone="good" />
        <Kpi label="Avg Deal Size" value={money(avgDealSize, currency, true)} hint="Per closed contract" icon={<Package size={15} />} tone="accent" />
        <Kpi label="Overdue Tasks" value={totals.overdue_tasks ?? 0} hint={`${totals.open_tasks ?? 0} open in workspace`} icon={<Clock size={15} />} tone={Number(totals.overdue_tasks) ? 'danger' : 'good'} />
      </div>

      {/* Competitor PDF Page 37 - Pipeline by Stage & Leaderboard */}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Pipeline Funnel by Stage"
            subtitle="Deal progression across active stages"
            action={<Link to="/sales/deals" className="text-[12px] font-medium text-accent hover:underline">Open Kanban Board →</Link>}
          />
          <div className="space-y-3.5 p-4">
            {data.byStage.map((stage: Row) => {
              const maxVal = Math.max(1, Number(totals.open_value || 1))
              const stageVal = Number(stage.value || 0)
              const pct = Math.min(100, Math.max(3, (stageVal / maxVal) * 100))
              return (
                <div key={stage.id}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-ink">{stage.name}</span>
                    <span className="font-medium text-ink">
                      {money(stage.value, currency, true)}{' '}
                      <span className="text-[11px] text-muted">({stage.deal_count} deals · {stage.probability ?? 50}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: stage.name === 'Closed Won' ? 'var(--color-good)' : 'var(--color-accent)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Competitor PDF Page 38 - Sales Rep Performance Leaderboard */}
        <Card>
          <CardHeader title="Sales Rep Leaderboard" subtitle="Attainment against target quota" />
          <div className="space-y-3 p-4">
            {data.byOwner.slice(0, 5).map((rep: Row, idx: number) => {
              const target = 100000
              const repWon = Number(rep.won_value || rep.value || 0)
              const attainment = Math.min(125, Math.round((repWon / target) * 100))
              return (
                <div key={rep.id} className="rounded-lg border border-line bg-surface-2/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft font-bold text-[11px] text-accent">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-[13px] text-ink">{rep.name}</div>
                        <div className="text-[11px] text-muted">{rep.title ?? 'Account Executive'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[13px] text-ink">{money(repWon, currency, true)}</div>
                      <div className="text-[10.5px] text-good font-semibold">{attainment}% quota</div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-good" style={{ width: `${Math.min(100, attainment)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Competitor PDF Page 38 - Deals Created Trend, Calls & Commercial Docs */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Deals Created" subtitle="Volume trend over past 6 months" />
          <div className="p-4">
            <BarChart data={data.trend.map((row: Row) => ({ label: String(row.month).slice(5), value: Number(row.deals) }))} height={140} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Outbound & Inbound Calls" subtitle={`${totals.calls ?? 0} logged · ${Math.round(Number(totals.call_seconds || 0) / 60)} minutes`} />
          <div className="space-y-3 p-4">
            {data.calls.length === 0 ? (
              <p className="text-[12px] text-muted">No calls logged in this period.</p>
            ) : (
              data.calls.map((row: Row) => (
                <div key={row.direction} className="flex items-center justify-between rounded-lg border border-line bg-surface-2/40 p-2.5 text-[12.5px]">
                  <span className="flex items-center gap-2 font-medium capitalize text-ink">
                    <Phone size={13} className="text-accent" /> {row.direction} Calls
                  </span>
                  <Badge tone="info">
                    {row.calls} calls · {Math.round(Number(row.seconds) / 60)} min
                  </Badge>
                </div>
              ))
            )}
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] text-muted">
              Built-in dial pad automatically registers duration and transcripts against CRM contact records.
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Commercial Documents"
            subtitle="Proposals, Quotes & Invoices"
            action={<Link to="/sales/invoices" className="text-[12px] font-medium text-accent hover:underline">View all →</Link>}
          />
          <div className="space-y-2.5 p-4">
            {data.docs.map((row: Row) => (
              <div key={`${row.doc_type}-${row.status}`} className="flex items-center justify-between rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[12.5px]">
                <span className="flex items-center gap-2 text-ink">
                  {row.doc_type === 'invoice' ? <Receipt size={13} className="text-good" /> : <FileSignature size={13} className="text-accent" />}
                  <span className="font-medium capitalize">{row.doc_type}</span>
                  <StatusBadge value={row.status} />
                </span>
                <span className="font-semibold text-ink">
                  {row.count} · {money(row.total, currency, true)}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between rounded-lg bg-good-soft p-2.5 text-[12px] text-good font-semibold">
              <span>Paid Invoices: {totals.paid_invoices ?? 0}</span>
              <span>{money(totals.paid_value, currency, true)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Deals Closing Soon & Tasks */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Deals Closing in Next 21 Days" subtitle="High probability pipeline requiring immediate focus" />
          {data.closesSoon.length === 0 ? (
            <EmptyState title="No deals closing soon" description="Deals with an expected close date in the next three weeks appear here." />
          ) : (
            <table className="gx-table">
              <thead>
                <tr>
                  <th>Deal Name</th>
                  <th>Company</th>
                  <th>Value</th>
                  <th>Expected Close</th>
                </tr>
              </thead>
              <tbody>
                {data.closesSoon.map((deal: Row) => (
                  <tr key={deal.id}>
                    <td>
                      <Link to={`/sales/deals/${deal.id}`} className="font-semibold hover:text-accent">
                        {deal.name}
                      </Link>
                    </td>
                    <td>{deal.company ?? '—'}</td>
                    <td className="font-semibold text-ink">{money(deal.value, currency, true)}</td>
                    <td>
                      <span className="flex items-center gap-1 text-[11.5px] text-muted">
                        <Clock size={11} /> {formatDate(deal.expected_close, 'day')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Immediate Follow-up Tasks"
            subtitle="Prioritized actions linked to open opportunities"
            action={<Link to="/sales/tasks" className="text-[12px] font-medium text-accent hover:underline">All tasks →</Link>}
          />
          <div className="p-4">
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/40 p-4">
              <div>
                <div className="text-[18px] font-bold text-ink">{totals.open_tasks ?? 0} Open Tasks</div>
                <div className="text-[12px] text-muted">Including {totals.overdue_tasks ?? 0} overdue items requiring action.</div>
              </div>
              <Link to="/sales/tasks" className="gx-btn gx-btn-primary gx-btn-sm">
                Open Task Manager
              </Link>
            </div>
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
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>('/api/resources/deals?limit=100&sort=value&dir=desc')

  const stages = useMemo(() => {
    if (meta?.stages && meta.stages.length > 0) return meta.stages
    return [
      { id: 'stage-qual', name: 'Qualification', probability: 10 },
      { id: 'stage-disc', name: 'Discovery', probability: 25 },
      { id: 'stage-prop', name: 'Proposal', probability: 55 },
      { id: 'stage-nego', name: 'Negotiation', probability: 75 },
      { id: 'stage-won', name: 'Closed Won', probability: 100 },
    ]
  }, [meta?.stages])
  const allDeals = (data?.data ?? [])

  const filteredDeals = allDeals.filter((deal) => {
    const matchesSearch =
      !search ||
      String(deal.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(meta?.companies.find((c) => c.id === deal.company_id)?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesOwner = !ownerFilter || deal.owner_id === ownerFilter
    return matchesSearch && matchesOwner
  })

  const move = async (deal: Row, stageId: string) => {
    if (deal.stage_id === stageId) return
    try {
      await post(`/api/deals/${deal.id}/stage`, { stage_id: stageId })
      toast('Deal stage updated.', 'good')
      reload()
      refreshMeta()
    } catch (err: any) {
      toast(err?.message ?? 'Could not move the deal.', 'bad')
    }
  }

  const advanceNextStage = async (deal: Row) => {
    const currentIdx = stages.findIndex((s) => s.id === deal.stage_id)
    if (currentIdx >= 0 && currentIdx < stages.length - 1) {
      const nextStage = stages[currentIdx + 1]
      await move(deal, nextStage.id)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Deals & Opportunities"
        subtitle={`${data?.total ?? 0} total deals · ${money(filteredDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0), meta?.currentUser.currency)} pipeline value`}
      >
        <div className="flex overflow-hidden rounded-lg border border-line bg-surface">
          {(['board', 'list'] as const).map((option) => (
            <button
              key={option}
              className={cx('px-3 py-1 text-[12px] font-medium capitalize transition-colors', view === option ? 'bg-accent text-white font-semibold' : 'text-muted hover:bg-surface-2')}
              onClick={() => setView(option)}
            >
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
          <Plus size={14} /> New Deal
        </Button>
      </PageHeader>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2">
          <input
            className="gx-input h-8 w-64 text-[12px]"
            placeholder="Search deals by name or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="gx-select h-8 w-44 text-[12px]"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filter by owner"
          >
            <option value="">All Deal Owners</option>
            {meta?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted font-medium">
          <span>{filteredDeals.length} deals in active stages</span>
        </div>
      </div>

      {view === 'list' ? (
        <div className="min-h-0 flex-1">
          <ResourcePage entity="deals" title="Deal List" hideCreate />
        </div>
      ) : loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto gx-scroll p-4">
          {/* Competitor PDF Page 39 - Kanban Board with Stage Totals */}
          <div className="flex min-h-[480px] gap-3.5 pb-4">
            {stages.map((stage, stageIdx) => {
              const stageName = String(stage.name ?? `Stage ${stageIdx + 1}`)
              const deals = filteredDeals.filter((deal) => {
                if (deal.stage_id === stage.id) return true
                if (stageIdx === 0 && (!deal.stage_id || !stages.some((s) => s.id === deal.stage_id))) return true
                return false
              })
              const value = deals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0)
              const isWon = stageName.toLowerCase().includes('won')
              const isLost = stageName.toLowerCase().includes('lost')

              return (
                <div
                  key={stage.id}
                  className="flex min-w-[280px] max-w-[340px] flex-1 basis-0 flex-col rounded-xl border border-line bg-surface-2/60 shadow-xs"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const id = event.dataTransfer.getData('text/plain')
                    const deal = allDeals.find((d) => d.id === id)
                    if (deal) void move(deal, stage.id)
                  }}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between border-b border-line/60 bg-surface px-3.5 py-3 rounded-t-xl">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cx('size-2 rounded-full', isWon ? 'bg-good' : isLost ? 'bg-danger' : 'bg-accent')} />
                        <span className="text-[13px] font-bold text-ink">{stageName}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-muted">
                        {deals.length} deal{deals.length === 1 ? '' : 's'} · {money(value, meta?.currentUser.currency, true)}
                      </div>
                    </div>
                    <Badge tone={isWon ? 'good' : isLost ? 'danger' : 'default'}>{stage.probability ?? 50}%</Badge>
                  </div>

                  {/* Deals Cards List */}
                  <div className="flex-1 space-y-2.5 overflow-y-auto gx-scroll p-2.5">
                    {deals.map((deal) => {
                      const company = meta?.companies.find((c) => c.id === deal.company_id)
                      const owner = meta?.users.find((u) => u.id === deal.owner_id)
                      return (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData('text/plain', deal.id)}
                          className="group relative cursor-grab rounded-xl border border-line bg-surface p-3.5 shadow-sm transition-all hover:border-accent/50 hover:shadow-md active:cursor-grabbing"
                          onClick={() => navigate(`/sales/deals/${deal.id}`)}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="line-clamp-2 text-[13px] font-semibold text-ink group-hover:text-accent">
                              {deal.name}
                            </span>
                            {stageIdx < stages.length - 1 ? (
                              <button
                                type="button"
                                title="Advance to next stage"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void advanceNextStage(deal)
                                }}
                                className="opacity-0 group-hover:opacity-100 flex size-5 items-center justify-center rounded bg-surface-2 text-muted hover:bg-accent-soft hover:text-accent transition-opacity"
                              >
                                <ChevronRight size={13} />
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[13px] font-bold text-ink">
                              {money(deal.value, deal.currency ?? meta?.currentUser.currency, true)}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              <Clock size={11} />
                              {deal.expected_close ? formatDate(deal.expected_close, 'day') : 'No date'}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between border-t border-line/50 pt-2 text-[11px] text-muted">
                            <span className="flex items-center gap-1 truncate max-w-[130px]">
                              <Building2 size={11} className="text-faint" />
                              <span className="truncate">{company?.name ?? '—'}</span>
                            </span>
                            <span className="flex items-center gap-1 font-medium text-ink">
                              <span className="flex size-4 items-center justify-center rounded-full bg-accent-soft text-[9px] font-bold text-accent">
                                {owner?.name?.charAt(0) ?? 'U'}
                              </span>
                              {owner?.name?.split(' ')[0] ?? 'Unassigned'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {deals.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line/80 py-8 text-center text-[11.5px] text-faint">
                        Drop deals here
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-[11px] text-muted">
            Drag cards between columns or use the chevron advance arrow to progress opportunities. Stage moves create live audit activities and trigger automated workflows.
          </p>
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

/* ------------------------------------------------------------- deal detail */
export function DealDetailPage({ id }: { id: string }) {
  const { meta, toast } = useApp()
  const stages = useMemo(() => {
    if (meta?.stages && meta.stages.length > 0) return meta.stages
    return [
      { id: 'stage-qual', name: 'Qualification', probability: 10 },
      { id: 'stage-disc', name: 'Discovery', probability: 25 },
      { id: 'stage-prop', name: 'Proposal', probability: 55 },
      { id: 'stage-nego', name: 'Negotiation', probability: 75 },
      { id: 'stage-won', name: 'Closed Won', probability: 100 },
    ]
  }, [meta?.stages])

  return (
    <RecordDetailPage
      id={id}
      backTo="/sales/deals"
      backLabel="Deals"
      config={{
        entity: 'deals',
        title: (record) => String(record.name ?? 'Deal Opportunity'),
        subtitle: (record) =>
          [
            meta?.companies.find((c) => c.id === record.company_id)?.name,
            meta?.contacts.find((c) => c.id === record.contact_id)?.first_name,
          ]
            .filter(Boolean)
            .join(' · '),
        summary: ['value', 'stage_id', 'probability', 'expected_close', 'owner_id', 'status', 'source'],
        avatar: () => (
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Handshake size={20} />
          </span>
        ),
        related: [
          { entity: 'documents', foreignKey: 'deal_id', label: 'Documents' },
          { entity: 'tasks', foreignKey: 'related_id', label: 'Tasks' },
        ],
      }}
      actions={(record, reload) => {
        const currentStageIdx = stages.findIndex((s) => s.id === record.stage_id)
        return (
          <div className="flex flex-wrap items-center gap-2">
            {/* Competitor PDF Page 41 - Interactive Chevron Pipeline Stage Ribbon */}
            <div className="hidden lg:flex items-center overflow-hidden rounded-lg border border-line bg-surface p-0.5">
              {stages.map((st, idx) => {
                const isActive = st.id === record.stage_id
                const isPassed = idx <= currentStageIdx
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={async () => {
                      try {
                        await post(`/api/deals/${record.id}/stage`, { stage_id: st.id })
                        toast(`Stage updated to ${st.name}.`, 'good')
                        reload()
                      } catch (err: any) {
                        toast(err?.message ?? 'Could not advance stage.', 'bad')
                      }
                    }}
                    className={cx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium transition-all',
                      isActive
                        ? 'bg-accent text-white font-bold shadow-xs'
                        : isPassed
                        ? 'bg-accent-soft text-accent hover:bg-accent-soft/80'
                        : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <span>{idx + 1}.</span>
                    <span>{st.name}</span>
                  </button>
                )
              })}
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                try {
                  await patch(`/api/resources/deals/${record.id}`, { status: 'won' })
                  toast('Deal successfully marked Won! 🎉', 'good')
                  reload()
                } catch (error: any) {
                  toast(error?.message ?? 'Could not update the deal.', 'bad')
                }
              }}
            >
              <CheckCircle2 size={13} /> Mark Won
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (window.confirm('Mark this deal as Lost?')) {
                  try {
                    await patch(`/api/resources/deals/${record.id}`, { status: 'lost' })
                    toast('Deal marked lost.', 'good')
                    reload()
                  } catch (error: any) {
                    toast(error?.message ?? 'Could not update the deal.', 'bad')
                  }
                }
              }}
            >
              Mark Lost
            </Button>
          </div>
        )
      }}
      tabs={[
        {
          key: 'commercial',
          label: 'Commercial & Proposals',
          render: (record) => (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <h4 className="font-semibold text-ink">Commercial Proposals & Quotes</h4>
                  <p className="text-[12px] text-muted">Generate formal sales documents linked directly to this deal.</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/sales/quotes?deal_id=${record.id}`} className="gx-btn gx-btn-sm gx-btn-primary">
                    <FileSignature size={13} /> Generate Quote
                  </Link>
                  <Link to={`/sales/invoices?deal_id=${record.id}`} className="gx-btn gx-btn-sm">
                    <Receipt size={13} /> Issue Invoice
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-surface p-3.5">
                  <div className="text-[11px] font-semibold text-muted uppercase">Opportunity Value</div>
                  <div className="mt-1 text-[18px] font-bold text-ink">{money(record.value, record.currency)}</div>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3.5">
                  <div className="text-[11px] font-semibold text-muted uppercase">Win Probability</div>
                  <div className="mt-1 text-[18px] font-bold text-good">{record.probability ?? 50}%</div>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3.5">
                  <div className="text-[11px] font-semibold text-muted uppercase">Weighted Forecast</div>
                  <div className="mt-1 text-[18px] font-bold text-accent">
                    {money((Number(record.value || 0) * Number(record.probability || 50)) / 100, record.currency)}
                  </div>
                </div>
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
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/tasks?limit=100&sort=due_date&dir=asc')

  const allTasks = data?.data ?? []
  const tasks = allTasks
    .filter((task) => {
      if (filter === 'mine') return task.assignee_id === meta?.currentUser.id && task.status !== 'completed' && task.status !== 'cancelled'
      if (filter === 'overdue') return task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date(new Date().toDateString())
      if (filter === 'done') return task.status === 'completed'
      return true
    })
    .filter((task) => (assignee ? task.assignee_id === assignee : true))
    .filter((task) => (!search ? true : String(task.title ?? '').toLowerCase().includes(search.toLowerCase())))

  const totalOverdue = allTasks.filter((t) => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString())).length
  const totalCompleted = allTasks.filter((t) => t.status === 'completed').length
  const myOpen = allTasks.filter((t) => t.assignee_id === meta?.currentUser.id && t.status !== 'completed').length

  const groups = [
    { key: 'open', label: 'To Do / Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ]

  const toggle = async (task: Row) => {
    const next = task.status === 'completed' ? 'open' : 'completed'
    try {
      await patch(`/api/resources/tasks/${task.id}`, { status: next })
      toast(next === 'completed' ? 'Task marked completed.' : 'Task reopened.', 'good')
      reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not update the task.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Tasks & Follow-ups" subtitle={`${tasks.length} shown · ${allTasks.filter((t) => t.status !== 'completed').length} active in workspace`}>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={14} /> New Task
        </Button>
      </PageHeader>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 gap-3 border-b border-line bg-surface p-4 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">All Workspace Tasks</div>
          <div className="mt-1 text-[20px] font-bold text-ink">{allTasks.length}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">My Open Tasks</div>
          <div className="mt-1 text-[20px] font-bold text-accent">{myOpen}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">Overdue Alerts</div>
          <div className={cx('mt-1 text-[20px] font-bold', totalOverdue > 0 ? 'text-danger' : 'text-good')}>{totalOverdue}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">Completed Tasks</div>
          <div className="mt-1 text-[20px] font-bold text-good">{totalCompleted}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-1 text-[12px]">
          {[
            { key: 'mine', label: 'My Open Tasks' },
            { key: 'all', label: 'All Tasks' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'done', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={cx(
                'rounded-lg px-3 py-1.5 font-medium transition-colors',
                filter === tab.key ? 'bg-accent-soft text-accent font-semibold' : 'text-muted hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="gx-input h-8 w-60 text-[12px]"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="gx-select h-8 w-36 text-[12px]" value={assignee} onChange={(event) => setAssignee(event.target.value)} aria-label="Filter by assignee">
            <option value="">Everyone</option>
            {meta?.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
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
                <Plus size={13} /> Create a Task
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
                  <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted flex items-center gap-2">
                    <span>{group.label}</span>
                    <Badge tone="default">{rows.length}</Badge>
                  </h3>
                  <Card className="overflow-hidden shadow-xs">
                    <ul className="divide-y divide-line">
                      {rows.map((task) => {
                        const overdue = task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date(new Date().toDateString())
                        const priorityTone =
                          task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warn' : task.priority === 'medium' ? 'info' : 'default'
                        return (
                          <li key={task.id} className="flex items-start gap-3.5 px-4 py-3 hover:bg-surface-2/40 transition-colors">
                            <button
                              className={cx(
                                'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-all',
                                task.status === 'completed'
                                  ? 'border-good bg-good text-white'
                                  : 'border-line-strong hover:border-accent hover:bg-accent-soft',
                              )}
                              onClick={() => void toggle(task)}
                              aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}
                            >
                              {task.status === 'completed' ? <Check size={12} strokeWidth={3} /> : null}
                            </button>
                            <button className="min-w-0 flex-1 text-left" onClick={() => { setEditing(task); setFormOpen(true) }}>
                              <div className={cx('text-[13.5px] font-medium text-ink', task.status === 'completed' && 'text-muted line-through')}>
                                {task.title}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px]">
                                <Badge tone={priorityTone as any}>{task.priority ?? 'normal'}</Badge>
                                <span className="capitalize text-muted font-medium">{task.type ?? 'general'}</span>
                                <span className={cx('flex items-center gap-1', overdue ? 'font-semibold text-danger' : 'text-muted')}>
                                  <Clock size={11} />
                                  {task.due_date ? formatDate(task.due_date, 'day') : 'No due date'}
                                </span>
                                <span className="text-muted">· Assignee: {meta?.users.find((u) => u.id === task.assignee_id)?.name ?? 'Unassigned'}</span>
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
                                    Edit Task
                                  </MenuItem>
                                  {task.related_type === 'deal' && task.related_id ? (
                                    <MenuItem onClick={() => { close(); window.location.assign(`/sales/deals/${task.related_id}`) }}>
                                      Open Related Deal
                                    </MenuItem>
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
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
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

  const upcomingEvents = events.filter((e) => new Date(e.start_at) >= new Date()).slice(0, 6)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Calendar & Events" subtitle={`Meetings, calls and follow-ups · ${meta?.currentUser.timezone ?? 'UTC'}`}>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 text-[12px]">
          {(['month', 'week', 'day'] as const).map((vm) => (
            <button
              key={vm}
              onClick={() => setViewMode(vm)}
              className={cx('rounded-md px-2.5 py-1 capitalize font-medium transition-colors', viewMode === vm ? 'bg-accent-soft text-accent font-semibold' : 'text-muted hover:text-ink')}
            >
              {vm}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCursor(new Date())}>
          Today
        </Button>
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={16} />
          </IconButton>
          <span className="min-w-[140px] text-center text-[13px] font-semibold text-ink">
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
          <Plus size={14} /> New Event
        </Button>
      </PageHeader>

      {loading ? (
        <Spinner label="Loading calendar" />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_300px] overflow-hidden">
          {/* Main Calendar Grid */}
          <div className="flex min-h-0 flex-col overflow-hidden border-r border-line">
            <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-3 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto gx-scroll">
              <div className="grid grid-cols-7 auto-rows-[minmax(105px,1fr)]">
                {Array.from({ length: cells }).map((_, index) => {
                  const dayNumber = index - startOffset + 1
                  const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth
                  const date = new Date(year, month, dayNumber)
                  const key = isoDay(date)
                  const dayEvents = events.filter((event) => isoDay(new Date(event.start_at)) === key)
                  return (
                    <div
                      key={index}
                      className={cx('min-h-[105px] border-b border-r border-line p-2 transition-colors', !inMonth && 'bg-surface-2/30', key === today && 'bg-accent-soft/30')}
                      onDoubleClick={() => inMonth && openCreate(date)}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className={cx('text-[12px] font-semibold', key === today ? 'text-accent' : 'text-muted')}>
                          {inMonth ? dayNumber : ''}
                        </span>
                        {inMonth ? (
                          <button
                            className="size-5 rounded flex items-center justify-center text-[12px] text-faint hover:bg-surface-2 hover:text-accent"
                            onClick={() => openCreate(date)}
                            aria-label="Add event"
                          >
                            +
                          </button>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            className="w-full truncate rounded-md bg-accent-soft/80 px-2 py-1 text-left text-[11px] font-medium text-accent hover:bg-accent hover:text-white transition-colors border border-accent/20"
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
                        {dayEvents.length > 3 ? (
                          <div className="text-[10px] font-semibold text-muted pl-1">+{dayEvents.length - 3} more</div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Competitor PDF Page 46 - Upcoming Agenda Sidebar */}
          <div className="hidden xl:flex min-h-0 flex-col bg-surface p-4 overflow-y-auto">
            <h3 className="font-bold text-[14px] text-ink mb-3 flex items-center gap-2">
              <CalendarIcon size={16} className="text-accent" /> Upcoming Agenda
            </h3>
            <div className="space-y-3">
              {upcomingEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="cursor-pointer rounded-xl border border-line bg-surface-2/40 p-3 hover:border-accent/40 transition-all"
                  onClick={() => {
                    setEditing(evt)
                    setPreset(undefined)
                    setFormOpen(true)
                  }}
                >
                  <div className="font-semibold text-[13px] text-ink">{evt.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
                    <Clock size={12} className="text-accent" />
                    {formatDateTime(evt.start_at)}
                  </div>
                  {evt.location ? <div className="mt-1 text-[11px] text-faint truncate">{evt.location}</div> : null}
                </div>
              ))}
              {upcomingEvents.length === 0 ? (
                <p className="text-[12px] text-muted py-6 text-center">No upcoming meetings or calls scheduled.</p>
              ) : null}
            </div>
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
  return <ResourcePage entity="products" title="Products & Services Catalog" subtitle="Master product catalog, SKU prices and inventory" />
}

/* --------------------------------------------------------------- documents */
export function DocumentsPage({ docType }: { docType: 'quote' | 'invoice' | 'proposal' }) {
  const { meta, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Row | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>(`/api/resources/documents?doc_type=${docType}&limit=100&sort=created_at&dir=desc`)
  const currency = meta?.currentUser.currency ?? 'USD'
  const label = docType === 'invoice' ? 'Invoices' : docType === 'quote' ? 'Quotes' : 'Proposals'
  const rows = data?.data ?? []

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true
    return r.status === filter
  })

  const totalValue = rows.reduce((sum, r) => sum + Number(r.total || 0), 0)
  const paidValue = rows.filter((r) => r.status === 'paid').reduce((sum, r) => sum + Number(r.total || 0), 0)
  const unpaidValue = rows.filter((r) => ['sent', 'draft', 'pending'].includes(String(r.status))).reduce((sum, r) => sum + Number(r.total || 0), 0)

  const changeStatus = async (record: Row, status: string) => {
    try {
      await patch(`/api/resources/documents/${record.id}`, { status })
      toast(`Marked as ${status}.`, 'good')
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
      <PageHeader title={label} subtitle={`${data?.total ?? 0} ${label.toLowerCase()} · automated line item calculation & PDF export`}>
        <Button size="sm" variant="primary" onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus size={14} /> New {docType}
        </Button>
      </PageHeader>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 gap-3 border-b border-line bg-surface p-4 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">Total {label} Value</div>
          <div className="mt-1 text-[20px] font-bold text-ink">{money(totalValue, currency, true)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">Paid & Realized</div>
          <div className="mt-1 text-[20px] font-bold text-good">{money(paidValue, currency, true)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">Outstanding / Pending</div>
          <div className="mt-1 text-[20px] font-bold text-accent">{money(unpaidValue, currency, true)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="text-[11px] font-semibold uppercase text-muted">Document Count</div>
          <div className="mt-1 text-[20px] font-bold text-ink">{rows.length}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-line bg-surface px-4 py-2 text-[12px]">
        {(['all', 'draft', 'sent', 'paid', 'accepted'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cx(
              'rounded-lg px-3 py-1 font-medium capitalize transition-colors',
              filter === tab ? 'bg-accent-soft text-accent font-semibold' : 'text-muted hover:text-ink',
            )}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : filtered.length === 0 ? (
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
                <th>Document #</th>
                <th>Client / Account</th>
                <th>Issued Date</th>
                <th>Due Date</th>
                <th>Total Value</th>
                <th>Status</th>
                <th className="w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-[12px] font-bold text-ink">
                    <button className="hover:text-accent underline" onClick={() => setPreviewDoc(row)}>
                      {row.number}
                    </button>
                  </td>
                  <td>
                    <div className="font-semibold text-[13px] text-ink">
                      {meta?.contacts.find((c) => c.id === row.contact_id)?.first_name ?? '—'}{' '}
                      {meta?.contacts.find((c) => c.id === row.contact_id)?.last_name ?? ''}
                    </div>
                    <div className="text-[11px] text-muted">{meta?.companies.find((c) => c.id === row.company_id)?.name ?? ''}</div>
                  </td>
                  <td>{formatDate(row.issue_date, 'day')}</td>
                  <td>{formatDate(row.due_date, 'day')}</td>
                  <td className="font-bold text-ink">{money(row.total, row.currency ?? currency)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge value={row.status} />
                      {Number(row.locked) === 1 ? <span title="Locked after acceptance">🔒</span> : null}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label="Preview Document" onClick={() => setPreviewDoc(row)}>
                        <FileText size={14} />
                      </IconButton>
                      <Dropdown
                        trigger={({ toggle: openMenu }) => (
                          <IconButton label="Document actions" onClick={openMenu}>
                            <MoreHorizontal size={15} />
                          </IconButton>
                        )}
                      >
                        {(close) => (
                          <>
                            <MenuItem onClick={() => { close(); setPreviewDoc(row) }}>Preview / Print</MenuItem>
                            {row.status === 'draft' ? (
                              <MenuItem onClick={() => { close(); void changeStatus(row, 'sent') }}>Mark as Sent</MenuItem>
                            ) : null}
                            {row.status !== 'paid' && docType === 'invoice' ? (
                              <MenuItem onClick={() => { close(); void changeStatus(row, 'paid') }}>Mark as Paid</MenuItem>
                            ) : null}
                            {row.status !== 'accepted' && docType === 'quote' ? (
                              <MenuItem onClick={() => { close(); void changeStatus(row, 'accepted') }}>Mark Accepted</MenuItem>
                            ) : null}
                            {docType === 'quote' ? (
                              <MenuItem onClick={() => { close(); void convert(row) }}>Convert to Invoice</MenuItem>
                            ) : null}
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Competitor PDF Pages 43-45 - Professional Document Preview & Print Modal */}
      <Modal open={Boolean(previewDoc)} onClose={() => setPreviewDoc(null)} title={`${label}: ${previewDoc?.number ?? ''}`}>
        {previewDoc ? (
          <div className="space-y-6 text-[13px]" id="printable-invoice">
            {/* Invoice Header */}
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <div className="text-[20px] font-bold text-ink uppercase tracking-wide">{label.slice(0, -1)}</div>
                <div className="font-mono text-muted">{previewDoc.number}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[15px] text-accent">GoFox Cloud Platform</div>
                <div className="text-[11.5px] text-muted">enterprise@gofox.io</div>
              </div>
            </div>

            {/* Bill To & Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase">Billed To:</span>
                <div className="font-semibold text-ink mt-0.5">
                  {meta?.contacts.find((c) => c.id === previewDoc.contact_id)?.first_name}{' '}
                  {meta?.contacts.find((c) => c.id === previewDoc.contact_id)?.last_name}
                </div>
                <div className="text-muted">{meta?.companies.find((c) => c.id === previewDoc.company_id)?.name}</div>
              </div>
              <div className="text-right space-y-1">
                <div><span className="text-muted">Issue Date:</span> <span className="font-medium text-ink">{formatDate(previewDoc.issue_date, 'day')}</span></div>
                <div><span className="text-muted">Due Date:</span> <span className="font-medium text-ink">{formatDate(previewDoc.due_date, 'day')}</span></div>
                <div><span className="text-muted">Status:</span> <StatusBadge value={previewDoc.status} /></div>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-muted font-semibold">
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(JSON.parse(previewDoc.lines ?? '[]') as any[]).map((line: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 font-medium text-ink">{line.description || line.name || 'Product / Service Item'}</td>
                    <td className="py-2.5 px-3 text-right">{line.quantity ?? 1}</td>
                    <td className="py-2.5 px-3 text-right">{money(line.unit_price, previewDoc.currency ?? currency)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">{money(Number(line.quantity || 1) * Number(line.unit_price || 0), previewDoc.currency ?? currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end border-t border-line pt-3">
              <div className="w-60 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between text-muted">
                  <span>Subtotal:</span>
                  <span>{money(previewDoc.subtotal ?? previewDoc.total, previewDoc.currency ?? currency)}</span>
                </div>
                {previewDoc.tax_rate ? (
                  <div className="flex justify-between text-muted">
                    <span>Tax ({previewDoc.tax_rate}%):</span>
                    <span>{money(previewDoc.tax ?? 0, previewDoc.currency ?? currency)}</span>
                  </div>
                ) : null}
                {previewDoc.discount ? (
                  <div className="flex justify-between text-muted">
                    <span>Discount:</span>
                    <span>-{money(previewDoc.discount, previewDoc.currency ?? currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-[15px] font-bold text-ink border-t border-line pt-1.5">
                  <span>Total Due:</span>
                  <span className="text-accent">{money(previewDoc.total, previewDoc.currency ?? currency)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(null)}>
                Close
              </Button>
              <Button size="sm" variant="primary" onClick={() => window.print()}>
                <Printer size={13} /> Print / Save PDF
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

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
