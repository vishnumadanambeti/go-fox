import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, Plug, RefreshCw, ShieldCheck, UserPlus, Wallet } from 'lucide-react'
import { get, patch, post, type Row } from '../lib/api'
import { Link } from '../lib/router'
import { useApp, useFetch } from '../lib/app-context'
import { formatDateTime, titleCase } from '../lib/format'
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
  const { meta, toast, refreshMeta, me } = useApp()
  const users = useFetch<{ users: Row[]; invitations: Row[] }>('/api/users')
  const org = useFetch<{ org: Row }>('/api/org')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ email: '', role: 'sales' })
  const [orgForm, setOrgForm] = useState<Row>({})
  const [busy, setBusy] = useState(false)
  const canManage = meta?.permissions.canManageUsers

  useEffect(() => {
    if (org.data?.org) setOrgForm(org.data.org)
  }, [org.data])

  if (users.loading || org.loading) return <Spinner label="Loading account" />
  if (users.error || !users.data) return <ErrorState message={users.error?.message ?? 'Could not load users'} onRetry={users.reload} />

  const saveOrg = async () => {
    setBusy(true)
    try {
      await patch('/api/org', {
        name: orgForm.name,
        currency: orgForm.currency,
        timezone: orgForm.timezone,
        website: orgForm.website,
        phone: orgForm.phone,
        address: orgForm.address,
        city: orgForm.city,
        country: orgForm.country,
      })
      toast('Organisation settings saved.', 'good')
      refreshMeta()
      org.reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not save settings.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const updateUser = async (user: Row, payload: Row) => {
    try {
      await patch(`/api/users/${user.id}`, payload)
      toast('User updated.', 'good')
      users.reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not update the user.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Account & users" subtitle={`${me?.org_name} · ${users.data.users.length} users`}>
        {canManage ? (
          <Button size="sm" variant="primary" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} /> Invite user
          </Button>
        ) : (
          <Badge tone="warn">Read-only for your role</Badge>
        )}
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader title="Users" subtitle="Roles are enforced server-side on every request" />
            <table className="gx-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead>
              <tbody>
                {users.data.users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.name}</td>
                    <td className="text-[11.5px] text-muted">{user.email}</td>
                    <td>
                      {canManage && user.role !== 'owner' ? (
                        <select
                          className="gx-select w-auto py-0.5 text-[11.5px]"
                          value={user.role}
                          onChange={(event) => void updateUser(user, { role: event.target.value })}
                        >
                          {['admin', 'manager', 'sales', 'marketer', 'support'].map((role) => (
                            <option key={role} value={role}>{titleCase(role)}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone={user.role === 'owner' ? 'accent' : 'default'}>{titleCase(user.role)}</Badge>
                      )}
                    </td>
                    <td><StatusBadge value={user.status} /></td>
                    <td className="text-[11.5px] text-muted">{user.last_login ? formatDateTime(user.last_login) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-line px-4 py-3">
              <h4 className="mb-2 text-[12px] font-semibold">Invitations</h4>
              <div className="space-y-1.5">
                {users.data.invitations.length === 0 ? <p className="text-[11.5px] text-muted">No invitations.</p> : null}
                {users.data.invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate">
                      {invitation.email} <Badge>{invitation.role}</Badge>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge value={invitation.status} />
                      {invitation.status === 'pending' && canManage ? (
                        <button
                          className="text-[11px] text-danger hover:underline"
                          onClick={async () => {
                            await post(`/api/invitations/${invitation.id}/revoke`)
                            users.reload()
                          }}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-muted">
                Invitations are recorded as pending. No email provider is connected, so nothing is delivered — the acceptance flow needs a
                provider or SSO.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Organisation</h3>
            <div className="space-y-3">
              <FormRow label="Name"><input className="gx-input" value={String(orgForm.name ?? '')} onChange={(event) => setOrgForm({ ...orgForm, name: event.target.value })} /></FormRow>
              <FormRow label="Website"><input className="gx-input" value={String(orgForm.website ?? '')} onChange={(event) => setOrgForm({ ...orgForm, website: event.target.value })} /></FormRow>
              <div className="grid grid-cols-2 gap-2">
                <FormRow label="Currency">
                  <select className="gx-select" value={String(orgForm.currency ?? 'USD')} onChange={(event) => setOrgForm({ ...orgForm, currency: event.target.value })}>
                    {['USD', 'EUR', 'GBP', 'INR', 'AED'].map((code) => <option key={code}>{code}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Timezone"><input className="gx-input" value={String(orgForm.timezone ?? '')} onChange={(event) => setOrgForm({ ...orgForm, timezone: event.target.value })} /></FormRow>
              </div>
              <FormRow label="Phone"><input className="gx-input" value={String(orgForm.phone ?? '')} onChange={(event) => setOrgForm({ ...orgForm, phone: event.target.value })} /></FormRow>
              <FormRow label="Address"><input className="gx-input" value={String(orgForm.address ?? '')} onChange={(event) => setOrgForm({ ...orgForm, address: event.target.value })} /></FormRow>
              <Button size="sm" variant="primary" onClick={() => void saveOrg()} loading={busy} disabled={!meta?.permissions.canManageSettings}>
                Save organisation
              </Button>
              {!meta?.permissions.canManageSettings ? <p className="text-[11px] text-muted">Only owners and admins can change organisation settings.</p> : null}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a user"
        footer={
          <>
            <Button size="sm" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                try {
                  const result = await post<{ message: string }>('/api/users/invite', invite)
                  toast(result.message, 'info')
                  setInviteOpen(false)
                  users.reload()
                } catch (error: any) {
                  toast(error?.message ?? 'Could not invite the user.', 'bad')
                }
              }}
            >
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow label="Email"><input className="gx-input" type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></FormRow>
          <FormRow label="Role">
            <select className="gx-select" value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })}>
              {['admin', 'manager', 'sales', 'marketer', 'support'].map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
            </select>
          </FormRow>
          <p className="text-[11.5px] text-muted">The invitation is stored with status pending and appears in the list above.</p>
        </div>
      </Modal>
    </div>
  )
}

/* ---------------------------------------------------------------- profile */
export function ProfileSettingsPage() {
  const { me, toast, refreshMe, dark, toggleTheme } = useApp()
  const [form, setForm] = useState({ name: '', title: '', phone: '', timezone: '', locale: 'en' })
  const [passwords, setPasswords] = useState({ current: '', next: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (me) setForm({ name: me.name, title: me.title ?? '', phone: '', timezone: me.timezone ?? '', locale: me.locale })
  }, [me])

  if (!me) return null

  return (
    <div className="p-5">
      <PageHeader title="Profile settings" subtitle="Personal details, preferences and password" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Your profile</h3>
          <div className="space-y-3">
            <FormRow label="Full name"><input className="gx-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormRow>
            <FormRow label="Job title"><input className="gx-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></FormRow>
            <FormRow label="Phone"><input className="gx-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormRow>
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="Timezone"><input className="gx-input" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></FormRow>
              <FormRow label="Language">
                <select className="gx-select" value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })}>
                  <option value="en">English</option>
                  <option value="de">Deutsch (not translated)</option>
                  <option value="fr">Français (not translated)</option>
                  <option value="ar">العربية (not translated)</option>
                </select>
              </FormRow>
            </div>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await patch('/api/auth/profile', form)
                  toast('Profile saved.', 'good')
                  await refreshMe()
                } catch (error: any) {
                  toast(error?.message ?? 'Could not save the profile.', 'bad')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Save profile
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Appearance</h3>
            <div className="flex items-center justify-between rounded-lg border border-line p-3">
              <div>
                <div className="text-[12.5px] font-medium">{dark ? 'Dark' : 'Light'} theme</div>
                <div className="text-[11px] text-muted">Saved per user and applied on next sign-in.</div>
              </div>
              <Button size="sm" onClick={() => void toggleTheme()}>Switch to {dark ? 'light' : 'dark'}</Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Password</h3>
            <div className="space-y-3">
              <FormRow label="Current password"><input className="gx-input" type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} /></FormRow>
              <FormRow label="New password" hint="At least 8 characters"><input className="gx-input" type="password" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} /></FormRow>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await post('/api/auth/password', { current: passwords.current, next: passwords.next })
                    toast('Password changed. Sign in again with the new password.', 'good')
                    window.location.assign('/login')
                  } catch (error: any) {
                    toast(error?.message ?? 'Could not change the password.', 'bad')
                  }
                }}
              >
                Change password
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><Plug size={14} /> Email accounts</h3>
            <p className="text-[12px] leading-relaxed text-muted">
              Connect Gmail, Microsoft Outlook or an IMAP mailbox to synchronise inbox and sent mail and send as your own address.
            </p>
            <Link to="/general-settings/email-accounts" className="gx-btn gx-btn-primary gx-btn-sm mt-3">
              Manage email accounts
            </Link>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><ShieldCheck size={14} /> Session</h3>
            <p className="text-[12px] text-muted">
              Signed in as {me.email} · role {titleCase(me.role)}. Sessions are httpOnly cookies hashed in the database and expire after seven days.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- financial */
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
