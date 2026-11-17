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

export function EmailTemplateGrapesEditor({ id }: { id: string }) {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ record: Row }>(`/api/resources/email_templates/${id}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !data?.record) return
    const record = data.record
    let cancelled = false
    void (async () => {
      try {
        await loadScript(GJS_CDN)
        if (cancelled || !containerRef.current || !window.grapesjs) return
        const editor = window.grapesjs.init({
          container: containerRef.current,
          height: '100%',
          width: 'auto',
          storageManager: false,
          panels: { defaults: [] },
        })
        editor.setComponents(String(record.html ?? record.body ?? ''))
        if (record.css) editor.setStyle(String(record.css))
        editorRef.current = editor
        setReady(true)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load editor.')
      }
    })()
    return () => {
      cancelled = true
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
      const css = editor.getCss()
      await patch(`/api/resources/email_templates/${id}`, {
        html,
        css,
        body: html,
        status: publish ? 'active' : undefined,
      })
      toast(publish ? 'Email template activated.' : 'Saved.', 'good')
      if (publish) navigate('/marketing/emails')
    } catch (err: any) {
      toast(err?.message ?? 'Could not save.', 'bad')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading template" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Template not found'} onRetry={reload} />
  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={String(data.record.name ?? 'Email template')}
        subtitle={`${data.record.subject ?? ''} · ${data.record.status}`}
        breadcrumb={
          <Link to="/marketing/emails" className="text-[11.5px] text-muted hover:text-ink">
            ← Email templates
          </Link>
        }
      >
        <Button size="sm" onClick={() => void save(false)} loading={saving}>
          <Save size={13} /> Save draft
        </Button>
        <Button size="sm" variant="primary" onClick={() => void save(true)} loading={saving}>
          Activate
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