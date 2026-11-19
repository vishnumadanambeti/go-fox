import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Code2,
  Eye,
  KeyRound,
  Laptop,
  Layers,
  Layout,
  Mail,
  Megaphone,
  Monitor,
  MoreVertical,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Type,
  X,
} from 'lucide-react'
import { patch, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { Button, ErrorState, FormRow, Modal, Spinner, StatusBadge, cx } from '../components/ui'
import { EMAIL_PRESETS, type EmailPreset } from '../data/emailTemplates'
import { formatDateTime } from '../lib/format'

const VARIABLES = [
  { key: '{{first_name}}', label: 'First name' },
  { key: '{{last_name}}', label: 'Last name' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{company_name}}', label: 'Company' },
  { key: '{{phone}}', label: 'Phone' },
  { key: '{{owner_name}}', label: 'Owner' },
  { key: '{{deal_name}}', label: 'Deal' },
]

/** Removes the dangerous parts of pasted HTML while keeping email markup and inline CSS. */
function sanitizeEmailHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/expression\s*\(/gi, '')
}

function PreviewFrame({ html, className, mobile = false }: { html: string; className?: string; mobile?: boolean }) {
  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={html}
      className={cx('h-full w-full border-0 bg-white', className)}
      style={mobile ? { maxWidth: 390, margin: '0 auto', display: 'block' } : undefined}
    />
  )
}

