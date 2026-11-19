import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  ArrowLeft,
  ExternalLink,
  Building2,
  User,
  Target,
  Handshake,
  Columns,
  Kanban,
  LayoutGrid,
  Mail,
  Phone,
  Star,
  Table as TableIcon,
  Tag,
  X,
} from 'lucide-react'
import { del, downloadCsv, patch, post, query, type Row } from '../lib/api'
import { labelFor, useApp, useFetch, useRefOptions, type EntitySchema, type FieldSchema } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDate, formatDateTime, initials, money, titleCase } from '../lib/format'

/** People-like records get an initials chip in the first column; money/date lists do not. */
const AVATAR_ENTITIES = new Set(['contacts', 'companies', 'leads', 'users'])
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  FormRow,
  IconButton,
  MenuItem,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Spinner,
  StatusBadge,
  TableSkeleton,
  Tabs,
} from './ui'

const MONEY_KEYS = new Set(['value', 'total', 'subtotal', 'unit_price', 'amount'])
const DATE_KEYS = new Set(['created_at', 'updated_at', 'due_date', 'expected_close', 'start_at', 'end_at', 'deleted_at', 'scheduled_at', 'issue_date', 'published_at'])
const BOOL_KEYS = new Set(['email_opt_out', 'opt_out', 'all_day', 'locked', 'exit_on_reply'])
const BADGE_KEYS = new Set(['status', 'priority', 'type', 'channel', 'stage_id', 'doc_type', 'direction', 'role'])

export function FieldValue({ entity, field, value, maxChars }: { entity: string; field: string; value: unknown; maxChars?: number }) {
  const { meta } = useApp()
  const schema = useApp().schema[entity]
  const def = schema?.fields.find((f) => f.key === field)
  if (value === null || value === undefined || value === '') return <span className="text-faint">—</span>
  if (def?.ref) {
    const label = labelFor(meta, def.ref, value)
    if (!label) return <span className="text-faint">—</span>
    const href =
      def.ref === 'companies'
        ? `/companies/${value}`
        : def.ref === 'contacts'
          ? `/contacts/${value}`
          : def.ref === 'deals'
            ? `/sales/deals/${value}`
            : null
    return href ? (
      <Link to={href} className="text-accent hover:underline">
        {label}
      </Link>
    ) : (
      <span>{label}</span>
    )
  }
  if (MONEY_KEYS.has(field)) return <span className="tabular-nums">{money(value, meta?.currentUser.currency ?? 'USD')}</span>
  if (BOOL_KEYS.has(field)) return value ? <Badge tone="warn">Yes</Badge> : <Badge>No</Badge>
  if (field === 'tags' && typeof value === 'string') {
    return (
      <span className="flex flex-wrap gap-1.5">
        {value
          .split(',')
          .filter(Boolean)
          .slice(0, 3)
          .map((rawTag) => {
            const tag = rawTag.trim()
            const lower = tag.toLowerCase()
            let tone = 'bg-surface-2 text-ink border-line'
            if (lower.includes('close') || lower.includes('urgent') || lower.includes('lost') || lower.includes('hot')) {
              tone = 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60'
            } else if (lower.includes('created') || lower.includes('pending') || lower.includes('follow') || lower.includes('warm')) {
              tone = 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60'
            } else if (lower.includes('qualif') || lower.includes('won') || lower.includes('active') || lower.includes('customer')) {
              tone = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
            } else if (lower.includes('new') || lower.includes('lead') || lower.includes('prospect')) {
              tone = 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60'
            }
            return (
              <span
                key={tag}
                className={cx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border shadow-2xs', tone)}
              >
                {tag}
              </span>
            )
          })}
      </span>
    )
  }
  if (field === 'score' || field === 'probability' || field.endsWith('_count') || field === 'views') {
    return <span className="tabular-nums">{String(value)}</span>
  }
  if (field === 'size') return <span>{formatBytes(Number(value))}</span>
  if (BADGE_KEYS.has(field)) return <StatusBadge value={value} />
  if (DATE_KEYS.has(field)) {
    return <span title={formatDateTime(value)}>{field === 'created_at' || field === 'updated_at' ? formatDate(value) : formatDate(value)}</span>
  }
  const text = String(value)
  return <span>{maxChars && text.length > maxChars ? `${text.slice(0, maxChars)}…` : text}</span>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

/* ------------------------------------------------------------------ input */
export function FieldControl({
  field,
  value,
  onChange,
  error,
  disabled,
}: {
  field: FieldSchema
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  disabled?: boolean
}) {
  const options = useRefOptions(field.ref)
  const common = {
    id: `field-${field.key}`,
    'aria-invalid': error ? ('true' as const) : undefined,
    disabled,
  }
  if (field.ref) {
    return (
      <select className="gx-select" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} {...common}>
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
  if (field.type === 'select') {
    return (
      <select className="gx-select" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} {...common}>
        <option value="">Select…</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {titleCase(option)}
          </option>
        ))}
      </select>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 pt-1 text-[13px]">
        <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} {...common} />
        <span className="text-muted">{field.label}</span>
      </label>
    )
  }
  if (field.type === 'textarea' || field.type === 'json') {
    return (
      <textarea
        className="gx-textarea"
        value={typeof value === 'string' ? value : value ? JSON.stringify(value, null, 2) : ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        {...common}
      />
    )
  }
  if (field.type === 'date') {
    return <input className="gx-input" type="date" value={String(value ?? '').slice(0, 10)} onChange={(event) => onChange(event.target.value)} {...common} />
  }
  if (field.type === 'datetime') {
    return (
      <input
        className="gx-input"
        type="datetime-local"
        value={toLocalInput(value)}
        onChange={(event) => onChange(event.target.value ? new Date(event.target.value).toISOString() : '')}
        {...common}
      />
    )
  }
  if (field.type === 'number' || field.type === 'money') {
    return (
      <input
        className="gx-input"
        type="number"
        step={field.type === 'money' ? '0.01' : '1'}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        {...common}
      />
    )
  }
  return (
    <input
      className="gx-input"
      type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      {...common}
    />
  )
}

