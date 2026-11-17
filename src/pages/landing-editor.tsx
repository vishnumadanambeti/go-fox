import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { patch, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { Button, ErrorState, PageHeader, Spinner } from '../components/ui'

declare global {
  interface Window {
    grapesjs?: any
  }
}

const GJS_CDN = 'https://unpkg.com/grapesjs'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

export function LandingPageGrapesEditor({ id }: { id: string }) {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ record: Row }>(`/api/resources/landing_pages/${id}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !data?.record) return
    const record = data.record
    let cancelled = false
    const blobUrls: string[] = []
    void (async () => {
      try {
        await loadScript(GJS_CDN)
        if (cancelled || !containerRef.current || !window.grapesjs) return
        // Imported templates ship modern CSS (layers, nesting, @supports) that GrapesJS'
        // CSS engine cannot parse, so give the canvas real stylesheet URLs instead of setStyle.
        const baseCss = String(record.css ?? '')
        const customCss = String(record.css_custom ?? '')
        for (const cssText of [baseCss, customCss]) {
          if (!cssText) continue
          blobUrls.push(URL.createObjectURL(new Blob([cssText], { type: 'text/css' })))
        }
        const editor = window.grapesjs.init({
          container: containerRef.current,
          height: '100%',
          width: 'auto',
          storageManager: false,
          panels: { defaults: [] },
          canvas: { styles: blobUrls },
        })
        editor.setComponents(String(record.html ?? ''))
        editorRef.current = editor
        setReady(true)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load editor.')
      }
    })()
    return () => {
      cancelled = true
      for (const url of blobUrls) URL.revokeObjectURL(url)
      if (editorRef.current) {
        try {
          editorRef.current.destroy()
        } catch {
          /* ignore */
        }
        editorRef.current = null
      }
    }
  }, [loading, data])

  const save = async (publish = false) => {
    const editor = editorRef.current
    if (!editor) return
    setSaving(true)
    try {
      const html = editor.getHtml()
      const managed = editor.getCss()
      const hasBase = Boolean(String(data?.record.css ?? ''))
      await patch(`/api/resources/landing_pages/${id}`, {
        html,
        css: hasBase ? String(data?.record.css) : managed,
        css_custom: hasBase ? managed : '',
        status: publish ? 'published' : undefined,
      })
      toast(publish ? 'Landing page published.' : 'Saved.', 'good')
      if (publish) navigate('/marketing/landing-pages')
    } catch (err: any) {
      toast(err?.message ?? 'Could not save.', 'bad')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading page" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Page not found'} onRetry={reload} />
  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={String(data.record.name ?? 'Landing page')}
        subtitle={`/p/${data.record.slug} · ${data.record.status}`}
        breadcrumb={
          <Link to="/marketing/landing-pages" className="text-[11.5px] text-muted hover:text-ink">
            ← Landing pages
          </Link>
        }
      >
        <Button size="sm" onClick={() => void save(false)} loading={saving}>
          <Save size={13} /> Save draft
        </Button>
        <Button size="sm" variant="primary" onClick={() => void save(true)} loading={saving}>
          Publish
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner label="Loading editor" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