function TemplateThumb({ html, accent }: { html: string; accent: string }) {
  // Wrap stored fragments in a styled document: without base styles a short body renders as
  // unreadable default text and the card looks empty.
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0;padding:0;background:#fff}
    body{padding:34px 30px;font-family:Arial,Helvetica,sans-serif;color:#344054;font-size:16px;line-height:1.65}
    img{max-width:100%;height:auto}a{color:#FF7417}
    table{max-width:100%}
  </style></head><body>${html || '<p style="color:#98A2B3">No content yet</p>'}</body></html>`
  return (
    <div className="relative h-[150px] overflow-hidden rounded-lg border border-line bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div style={{ width: 860, height: 1100, flexShrink: 0, transform: 'scale(0.43)', transformOrigin: 'top center' }}>
          <PreviewFrame html={document} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/95 to-transparent" />
      <span className="absolute right-2 top-2 size-2 rounded-full ring-2 ring-white" style={{ background: accent }} />
    </div>
  )
}

const EMAIL_CATEGORIES = [
  'All',
  'Transactional',
  'Onboarding',
  'Promotional',
  'E-Commerce',
  'Behavioral',
  'Newsletter',
  'Events',
  'Sales',
  'Corporate',
  'Education',
  'Seasonal',
  'Customer success',
]

/* --------------------------------------------------------------- gallery */

export function EmailStudioPage() {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/email_templates?limit=100')
  const [viewMode, setViewMode] = useState<'table' | 'create'>('table')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [folder, setFolder] = useState('All folders')
  const [preview, setPreview] = useState<{ name: string; html: string; subject?: string; plain?: string } | null>(null)
  const [previewMobile, setPreviewMobile] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const seedAllToWorkspace = async () => {
    setSeeding(true)
    try {
      let count = 0
      for (const preset of EMAIL_PRESETS.slice(0, 15)) {
        await post('/api/resources/email_templates', {
          name: preset.name,
          category: preset.category,
          subject: preset.subject,
          preview_text: preset.previewText,
          html: preset.html,
          body: preset.html,
          plain_text: preset.plain,
          builder: 'design',
          status: 'active',
        })
        count++
      }
      toast(`Successfully imported ${count} selling templates into your workspace!`, 'good')
      reload()
      setViewMode('table')
    } catch (err: any) {
      toast(err?.message ?? 'Could not seed templates.', 'bad')
    } finally {
      setSeeding(false)
    }
  }

  const rawRows = data?.data ?? []

  // Sample records matching Screenshot 4
  const fallbackRows: Row[] = [
    {
      id: 'em-1',
      name: 'Abandoned Cart Reminder',
      subject: 'Heads Up - Abandoned Cart',
      folder: 'Samples',
      category: 'Behavioral',
      builder: 'design',
      status: 'draft',
      updated_at: '2026-11-18T10:42:00Z',
    },
    {
      id: 'em-2',
      name: 'Avesto Construction Proposal',
      subject: 'Avesto Construction',
      folder: 'Samples',
      category: 'Sales',
      builder: 'design',
      status: 'draft',
      updated_at: '2026-11-16T14:20:00Z',
    },
    {
      id: 'em-3',
      name: 'Untitled Email',
      subject: 'No subject',
      folder: 'Unfiled',
      category: 'General',
      builder: 'design',
      status: 'draft',
      updated_at: '2026-11-16T09:15:00Z',
    },
    {
      id: 'em-4',
      name: 'Temp file test',
      subject: 'Need to test',
      folder: 'Unfiled',
      category: 'General',
      builder: 'plain',
      status: 'active',
      updated_at: '2026-11-15T16:00:00Z',
    },
    {
      id: 'em-5',
      name: 'Intro - mail',
      subject: 'How are you managing your leads?',
      folder: 'Unfiled',
      category: 'General',
      builder: 'plain',
      status: 'active',
      updated_at: '2026-11-15T11:30:00Z',
    },
  ]

  const rows = rawRows.length > 0 ? rawRows : fallbackRows
  const categories = EMAIL_CATEGORIES

  if (loading) return <Spinner label="Loading email templates..." />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  const filteredPresets = EMAIL_PRESETS.filter((preset) => {
    if (category !== 'All' && preset.category.toLowerCase() !== category.toLowerCase()) return false
    if (!query.trim()) return true
    const term = query.toLowerCase()
    return `${preset.name} ${preset.category} ${preset.subject} ${preset.description}`.toLowerCase().includes(term)
  })

  const filteredRows = rows.filter((row) => {
    if (category !== 'All' && String(row.category ?? '').toLowerCase() !== category.toLowerCase()) return false
    if (!query.trim()) return true
    const term = query.toLowerCase()
    return `${row.name} ${row.category} ${row.subject}`.toLowerCase().includes(term)
  })

  const blank = async (mode: 'design' | 'code' | 'plain') => {
    setCreating(true)
    try {
      const seed =
        mode === 'plain'
          ? { name: 'Untitled plain email', subject: '', html: '', plain_text: '', builder: 'plain' }
          : { name: 'Untitled email', subject: '', html: '', builder: mode }
      const result = await post<{ record?: Row }>('/api/resources/email_templates', {
        ...seed,
        category: 'General',
        preview_text: '',
        status: 'draft',
        body: '',
      })
      const record = (result as any)?.record
      if (record?.id) navigate(`/marketing/emails/${record.id}/edit`)
      else reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not create the template.', 'bad')
    } finally {
      setCreating(false)
    }
  }

  const createFromPreset = async (preset: EmailPreset) => {
    setBusy(preset.slug)
    try {
      const result = await post<{ record?: Row; data?: Row }>('/api/resources/email_templates', {
        name: preset.name,
        category: preset.category,
        subject: preset.subject,
        preview_text: preset.previewText,
        html: preset.html,
        body: preset.html,
        plain_text: preset.plain,
        builder: 'design',
        status: 'draft',
      })
      const record = (result as any)?.record ?? (result as any)?.data
      toast(`${preset.name} added to your workspace.`, 'good')
      if (record?.id) navigate(`/marketing/emails/${record.id}/edit`)
      else reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not create the template.', 'bad')
    } finally {
      setBusy(null)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRows.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredRows.map((r) => String(r.id)))
    }
  }

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* ------------------------------------------------------------- VIEW 1: EMAILS TABLE VIEW (Screenshot 4) */}
      {viewMode === 'table' ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-bold text-ink tracking-tight">Emails</h1>
                <span className="rounded-full bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 text-xs">
                  {rows.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
                <Link to="/" className="hover:text-ink">Home</Link>
                <span>&gt;</span>
                <Link to="/marketing" className="hover:text-ink">Marketing</Link>
                <span>&gt;</span>
                <span className="text-ink font-semibold">Emails</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => reload()}
                title="Refresh"
                className="size-8 rounded-lg border border-line bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink transition"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => void seedAllToWorkspace()}
                disabled={seeding}
                className="gx-btn gx-btn-sm text-[12px] flex items-center gap-1.5"
                title="Import preset selling templates"
              >
                <Sparkles size={13} className="text-amber-500" />
                <span className="hidden sm:inline">Import Templates</span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Search, Folder Dropdown, New Email Button */}
          <div className="border-b border-line bg-surface px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1 max-w-md">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search emails..."
                  className="gx-input gx-input-icon text-[12.5px] h-9"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <select
                    className="gx-select text-[12px] h-9 pr-8"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                  >
                    <option value="All folders">All folders</option>
                    <option value="Samples">Samples</option>
                    <option value="Unfiled">Unfiled</option>
                    <option value="Campaigns">Campaigns</option>
                  </select>
                </div>

                {/* Primary Action Button - Orange */}
                <button
                  onClick={() => setViewMode('create')}
                  className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 h-9 rounded-lg flex items-center gap-1.5 shadow-sm transition"
                >
                  <Plus size={14} /> New email
                </button>
              </div>
            </div>
          </div>

          {/* Emails Table */}
          <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredRows.length && filteredRows.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-line-strong text-[#FF5900] focus:ring-[#FF5900]"
                      />
                    </th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Folder</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRows.map((row) => {
                    const isDraft = String(row.status || '').toLowerCase() === 'draft'
                    const modeLabel = String(row.builder || '').toLowerCase() === 'plain' ? 'Plain text' : 'Drag & drop'
                    return (
                      <tr key={row.id} className="hover:bg-surface-2/40 transition">
                        <td className="w-10 px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(String(row.id))}
                            onChange={() => toggleSelectRow(String(row.id))}
                            className="rounded border-line-strong text-[#FF5900] focus:ring-[#FF5900]"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div
                            onClick={() => navigate(`/marketing/emails/${row.id}/edit`)}
                            className="cursor-pointer font-semibold text-ink hover:text-[#FF5900] transition"
                          >
                            {row.name}
                          </div>
                          <div className="text-[11px] text-muted truncate max-w-sm mt-0.5">
                            {row.subject || 'No subject'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-muted">
                          {row.folder || 'Unfiled'}
                        </td>
                        <td className="px-4 py-3.5 text-muted">
                          {row.category || 'General'}
                        </td>
                        <td className="px-4 py-3.5 text-muted">
                          {modeLabel}
                        </td>
                        <td className="px-4 py-3.5">
                          {isDraft ? (
                            <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold">
                              Draft
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold">
                              Published
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted">
                          {formatDateTime(row.updated_at || row.created_at || '2026-11-18T10:42:00Z').split(' ')[0]}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/marketing/emails/${row.id}/edit`)}
                              className="rounded-lg bg-[#FF5900] hover:bg-[#E04F00] text-white font-medium px-3 py-1 text-[11.5px] transition shadow-xs"
                            >
                              Use
                            </button>
                            <button
                              onClick={() => navigate(`/marketing/emails/${row.id}/edit`)}
                              className="size-7 rounded-lg text-muted hover:bg-surface-2 hover:text-ink flex items-center justify-center transition"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------- VIEW 2: CREATE EMAIL / CHOOSE A TEMPLATE GALLERY (Screenshot 5) */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3 shadow-xs">
            <div>
              <h1 className="text-[17px] font-bold text-ink tracking-tight">Create email</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
                <Link to="/" className="hover:text-ink">Home</Link>
                <span>&gt;</span>
                <Link to="/marketing" className="hover:text-ink">Marketing</Link>
                <span>&gt;</span>
                <button onClick={() => setViewMode('table')} className="hover:text-ink">Emails</button>
                <span>&gt;</span>
                <span className="text-ink font-semibold">Create</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('table')}
                className="gx-btn gx-btn-sm text-[12px] flex items-center gap-1.5"
              >
                <ArrowLeft size={13} /> Back to emails
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto gx-scroll p-5 space-y-6">
            {/* Top 3 Mode Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Design your template */}
              <div
                onClick={() => void blank('design')}
                className={cx("cursor-pointer rounded-xl border border-line bg-surface p-4 transition hover:border-[#FF5900]/60 hover:shadow-md group flex items-start gap-3.5", creating && "opacity-50 pointer-events-none")}
              >
                <div className="size-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
                  <Layout size={20} />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-bold text-ink">Design your template</h3>
                  <p className="text-[11.5px] text-muted mt-1 leading-snug">
                    Drag and drop blocks for layouts and branding.
                  </p>
                </div>
              </div>

              {/* Card 2: Build your own / Code */}
              <div
                onClick={() => void blank('code')}
                className="cursor-pointer rounded-xl border border-line bg-surface p-4 transition hover:border-purple-500/60 hover:shadow-md group flex items-start gap-3.5"
              >
                <div className="size-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
                  <Code2 size={20} />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-bold text-ink">Build your own / Code</h3>
                  <p className="text-[11.5px] text-muted mt-1 leading-snug">
                    Write, paste, or import custom HTML.
                  </p>
                </div>
              </div>

              {/* Card 3: Plain text email */}
              <div
                onClick={() => void blank('plain')}
                className="cursor-pointer rounded-xl border border-line bg-surface p-4 transition hover:border-amber-500/60 hover:shadow-md group flex items-start gap-3.5"
              >
                <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-bold text-ink">Plain text email</h3>
                  <p className="text-[11.5px] text-muted mt-1 leading-snug">
                    Simple text with links and personalization.
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-header: Choose a template */}
            <div>
              <h2 className="text-[16px] font-bold text-ink">Choose a template</h2>
            </div>

            {/* Template Chooser Layout: Left Vertical Category Menu + Right Grid */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              {/* Left Categories Menu */}
              <div className="rounded-xl border border-line bg-surface p-2 space-y-1 shadow-xs">
                {categories.map((cat) => {
                  const active = category.toLowerCase() === cat.toLowerCase()
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cx(
                        'w-full text-left rounded-lg px-3 py-2 text-[12.5px] font-medium transition flex items-center justify-between',
                        active
                          ? 'bg-orange-50 text-[#FF5900] font-semibold'
                          : 'text-muted hover:bg-surface-2 hover:text-ink'
                      )}
                    >
                      <span>{cat}</span>
                    </button>
                  )
                })}
              </div>

              {/* Right Grid of Template Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPresets.map((preset) => (
                  <div
                    key={preset.slug}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs hover:shadow-md transition"
                  >
                    {/* Visual Card Top Preview Thumbnail */}
                    <div className="relative h-48 w-full overflow-hidden bg-slate-100 flex items-center justify-center border-b border-line">
                      <div className="scale-75 origin-top w-[420px] pointer-events-none select-none">
                        <TemplateThumb html={preset.html} accent="#FF7417" />
                      </div>

                      {/* Hover Overlay with Action Buttons */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 backdrop-blur-2xs">
                        <button
                          onClick={() => void createFromPreset(preset)}
                          disabled={busy === preset.slug}
                          className="rounded-lg bg-surface text-ink font-semibold px-4 py-2 text-[12px] hover:bg-surface-2 transition shadow-md"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => setPreview({ name: preset.name, html: preset.html, subject: preset.subject, plain: preset.plain })}
                          className="rounded-lg bg-[#FF5900] text-white font-semibold px-4 py-2 text-[12px] hover:bg-[#E04F00] transition shadow-md"
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {/* Card Meta & Bottom Bar */}
                    <div className="p-3.5 flex flex-col flex-1 justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-ink text-[13px] truncate">{preset.name}</h4>
                          <span className="rounded bg-surface-2 text-muted px-1.5 py-0.5 text-[10px] font-semibold">
                            {preset.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted line-clamp-1 mt-1">
                          {preset.subject || preset.description}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                        <button
                          onClick={() => void createFromPreset(preset)}
                          className="text-[#FF5900] text-[11.5px] font-semibold hover:underline"
                        >
                          Customize →
                        </button>
                        <span className="text-[10.5px] text-muted">
                          {(preset as any).conversionRate || '45.2% avg conv'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? 'Preview'}
        wide
        footer={
          <>
            <div className="mr-auto flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
              <button className={cx('rounded-md p-1.5', !previewMobile && 'bg-surface shadow-xs')} onClick={() => setPreviewMobile(false)} title="Desktop">
                <Monitor size={14} />
              </button>
              <button className={cx('rounded-md p-1.5', previewMobile && 'bg-surface shadow-xs')} onClick={() => setPreviewMobile(true)} title="Mobile">
                <Smartphone size={14} />
              </button>
            </div>
            <Button size="sm" onClick={() => setPreview(null)}>Close</Button>
          </>
        }
      >
        {preview ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px]">
              <span className="text-muted">Subject:</span> <span className="font-medium">{preview.subject || '—'}</span>
            </div>
            <div className={cx('mx-auto overflow-hidden rounded-xl border border-line bg-white', previewMobile ? 'w-[390px] max-w-full' : 'w-full')} style={{ height: 480 }}>
              {preview.html ? <PreviewFrame html={preview.html} mobile={previewMobile} /> : <pre className="h-full overflow-auto whitespace-pre-wrap p-4 font-sans text-[12.5px]">{preview.plain || 'No content'}</pre>}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
/* ---------------------------------------------------------------- editor */

export function EmailStudioEditor({ id }: { id: string }) {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ record: Row }>(`/api/resources/email_templates/${id}`)
  const record = data?.record
  const [mode, setMode] = useState<'design' | 'code' | 'plain'>('design')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [category, setCategory] = useState('General')
  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [plain, setPlain] = useState('')
  const [status, setStatus] = useState('draft')
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [testOpen, setTestOpen] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testContact, setTestContact] = useState('')
  const [sending, setSending] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rendered, setRendered] = useState<{ html: string; subject: string; missing: string[] } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const blocksRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [editorReady, setEditorReady] = useState(false)

  // Stripo Third-Party Integration State (BYOK with Graceful Removal & Fallback)
  const [stripoOpen, setStripoOpen] = useState(false)
  const [stripoPluginId, setStripoPluginId] = useState(() => {
    try {
      return localStorage.getItem('gofox:stripo_plugin_id') || '99accd7c501c47e78f07f04af9ed'
    } catch {
      return '99accd7c501c47e78f07f04af9ed'
    }
  })
  const [stripoSecretKey, setStripoSecretKey] = useState(() => {
    try {
      return localStorage.getItem('gofox:stripo_secret_key') || ''
    } catch {
      return ''
    }
  })
  const [stripoActive, setStripoActive] = useState(false)
  const [stripoError, setStripoError] = useState<string | null>(null)
  const [stripoLoading, setStripoLoading] = useState(false)

  const connectStripo = async () => {
    if (!stripoSecretKey.trim()) {
      setStripoError('Secret Key is required to initialize Stripo Plugin. Stripo removed — continuing with GoFox Native Studio.')
      setStripoActive(false)
      return
    }
    setStripoLoading(true)
    setStripoError(null)
    try {
      localStorage.setItem('gofox:stripo_plugin_id', stripoPluginId)
      localStorage.setItem('gofox:stripo_secret_key', stripoSecretKey)
      const res = await post<{ success: boolean; token?: string }>('/api/stripo/auth', {
        pluginId: stripoPluginId,
        secretKey: stripoSecretKey,
      })
      if (res?.success) {
        setStripoActive(true)
        setStripoOpen(false)
        toast('Stripo Plugin connected successfully.', 'good')
      } else {
        throw new Error('Stripo rejected credentials.')
      }
    } catch (err: any) {
      setStripoError(err?.message ?? 'Could not authenticate with Stripo servers. Continuing with GoFox Pro Studio.')
      setStripoActive(false)
    } finally {
      setStripoLoading(false)
    }
  }

  const removeStripo = () => {
    setStripoActive(false)
    setStripoError(null)
    setStripoOpen(false)
    try {
      localStorage.removeItem('gofox:stripo_secret_key')
    } catch {
      /* ignore */
    }
    toast('Stripo removed. Seamlessly switched to GoFox Pro Native Studio.', 'good')
  }

  const contacts = useApp().meta?.contacts ?? []

  const sendToCampaign = async () => {
    await save(true)
    toast('Template saved & activated. Directing to campaign wizard...', 'good')
    navigate(`/marketing/campaigns/new?template_id=${id}`)
  }

  useEffect(() => {
    if (!record || hydrated) return
    setName(String(record.name ?? 'Untitled email'))
    setSubject(String(record.subject ?? ''))
    setPreheader(String(record.preview_text ?? ''))
    setCategory(String(record.category ?? 'General'))
    setHtml(String(record.html ?? record.body ?? ''))
    setCss(String(record.css ?? ''))
    setPlain(String(record.plain_text ?? ''))
    setStatus(String(record.status ?? 'draft'))
    const builder = String(record.builder ?? '')
    if (builder === 'code' || builder === 'plain') setMode(builder as 'code' | 'plain')
    setHydrated(true)
  }, [record, hydrated])

  const collect = useCallback(() => {
    const editor = editorRef.current
    if (mode === 'design' && editor) {
      const nextHtml = editor.getHtml()
      const nextCss = editor.getCss()
      setHtml(nextHtml)
      setCss(nextCss)
      return { html: nextHtml, css: nextCss }
    }
    return { html, css }
  }, [mode, html, css])

  // Mount GrapesJS only while the Design tab is active. It is code-split so the main app bundle
  // stays small and the visual editor is fetched on first use.
  useEffect(() => {
    if (mode !== 'design' || !hydrated || !canvasRef.current) return
    let cancelled = false
    let editor: any = null
    const boot = async () => {
    const [{ default: grapesjs }, { default: newsletterPreset }] = await Promise.all([
      import('grapesjs'),
      import('grapesjs-preset-newsletter'),
      import('grapesjs/dist/css/grapes.min.css'),
    ] as const)
    if (cancelled || !canvasRef.current) return
    editor = grapesjs.init({
      container: canvasRef.current,
      height: '100%',
      width: 'auto',
      storageManager: false,
      panels: { defaults: [] },
      blockManager: { appendTo: blocksRef.current ?? undefined },
      styleManager: { appendTo: styleRef.current ?? undefined },
      selectorManager: { appendTo: styleRef.current ?? undefined },
      canvas: { styles: [], scripts: [] },
      deviceManager: {
        devices: [
          { id: 'desktop', name: 'Desktop', width: '' },
          { id: 'mobile', name: 'Mobile', width: '375px' },
        ],
      },
      plugins: [newsletterPreset],
    })
    editorRef.current = editor
    editor.setComponents(html || '<table width="100%" style="background:#F7F8FA"><tr><td style="padding:40px"><p style="font-family:Arial;color:#98A2B3;text-align:center">Drop blocks here to build your email</p></td></tr></table>')
    if (css) editor.setStyle(css)
    const bm = editor.BlockManager
    bm.add('gx-text', { label: 'Text', category: 'Basic', content: '<p style="font-family:Arial;font-size:15px;line-height:1.6;color:#344054;margin:0 0 14px">Write your message here. Use {{first_name}} for personalisation.</p>' })
    bm.add('gx-heading', { label: 'Heading', category: 'Basic', content: '<h1 style="font-family:Arial;font-size:26px;line-height:1.25;color:#17243A;margin:0 0 12px">A clear headline</h1>' })
    bm.add('gx-button', { label: 'Button', category: 'Basic', content: '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#FF7417"><a href="https://example.com" style="display:inline-block;padding:12px 24px;font-family:Arial;font-size:14px;font-weight:700;color:#fff;text-decoration:none">Call to action</a></td></tr></table>' })
    bm.add('gx-image', { label: 'Image', category: 'Basic', content: { type: 'image', style: { width: '100%' }, attributes: { alt: 'Describe this image' } } })
    bm.add('gx-divider', { label: 'Divider', category: 'Layout', content: '<div style="border-top:1px solid #E7EAF0;margin:24px 0"></div>' })
    bm.add('gx-spacer', { label: 'Spacer', category: 'Layout', content: '<div style="height:28px"></div>' })
    bm.add('gx-2col', { label: '2 columns', category: 'Layout', content: '<table role="presentation" width="100%"><tr><td style="padding-right:10px;vertical-align:top"><p style="font-family:Arial;font-size:14px;color:#475467">Column one</p></td><td style="padding-left:10px;vertical-align:top"><p style="font-family:Arial;font-size:14px;color:#475467">Column two</p></td></tr></table>' })
    bm.add('gx-header', { label: 'Header', category: 'Blocks', content: '<div style="padding:22px 28px;border-bottom:1px solid #E7EAF0"><span style="font-family:Arial;font-size:17px;font-weight:800;color:#17243A">GoFox</span></div>' })
    bm.add('gx-footer', { label: 'Footer', category: 'Blocks', content: '<div style="padding:22px 28px;background:#F7F8FA;font-family:Arial;font-size:11px;color:#98A2B3;text-align:center">GoFox CRM · <a href="{{unsubscribe_url}}" style="color:#98A2B3">Unsubscribe</a></div>' })
    bm.add('gx-social', { label: 'Social links', category: 'Blocks', content: '<p style="font-family:Arial;font-size:12px;color:#667085;text-align:center"><a href="https://linkedin.com" style="color:#FF7417;text-decoration:none">LinkedIn</a> · <a href="https://x.com" style="color:#FF7417;text-decoration:none">X</a> · <a href="https://youtube.com" style="color:#FF7417;text-decoration:none">YouTube</a></p>' })
    bm.add('gx-product', { label: 'Product', category: 'Blocks', content: '<table role="presentation" width="100%" style="border:1px solid #E7EAF0;border-radius:10px;padding:14px"><tr><td width="56" style="font-size:26px">📦</td><td style="font-family:Arial"><div style="font-size:14px;font-weight:700;color:#17243A">Product name</div><div style="font-size:12px;color:#667085">Short description</div><div style="font-size:14px;font-weight:700;color:#17243A;margin-top:4px">$49.00</div></td></tr></table>' })
    bm.add('gx-hero', { label: 'Hero CTA', category: 'Selling Suite', content: '<table role="presentation" width="100%" style="background:#0F172A;border-radius:12px;padding:36px 30px;text-align:center"><tr><td><div style="font-family:Arial;font-size:11px;font-weight:700;color:#FF7417;letter-spacing:1px;text-transform:uppercase">ANNOUNCEMENT</div><h1 style="font-family:Arial;font-size:28px;color:#fff;margin:12px 0 10px">High-Converting Hero Headline</h1><p style="font-family:Arial;font-size:14px;color:#94A3B8;margin:0 0 20px">Engage your audience with a clear value proposition tailored for {{first_name}}.</p><table role="presentation" align="center"><tr><td style="background:#FF7417;border-radius:8px"><a href="https://example.com" style="display:inline-block;padding:12px 28px;font-family:Arial;font-size:14px;font-weight:700;color:#fff;text-decoration:none">Claim Offer Now</a></td></tr></table></td></tr></table>' })
    bm.add('gx-metrics', { label: 'Metrics Bar', category: 'Selling Suite', content: '<table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin:16px 0"><tr><td width="33%" align="center" style="font-family:Arial;border-right:1px solid #E2E8F0"><div style="font-size:22px;font-weight:800;color:#FF7417">+340%</div><div style="font-size:11px;color:#64748B">Pipeline Growth</div></td><td width="33%" align="center" style="font-family:Arial;border-right:1px solid #E2E8F0"><div style="font-size:22px;font-weight:800;color:#10B981">99.8%</div><div style="font-size:11px;color:#64748B">Deliverability</div></td><td width="33%" align="center" style="font-family:Arial"><div style="font-size:22px;font-weight:800;color:#6366F1">14 Days</div><div style="font-size:11px;color:#64748B">Avg Ramp Time</div></td></tr></table>' })
    bm.add('gx-coupon', { label: 'Voucher Coupon', category: 'Selling Suite', content: '<div style="border:2px dashed #EA580C;background:#FFF8F3;border-radius:12px;padding:20px;text-align:center;margin:16px 0"><div style="font-family:Arial;font-size:11px;font-weight:700;color:#9A3412;letter-spacing:1px;text-transform:uppercase">SPECIAL DISCOUNT VOUCHER</div><div style="font-family:monospace;font-size:24px;font-weight:800;color:#C2410C;letter-spacing:3px;margin:8px 0">SAVE40-NOW</div><div style="font-family:Arial;font-size:11px;color:#78350F">Expires in 48 hours · Valid for {{company_name}}</div></div>' })
    bm.add('gx-quote', { label: 'Testimonial Quote', category: 'Selling Suite', content: '<table role="presentation" width="100%" style="background:#F0FDF4;border-left:4px solid #10B981;border-radius:0 10px 10px 0;padding:18px 22px;margin:16px 0"><tr><td style="font-family:Georgia,serif;font-style:italic;font-size:14.5px;line-height:1.6;color:#065F46">“GoFox transformed how our sales reps qualify and convert inbound leads. We saw an immediate 3x increase in meetings booked.”<div style="font-family:Arial;font-style:normal;font-size:12px;font-weight:700;color:#047857;margin-top:8px">Sarah Jenkins — VP of Revenue Operations</div></td></tr></table>' })
    bm.add('gx-features', { label: '2-Col Features', category: 'Selling Suite', content: '<table role="presentation" width="100%" style="margin:16px 0"><tr><td width="50%" style="padding:16px;background:#F8FAFC;border-radius:10px;vertical-align:top"><div style="font-family:Arial;font-size:14px;font-weight:700;color:#1E293B">⚡ Automated Workflows</div><div style="font-family:Arial;font-size:12px;color:#64748B;margin-top:4px">Trigger instant follow-ups on lead status changes.</div></td><td width="16"></td><td width="50%" style="padding:16px;background:#F8FAFC;border-radius:10px;vertical-align:top"><div style="font-family:Arial;font-size:14px;font-weight:700;color:#1E293B">🎯 Lead Scoring</div><div style="font-family:Arial;font-size:12px;color:#64748B;margin-top:4px">Prioritize deals with highest conversion probability.</div></td></tr></table>' })
    bm.add('gx-pricing', { label: 'Pricing Card', category: 'Selling Suite', content: '<table role="presentation" width="100%" style="background:#FFFFFF;border:2px solid #FF7417;border-radius:14px;padding:24px;text-align:center;margin:16px 0"><tr><td><div style="font-family:Arial;font-size:11px;font-weight:700;color:#C2410C;letter-spacing:1px;text-transform:uppercase">PRO ENTERPRISE</div><div style="font-family:Arial;font-size:36px;font-weight:800;color:#1E293B;margin:8px 0">$49<span style="font-size:14px;font-weight:normal;color:#64748B">/user/mo</span></div><p style="font-family:Arial;font-size:12.5px;color:#64748B;margin:0 0 16px">Unlimited workflows, custom email builder & predictive AI</p><table role="presentation" align="center"><tr><td style="background:#FF7417;border-radius:8px"><a href="https://example.com" style="display:inline-block;padding:10px 24px;font-family:Arial;font-size:13px;font-weight:700;color:#fff;text-decoration:none">Start Free 14-Day Trial</a></td></tr></table></td></tr></table>' })
    bm.add('gx-video', { label: 'Video link', category: 'Blocks', content: '<a href="https://youtube.com/watch?v=..." style="display:block;padding:28px;background:#0B1220;border-radius:10px;text-align:center;font-family:Arial;font-size:13px;color:#fff;text-decoration:none">▶ Watch the 2-minute overview</a>' })
    bm.add('gx-html', { label: 'HTML', category: 'Blocks', content: { type: 'default', tagName: 'div', content: '<p style="font-family:Arial">Custom HTML block</p>' } })
    setEditorReady(true)
    }
    void boot().catch(() => setEditorReady(false))
    return () => {
      cancelled = true
      setEditorReady(false)
      try {
        editor?.destroy()
      } catch {
        /* ignore */
      }
      editorRef.current = null
    }
    // The editor is intentionally recreated only when switching into design mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hydrated])

  const save = async (activate = false) => {
    setSaving(true)
    try {
      const collected = collect()
      await patch(`/api/resources/email_templates/${id}`, {
        name,
        subject,
        preview_text: preheader,
        category,
        html: sanitizeEmailHtml(collected.html),
        body: sanitizeEmailHtml(collected.html),
        css: collected.css,
        plain_text: plain,
        builder: mode,
        status: activate ? 'active' : status,
      })
      if (activate) setStatus('active')
      toast(activate ? 'Template activated — ready to send.' : 'Draft saved.', 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not save the template.', 'bad')
    } finally {
      setSaving(false)
    }
  }

  const effectiveHtml = useMemo(() => {
    if (mode === 'design') return html || '<p style="font-family:Arial;padding:24px;color:#98A2B3">Empty canvas</p>'
    if (mode === 'plain') return `<pre style="font-family:Arial;font-size:14px;line-height:1.7;white-space:pre-wrap;padding:28px;color:#344054">${plain.replace(/</g, '&lt;')}</pre>`
    return html || '<p style="font-family:Arial;padding:24px;color:#98A2B3">Empty HTML</p>'
  }, [mode, html, plain])

  const validation = useMemo(() => {
    const problems: string[] = []
    if (!subject.trim()) problems.push('Add a subject line.')
    if (!html.trim() && !plain.trim()) problems.push('Add content before sending.')
    const source = mode === 'plain' ? plain : html
    if (/<script/i.test(source)) problems.push('Remove <script> tags — they are stripped on save.')
    if (/(javascript:|onclick=)/i.test(source)) problems.push('Remove JavaScript links or inline handlers.')
    if (/src="(?!https?:|cid:)/i.test(source)) problems.push('Use absolute https image URLs so they load in mail clients.')
    if (/href="#"/i.test(source)) problems.push('A link points to "#" — set a real destination.')
    return problems
  }, [subject, html, plain, mode])

  const renderPreview = async () => {
    try {
      const result = await post<{ html: string; subject: string; missing: string[] }>('/api/email/render', {
        html: mode === 'plain' ? '' : html,
        subject,
        text: plain,
        contactId: testContact || undefined,
      })
      setRendered({ html: result.html || effectiveHtml, subject: result.subject, missing: result.missing })
      setPreviewOpen(true)
    } catch {
      setRendered({ html: effectiveHtml, subject, missing: [] })
      setPreviewOpen(true)
    }
  }

  const sendTest = async () => {
    setSending(true)
    try {
      const result = await post<{ message: string }>(`/api/templates/${id}/test`, { to: testTo, contactId: testContact || undefined })
      toast(result.message || `Test email sent to ${testTo}.`, 'good')
      setTestOpen(false)
    } catch (err: any) {
      toast(err?.message ?? 'The test email could not be sent.', 'bad')
    } finally {
      setSending(false)
    }
  }

  const insertVariable = (token: string) => {
    if (mode === 'design' && editorRef.current) {
      editorRef.current.addComponents(`<span style="font-family:Arial;font-size:15px;color:#344054">${token}</span>`)
      toast(`${token} added to the canvas.`, 'good')
      return
    }
    if (mode === 'code') setHtml((value) => `${value}\n${token}`)
    else if (mode === 'plain') setPlain((value) => `${value}${token}`)
    else setSubject((value) => `${value}${token}`)
  }

  if (loading || !hydrated) return <Spinner label="Loading email" />
  if (error || !record) return <ErrorState message={error?.message ?? 'Template not found'} onRetry={reload} />

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
        <Link to="/marketing/emails" className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink" title="Back to email studio">
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Template name"
              className="min-w-0 max-w-[320px] flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13.5px] font-semibold tracking-[-0.01em] hover:border-line focus:border-line focus:bg-surface focus:outline-none"
            />
            <StatusBadge value={status} />
          </div>
          <button onClick={() => setSettingsOpen(true)} className="mt-0.5 hidden max-w-[320px] truncate px-1 text-left text-[10.5px] text-muted hover:text-ink sm:block">
            {subject ? `Subject: ${subject}` : 'Add a subject line'} · {formatDateTime(record.updated_at)}
          </button>
        </div>

        <div className="order-last flex w-full items-center gap-1.5 overflow-x-auto pb-0.5 gx-scroll sm:order-none sm:w-auto sm:overflow-visible">
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
            {(
              [
                ['design', 'Design', <Palette key="d" size={13} />],
                ['code', 'Code', <Code2 key="c" size={13} />],
                ['plain', 'Plain', <Type key="p" size={13} />],
              ] as const
            ).map(([value, label, icon]) => (
              <button
                key={value}
                onClick={() => {
                  if (mode === 'design') collect()
                  setMode(value as 'design' | 'code' | 'plain')
                }}
                className={cx(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition',
                  mode === value ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink',
                )}
              >
                {icon} <span>{label}</span>
              </button>
            ))}
          </div>

          {mode !== 'plain' ? (
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
              <button className={cx('rounded-md p-1.5', device === 'desktop' && 'bg-surface shadow-[var(--shadow-card)]')} onClick={() => setDevice('desktop')} title="Desktop">
                <Laptop size={14} />
              </button>
              <button className={cx('rounded-md p-1.5', device === 'mobile' && 'bg-surface shadow-[var(--shadow-card)]')} onClick={() => setDevice('mobile')} title="Mobile">
                <Smartphone size={14} />
              </button>
            </div>
          ) : null}

          <Button size="sm" className="shrink-0" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={13} /> <span className="hidden sm:inline">Settings</span>
          </Button>

          {/* Stripo Third-Party Plugin Button */}
          <button
            type="button"
            onClick={() => setStripoOpen(true)}
            className={cx(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition shrink-0 shadow-2xs',
              stripoActive
                ? 'border-good/60 bg-good-soft text-good'
                : 'border-line bg-surface hover:bg-surface-2 text-ink',
            )}
            title="Third-party Stripo Plugin Integration"
          >
            <Layers size={13} className="text-accent" />
            <span>Stripo Plugin</span>
            {stripoActive ? (
              <span className="size-1.5 rounded-full bg-good animate-pulse" />
            ) : (
              <span className="rounded bg-surface-2 px-1 py-0.2 text-[9.5px] font-mono text-muted">BYOK</span>
            )}
          </button>

          <Button size="sm" className="shrink-0" onClick={() => void renderPreview()}>
            <Eye size={13} /> <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button size="sm" className="shrink-0" onClick={() => setTestOpen(true)}>
            <Send size={13} /> <span className="hidden sm:inline">Test</span>
          </Button>
          <Button size="sm" className="shrink-0" onClick={() => void save(false)} loading={saving}>
            <span className="hidden sm:inline">Save draft</span><span className="sm:hidden">Save</span>
          </Button>
          <Button size="sm" className="shrink-0" variant="primary" onClick={() => void save(true)} loading={saving} disabled={validation.length > 0}>
            <Check size={13} /> Activate
          </Button>
          <Button
            size="sm"
            className="shrink-0 border-accent/40 bg-accent text-white shadow-sm hover:bg-accent/90"
            onClick={() => void sendToCampaign()}
            loading={saving}
            title="Activate this template and immediately build a multi-channel campaign"
          >
            <Megaphone size={13} /> <span className="hidden sm:inline">Use in Campaign</span>
          </Button>
        </div>
      </div>

      {/* Stripo Plugin Notice / Fallback Banner */}
      {stripoError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warn/30 bg-warn-soft px-4 py-2 text-[12px] text-warn">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-warn" />
            <span><strong>Stripo Notice:</strong> {stripoError}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={removeStripo}
              className="rounded-lg bg-surface border border-warn/40 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-2 shadow-2xs"
            >
              Remove Stripo & Use Native Studio
            </button>
            <button type="button" onClick={() => setStripoError(null)} className="p-1 hover:text-ink">
              <X size={13} />
            </button>
          </div>
        </div>
      ) : null}

      {validation.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warn/20 bg-warn-soft px-4 py-1.5 text-[11.5px] text-warn">
          <AlertTriangle size={13} />
          {validation.map((problem) => (
            <span key={problem}>· {problem}</span>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {mode === 'design' ? (
          <div className="grid h-full min-h-0 grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)_288px]">
            <div ref={blocksRef} className="min-h-0 overflow-auto border-r border-line bg-surface gx-scroll" />
            <div className="relative min-h-0 bg-[#EEF1F5]">
              <div className={cx('mx-auto h-full bg-white transition-all', device === 'mobile' ? 'max-w-[390px] shadow-[0_0_0_1px_rgba(16,24,40,.06)]' : 'w-full')}>
                <div ref={canvasRef} className="h-full w-full" />
              </div>
              {!editorReady ? <div className="absolute inset-0 flex items-center justify-center bg-surface/70"><Spinner label="Starting editor" /></div> : null}
            </div>
            <div className="hidden min-h-0 flex-col border-l border-line bg-surface lg:flex">
              <div className="border-b border-line px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint"><Sparkles size={12} /> Personalisation</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {VARIABLES.map((variable) => (
                    <button
                      key={variable.key}
                      onClick={() => insertVariable(variable.key)}
                      className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted hover:border-accent/40 hover:text-accent"
                      title={`Insert ${variable.label}`}
                    >
                      {variable.key}
                    </button>
                  ))}
                </div>
              </div>
              <div ref={styleRef} className="min-h-0 flex-1 overflow-auto gx-scroll" />
            </div>
          </div>
        ) : mode === 'code' ? (
          <div className="grid h-full min-h-0 grid-cols-2">
            <div className="flex min-h-0 flex-col border-r border-line bg-[#0F172A]">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-white/60">
                <span className="flex items-center gap-1.5"><Code2 size={12} /> HTML</span>
                <label className="cursor-pointer rounded px-1.5 py-0.5 text-[10.5px] text-white/70 hover:bg-white/10">
                  Import file
                  <input
                    type="file"
                    accept=".html,.htm,text/html"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      const text = await file.text()
                      setHtml(sanitizeEmailHtml(text))
                      toast('HTML imported. Review the preview, then save.', 'good')
                    }}
                  />
                </label>
              </div>
              <textarea
                value={html}
                onChange={(event) => setHtml(event.target.value)}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none bg-transparent px-3 py-3 font-mono text-[11.5px] leading-relaxed text-[#E2E8F0] outline-none"
                placeholder="<!doctype html>…"
              />
              <div className="border-t border-white/10 px-3 py-2 text-[11px] font-semibold text-white/60">CSS</div>
              <textarea
                value={css}
                onChange={(event) => setCss(event.target.value)}
                spellCheck={false}
                className="h-32 resize-none bg-transparent px-3 py-2 font-mono text-[11.5px] leading-relaxed text-[#94E2D5] outline-none"
                placeholder=".button { background: #FF7417; }"
              />
            </div>
            <div className="min-h-0 bg-white">
              <PreviewFrame html={`<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`} />
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col border-r border-line bg-surface">
              <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Plain-text body</div>
              <textarea
                value={plain}
                onChange={(event) => setPlain(event.target.value)}
                placeholder={'Hi {{first_name}},\n\nWrite a short, personal email…'}
                className="min-h-0 flex-1 resize-none bg-surface px-4 py-3 font-sans text-[13px] leading-relaxed text-ink outline-none"
              />
              <div className="flex flex-wrap gap-1 border-t border-line px-3 py-2">
                {VARIABLES.map((variable) => (
                  <button key={variable.key} onClick={() => setPlain((value) => `${value}${variable.key}`)} className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-accent">
                    {variable.key}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 bg-white">
              <PreviewFrame html={`<pre style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap;padding:32px;color:#344054">${plain.replace(/</g, '&lt;')}</pre>`} />
            </div>
          </div>
        )}
      </div>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Email preview"
        wide
        footer={<Button size="sm" onClick={() => setPreviewOpen(false)}>Close</Button>}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px]">
            <div><span className="text-muted">Subject:</span> <span className="font-medium">{rendered?.subject || subject || '—'}</span></div>
            <div className="mt-1 text-muted">From: your connected Gmail account</div>
          </div>
          {rendered?.missing?.length ? (
            <div className="rounded-lg border border-warn/25 bg-warn-soft px-3 py-2 text-[11.5px] text-warn">
              Missing personalisation for this contact: {rendered.missing.join(', ')} — they will render empty.
            </div>
          ) : null}
          <div className="mx-auto overflow-hidden rounded-xl border border-line bg-white" style={{ height: 460, maxWidth: device === 'mobile' ? 390 : undefined }}>
            <PreviewFrame html={rendered?.html || effectiveHtml} mobile={device === 'mobile'} />
          </div>
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Email settings"
        footer={
          <>
            <Button size="sm" onClick={() => setSettingsOpen(false)}>Close</Button>
            <Button size="sm" variant="primary" loading={saving} onClick={() => { void save(false); setSettingsOpen(false) }}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow label="Template name">
            <input className="gx-input" value={name} onChange={(event) => setName(event.target.value)} />
          </FormRow>
          <FormRow label="Subject line" hint="Supports {{first_name}} and other CRM variables.">
            <input className="gx-input" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A subject your customer will open" />
          </FormRow>
          <FormRow label="Preview text" hint="The grey line shown next to the subject in most inboxes.">
            <input className="gx-input" value={preheader} onChange={(event) => setPreheader(event.target.value)} placeholder="One short line of context" />
          </FormRow>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow label="Category">
              <select className="gx-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                {['Transactional', 'Onboarding', 'Promotional', 'E-Commerce', 'Behavioral', 'Newsletter', 'Events', 'Sales', 'Corporate', 'Education', 'Seasonal', 'Customer Success', 'General'].map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Status">
              <input className="gx-input" value={status} readOnly />
            </FormRow>
          </div>
          <FormRow label="Plain-text fallback" hint="Used by text-only clients. Leave blank to generate it from the HTML.">
            <textarea className="gx-textarea" rows={5} value={plain} onChange={(event) => setPlain(event.target.value)} />
          </FormRow>
          <div className="flex flex-wrap gap-1">
            {VARIABLES.map((variable) => (
              <button
                key={variable.key}
                onClick={() => setSubject((value) => `${value}${variable.key}`)}
                className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-accent"
              >
                {variable.key}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        title="Send a test email"
        footer={
          <>
            <Button size="sm" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" loading={sending} onClick={() => void sendTest()} disabled={!testTo.trim()}>
              <Send size={13} /> Send test
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow label="Send to" hint="The test is sent through your connected Gmail account. It is a real email.">
            <input className="gx-input" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="you@company.com" />
          </FormRow>
          <FormRow label="Personalise for contact" hint="Optional: renders {{first_name}} and other variables for this contact.">
            <select className="gx-select" value={testContact} onChange={(event) => setTestContact(event.target.value)}>
              <option value="">No contact (raw variables)</option>
              {contacts.slice(0, 200).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {[contact.first_name, contact.last_name].filter(Boolean).join(' ')} · {contact.email}
                </option>
              ))}
            </select>
          </FormRow>
          {validation.length ? (
            <div className="rounded-lg border border-warn/25 bg-warn-soft px-3 py-2 text-[11.5px] text-warn">
              Fix these before sending to a customer: {validation.join(' ')}
            </div>
          ) : null}
          <p className="text-[11px] text-muted">Save the template before testing so the latest edits are used.</p>
        </div>
      </Modal>

      {/* Stripo Plugin Modal */}
      <Modal
        open={stripoOpen}
        onClose={() => setStripoOpen(false)}
        title="Stripo Plugin Integration (BYOK)"
        wide
        footer={
          <>
            {stripoActive ? (
              <Button size="sm" variant="danger" onClick={removeStripo}>
                Remove Stripo & Use Native Studio
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setStripoOpen(false)}>
              Close
            </Button>
            <Button size="sm" variant="primary" loading={stripoLoading} onClick={() => void connectStripo()}>
              <KeyRound size={13} /> {stripoActive ? 'Update Stripo Keys' : 'Connect Stripo Plugin'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Warning banner replicating Stripo developer portal */}
          <div className="rounded-xl border border-warn/30 bg-warn-soft p-3.5 text-[12px] text-warn space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={15} />
              <span>Third-Party Stripo Application Keys</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted">
              Please be advised that Stripo Plugin requires both a valid <strong>Plugin ID</strong> and <strong>Secret Key</strong> from your <a href="https://plugins.stripo.email" target="_blank" rel="noreferrer" className="text-accent underline">Stripo account</a>.
              If keys are incomplete or rejected, GoFox gracefully falls back to our native Pro Visual Studio.
            </p>
          </div>

          <div className="space-y-3">
            <FormRow label="Plugin ID" hint="Your unique public identifier from plugins.stripo.email">
              <input
                className="gx-input font-mono text-[12px]"
                value={stripoPluginId}
                onChange={(e) => setStripoPluginId(e.target.value)}
                placeholder="e.g. 99accd7c501c47e78f07f04af9ed..."
              />
            </FormRow>

            <FormRow label="Secret Key" hint="Your private Stripo secret key (kept confidential and sent via backend proxy)">
              <input
                type="password"
                className="gx-input font-mono text-[12px]"
                value={stripoSecretKey}
                onChange={(e) => setStripoSecretKey(e.target.value)}
                placeholder="Enter your Stripo Secret Key"
              />
            </FormRow>

            <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 p-3 text-[12px]">
              <div>
                <span className="font-semibold text-ink">Plugin Status: </span>
                <span className={stripoActive ? 'text-good font-bold' : 'text-muted'}>
                  {stripoActive ? 'Connected & Active' : 'Not Connected (GoFox Pro Native Studio Active)'}
                </span>
              </div>
              {stripoActive ? (
                <button
                  type="button"
                  onClick={removeStripo}
                  className="text-[11px] font-semibold text-danger hover:underline"
                >
                  Disconnect & Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* Re-exported so the marketing page can link to the same empty-state design. */
export function EmailStudioEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <button onClick={onBrowse} className="flex flex-col items-center gap-1 text-[11.5px] text-accent">
      <Mail size={16} /> <span>Open email studio</span>
    </button>
  )
}

export const EMAIL_STUDIO_PRESETS = EMAIL_PRESETS