function toLocalInput(value: unknown): string {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* ------------------------------------------------------------------ drawer */
export function RecordFormDrawer({
  entity,
  open,
  record,
  onClose,
  onSaved,
  preset,
  extra,
}: {
  entity: string
  open: boolean
  record: Row | null
  onClose: () => void
  onSaved: (record: Row) => void
  preset?: Row
  extra?: (values: Row, setValue: (key: string, value: unknown) => void) => ReactNode
}) {
  const { schema, toast, meta } = useApp()
  const def: EntitySchema | undefined = schema[entity]
  const [values, setValues] = useState<Row>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!open) return
    const base: Row = {}
    for (const field of def?.fields ?? []) base[field.key] = field.type === 'checkbox' ? false : ''
    if (entity === 'deals') {
      base.currency = meta?.currentUser.currency ?? 'USD'
      base.probability = 10
      base.status = 'open'
      base.pipeline_id = meta?.pipelines[0]?.id ?? ''
      base.stage_id = meta?.stages[0]?.id ?? ''
    }
    if (entity === 'events') {
      base.timezone = meta?.currentUser.timezone ?? meta?.currentUser.org_timezone ?? 'UTC'
      base.status = 'scheduled'
    }
    if (entity === 'tasks') {
      base.assignee_id = meta?.currentUser.id ?? ''
      base.due_date = new Date().toISOString().slice(0, 10)
      base.status = 'open'
    }
    if (entity === 'contacts') {
      base.owner_id = meta?.currentUser.id ?? ''
      base.status = 'active'
    }
    setValues({ ...base, ...(preset ?? {}), ...(record ?? {}) })
    setErrors({})
    setDirty(false)
  }, [open, record, preset, def, entity, meta])

  const setValue = useCallback((key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  const save = async () => {
    if (!def) return
    setSaving(true)
    setErrors({})
    try {
      const payload: Row = {}
      for (const field of def.fields) payload[field.key] = values[field.key] ?? null
      const result: { record: Row; warning?: string } = record
        ? await patch<{ record: Row; warning?: string }>(`/api/resources/${entity}/${record.id}`, payload)
        : await post<{ record: Row; warning?: string }>(`/api/resources/${entity}`, payload)
      toast(result.warning ?? `${def.singular} ${record ? 'updated' : 'created'}.`, 'good')
      setDirty(false)
      onSaved(result.record)
    } catch (error: any) {
      if (error?.fields) setErrors(error.fields)
      toast(error?.message ?? 'Could not save. Your input is kept so nothing is lost.', 'bad')
    } finally {
      setSaving(false)
    }
  }

  if (!def) return null
  const title = record ? `Edit ${def.singular.toLowerCase()}` : `New ${def.singular.toLowerCase()}`

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={record ? `Record ${record.id.slice(0, 8)}` : 'Fields marked with a point are required'}
      dirty={dirty}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={save} loading={saving}>
            {record ? 'Save changes' : `Create ${def.singular.toLowerCase()}`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {def.fields.map((field) => (
          <FormRow
            key={field.key}
            label={`${field.label}${field.required ? ' *' : ''}`}
            error={errors[field.key]}
            className={field.half ? '' : 'sm:col-span-2'}
          >
            <FieldControl field={field} value={values[field.key]} onChange={(value) => setValue(field.key, value)} error={errors[field.key]} />
          </FormRow>
        ))}
        {extra ? extra(values, setValue) : null}
      </div>
    </Drawer>
  )
}

/* --------------------------------------------------------------- list page */
export function ResourcePage({
  entity,
  title,
  subtitle,
  headerActions,
  fixedFilters,
  onRowClick,
  breadcrumb,
  hideCreate,
  tabs,
  activeTab,
  onTabChange,
  showViewModes = true,
  renderDrawer,
}: {
  entity: string
  title?: string
  subtitle?: string
  headerActions?: ReactNode
  fixedFilters?: Record<string, string>
  onRowClick?: (row: Row) => void
  breadcrumb?: ReactNode
  hideCreate?: boolean
  tabs?: { key: string; label: string; count?: number }[]
  activeTab?: string
  onTabChange?: (key: string) => void
  showViewModes?: boolean
  renderDrawer?: (props: { open: boolean; record: Row | null; onClose: () => void; onSaved: () => void }) => ReactNode
}) {
  const { schema, toast, meta, refreshMeta } = useApp()
  const def = schema[entity]
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<string | undefined>()
  const [dir, setDir] = useState<'asc' | 'desc' | undefined>()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'grid'>('table')
  const [isFavorite, setIsFavorite] = useState(false)
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all')
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 260)
    return () => window.clearTimeout(timer)
  }, [search])

  const path = def
    ? `/api/resources/${entity}${query({
        q: debounced,
        page,
        limit,
        sort,
        dir,
        ...(fixedFilters ?? {}),
        ...filters,
      })}`
    : null
  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>(path)

  const allFilters = useMemo(() => {
    if (!def) return []
    const keys = new Set([...def.filters, ...Object.keys(fixedFilters ?? {})])
    return [...keys]
      .filter((key) => !(fixedFilters ?? {})[key])
      .map((key) => def.fields.find((field) => field.key === key))
      .filter((field): field is FieldSchema => Boolean(field && (field.options || field.key === 'status')))
  }, [def, fixedFilters])

  if (!def) return <Spinner label="Loading workspace schema" />

  let rows = data?.data ?? []
  if (dateFilter !== 'all') {
    const cutoff = new Date()
    const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90
    cutoff.setDate(cutoff.getDate() - days)
    rows = rows.filter((r) => !r.created_at || new Date(String(r.created_at)) >= cutoff)
  }

  const toggleAll = () => {
    setSelected((current) => (current.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))))
  }
  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const remove = async (row: Row) => {
    setBusy(true)
    try {
      await del(`/api/resources/${entity}/${row.id}`)
      toast(`${def.singular} moved to trash.`, 'good')
      setDeleting(null)
      reload()
      refreshMeta()
    } catch (err: any) {
      toast(err?.message ?? 'Could not delete the record.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!selected.size) return
    if (!window.confirm(`Are you sure you want to delete ${selected.size} selected ${def.label.toLowerCase()}?`)) return
    setBusy(true)
    try {
      await post(`/api/resources/${entity}/bulk`, { action: 'delete', ids: Array.from(selected) })
      toast(`${selected.size} record(s) moved to trash.`, 'good')
      setSelected(new Set())
      reload()
      refreshMeta()
    } catch (err: any) {
      toast(err?.message ?? 'Bulk delete failed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const handleBulkTag = async () => {
    if (!selected.size || !tagInput.trim()) return
    setBusy(true)
    try {
      await post(`/api/resources/${entity}/bulk`, { action: 'tag', ids: Array.from(selected), tag: tagInput.trim() })
      toast(`Tag "${tagInput.trim()}" applied to ${selected.size} record(s).`, 'good')
      setTagModalOpen(false)
      setTagInput('')
      setSelected(new Set())
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Applying tag failed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const openRow = (row: Row) => {
    if (onRowClick) return onRowClick(row)
    if (def.detailPath) navigate(`${def.detailPath}/${row.id}`)
  }

  const visibleColumns = def.list.filter((col) => !hiddenCols.has(col))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span>{title ?? def.label}</span>
            <button
              type="button"
              className={isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-faint hover:text-muted'}
              onClick={() => setIsFavorite(!isFavorite)}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </span>
        }
        subtitle={subtitle ?? `${data?.total ?? 0} ${def.label.toLowerCase()}`}
        breadcrumb={breadcrumb}
      >
        {headerActions}
        <IconButton label="Refresh" onClick={reload}>
          <RefreshCw size={15} />
        </IconButton>
        {meta?.permissions.canExport ? (
          <Button
            size="sm"
            onClick={async () => {
              try {
                await downloadCsv(entity)
                toast('Export downloaded.', 'good')
              } catch (err: any) {
                toast(err?.message ?? 'Export failed', 'bad')
              }
            }}
          >
            <Download size={14} /> Export
          </Button>
        ) : null}
        {!hideCreate ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus size={14} /> New {def.singular.toLowerCase()}
          </Button>
        ) : null}
      </PageHeader>

      {/* Optional Status Tabs (e.g. Leads All | Raw | Primary | Qualified) */}
      {tabs && tabs.length > 0 ? (
        <div className="border-b border-line bg-surface px-5">
          <Tabs tabs={tabs} active={activeTab ?? tabs[0]?.key} onChange={(k) => onTabChange?.(k)} />
        </div>
      ) : null}

      {/* Enterprise Filter & Tool Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/40 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${def.label.toLowerCase()}…`} className="w-full sm:w-60" />
          {allFilters.map((field) => (
            <select
              key={field.key}
              className="gx-select w-auto min-w-[120px] text-[12px]"
              value={filters[field.key] ?? ''}
              onChange={(event) => {
                setFilters((current) => ({ ...current, [field.key]: event.target.value }))
                setPage(1)
              }}
              aria-label={`Filter by ${field.label}`}
            >
              <option value="">All {field.label.toLowerCase()}</option>
              {(field.options ?? ['active', 'draft', 'archived', 'open', 'closed', 'pending']).map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          ))}

          {/* Date range filter */}
          <select
            className="gx-select w-auto text-[12px]"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            aria-label="Filter by date range"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          {Object.values(filters).some(Boolean) || sort || dateFilter !== 'all' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters({})
                setSort(undefined)
                setDir(undefined)
                setDateFilter('all')
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Manage Columns Dropdown */}
          <Dropdown
            trigger={({ toggle }) => (
              <Button size="sm" variant="ghost" onClick={toggle} title="Manage visible columns">
                <Columns size={13} />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            )}
          >
            {() => (
              <div className="p-2 space-y-1 w-44 text-[12px]">
                <div className="font-semibold text-muted px-2 py-1 uppercase text-[10px] tracking-wider">Toggle Columns</div>
                {def.list.map((col) => {
                  const field = def.fields.find((f) => f.key === col)
                  const isVisible = !hiddenCols.has(col)
                  return (
                    <label key={col} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => {
                          setHiddenCols((current) => {
                            const next = new Set(current)
                            if (isVisible) next.add(col)
                            else next.delete(col)
                            return next
                          })
                        }}
                        className="size-3.5 accent-[var(--color-accent)]"
                      />
                      <span>{field?.label ?? titleCase(col)}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </Dropdown>

          {/* View mode toggle */}
          {showViewModes ? (
            <div className="flex items-center rounded-lg border border-line bg-surface p-0.5">
              <button
                type="button"
                className={`rounded p-1 text-xs transition ${viewMode === 'table' ? 'bg-surface-2 text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <TableIcon size={14} />
              </button>
              <button
                type="button"
                className={`rounded p-1 text-xs transition ${viewMode === 'kanban' ? 'bg-surface-2 text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                onClick={() => setViewMode('kanban')}
                title="Kanban view"
              >
                <Kanban size={14} />
              </button>
              <button
                type="button"
                className={`rounded p-1 text-xs transition ${viewMode === 'grid' ? 'bg-surface-2 text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          ) : null}

          {selected.size ? (
            <div className="flex items-center gap-2 pl-2 border-l border-line animate-fade-in">
              <span className="text-[12px] font-semibold text-accent">{selected.size} selected</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => void handleBulkDelete()}
                loading={busy}
                title="Delete selected records"
              >
                <Trash2 size={12} /> Delete Selected
              </Button>
              <Button
                size="sm"
                onClick={() => setTagModalOpen(true)}
                title="Add tag"
              >
                <Tag size={12} /> Tag
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                title="Deselect all"
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={debounced || Object.values(filters).some(Boolean) ? 'No matching records' : `No ${def.label.toLowerCase()} yet`}
            description={
              debounced || Object.values(filters).some(Boolean)
                ? 'Try a different search term or clear the filters.'
                : `Create the first ${def.singular.toLowerCase()} to start building this workspace.`
            }
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus size={14} /> New {def.singular.toLowerCase()}
              </Button>
            }
          />
        ) : viewMode === 'table' ? (
          <table className="gx-table">
            <thead>
              <tr>
                <th className="w-9">
                  <input type="checkbox" aria-label="Select all" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="size-3.5 accent-[var(--color-accent)]" />
                </th>
                {visibleColumns.map((key) => {
                  const field = def.fields.find((f) => f.key === key)
                  return (
                    <th key={key}>
                      <button
                        className="inline-flex items-center gap-1 uppercase"
                        onClick={() => {
                          setSort(key)
                          setDir(sort === key && dir === 'asc' ? 'desc' : 'asc')
                        }}
                      >
                        {field?.label ?? titleCase(key)}
                        {sort === key ? <ChevronDown size={11} className={dir === 'asc' ? 'rotate-180' : ''} /> : null}
                      </button>
                    </th>
                  )
                })}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={def.detailPath || onRowClick ? 'clickable' : ''} onClick={() => openRow(row)}>
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="size-3.5 accent-[var(--color-accent)]"
                    />
                  </td>
                  {visibleColumns.map((key, index) => (
                    <td key={key} className={index === 0 ? 'font-medium' : ''}>
                      {index === 0 && AVATAR_ENTITIES.has(entity) ? (
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cx(
                              'grid size-7 shrink-0 place-items-center rounded-full text-[10.5px] font-bold uppercase shadow-2xs',
                              [
                                'bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300',
                                'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300',
                                'bg-purple-500/15 text-purple-600 dark:bg-purple-500/25 dark:text-purple-300',
                                'bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-300',
                                'bg-rose-500/15 text-rose-600 dark:bg-rose-500/25 dark:text-rose-300',
                              ][Math.abs(row.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 5]
                            )}
                          >
                            {initials(String(row[key] ?? '')) || '–'}
                          </span>
                          <div className="min-w-0">
                            <FieldValue entity={entity} field={key} value={row[key]} maxChars={40} />
                            {row.designation || row.company_name || row.domain ? (
                              <div className="text-[11px] text-muted truncate">
                                {String(row.designation ?? row.company_name ?? row.domain)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <FieldValue entity={entity} field={key} value={row[key]} maxChars={index === 0 ? 46 : 30} />
                      )}
                    </td>
                  ))}
                  <td onClick={(event) => event.stopPropagation()} className="whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {row.email ? (
                        <a
                          href={`mailto:${row.email}`}
                          className="flex size-6 items-center justify-center rounded text-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 transition-colors"
                          title={`Email ${row.email}`}
                        >
                          <Mail size={12} />
                        </a>
                      ) : null}
                      {row.phone ? (
                        <a
                          href={`tel:${row.phone}`}
                          className="flex size-6 items-center justify-center rounded text-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-surface-2 transition-colors"
                          title={`Call ${row.phone}`}
                        >
                          <Phone size={12} />
                        </a>
                      ) : null}
                      <Dropdown
                        trigger={({ toggle }) => (
                          <IconButton label="Row actions" onClick={toggle}>
                            <MoreHorizontal size={14} />
                          </IconButton>
                        )}
                      >
                      {(close) => (
                        <>
                          {def.detailPath ? (
                            <MenuItem
                              onClick={() => {
                                close()
                                openRow(row)
                              }}
                            >
                              <ExternalLink size={13} /> Open record
                            </MenuItem>
                          ) : null}
                          <MenuItem
                            onClick={() => {
                              close()
                              setEditing(row)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </MenuItem>
                          <MenuItem
                            tone="danger"
                            onClick={() => {
                              close()
                              setDeleting(row)
                            }}
                          >
                            <Trash2 size={13} /> Move to trash
                          </MenuItem>
                        </>
                      )}
                    </Dropdown>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 gap-3.5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <Card key={row.id} className="p-4 hover:border-accent/40 transition cursor-pointer" onClick={() => openRow(row)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-[12px] font-bold text-accent">
                      {initials(String(row.name || row.first_name || '')) || '–'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[13.5px] truncate">
                        {String(row.name || `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Untitled')}
                      </div>
                      <div className="text-[11.5px] text-muted truncate">{String(row.domain || row.email || row.company_name || '—')}</div>
                    </div>
                  </div>
                  {row.status ? <StatusBadge value={row.status} /> : null}
                </div>
                <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-line/60 pt-2.5 text-[11.5px] text-muted">
                  <div>
                    <span className="block text-[10px] uppercase text-faint">Industry / Role</span>
                    <span className="truncate block font-medium text-ink">{String(row.industry || row.job_title || row.designation || '—')}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-faint">Phone / Size</span>
                    <span className="truncate block font-medium text-ink">{String(row.size || row.phone || '—')}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* Kanban View Grouped by Status */
          <div className="flex gap-4 p-5 overflow-x-auto min-h-[450px]">
            {['new', 'contacted', 'qualified', 'proposal', 'won', 'active', 'prospect', 'churned'].filter((st) =>
              rows.some((r) => String(r.status ?? '').toLowerCase() === st)
            ).map((st) => {
              const statusRows = rows.filter((r) => String(r.status ?? '').toLowerCase() === st)
              return (
                <div key={st} className="w-72 shrink-0 flex flex-col rounded-xl border border-line bg-surface-2/40 p-3">
                  <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-line">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge value={st} />
                      <span className="text-[11px] font-semibold text-muted">({statusRows.length})</span>
                    </div>
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {statusRows.map((r) => (
                      <Card key={r.id} className="p-3 hover:border-accent/40 cursor-pointer" onClick={() => openRow(r)}>
                        <div className="font-medium text-[13px]">
                          {String(r.name || `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim())}
                        </div>
                        <div className="text-[11px] text-muted truncate mt-0.5">{String(r.domain || r.email || r.company_name || '—')}</div>
                        {r.value ? <div className="mt-2 text-[12px] font-semibold text-accent">{money(r.value)}</div> : null}
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        limit={limit}
        total={data?.total ?? 0}
        onPage={setPage}
        onLimit={(value) => {
          setLimit(value)
          setPage(1)
        }}
      />

      {/* Floating Bulk Actions Bar */}
      {selected.size > 0 ? (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 shadow-2xl animate-fade-in text-[12.5px]">
          <span className="font-semibold text-ink whitespace-nowrap">{selected.size} selected</span>
          <span className="h-4 w-px bg-line" />
          <Button
            size="sm"
            onClick={() => {
              toast(`Opening email composer for ${selected.size} recipients…`, 'good')
            }}
          >
            <Mail size={13} /> Email
          </Button>
          <Button
            size="sm"
            onClick={() => {
              toast(`Launching call session for selected records…`, 'good')
            }}
          >
            <Phone size={13} /> Call
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setTagModalOpen(true)
            }}
          >
            <Tag size={13} /> Tag
          </Button>
          <Button size="sm" variant="danger" onClick={() => void handleBulkDelete()} loading={busy}>
            <Trash2 size={13} /> Delete
          </Button>
          <IconButton label="Clear selection" onClick={() => setSelected(new Set())}>
            <X size={14} />
          </IconButton>
        </div>
      ) : null}

      {/* Tag Modal */}
      <Modal
        open={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        title="Add tag to selected records"
        footer={
          <>
            <Button size="sm" onClick={() => setTagModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={() => void handleBulkTag()} loading={busy} disabled={!tagInput.trim()}>
              Apply tag
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[12.5px] text-muted">Enter a tag to append to all selected records:</p>
          <input
            type="text"
            placeholder="e.g. VIP, Q4-Target"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="gx-input w-full"
          />
        </div>
      </Modal>

      {renderDrawer ? (
        renderDrawer({
          open: formOpen,
          record: editing,
          onClose: () => setFormOpen(false),
          onSaved: () => {
            setFormOpen(false)
            reload()
            refreshMeta()
          },
        })
      ) : (
        <RecordFormDrawer
          entity={entity}
          open={formOpen}
          record={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            reload()
            refreshMeta()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Move this ${def.singular.toLowerCase()} to trash?`}
        message="Linked records are preserved. You can restore it from Trash while the retention window is open."
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        loading={busy}
      />
    </div>
  )
}

/* -------------------------------------------------------------- detail page */
export type DetailConfig = {
  entity: string
  title: (record: Row) => string
  subtitle?: (record: Row) => ReactNode
  summary: string[]
  related?: { entity: string; foreignKey: string; label: string }[]
  avatar?: (record: Row) => ReactNode
}

export function RecordDetailPage({
  config,
  id,
  backTo,
  backLabel,
  actions,
  tabs: extraTabs,
}: {
  config: DetailConfig
  id: string
  backTo: string
  backLabel: string
  actions?: (record: Row, reload: () => void) => ReactNode
  tabs?: { key: string; label: string; render: (record: Row, reload: () => void) => ReactNode }[]
}) {
  const { schema, refreshMeta } = useApp()
  const def = schema[config.entity]
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(`/api/resources/${config.entity}/${id}`)

  if (loading) return <Spinner label="Loading record" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Record not found'} onRetry={reload} />
  const record = data.record

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        breadcrumb={
          <Link to={backTo} className="mb-1 inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink">
            <ArrowLeft size={12} /> {backLabel}
          </Link>
        }
        title={config.title(record)}
        subtitle={config.subtitle?.(record)}
      >
        {actions?.(record, reload)}
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Edit
        </Button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        <div className="grid gap-4 p-5 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                {config.avatar?.(record) ?? <Avatar name={config.title(record)} size={40} />}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{config.title(record)}</div>
                  <div className="truncate text-[11.5px] text-muted">{config.subtitle?.(record)}</div>
                </div>
              </div>
              <dl className="mt-4 space-y-2.5">
                {config.summary.map((key) => {
                  const field = def?.fields.find((f) => f.key === key)
                  return (
                    <div key={key} className="flex items-start justify-between gap-3 text-[12.5px]">
                      <dt className="text-muted">{field?.label ?? titleCase(key)}</dt>
                      <dd className="max-w-[58%] truncate text-right">
                        <FieldValue entity={config.entity} field={key} value={record[key]} />
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </Card>
            <Card className="p-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-faint">Record</h3>
              <div className="space-y-1.5 text-[11.5px] text-muted">
                <div className="flex justify-between gap-2">
                  <span>ID</span>
                  <span className="font-mono text-[10.5px] text-ink">{record.id.slice(0, 12)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Created</span>
                  <span className="text-ink">{formatDate(record.created_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Updated</span>
                  <span className="text-ink">{formatDate(record.updated_at)}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="min-w-0 overflow-hidden">
            <Tabs
              tabs={[
                { key: 'overview', label: 'Overview' },
                { key: 'activity', label: 'Activity', count: data.activity.length },
                ...(config.related ?? []).map((rel) => ({ key: rel.entity, label: rel.label })),
                ...(extraTabs ?? []).map((t) => ({ key: t.key, label: t.label })),
              ]}
              active={tab}
              onChange={setTab}
              className="px-4"
            />
            <div className="p-4">
              {tab === 'overview' ? (
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {(def?.fields ?? []).map((field) => (
                    <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <div className="text-[11px] font-medium uppercase tracking-[0.03em] text-faint">{field.label}</div>
                      <div className="mt-0.5 text-[13px]">
                        <FieldValue entity={config.entity} field={field.key} value={record[field.key]} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : tab === 'activity' ? (
                <ActivityFeed items={data.activity} />
              ) : (extraTabs ?? []).find((t) => t.key === tab) ? (
                (extraTabs ?? []).find((t) => t.key === tab)!.render(record, reload)
              ) : (
                <RelatedList relation={(config.related ?? []).find((r) => r.entity === tab)!} record={record} />
              )}
            </div>
          </Card>
        </div>
      </div>

      <RecordFormDrawer
        entity={config.entity}
        open={editing}
        record={record}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          reload()
          refreshMeta()
        }}
      />
    </div>
  )
}

export type Relation = { entity: string; foreignKey: string; label: string; extra?: Record<string, string> }

export function RelatedList({ relation, record }: { relation: Relation; record: Row }) {
  const { schema, meta } = useApp()
  const def = schema[relation.entity]
  const { data, loading } = useFetch<{ data: Row[] }>(
    `/api/resources/${relation.entity}${query({ [relation.foreignKey]: record.id, limit: 50, ...(relation.extra ?? {}) })}`,
  )
  if (loading) return <TableSkeleton rows={3} cols={4} />
  const rows = data?.data ?? []
  if (!rows.length)
    return (
      <EmptyState
        icon={<Target size={18} />}
        title={`No ${relation.label.toLowerCase()}`}
        description={`${relation.label} linked to this record will appear here.`}
      />
    )
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{String(row.name ?? row.subject ?? row.title ?? `${row.first_name ?? ''} ${row.last_name ?? ''}`)}</div>
            <div className="text-[11.5px] text-muted">
              {row.status ? <StatusBadge value={row.status} /> : null} {row.due_date ? ` · ${formatDate(row.due_date)}` : ''}
              {row.value ? ` · ${money(row.value, meta?.currentUser.currency)}` : ''}
            </div>
          </div>
          {def?.detailPath ? (
            <Link to={`${def.detailPath}/${row.id}`} className="shrink-0 text-[11.5px] text-accent hover:underline">
              Open
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function ActivityFeed({ items }: { items: Row[] }) {
  const iconFor = (type: string) => {
    if (type.startsWith('contact') || type.startsWith('lead')) return <User size={13} />
    if (type.startsWith('deal')) return <Handshake size={13} />
    if (type.startsWith('company')) return <Building2 size={13} />
    if (type.startsWith('ticket')) return <Target size={13} />
    return <RefreshCw size={13} />
  }
  if (!items.length) return <EmptyState icon={<Target size={18} />} title="No activity yet" description="Record changes, emails and automation steps will appear here in chronological order." />
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[27px] flex size-5 items-center justify-center rounded-full bg-surface-2 text-muted ring-4 ring-[var(--color-surface)]">
            {iconFor(String(item.type))}
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px]">{item.summary}</p>
            <span className="text-[11px] text-faint">{formatDateTime(item.created_at)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
            <Badge>{titleCase(item.type)}</Badge>
            {item.actor ? <span>{item.actor}</span> : <span>system</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}
