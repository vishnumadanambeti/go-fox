import { useMemo, useState } from 'react'
import { ArrowRight, ExternalLink, Search, Sparkles } from 'lucide-react'
import { post, type Row } from '../lib/api'
import { useApp } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { Button, Card, EmptyState, Modal, PageHeader, Spinner } from '../components/ui'
import { LANDING_TEMPLATES, type LandingTemplate } from '../data/landingCatalog'

export function TemplateLibraryPage() {
  const { toast } = useApp()
  const navigate = useNavigate()
  const industries = useMemo(() => ['All', ...Array.from(new Set(LANDING_TEMPLATES.map((t) => t.industry))).sort()], [])
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState('All')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<LandingTemplate | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LANDING_TEMPLATES.filter((t) => {
      if (industry !== 'All' && t.industry !== industry) return false
      if (!q) return true
      return `${t.name} ${t.industry} ${t.description}`.toLowerCase().includes(q)
    })
  }, [query, industry])

  const openPreview = async (template: LandingTemplate) => {
    setPreview(template)
    setPreviewHtml(null)
    setLoadingPreview(true)
    try {
      const response = await fetch(template.previewUrl, { credentials: 'omit' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setPreviewHtml(await response.text())
    } catch {
      setPreviewHtml('<!doctype html><html><body style="font-family:Arial;padding:32px;color:#667085"><h3 style="color:#17243A">Preview unavailable offline</h3><p>The upstream source could not be reached from this browser. The template can still be imported when the source is reachable.</p></body></html>')
    } finally {
      setLoadingPreview(false)
    }
  }

  const useTemplate = async (template: LandingTemplate) => {
    setBusyId(template.id)
    try {
      const response = await fetch(template.previewUrl, { credentials: 'omit' })
      if (!response.ok) throw new Error(`The template source could not be reached (HTTP ${response.status}). No page was created.`)
      const html = await response.text()
      const created = await post<{ record: Row }>('/api/resources/landing_pages', {
        name: template.name,
        slug: template.id,
        status: 'draft',
        template: 'imported',
        blocks: '[]',
        html,
        css: '',
        seo_title: template.name,
        seo_description: template.description,
      })
      toast(`“${template.name}” imported into your workspace.`, 'good')
      navigate(`/marketing/landing-pages/${created.record.id}/edit`)
    } catch (err: any) {
      toast(err?.message ?? 'Could not import template.', 'bad')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Template library"
        subtitle={`${LANDING_TEMPLATES.length} free, MIT-licensed landing-page templates ready to import`}
      >
        <Link to="/marketing/landing-pages" className="gx-btn gx-btn-sm">My pages</Link>
      </PageHeader>
      <div className="border-b border-line bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className="gx-input gx-input-icon-sm text-[12.5px]"
              placeholder="Search templates by name, industry…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustry(ind)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${industry === ind ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-ink'}`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          All templates are free, open-source (MIT) and importable. Sources are credited; no paid templates are redistributed.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        {filtered.length === 0 ? (
          <EmptyState icon={<Sparkles size={18} />} title="No templates match" description="Try a different search or industry filter." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((template) => (
              <Card key={template.id} className="flex flex-col overflow-hidden">
                <div className="aspect-[16/10] overflow-hidden bg-surface-2">
                  <img src={template.screenshot} alt={template.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-semibold">{template.name}</h3>
                      <span className="mt-0.5 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted">{template.industry}</span>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11.5px] text-muted">{template.description}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <button type="button" onClick={() => void openPreview(template)} className="gx-btn gx-btn-sm">
                      <ExternalLink size={12} /> Preview
                    </button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busyId === template.id}
                      onClick={() => void useTemplate(template)}
                    >
                      Use template <ArrowRight size={12} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name ?? 'Template preview'} wide
        footer={
          <>
            <Button size="sm" onClick={() => setPreview(null)}>Close</Button>
            <Button size="sm" variant="primary" disabled={!preview} onClick={() => { if (preview) { const t = preview; setPreview(null); void useTemplate(t) } }}>
              Use this template
            </Button>
          </>
        }
      >
        {preview ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <span>{preview.industry}</span><span>·</span><span>{preview.license}</span>
              <a href={preview.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto underline">Source</a>
            </div>
            {loadingPreview ? (
              <div className="flex h-[58vh] items-center justify-center rounded-lg border border-line bg-surface-2"><Spinner label="Loading preview" /></div>
            ) : (
              <iframe
                title={`${preview.name} preview`}
                sandbox="allow-same-origin"
                className="h-[58vh] w-full rounded-lg border border-line bg-white"
                srcDoc={previewHtml ?? ''}
              />
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
