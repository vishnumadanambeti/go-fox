import { useState } from 'react'
import { Download, FileText, Folder, Inbox as InboxIcon, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { post, type Row } from "../lib/api"
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDateTime, money, number, titleCase } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  FormRow,
  Kpi,
  PageHeader,
  Spinner,
  TableSkeleton,
  Tabs,
} from '../components/ui'

/* ------------------------------------------------------------------ reports */
const DOMAINS = [
  { key: 'deals', label: 'Pipeline' },
  { key: 'leads', label: 'Lead sources' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'tickets', label: 'Support' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'activities', label: 'Activity' },
]

export function ReportsPage() {
  const { toast, meta } = useApp()
  const [domain, setDomain] = useState('deals')
  const { data, loading, error, reload } = useFetch<{ domain: string; rows: Row[] }>(`/api/reports/${domain}`)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState('')

  const rows = data?.rows ?? []
  const columns = rows.length ? Object.keys(rows[0]) : []
  const numeric = (key: string) => rows.some((row) => typeof row[key] === 'number')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Reports" subtitle="Ad hoc views computed from source records · exportable">
        <Button
          size="sm"
          onClick={async () => {
            try {
              const response = await fetch(`/api/export/${domain === 'activities' ? 'activities' : domain === 'tickets' ? 'tickets' : domain === 'campaigns' ? 'campaigns' : domain === 'deals' ? 'deals' : domain === 'leads' ? 'leads' : 'contacts'}`, { credentials: 'same-origin' })
              if (!response.ok) {
                const payload: any = await response.json().catch(() => null)
                throw new Error((payload as any)?.error?.message ?? 'Export failed')
              }
              const blob = await response.blob()
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `${domain}.csv`
              link.click()
              URL.revokeObjectURL(url)
            } catch (err: any) {
              toast(err?.message ?? 'Export failed', 'bad')
            }
          }}
          disabled={!meta?.permissions.canExport}
        >
          <Download size={13} /> Export CSV
        </Button>
        <Button size="sm" variant="primary" onClick={() => setSaved(true)}>
          <Save size={13} /> Save view
        </Button>
      </PageHeader>
      <div className="border-b border-line px-5">
        <Tabs tabs={DOMAINS.map((item) => ({ key: item.key, label: item.label }))} active={domain} onChange={setDomain} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : rows.length === 0 ? (
          <EmptyState title="No data for this report" description="The report is empty because there are no matching records — never padded with placeholder figures." />
        ) : (
          <table className="gx-table">
            <thead>
              <tr>{columns.map((column) => <th key={column}>{titleCase(column)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} className={numeric(column) ? 'tabular-nums' : ''}>
                      {typeof row[column] === 'number' ? number(row[column]) : row[column] === null ? '—' : String(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-line px-5 py-2 text-[11px] text-muted">
        Report definitions are computed from CRM tables. Currency values keep their source currency; no cross-currency totals are produced.
      </div>

      {saved ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="gx-scrim" onClick={() => setSaved(false)} />
          <div className="gx-modal p-5">
            <h2 className="text-sm font-semibold">Save this report</h2>
            <div className="mt-3">
              <FormRow label="Report name"><input className="gx-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={`${titleCase(domain)} report`} /></FormRow>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" onClick={() => setSaved(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  try {
                    await post('/api/resources/reports', {
                      name: name.trim() || `${titleCase(domain)} report`,
                      domain,
                      metrics: columns.join(','),
                      filters: JSON.stringify({ range: 'all' }),
                    })
                    toast('Report saved.', 'good')
                    setSaved(false)
                    setName('')
                  } catch (err: any) {
                    toast(err?.message ?? 'Could not save the report.', 'bad')
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------- files */
export function FilesPage() {
  const { toast, meta } = useApp()
  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>('/api/resources/files?limit=100')
  const [folder, setFolder] = useState('All files')
  const [busy, setBusy] = useState(false)
  const rows = (data?.data ?? []).filter((file) => (folder === 'All files' ? true : file.folder === folder))
  const folders = ['All files', ...new Set((data?.data ?? []).map((file) => String(file.folder)))]

  const upload = async (file: File) => {
    if (file.size > 600_000) {
      toast('Files over 600 KB cannot be stored in this build (D1 row limit). Connect object storage for larger uploads.', 'bad')
      return
    }
    setBusy(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Could not read the file'))
        reader.readAsDataURL(file)
      })
      await post('/api/files/upload', { name: file.name, folder, mime: file.type || 'application/octet-stream', data: base64 })
      toast('File uploaded.', 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Upload failed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Files repository" subtitle={`${data?.total ?? 0} files · tenant-scoped downloads`}>
        <select className="gx-select w-auto" value={folder} onChange={(event) => setFolder(event.target.value)}>
          {folders.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <label className="gx-btn gx-btn-primary gx-btn-sm cursor-pointer">
          <Upload size={13} /> {busy ? 'Uploading…' : 'Upload file'}
          <input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
        </label>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : rows.length === 0 ? (
          <EmptyState icon={<Folder size={18} />} title="No files in this folder" description="Upload a PDF, image or document up to 600 KB. Metadata and content are stored per tenant." />
        ) : (
          <table className="gx-table">
            <thead><tr><th>Name</th><th>Folder</th><th>Type</th><th>Size</th><th>Added</th><th className="w-16" /></tr></thead>
            <tbody>
              {rows.map((file) => (
                <tr key={file.id}>
                  <td className="font-medium">
                    <span className="flex items-center gap-1.5"><FileText size={13} className="text-muted" /> {file.name}</span>
                  </td>
                  <td>{file.folder}</td>
                  <td className="text-[11px] text-muted">{file.mime}</td>
                  <td>{Math.round(Number(file.size) / 1024)} KB</td>
                  <td>{formatDateTime(file.created_at)}</td>
                  <td>
                    <a className="gx-icon-btn" href={`/api/files/${file.id}/download`} title="Download" aria-label="Download">
                      <Download size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-line px-5 py-2 text-[11px] text-muted">
        Uploads are stored in the workspace database; there is no public bucket. External storage adapters (Drive, S3) show Not Connected in Connected Apps.
        {meta ? '' : ''}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- trash */
export function TrashPage() {
  const { toast } = useApp()
  const { data, loading, error, reload } = useFetch<{ groups: { entity: string; label: string; items: Row[] }[] }>('/api/trash')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Trash" subtitle="Soft-deleted records, restorable while the retention window is open" />
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-4">
        {loading ? <Spinner /> : error ? <ErrorState message={error.message} onRetry={reload} /> : (data?.groups ?? []).length === 0 ? (
          <EmptyState icon={<Trash2 size={18} />} title="Trash is empty" description="Deleted records appear here with the time they were removed. Restoring returns them to their list." />
        ) : (
          <div className="space-y-4">
            {(data?.groups ?? []).map((group) => (
              <Card key={group.entity}>
                <CardHeader title={`${group.label} · ${group.items.length}`} subtitle={`Entity: ${group.entity}`} />
                <table className="gx-table">
                  <thead><tr><th>Record</th><th>Deleted</th><th className="w-24" /></tr></thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium">{String(item.label ?? item.id)}</td>
                        <td className="text-[11.5px] text-muted">{formatDateTime(item.deleted_at)}</td>
                        <td>
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await post(`/api/resources/${group.entity}/${item.id}/restore`)
                                toast('Record restored.', 'good')
                                reload()
                              } catch (err: any) {
                                toast(err?.message ?? 'Could not restore the record.', 'bad')
                              }
                            }}
                          >
                            <RotateCcw size={12} /> Restore
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- inbox */
export function InboxPage() {
  const { data } = useFetch<{ data: Row[] }>('/api/activities?limit=40&type=email')
  const [compose, setCompose] = useState(false)
  const [form, setForm] = useState({ to: '', subject: '', body: '' })
  const { toast } = useApp()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Inbox" subtitle="Mailbox sync and sending require a connected Gmail or Microsoft 365 account">
        <Button size="sm" variant="primary" onClick={() => setCompose((v) => !v)}>Compose</Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        {compose ? (
          <Card className="mb-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormRow label="To"><input className="gx-input" value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} placeholder="customer@example.com" /></FormRow>
              <FormRow label="Subject"><input className="gx-input" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></FormRow>
              <FormRow label="Message" className="sm:col-span-2"><textarea className="gx-textarea" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></FormRow>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  try {
                    await post('/api/inbox/send', form)
                    toast('Message accepted by the provider.', 'good')
                  } catch (error: any) {
                    toast(error?.message ?? 'The mailbox did not accept the message.', 'bad')
                  }
                }}
              >
                Send
              </Button>
              <span className="text-[11px] text-muted">No mailbox is connected, so the server will refuse to claim a send.</span>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card className="p-6 text-center">
            <InboxIcon size={24} className="mx-auto text-faint" />
            <h2 className="mt-2 text-[14px] font-semibold">No mailbox connected</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Connect Gmail or Microsoft 365 in Connected Apps to sync folders, threads and attachments. This list stays empty rather than showing
              invented messages.
            </p>
            <Link to="/settings/apps" className="gx-btn gx-btn-primary gx-btn-sm mt-3">Open Connected Apps</Link>
          </Card>
          <Card>
            <CardHeader title="Recent email activity" subtitle="From campaigns, sequences and test sends" />
            <ul className="divide-y divide-line">
              {(data?.data ?? []).length === 0 ? <li className="px-4 py-4 text-[12px] text-muted">No email activity recorded yet.</li> : null}
              {(data?.data ?? []).map((item) => (
                <li key={item.id} className="px-4 py-2.5 text-[12px]">
                  <div>{item.summary}</div>
                  <div className="text-[10.5px] text-muted">{formatDateTime(item.created_at)}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- public pages */
export function PublicFormPage({ slug }: { slug: string }) {
  const { data, loading, error } = useFetch<{ form: Row }>(`/api/public/forms/${slug}`)
  const [values, setValues] = useState<Row>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <PublicShell><Spinner label="Loading form" /></PublicShell>
  if (error || !data) return <PublicShell><p className="text-sm text-muted">This form is not published.</p></PublicShell>

  const fields = JSON.parse(String(data.form.fields ?? '[]')) as Row[]
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const response = await fetch(`/api/public/forms/${slug}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const payload: any = await response.json()
      if (!response.ok) {
        setErrors((payload as any)?.error?.fields ?? {})
        throw new Error((payload as any)?.error?.message ?? 'Submission failed')
      }
      setDone(payload.message ?? 'Thanks!')
    } catch (err: any) {
      if (!Object.keys(errors).length) setErrors({ _: err?.message ?? 'Submission failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      {done ? (
        <div className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-good-soft text-good">✓</div>
          <h1 className="text-[18px] font-semibold">{done}</h1>
          <p className="mt-1 text-[12.5px] text-muted">A record was created in the workspace and the submission was stored.</p>
        </div>
      ) : (
        <>
          <h1 className="text-[20px] font-semibold">{data.form.name}</h1>
          <p className="mt-1 text-[12.5px] text-muted">Fields marked with * are required.</p>
          <form className="mt-4 space-y-3" onSubmit={submit}>
            {fields.map((field) => (
              <label key={String(field.key)} className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted">
                  {field.label} {field.required ? <span className="text-danger">*</span> : null}
                </span>
                {field.type === 'textarea' ? (
                  <textarea className="gx-textarea" value={String(values[String(field.key)] ?? '')} onChange={(event) => setValues({ ...values, [String(field.key)]: event.target.value })} />
                ) : field.type === 'select' ? (
                  <select className="gx-select" value={String(values[String(field.key)] ?? '')} onChange={(event) => setValues({ ...values, [String(field.key)]: event.target.value })}>
                    <option value="">Select…</option>
                    {(field.options ?? []).map((option: string) => <option key={option}>{option}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={Boolean(values[String(field.key)])} onChange={(event) => setValues({ ...values, [String(field.key)]: event.target.checked })} />
                ) : (
                  <input className="gx-input" type={String(field.type ?? 'text')} value={String(values[String(field.key)] ?? '')} onChange={(event) => setValues({ ...values, [String(field.key)]: event.target.value })} />
                )}
                {errors[String(field.key)] ? <span className="mt-0.5 block text-[11px] text-danger">{errors[String(field.key)]}</span> : null}
              </label>
            ))}
            {errors._ ? <p className="text-[12px] text-danger">{errors._}</p> : null}
            <Button variant="primary" type="submit" loading={busy} className="w-full">Submit</Button>
            {data.form.consent_text ? <p className="text-[10.5px] leading-snug text-faint">{String(data.form.consent_text)}</p> : null}
          </form>
        </>
      )}
    </PublicShell>
  )
}

export function PublicLandingPage({ slug }: { slug: string }) {
  const { data, loading, error } = useFetch<{ page: Row; form: Row | null }>(`/api/public/pages/${slug}`)
  const [values, setValues] = useState<Row>({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (loading) return <PublicShell><Spinner label="Loading page" /></PublicShell>
  if (error || !data) return <PublicShell><p className="text-sm text-muted">This page is not published.</p></PublicShell>
  const rawHtml = String(data.page.html ?? '')
  if (rawHtml) {
    const css = `${String(data.page.css ?? '')}\n${String(data.page.css_custom ?? '')}`
    const doc = rawHtml.includes('</head>')
      ? rawHtml.replace('</head>', `<style>${css}</style></head>`)
      : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${rawHtml}</body></html>`
    return (
      <iframe
        title={String(data.page.name ?? 'Landing page')}
        srcDoc={doc}
        className="fixed inset-0 h-screen w-screen border-0 bg-white"
      />
    )
  }
  const blocks = JSON.parse(String(data.page.blocks ?? '[]')) as Row[]

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!data.form) return
    setBusy(true)
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/public/forms/${data.form.slug}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const payload: any = await response.json()
      if (!response.ok) throw new Error((payload as any)?.error?.message ?? 'Submission failed')
      setDone(true)
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <div className="space-y-6">
        {blocks.map((block) => (
          <div key={String(block.id)}>
            {block.type === 'hero' ? (
              <div className="rounded-2xl bg-gradient-to-br from-accent-soft to-surface-2 p-6">
                <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{block.title}</h1>
                <p className="mt-2 text-[13.5px] text-muted">{block.subtitle}</p>
              </div>
            ) : null}
            {block.type === 'text' ? <p className="text-[13.5px] leading-relaxed text-muted">{block.body}</p> : null}
            {block.type === 'form' && data.form ? (
              done ? (
                <div className="rounded-xl bg-good-soft p-4 text-center text-[13px] text-good">Thanks — your details were saved.</div>
              ) : (
                <form className="space-y-2.5 rounded-xl border border-line p-4" onSubmit={submit}>
                  {(JSON.parse(String(data.form.fields ?? '[]')) as Row[]).map((field) => (
                    <label key={String(field.key)} className="block">
                      <span className="mb-1 block text-[11.5px] font-medium text-muted">{field.label}{field.required ? ' *' : ''}</span>
                      {field.type === 'textarea' ? (
                        <textarea className="gx-textarea" value={String(values[String(field.key)] ?? '')} onChange={(event) => setValues({ ...values, [String(field.key)]: event.target.value })} />
                      ) : field.type === 'checkbox' ? (
                        <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={Boolean(values[String(field.key)])} onChange={(event) => setValues({ ...values, [String(field.key)]: event.target.checked })} />
                      ) : (
                        <input className="gx-input" type={String(field.type ?? 'text')} value={String(values[String(field.key)] ?? '')} onChange={(event) => setValues({ ...values, [String(field.key)]: event.target.value })} />
                      )}
                    </label>
                  ))}
                  {errorMessage ? <p className="text-[11.5px] text-danger">{errorMessage}</p> : null}
                  <Button variant="primary" type="submit" loading={busy} className="w-full">Request a demo</Button>
                </form>
              )
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-[10.5px] text-faint">Powered by GoFox CRM · submissions are stored in the tenant workspace.</p>
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-10">
      <div className="mx-auto max-w-[560px] rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
              <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="text-[13px] font-semibold">GoFox CRM</span>
        </div>
        {children}
      </div>
    </div>
  )
}

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="text-[46px] font-semibold text-faint">404</div>
      <h1 className="mt-1 text-[17px] font-semibold">This page does not exist</h1>
      <p className="mt-1 max-w-sm text-[12.5px] text-muted">The link may be out of date, or the record was removed. Nothing was changed.</p>
      <Button size="sm" variant="primary" className="mt-4" onClick={() => navigate('/')}>Back to home</Button>
    </div>
  )
}

export function ReportsSummary() {
  const { data } = useFetch<{ data: Row[] }>('/api/resources/reports')
  return (
    <Card>
      <CardHeader title="Saved reports" subtitle={`${data?.data.length ?? 0} saved views`} />
      <ul className="divide-y divide-line">
        {(data?.data ?? []).map((report) => (
          <li key={report.id} className="flex items-center justify-between px-4 py-2 text-[12.5px]">
            <span>{report.name}</span>
            <Badge>{report.domain}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function ReportKpis({ values }: { values: { label: string; value: number; currency?: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {values.map((item) => (
        <Kpi key={item.label} label={item.label} value={item.currency ? money(item.value, item.currency) : number(item.value)} />
      ))}
    </div>
  )
}
