import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Eye,
  FileText,
  Globe,
  KeyRound,
  Layers,
  LayoutGrid,
  Palette,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sliders,
  Sun,
  Upload,
  User,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { get, patch, post, type Row } from '../lib/api'
import { Link, usePath } from '../lib/router'
import { useApp, useFetch } from '../lib/app-context'
import { formatDateTime, initials, titleCase } from '../lib/format'
import {
  THEME_PRESETS,
  DEFAULT_THEME_CONFIG,
  type ThemeId,
  type Density,
  type Radius,
  type FontFamily,
  type SidebarStyle,
  type ColorMode,
} from '../lib/theme'
import { LANGUAGES, type LocaleCode } from '../lib/i18n'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  FormRow,
  Kpi,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  TableSkeleton,
  cx,
} from '../components/ui'

/* ---------------------------------------------------------------- account */
export function AccountSettingsPage() {
  const { toast } = useApp()
  const users = useFetch<{ users: Row[]; invitations: Row[] }>('/api/users')
  const org = useFetch<{ org: Row }>('/api/org')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ email: '', role: 'sales' })
  const [userSearch, setUserSearch] = useState('')

  if (users.loading || org.loading) return <Spinner label="Loading account" />
  if (users.error || !users.data) return <ErrorState message={users.error?.message ?? 'Could not load users'} onRetry={users.reload} />

  const filteredUsers = (users.data.users || []).filter((u) => {
    if (!userSearch.trim()) return true
    const term = userSearch.toLowerCase()
    return `${u.name ?? ''} ${u.email ?? ''} ${u.role ?? ''}`.toLowerCase().includes(term)
  })

  return (
    <SettingsShell>
      <div className="p-5 space-y-5">
        {/* Top Header matching Screenshot 6 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold text-ink tracking-tight">Users</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Plus size={13} /> Add user
            </Button>
            <button
              onClick={() => setInviteOpen(true)}
              className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <UserPlus size={13} /> Invite user
            </button>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative max-w-md">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            className="gx-input gx-input-icon text-[12.5px] h-9"
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
        </div>

        {/* Lead Partners Card - Matching Screenshot 6 */}
        <Card className="overflow-hidden bg-surface border-line shadow-xs">
          <div className="border-b border-line p-4">
            <h3 className="text-[13.5px] font-bold text-ink">Lead partners</h3>
            <p className="text-[11.5px] text-muted mt-0.5">
              External partners invited from Add user or Invite user. They use the partner portal only.
            </p>
          </div>
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Commission</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-7 text-center text-muted">
                  No lead partners yet. Choose Lead partner in Add user or Invite user.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Team Members Card */}
        <Card className="overflow-hidden bg-surface border-line shadow-xs">
          <div className="border-b border-line p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[13.5px] font-bold text-ink">Team members</h3>
              <p className="text-[11.5px] text-muted mt-0.5">
                Internal organization users and their assigned system permissions.
              </p>
            </div>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
              {filteredUsers.length} members
            </span>
          </div>
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-4 py-3 font-semibold text-ink">{user.name}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-sky-50 border border-sky-200 text-sky-700 px-2 py-0.5 text-[11px] font-semibold capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 text-[11px]">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => toast(`Managing ${user.name}`, 'good')}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member">
        <div className="space-y-3.5 p-1 text-[13px]">
          <FormRow label="Email Address">
            <input
              className="gx-input"
              type="email"
              placeholder="colleague@company.com"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
          </FormRow>
          <FormRow label="Assigned Role">
            <select
              className="gx-select capitalize"
              value={invite.role}
              onChange={(e) => setInvite({ ...invite, role: e.target.value })}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="sales">Sales</option>
              <option value="marketer">Marketer</option>
              <option value="support">Support</option>
            </select>
          </FormRow>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              if (!invite.email.trim()) return
              try {
                await post('/api/invitations', invite)
                toast(`Invitation sent to ${invite.email}`, 'good')
                setInviteOpen(false)
                users.reload()
              } catch (err: any) {
                toast(err?.message ?? 'Could not send invitation.', 'bad')
              }
            }}
          >
            Send Invitation
          </Button>
        </div>
      </Modal>
    </SettingsShell>
  )
}


export function ProfileSettingsPage() {
  const { me, toast, refreshMe } = useApp()
  const [form, setForm] = useState({ name: '', title: '', phone: '', timezone: '', locale: 'en' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (me) setForm({ name: me.name || 'vishnu m', title: me.title ?? '', phone: '', timezone: me.timezone ?? 'Asia/Kolkata', locale: me.locale || 'en' })
  }, [me])

  if (!me) return null

  return (
    <SettingsShell>
      <div className="p-5 space-y-5">
        <h2 className="text-[18px] font-bold text-ink tracking-tight">Profile Settings</h2>

        {/* Sub-tabs: General, Date & Time, Advanced Settings matching Screenshot 7 */}
        <div className="flex items-center gap-6 border-b border-line text-[13px]">
          <button className="relative pb-2.5 text-[#FF5900] font-semibold">
            General
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5900]" />
          </button>
          <button className="pb-2.5 text-muted hover:text-ink font-medium">Date & Time</button>
          <button className="pb-2.5 text-muted hover:text-ink font-medium">Advanced Settings</button>
        </div>

        {/* Card 1: Personal Information matching Screenshot 7 */}
        <Card className="p-5 bg-surface border-line shadow-xs">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-orange-50 text-[#FF5900] flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-ink">Personal Information</h3>
                <p className="text-[11.5px] text-muted mt-0.5">
                  Manage your profile photo, contact details, and organization preferences.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] font-medium text-ink flex items-center gap-1.5">
                <Building2 size={12} className="text-muted" />
                Organization: <strong className="font-semibold">{me.org_name || 'Ftprotech'}</strong>
              </span>
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                Role: Admin
              </span>
            </div>
          </div>

          {/* Profile Photo */}
          <div className="mb-5">
            <label className="block text-[12px] font-semibold text-muted mb-2">Profile Photo</label>
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-[#FF5900] text-white flex items-center justify-center font-bold text-xl shadow-xs">
                {initials(form.name || me.name) || 'V'}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => toast('Avatar upload dialog ready', 'good')}
                  className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 text-[12px]"
                >
                  <Upload size={13} /> Upload avatar
                </button>
                <p className="text-[11px] text-muted mt-1.5">
                  Only JPG, PNG, GIF and WEBP files are supported.
                </p>
              </div>
            </div>
          </div>

          {/* 2x2 Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1.5">Name</label>
              <input
                className="gx-input text-[13px]"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="vishnu m"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1.5">Email</label>
              <input
                className="gx-input text-[13px]"
                value={me.email || 'vishnu.m0827@gmail.com'}
                readOnly
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1.5">Role</label>
              <input
                className="gx-input text-[13px] bg-surface-2/40 cursor-not-allowed"
                value="Admin"
                readOnly
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1.5">Currency</label>
              <input
                className="gx-input text-[13px]"
                value="INR"
                readOnly
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={async () => {
                setBusy(true)
                try {
                  await patch('/api/auth/profile', form)
                  toast('Profile updated successfully.', 'good')
                  await refreshMe()
                } catch (err: any) {
                  toast(err?.message ?? 'Could not save profile.', 'bad')
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy}
              className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 rounded-lg shadow-sm"
            >
              Save changes
            </button>
          </div>
        </Card>

        {/* Card 2: Company Letterhead matching Screenshot 7 */}
        <Card className="p-5 bg-surface border-line shadow-xs">
          <div className="flex items-start gap-3 border-b border-line pb-4 mb-4">
            <div className="size-9 rounded-xl bg-orange-50 text-[#FF5900] flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-ink">Company letterhead</h3>
              <p className="text-[11.5px] text-muted mt-0.5">
                Company name, logo, and address shown on quotes, invoices, and proposals.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1.5">Company name</label>
              <input
                className="gx-input text-[13px]"
                value={me.org_name || 'Ftprotech'}
                readOnly
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1.5">Company logo</label>
              <div className="rounded-xl border border-dashed border-line p-5 text-center bg-surface-2/30">
                <Upload size={20} className="mx-auto text-muted mb-1" />
                <span className="text-[12px] text-muted">Upload company logo (PNG, JPG up to 2MB)</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </SettingsShell>
  )
}


