import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowLeft,
  ArrowRight,
  Bold,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Columns,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Mail,
  Maximize2,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Rss,
  Search,
  Send,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Split,
  Star,
  Trash2,
  Underline,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { del, patch, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDate, formatDateTime, number, titleCase } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormRow,
  IconButton,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  TableSkeleton,
  cx,
} from '../components/ui'

/* =========================================================================
   1. CAMPAIGNS HUB PAGE (Screenshots 1, 2, 11, 12)
   ========================================================================= */

export function CampaignsPage() {
  const { me, meta, toast } = useApp()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'archived' | 'trash'>('active')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'all' | 'custom'>('today')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [sortField, setSortField] = useState<'created_at' | 'name'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Create Campaign Modal state (Screenshot 2)
  const [newChannel, setNewChannel] = useState<'email' | 'sms' | 'whatsapp'>('email')
  const [newType, setNewType] = useState<'regular' | 'ab' | 'rss'>('regular')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Marketing')
  const [creating, setCreating] = useState(false)

  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>(
    '/api/resources/campaigns?limit=100&sort=created_at&dir=desc',
  )

  const campaigns = useMemo(() => data?.data ?? [], [data])

  // Aggregate metrics for top cards (Screenshot 1 & 12)
  const totalCampaigns = campaigns.length
  const totalSent = campaigns.reduce((acc, c) => acc + (Number(c.sent_count) || (c.status === 'sent' ? 1 : 0)), 0)
  const totalOpened = campaigns.reduce((acc, c) => acc + (Number(c.opened) || 0), 0)
  const totalCompleted = campaigns.filter((c) => c.status === 'sent' || c.status === 'completed').length

  // Filter campaigns by tab
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      // Tab filter
      if (activeTab === 'completed' && c.status !== 'sent' && c.status !== 'completed') return false
      if (activeTab === 'active' && (c.status === 'archived' || c.status === 'cancelled' || c.status === 'deleted')) return false
      if (activeTab === 'archived' && c.status !== 'archived') return false
      if (activeTab === 'trash' && c.status !== 'deleted' && !c.deleted_at) return false

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchName = String(c.name ?? '').toLowerCase().includes(query)
        const matchCategory = String(c.category ?? '').toLowerCase().includes(query)
        if (!matchName && !matchCategory) return false
      }

      return true
    })
  }, [campaigns, activeTab, search])

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newName.trim()) {
      toast('Please enter a campaign name.', 'bad')
      return
    }
    setCreating(true)
    try {
      const userEmail = me?.email || 'vishnu.m0827@gmail.com'
      const userName = me?.name || 'Vishnu'
      const payload: Row = {
        name: newName.trim(),
        channel: newChannel,
        type: newType === 'regular' ? 'broadcast' : newType,
        category: newCategory,
        sender: `${userName} <${userEmail}>`,
        subject: '',
        content: '<p>Hi {{firstName}},</p><p>We are excited to share our latest updates with you.</p>',
        status: 'draft',
      }
      const res = await post<{ record: Row }>('/api/resources/campaigns', payload)
      toast('Campaign draft created.', 'good')
      setCreateModalOpen(false)
      setNewName('')
      navigate(`/marketing/campaigns/${res.record.id}/wizard?step=1`)
    } catch (err: any) {
      toast(err?.message ?? 'Failed to create campaign.', 'bad')
    } finally {
      setCreating(false)
    }
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const handleDelete = async (id: string) => {
    try {
      await del(`/api/resources/campaigns/${id}`)
      toast('Campaign deleted successfully.', 'good')
      setDeletingId(null)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to delete campaign.', 'bad')
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    try {
      await post('/api/resources/campaigns/bulk', { action: 'delete', ids: Array.from(selectedIds) })
      toast(`${selectedIds.size} campaign(s) deleted.`, 'good')
      setSelectedIds(new Set())
      setBulkDeleting(false)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to delete campaigns.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface font-sans text-ink">
      {/* Top Breadcrumb & Title */}
      <div className="border-b border-line bg-surface px-6 py-4">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <Link to="/" className="hover:text-accent">Home</Link>
          <span>›</span>
          <span className="font-medium text-ink">Campaigns</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold tracking-tight text-ink">Campaigns</h1>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {filteredCampaigns.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reload()}
              className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen?.()
                } else {
                  document.exitFullscreen?.()
                }
              }}
              className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink transition-colors"
              title="Toggle Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-6">
        {/* Top 4 KPI Metrics Cards (Screenshots 1 & 12) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Card 1: Campaigns */}
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <Mail size={22} />
            </div>
            <div>
              <div className="text-[12px] font-medium text-muted">Campaigns</div>
              <div className="text-[22px] font-bold text-ink">{totalCampaigns}</div>
            </div>
          </div>

          {/* Card 2: Sent */}
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Send size={20} />
            </div>
            <div>
              <div className="text-[12px] font-medium text-muted">Sent</div>
              <div className="text-[22px] font-bold text-ink">{totalSent}</div>
            </div>
          </div>

          {/* Card 3: Opened */}
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <Eye size={22} />
            </div>
            <div>
              <div className="text-[12px] font-medium text-muted">Opened</div>
              <div className="text-[22px] font-bold text-ink">{totalOpened}</div>
            </div>
          </div>

          {/* Card 4: Completed */}
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="text-[12px] font-medium text-muted">Completed</div>
              <div className="text-[22px] font-bold text-ink">{totalCompleted}</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Screenshots 1 & 12) */}
        <div className="mt-6 flex border-b border-line text-[13px]">
          {(['active', 'completed', 'archived', 'trash'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cx(
                'relative pb-3 pt-1 px-4 font-medium transition-colors capitalize',
                activeTab === t
                  ? 'border-b-2 border-orange-500 font-semibold text-orange-600 dark:text-orange-400'
                  : 'text-muted hover:text-ink',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Toolbar: Search, Sort, Date, Filter, Create (Screenshots 1 & 12) */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search campaigns"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-[12.5px] text-ink placeholder:text-muted focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Sort Dropdown */}
            <button
              onClick={() => {
                setSortField((f) => (f === 'created_at' ? 'name' : 'created_at'))
                setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
              }}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
            >
              <SlidersHorizontal size={13} />
              <span>Sort By</span>
              <ChevronDown size={13} />
            </button>

            {/* Date Selector Pill */}
            <button
              onClick={() => setDateFilter((d) => (d === 'today' ? 'all' : 'today'))}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
            >
              <span>{dateFilter === 'today' ? 'Nov 19' : 'All time'}</span>
              <ChevronDown size={13} />
            </button>

            {/* Filter */}
            <button className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink">
              <Filter size={13} />
              <span>Filter</span>
            </button>

            {/* Manage Columns */}
            <button className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink">
              <Columns size={13} />
              <span>Manage Columns</span>
            </button>
          </div>

          {/* Right Orange Create Campaign Button */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-700 active:scale-[0.98] transition"
          >
            <Plus size={15} />
            <span>Create campaign</span>
          </button>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-[12.5px]">
            <span className="font-semibold text-orange-700 dark:text-orange-400">
              {selectedIds.size} campaign{selectedIds.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1 text-xs text-muted hover:text-ink font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleting(true)}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition"
              >
                <Trash2 size={12} />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Content Area: Table vs Empty State */}
        <div className="mt-4">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : filteredCampaigns.length === 0 ? (
            /* EXACT Empty State from Screenshot 1 & 11 */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-20 text-center">
              {/* Concentric rings graphic */}
              <div className="relative mb-5 flex size-36 items-center justify-center rounded-full bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex size-24 items-center justify-center rounded-full bg-orange-100/60 dark:bg-orange-900/30">
                  <div className="flex size-14 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-orange-200/50">
                    <Megaphone size={24} className="text-orange-500" />
                  </div>
                </div>
                {/* Green check badge at top left */}
                <div className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <Check size={13} />
                </div>
                {/* Orange envelope badge at bottom right */}
                <div className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
                  <Mail size={12} />
                </div>
              </div>

              <h2 className="text-[17px] font-bold text-ink">
                No campaign activity on 19 Nov 2026
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                Pick another date, or choose All to see every campaign.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="mt-5 flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-700 transition"
              >
                <Plus size={14} /> Create your first campaign
              </button>
            </div>
          ) : (
            /* Populated Campaigns Table (Screenshot 12) */
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-line"
                        checked={selectedIds.size === filteredCampaigns.length && filteredCampaigns.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(filteredCampaigns.map((c) => c.id)))
                          } else {
                            setSelectedIds(new Set())
                          }
                        }}
                      />
                    </th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Recipients</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-12 px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredCampaigns.map((c) => {
                    const isSelected = selectedIds.has(c.id)
                    const sentCount = Number(c.sent_count) || (c.status === 'sent' ? 1 : 0)
                    const deliveredCount = Number(c.delivered) || (c.status === 'sent' ? 1 : 0)
                    const openRate = sentCount > 0 ? ((Number(c.opened) || 0) / sentCount) * 100 : 0
                    const bounceRate = sentCount > 0 ? ((Number(c.bounced) || 0) / sentCount) * 100 : 0
                    const deliveredRate = sentCount > 0 ? (deliveredCount / sentCount) * 100 : 100
                    const clickRate = sentCount > 0 ? ((Number(c.clicked) || 0) / sentCount) * 100 : 0

                    return (
                      <tr key={c.id} className={cx('hover:bg-surface-2/40 transition-colors', isSelected && 'bg-orange-500/5')}>
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = new Set(selectedIds)
                              if (e.target.checked) next.add(c.id)
                              else next.delete(c.id)
                              setSelectedIds(next)
                            }}
                            className="rounded border-line"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <Link
                              to={`/marketing/campaigns/${c.id}`}
                              className="font-semibold text-ink hover:text-orange-600 transition-colors line-clamp-1"
                            >
                              {c.name}
                            </Link>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                              <Star size={11} className="text-muted hover:text-amber-500 cursor-pointer" />
                              <span>{formatDate(c.created_at)}</span>
                              <span>·</span>
                              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-muted">
                                {c.category || 'Marketing'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-[12px] font-medium text-ink capitalize">
                            {c.channel || 'Email'} - {c.type === 'broadcast' ? 'Regular' : c.type || 'Regular'}
                          </div>
                          <div className="text-[11px] text-muted">{c.category || 'Marketing'}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          {/* Metrics pill row matching Screenshot 12 */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded border border-line bg-surface-2/70 px-2 py-0.5 text-[11px] font-semibold text-ink">
                              {sentCount} Sent
                            </span>
                            <span className="rounded border border-line bg-surface-2/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                              {openRate.toFixed(1)}% Opened
                            </span>
                            <span className="rounded border border-line bg-surface-2/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                              {bounceRate.toFixed(1)}% Bounced
                            </span>
                            <span className="rounded border border-line bg-surface-2/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                              0.0% Unsubscribe
                            </span>
                            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {deliveredRate.toFixed(1)}% Delivered
                            </span>
                            <span className="rounded border border-line bg-surface-2/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                              {clickRate.toFixed(1)}% Clicked
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[12px] text-muted">
                          {c.audience_count || sentCount || 1} recipient{Number(c.audience_count) === 1 ? '' : 's'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {c.status === 'sent' || c.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Sent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/marketing/campaigns/${c.id}`}
                              className="flex size-7 items-center justify-center rounded hover:bg-surface-2 text-muted hover:text-ink"
                              title="View Analytics"
                            >
                              <Eye size={14} />
                            </Link>
                            <Link
                              to={`/marketing/campaigns/${c.id}/wizard?step=1`}
                              className="flex size-7 items-center justify-center rounded hover:bg-surface-2 text-muted hover:text-ink"
                              title="Edit in Wizard"
                            >
                              <FileText size={14} />
                            </Link>
                            <button
                              onClick={() => setDeletingId(c.id)}
                              className="flex size-7 items-center justify-center rounded hover:bg-rose-50 text-muted hover:text-rose-600"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="border-t border-line bg-surface-2/40 px-4 py-2.5 text-[11.5px] text-muted">
                Showing {filteredCampaigns.length} campaign{filteredCampaigns.length === 1 ? '' : 's'} · You've reached the end
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deletingId)}
        title="Delete this campaign?"
        message="This campaign and its recipient activity will be moved to trash. You can restore it from Trash if needed."
        onCancel={() => setDeletingId(null)}
        onConfirm={() => deletingId && void handleDelete(deletingId)}
      />
      <ConfirmDialog
        open={bulkDeleting}
        title={`Delete ${selectedIds.size} selected campaign(s)?`}
        message="All selected campaigns will be moved to trash."
        confirmLabel="Delete Selected"
        onCancel={() => setBulkDeleting(false)}
        onConfirm={() => void handleBulkDelete()}
      />

      {/* CREATE CAMPAIGN MODAL (Screenshot 2) */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create campaign"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-lg border border-line px-4 py-2 text-[12.5px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={() => void handleCreateSubmit()}
              className="rounded-lg bg-orange-600 px-5 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition"
            >
              {creating ? 'Creating…' : 'Continue'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Channel Selection (Screenshot 2) */}
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-ink">Channel</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setNewChannel('email')}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-left transition',
                  newChannel === 'email'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold ring-1 ring-orange-500'
                    : 'border-line bg-surface text-ink hover:bg-surface-2',
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white">
                  <Mail size={14} />
                </span>
                <span className="text-[13px]">Email</span>
              </button>

              <button
                type="button"
                onClick={() => setNewChannel('sms')}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-left transition',
                  newChannel === 'sms'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold ring-1 ring-orange-500'
                    : 'border-line bg-surface text-ink hover:bg-surface-2',
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500 text-white">
                  <MessageSquare size={14} />
                </span>
                <span className="text-[13px]">SMS</span>
              </button>

              <button
                type="button"
                onClick={() => setNewChannel('whatsapp')}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-left transition',
                  newChannel === 'whatsapp'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold ring-1 ring-orange-500'
                    : 'border-line bg-surface text-ink hover:bg-surface-2',
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500 text-white">
                  <MessageCircle size={14} />
                </span>
                <span className="text-[13px]">WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Campaign Type Selection (Screenshot 2) */}
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-ink">Campaign type</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setNewType('regular')}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-left transition',
                  newType === 'regular'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold ring-1 ring-orange-500'
                    : 'border-line bg-surface text-ink hover:bg-surface-2',
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white">
                  <Mail size={14} />
                </span>
                <span className="text-[13px]">Regular</span>
              </button>

              <button
                type="button"
                onClick={() => setNewType('ab')}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-left transition',
                  newType === 'ab'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold ring-1 ring-orange-500'
                    : 'border-line bg-surface text-ink hover:bg-surface-2',
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500 text-white">
                  <Split size={14} />
                </span>
                <span className="text-[13px]">A/B</span>
              </button>

              <button
                type="button"
                onClick={() => setNewType('rss')}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-left transition',
                  newType === 'rss'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold ring-1 ring-orange-500'
                    : 'border-line bg-surface text-ink hover:bg-surface-2',
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <Rss size={14} />
                </span>
                <span className="text-[13px]">RSS to Email</span>
              </button>
            </div>
          </div>

          {/* Campaign Name Input */}
          <div>
            <label className="mb-1 block text-[13px] font-semibold text-ink">
              Campaign name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. April product update"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink placeholder:text-muted focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <p className="mt-1 text-[11px] text-muted">Internal only — your recipients won't see this.</p>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="mb-1 block text-[13px] font-semibold text-ink">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="Marketing">Marketing</option>
              <option value="Product">Product</option>
              <option value="Sales">Sales</option>
              <option value="Newsletter">Newsletter</option>
              <option value="Announcement">Announcement</option>
            </select>
            <p className="mt-1 text-[11px] text-muted">Helps you filter campaigns later. You can change this anytime.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* =========================================================================
   2. HIGH-END 5-STEP CAMPAIGN WIZARD (Screenshots 3 - 10)
   ========================================================================= */

const WIZARD_STEP_TITLES = [
  { step: 1, title: 'Details', subtitle: 'Name & sender' },
  { step: 2, title: 'Recipients', subtitle: 'Choose audience' },
  { step: 3, title: 'Content', subtitle: 'Configure & Write' },
  { step: 4, title: 'Review', subtitle: 'Spam & checks' },
  { step: 5, title: 'Send', subtitle: 'Launch batch' },
]

export function CampaignWizardPage({ campaignId }: { campaignId?: string } = {}) {
  const { me, meta, toast } = useApp()
  const navigate = useNavigate()

  // Read step from URL query param ?step=1..5
  const [currentStep, setCurrentStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [launchNotification, setLaunchNotification] = useState<string | null>(null)
  const [completeNotification, setCompleteNotification] = useState<string | null>(null)

  // Campaign Form State matching screenshots 3-10
  const [form, setForm] = useState<Row>({
    id: campaignId || '',
    name: 'Followup Campaign',
    category: 'Marketing',
    channel: 'email',
    from_name: me?.name || 'Vishnu',
    from_email: me?.email || 'vishnu.m0827@gmail.com',
    reply_to: '',
    tracking_enabled: true,
    list_id: '',
    selected_lists: [] as string[],
    subject: 'hi',
    preview_text: '',
    content: '<p>Write your email message...</p>',
    template_id: '',
    // Step 5 controls
    send_timing: 'now', // now | schedule
    timezone: 'Asia/Calcutta',
    send_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    auto_increment: false,
    limit_weekly: false,
    max_per_hour: 100,
    pause_seconds: 0,
    test_email: '',
  })

  // Load existing campaign if campaignId is passed
  const existing = useFetch<{ record: Row }>(campaignId ? `/api/resources/campaigns/${campaignId}` : null)
  useEffect(() => {
    if (existing.data?.record) {
      const rec = existing.data.record
      setForm((prev) => ({
        ...prev,
        ...rec,
        from_name: prev.from_name || (rec.sender?.split('<')[0]?.trim() ?? 'Vishnu'),
        from_email: prev.from_email || (rec.sender?.match(/<([^>]+)>/)?.[1] ?? me?.email ?? 'vishnu.m0827@gmail.com'),
      }))
    }
  }, [existing.data, me?.email])

  // Sync step from window.location.search (?step=N)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = parseInt(params.get('step') || '1', 10)
    if (s >= 1 && s <= 5) setCurrentStep(s)
  }, [])

  const setStepParam = (s: number) => {
    setCurrentStep(s)
    const url = new URL(window.location.href)
    url.searchParams.set('step', String(s))
    window.history.pushState({}, '', url.toString())
  }

  const setField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Fetch real connected integrations to dynamically populate real mailboxes
  const integrationsFetch = useFetch<{ integrations: Row[] }>('/api/integrations')
  const connectedEmailAccounts = useMemo(() => {
    const list = (integrationsFetch.data?.integrations ?? []).filter((i) => i.status === 'connected')
    const emails: { email: string; label: string }[] = []
    const gmail = list.find((i) => i.provider === 'gmail')
    if (gmail && gmail.account) {
      emails.push({ email: String(gmail.account), label: `${gmail.account} (Connected via Gmail OAuth)` })
    }
    const smtp = list.find((i) => i.provider === 'smtp')
    if (smtp && smtp.account) {
      emails.push({ email: String(smtp.account), label: `${smtp.account} (Connected via SMTP)` })
    }
    if (me?.email && !emails.some((e) => e.email.toLowerCase() === me.email.toLowerCase())) {
      emails.push({ email: me.email, label: `${me.email} (Your user account)` })
    }
    return emails
  }, [integrationsFetch.data, me?.email])

  useEffect(() => {
    if (connectedEmailAccounts.length > 0 && (!form.from_email || form.from_email === 'vishnu.m0827@gmail.com' || form.from_email === 'owner@gofox.dev')) {
      setForm((prev) => ({
        ...prev,
        from_email: connectedEmailAccounts[0].email,
        from_name: prev.from_name || me?.name || 'Sender',
      }))
    }
  }, [connectedEmailAccounts, me?.name])

  // Audience list fetching from real database
  const lists = meta?.lists ?? []
  const selectedListObj = useMemo(() => {
    if (form.list_id === 'all-contacts' || !form.list_id) {
      return { id: 'all-contacts', name: 'All Workspace Contacts', contact_count: meta?.contacts?.length || 0 }
    }
    return lists.find((l) => l.id === form.list_id) || { id: form.list_id, name: 'Contact List', contact_count: 0 }
  }, [form.list_id, lists, meta?.contacts])

  const audienceCount = useMemo(() => {
    if (form.list_id === 'all-contacts' || !form.list_id) {
      return meta?.contacts?.length || 0
    }
    const found = lists.find((l) => l.id === form.list_id)
    return found ? Number(found.contact_count || 0) : (meta?.contacts?.length || 0)
  }, [form.list_id, lists, meta?.contacts])

  // Handle Launch Campaign (Step 5)
  const handleLaunchCampaign = async () => {
    setBusy(true)
    try {
      // 1. Ensure campaign record is saved
      let targetId = form.id || campaignId
      const payload: Row = {
        name: form.name,
        category: form.category,
        channel: form.channel,
        sender: `${form.from_name} <${form.from_email}>`,
        subject: form.subject,
        content: form.content,
        list_id: form.list_id || (lists.length > 0 ? lists[0].id : 'all-contacts'),
        status: 'draft',
      }
      if (targetId) {
        await patch(`/api/resources/campaigns/${targetId}`, payload)
      } else {
        const created = await post<{ record: Row }>('/api/resources/campaigns', payload)
        targetId = created.record.id
        setForm((prev) => ({ ...prev, id: targetId }))
      }

      // 2. Dispatch the campaign
      const sendRes = await post<{ audience: number; suppressed: number }>(`/api/campaigns/${targetId}/send`)

      // 3. Show Chrome-style notification toasts (Screenshot 11)
      setLaunchNotification(`Campaign launched\n${form.name}: Sending today's limit (${sendRes.audience || 1} email)`)
      setTimeout(() => {
        setLaunchNotification(null)
        setCompleteNotification(`Campaign completed\n${form.name}: All recipients finished`)
      }, 1500)

      setTimeout(() => {
        navigate(`/marketing/campaigns/${targetId}`)
      }, 3000)
    } catch (err: any) {
      toast(err?.message ?? 'Could not launch campaign.', 'bad')
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-surface font-sans text-ink">
      {/* Chrome Style Native Notifications Overlay (Screenshot 11) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2.5">
        {launchNotification ? (
          <div className="pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white font-bold text-[11px]">
              GF
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase text-slate-400">Google Chrome · oknai5t.gofox.io</div>
              <div className="text-[13px] font-bold text-white">Campaign launched</div>
              <div className="mt-0.5 text-[11.5px] text-slate-300">
                {form.name}: Sending today's limit ({audienceCount} email)
              </div>
            </div>
            <button onClick={() => setLaunchNotification(null)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
        ) : null}

        {completeNotification ? (
          <div className="pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-[11px]">
              <Check size={14} />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase text-slate-400">Google Chrome · oknai5t.gofox.io</div>
              <div className="text-[13px] font-bold text-white">Campaign completed</div>
              <div className="mt-0.5 text-[11.5px] text-slate-300">
                {form.name}: All recipients finished
              </div>
            </div>
            <button onClick={() => setCompleteNotification(null)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Top Bar: Back, Name, Breadcrumb, Exit, Fullscreen (Screenshots 3-10) */}
      <div className="border-b border-line bg-surface px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/marketing/campaigns')}
              className="flex size-8 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm hover:bg-orange-700 transition"
              title="Back to Campaigns"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-[17px] font-bold text-ink leading-tight">{form.name || 'Untitled Campaign'}</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <span>Home</span>
                <span>›</span>
                <span>Campaigns</span>
                <span>›</span>
                <span>{form.name}</span>
                <span>·</span>
                <span className="capitalize">{form.channel}</span>
                <span>·</span>
                <span>Regular</span>
                <span>·</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Saved</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/marketing/campaigns')}
              className="rounded-lg bg-orange-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-orange-700 transition"
            >
              Exit
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex size-7 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-ink"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
                else document.exitFullscreen?.()
              }}
              className="flex size-7 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-ink"
              title="Fullscreen"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* 5-Step Stepper Cards (Screenshots 3-10) */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {WIZARD_STEP_TITLES.map((item) => {
            const isCompleted = item.step < currentStep
            const isActive = item.step === currentStep
            return (
              <button
                key={item.step}
                onClick={() => setStepParam(item.step)}
                className={cx(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                  isActive
                    ? 'border-orange-500 bg-orange-500/10 shadow-sm ring-1 ring-orange-500'
                    : isCompleted
                    ? 'border-line bg-surface text-ink hover:bg-surface-2'
                    : 'border-line/60 bg-surface-2/40 text-muted opacity-80',
                )}
              >
                <span
                  className={cx(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                    isActive
                      ? 'bg-orange-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-surface-3 text-muted',
                  )}
                >
                  {isCompleted ? <Check size={14} /> : item.step}
                </span>
                <div className="min-w-0">
                  <div className={cx('text-[12.5px] font-semibold truncate', isActive ? 'text-orange-600 dark:text-orange-400' : 'text-ink')}>
                    {item.step}. {item.title} {isActive ? '·' : ''}
                  </div>
                  <div className="text-[10.5px] text-muted truncate">
                    {isCompleted ? 'Configured' : item.subtitle}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-6">
        <div className="mx-auto max-w-4xl">
          {/* STEP 1: DETAILS (Screenshot 3) */}
          {currentStep === 1 && (
            <div className="space-y-6 rounded-2xl border border-line bg-surface p-7 shadow-sm">
              <div>
                <h2 className="text-[17px] font-bold text-ink">Campaign details</h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-ink">
                    Campaign name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Followup Campaign"
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-ink">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="Marketing">Marketing</option>
                    <option value="Product">Product</option>
                    <option value="Sales">Sales</option>
                    <option value="Newsletter">Newsletter</option>
                    <option value="Onboarding">Onboarding</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-ink">
                    Who is it from? <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.from_name}
                    onChange={(e) => setField('from_name', e.target.value)}
                    placeholder="Sender name (e.g. Vishnu)"
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-ink">
                    Sender email <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.from_email}
                    onChange={(e) => setField('from_email', e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {connectedEmailAccounts.map((opt) => (
                      <option key={opt.email} value={opt.email}>
                        {opt.label}
                      </option>
                    ))}
                    {connectedEmailAccounts.length === 0 ? (
                      <option value={me?.email || 'owner@gofox.dev'}>
                        {me?.email || 'owner@gofox.dev'}
                      </option>
                    ) : null}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-semibold text-ink">Reply to</label>
                <input
                  type="text"
                  value={form.reply_to}
                  onChange={(e) => setField('reply_to', e.target.value)}
                  placeholder="Replies go here (optional)"
                  className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Accordion: Tracking (optional) */}
              <div className="rounded-xl border border-line bg-surface-2/40 p-4">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between text-[13px] font-semibold text-ink">
                    <span>Tracking (optional)</span>
                    <ChevronDown size={14} className="text-muted group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-3 space-y-2 border-t border-line/60 pt-3 text-[12.5px] text-muted">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(form.tracking_enabled)}
                        onChange={(e) => setField('tracking_enabled', e.target.checked)}
                        className="rounded border-line"
                      />
                      <span>Track email opens with zero-pixel transparent tracker</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-line" />
                      <span>Track recipient link clicks and trigger workflow automation</span>
                    </label>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* STEP 2: RECIPIENTS (Screenshots 4 & 5) */}
          {currentStep === 2 && (
            <div className="space-y-6 rounded-2xl border border-line bg-surface p-7 shadow-sm">
              <div>
                <h2 className="text-[17px] font-bold text-ink">Who should get this?</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  Select primary target buckets or custom contact lists, and exclude suppressed segments.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* Left Column: Send to */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-ink">
                      Send to <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setField('list_id', '')}
                      className="text-[11.5px] font-medium text-orange-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  {/* LEAD BUCKETS */}
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Lead Buckets
                    </label>
                    <select className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-muted">
                      <option>Select lead buckets...</option>
                    </select>
                    <p className="mt-1 text-[11px] text-muted">No lead buckets yet. You can still pick a contact list.</p>
                  </div>

                  {/* CONTACT LISTS (Screenshot 5) */}
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Contact Lists
                    </label>
                    <select
                      value={form.list_id}
                      onChange={(e) => setField('list_id', e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-ink focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">Select contact lists...</option>
                      <option value="all-contacts">All Workspace Contacts ({meta?.contacts?.length ?? 0} contacts)</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.contact_count ?? 0} {Number(l.contact_count) === 1 ? 'contact' : 'contacts'})
                        </option>
                      ))}
                    </select>
                    {lists.length === 0 ? (
                      <div className="mt-2 rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5 p-3 text-[12px] text-muted leading-relaxed">
                        No custom lists found. You can target <strong>All Workspace Contacts</strong> ({meta?.contacts?.length ?? 0} contacts) or create segments in{' '}
                        <a href="/lists" className="font-semibold text-orange-600 hover:underline">
                          Marketing › Lists
                        </a>.
                      </div>
                    ) : null}
                  </div>

                  {/* Inline Add List */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="New list name"
                      className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-ink placeholder:text-muted focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      className="rounded-xl bg-orange-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-orange-700"
                    >
                      Add list
                    </button>
                  </div>
                </div>

                {/* Right Column: Don't send to & Safeguards */}
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[13px] font-semibold text-ink">Don't send to</label>
                    <select className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-muted">
                      <option>Add a list to skip</option>
                    </select>
                  </div>

                  {/* Deliverability Safeguards Box (Screenshot 4) */}
                  <div className="rounded-xl border border-line bg-surface-2/40 p-4 space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Deliverability Safeguards
                    </div>

                    <label className="flex items-start gap-2.5 text-[12px] cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded border-line" />
                      <div>
                        <div className="font-semibold text-ink">Skip people who unsubscribed</div>
                        <div className="text-[11px] text-muted">
                          Always on. Contacts with Unsubscribe or Not interested tags, plus the blocked list, are never emailed until an owner or admin unblocks them.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 text-[12px] cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded border-line" />
                      <div>
                        <div className="font-semibold text-ink">Skip bounced addresses</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 text-[12px] cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded border-line" />
                      <div>
                        <div className="font-semibold text-ink">Skip suppressed addresses</div>
                        <div className="text-[11px] text-muted">Always on. Blocked emails are never sent campaigns.</div>
                      </div>
                    </label>

                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <Shield size={14} className="shrink-0" />
                      <span>Automated compliance protection is active to prevent domain reputation damage.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONTENT (Screenshots 6 & 7) */}
          {currentStep === 3 && (
            <div className="space-y-6 rounded-2xl border border-line bg-surface p-7 shadow-sm">
              <div>
                <h2 className="text-[17px] font-bold text-ink">Write your email</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  Define your subject line, preview text, and compose or customize your email template.
                </p>
              </div>

              {/* Subject line input with Personalize dropdown */}
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-ink">
                  Subject line <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setField('subject', e.target.value)}
                    placeholder="Hey {{firstName}} {{lastName}}"
                    className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setField('subject', `${form.subject || ''} {{firstName}}`)}
                    className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[12px] font-medium text-ink hover:border-orange-500 hover:text-orange-600"
                  >
                    <Plus size={13} /> Personalize <ChevronDown size={12} />
                  </button>
                </div>
              </div>

              {/* Preview text */}
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-ink">Preview text</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.preview_text}
                    onChange={(e) => setField('preview_text', e.target.value)}
                    placeholder="Summarize your email message..."
                    className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setField('preview_text', `${form.preview_text || ''} {{company}}`)}
                    className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[12px] font-medium text-ink hover:border-orange-500 hover:text-orange-600"
                  >
                    <Plus size={13} /> Personalize <ChevronDown size={12} />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted">Shows next to the subject in the inbox</p>
              </div>

              {/* Write your email Composer Box (Screenshots 6 & 7) */}
              <div className="rounded-2xl border border-line bg-surface overflow-hidden">
                <div className="flex items-center justify-between border-b border-line bg-surface-2/40 px-4 py-3">
                  <div className="text-[13px] font-semibold text-ink">Write your email</div>
                  <button
                    type="button"
                    onClick={() => navigate('/marketing/emails')}
                    className="text-[12px] font-medium text-orange-600 hover:underline"
                  >
                    Change template
                  </button>
                </div>

                {/* Top formatting modes and action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <select className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink">
                      <option>Rich text</option>
                      <option>HTML Code</option>
                    </select>
                    <select
                      value={form.template_id}
                      onChange={(e) => {
                        setField('template_id', e.target.value)
                        const t = meta?.templates?.find((tmp) => tmp.id === e.target.value)
                        if (t) {
                          setField('subject', String(t.subject || t.name))
                          setField('content', String(t.html || t.body || form.content))
                        }
                      }}
                      className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink"
                    >
                      <option value="">Choose published template...</option>
                      {meta?.templates?.map((tmp) => (
                        <option key={tmp.id} value={tmp.id}>
                          {tmp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/marketing/emails')}
                      className="rounded-lg bg-orange-600 px-3.5 py-1 text-[12px] font-semibold text-white hover:bg-orange-700"
                    >
                      Design email
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-1 text-[12px] font-medium text-ink hover:bg-surface-2"
                    >
                      Write HTML
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-1 text-[12px] font-medium text-ink hover:bg-surface-2"
                    >
                      Start writing
                    </button>
                  </div>
                </div>

                {/* Rich text formatting bar (Screenshot 7) */}
                <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-2/20 px-3 py-1.5 text-muted">
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><Bold size={13} /></button>
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><Italic size={13} /></button>
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><Underline size={13} /></button>
                  <span className="mx-1 h-3.5 w-px bg-line" />
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><AlignLeft size={13} /></button>
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><AlignCenter size={13} /></button>
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><AlignRight size={13} /></button>
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><AlignJustify size={13} /></button>
                  <span className="mx-1 h-3.5 w-px bg-line" />
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><List size={13} /></button>
                  <button type="button" className="rounded p-1 hover:bg-surface-2 hover:text-ink"><ListOrdered size={13} /></button>
                  <span className="mx-1 h-3.5 w-px bg-line" />
                  <button
                    type="button"
                    onClick={() => setField('content', `${form.content || ''}<p>Hello {{firstName}},</p>`)}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium hover:bg-surface-2 hover:text-ink"
                  >
                    <span>+ Personalize</span>
                    <ChevronDown size={11} />
                  </button>
                  <button type="button" className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium hover:bg-surface-2 hover:text-ink">
                    <span>Meetings</span>
                    <ChevronDown size={11} />
                  </button>
                  <button type="button" className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium hover:bg-surface-2 hover:text-ink">
                    <Link2 size={12} />
                    <span>Image URL</span>
                  </button>
                </div>

                {/* Editor Content Area */}
                <div className="p-4">
                  <textarea
                    rows={8}
                    value={form.content}
                    onChange={(e) => setField('content', e.target.value)}
                    placeholder="Write your email message..."
                    className="w-full resize-y rounded-lg border-0 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
                  />
                </div>

                {/* Editor Footer */}
                <div className="flex items-center justify-between border-t border-line bg-surface-2/30 px-4 py-2 text-[11px] text-muted">
                  <div>0 words · Under 1 min read</div>
                  <div>Press / to insert a personalization</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW (Screenshot 8) */}
          {currentStep === 4 && (
            <div className="space-y-6 rounded-2xl border border-line bg-surface p-7 shadow-sm">
              <div>
                <h2 className="text-[17px] font-bold text-ink">Looks good to send?</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  Review your sender identity, audience, subject line, and content before scheduling or sending.
                </p>
              </div>

              <div className="divide-y divide-line rounded-xl border border-line bg-surface">
                {/* 1. From */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
                      <Check size={13} />
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold text-muted">From</div>
                      <div className="text-[13px] font-medium text-ink">
                        {form.from_name} &lt;{form.from_email}&gt;
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStepParam(1)}
                    className="text-[12px] font-semibold text-orange-600 hover:underline"
                  >
                    Change
                  </button>
                </div>

                {/* 2. Subject */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
                      <Check size={13} />
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold text-muted">Subject</div>
                      <div className="text-[13px] font-medium text-ink">{form.subject || 'hi'}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStepParam(3)}
                    className="text-[12px] font-semibold text-orange-600 hover:underline"
                  >
                    Change
                  </button>
                </div>

                {/* 3. Recipients */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
                      <Check size={13} />
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold text-muted">Recipients</div>
                      <div className="text-[13px] font-medium text-ink">
                        {selectedListObj.name} ({audienceCount} contact{audienceCount === 1 ? '' : 's'})
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStepParam(2)}
                    className="text-[12px] font-semibold text-orange-600 hover:underline"
                  >
                    Change
                  </button>
                </div>

                {/* 4. Email */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
                      <Check size={13} />
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold text-muted">Email</div>
                      <div className="text-[13px] font-medium text-ink">Your email is ready.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStepParam(3)}
                    className="text-[12px] font-semibold text-orange-600 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: SEND & SCHEDULE (Screenshots 9 & 10) */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* Header Box (Screenshot 9) */}
              <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm space-y-6">
                <div>
                  <h2 className="text-[17px] font-bold text-ink">Send & Schedule</h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    Confirm delivery quotas, configure delivery timing, review sending speed, and launch your campaign.
                  </p>
                </div>

                {/* Email Sending Capacity Box (Screenshot 9) */}
                <div className="rounded-xl border border-line bg-surface-2/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-bold text-ink">
                      Email Sending Capacity <span className="text-[11px] font-normal text-muted">· Real-time quota telemetry</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Auto status: In Progress
                    </span>
                  </div>

                  {/* 6 telemetry stat boxes */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                    <div className="rounded-xl border border-line bg-surface p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Plan limit</div>
                      <div className="mt-1 text-[18px] font-bold text-ink">929</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Safe capacity</div>
                      <div className="mt-1 text-[18px] font-bold text-ink">50</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Actual available</div>
                      <div className="mt-1 text-[18px] font-bold text-ink">50</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Org daily limit</div>
                      <div className="mt-1 text-[18px] font-bold text-ink">100 emails</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Recommended min</div>
                      <div className="mt-1 text-[18px] font-bold text-ink">85 emails</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Stage progression</div>
                      <div className="mt-1 text-[18px] font-bold text-ink">1 → next 200/d</div>
                    </div>
                  </div>

                  {/* Quota subcards */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-line bg-surface p-3.5">
                      <div className="flex items-center justify-between text-[11.5px] font-medium text-muted">
                        <span>Today</span>
                        <span className="font-semibold text-ink">0 / 100 sent</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full w-0 bg-orange-600 rounded-full" />
                      </div>
                      <div className="mt-1.5 text-[10.5px] text-muted">Remaining today: 100 emails</div>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-3.5">
                      <div className="flex items-center justify-between text-[11.5px] font-medium text-muted">
                        <span>This week</span>
                        <span className="font-semibold text-ink">47 sent</span>
                      </div>
                      <div className="mt-2 text-[10.5px] text-muted">Remaining this week: Unlimited</div>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-3.5">
                      <div className="text-[11.5px] font-medium text-muted">Automated pacing</div>
                      <div className="mt-1 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Ramp protection enabled
                      </div>
                      <div className="text-[10.5px] text-muted">Protects sender IP from abrupt volume spikes</div>
                    </div>
                  </div>

                  {/* Warmup Stage Banner */}
                  <div className="flex flex-col gap-2 rounded-xl bg-orange-500/10 p-3.5 sm:flex-row sm:items-center sm:justify-between border border-orange-500/20">
                    <div>
                      <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-orange-600 dark:text-orange-400">
                        <span className="size-2 rounded-full bg-orange-600" />
                        WARM-UP STAGE 1 - 100 emails/day
                      </div>
                      <div className="text-[11px] text-muted">
                        Next potential limit: 200 emails/day. Your sending limit may increase automatically based on your sending reputation and account performance.
                      </div>
                    </div>
                    <button className="rounded-lg border border-orange-500/30 bg-surface px-3 py-1 text-[11px] font-semibold text-orange-600 hover:bg-orange-500/10">
                      Manage in Email Deliverability
                    </button>
                  </div>

                  <div className="text-[12px] font-medium text-ink">
                    Eligible recipients after unsubscribe and suppression filters:{' '}
                    <span className="font-bold text-orange-600">{audienceCount}</span>
                  </div>

                  {/* Warning Box */}
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[13px] font-bold text-amber-800 dark:text-amber-300">
                          Action Required: Improve your Email Deliverability
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                          Authenticate your sending domain with SPF, DKIM, and DMARC so more of your campaign email reaches the inbox and fewer messages are marked as spam.
                        </div>
                      </div>
                    </div>
                    <button className="rounded-lg bg-orange-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-orange-700 shrink-0">
                      Set Up Now
                    </button>
                  </div>
                </div>

                {/* When should this go out? */}
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-ink">When should this go out?</label>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => setField('send_timing', 'now')}
                      className={cx(
                        'flex items-center gap-2 rounded-xl border p-3 text-left transition',
                        form.send_timing === 'now'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-semibold ring-1 ring-orange-500'
                          : 'border-line bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      <Zap size={15} />
                      <span className="text-[13px]">Send now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('send_timing', 'schedule')}
                      className={cx(
                        'flex items-center gap-2 rounded-xl border p-3 text-left transition',
                        form.send_timing === 'schedule'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-semibold ring-1 ring-orange-500'
                          : 'border-line bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      <Clock size={15} />
                      <span className="text-[13px]">Schedule for later</span>
                    </button>
                  </div>
                </div>

                {/* Pace the send (optional) (Screenshot 10) */}
                <div className="space-y-4 border-t border-line pt-5">
                  <div className="text-[13px] font-bold text-ink">Pace the send (optional)</div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-muted">Sending timezone</label>
                    <select
                      value={form.timezone}
                      onChange={(e) => setField('timezone', e.target.value)}
                      className="max-w-md w-full rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-ink"
                    >
                      <option value="Asia/Calcutta">Asia/Calcutta (GMT+05:30)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                    </select>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between max-w-md">
                      <label className="text-[12px] font-medium text-muted">Send on these days</label>
                      <div className="space-x-2 text-[11px] font-semibold text-orange-600">
                        <button type="button" onClick={() => setField('send_days', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])} className="hover:underline">Any day</button>
                        <button type="button" onClick={() => setField('send_days', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])} className="hover:underline">Weekdays</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                        const active = form.send_days?.includes(day)
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const curr = form.send_days || []
                              if (active) setField('send_days', curr.filter((d: string) => d !== day))
                              else setField('send_days', [...curr, day])
                            }}
                            className={cx(
                              'size-9 rounded-lg text-[12px] font-semibold transition',
                              active
                                ? 'bg-orange-600 text-white shadow-sm'
                                : 'border border-line bg-surface text-muted hover:bg-surface-2',
                            )}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">Emails are not sent on unchecked days.</p>
                  </div>

                  {/* Send a test */}
                  <div className="border-t border-line pt-4">
                    <label className="mb-1 block text-[13px] font-bold text-ink">Send a test</label>
                    <div className="flex items-center gap-2 max-w-md">
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={form.test_email}
                        onChange={(e) => setField('test_email', e.target.value)}
                        className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => toast('Test email preview ready.', 'good')}
                        className="rounded-xl border border-line px-3 py-2 text-[12px] font-medium text-ink hover:bg-surface-2"
                      >
                        Preview here
                      </button>
                      <button
                        type="button"
                        onClick={() => toast(`Test sent to ${form.test_email || 'recipient'}`, 'good')}
                        className="rounded-xl bg-orange-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-orange-700"
                      >
                        Send test
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation (Screenshots 3-10) */}
      <div className="border-t border-line bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="text-[12px] text-muted">Auto-saved to draft</div>
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setStepParam(currentStep - 1)}
                className="rounded-xl border border-line px-4 py-2 text-[12.5px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
              >
                Back
              </button>
            )}
            {currentStep < 4 && (
              <button
                type="button"
                onClick={() => setStepParam(currentStep + 1)}
                className="flex items-center gap-1 rounded-xl bg-orange-600 px-5 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-orange-700 transition"
              >
                <span>Next</span>
                <ChevronDown size={14} className="-rotate-90" />
              </button>
            )}
            {currentStep === 4 && (
              <button
                type="button"
                onClick={() => setStepParam(5)}
                className="flex items-center gap-1 rounded-xl bg-orange-600 px-5 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-orange-700 transition"
              >
                <span>Continue to send</span>
                <ChevronDown size={14} className="-rotate-90" />
              </button>
            )}
            {currentStep === 5 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleLaunchCampaign()}
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-[13px] font-semibold text-white shadow-md hover:bg-orange-700 disabled:opacity-50 transition"
              >
                <Send size={14} />
                <span>{busy ? 'Launching batch…' : 'Send now'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   3. HIGH-END 16-METRIC CAMPAIGN DETAIL / ANALYTICS SCREEN (Screenshot 13)
   ========================================================================= */

export function CampaignDetailPage({ id }: { id: string }) {
  const { me, toast } = useApp()
  const navigate = useNavigate()
  const [activeMetricTab, setActiveMetricTab] = useState<'delivered' | 'opened' | 'clicked' | 'replied' | 'sent'>('delivered')
  const [searchRecipients, setSearchRecipients] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data, loading, error, reload } = useFetch<{
    record: Row
    activity: Row[]
    recipients?: Row[]
  }>(`/api/resources/campaigns/${id}`)

  useEffect(() => {
    const timer = setInterval(() => {
      void reload()
    }, 3000)
    return () => clearInterval(timer)
  }, [reload])

  if (loading) return <Spinner label="Loading campaign analytics…" />
  if (error || !data?.record) return <ErrorState message={error?.message ?? 'Campaign not found.'} onRetry={reload} />

  const c = data.record
  const recipients = data.recipients ?? []

  // Metrics computation matching Screenshot 13
  const sent = Number(c.sent_count) || (c.status === 'sent' ? 1 : 0)
  const delivered = Number(c.delivered) || sent
  const opened = Number(c.opened) || 0
  const clicked = Number(c.clicked) || 0
  const replied = 0
  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0'
  const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0'
  const replyRate = '0.0'
  const ctor = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : 'NA'
  const audience = Number(c.audience_count) || sent || 1
  const hardBounced = 0
  const softBounced = 0
  const failed = 0
  const unsubscribed = 0
  const skipped = 0
  const spamComplaints = 0

  // 16 Metric Card Definitions matching Screenshot 13
  const metricCards = [
    { label: 'SENT', value: sent, color: 'text-orange-600 bg-orange-500/10 border-orange-500/20' },
    { label: 'DELIVERED', value: delivered, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
    { label: 'OPENED', value: opened, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
    { label: 'CLICKED LINK', value: clicked, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'REPLIED', value: replied, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
    { label: 'OPEN RATE', value: `${openRate}%`, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    { label: 'CLICK RATE', value: `${clickRate}%`, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
    { label: 'REPLY RATE', value: `${replyRate}%`, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'CTOR', value: ctor, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
    { label: 'AUDIENCE', value: audience, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'HARD BOUNCED', value: hardBounced, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
    { label: 'SOFT BOUNCED', value: softBounced, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    { label: 'FAILED', value: failed, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    { label: 'UNSUBSCRIBED', value: unsubscribed, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
    { label: 'SKIPPED AT SEND', value: skipped, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { label: 'SPAM COMPLAINTS', value: spamComplaints, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  ]

  // Real recipients from database; if none recorded, fallback to empty list
  const filteredRecipients = recipients.filter((r) => {
    if (!searchRecipients.trim()) return true
    const term = searchRecipients.toLowerCase()
    return (
      String(r.contact_name ?? '').toLowerCase().includes(term) ||
      String(r.email ?? '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface font-sans text-ink">
      {/* Top Header & Breadcrumb */}
      <div className="border-b border-line bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-ink leading-tight">{c.name}</h1>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              <Link to="/" className="hover:text-accent">Home</Link>
              <span>›</span>
              <Link to="/marketing/campaigns" className="hover:text-accent">Campaigns</Link>
              <span>›</span>
              <span className="font-medium text-ink">{c.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => reload()}
              className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-ink"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => navigate('/marketing/campaigns')}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
            >
              Back to campaigns
            </button>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400 transition"
              title="Delete campaign"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-6 space-y-6">
        {/* 16 Metric Stat Cards Grid (Screenshot 13) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {metricCards.map((m) => (
            <div
              key={m.label}
              className="flex flex-col justify-between rounded-xl border border-line bg-surface p-3 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-muted">
                  {m.label}
                </span>
                <span className={cx('size-2 rounded-full', m.color.split(' ')[0].replace('text-', 'bg-'))} />
              </div>
              <div className="mt-2 text-[20px] font-black text-ink">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Descriptive Summary Banner (Screenshot 13) */}
        <div className="text-[12px] text-muted">
          1 of 1 eligible emails were attempted (delivered + bounced + failed). Delivered 1 of those sent. Unsubscribed is only people who opted out from this email — send-time skips are under Skipped.
        </div>

        {/* Tab Filters (Screenshot 13) */}
        <div className="flex flex-wrap items-center gap-1 border-b border-line text-[12.5px]">
          <button
            onClick={() => setActiveMetricTab('delivered')}
            className={cx(
              'pb-2.5 px-3 font-semibold transition border-b-2',
              activeMetricTab === 'delivered'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            Delivered ({delivered})
          </button>
          <button
            onClick={() => setActiveMetricTab('opened')}
            className={cx(
              'pb-2.5 px-3 font-medium transition border-b-2',
              activeMetricTab === 'opened'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            Opened ({opened})
          </button>
          <button
            onClick={() => setActiveMetricTab('clicked')}
            className={cx(
              'pb-2.5 px-3 font-medium transition border-b-2',
              activeMetricTab === 'clicked'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            Clicked link ({clicked})
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Replied (0)
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Hard bounced (0)
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Soft bounced (0)
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Spam complaints (0)
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Failed (0)
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Unsubscribed (0)
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Skipped (0)
          </button>
          <button
            onClick={() => setActiveMetricTab('sent')}
            className={cx(
              'pb-2.5 px-3 font-medium transition border-b-2',
              activeMetricTab === 'sent'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            Sent ({sent})
          </button>
          <button className="pb-2.5 px-3 text-muted hover:text-ink transition border-b-2 border-transparent">
            Not queued (excluded) (0)
          </button>
        </div>

        {/* Search input for recipients */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={searchRecipients}
            onChange={(e) => setSearchRecipients(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-[12.5px] text-ink placeholder:text-muted focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Recipients Activity Breakdown Table (Screenshot 13) */}
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="rounded border-line" />
                </th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Delivered at</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[13px] text-muted">
                    No recipients found for this campaign.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-surface-2/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <input type="checkbox" className="rounded border-line" />
                    </td>
                    <td className="px-4 py-3.5 font-medium text-ink">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-full bg-orange-500/15 text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase">
                          {String(r.contact_name || r.email || 'C').slice(0, 2)}
                        </span>
                        <span>{r.contact_name || 'Contact'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{r.email}</td>
                    <td className="px-4 py-3.5">
                      {r.status === 'opened' || r.opened_at ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          <span className="size-1.5 rounded-full bg-rose-500" />
                          Opened
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Delivered
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted">
                      {formatDateTime(r.opened_at || r.delivered_at || r.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {r.status !== 'opened' && !r.opened_at ? (
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`/api/public/campaigns/open/${id}/${r.id}`)
                              toast('Recorded open event for ' + r.email, 'good')
                              await reload()
                            } catch {
                              toast('Failed to record open.', 'bad')
                            }
                          }}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2 py-1 rounded-md transition"
                        >
                          Trigger Open
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-600">Opened ✓</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="border-t border-line bg-surface-2/40 px-4 py-2.5 text-[11.5px] text-muted">
            Showing {filteredRecipients.length} record{filteredRecipients.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete campaign "${c.name}"?`}
        message="This campaign and its analytics will be moved to trash. You can restore it from Trash if needed."
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await del(`/api/resources/campaigns/${c.id}`)
            toast('Campaign deleted successfully.', 'good')
            navigate('/marketing/campaigns')
          } catch (err: any) {
            toast(err?.message ?? 'Failed to delete campaign.', 'bad')
            setDeleting(false)
          }
        }}
        loading={deleting}
      />
    </div>
  )
}
