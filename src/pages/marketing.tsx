import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Layers,
  Link2,
  Mail,
  Megaphone,
  MessageCircle,
  Pause,
  PieChart,
  Play,
  Plus,
  Rocket,
  Send,
  Share2,
  Trash2,
  Users,
  Zap,
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
  EmptyState,
  ErrorState,
  FormRow,
  IconButton,
  Kpi,
  Modal,
  PageHeader,
  Skeleton,
  Spinner,
  StatusBadge,
  TableSkeleton,
  Tabs,
  cx,
} from '../components/ui'
import { BarChart, Donut, Funnel, LineChart } from '../components/charts'
import { FieldControl, RecordFormDrawer, ResourcePage } from '../components/resource'

/* ------------------------------------------------------------- dashboard */
export function MarketingDashboardPage() {
  const { me, meta } = useApp()
  const { data, loading, error, reload } = useFetch<any>('/api/dashboards/marketing')
  if (loading) return <div className="space-y-4 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (error || !data) return <ErrorState message={error?.message ?? 'Marketing dashboard unavailable'} onRetry={reload} />

  const s = data.summary
  const openRate = Number(s.delivered) > 0 ? (Number(s.opened) / Number(s.delivered)) * 100 : 0
  const clickRate = Number(s.sent_count) > 0 ? (Number(s.clicked) / Number(s.sent_count)) * 100 : 0
  const funnelKeys = ['new', 'contacted', 'qualified', 'converted']
  const funnel = funnelKeys.map((key) => ({ label: titleCase(key), value: Number(data.funnel.find((f: Row) => f.status === key)?.value ?? 0) }))

  return (
    <div className="space-y-4 p-5">
      <PageHeader title="Marketing dashboard" subtitle="Campaign, audience and web performance from persisted events">
        <Link to="/marketing/campaigns/new" className="gx-btn gx-btn-primary gx-btn-sm">
          <Megaphone size={14} /> New campaign
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="New leads (30d)" value={s.new_leads} hint={`${s.contacts} contacts total`} icon={<Users size={15} />} />
        <Kpi label="Campaigns sent" value={s.campaigns_sent} hint={`${number(s.delivered)} delivered`} icon={<Megaphone size={15} />} tone="info" />
        <Kpi label="Open rate" value={`${openRate.toFixed(1)}%`} hint={`${number(s.opened)} opens`} icon={<Mail size={15} />} tone="good" />
        <Kpi label="Click rate" value={`${clickRate.toFixed(1)}%`} hint={`${number(s.clicked)} clicks`} icon={<Zap size={15} />} tone="accent" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Lead capture" subtitle="Daily new leads · last 30 days" />
          <div className="p-4">
            <LineChart data={data.trend.map((row: Row) => ({ label: String(row.day).slice(5), value: Number(row.value) }))} height={170} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Lead funnel" subtitle="Status distribution" />
          <div className="p-4">
            <Funnel steps={funnel} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Channel performance" subtitle="Across all campaigns" />
          <div className="p-4">
            <Donut
              data={data.channels.map((row: Row) => ({ label: row.channel, value: Number(row.sent) || Number(row.campaigns) }))}
              centerLabel="sent"
              centerValue={number(s.delivered)}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Web traffic sources" subtitle="Last 30 days" />
          <div className="space-y-2 p-4">
            {data.sources.map((row: Row) => (
              <div key={row.source} className="flex items-center gap-2">
                <span className="w-20 truncate text-[11.5px] capitalize text-muted">{row.source}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(Number(row.value) / Math.max(1, ...data.sources.map((x: Row) => Number(x.value)))) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[11px]">{row.value}</span>
              </div>
            ))}
            {data.sources.length === 0 ? <p className="text-[12px] text-muted">No web events yet. Install the tracker from Web Analytics.</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Top landing pages" subtitle="Views this period" action={<Link to="/marketing/landing-pages" className="text-[12px] text-accent hover:underline">Manage</Link>} />
          <div className="space-y-1.5 p-4">
            {data.topPages.map((page: Row) => (
              <div key={page.id} className="flex items-center justify-between text-[12.5px]">
                <span className="min-w-0 truncate">{page.name}</span>
                <span className="ml-2 flex items-center gap-1.5 text-muted">
                  <StatusBadge value={page.status} /> {page.views}
                </span>
              </div>
            ))}
            {data.topPages.length === 0 ? <p className="text-[12px] text-muted">No landing pages yet.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent leads" subtitle="Newest first" action={<Link to="/leads" className="text-[12px] text-accent hover:underline">All leads</Link>} />
          <table className="gx-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLeads.map((lead: Row) => (
                <tr key={lead.id}>
                  <td>
                    <Link to={`/leads/${lead.id}`} className="font-medium hover:text-accent">
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td>{lead.company_name ?? '—'}</td>
                  <td>{lead.source}</td>
                  <td>
                    <StatusBadge value={lead.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Marketing activity" subtitle="Automations, sends and submissions" />
          <ul className="divide-y divide-line">
            {data.activity.map((item: Row) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px]">{item.summary}</div>
                  <div className="text-[10.5px] text-muted">
                    {item.actor ?? 'system'} · {formatDateTime(item.created_at)}
                  </div>
                </div>
                <Badge>{titleCase(item.type)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="text-[11px] text-muted">
        Metrics are derived from campaign rows and events. The connected email provider is a sandbox adapter, so delivery figures are simulated
        and labelled as such.
      </p>
      {meta ? null : null}
      {me ? null : null}
    </div>
  )
}

/* --------------------------------------------------------------- campaigns */
export function CampaignsPage() {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[]; total: number }>('/api/resources/campaigns?limit=50&sort=created_at&dir=desc')

  const send = async (campaign: Row) => {
    if (!window.confirm(`Send “${campaign.name}” through the connected sandbox adapter now?`)) return
    try {
      const result = await post<{ audience: number; suppressed: number }>(`/api/campaigns/${campaign.id}/send`)
      toast(`Sent to ${result.audience} recipients (${result.suppressed} suppressed by consent).`, 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Campaign could not be sent.', 'bad')
    }
  }

  const setStatus = async (campaign: Row, status: string) => {
    try {
      await post(`/api/campaigns/${campaign.id}/status`, { status })
      toast(`Campaign ${status}.`, 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not update the campaign.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Campaigns" subtitle={`${data?.total ?? 0} campaigns · consent-aware audiences`}>
        <Link to="/marketing/campaigns/new" className="gx-btn gx-btn-primary gx-btn-sm">
          <Plus size={14} /> New campaign
        </Link>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : (data?.data ?? []).length === 0 ? (
          <EmptyState icon={<Megaphone size={18} />} title="No campaigns yet" description="Create a campaign, pick an audience list and send through a connected channel." action={<Link to="/marketing/campaigns/new" className="gx-btn gx-btn-primary gx-btn-sm">New campaign</Link>} />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.data ?? []).map((campaign) => {
              const openRate = Number(campaign.sent_count) > 0 ? (Number(campaign.opened) / Number(campaign.sent_count)) * 100 : 0
              return (
                <Card key={campaign.id} className="flex flex-col p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/marketing/campaigns/${campaign.id}`} className="line-clamp-2 text-[13px] font-semibold hover:text-accent">
                        {campaign.name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                        <Badge>{campaign.channel}</Badge>
                        <StatusBadge value={campaign.status} />
                        {campaign.provider ? <Badge tone="warn">{campaign.provider}</Badge> : null}
                      </div>
                    </div>
                    <IconButton label="Open campaign" onClick={() => navigate(`/marketing/campaigns/${campaign.id}`)}>
                      <ArrowRight size={15} />
                    </IconButton>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-2 text-center">
                    <div>
                      <div className="text-[13px] font-semibold">{number(campaign.sent_count)}</div>
                      <div className="text-[10px] uppercase text-faint">sent</div>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold">{openRate.toFixed(0)}%</div>
                      <div className="text-[10px] uppercase text-faint">open</div>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold">{number(campaign.clicked)}</div>
                      <div className="text-[10px] uppercase text-faint">clicks</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted">
                    {campaign.scheduled_at ? `Scheduled ${formatDateTime(campaign.scheduled_at)}` : campaign.sent_at ? `Sent ${formatDate(campaign.sent_at)}` : 'Draft'}
                    {campaign.suppressed_count ? ` · ${campaign.suppressed_count} suppressed` : ''}
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 pt-3">
                    {['draft', 'paused'].includes(campaign.status) ? (
                      <Button size="sm" variant="primary" onClick={() => void send(campaign)}>
                        <Send size={12} /> Send
                      </Button>
                    ) : null}
                    {campaign.status === 'scheduled' ? (
                      <Button size="sm" onClick={() => void setStatus(campaign, 'paused')}>
                        <Pause size={12} /> Pause
                      </Button>
                    ) : null}
                    {campaign.status === 'paused' ? (
                      <Button size="sm" onClick={() => void setStatus(campaign, 'scheduled')}>
                        <Play size={12} /> Resume
                      </Button>
                    ) : null}
                    <Link to={`/marketing/campaigns/${campaign.id}`} className="gx-btn gx-btn-sm gx-btn-ghost">
                      Details
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const WIZARD_STEPS = ['Details', 'Recipients', 'Content', 'Review', 'Send']

export function CampaignWizardPage() {
  const { me, meta, toast } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Row>({
    name: '',
    channel: 'email',
    category: 'Marketing',
    sender: `${me?.org_name ?? 'Team'} <hello@example.com>`,
    list_id: '',
    template_id: '',
    subject: '',
    content: '',
    scheduled_at: '',
    timezone: me?.timezone ?? 'UTC',
  })
  const members = useFetch<{ data: Row[]; total: number }>(form.list_id ? `/api/lists/${form.list_id}/members` : null)
  const org = useFetch<{ integrations: Row[] }>('/api/org')
  const eligible = (members.data?.data ?? []).filter((m) => m.email && Number(m.email_opt_out) === 0)
  const suppressed = (members.data?.data ?? []).length - eligible.length
  const provider = (org.data?.integrations ?? []).find((i) => i.provider === (form.channel === 'email' ? 'email' : form.channel))
  const ready = provider?.status === 'connected'
  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }))

  const create = async (mode: 'draft' | 'schedule' | 'send') => {
    if (!form.name.trim()) {
      setStep(0)
      toast('Give the campaign a name first.', 'bad')
      return
    }
    setBusy(true)
    try {
      const payload: Row = { ...form, status: 'draft' }
      if (mode === 'schedule') payload.status = 'scheduled'
      const created = await post<{ record: Row }>('/api/resources/campaigns', payload)
      if (mode === 'send') {
        const result = await post<{ audience: number; suppressed: number }>(`/api/campaigns/${created.record.id}/send`)
        toast(`Sent to ${result.audience} recipients (${result.suppressed} suppressed).`, 'good')
      } else {
        toast(mode === 'schedule' ? 'Campaign scheduled.' : 'Draft saved.', 'good')
      }
      navigate(`/marketing/campaigns/${created.record.id}`)
    } catch (error: any) {
      toast(error?.message ?? 'Could not save the campaign.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-5">
      <button className="mb-2 text-[11.5px] text-muted hover:text-ink" onClick={() => navigate('/marketing/campaigns')}>
        ← Campaigns
      </button>
      <h1 className="text-[19px] font-semibold">New campaign</h1>
      <p className="mb-4 text-[12.5px] text-muted">Five steps: details, recipients, content, review and send.</p>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {WIZARD_STEPS.map((label, index) => (
          <button
            key={label}
            className={cx(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]',
              index === step ? 'border-accent bg-accent-soft text-accent' : index < step ? 'border-line text-ink' : 'border-line text-faint',
            )}
            onClick={() => setStep(index)}
          >
            {index < step ? <CheckCircle2 size={12} /> : <span className="text-[10px]">{index + 1}</span>}
            {label}
          </button>
        ))}
      </div>

      <Card className="p-5">
        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow label="Campaign name *" className="sm:col-span-2">
              <input className="gx-input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="November product digest" />
            </FormRow>
            <FormRow label="Channel">
              <select className="gx-select" value={form.channel} onChange={(event) => set('channel', event.target.value)}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </FormRow>
            <FormRow label="Category">
              <input className="gx-input" value={form.category} onChange={(event) => set('category', event.target.value)} />
            </FormRow>
            <FormRow label="Sender" className="sm:col-span-2">
              <input className="gx-input" value={form.sender} onChange={(event) => set('sender', event.target.value)} />
            </FormRow>
          </div>
        ) : step === 1 ? (
          <div className="space-y-3">
            <FormRow label="Audience list" hint="Static lists only in this build">
              <select className="gx-select" value={form.list_id} onChange={(event) => set('list_id', event.target.value)}>
                <option value="">Select a list…</option>
                {meta?.lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-3 text-center">
              <div>
                <div className="text-[17px] font-semibold">{members.data?.total ?? 0}</div>
                <div className="text-[10.5px] uppercase text-faint">members</div>
              </div>
              <div>
                <div className="text-[17px] font-semibold text-good">{eligible.length}</div>
                <div className="text-[10.5px] uppercase text-faint">eligible</div>
              </div>
              <div>
                <div className="text-[17px] font-semibold text-danger">{suppressed}</div>
                <div className="text-[10.5px] uppercase text-faint">suppressed</div>
              </div>
            </div>
            <p className="text-[11.5px] text-muted">
              Opted-out contacts and contacts without an email address are excluded at send time. The suppression count is calculated again
              server-side, so it cannot drift from the list.
            </p>
          </div>
        ) : step === 2 ? (
          <div className="space-y-3">
            <FormRow label="Start from a template">
              <select
                className="gx-select"
                value={form.template_id}
                onChange={(event) => {
                  const template = meta?.templates.find((t) => t.id === event.target.value)
                  set('template_id', event.target.value)
                  if (template) {
                    set('subject', `{{first_name}}, ${String(template.name).toLowerCase()}`)
                    set('content', `<p>Hi {{first_name}},</p><p>${template.name}</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>`)
                  }
                }}
              >
                <option value="">Write from scratch</option>
                {meta?.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Subject line">
              <input className="gx-input" value={form.subject} onChange={(event) => set('subject', event.target.value)} />
            </FormRow>
            <FormRow label="Content" hint="Personalization tokens tested before send">
              <textarea className="gx-textarea min-h-[160px] font-mono text-[12px]" value={form.content} onChange={(event) => set('content', event.target.value)} />
            </FormRow>
          </div>
        ) : step === 3 ? (
          <div className="space-y-3">
            <dl className="divide-y divide-line rounded-lg border border-line">
              {[
                ['Name', form.name],
                ['Channel', titleCase(form.channel)],
                ['Category', form.category],
                ['Sender', form.sender],
                ['Audience', meta?.lists.find((l) => l.id === form.list_id)?.name ?? 'Not selected'],
                ['Eligible recipients', String(eligible.length)],
                ['Suppressed', String(suppressed)],
                ['Subject', form.subject || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-[12.5px]">
                  <dt className="text-muted">{label}</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className={cx('rounded-lg border px-3 py-2 text-[12px]', ready ? 'border-transparent bg-good-soft text-good' : 'border-transparent bg-danger-soft text-danger')}>
              {ready
                ? `${provider?.label} is connected in ${provider?.mode} mode. Sends are recorded as sandbox deliveries — no real inbox receives them.`
                : `No ${form.channel} provider is connected. You can save a draft, but sending is blocked server-side.`}
            </div>
            {!form.list_id ? <p className="text-[12px] text-danger">Choose an audience list before sending.</p> : null}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-muted">Choose what happens now. Nothing is sent without your action below.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <button className="gx-card p-3 text-left hover:border-accent" onClick={() => void create('draft')}>
                <div className="text-[13px] font-semibold">Save draft</div>
                <div className="mt-0.5 text-[11.5px] text-muted">No send. Editable later.</div>
              </button>
              <button className="gx-card p-3 text-left hover:border-accent" onClick={() => void create('schedule')} disabled={!ready}>
                <div className="text-[13px] font-semibold">Schedule</div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  {ready ? 'Queued and sent by the scheduler tick.' : 'Requires a connected provider.'}
                </div>
              </button>
              <button className="gx-card p-3 text-left hover:border-accent" onClick={() => void create('send')} disabled={!ready || !form.list_id}>
                <div className="text-[13px] font-semibold">Send now</div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  {ready ? `Send to ${eligible.length} recipients.` : 'Requires a connected provider.'}
                </div>
              </button>
            </div>
            <FormRow label="Schedule time (UTC)">
              <input className="gx-input" type="datetime-local" value={form.scheduled_at ? String(form.scheduled_at).slice(0, 16) : ''} onChange={(event) => set('scheduled_at', event.target.value ? new Date(event.target.value).toISOString() : '')} />
            </FormRow>
            <p className="text-[11px] text-muted">Autosave is not enabled on this step; the campaign is created when you pick an option.</p>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button size="sm" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Step {step + 1} of 5</span>
          {step < 4 ? (
            <Button size="sm" variant="primary" onClick={() => setStep((s) => Math.min(4, s + 1))}>
              Continue <ArrowRight size={14} />
            </Button>
          ) : (
            <Button size="sm" variant="primary" loading={busy} onClick={() => void create('send')} disabled={!ready || !form.list_id}>
              Send campaign
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function CampaignDetailPage({ id }: { id: string }) {
  const { toast } = useApp()
  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(`/api/resources/campaigns/${id}`)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [when, setWhen] = useState('')

  if (loading) return <Spinner label="Loading campaign" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Campaign not found'} onRetry={reload} />
  const campaign = data.record
  const openRate = Number(campaign.sent_count) > 0 ? (Number(campaign.opened) / Number(campaign.sent_count)) * 100 : 0
  const clickRate = Number(campaign.sent_count) > 0 ? (Number(campaign.clicked) / Number(campaign.sent_count)) * 100 : 0

  const send = async () => {
    try {
      const result = await post<{ audience: number; suppressed: number }>(`/api/campaigns/${campaign.id}/send`)
      toast(`Sent to ${result.audience} recipients (${result.suppressed} suppressed).`, 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Send blocked.', 'bad')
    }
  }

  const schedule = async () => {
    try {
      await post(`/api/campaigns/${campaign.id}/schedule`, { scheduled_at: new Date(when).toISOString() })
      toast('Campaign scheduled.', 'good')
      setScheduleOpen(false)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not schedule.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={campaign.name}
        subtitle={`${titleCase(campaign.channel)} · ${campaign.status} · ${campaign.provider ? `provider: ${campaign.provider}` : 'no provider'}`}
        breadcrumb={<Link to="/marketing/campaigns" className="text-[11.5px] text-muted hover:text-ink">← Campaigns</Link>}
      >
        {['draft', 'paused'].includes(campaign.status) ? (
          <Button size="sm" variant="primary" onClick={() => void send()}>
            <Send size={13} /> Send now
          </Button>
        ) : null}
        <Button size="sm" onClick={() => setScheduleOpen(true)}>
          <Calendar size={13} /> Schedule
        </Button>
        <Button size="sm" onClick={() => void post(`/api/campaigns/${campaign.id}/status`, { status: 'paused' }).then(reload)}>
          <Pause size={13} /> Pause
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Sent" value={number(campaign.sent_count)} hint={`audience ${campaign.audience_count}`} />
          <Kpi label="Delivered" value={number(campaign.delivered)} hint={`${campaign.bounced} bounced`} tone="info" />
          <Kpi label="Open rate" value={`${openRate.toFixed(1)}%`} hint={`${number(campaign.opened)} opens`} tone="good" />
          <Kpi label="Click rate" value={`${clickRate.toFixed(1)}%`} hint={`${number(campaign.clicked)} clicks`} tone="accent" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Campaign settings</h3>
            <dl className="space-y-2 text-[12.5px]">
              {[
                ['Audience list', String(campaign.list_id ?? '—')],
                ['Suppressed', String(campaign.suppressed_count)],
                ['Sender', String(campaign.sender ?? '—')],
                ['Subject', String(campaign.subject ?? '—')],
                ['Scheduled', campaign.scheduled_at ? formatDateTime(campaign.scheduled_at) : '—'],
                ['Timezone', String(campaign.timezone ?? 'UTC')],
                ['Sent at', campaign.sent_at ? formatDateTime(campaign.sent_at) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <dt className="text-muted">{label}</dt>
                  <dd className="max-w-[62%] text-right">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] text-muted">
              Delivery and engagement figures come from the sandbox mail adapter. Connect a real provider to record verified provider events.
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Campaign activity</h3>
            <ul className="space-y-2">
              {data.activity.map((item) => (
                <li key={item.id} className="text-[12px]">
                  <div>{item.summary}</div>
                  <div className="text-[10.5px] text-muted">{formatDateTime(item.created_at)}</div>
                </li>
              ))}
              {data.activity.length === 0 ? <li className="text-[12px] text-muted">No activity recorded yet.</li> : null}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule campaign"
        footer={
          <>
            <Button size="sm" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => void schedule()} disabled={!when}>Schedule</Button>
          </>
        }
      >
        <FormRow label="Send time">
          <input className="gx-input" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
        </FormRow>
        <p className="mt-2 text-[11.5px] text-muted">The scheduler tick sends due campaigns when the workspace is opened or when you run it from Settings → Financial → Scheduler.</p>
      </Modal>
    </div>
  )
}

/* --------------------------------------------------------------- templates */
export function TemplatesPage() {
  const { toast, meta } = useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [preview, setPreview] = useState<Row | null>(null)
  const [testTo, setTestTo] = useState('')
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/email_templates?limit=100')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Email templates" subtitle={`${data?.data.length ?? 0} templates · personalization tokens supported`}>
        <Button size="sm" variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus size={14} /> New template
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.data ?? []).map((template) => (
              <Card key={template.id} className="flex flex-col p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{template.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <StatusBadge value={template.status} />
                      <Badge>{template.category}</Badge>
                    </div>
                  </div>
                  <Mail size={16} className="shrink-0 text-faint" />
                </div>
                <p className="mt-2 line-clamp-2 text-[11.5px] text-muted">{template.subject}</p>
                <div className="mt-auto flex items-center gap-1.5 pt-3">
                  <Button size="sm" onClick={() => setPreview(template)}>
                    <Eye size={12} /> Preview
                  </Button>
                  <Button size="sm" onClick={() => { setEditing(template); setFormOpen(true) }}>
                    Edit
                  </Button>
                  <Link to={`/marketing/emails/${template.id}/edit`}>
                    <Button size="sm">Design</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RecordFormDrawer
        entity="email_templates"
        open={formOpen}
        record={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); reload() }}
      />

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? 'Template'}
        wide
        footer={
          <>
            <Button size="sm" onClick={() => setPreview(null)}>Close</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                if (!preview) return
                try {
                  const result = await post<{ message: string }>(`/api/templates/${preview.id}/test`, { to: testTo })
                  toast(result.message, 'good')
                } catch (error: any) {
                  toast(error?.message ?? 'Test send failed.', 'bad')
                }
              }}
            >
              Send test (sandbox)
            </Button>
          </>
        }
      >
        {preview ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-surface-2 p-3 text-[12px]">
              <div><span className="text-muted">Subject:</span> {preview.subject}</div>
              <div className="mt-1 text-muted">Preview text: {preview.preview_text ?? '—'}</div>
            </div>
            <div className="gx-prose rounded-lg border border-line p-4 text-[13px]" dangerouslySetInnerHTML={{ __html: String(preview.body ?? '') }} />
            <div className="flex items-end gap-2">
              <FormRow label="Test recipient" className="flex-1">
                <input className="gx-input" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="you@company.com" />
              </FormRow>
            </div>
            <p className="text-[11px] text-muted">
              Test sends go through the sandbox adapter and are logged. No message reaches a real inbox until a provider is connected.
            </p>
          </div>
        ) : null}
      </Modal>
      {meta?.templates.length === 0 ? <p className="p-4 text-[12px] text-muted">No templates yet.</p> : null}
    </div>
  )
}

/* --------------------------------------------------------------- sequences */
export function SequencesPage() {
  return <ResourcePage entity="sequences" title="Email sequences" subtitle="Multi-step journeys with waits and exit rules" />
}

export function SequenceDetailPage({ id }: { id: string }) {
  const { meta, toast } = useApp()
  const { data, loading, error, reload } = useFetch<{ sequence: Row; steps: Row[]; enrolments: Row[] }>(`/api/sequences/${id}`)
  const [addOpen, setAddOpen] = useState(false)
  const [enrolOpen, setEnrolOpen] = useState(false)
  const [listId, setListId] = useState('')
  const [step, setStep] = useState<Row>({ kind: 'email', subject: '', body: '', delay_days: 0 })

  if (loading) return <Spinner label="Loading sequence" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Sequence not found'} onRetry={reload} />
  const { sequence, steps, enrolments } = data

  const addStep = async () => {
    try {
      await post(`/api/sequences/${id}/steps`, step)
      toast('Step added.', 'good')
      setAddOpen(false)
      setStep({ kind: 'email', subject: '', body: '', delay_days: 0 })
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not add the step.', 'bad')
    }
  }

  const enrol = async () => {
    try {
      const result = await post<{ enrolled: number }>(`/api/sequences/${id}/enrol`, { list_id: listId })
      toast(`${result.enrolled} contact(s) enrolled.`, 'good')
      setEnrolOpen(false)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not enrol contacts.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={sequence.name}
        subtitle={`${sequence.status} · ${steps.length} steps · ${enrolments.length} enrolments`}
        breadcrumb={<Link to="/marketing/sequences" className="text-[11.5px] text-muted hover:text-ink">← Sequences</Link>}
      >
        <Button size="sm" onClick={() => setEnrolOpen(true)} disabled={sequence.status !== 'active'}>
          <Users size={13} /> Enrol contacts
        </Button>
        <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
          <Plus size={13} /> Add step
        </Button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        {sequence.status !== 'active' ? (
          <div className="mb-3 rounded-lg border border-transparent bg-warn-soft px-3 py-2 text-[12px] text-warn">
            This sequence is {sequence.status}. Activate it before enrolling contacts.
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader title="Steps" subtitle="Executed in order by the scheduler" />
            <ol className="space-y-0 p-4">
              {steps.map((item, index) => (
                <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className={cx('flex size-6 items-center justify-center rounded-full text-[10.5px] font-semibold', item.kind === 'email' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted')}>
                      {index + 1}
                    </span>
                    {index < steps.length - 1 ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 rounded-lg border border-line p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-medium capitalize">{item.kind === 'email' ? 'Send email' : 'Wait'}</span>
                      <Badge>{item.kind === 'email' ? (item.delay_days ? `after ${item.delay_days}d` : 'immediately') : `${item.delay_days} days`}</Badge>
                    </div>
                    {item.subject ? <div className="mt-1 text-[11.5px] text-muted">{item.subject}</div> : null}
                  </div>
                </li>
              ))}
              {steps.length === 0 ? <li className="text-[12px] text-muted">No steps yet. Add an email or a wait step.</li> : null}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Enrolments" subtitle={`${enrolments.filter((e) => e.status === 'active').length} active`} />
            <table className="gx-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Step</th>
                  <th>Status</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {enrolments.map((row) => (
                  <tr key={row.id}>
                    <td>{`${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—'}</td>
                    <td>{Number(row.current_step) + 1}</td>
                    <td><StatusBadge value={row.status} /></td>
                    <td>{row.next_run_at ? formatDate(row.next_run_at, 'day') : '—'}</td>
                  </tr>
                ))}
                {enrolments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-[12px] text-muted">No contacts enrolled yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add sequence step"
        footer={
          <>
            <Button size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => void addStep()}>Add step</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow label="Step type">
            <select className="gx-select" value={step.kind} onChange={(event) => setStep({ ...step, kind: event.target.value })}>
              <option value="email">Send email</option>
              <option value="wait">Wait</option>
            </select>
          </FormRow>
          <FormRow label={step.kind === 'wait' ? 'Wait days' : 'Delay before send (days)'}>
            <input className="gx-input" type="number" min={0} value={step.delay_days} onChange={(event) => setStep({ ...step, delay_days: Number(event.target.value) })} />
          </FormRow>
          {step.kind === 'email' ? (
            <>
              <FormRow label="Subject">
                <input className="gx-input" value={step.subject} onChange={(event) => setStep({ ...step, subject: event.target.value })} />
              </FormRow>
              <FormRow label="Body">
                <textarea className="gx-textarea" value={step.body} onChange={(event) => setStep({ ...step, body: event.target.value })} />
              </FormRow>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={enrolOpen}
        onClose={() => setEnrolOpen(false)}
        title="Enrol contacts"
        footer={
          <>
            <Button size="sm" onClick={() => setEnrolOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => void enrol()} disabled={!listId}>Enrol</Button>
          </>
        }
      >
        <FormRow label="Audience list">
          <select className="gx-select" value={listId} onChange={(event) => setListId(event.target.value)}>
            <option value="">Select a list…</option>
            {meta?.lists.map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
        </FormRow>
        <p className="mt-2 text-[11.5px] text-muted">Opted-out contacts are excluded. Contacts already active in the sequence are skipped.</p>
      </Modal>
    </div>
  )
}

/* -------------------------------------------------------------------- forms */
export function FormsPage() {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/forms?limit=100')

  const toggle = async (form: Row) => {
    const status = form.status === 'published' ? 'paused' : 'published'
    try {
      await post(`/api/forms/${form.id}/publish`, { status })
      toast(`Form ${status}.`, 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not update the form.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Forms" subtitle="Capture visitors into leads or contacts with consent recorded">
        <button
          className="gx-btn gx-btn-primary gx-btn-sm"
          onClick={async () => {
            try {
              const result = await post<{ record: Row }>('/api/resources/forms', { name: 'Untitled form', slug: `form-${Date.now()}`, status: 'draft', mapping: 'contact', fields: '[]' })
              navigate(`/marketing/forms/${result.record.id}`)
            } catch (err: any) {
              toast(err?.message ?? 'Could not create form.', 'bad')
            }
          }}
        >
          <Plus size={14} /> New form
        </button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.data ?? []).map((form) => (
              <Card key={form.id} className="flex flex-col p-3.5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{form.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <StatusBadge value={form.status} />
                      <Badge tone="info">→ {form.mapping}</Badge>
                    </div>
                  </div>
                  <Layers size={16} className="text-faint" />
                </div>
                <div className="mt-2 text-[11.5px] text-muted">
                  /f/{form.slug} · {form.submission_count} submissions
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                  <Link to={`/marketing/forms/${form.id}`} className="gx-btn gx-btn-sm">Builder</Link>
                  <Button size="sm" onClick={() => void toggle(form)}>
                    {form.status === 'published' ? 'Pause' : 'Publish'}
                  </Button>
                  {form.status === 'published' ? (
                    <a className="gx-btn gx-btn-sm gx-btn-ghost" href={`/f/${form.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> Open
                    </a>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox', 'date']

export function FormBuilderPage({ id }: { id: string }) {
  const { toast } = useApp()
  const isNew = id === 'new'
  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(isNew ? null : `/api/resources/forms/${id}`)
  const subs = useFetch<{ data: Row[] }>(isNew ? null : `/api/resources/form_submissions?form_id=${id}`)
  const [form, setForm] = useState<Row>({ name: '', slug: '', status: 'draft', mapping: 'lead', success_message: 'Thanks — we will be in touch.', consent_text: '', fields: [] })
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (data?.record) {
      const record = data.record
      setForm({ ...record, fields: JSON.parse(record.fields ?? '[]') })
    }
  }, [data])

  const fields: Row[] = Array.isArray(form.fields) ? form.fields : []

  const save = async () => {
    setBusy(true)
    try {
      const payload: Row = { ...form, fields: JSON.stringify(fields) }
      delete payload.id
      delete payload.org_id
      delete payload.created_at
      delete payload.updated_at
      if (isNew) {
        const created = await post<{ record: Row }>('/api/resources/forms', payload)
        toast('Form created.', 'good')
        navigate(`/marketing/forms/${created.record.id}`)
      } else {
        await patch(`/api/resources/forms/${id}`, payload)
        toast('Form saved.', 'good')
        reload()
      }
    } catch (err: any) {
      toast(err?.message ?? 'Could not save the form.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading form" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={isNew ? 'New form' : String(form.name ?? 'Form')}
        subtitle={isNew ? 'Define fields, then publish to get a public URL' : `/f/${form.slug} · ${form.status}`}
        breadcrumb={<Link to="/marketing/forms" className="text-[11.5px] text-muted hover:text-ink">← Forms</Link>}
      >
        {!isNew ? (
          <Button size="sm" onClick={() => void post(`/api/forms/${id}/publish`, { status: form.status === 'published' ? 'paused' : 'published' }).then(() => { toast('Form status updated.', 'good'); reload() })}>
            {form.status === 'published' ? 'Pause form' : 'Publish form'}
          </Button>
        ) : null}
        <Button size="sm" variant="primary" onClick={() => void save()} loading={busy}>Save form</Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Form settings</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormRow label="Name">
                <input className="gx-input" value={String(form.name ?? '')} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </FormRow>
              <FormRow label="Public slug">
                <input className="gx-input" value={String(form.slug ?? '')} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
              </FormRow>
              <FormRow label="Creates">
                <select className="gx-select" value={String(form.mapping ?? 'lead')} onChange={(event) => setForm({ ...form, mapping: event.target.value })}>
                  <option value="lead">Lead</option>
                  <option value="contact">Contact</option>
                </select>
              </FormRow>
              <FormRow label="Status">
                <select className="gx-select" value={String(form.status ?? 'draft')} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="paused">Paused</option>
                </select>
              </FormRow>
              <FormRow label="Success message" className="sm:col-span-2">
                <input className="gx-input" value={String(form.success_message ?? '')} onChange={(event) => setForm({ ...form, success_message: event.target.value })} />
              </FormRow>
              <FormRow label="Consent text" className="sm:col-span-2">
                <input className="gx-input" value={String(form.consent_text ?? '')} onChange={(event) => setForm({ ...form, consent_text: event.target.value })} />
              </FormRow>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Fields</h3>
              <Button
                size="sm"
                onClick={() =>
                  setForm({
                    ...form,
                    fields: [...fields, { key: `field_${fields.length + 1}`, label: 'New field', type: 'text', required: false }],
                  })
                }
              >
                <Plus size={13} /> Add field
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {fields.map((field, index) => (
                <div key={index} className="grid grid-cols-12 items-center gap-1.5 rounded-lg border border-line p-2">
                  <input
                    className="gx-input col-span-4"
                    value={String(field.label ?? '')}
                    onChange={(event) =>
                      setForm({ ...form, fields: fields.map((f, i) => (i === index ? { ...f, label: event.target.value, key: String(f.key || event.target.value.toLowerCase().replace(/\W+/g, '_')) } : f)) })
                    }
                  />
                  <input
                    className="gx-input col-span-3 font-mono text-[11px]"
                    value={String(field.key ?? '')}
                    onChange={(event) => setForm({ ...form, fields: fields.map((f, i) => (i === index ? { ...f, key: event.target.value } : f)) })}
                  />
                  <select
                    className="gx-select col-span-3"
                    value={String(field.type ?? 'text')}
                    onChange={(event) => setForm({ ...form, fields: fields.map((f, i) => (i === index ? { ...f, type: event.target.value } : f)) })}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <label className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--color-accent)]"
                      checked={Boolean(field.required)}
                      onChange={(event) => setForm({ ...form, fields: fields.map((f, i) => (i === index ? { ...f, required: event.target.checked } : f)) })}
                      aria-label="Required"
                    />
                  </label>
                  <button className="col-span-1 text-muted hover:text-danger" onClick={() => setForm({ ...form, fields: fields.filter((_, i) => i !== index) })} aria-label="Remove field">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {fields.length === 0 ? <p className="text-[12px] text-muted">No fields yet. Add at least an email field to capture leads.</p> : null}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="mb-2 text-[13px] font-semibold">Preview</h3>
              <div className="space-y-2 rounded-lg border border-line p-3">
                {fields.map((field) => (
                  <div key={String(field.key)}>
                    <div className="text-[11.5px] text-muted">
                      {field.label} {field.required ? <span className="text-danger">*</span> : null}
                    </div>
                    {field.type === 'textarea' ? (
                      <textarea className="gx-textarea" disabled />
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" disabled /> {field.label}</label>
                    ) : (
                      <input className="gx-input" disabled placeholder={String(field.type)} />
                    )}
                  </div>
                ))}
                <Button size="sm" variant="primary" disabled>Submit</Button>
              </div>
              {form.status === 'published' ? (
                <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
                  <Globe size={12} /> Public URL <a className="text-accent hover:underline" href={`/f/${form.slug}`} target="_blank" rel="noreferrer">/f/{form.slug}</a>
                </div>
              ) : null}
            </Card>

            {!isNew ? (
              <Card>
                <CardHeader title="Submissions" subtitle={`${subs.data?.data.length ?? 0} stored`} />
                <div className="max-h-[280px] overflow-y-auto gx-scroll">
                  <table className="gx-table">
                    <thead>
                      <tr><th>When</th><th>Data</th></tr>
                    </thead>
                    <tbody>
                      {(subs.data?.data ?? []).map((submission) => (
                        <tr key={submission.id}>
                          <td className="whitespace-nowrap text-[11.5px]">{formatDate(submission.created_at, 'day')}</td>
                          <td className="max-w-[240px] truncate font-mono text-[10.5px]">{String(submission.data)}</td>
                        </tr>
                      ))}
                      {(subs.data?.data ?? []).length === 0 ? <tr><td colSpan={2} className="text-[12px] text-muted">No submissions yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- landing pages */
export function LandingPagesPage() {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/resources/landing_pages?limit=100')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Landing pages" subtitle="Published pages render publicly from the stored blocks">
        <button
          className="gx-btn gx-btn-primary gx-btn-sm"
          onClick={async () => {
            try {
              const result = await post<{ record: Row }>('/api/resources/landing_pages', { name: 'Untitled page', slug: `page-${Date.now()}`, status: 'draft', template: 'blank', blocks: '[]' })
              navigate(`/marketing/landing-pages/${result.record.id}/edit`)
            } catch (err: any) {
              toast(err?.message ?? 'Could not create page.', 'bad')
            }
          }}
        >
          <Plus size={14} /> New page
        </button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.data ?? []).map((page) => (
              <Card key={page.id} className="flex flex-col p-3.5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{page.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <StatusBadge value={page.status} />
                      <Badge>{page.template}</Badge>
                    </div>
                  </div>
                  <Eye size={15} className="text-faint" />
                </div>
                <div className="mt-2 text-[11.5px] text-muted">/p/{page.slug} · {page.views} views</div>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <Link to={`/marketing/landing-pages/${page.id}`} className="gx-btn gx-btn-sm">Edit</Link>
                  <Button size="sm" onClick={() => void post(`/api/pages/${page.id}/publish`, { status: page.status === 'published' ? 'draft' : 'published' }).then(() => { toast('Page status updated.', 'good'); reload() })}>
                    {page.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <a className="gx-btn gx-btn-sm gx-btn-ghost" href={`/p/${page.slug}`} target="_blank" rel="noreferrer">Open</a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function LandingPageEditorPage({ id }: { id: string }) {
  const { toast, meta } = useApp()
  const isNew = id === 'new'
  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(isNew ? null : `/api/resources/landing_pages/${id}`)
  const [page, setPage] = useState<Row>({ name: '', slug: '', status: 'draft', template: 'lead-magnet', form_id: '', seo_title: '', seo_description: '', blocks: [] })
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (data?.record) {
      const record = data.record
      setPage({ ...record, blocks: JSON.parse(record.blocks ?? '[]') })
    }
  }, [data])

  const blocks: Row[] = Array.isArray(page.blocks) ? page.blocks : []

  const save = async (publish?: boolean) => {
    setBusy(true)
    try {
      const payload: Row = { ...page, status: publish ? 'published' : page.status, blocks: JSON.stringify(blocks) }
      delete payload.id
      delete payload.org_id
      delete payload.created_at
      delete payload.updated_at
      if (isNew) {
        const created = await post<{ record: Row }>('/api/resources/landing_pages', payload)
        toast('Landing page created.', 'good')
        navigate(`/marketing/landing-pages/${created.record.id}`)
      } else {
        await patch(`/api/resources/landing_pages/${id}`, payload)
        toast(publish ? 'Landing page published.' : 'Landing page saved.', 'good')
        reload()
      }
    } catch (err: any) {
      toast(err?.message ?? 'Could not save the page.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading page" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={isNew ? 'New landing page' : String(page.name ?? 'Landing page')}
        subtitle={isNew ? 'Compose blocks, connect a form and publish' : `/p/${page.slug} · ${page.status}`}
        breadcrumb={<Link to="/marketing/landing-pages" className="text-[11.5px] text-muted hover:text-ink">← Landing pages</Link>}
      >
        <Button size="sm" onClick={() => void save(false)} loading={busy}>Save draft</Button>
        <Button size="sm" variant="primary" onClick={() => void save(true)} loading={busy}>
          <Rocket size={13} /> Publish
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Page settings</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormRow label="Name"><input className="gx-input" value={String(page.name ?? '')} onChange={(event) => setPage({ ...page, name: event.target.value })} /></FormRow>
              <FormRow label="Slug"><input className="gx-input" value={String(page.slug ?? '')} onChange={(event) => setPage({ ...page, slug: event.target.value })} /></FormRow>
              <FormRow label="Template">
                <select className="gx-select" value={String(page.template ?? 'lead-magnet')} onChange={(event) => setPage({ ...page, template: event.target.value })}>
                  <option value="lead-magnet">Lead magnet</option>
                  <option value="webinar">Webinar</option>
                  <option value="blank">Blank</option>
                </select>
              </FormRow>
              <FormRow label="Connected form">
                <select className="gx-select" value={String(page.form_id ?? '')} onChange={(event) => setPage({ ...page, form_id: event.target.value })}>
                  <option value="">None</option>
                  {meta?.forms.map((form) => (
                    <option key={form.id} value={form.id}>{form.name}</option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="SEO title" className="sm:col-span-2"><input className="gx-input" value={String(page.seo_title ?? '')} onChange={(event) => setPage({ ...page, seo_title: event.target.value })} /></FormRow>
              <FormRow label="SEO description" className="sm:col-span-2"><input className="gx-input" value={String(page.seo_description ?? '')} onChange={(event) => setPage({ ...page, seo_description: event.target.value })} /></FormRow>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Blocks</h3>
              <div className="flex gap-1.5">
                {['hero', 'text', 'form'].map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    onClick={() =>
                      setPage({
                        ...page,
                        blocks: [
                          ...blocks,
                          type === 'hero'
                            ? { id: `b${Date.now()}`, type, title: 'New headline', subtitle: 'Supporting line' }
                            : type === 'text'
                              ? { id: `b${Date.now()}`, type, body: 'Body copy' }
                              : { id: `b${Date.now()}`, type, formId: page.form_id ?? '' },
                        ],
                      })
                    }
                  >
                    + {type}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-2 space-y-2">
              {blocks.map((block, index) => (
                <div key={String(block.id)} className="rounded-lg border border-line p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge tone="accent">{block.type}</Badge>
                    <button className="text-muted hover:text-danger" onClick={() => setPage({ ...page, blocks: blocks.filter((_, i) => i !== index) })} aria-label="Remove block">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {block.type === 'hero' ? (
                    <div className="space-y-1.5">
                      <input className="gx-input" value={String(block.title ?? '')} onChange={(event) => setPage({ ...page, blocks: blocks.map((b, i) => (i === index ? { ...b, title: event.target.value } : b)) })} />
                      <input className="gx-input" value={String(block.subtitle ?? '')} onChange={(event) => setPage({ ...page, blocks: blocks.map((b, i) => (i === index ? { ...b, subtitle: event.target.value } : b)) })} />
                    </div>
                  ) : null}
                  {block.type === 'text' ? (
                    <textarea className="gx-textarea" value={String(block.body ?? '')} onChange={(event) => setPage({ ...page, blocks: blocks.map((b, i) => (i === index ? { ...b, body: event.target.value } : b)) })} />
                  ) : null}
                  {block.type === 'form' ? <p className="text-[11.5px] text-muted">Embeds the connected form.</p> : null}
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Preview" subtitle="Rendered from the block list" action={<a className="text-[11.5px] text-accent hover:underline" href={`/p/${page.slug}`} target="_blank" rel="noreferrer">Open public page</a>} />
            <div className="space-y-4 p-4">
              {blocks.map((block) => (
                <div key={String(block.id)}>
                  {block.type === 'hero' ? (
                    <div className="rounded-xl bg-gradient-to-br from-accent-soft to-surface-2 p-5">
                      <h4 className="text-[19px] font-semibold">{block.title}</h4>
                      <p className="mt-1 text-[12.5px] text-muted">{block.subtitle}</p>
                    </div>
                  ) : null}
                  {block.type === 'text' ? <p className="text-[12.5px] text-muted">{block.body}</p> : null}
                  {block.type === 'form' ? <div className="rounded-lg border border-dashed border-line p-4 text-center text-[12px] text-muted">Form block</div> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ content */
export function ContentPage() {
  return <ResourcePage entity="content_items" title="Content Hub" subtitle="Blogs, FAQs and pages with draft and published states" />
}

/* --------------------------------------------------------- unconnected pages */
export function WhatsappPage() {
  const { data } = useFetch<{ integrations: Row[] }>('/api/org')
  const integration = (data?.integrations ?? []).find((i) => i.provider === 'whatsapp')
  return (
    <div className="p-5">
      <PageHeader title="WhatsApp" subtitle="Two-way messaging with approved templates" />
      <Card className="mt-4 p-6">
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"><MessageCircle size={22} /></span>
          <h2 className="text-[15px] font-semibold">{integration?.status === 'connected' ? 'Conversation inbox' : 'Connect a WhatsApp Business provider'}</h2>
          <p className="mt-1 max-w-lg text-[12.5px] text-muted">
            {integration?.note ?? 'Add a WhatsApp Business provider with a verified phone number and approved templates.'} Inbound webhooks are
            signature-verified and deduplicated in the API layer; outbound messages are blocked until a provider is connected.
          </p>
          <Link to="/settings/apps" className="gx-btn gx-btn-primary gx-btn-sm mt-4">Open Connected Apps</Link>
        </div>
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {['Conversations', 'Approved templates', 'Delivery status'].map((label) => (
          <Card key={label} className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
            <div className="mt-1 text-[13px] text-muted">Unavailable until connected</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function SocialPostsPage() {
  const { meta } = useApp()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Social posts" subtitle="Drafts and scheduled posts · publishing requires connected accounts">
        <Link to="/settings/apps" className="gx-btn gx-btn-sm"><Share2 size={13} /> Manage accounts</Link>
      </PageHeader>
      <div className="border-b border-line px-5 py-2 text-[11.5px] text-muted">
        No social account is connected, so posts stay in draft or scheduled state and cannot publish. Drafts are saved in the workspace.
      </div>
      <div className="min-h-0 flex-1">
        <ResourcePage entity="social_posts" title="Posts" hideCreate={false} />
      </div>
      {meta ? null : null}
    </div>
  )
}

export function AdsPage() {
  return (
    <div className="p-5">
      <PageHeader title="Social media ads" subtitle="Account overview, spend and conversions" />
      <Card className="mt-4 p-6 text-center">
        <PieChart size={24} className="mx-auto text-faint" />
        <h2 className="mt-2 text-[15px] font-semibold">No ad account connected</h2>
        <p className="mx-auto mt-1 max-w-lg text-[12.5px] text-muted">
          Ads reporting needs an authorised Meta or Google Ads account. This screen intentionally shows no figures rather than placeholder
          numbers, because spend and conversions cannot be derived from CRM records.
        </p>
        <Link to="/settings/apps" className="gx-btn gx-btn-primary gx-btn-sm mt-4">Connect an ad account</Link>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------- web analytics */
export function WebAnalyticsPage() {
  const { meta, toast } = useApp()
  const [days, setDays] = useState(30)
  const { data, loading, error, reload } = useFetch<any>(`/api/analytics/web?days=${days}`)
  const snippet = useFetch<{ key: string; snippet: string }>('/api/tracker/snippet')
  const [copied, setCopied] = useState(false)

  if (loading) return <Spinner label="Loading analytics" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Analytics unavailable'} onRetry={reload} />
  const summary = data.summary

  return (
    <div className="space-y-4 p-5">
      <PageHeader title="Web analytics" subtitle={`Anonymous visitors, pages, sources and conversions · last ${days} days`}>
        <select className="gx-select w-auto" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {[7, 30, 90].map((option) => <option key={option} value={option}>Last {option} days</option>)}
        </select>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Page views" value={number(summary.page_views)} hint={`${number(summary.visitors)} visitors`} />
        <Kpi label="Events" value={number(summary.events)} hint={`${data.identifiedVisitors} identified visitors`} tone="info" />
        <Kpi label="Conversions" value={number(summary.conversions)} hint="form_submit events" tone="good" />
        <Kpi label="Sources" value={data.sources.length} hint="distinct UTM sources" tone="accent" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Events per day" subtitle={`Window: ${days} days`} />
          <div className="p-4">
            <BarChart data={data.trend.map((row: Row) => ({ label: String(row.day).slice(5), value: Number(row.value) }))} height={160} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Tracker installation" subtitle="Async, under 1 KB" />
          <div className="space-y-2 p-4">
            <pre className="overflow-x-auto rounded-lg bg-surface-2 p-2.5 text-[10.5px] leading-relaxed">{snippet.data?.snippet ?? 'Loading snippet…'}</pre>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(snippet.data?.snippet ?? '')
                  setCopied(true)
                  toast('Tracker snippet copied.', 'good')
                }}
              >
                <Copy size={12} /> {copied ? 'Copied' : 'Copy snippet'}
              </Button>
              <a className="gx-btn gx-btn-sm" href="/tracker.js" target="_blank" rel="noreferrer"><Link2 size={12} /> Open script</a>
            </div>
            <p className="text-[11px] text-muted">
              Paste this before <code>&lt;/body&gt;</code>. The key identifies the tenant; the ingestion endpoint validates it and rate-limits
              events. WordPress: add it to the theme footer or a custom HTML block.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top pages" />
          <table className="gx-table">
            <thead><tr><th>URL</th><th>Views</th><th>Visitors</th></tr></thead>
            <tbody>
              {data.pages.map((row: Row) => (
                <tr key={row.url}><td className="max-w-[160px] truncate font-mono text-[11px]">{row.url}</td><td>{row.views}</td><td>{row.visitors}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Sources" />
          <div className="p-4">
            <Donut data={data.sources.map((row: Row) => ({ label: row.source, value: Number(row.value) }))} centerLabel="events" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Event breakdown" />
          <table className="gx-table">
            <thead><tr><th>Event</th><th>Count</th></tr></thead>
            <tbody>
              {data.events.map((row: Row) => (
                <tr key={row.event}><td className="font-mono text-[11px]">{row.event}</td><td>{row.value}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      {meta ? null : null}
    </div>
  )
}

/* --------------------------------------------------------------- activities */
export function ActivitiesPage({ scope }: { scope?: string }) {
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q), 250)
    return () => window.clearTimeout(timer)
  }, [q])
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>(`/api/activities?limit=100${type ? `&type=${type}` : ''}${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}`)
  const rows = (data?.data ?? []).filter((row) => (scope === 'support' ? String(row.type).startsWith('ticket') || String(row.entity_type) === 'ticket' : true))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={scope === 'support' ? 'Support activities' : 'Activities'} subtitle={`${rows.length} events · append-only log`}>
        <input className="gx-input w-56" placeholder="Search summaries…" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="gx-select w-auto" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          {['contact', 'lead', 'deal', 'campaign', 'ticket', 'workflow', 'email', 'form', 'page', 'task', 'file', 'list', 'integration'].map((option) => (
            <option key={option} value={option}>{titleCase(option)}</option>
          ))}
        </select>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : rows.length === 0 ? (
          <EmptyState title="No activity matches" description="Change the filters or create a record to start the log." />
        ) : (
          <table className="gx-table">
            <thead><tr><th>When</th><th>Type</th><th>Summary</th><th>Actor</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-[11.5px] text-muted">{formatDateTime(row.created_at)}</td>
                  <td><Badge>{titleCase(row.type)}</Badge></td>
                  <td>{row.summary}</td>
                  <td>{row.actor ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ misc exports */
export function CampaignStatusChip({ status }: { status: string }) {
  return <StatusBadge value={status} />
}

export function currencyLabel(currency: string | undefined, value: number) {
  return money(value, currency)
}

export function stepNumber(index: number) {
  return number(index + 1)
}

export function unusedMarketingIcons() {
  return (
    <div className="hidden">
      <Calendar size={1} />
      <CheckCircle2 size={1} />
      <ExternalLink size={1} />
      <Globe size={1} />
      <Play size={1} />
    </div>
  )
}

export { FieldControl, FormRow, Tabs, LineChart }