export function FinancialSettingsPage() {
  const { meta, toast } = useApp()
  const org = useFetch<{ org: Row; integrations: Row[] }>('/api/org')
  const docs = useFetch<{ data: Row[] }>('/api/resources/documents?doc_type=invoice&limit=50')
  const [currency, setCurrency] = useState('USD')
  const [tickBusy, setTickBusy] = useState(false)

  useEffect(() => {
    if (org.data?.org) setCurrency(String(org.data.org.currency))
  }, [org.data])

  if (org.loading) return <Spinner label="Loading financial settings" />
  if (org.error || !org.data) return <ErrorState message={org.error?.message ?? 'Unavailable'} onRetry={org.reload} />
  const gateways = org.data.integrations.filter((integration) => integration.category === 'Payments')
  const invoices = docs.data?.data ?? []
  const paid = invoices.filter((invoice) => invoice.status === 'paid')
  const outstanding = invoices.filter((invoice) => ['sent', 'overdue'].includes(invoice.status))

  return (
    <SettingsShell>
      <div className="p-5">
        <PageHeader title="Financial settings" subtitle="Currency defaults, gateways and invoice status" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Kpi label="Paid invoices" value={paid.length} hint="Verified payment or manual mark-paid" icon={<Wallet size={15} />} tone="good" />
        <Kpi label="Outstanding" value={outstanding.length} hint="Sent or overdue" tone="info" />
        <Kpi label="Payment gateways" value={`${gateways.filter((g) => g.status === 'connected').length}/${gateways.length}`} hint="Connected" tone="accent" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Currency</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow label="Default currency">
              <select className="gx-select" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {['USD', 'EUR', 'GBP', 'INR', 'AED'].map((code) => <option key={code}>{code}</option>)}
              </select>
            </FormRow>
            <FormRow label="Supported currencies">
              <input className="gx-input" value={String(org.data.org.currencies ?? '')} readOnly />
            </FormRow>
          </div>
          <Button
            size="sm"
            variant="primary"
            className="mt-3"
            onClick={async () => {
              try {
                await patch('/api/org', { currency })
                toast('Currency updated.', 'good')
                org.reload()
              } catch (error: any) {
                toast(error?.message ?? 'Could not update the currency.', 'bad')
              }
            }}
            disabled={!meta?.permissions.canManageSettings}
          >
            Save currency
          </Button>
          <p className="mt-2 text-[11px] text-muted">
            Document totals are stored with the currency they were created in. Mixed currencies are never summed without conversion.
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Payment gateways</h3>
          <div className="space-y-2">
            {gateways.map((gateway) => (
              <div key={gateway.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2.5">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium">{gateway.label}</div>
                  <div className="truncate text-[11px] text-muted">{gateway.note}</div>
                </div>
                <StatusBadge value={gateway.status} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Checkout and webhook reconciliation require provider keys. Add them in Connected Apps; no payment is marked successful from a browser
            redirect.
          </p>
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold">Background scheduler</h3>
            <p className="text-[11.5px] text-muted">Resumes waiting workflow runs, sends due campaigns and advances sequence steps for this tenant.</p>
          </div>
          <Button
            size="sm"
            loading={tickBusy}
            onClick={async () => {
              setTickBusy(true)
              try {
                const result = await post<{ resumed: number; campaigns: number; sequences: number }>('/api/scheduler/tick')
                toast(`Resumed ${result.resumed} runs, sent ${result.campaigns} campaigns, advanced ${result.sequences} sequences.`, 'good')
              } catch (error: any) {
                toast(error?.message ?? 'Scheduler run failed.', 'bad')
              } finally {
                setTickBusy(false)
              }
            }}
          >
            <RefreshCw size={13} /> Run scheduler now
          </Button>
        </div>
      </Card>
      </div>
    </SettingsShell>
  )
}

/* ------------------------------------------------------------ connected apps */
type Integration = {
  id: string
  provider: string
  label: string
  category: string
  description: string
  features: string[]
  auth: 'oauth' | 'apikey' | 'unavailable'
  keyHint: string | null
  docs: string
  color: string
  mono: string
  featured: boolean
  connectable: boolean
  status: string
  mode: string
  account: string | null
  last_sync: string | null
  note: string | null
  credential_stored: boolean
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'Connected',
  not_connected: 'Available',
  error: 'Needs attention',
}

export function ConnectedAppsPage() {
  const { toast, meta } = useApp()
  const { data, loading, error, reload } = useFetch<{ integrations: Integration[]; categories: string[] }>('/api/integrations')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [filter, setFilter] = useState<'all' | 'connected' | 'available'>('all')
  const [detail, setDetail] = useState<Integration | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [from, setFrom] = useState('')
  const [busy, setBusy] = useState(false)
  const [logs, setLogs] = useState<Row[] | null>(null)
  const canManage = Boolean(meta?.permissions.canManageSettings)
  const [notice, setNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const failure = params.get('connect_error')
    const detail = params.get('detail')
    const vars = params.get('vars')
    if (connected) return { tone: 'good' as const, text: `${connected === 'gmail' ? 'Gmail' : connected} connected. Open Email accounts to run the first synchronisation.` }
    if (!failure) return null
    const messages: Record<string, string> = {
      not_configured: `This deployment has no OAuth client for that provider. Add ${vars || 'the client credentials'} as Worker secrets, then reconnect.`,
      denied: 'Sign-in was cancelled or permission was not granted. Nothing was connected.',
      state: 'The OAuth state check failed (expired or tampered link). Start again from this page.',
      exchange: 'The provider rejected the authorization code. Check the client secret and redirect URI.',
      no_oauth: 'This provider does not use OAuth.',
      unknown_provider: 'The provider is not registered for this workspace.',
      provider: 'The provider returned an error instead of an authorization code.',
    }
    return { tone: 'bad' as const, text: `${messages[failure] ?? 'The connection did not complete.'}${detail ? ` (${detail})` : ''}` }
  })

  if (loading) return <Spinner label="Loading marketplace" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Unavailable'} onRetry={reload} />

  const items = data.integrations
  const connected = items.filter((item) => item.status === 'connected')
  const term = query.trim().toLowerCase()
  const visible = items.filter((item) => {
    if (category !== 'All' && item.category !== category) return false
    if (filter === 'connected' && item.status !== 'connected') return false
    if (filter === 'available' && item.status === 'connected') return false
    if (!term) return true
    return [item.label, item.category, item.description, ...(item.features ?? [])].join(' ').toLowerCase().includes(term)
  })
  const featured = items.filter((item) => item.featured && item.status !== 'connected').slice(0, 3)

  const openDetail = (item: Integration) => {
    setDetail(item)
    setApiKey('')
    setFrom('')
    setLogs(null)
    get<{ logs: Row[] }>(`/api/integrations/${item.provider}/logs`)
      .then((result) => setLogs(result.logs))
      .catch(() => setLogs([]))
  }

  const refreshDetail = (provider: string) => {
    const next = items.find((item) => item.provider === provider) ?? null
    if (next) setDetail(next)
  }

  const connect = async () => {
    if (!detail) return
    setBusy(true)
    try {
      const result = await post<{ account?: string }>(`/api/integrations/${detail.provider}`, {
        action: 'connect',
        apiKey,
        config: detail.provider === 'twilio' && from.trim() ? { from: from.trim() } : {},
      })
      toast(`${detail.label} connected${result.account ? ` · ${result.account}` : ''}.`, 'good')
      setApiKey('')
      reload()
      refreshDetail(detail.provider)
    } catch (err: any) {
      toast(err?.message ?? 'The provider rejected those credentials.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const test = async (provider: string) => {
    setBusy(true)
    try {
      const result = await post<{ account?: string }>(`/api/integrations/${provider}/test`, {})
      toast(`Connection verified${result.account ? ` · ${result.account}` : ''}.`, 'good')
      reload()
      refreshDetail(provider)
    } catch (err: any) {
      toast(err?.message ?? 'The connection test failed.', 'bad')
      reload()
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (provider: string) => {
    if (!window.confirm('Disconnect this app? The stored credential is deleted and connected automations stop using it.')) return
    setBusy(true)
    try {
      await post(`/api/integrations/${provider}`, { action: 'disconnect' })
      toast('Disconnected.', 'good')
      reload()
      if (detail?.provider === provider) setDetail(null)
    } catch (err: any) {
      toast(err?.message ?? 'Could not disconnect.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const buttonFor = (item: Integration) => {
    if (item.status === 'connected') {
      return (
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => void test(item.provider)} disabled={busy || !canManage}>
            Test
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void disconnect(item.provider)} disabled={busy || !canManage}>
            Disconnect
          </Button>
        </div>
      )
    }
    if (item.auth === 'oauth') {
      return (
        <Button size="sm" variant="primary" disabled={!canManage} onClick={() => window.location.assign(`/api/integrations/${item.provider}/connect`)}>
          Connect
        </Button>
      )
    }
    if (item.auth === 'apikey') {
      return (
        <Button size="sm" variant="primary" disabled={!canManage} onClick={() => openDetail(item)}>
          Add key
        </Button>
      )
    }
    return (
      <Button size="sm" disabled title={item.docs}>
        Not available
      </Button>
    )
  }

  return (
    <SettingsShell>
      <div className="flex h-full min-h-0 flex-col">
        <PageHeader title="Integration marketplace" subtitle="Connect the services this workspace actually uses. A connection is only marked live after the provider accepts the credential.">
          <Badge tone={connected.length ? 'good' : 'default'}>{connected.length} connected</Badge>
          <Button size="sm" onClick={() => reload()}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </PageHeader>

      {notice ? (
        <div className={`mx-4 mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12px] ${notice.tone === 'bad' ? 'border-danger/25 bg-danger-soft text-danger' : 'border-good/25 bg-good-soft text-good'}`}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">{notice.text}</div>
          <button className="text-[11px] font-semibold underline opacity-70" onClick={() => { setNotice(null); window.history.replaceState({}, '', '/settings/apps') }}>Dismiss</button>
        </div>
      ) : null}

      <div className="border-b border-line bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Plug size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className="gx-input gx-input-icon"
              placeholder="Search providers, categories or features…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
            {(['all', 'connected', 'available'] as const).map((value) => (
              <button
                key={value}
                className={cx('rounded-md px-2.5 py-1 text-[11.5px] font-medium capitalize', filter === value ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted')}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {data.categories.map((item) => (
            <button
              key={item}
              className={cx('gx-badge', category === item && 'gx-badge-accent')}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto gx-scroll p-5">
        {featured.length ? (
          <div className="mb-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Featured</h2>
            <div className="grid gap-3 lg:grid-cols-3">
              {featured.map((item) => (
                <button
                  key={item.provider}
                  className="gx-card group relative overflow-hidden p-3.5 text-left transition hover:border-accent"
                  onClick={() => openDetail(item)}
                >
                  <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: item.color }} />
                  <div className="flex items-start gap-2.5">
                    <Monogram item={item} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{item.label}</div>
                      <div className="text-[11px] text-faint">{item.category}</div>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-muted">{item.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            {filter === 'connected' ? 'Connected apps' : filter === 'available' ? 'Available apps' : 'All integrations'}
          </h2>
          <span className="text-[11px] text-faint">{visible.length} providers</span>
        </div>

        {visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Plug size={18} />}
              title="No integrations match"
              description="Try another category or clear the search to see every supported provider."
              action={
                <Button size="sm" onClick={() => { setQuery(''); setCategory('All'); setFilter('all') }}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <Card key={item.provider} className="flex flex-col p-3.5">
                <div className="flex items-start gap-2.5">
                  <Monogram item={item} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-[13px] font-semibold">{item.label}</h3>
                      {item.status === 'connected' ? <Check size={13} className="shrink-0 text-good" /> : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-faint">
                      <span>{item.category}</span>
                      <span className={cx('size-1 rounded-full', item.status === 'connected' ? 'bg-good' : item.status === 'error' ? 'bg-danger' : 'bg-line-strong')} />
                      <span className={item.status === 'error' ? 'text-danger' : ''}>{STATUS_LABEL[item.status] ?? item.status}</span>
                    </div>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 min-h-[32px] text-[11.5px] leading-snug text-muted">{item.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.features ?? []).slice(0, 3).map((feature) => (
                    <span key={feature} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">
                      {feature}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <button className="text-[11px] text-muted hover:text-accent" onClick={() => openDetail(item)}>
                    Learn more
                  </button>
                  {buttonFor(item)}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-good" />
          <p>
            Credentials are verified against the provider before saving, stored server-side only, and never returned to the browser. Providers
            marked <span className="font-medium text-ink">Not available</span> need several credentials or partner approval that this build does not
            implement — they are listed honestly rather than faked.
          </p>
        </div>
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.label} · ${detail.category}` : 'Integration'}
        wide
        footer={
          detail ? (
            <>
              <Button size="sm" onClick={() => setDetail(null)}>Close</Button>
              {detail.status === 'connected' ? (
                <>
                  <Button size="sm" onClick={() => void test(detail.provider)} loading={busy} disabled={!canManage}>
                    Test connection
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void disconnect(detail.provider)} disabled={busy || !canManage}>
                    Disconnect
                  </Button>
                </>
              ) : detail.auth === 'apikey' ? (
                <Button size="sm" variant="primary" loading={busy} disabled={apiKey.trim().length < 8 || !canManage} onClick={() => void connect()}>
                  Verify and connect
                </Button>
              ) : detail.auth === 'oauth' ? (
                <Button size="sm" variant="primary" disabled={!canManage} onClick={() => window.location.assign(`/api/integrations/${detail.provider}/connect`)}>
                  Connect with OAuth
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Monogram item={detail} size={44} />
              <div className="min-w-0">
                <p className="text-[13px] leading-relaxed text-muted">{detail.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={detail.status === 'connected' ? 'good' : detail.status === 'error' ? 'danger' : 'default'}>
                    {STATUS_LABEL[detail.status] ?? detail.status}
                  </Badge>
                  <Badge tone="info">{detail.auth === 'oauth' ? 'OAuth' : detail.auth === 'apikey' ? 'API key' : 'Multi-field setup'}</Badge>
                  {detail.account ? <Badge>{detail.account}</Badge> : null}
                  {detail.last_sync ? <span className="text-[10.5px] text-faint">verified {formatDateTime(detail.last_sync)}</span> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-3">
                <h4 className="mb-1.5 text-[12px] font-semibold">What it enables</h4>
                <ul className="space-y-1 text-[11.5px] text-muted">
                  {(detail.features ?? []).map((feature) => (
                    <li key={feature} className="flex items-center gap-1.5">
                      <Check size={11} className="text-good" /> {feature}
                    </li>
                  ))}
                  {(detail.features ?? []).length === 0 ? <li>No capabilities are wired for this provider yet.</li> : null}
                </ul>
              </Card>
              <Card className="p-3">
                <h4 className="mb-1.5 text-[12px] font-semibold">Setup</h4>
                <p className="text-[11.5px] leading-relaxed text-muted">{detail.docs}</p>
                {detail.keyHint ? (
                  <p className="mt-1.5 text-[11px] text-faint">
                    Credential format: <code className="rounded bg-surface-2 px-1">{detail.keyHint}</code>
                  </p>
                ) : null}
              </Card>
            </div>

            {detail.status !== 'connected' && detail.auth === 'apikey' ? (
              <div className="space-y-2.5 rounded-lg border border-line bg-surface-2 p-3">
                <FormRow label="Credential">
                  <input
                    className="gx-input font-mono"
                    type="password"
                    autoComplete="off"
                    placeholder={detail.keyHint ?? 'Paste the API key'}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </FormRow>
                {detail.provider === 'twilio' ? (
                  <FormRow label="Sending number" hint="E.164, verified in Twilio">
                    <input className="gx-input font-mono" placeholder="+14155550100" value={from} onChange={(event) => setFrom(event.target.value)} />
                  </FormRow>
                ) : null}
                <p className="text-[11px] text-faint">Nothing is saved unless the provider accepts the credential.</p>
              </div>
            ) : null}

            <div>
              <h4 className="mb-1.5 text-[12px] font-semibold">Connection activity</h4>
              {logs === null ? (
                <p className="text-[11.5px] text-muted">Loading…</p>
              ) : logs.length === 0 ? (
                <p className="text-[11.5px] text-muted">No connection events recorded for this provider yet.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {logs.map((log) => (
                    <li key={String(log.id)} className="flex items-start gap-2 px-2.5 py-1.5">
                      <AlertTriangle size={11} className={cx('mt-0.5 shrink-0', log.type === 'integration.test_failed' ? 'text-danger' : 'text-faint')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px]">{String(log.summary)}</span>
                        <span className="block text-[10.5px] text-faint">
                          {String(log.actor ?? 'System')} · {formatDateTime(log.created_at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
    </SettingsShell>
  )
}

function Monogram({ item, size = 32 }: { item: { label: string; color: string; mono: string }; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.33,
        background: `${item.color}14`,
        color: item.color,
        border: `1px solid ${item.color}33`,
      }}
      aria-hidden="true"
    >
      {item.mono}
    </span>
  )
}

/* ------------------------------------------------------- integration detail */
const PROVIDER_META: Record<string, { name: string; description: string; category: string; scopes: string[]; setup: string[] }> = {
  gmail: {
    name: 'Gmail',
    description: 'Send and receive email from your CRM. Emails sent through campaigns are tracked and attributed to contacts.',
    category: 'Communication',
    scopes: ['gmail.send', 'gmail.readonly'],
    setup: [
      'Enable the Gmail API in Google Cloud Console.',
      'Create an OAuth 2.0 client ID (Web application).',
      'Add the redirect URI: https://<your-host>/api/integrations/gmail/callback',
      'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Worker secrets.',
    ],
  },
  microsoft365: {
    name: 'Microsoft 365',
    description: 'Connect Outlook for email sending and calendar synchronization.',
    category: 'Communication',
    scopes: ['Mail.Send', 'Calendars.ReadWrite'],
    setup: [
      'Register an application in Azure AD.',
      'Add the redirect URI: https://<your-host>/api/integrations/microsoft365/callback',
      'Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET as Worker secrets.',
    ],
  },
  google_calendar: {
    name: 'Google Calendar',
    description: 'Sync meetings and events between Google Calendar and the CRM.',
    category: 'Communication',
    scopes: ['calendar.events'],
    setup: ['Enable the Google Calendar API.', 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Worker secrets.'],
  },
  whatsapp: {
    name: 'WhatsApp Business',
    description: 'Send WhatsApp messages and manage conversations from the CRM.',
    category: 'Communication',
    scopes: ['whatsapp_business_messaging'],
    setup: ['Create a WhatsApp Business account in Meta Business Manager.', 'Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID as Worker secrets.'],
  },
  slack: {
    name: 'Slack',
    description: 'Receive CRM notifications in Slack channels.',
    category: 'Productivity',
    scopes: ['chat:write', 'channels:read'],
    setup: ['Create a Slack app.', 'Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET as Worker secrets.'],
  },
  openai: {
    name: 'OpenAI',
    description: 'Routes the CRM assistant to an OpenAI model. Without a key the assistant answers from your CRM data using server-side queries only.',
    category: 'AI',
    scopes: [],
    setup: [
      'Create an API key in the OpenAI dashboard.',
      'Store it as the OPENAI_API_KEY Worker secret — never in the browser bundle.',
      'Connect the provider here to switch the assistant from rules-based mode to the model.',
    ],
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Routes the CRM assistant to a Claude model. The key stays in the Worker secret store.',
    category: 'AI',
    scopes: [],
    setup: [
      'Create an API key in the Anthropic console.',
      'Store it as the ANTHROPIC_API_KEY Worker secret.',
      'Connect the provider here to activate model-backed answers.',
    ],
  },
  webhooks: {
    name: 'Webhooks',
    description: 'Send and receive webhook events for custom integrations.',
    category: 'Automation',
    scopes: [],
    setup: ['Configure webhook URLs in your external system.', 'Set WEBHOOK_SECRET as a Worker secret for signature verification.'],
  },
}

export { EmailAccountsPage } from './email-accounts'

export function IntegrationDetailPage({ provider }: { provider: string }) {
  const { toast, meta } = useApp()
  const { data, loading, error, reload } = useFetch<{ org: Row; integrations: Row[] }>('/api/org')
  const canManage = Boolean(meta?.permissions.canManageSettings)
  const integration = data?.integrations.find((row) => row.provider === provider)
  const pm = PROVIDER_META[provider] ?? { name: titleCase(provider), description: 'Integration provider.', category: 'Other', scopes: [], setup: [] }
  const isOAuth = ['gmail', 'microsoft365'].includes(provider)

  if (loading) return <Spinner label="Loading integration" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Unavailable'} onRetry={reload} />
  if (!integration) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="text-[46px] font-semibold text-faint">404</div>
        <h1 className="mt-1 text-[17px] font-semibold">Integration not found</h1>
        <p className="mt-1 max-w-sm text-[12.5px] text-muted">The integration "{provider}" is not registered for this workspace. Check the provider name or contact your administrator.</p>
        <Button size="sm" variant="primary" className="mt-4" onClick={() => window.location.assign('/settings/apps')}>Back to Connected Apps</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={pm.name} subtitle={pm.description}>
        <Button size="sm" onClick={() => window.location.assign('/settings/apps')}>Back to all apps</Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Status card */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold">Connection status</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge value={integration.status} />
                    {integration.mode === 'sandbox' ? <Badge tone="warn">sandbox</Badge> : null}
                    {integration.account ? <span className="text-[11.5px] text-muted">{integration.account}</span> : null}
                  </div>
                </div>
                <Plug size={24} className="text-faint" />
              </div>
              {integration.last_sync ? (
                <p className="mt-2 text-[11.5px] text-muted">Last synchronized: {formatDateTime(integration.last_sync)}</p>
              ) : (
                <p className="mt-2 text-[11.5px] text-muted">Never synchronized.</p>
              )}
              {integration.note ? <p className="mt-2 text-[11.5px] text-muted">{integration.note}</p> : null}
            </Card>

            {/* Permissions */}
            {pm.scopes.length > 0 ? (
              <Card className="p-4">
                <h3 className="mb-2 text-[13px] font-semibold">Required permissions</h3>
                <div className="flex flex-wrap gap-1.5">
                  {pm.scopes.map((scope) => (
                    <span key={scope} className="gx-badge">{scope}</span>
                  ))}
                </div>
              </Card>
            ) : null}

            {/* Setup instructions */}
            {integration.status !== 'connected' ? (
              <Card className="p-4">
                <h3 className="mb-2 text-[13px] font-semibold">Setup instructions</h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-[12px] text-muted">
                  {pm.setup.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </Card>
            ) : null}

            {/* Actions */}
            <Card className="p-4">
              <h3 className="mb-3 text-[13px] font-semibold">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {integration.status === 'connected' ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await post(`/api/integrations/${provider}`, { action: 'disconnect' })
                        toast(`${pm.name} disconnected.`, 'good')
                        reload()
                      } catch (err: any) {
                        toast(err?.message ?? 'Could not disconnect.', 'bad')
                      }
                    }}
                    disabled={!canManage}
                  >
                    Disconnect
                  </Button>
                ) : isOAuth ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!canManage}
                    onClick={() => window.location.assign(`/api/integrations/${provider}/connect`)}
                  >
                    Connect with OAuth
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!canManage}
                    onClick={async () => {
                      try {
                        const result = await post<{ status: string; mode?: string }>(`/api/integrations/${provider}`, { action: 'connect' })
                        toast(result.mode === 'sandbox' ? 'Sandbox adapter connected.' : 'Connected.', 'good')
                        reload()
                      } catch (err: any) {
                        toast(err?.message ?? 'Connection failed.', 'bad')
                      }
                    }}
                  >
                    Connect
                  </Button>
                )}
                <Button size="sm" onClick={() => window.location.assign('/settings/apps')}>Back to all apps</Button>
              </div>
              {!canManage ? <p className="mt-2 text-[11px] text-warn">Your role can view but not change connections.</p> : null}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="mb-2 text-[13px] font-semibold">Provider info</h3>
              <dl className="space-y-2 text-[12px]">
                <div className="flex justify-between"><dt className="text-muted">Name</dt><dd className="font-medium">{pm.name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Category</dt><dd>{pm.category}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Provider ID</dt><dd className="font-mono text-[10.5px]">{provider}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Auth type</dt><dd>{isOAuth ? 'OAuth 2.0' : 'API key / manual'}</dd></div>
              </dl>
            </Card>
            <Card className="p-4">
              <h3 className="mb-2 text-[13px] font-semibold">Health</h3>
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${integration.status === 'connected' ? 'bg-good' : integration.status === 'error' ? 'bg-danger' : 'bg-faint'}`} />
                <span className="text-[12px]">{integration.status === 'connected' ? 'Healthy' : integration.status === 'error' ? 'Error' : 'Not connected'}</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- audit */
export function AuditLogPage() {
  const { meta } = useApp()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>('/api/audit')
  const [q, setQ] = useState('')

  if (!meta?.permissions.canReadAudit) {
    return (
      <div className="p-5">
        <PageHeader title="Audit log" subtitle="Append-only record of privileged actions" />
        <Card className="mt-4 p-6 text-center">
          <ShieldCheck size={22} className="mx-auto text-faint" />
          <h2 className="mt-2 text-[14px] font-semibold">Your role cannot read the audit log</h2>
          <p className="mt-1 text-[12.5px] text-muted">Ask an owner, administrator or manager for access. The check is enforced on the server, not just hidden here.</p>
        </Card>
      </div>
    )
  }

  const rows = (data?.data ?? []).filter((row) => (q ? `${row.action} ${row.entity_type} ${row.actor ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true))

  return (
    <SettingsShell>
      <div className="flex h-full min-h-0 flex-col">
        <PageHeader title="Audit log" subtitle={`${rows.length} entries · immutable, tenant-scoped`}>
          <input className="gx-input w-56" placeholder="Filter actions…" value={q} onChange={(event) => setQ(event.target.value)} />
        </PageHeader>
        <div className="min-h-0 flex-1 overflow-auto gx-scroll">
          {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : (
            <table className="gx-table">
              <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Actor</th><th>Before</th><th>After</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-[11.5px] text-muted">{formatDateTime(row.created_at)}</td>
                    <td><Badge tone="info">{row.action}</Badge></td>
                    <td className="text-[11.5px]">{row.entity_type}</td>
                    <td className="text-[11.5px]">{row.actor ?? 'system'}</td>
                    <td className="max-w-[220px] truncate font-mono text-[10.5px] text-muted">{row.before_json ?? '—'}</td>
                    <td className="max-w-[260px] truncate font-mono text-[10.5px] text-muted">{row.after_json ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SettingsShell>
  )
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{value}</span>
      <button
        className="text-muted hover:text-accent"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }}
        aria-label={label}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

export function SettingsHint({ children }: { children: React.ReactNode }) {
  return <p className={cx('text-[11px] text-muted')}>{children}</p>
}

/* ---------------------------------------------------------------- Settings Shell */
export const SETTINGS_NAV = [
  {
    group: 'Organization & Team',
    items: [
      { label: 'Account & Workspace', path: '/settings/account', icon: Shield },
      { label: 'Profile & Password', path: '/settings/profile', icon: User },
      { label: 'Roles & Permissions', path: '/settings/roles', icon: KeyRound },
    ],
  },
  {
    group: 'Personalization',
    items: [
      { label: 'Theme Gallery', path: '/settings/themes', icon: Palette },
      { label: 'Language & Region', path: '/settings/language', icon: Globe },
    ],
  },
  {
    group: 'Sales & Communications',
    items: [
      { label: 'Financial & Currencies', path: '/settings/financial', icon: Wallet },
      { label: 'Connected Apps', path: '/settings/apps', icon: Plug },
    ],
  },
  {
    group: 'Security & Audit',
    items: [
      { label: 'Audit Trail Logs', path: '/settings/audit', icon: ShieldCheck },
    ],
  },
]

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const path = usePath()
  const { me } = useApp()
  const [navSearch, setNavSearch] = useState('')

  const isProfileMode = path.startsWith('/settings/profile')

  const topTabs = [
    { label: 'Profile Settings', path: '/settings/profile', active: path.startsWith('/settings/profile') },
    { label: 'Account Settings', path: '/settings/account', active: path === '/settings/account' || path === '/settings/users' || path === '/settings/roles' },
    { label: 'Website Settings', path: '/settings/apps', active: path.startsWith('/settings/apps') },
    { label: 'App Settings', path: '/settings/themes', active: path === '/settings/themes' || path === '/settings/language' },
    { label: 'Financial Settings', path: '/settings/financial', active: path.startsWith('/settings/financial') },
    { label: 'Other Settings', path: '/settings/audit', active: path.startsWith('/settings/audit') },
  ]

  const accountNavItems = [
    { label: 'Users', path: '/settings/account' },
    { label: 'Hierarchy', path: '/settings/account' },
    { label: 'Teams', path: '/settings/account' },
    { label: 'Roles & Permissions', path: '/settings/roles' },
    { label: 'Contact Privacy', path: '/settings/account' },
    { label: 'Single Sign On', path: '/settings/account' },
    { label: 'Integrations', path: '/settings/apps' },
    { label: 'Email Contact Discovery', path: '/settings/account' },
    { label: 'Marketplace', path: '/settings/account' },
    { label: 'API & Tracking', path: '/settings/account' },
    { label: 'Site Messages', path: '/settings/account' },
    { label: 'Webhooks', path: '/settings/account' },
    { label: 'Notification defaults', path: '/settings/account' },
  ]

  const profileNavItems = [
    { label: 'Profile Settings', path: '/settings/profile' },
    { label: 'Security', path: '/settings/profile' },
    { label: 'Abuse Center', path: '/settings/profile' },
    { label: 'Notifications', path: '/settings/profile' },
    { label: 'Connected Apps', path: '/settings/apps' },
    { label: 'Sync', path: '/settings/profile' },
    { label: 'Email Accounts', path: '/general-settings/email-accounts' },
    { label: 'Voicemails', path: '/settings/profile' },
  ]

  const navItems = isProfileMode ? profileNavItems : accountNavItems

  const filteredNav = useMemo(() => {
    if (!navSearch.trim()) return navItems
    return navItems.filter((i) => i.label.toLowerCase().includes(navSearch.toLowerCase()))
  }, [navItems, navSearch])

  const userName = me?.name || 'vishnu m'
  const userEmail = me?.email || 'vishnu.m0827@gmail.com'
  const userRole = me?.role === 'owner' ? 'Admin' : (me?.role ? titleCase(me.role) : 'Admin')
  const userInitial = initials(userName) || 'V'

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* Top Profile Banner Card - Matching Screenshot 6 & 7 */}
      <div className="border-b border-line bg-surface px-5 pt-4 pb-0 shadow-xs">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="size-11 rounded-full bg-[#FF5900] text-white flex items-center justify-center font-bold text-base shadow-xs">
            {userInitial}
          </div>
          <div>
            <div className="text-[15px] font-bold text-ink">{userName}</div>
            <div className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5">
              <span>{userEmail}</span>
              <span>·</span>
              <span className="font-semibold text-ink">{userRole}</span>
            </div>
          </div>
        </div>

        {/* Top Horizontal Tabs with Orange Active Indicator */}
        <div className="flex items-center gap-6 overflow-x-auto gx-scroll text-[13px]">
          {topTabs.map((tab) => (
            <Link
              key={tab.label}
              to={tab.path}
              className={cx(
                'relative pb-3 font-medium transition whitespace-nowrap',
                tab.active
                  ? 'text-[#FF5900] font-semibold'
                  : 'text-muted hover:text-ink'
              )}
            >
              <span>{tab.label}</span>
              {tab.active ? (
                <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#FF5900] rounded-t-sm" />
              ) : null}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left Sub-navigation Sidebar */}
        <aside className="w-full shrink-0 border-b border-line bg-surface lg:w-60 lg:border-b-0 lg:border-r">
          <div className="p-3">
            <div className="relative mb-2">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Filter settings..."
                className="gx-input gx-input-icon text-[11.5px] py-1 h-8"
              />
            </div>
            <nav className="space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto gx-scroll">
              {filteredNav.map((item, idx) => {
                const active = idx === 0 || path === item.path
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={cx(
                      'block rounded-lg px-3 py-2 text-[12.5px] transition',
                      active
                        ? 'bg-orange-50 text-[#FF5900] font-semibold'
                        : 'text-muted hover:bg-surface-2 hover:text-ink font-medium'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Right Main Content */}
        <div className="min-h-0 flex-1 overflow-auto gx-scroll">
          {children}
        </div>
      </div>
    </div>
  )
}


export function ThemeGalleryPage() {
  const { themeConfig, updateThemeConfig, toast } = useApp()

  const currentTheme = THEME_PRESETS.find((p) => p.id === themeConfig.themeId) ?? THEME_PRESETS[0]

  const applyPreset = (themeId: ThemeId) => {
    const preset = THEME_PRESETS.find((p) => p.id === themeId)
    const nextMode = preset?.darkDefault ? 'dark' : themeConfig.mode
    updateThemeConfig({ themeId, mode: nextMode })
    toast(`Applied "${preset?.name}" theme globally.`, 'good')
  }

  return (
    <SettingsShell>
      <div className="p-5 sm:p-7 space-y-6">
        <PageHeader
          title="Themes & Appearance"
          subtitle="Customize color systems, density, borders, and typography across all CRM workspaces"
        >
          <Button
            size="sm"
            onClick={() => {
              updateThemeConfig(DEFAULT_THEME_CONFIG)
              toast('Reset to GoFox Signature defaults.', 'info')
            }}
          >
            Reset Defaults
          </Button>
        </PageHeader>

        {/* 9 Selectable Themes Grid */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-ink">Selectable Enterprise Themes</h3>
              <p className="text-[12px] text-muted">Click any theme card to preview and apply instantaneously.</p>
            </div>
            <Badge tone="accent">Active: {currentTheme.name}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {THEME_PRESETS.map((preset) => {
              const isSelected = themeConfig.themeId === preset.id
              return (
                <div
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={cx(
                    'group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-surface',
                    isSelected
                      ? 'border-accent ring-2 ring-accent/20 shadow-sm'
                      : 'border-line hover:border-accent/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13.5px] font-bold text-ink group-hover:text-accent transition">
                        {preset.name}
                      </span>
                      <div className="text-[11px] text-muted">{preset.subtitle}</div>
                    </div>
                    {isSelected ? (
                      <span className="flex size-5 items-center justify-center rounded-full bg-accent text-white">
                        <Check size={12} />
                      </span>
                    ) : (
                      <span
                        className="size-4 rounded-full border border-line"
                        style={{ background: preset.accentColor }}
                      />
                    )}
                  </div>

                  <p className="mt-2 text-[11.5px] leading-relaxed text-muted line-clamp-2">
                    {preset.description}
                  </p>

                  {/* Palette Swatches */}
                  <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-line/60">
                    <span className="text-[10px] text-faint uppercase font-bold tracking-wider mr-1">Palette</span>
                    {preset.palette.map((color, idx) => (
                      <span
                        key={idx}
                        className="size-4 rounded-md border border-black/10 shadow-2xs"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11.5px] pt-1">
                    <span className="font-semibold text-accent">
                      {isSelected ? '✓ Currently Applied' : 'Click to Apply →'}
                    </span>
                    {preset.darkDefault ? (
                      <span className="text-[10px] text-muted font-mono bg-surface-2 px-1.5 py-0.5 rounded">Dark Native</span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Global Design System Customizer Controls */}
        <div className="border-t border-line pt-6">
          <h3 className="text-[14px] font-bold text-ink mb-1">Global Workspace Customization</h3>
          <p className="text-[12px] text-muted mb-4">Fine-tune display mode, density, corner radii, and sidebar aesthetics.</p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* Color Mode */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 font-semibold text-[13px] text-ink">
                <Sun size={15} className="text-accent" />
                <span>Display Color Mode</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-surface-2 p-1">
                {(['light', 'dark', 'system'] as ColorMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => updateThemeConfig({ mode: m })}
                    className={cx(
                      'rounded-md py-1.5 text-[11.5px] font-semibold capitalize transition',
                      themeConfig.mode === m
                        ? 'bg-surface text-ink shadow-xs'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Card>

            {/* Density */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 font-semibold text-[13px] text-ink">
                <Sliders size={15} className="text-accent" />
                <span>UI Information Density</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-surface-2 p-1">
                {(['compact', 'comfortable', 'spacious'] as Density[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => updateThemeConfig({ density: d })}
                    className={cx(
                      'rounded-md py-1.5 text-[11.5px] font-semibold capitalize transition',
                      themeConfig.density === d
                        ? 'bg-surface text-ink shadow-xs'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Card>

            {/* Corner Radius */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 font-semibold text-[13px] text-ink">
                <LayoutGrid size={15} className="text-accent" />
                <span>Card & Control Radius</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-line bg-surface-2 p-1">
                {(
                  [
                    ['sm', '6px'],
                    ['md', '10px'],
                    ['lg', '14px'],
                    ['xl', '20px'],
                  ] as [Radius, string][]
                ).map(([r, label]) => (
                  <button
                    key={r}
                    onClick={() => updateThemeConfig({ radius: r })}
                    className={cx(
                      'rounded-md py-1.5 text-[11px] font-semibold transition',
                      themeConfig.radius === r
                        ? 'bg-surface text-ink shadow-xs'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Font Family */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 font-semibold text-[13px] text-ink">
                <Layers size={15} className="text-accent" />
                <span>Typography Font</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-surface-2 p-1">
                {(
                  [
                    ['jakarta', 'Jakarta Sans'],
                    ['inter', 'Inter'],
                    ['roboto', 'Roboto'],
                    ['system', 'System Native'],
                  ] as [FontFamily, string][]
                ).map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => updateThemeConfig({ font: f })}
                    className={cx(
                      'rounded-md py-1 text-[11.5px] font-semibold transition truncate',
                      themeConfig.font === f
                        ? 'bg-surface text-ink shadow-xs'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Sidebar Style */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 font-semibold text-[13px] text-ink">
                <Palette size={15} className="text-accent" />
                <span>Sidebar Appearance</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-surface-2 p-1">
                {(
                  [
                    ['light', 'Light'],
                    ['navy', 'Deep Navy'],
                    ['dark', 'Dark'],
                  ] as [SidebarStyle, string][]
                ).map(([s, label]) => (
                  <button
                    key={s}
                    onClick={() => updateThemeConfig({ sidebar: s })}
                    className={cx(
                      'rounded-md py-1.5 text-[11.5px] font-semibold transition truncate',
                      themeConfig.sidebar === s
                        ? 'bg-surface text-ink shadow-xs'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </SettingsShell>
  )
}

/* ---------------------------------------------------------------- Language Settings Page */
export function LanguageSettingsPage() {
  const { locale, updateLocale, toast } = useApp()

  const setLang = (code: LocaleCode, name: string) => {
    updateLocale(code)
    toast(`Language changed to ${name}. Application text updated.`, 'good')
  }

  const activeLang = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0]

  return (
    <SettingsShell>
      <div className="p-5 sm:p-7 space-y-6">
        <PageHeader
          title="Language & Regional Localization"
          subtitle="Choose your workspace language, text direction, and regional number formatting"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LANGUAGES.map((lang) => {
            const isSelected = locale === lang.code
            return (
              <div
                key={lang.code}
                onClick={() => setLang(lang.code, lang.name)}
                className={cx(
                  'cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm bg-surface',
                  isSelected
                    ? 'border-accent ring-2 ring-accent/20'
                    : 'border-line hover:border-accent/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[24px]">{lang.flag}</span>
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">{lang.name}</div>
                      <div className="text-[12px] text-muted font-medium">{lang.nativeName}</div>
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-accent text-white">
                      <Check size={12} />
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-line text-[11px] text-muted">
                  <span>Direction: {lang.dir.toUpperCase()}</span>
                  <span className="font-semibold text-accent">{isSelected ? 'Active' : 'Select'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Locale preview strip */}
        <Card className="p-4">
          <CardHeader
            title={`Regional Format Preview (${activeLang.name})`}
            subtitle="How numbers, currencies, dates, and text direction format for this locale"
          />
          <div className="grid gap-3 sm:grid-cols-3 mt-3">
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="text-[11px] font-bold uppercase text-muted">Date Formatting</div>
              <div className="text-[14px] font-semibold text-ink mt-0.5">18 Nov 2026, 23:15</div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="text-[11px] font-bold uppercase text-muted">Currency Example</div>
              <div className="text-[14px] font-semibold text-ink mt-0.5">$ 1,25,000.00 / ₹ 1,25,000</div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="text-[11px] font-bold uppercase text-muted">Text Direction</div>
              <div className="text-[14px] font-semibold text-ink mt-0.5">
                {activeLang.dir === 'rtl' ? 'Right-to-Left (RTL)' : 'Left-to-Right (LTR)'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </SettingsShell>
  )
}

/* ---------------------------------------------------------------- Roles & Permissions Page */
const DEFAULT_ROLES = [
  { id: 'super_admin', name: 'Super Admin', description: 'Unrestricted organizational access, billing, and system policies.' },
  { id: 'admin', name: 'Administrator', description: 'Can manage users, configure integrations, and edit all CRM records.' },
  { id: 'sales_manager', name: 'Sales Manager', description: 'Supervises sales pipelines, reassigns deals, and approves proposals.' },
  { id: 'sales_rep', name: 'Sales Representative', description: 'Owns assigned leads, creates deals, logs calls and activities.' },
  { id: 'marketing_manager', name: 'Marketing Manager', description: 'Orchestrates campaigns, visual workflows, forms, and audience lists.' },
  { id: 'marketing_exec', name: 'Marketing Executive', description: 'Authors email templates, drafts campaigns, and inspects web analytics.' },
  { id: 'support_manager', name: 'Support Manager', description: 'Manages ticket SLAs, assigns queues, and reviews customer CSAT.' },
  { id: 'support_agent', name: 'Support Agent', description: 'Resolves assigned customer support tickets and manages KB articles.' },
  { id: 'finance_manager', name: 'Finance Manager', description: 'Generates quotes, issues tax invoices, and tracks payment gateways.' },
  { id: 'read_only', name: 'Read Only Auditor', description: 'Inspection permissions only. Prohibited from mutating any records.' },
]

const PERMISSION_MODULES = [
  'Companies',
  'Contacts',
  'Leads',
  'Deals',
  'Tasks',
  'Campaigns',
  'Workflows & Automations',
  'Quotes & Invoices',
  'Support Tickets',
  'Reports & BI',
  'Settings & API',
]

const PERMISSION_ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Import', 'Export', 'Share', 'Approve', 'Manage']

export function RolesPermissionsPage() {
  const { toast } = useApp()
  const [selectedRoleId, setSelectedRoleId] = useState('sales_rep')
  const [testRole, setTestRole] = useState<string | null>(null)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  const activeRole = DEFAULT_ROLES.find((r) => r.id === selectedRoleId) ?? DEFAULT_ROLES[0]

  return (
    <SettingsShell>
      <div className="p-5 sm:p-7 space-y-6">
        <PageHeader
          title="Enterprise Roles & Permissions"
          subtitle="Configure granular module-level actions, field security, and access hierarchy"
        >
          <Button size="sm" variant="primary" onClick={() => setCreateRoleOpen(true)}>
            <Plus size={14} /> New Custom Role
          </Button>
        </PageHeader>

        {/* Roles Selector Strip */}
        <div className="overflow-x-auto gx-scroll pb-1">
          <div className="flex gap-2 min-w-max">
            {DEFAULT_ROLES.map((role) => {
              const isSelected = selectedRoleId === role.id
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cx(
                    'rounded-xl border px-3.5 py-2 text-left transition',
                    isSelected
                      ? 'border-accent bg-accent-soft text-accent shadow-xs'
                      : 'border-line bg-surface text-ink hover:border-line-strong',
                  )}
                >
                  <div className="text-[12.5px] font-bold">{role.name}</div>
                  <div className="text-[10.5px] text-muted line-clamp-1 max-w-[140px]">{role.description}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Role Header Card */}
        <Card className="p-4 bg-surface-2 border-line">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-ink">{activeRole.name}</span>
                <Badge tone="info">Standard Enterprise Role</Badge>
                {testRole ? <Badge tone="warn">Simulating Role: {testRole}</Badge> : null}
              </div>
              <p className="mt-1 text-[12.5px] text-muted">{activeRole.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setTestRole(activeRole.name)
                  toast(`Simulating view as "${activeRole.name}".`, 'info')
                }}
              >
                <Eye size={13} /> Test as This Role
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => toast(`Permissions for ${activeRole.name} saved.`, 'good')}
              >
                Save Matrix
              </Button>
            </div>
          </div>
        </Card>

        {/* Permission Matrix Table */}
        <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-sm">
          <div className="border-b border-line px-4 py-3 bg-surface-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-ink">Module Authorization Matrix</span>
            <span className="text-[11px] text-muted">Changes are enforced server-side per tenant session</span>
          </div>

          <div className="overflow-x-auto gx-scroll">
            <table className="gx-table">
              <thead>
                <tr>
                  <th className="min-w-[180px]">Module / Entity</th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th key={action} className="text-center min-w-[70px]">{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map((module) => {
                  const isReadOnly = selectedRoleId === 'read_only'
                  const isSuper = selectedRoleId === 'super_admin' || selectedRoleId === 'admin'

                  return (
                    <tr key={module}>
                      <td className="font-semibold text-ink text-[12.5px]">{module}</td>
                      {PERMISSION_ACTIONS.map((action, idx) => {
                        const checked = isSuper
                          ? true
                          : isReadOnly
                            ? action === 'View'
                            : idx < 4 || (idx < 6 && !['Delete', 'Manage'].includes(action))

                        return (
                          <td key={action} className="text-center">
                            <input
                              type="checkbox"
                              defaultChecked={checked}
                              disabled={isSuper}
                              className="size-4 rounded border-line text-accent focus:ring-accent"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Field-Level Security Preview */}
        <Card className="p-4">
          <CardHeader
            title="Field-Level Access Control (FLAC)"
            subtitle="Configure field visibility and mutability per sensitive attribute"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { field: 'Deal Value & Currency', level: 'Editable' },
              { field: 'Contact Direct Mobile', level: 'Editable' },
              { field: 'Lead Commission Rate', level: selectedRoleId === 'super_admin' ? 'Editable' : 'Hidden' },
              { field: 'Internal Management Notes', level: selectedRoleId === 'sales_rep' ? 'Read Only' : 'Editable' },
            ].map((f) => (
              <div key={f.field} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="text-[12px] font-bold text-ink">{f.field}</div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted">Security Tier</span>
                  <Badge tone={f.level === 'Hidden' ? 'danger' : f.level === 'Editable' ? 'good' : 'warn'}>
                    {f.level}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Create Role Modal */}
        <Modal
          open={createRoleOpen}
          onClose={() => setCreateRoleOpen(false)}
          title="Create New Custom Enterprise Role"
          footer={
            <>
              <Button size="sm" onClick={() => setCreateRoleOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  if (!newRoleName.trim()) {
                    toast('Provide a role title.', 'bad')
                    return
                  }
                  toast(`Custom role "${newRoleName}" created successfully.`, 'good')
                  setCreateRoleOpen(false)
                  setNewRoleName('')
                }}
              >
                Create Role
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <FormRow label="Role Title">
              <input
                className="gx-input"
                placeholder="e.g. Regional Account Executive"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </FormRow>
            <FormRow label="Role Description">
              <textarea
                className="gx-textarea h-20"
                placeholder="Describe the operational responsibilities of this role..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
              />
            </FormRow>
            <FormRow label="Clone Permissions From">
              <select className="gx-select">
                {DEFAULT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </FormRow>
          </div>
        </Modal>
      </div>
    </SettingsShell>
  )
}

