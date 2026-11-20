import { useEffect, useState, useMemo } from 'react'
import {
  Code2,
  Copy,
  FileCode,
  Grid,
  Heart,
  HelpCircle,
  Layout,
  List,
  Mail,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { post, del, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { useNavigate } from '../lib/router'
import { Button, ErrorState, Modal, cx } from '../components/ui'
import { EMAIL_PRESETS, type EmailPreset } from '../data/emailTemplates'
import { formatDateTime } from '../lib/format'
import { createEmptyDocument, isEmailDocument } from '../components/email-builder/document-model'
import { emailDocumentFromHtml } from '../components/email-builder/html-import'

/* ---------------------------------------------------------------- Tokens & Helpers */

const MARKETPLACE_CATEGORIES = [
  'All',
  'Newsletter',
  'Welcome',
  'Marketing',
  'Promotional',
  'Product Launch',
  'E-commerce',
  'SaaS',
  'Event',
  'Webinar',
  'Customer Engagement',
  'Sales',
  'Transactional',
  'HR',
] as const

type StudioTab = 'all' | 'recent' | 'mine' | 'favorites' | 'drafts' | 'marketplace'
type ViewLayout = 'grid' | 'table'

function PreviewFrame({ html, className, mobile = false }: { html: string; className?: string; mobile?: boolean }) {
  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={html}
      className={cx('h-full w-full border-0 bg-white transition-all duration-200', className)}
      style={mobile ? { width: 375, maxWidth: '100%', margin: '0 auto', display: 'block', height: '100%' } : { width: '100%', height: '100%' }}
    />
  )
}

function TemplateThumb({ html }: { html: string }) {
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0;padding:0;background:#fff}
    body{padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#172B4D;font-size:15px;line-height:1.6}
    img{max-width:100%;height:auto}a{color:#2563EB}
    table{max-width:100%}
  </style></head><body>${html || '<p style="color:#718096">No content yet</p>'}</body></html>`
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#F8FAFC]">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div style={{ width: 640, height: 800, flexShrink: 0, transform: 'scale(0.38)', transformOrigin: 'top center' }}>
          <PreviewFrame html={document} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/90 to-transparent" />
    </div>
  )
}

function storedStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/* --------------------------------------------------------------- Skeleton Loaders */

function StudioSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-28 rounded-xl bg-slate-200/70" />
      <div className="flex gap-3">
        <div className="h-10 w-64 rounded-lg bg-slate-200/70" />
        <div className="h-10 w-32 rounded-lg bg-slate-200/70" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-80 rounded-xl bg-slate-200/60" />
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Main Component */

export function EmailStudioPage() {
  const { toast, me } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/email_templates?limit=150')

  const [activeTab, setActiveTab] = useState<StudioTab>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [viewLayout, setViewLayout] = useState<ViewLayout>('grid')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'name'>('newest')

  // Modals
  const [preview, setPreview] = useState<{ name: string; html: string; subject?: string; plain?: string; slug?: string } | null>(null)
  const [previewMobile, setPreviewMobile] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [importHtmlContent, setImportHtmlContent] = useState('')
  const [importTemplateName, setImportTemplateName] = useState('')

  // Action states
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  // Preferences (favorites & recents stored per user)
  const [preferences, setPreferences] = useState<{ favorites: string[]; recent: string[] }>({
    favorites: [],
    recent: [],
  })

  const userId = me?.id ?? null
  const prefsKey = userId ? `gofox-email-studio-prefs:${userId}` : null

  useEffect(() => {
    if (!prefsKey) return
    try {
      const raw = window.localStorage.getItem(prefsKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        setPreferences({
          favorites: storedStringList(parsed.favorites),
          recent: storedStringList(parsed.recent),
        })
      }
    } catch {
      // fallback
    }
  }, [prefsKey])

  const savePreferences = (next: { favorites: string[]; recent: string[] }) => {
    setPreferences(next)
    if (!prefsKey) return
    try {
      window.localStorage.setItem(prefsKey, JSON.stringify(next))
    } catch {
      // fallback
    }
  }

  const toggleFavorite = (idOrSlug: string, isPreset = false) => {
    const key = isPreset ? `preset:${idOrSlug}` : `template:${idOrSlug}`
    const isFav = preferences.favorites.includes(key)
    const nextFavorites = isFav
      ? preferences.favorites.filter((f) => f !== key)
      : [key, ...preferences.favorites]
    savePreferences({ ...preferences, favorites: nextFavorites })
    toast(isFav ? 'Removed from favorites' : 'Added to favorites', 'good')
  }

  const addRecent = (idOrSlug: string, isPreset = false) => {
    const key = isPreset ? `preset:${idOrSlug}` : `template:${idOrSlug}`
    const nextRecent = [key, ...preferences.recent.filter((r) => r !== key)].slice(0, 40)
    savePreferences({ ...preferences, recent: nextRecent })
  }

  // Raw DB templates
  const rawRows = data?.data ?? []

  // Create blank template in builder
  const handleCreateBlank = async () => {
    setCreating(true)
    try {
      const result = await post<{ record?: Row }>('/api/resources/email_templates', {
        name: 'Untitled email',
        subject: 'Untitled email',
        html: '',
        builder: 'design',
        category: 'General',
        preview_text: '',
        plain_text: '',
        status: 'draft',
        body: '',
        document_json: JSON.stringify(createEmptyDocument()),
      })
      const record = (result as any)?.record
      if (record?.id) {
        addRecent(String(record.id))
        navigate(`/marketing/emails/${record.id}/edit`)
      } else {
        reload()
      }
    } catch (err: any) {
      toast(err?.message ?? 'Could not create template.', 'bad')
    } finally {
      setCreating(false)
    }
  }

  // Import custom HTML
  const handleImportHtml = async () => {
    if (!importHtmlContent.trim()) {
      toast('Please enter HTML content to import.', 'bad')
      return
    }
    setCreating(true)
    try {
      const name = importTemplateName.trim() || 'Imported HTML Template'
      const document = emailDocumentFromHtml(importHtmlContent)
      const result = await post<{ record?: Row }>('/api/resources/email_templates', {
        name,
        subject: name,
        html: importHtmlContent,
        body: importHtmlContent,
        builder: 'design',
        category: 'Marketing',
        preview_text: '',
        plain_text: importHtmlContent.replace(/<[^>]+>/g, ' ').slice(0, 160),
        status: 'draft',
        document_json: JSON.stringify(document),
      })
      const record = (result as any)?.record
      toast('Template imported successfully!', 'good')
      setImportModalOpen(false)
      setImportHtmlContent('')
      setImportTemplateName('')
      if (record?.id) {
        addRecent(String(record.id))
        navigate(`/marketing/emails/${record.id}/edit`)
      } else {
        reload()
      }
    } catch (err: any) {
      toast(err?.message ?? 'Could not import HTML template.', 'bad')
    } finally {
      setCreating(false)
    }
  }

  // Use a preset from marketplace
  const handleUsePreset = async (preset: EmailPreset) => {
    setBusy(preset.slug)
    try {
      const result = await post<{ record?: Row; data?: Row }>('/api/resources/email_templates', {
        name: preset.name,
        category: preset.category,
        subject: preset.subject || preset.name || 'Untitled email',
        preview_text: preset.previewText || '',
        html: preset.html,
        body: preset.html,
        plain_text: preset.plain,
        builder: 'design',
        status: 'draft',
        document_json: JSON.stringify(emailDocumentFromHtml(preset.html)),
      })
      const record = (result as any)?.record ?? (result as any)?.data
      toast(`Created template from "${preset.name}"`, 'good')
      addRecent(preset.slug, true)
      if (record?.id) {
        addRecent(String(record.id))
        navigate(`/marketing/emails/${record.id}/edit`)
      } else {
        reload()
      }
    } catch (err: any) {
      toast(err?.message ?? 'Could not load preset template.', 'bad')
    } finally {
      setBusy(null)
    }
  }

  // Duplicate an existing template
  const handleDuplicate = async (row: Row) => {
    const id = String(row.id ?? '')
    if (!id) return
    setBusy(id)
    try {
      const html = String(row.html ?? row.body ?? '')
      let document = emailDocumentFromHtml(html)
      if (typeof row.document_json === 'string' && row.document_json.trim()) {
        try {
          const parsed = JSON.parse(row.document_json)
          if (isEmailDocument(parsed)) document = parsed
        } catch {
          // ignore
        }
      }
      const result = await post<{ record?: Row }>('/api/resources/email_templates', {
        name: `${String(row.name ?? 'Untitled')} (Copy)`,
        category: String(row.category ?? 'General'),
        subject: String(row.subject ?? ''),
        preview_text: String(row.preview_text ?? ''),
        html,
        body: html,
        plain_text: String(row.plain_text ?? ''),
        builder: 'design',
        status: 'draft',
        document_json: JSON.stringify(document),
      })
      const copy = (result as any)?.record
      toast('Template duplicated successfully.', 'good')
      if (copy?.id) {
        addRecent(String(copy.id))
        navigate(`/marketing/emails/${copy.id}/edit`)
      } else {
        reload()
      }
    } catch (err: any) {
      toast(err?.message ?? 'Could not duplicate template.', 'bad')
    } finally {
      setBusy(null)
    }
  }

  // Delete template
  const handleDelete = async (row: Row) => {
    const id = String(row.id ?? '')
    if (!id) return
    setBusy(id)
    try {
      await del(`/api/resources/email_templates/${id}`)
      toast('Template moved to trash.', 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not delete template.', 'bad')
    } finally {
      setBusy(null)
    }
  }

  // Filter templates based on activeTab, category, and query
  const filteredTemplates = useMemo(() => {
    return rawRows.filter((r) => {
      const id = String(r.id ?? '')
      const name = String(r.name ?? '').toLowerCase()
      const cat = String(r.category ?? '').toLowerCase()
      const sub = String(r.subject ?? '').toLowerCase()
      const term = query.trim().toLowerCase()

      // Tab filtering
      if (activeTab === 'recent' && !preferences.recent.includes(`template:${id}`)) return false
      if (activeTab === 'favorites' && !preferences.favorites.includes(`template:${id}`)) return false
      if (activeTab === 'drafts' && String(r.status ?? '').toLowerCase() !== 'draft') return false

      // Category filtering
      if (selectedCategory !== 'All' && cat !== selectedCategory.toLowerCase()) return false

      // Query filtering
      if (term && !name.includes(term) && !cat.includes(term) && !sub.includes(term)) return false

      return true
    })
  }, [rawRows, activeTab, preferences, selectedCategory, query])

  // Filter Marketplace Presets (75 templates)
  const filteredPresets = useMemo(() => {
    return EMAIL_PRESETS.filter((p) => {
      const term = query.trim().toLowerCase()
      const cat = p.category.toLowerCase()
      const slugKey = `preset:${p.slug}`

      if (activeTab === 'favorites' && !preferences.favorites.includes(slugKey)) return false
      if (activeTab === 'recent' && !preferences.recent.includes(slugKey)) return false

      if (selectedCategory !== 'All') {
        const sel = selectedCategory.toLowerCase().replace(/[^a-z]/g, '')
        const c = cat.replace(/[^a-z]/g, '')
        if (!c.includes(sel) && !sel.includes(c)) return false
      }

      if (term) {
        const text = `${p.name} ${p.category} ${p.subject} ${p.description}`.toLowerCase()
        if (!text.includes(term)) return false
      }

      return true
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'popular') return (b.tier === 'premium' ? 1 : 0) - (a.tier === 'premium' ? 1 : 0)
      return 0
    })
  }, [selectedCategory, query, activeTab, preferences, sortBy])

  // Tab counts
  const recentCount = preferences.recent.length
  const favoritesCount = preferences.favorites.length
  const draftsCount = rawRows.filter((r) => String(r.status ?? '').toLowerCase() === 'draft').length

  if (loading) return <StudioSkeleton />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F7F9FC] text-[#172B4D]">
      {/* ---------------------------------------------------------------- SCREEN 1: STICKY TOP BAR */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E5EAF1] bg-[#FFFFFF] px-6 shadow-[0_1px_3px_rgba(20,45,78,0.03)]">
        {/* Left: Branding & Studio Title */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#142D4E] text-[#FFFFFF] shadow-sm">
            <Mail size={16} className="text-[#2CA6A4]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold text-[#142D4E] tracking-tight">Email Studio</h1>
              <span className="rounded-full bg-blue-50 border border-blue-100 text-[#2563EB] px-2 py-0.5 text-[11px] font-medium">
                Enterprise
              </span>
            </div>
            <p className="text-[11px] text-[#718096]">Design, test, and publish responsive campaigns</p>
          </div>
        </div>

        {/* Center: Global Search with Cmd+K */}
        <div className="relative hidden md:block w-72 lg:w-96">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates, subjects, categories..."
            className="w-full h-8.5 rounded-[6px] border border-[#E5EAF1] bg-[#F7F9FC] pl-8.5 pr-12 text-[12.5px] text-[#172B4D] placeholder:text-[#718096] focus:bg-[#FFFFFF] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none transition"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#E5EAF1] bg-[#FFFFFF] px-1.5 py-0.5 text-[10px] font-medium text-[#718096]">
            ⌘K
          </kbd>
        </div>

        {/* Right: Actions & Primary Create */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex h-8.5 items-center gap-1.5 rounded-[6px] border border-[#E5EAF1] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#172B4D] hover:bg-[#F7F9FC] hover:border-[#2563EB]/40 transition"
            title="Import custom HTML email"
          >
            <Upload size={13} className="text-[#718096]" />
            <span className="hidden sm:inline">Import HTML</span>
          </button>

          <button
            onClick={() => setHelpModalOpen(true)}
            className="flex size-8.5 items-center justify-center rounded-[6px] border border-[#E5EAF1] bg-[#FFFFFF] text-[#718096] hover:text-[#172B4D] hover:bg-[#F7F9FC] transition"
            title="Help & Shortcuts"
          >
            <HelpCircle size={15} />
          </button>

          <button
            onClick={() => void handleCreateBlank()}
            disabled={creating}
            className="flex h-8.5 items-center gap-1.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] px-3.5 text-[12.5px] font-medium shadow-sm transition disabled:opacity-50"
          >
            <Plus size={14} />
            <span>Create Template</span>
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------------------- HERO STRIP: 3 ACTION TILES */}
      <div className="border-b border-[#E5EAF1] bg-[#FFFFFF] px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#142D4E]">Welcome to Email Studio</h2>
            <p className="text-[12.5px] text-[#718096]">
              Choose how you want to build: drag-and-drop from scratch, pick from 75+ battle-tested templates, or import your HTML.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reload()}
              className="flex size-8 items-center justify-center rounded-[6px] border border-[#E5EAF1] text-[#718096] hover:bg-[#F7F9FC] hover:text-[#172B4D] transition"
              title="Refresh templates"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Tile 1: Start from scratch */}
          <button
            type="button"
            onClick={() => void handleCreateBlank()}
            disabled={creating}
            className="group flex items-start gap-3.5 rounded-[10px] border border-[#E5EAF1] bg-[#FFFFFF] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:shadow-[0_4px_12px_rgba(20,45,78,0.08)] hover:bg-blue-50/40"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-blue-50 text-[#2563EB] group-hover:scale-105 transition">
              <Layout size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-[#142D4E] group-hover:text-[#2563EB]">Start from scratch</h3>
                <span className="text-[10px] rounded bg-blue-50 px-1.5 py-0.5 text-[#2563EB] font-medium">dnd-kit</span>
              </div>
              <p className="text-[11.5px] text-[#718096] mt-0.5 leading-snug">
                Blank visual canvas with responsive drag-and-drop blocks and styling controls.
              </p>
            </div>
          </button>

          {/* Tile 2: Browse templates */}
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className={cx(
              "group flex items-start gap-3.5 rounded-[10px] border border-[#E5EAF1] bg-[#FFFFFF] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:shadow-[0_4px_12px_rgba(20,45,78,0.08)] hover:bg-blue-50/40",
              activeTab === 'marketplace' && 'border-[#2563EB] ring-1 ring-[#2563EB] bg-blue-50/20'
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-teal-50 text-[#2CA6A4] group-hover:scale-105 transition">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-[#142D4E] group-hover:text-[#2563EB]">Browse 75+ templates</h3>
                <span className="text-[10px] rounded bg-teal-50 px-1.5 py-0.5 text-[#2CA6A4] font-medium">Marketplace</span>
              </div>
              <p className="text-[11.5px] text-[#718096] mt-0.5 leading-snug">
                Explore curated, high-converting templates across 13 sales & marketing categories.
              </p>
            </div>
          </button>

          {/* Tile 3: Import HTML */}
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="group flex items-start gap-3.5 rounded-[10px] border border-[#E5EAF1] bg-[#FFFFFF] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:shadow-[0_4px_12px_rgba(20,45,78,0.08)] hover:bg-blue-50/40"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-slate-100 text-[#142D4E] group-hover:scale-105 transition">
              <Code2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-[#142D4E] group-hover:text-[#2563EB]">Import HTML</h3>
                <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-[#142D4E] font-medium">Custom code</span>
              </div>
              <p className="text-[11.5px] text-[#718096] mt-0.5 leading-snug">
                Paste existing responsive HTML or upload code to convert directly into visual blocks.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- TABS & TOOLBAR */}
      <div className="border-b border-[#E5EAF1] bg-[#FFFFFF] px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Main Studio Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
            {[
              { id: 'all', label: 'All Templates', count: rawRows.length },
              { id: 'marketplace', label: 'Marketplace', count: EMAIL_PRESETS.length },
              { id: 'recent', label: 'Recent', count: recentCount },
              { id: 'favorites', label: 'Favorites', count: favoritesCount },
              { id: 'drafts', label: 'Drafts', count: draftsCount },
            ].map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as StudioTab)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium transition',
                    active
                      ? 'bg-blue-50/80 text-[#2563EB] font-semibold'
                      : 'text-[#718096] hover:bg-[#F7F9FC] hover:text-[#172B4D]'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cx(
                      'rounded-full px-1.5 py-0.2 text-[10.5px]',
                      active ? 'bg-[#2563EB] text-white' : 'bg-[#E5EAF1] text-[#718096]'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Right Controls: Sort & Layout Toggle */}
          <div className="flex items-center gap-3 py-2">
            {activeTab === 'marketplace' && (
              <div className="flex items-center gap-1.5 text-[12px] text-[#718096]">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-[6px] border border-[#E5EAF1] bg-[#FFFFFF] px-2 py-1 text-[11.5px] text-[#172B4D] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="newest">Newest</option>
                  <option value="popular">Popular</option>
                  <option value="name">A–Z</option>
                </select>
              </div>
            )}

            <div className="flex items-center rounded-[6px] border border-[#E5EAF1] bg-[#F7F9FC] p-0.5">
              <button
                onClick={() => setViewLayout('grid')}
                className={cx(
                  'rounded-[4px] p-1.5 text-[#718096] transition',
                  viewLayout === 'grid' && 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                )}
                title="Grid view"
              >
                <Grid size={13} />
              </button>
              <button
                onClick={() => setViewLayout('table')}
                className={cx(
                  'rounded-[4px] p-1.5 text-[#718096] transition',
                  viewLayout === 'table' && 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                )}
                title="Table view"
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Categories Rail Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-t border-[#E5EAF1]/70 no-scrollbar">
          <span className="text-[11px] font-semibold text-[#718096] uppercase tracking-wider mr-1">Category:</span>
          {MARKETPLACE_CATEGORIES.map((cat) => {
            const active = selectedCategory.toLowerCase() === cat.toLowerCase()
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cx(
                  'rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition whitespace-nowrap',
                  active
                    ? 'bg-[#142D4E] text-[#FFFFFF]'
                    : 'bg-[#FFFFFF] border border-[#E5EAF1] text-[#718096] hover:border-[#2563EB] hover:text-[#2563EB]'
                )}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---------------------------------------------------------------- MAIN CONTENT CANVAS */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* VIEW A: MARKETPLACE VIEW (75 TEMPLATES) */}
        {activeTab === 'marketplace' ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#142D4E]">
                  {selectedCategory === 'All' ? 'All Marketplace Templates' : `${selectedCategory} Templates`}
                </h3>
                <p className="text-[11.5px] text-[#718096]">
                  Showing {filteredPresets.length} curated templates. Click any card to preview or customize.
                </p>
              </div>
            </div>

            {filteredPresets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-[#E5EAF1] bg-[#FFFFFF] p-12 text-center">
                <Mail size={32} className="text-[#718096]/60 mb-2" />
                <h4 className="text-[14px] font-semibold text-[#142D4E]">No templates found</h4>
                <p className="text-[12px] text-[#718096] mt-1">Try selecting a different category or clearing search terms.</p>
                <button
                  onClick={() => { setSelectedCategory('All'); setQuery('') }}
                  className="mt-3 text-[12px] font-medium text-[#2563EB] hover:underline"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredPresets.map((preset) => {
                  const isFav = preferences.favorites.includes(`preset:${preset.slug}`)
                  return (
                    <div
                      key={preset.slug}
                      className="group relative flex flex-col overflow-hidden rounded-[10px] border border-[#E5EAF1] bg-[#FFFFFF] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(20,45,78,0.08)]"
                    >
                      {/* 4:5 Email Thumbnail Stage */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#E5EAF1] bg-[#F8FAFC]">
                        <TemplateThumb html={preset.html} />

                        {/* Favorite Button */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(preset.slug, true) }}
                          className="absolute right-2.5 top-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-white/90 text-[#718096] shadow-sm hover:text-rose-500 hover:bg-white transition"
                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart size={14} className={isFav ? 'fill-rose-500 text-rose-500' : ''} />
                        </button>

                        {/* Category Chip */}
                        <span className="absolute left-2.5 top-2.5 z-10 rounded-[4px] border border-[#E5EAF1] bg-white/95 px-2 py-0.5 text-[10px] font-medium text-[#142D4E] shadow-2xs">
                          {preset.category}
                        </span>

                        {/* Hover Overlay with Action Buttons */}
                        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-[#142D4E]/40 opacity-0 group-hover:opacity-100 transition-all duration-150 backdrop-blur-[1px]">
                          <button
                            type="button"
                            onClick={() => setPreview({ name: preset.name, html: preset.html, subject: preset.subject, plain: preset.plain, slug: preset.slug })}
                            className="rounded-[6px] bg-[#FFFFFF] px-3 py-1.5 text-[11.5px] font-medium text-[#172B4D] shadow-sm hover:bg-[#F7F9FC] transition"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleUsePreset(preset)}
                            disabled={busy === preset.slug}
                            className="rounded-[6px] bg-[#2563EB] px-3.5 py-1.5 text-[11.5px] font-medium text-[#FFFFFF] shadow-sm hover:bg-[#1D4ED8] transition disabled:opacity-50"
                          >
                            {busy === preset.slug ? 'Loading...' : 'Use Template'}
                          </button>
                        </div>
                      </div>

                      {/* Card Details */}
                      <div className="flex flex-1 flex-col justify-between p-3.5">
                        <div>
                          <h4 className="text-[13px] font-semibold text-[#142D4E] truncate" title={preset.name}>
                            {preset.name}
                          </h4>
                          <p className="text-[11px] text-[#718096] line-clamp-1 mt-0.5">
                            {preset.subject || preset.description}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-[#E5EAF1]/70 pt-2 text-[11px]">
                          <span className="text-[#718096]">Responsive 640px</span>
                          <button
                            type="button"
                            onClick={() => void handleUsePreset(preset)}
                            className="font-medium text-[#2563EB] hover:underline"
                          >
                            Customize →
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* VIEW B: USER WORKSPACE TEMPLATES (GRID OR TABLE) */
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#142D4E]">
                  {activeTab === 'recent' ? 'Recently Opened Templates' : activeTab === 'favorites' ? 'Favorite Templates' : activeTab === 'drafts' ? 'Draft Templates' : 'All Workspace Templates'}
                </h3>
                <p className="text-[11.5px] text-[#718096]">
                  {filteredTemplates.length} templates in your workspace.
                </p>
              </div>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-[#E5EAF1] bg-[#FFFFFF] p-12 text-center">
                <Mail size={36} className="text-[#718096]/50 mb-3" />
                <h4 className="text-[14.5px] font-semibold text-[#142D4E]">No templates yet</h4>
                <p className="text-[12px] text-[#718096] mt-1 max-w-sm">
                  Start from scratch with our drag-and-drop builder, or explore the marketplace for 75+ ready-to-use layouts.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => void handleCreateBlank()}
                    className="rounded-[6px] bg-[#2563EB] px-3.5 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-[#1D4ED8]"
                  >
                    Start from scratch
                  </button>
                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className="rounded-[6px] border border-[#E5EAF1] bg-[#FFFFFF] px-3.5 py-1.5 text-[12px] font-medium text-[#172B4D] hover:bg-[#F7F9FC]"
                  >
                    Browse marketplace
                  </button>
                </div>
              </div>
            ) : viewLayout === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredTemplates.map((row) => {
                  const id = String(row.id ?? '')
                  const html = String(row.html ?? row.body ?? '')
                  const isFav = preferences.favorites.includes(`template:${id}`)
                  const isDraft = String(row.status || '').toLowerCase() === 'draft'

                  return (
                    <div
                      key={id}
                      className="group relative flex flex-col overflow-hidden rounded-[10px] border border-[#E5EAF1] bg-[#FFFFFF] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(20,45,78,0.08)]"
                    >
                      {/* 4:5 Thumbnail Stage */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#E5EAF1] bg-[#F8FAFC]">
                        <TemplateThumb html={html} />

                        {/* Favorite Button */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(id, false) }}
                          className="absolute right-2.5 top-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-white/90 text-[#718096] shadow-sm hover:text-rose-500 hover:bg-white transition"
                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart size={14} className={isFav ? 'fill-rose-500 text-rose-500' : ''} />
                        </button>

                        {/* Status Badge */}
                        <span
                          className={cx(
                            'absolute left-2.5 top-2.5 z-10 rounded-[4px] px-2 py-0.5 text-[10px] font-medium shadow-2xs',
                            isDraft
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          )}
                        >
                          {isDraft ? 'Draft' : 'Published'}
                        </span>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-[#142D4E]/40 opacity-0 group-hover:opacity-100 transition-all duration-150 backdrop-blur-[1px]">
                          <button
                            type="button"
                            onClick={() => setPreview({ name: String(row.name ?? 'Template'), html, subject: String(row.subject ?? '') })}
                            className="rounded-[6px] bg-[#FFFFFF] px-3 py-1.5 text-[11.5px] font-medium text-[#172B4D] shadow-sm hover:bg-[#F7F9FC] transition"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              addRecent(id)
                              navigate(`/marketing/emails/${id}/edit`)
                            }}
                            className="rounded-[6px] bg-[#2563EB] px-3.5 py-1.5 text-[11.5px] font-medium text-[#FFFFFF] shadow-sm hover:bg-[#1D4ED8] transition"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* Card Meta */}
                      <div className="flex flex-1 flex-col justify-between p-3.5">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <h4
                              onClick={() => {
                                addRecent(id)
                                navigate(`/marketing/emails/${id}/edit`)
                              }}
                              className="text-[13px] font-semibold text-[#142D4E] hover:text-[#2563EB] cursor-pointer truncate"
                              title={String(row.name ?? '')}
                            >
                              {String(row.name ?? 'Untitled email')}
                            </h4>
                            <span className="rounded bg-[#F7F9FC] border border-[#E5EAF1] px-1.5 py-0.5 text-[10px] text-[#718096] shrink-0">
                              {String(row.category ?? 'General')}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#718096] line-clamp-1 mt-0.5">
                            {String(row.subject || 'No subject line set')}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-[#E5EAF1]/70 pt-2 text-[11px] text-[#718096]">
                          <span>{formatDateTime(row.updated_at || row.created_at || new Date().toISOString()).split(' ')[0]}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDuplicate(row)}
                              disabled={busy === id}
                              className="font-medium text-[#718096] hover:text-[#142D4E] transition"
                              title="Duplicate"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              disabled={busy === id}
                              className="font-medium text-[#718096] hover:text-rose-600 transition"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="overflow-hidden rounded-[10px] border border-[#E5EAF1] bg-[#FFFFFF] shadow-xs">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="border-b border-[#E5EAF1] bg-[#F7F9FC] text-[11px] font-semibold text-[#718096] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Template Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF1]">
                    {filteredTemplates.map((row) => {
                      const id = String(row.id ?? '')
                      const isDraft = String(row.status || '').toLowerCase() === 'draft'
                      return (
                        <tr key={id} className="hover:bg-blue-50/20 transition">
                          <td className="px-4 py-3 font-semibold text-[#142D4E]">
                            <div
                              onClick={() => {
                                addRecent(id)
                                navigate(`/marketing/emails/${id}/edit`)
                              }}
                              className="cursor-pointer hover:text-[#2563EB]"
                            >
                              {String(row.name ?? 'Untitled')}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#718096]">
                            <span className="rounded bg-[#F7F9FC] border border-[#E5EAF1] px-2 py-0.5 text-[11px]">
                              {String(row.category ?? 'General')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#718096] truncate max-w-xs">
                            {String(row.subject || '—')}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cx(
                                'rounded px-2 py-0.5 text-[11px] font-medium',
                                isDraft
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              )}
                            >
                              {isDraft ? 'Draft' : 'Published'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#718096] text-[11.5px]">
                            {formatDateTime(row.updated_at || row.created_at || new Date().toISOString()).split(' ')[0]}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  addRecent(id)
                                  navigate(`/marketing/emails/${id}/edit`)
                                }}
                                className="rounded-[6px] bg-[#2563EB] px-3 py-1 text-[11.5px] font-medium text-white hover:bg-[#1D4ED8] transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => void handleDuplicate(row)}
                                className="p-1 text-[#718096] hover:text-[#142D4E] transition"
                                title="Duplicate"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={() => void handleDelete(row)}
                                className="p-1 text-[#718096] hover:text-rose-600 transition"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- PREVIEW MODAL */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? 'Template Preview'}
        wide
        footer={
          <div className="flex w-full items-center justify-between">
            {/* Desktop vs Mobile Toggle */}
            <div className="flex items-center rounded-[6px] border border-[#E5EAF1] bg-[#F7F9FC] p-0.5">
              <button
                onClick={() => setPreviewMobile(false)}
                className={cx(
                  'flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[11.5px] font-medium text-[#718096] transition',
                  !previewMobile && 'bg-white text-[#2563EB] shadow-xs'
                )}
              >
                <Monitor size={13} />
                <span>Desktop (640px)</span>
              </button>
              <button
                onClick={() => setPreviewMobile(true)}
                className={cx(
                  'flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[11.5px] font-medium text-[#718096] transition',
                  previewMobile && 'bg-white text-[#2563EB] shadow-xs'
                )}
              >
                <Smartphone size={13} />
                <span>Mobile (375px)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                Close
              </Button>
              {preview?.slug && (
                <button
                  onClick={() => {
                    const preset = EMAIL_PRESETS.find((p) => p.slug === preview.slug)
                    if (preset) {
                      setPreview(null)
                      void handleUsePreset(preset)
                    }
                  }}
                  className="rounded-[6px] bg-[#2563EB] px-4 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-[#1D4ED8] transition"
                >
                  Use this template
                </button>
              )}
            </div>
          </div>
        }
      >
        {preview ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[8px] border border-[#E5EAF1] bg-[#F7F9FC] px-3.5 py-2 text-[12px]">
              <div>
                <span className="text-[#718096]">Subject:</span>{' '}
                <span className="font-medium text-[#142D4E]">{preview.subject || '—'}</span>
              </div>
              <span className="text-[11px] text-[#718096]">
                {previewMobile ? 'Viewport: 375px' : 'Viewport: 640px'}
              </span>
            </div>
            <div
              className="mx-auto overflow-hidden rounded-[10px] border border-[#E5EAF1] bg-white shadow-inner transition-all duration-200"
              style={{
                width: previewMobile ? '375px' : '100%',
                maxWidth: '100%',
                height: 520,
              }}
            >
              {preview.html ? (
                <PreviewFrame html={preview.html} mobile={previewMobile} />
              ) : (
                <pre className="h-full overflow-auto whitespace-pre-wrap p-4 font-sans text-[12.5px] text-[#172B4D]">
                  {preview.plain || 'No content available'}
                </pre>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ---------------------------------------------------------------- IMPORT HTML MODAL */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Custom HTML Template"
        footer={
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <button
              onClick={() => void handleImportHtml()}
              disabled={creating || !importHtmlContent.trim()}
              className="rounded-[6px] bg-[#2563EB] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-[#1D4ED8] transition disabled:opacity-50"
            >
              {creating ? 'Importing...' : 'Import into Visual Builder'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#142D4E] mb-1">Template Name</label>
            <input
              value={importTemplateName}
              onChange={(e) => setImportTemplateName(e.target.value)}
              placeholder="e.g. Q4 Executive Product Announcement"
              className="w-full rounded-[6px] border border-[#E5EAF1] bg-white px-3 py-1.5 text-[12.5px] text-[#172B4D] focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[12px] font-semibold text-[#142D4E]">HTML Code</label>
              <label className="cursor-pointer text-[11.5px] font-medium text-[#2563EB] hover:underline flex items-center gap-1">
                <FileCode size={13} />
                <span>Upload .html file</span>
                <input
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const content = ev.target?.result as string
                        if (content) {
                          setImportHtmlContent(content)
                          if (!importTemplateName) {
                            setImportTemplateName(file.name.replace(/\.[^.]+$/, ''))
                          }
                        }
                      }
                      reader.readAsText(file)
                    }
                  }}
                />
              </label>
            </div>
            <textarea
              value={importHtmlContent}
              onChange={(e) => setImportHtmlContent(e.target.value)}
              placeholder="Paste raw responsive email HTML here (e.g. <table>...</table>)..."
              rows={12}
              className="w-full rounded-[6px] border border-[#E5EAF1] bg-[#0F172A] p-3 font-mono text-[11.5px] leading-relaxed text-[#F8FAFC] focus:border-[#2563EB] focus:outline-none"
            />
          </div>
          <p className="text-[11px] text-[#718096]">
            GoFox automatically parses structural elements, text blocks, buttons, and inline styles into reorderable drag-and-drop components.
          </p>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- HELP & SHORTCUTS MODAL */}
      <Modal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        title="Email Studio Help & Shortcuts"
        footer={<Button size="sm" onClick={() => setHelpModalOpen(false)}>Got it</Button>}
      >
        <div className="space-y-4 text-[12.5px] text-[#172B4D]">
          <div>
            <h4 className="font-semibold text-[#142D4E] mb-1">Keyboard Shortcuts</h4>
            <div className="grid grid-cols-2 gap-2 text-[11.5px]">
              <div className="flex items-center justify-between border-b border-[#E5EAF1] py-1">
                <span>Save Template</span>
                <kbd className="rounded border border-[#E5EAF1] bg-[#F7F9FC] px-1.5 py-0.5">⌘S</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-[#E5EAF1] py-1">
                <span>Undo</span>
                <kbd className="rounded border border-[#E5EAF1] bg-[#F7F9FC] px-1.5 py-0.5">⌘Z</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-[#E5EAF1] py-1">
                <span>Redo</span>
                <kbd className="rounded border border-[#E5EAF1] bg-[#F7F9FC] px-1.5 py-0.5">⌘⇧Z</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-[#E5EAF1] py-1">
                <span>Duplicate Block</span>
                <kbd className="rounded border border-[#E5EAF1] bg-[#F7F9FC] px-1.5 py-0.5">⌘D</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-[#E5EAF1] py-1">
                <span>Delete Block</span>
                <kbd className="rounded border border-[#E5EAF1] bg-[#F7F9FC] px-1.5 py-0.5">Delete</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-[#E5EAF1] py-1">
                <span>Global Search</span>
                <kbd className="rounded border border-[#E5EAF1] bg-[#F7F9FC] px-1.5 py-0.5">⌘K</kbd>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[#142D4E] mb-1">Supported Personalization Tags</h4>
            <p className="text-[11.5px] text-[#718096] mb-2">
              Merge tags automatically populate with recipient contact data upon campaign dispatch:
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="rounded bg-blue-50 border border-blue-100 text-[#2563EB] px-2 py-0.5">{"{{firstName}}"}</span>
              <span className="rounded bg-blue-50 border border-blue-100 text-[#2563EB] px-2 py-0.5">{"{{lastName}}"}</span>
              <span className="rounded bg-blue-50 border border-blue-100 text-[#2563EB] px-2 py-0.5">{"{{email}}"}</span>
              <span className="rounded bg-blue-50 border border-blue-100 text-[#2563EB] px-2 py-0.5">{"{{company}}"}</span>
              <span className="rounded bg-blue-50 border border-blue-100 text-[#2563EB] px-2 py-0.5">{"{{deal_name}}"}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export const EMAIL_STUDIO_PRESETS = EMAIL_PRESETS
