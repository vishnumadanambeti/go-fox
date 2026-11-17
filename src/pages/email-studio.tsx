import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Eye,
  Laptop,
  LayoutTemplate,
  Mail,
  Monitor,
  Palette,
  PenLine,
  Plus,
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
import { Badge, Button, Card, ErrorState, FormRow, Modal, PageHeader, Spinner, StatusBadge, cx } from '../components/ui'
import { EMAIL_CATEGORIES, EMAIL_PRESETS, type EmailPreset } from '../data/emailTemplates'
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

/* --------------------------------------------------------------- gallery */

export function EmailStudioPage() {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/email_templates?limit=100')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [tab, setTab] = useState<'workspace' | 'marketplace'>('workspace')
  const [preview, setPreview] = useState<{ name: string; html: string; subject?: string; plain?: string } | null>(null)
  const [previewMobile, setPreviewMobile] = useState(false)
  const [creating, setCreating] = useState(false)
  const [chooser, setChooser] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const rows = data?.data ?? []
  const categories = useMemo(() => {
    const set = new Set(['All', ...EMAIL_CATEGORIES.filter((entry) => entry !== 'All'), ...rows.map((row) => String(row.category ?? 'General'))])
    return [...set]
  }, [rows])

  const filteredPresets = EMAIL_PRESETS.filter((preset) => {
    if (category !== 'All' && preset.category !== category) return false
    if (!query.trim()) return true
    const term = query.toLowerCase()
    return `${preset.name} ${preset.category} ${preset.subject} ${preset.description}`.toLowerCase().includes(term)
  })

  const filteredRows = rows
    .filter((row) => {
      if (category !== 'All' && String(row.category ?? 'General') !== category) return false
      if (!query.trim()) return true
      const term = query.toLowerCase()
      return `${row.name} ${row.category} ${row.subject}`.toLowerCase().includes(term)
    })
    .filter((row) => String(row.status) !== 'archived')

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

  const duplicate = async (row: Row) => {
    setBusy(`copy-${row.id}`)
    try {
      const result = await post<{ record?: Row }>('/api/resources/email_templates', {
        name: `${row.name} (copy)`,
        category: row.category ?? 'General',
        subject: row.subject ?? '',
        preview_text: row.preview_text ?? '',
        html: row.html ?? row.body ?? '',
        body: row.html ?? row.body ?? '',
        css: row.css ?? '',
        plain_text: row.plain_text ?? '',
        builder: row.builder ?? 'design',
        status: 'draft',
      })
      toast('Template duplicated.', 'good')
      reload()
      const record = (result as any)?.record
      if (record?.id) navigate(`/marketing/emails/${record.id}/edit`)
    } catch (err: any) {
      toast(err?.message ?? 'Could not duplicate.', 'bad')
    } finally {
      setBusy(null)
    }
  }

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
      setChooser(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Email studio"
        subtitle={`${rows.length} workspace template${rows.length === 1 ? '' : 's'} · ${EMAIL_PRESETS.length} marketplace designs · send through your connected mailbox`}
      >
        <Button size="sm" onClick={() => setChooser(true)}>
          <LayoutTemplate size={13} /> Browse designs
        </Button>
        <Button size="sm" variant="primary" onClick={() => setChooser(true)}>
          <Plus size={14} /> New email
        </Button>
      </PageHeader>

      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
            {(
              [
                ['workspace', 'My templates'],
                ['marketplace', 'Template marketplace'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition',
                  tab === value ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates, categories or subjects…"
              className="gx-input gx-input-icon"
            />
          </div>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 gx-scroll">
          {categories.map((entry) => (
            <button
              key={entry}
              onClick={() => setCategory(entry)}
              className={cx(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                category === entry ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll bg-canvas p-4 sm:p-5">
        {loading ? (
          <Spinner label="Loading templates" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : tab === 'workspace' ? (
          rows.length === 0 ? (
            <Card className="mx-auto max-w-md p-8 text-center">
              <LayoutTemplate size={26} className="mx-auto text-faint" />
              <h2 className="mt-2 text-[15px] font-semibold">No templates yet</h2>
              <p className="mt-1 text-[12.5px] text-muted">Start from a professional marketplace design or open a blank canvas.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button size="sm" onClick={() => setTab('marketplace')}>Browse marketplace</Button>
                <Button size="sm" variant="primary" onClick={() => setChooser(true)}>New email</Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredRows.map((row) => {
                const html = String(row.html ?? row.body ?? '')
                return (
                  <Card key={row.id} className="group flex flex-col overflow-hidden p-0 transition hover:shadow-[var(--shadow-pop)]">
                    <button className="block w-full text-left" onClick={() => setPreview({ name: row.name, html, subject: row.subject, plain: row.plain_text })}>
                      <TemplateThumb html={html || '<p style="font-family:Arial;padding:24px;color:#98A2B3">Empty template</p>'} accent="#FF7417" />
                    </button>
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold tracking-[-0.01em]">{row.name}</div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <StatusBadge value={row.status} />
                            <Badge>{row.category ?? 'General'}</Badge>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{row.subject || 'No subject yet'}</p>
                      <div className="mt-auto flex items-center gap-1.5 pt-3">
                        <Link to={`/marketing/emails/${row.id}/edit`} className="flex-1">
                          <Button size="sm" variant="primary" className="w-full">
                            <PenLine size={12} /> Edit
                          </Button>
                        </Link>
                        <Button size="sm" onClick={() => setPreview({ name: row.name, html, subject: row.subject, plain: row.plain_text })} title="Preview">
                          <Eye size={12} />
                        </Button>
                        <Button size="sm" onClick={() => void duplicate(row)} loading={busy === `copy-${row.id}`} title="Duplicate">
                          <Copy size={12} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredPresets.map((preset) => (
              <Card key={preset.slug} className="flex flex-col overflow-hidden p-0 transition hover:shadow-[var(--shadow-pop)]">
                <button className="block w-full text-left" onClick={() => setPreview({ name: preset.name, html: preset.html, subject: preset.subject, plain: preset.plain })}>
                  <TemplateThumb html={preset.html} accent={preset.accent} />
                </button>
                <div className="flex flex-1 flex-col p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold tracking-[-0.01em]">{preset.name}</div>
                      <div className="mt-1"><Badge tone="info">{preset.category}</Badge></div>
                    </div>
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: preset.accent }} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{preset.description}</p>
                  <div className="mt-auto flex items-center gap-1.5 pt-3">
                    <Button size="sm" variant="primary" className="flex-1" loading={busy === preset.slug} onClick={() => void createFromPreset(preset)}>
                      Use template
                    </Button>
                    <Button size="sm" onClick={() => setPreview({ name: preset.name, html: preset.html, subject: preset.subject, plain: preset.plain })}>
                      <Eye size={12} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab === 'marketplace' && filteredPresets.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-muted">No marketplace designs match that search.</p>
        ) : null}
        {tab === 'workspace' && filteredRows.length === 0 && rows.length > 0 ? (
          <p className="py-10 text-center text-[12.5px] text-muted">No templates match that filter.</p>
        ) : null}
      </div>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? 'Preview'}
        wide
        footer={
          <>
            <div className="mr-auto flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
              <button className={cx('rounded-md p-1.5', !previewMobile && 'bg-surface shadow-[var(--shadow-card)]')} onClick={() => setPreviewMobile(false)} title="Desktop">
                <Monitor size={14} />
              </button>
              <button className={cx('rounded-md p-1.5', previewMobile && 'bg-surface shadow-[var(--shadow-card)]')} onClick={() => setPreviewMobile(true)} title="Mobile">
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

      <Modal open={chooser} onClose={() => setChooser(false)} title="Create an email" wide>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { mode: 'design' as const, icon: <Palette size={20} />, title: 'Design your template', body: 'Drag-and-drop visual editor with blocks, columns, images and buttons.', accent: '#FF7417' },
            { mode: 'code' as const, icon: <Code2 size={20} />, title: 'Build your own', body: 'Write or import HTML and CSS with a live desktop and mobile preview.', accent: '#7357D9' },
            { mode: 'plain' as const, icon: <Type size={20} />, title: 'Plain text email', body: 'A focused text email with personalisation tokens and a plain preview.', accent: '#159C91' },
          ].map((option) => (
            <button
              key={option.mode}
              onClick={() => void blank(option.mode)}
              disabled={creating}
              className="group rounded-xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-pop)] disabled:opacity-60"
            >
              <span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ background: option.accent }}>{option.icon}</span>
              <div className="mt-3 text-[13px] font-semibold">{option.title}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{option.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent">Start <Plus size={12} /></span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">Or pick one of {EMAIL_PRESETS.length} marketplace designs from the gallery.</p>
      </Modal>
    </div>
  )
}

/* ---------------------------------------------------------------- editor */

export function EmailStudioEditor({ id }: { id: string }) {
  const { toast } = useApp()
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

  const contacts = useApp().meta?.contacts ?? []

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
        </div>
      </div>

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

export function emailStudioIcons() {
  return <X size={10} />
}

export const EMAIL_STUDIO_PRESETS = EMAIL_PRESETS
