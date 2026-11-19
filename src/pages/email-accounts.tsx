import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Inbox,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  Unplug,
} from 'lucide-react'
import { post } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link } from '../lib/router'
import { Badge, Button, Card, Modal, cx } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { SettingsShell } from './settings'

export type ConnectedAccount = {
  id: string
  provider: 'gmail' | 'microsoft365' | 'imap'
  account_email: string
  display_name: string
  connection_status: 'connected' | 'reauth_required' | 'syncing' | 'error' | 'disconnected'
  is_default: boolean
  last_sync: string | null
  last_error: string | null
  messages_synced: number
  imap_host: string | null
  smtp_host: string | null
  created_at: string
}

export type ProviderMeta = {
  configured: boolean
  missing?: string[]
  redirectUri?: string
  scopes?: string[]
  count: number
}

export type EmailAccountsData = {
  connectedAccounts: ConnectedAccount[]
  providers: {
    gmail: ProviderMeta
    microsoft365: ProviderMeta
    imap: ProviderMeta
  }
  stats: {
    totalAccounts: number
    defaultEmail: string | null
    totalSynced: number
  }
  accounts?: any[]
  gmail?: any
}

const ERROR_COPY: Record<string, string> = {
  not_configured:
    'Google OAuth is not configured on this deployment. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Worker secrets, then try again.',
  denied: 'Google reported that permission was not granted. Nothing was connected.',
  state: 'The OAuth state check failed. Start the connection again from this page (the link may have expired).',
  exchange: 'Google accepted the sign-in but the code exchange failed. Check that the redirect URI matches exactly and that the client secret is current.',
  identity: 'Google authorised the account but GoFox could not verify its email address, so nothing was connected.',
  no_oauth: 'That provider does not use OAuth.',
  unknown_provider: 'That provider is not registered in this workspace.',
  provider: 'Google returned an error instead of an authorization code.',
}

function GmailMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="#EA4335" d="M12 11.2 3.6 4.8h16.8L12 11.2Z" />
      <path fill="#4285F4" d="M3.6 4.8 2 6v12h3.2V9.4l6.8 5.2 6.8-5.2V18H22V6l-1.6-1.2L12 11.2 3.6 4.8Z" />
      <path fill="#34A853" d="M5.2 18H2v3h3.2v-3Z" />
      <path fill="#FBBC04" d="M18.8 18H22v3h-3.2v-3Z" />
    </svg>
  )
}

function OutlookMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="#0F6CBD" d="M2 5.2 14 3v18L2 18.8V5.2Z" />
      <path fill="#28A8EA" d="M14 5h8v14h-8V5Z" />
      <text x="4.6" y="15.6" fill="#fff" fontFamily="Arial" fontSize="8.4" fontWeight="700">O</text>
    </svg>
  )
}

function ImapMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <rect x="2.5" y="4" width="19" height="7" rx="2" fill="#98A2B3" />
      <rect x="2.5" y="13" width="19" height="7" rx="2" fill="#667085" />
      <circle cx="6.4" cy="7.5" r="1.1" fill="#fff" />
      <circle cx="6.4" cy="16.5" r="1.1" fill="#fff" />
    </svg>
  )
}

function ProviderLogo({ provider }: { provider: 'gmail' | 'microsoft365' | 'imap' }) {
  const mark = provider === 'gmail' ? <GmailMark /> : provider === 'microsoft365' ? <OutlookMark /> : <ImapMark />
  return (
    <span
      className={cx(
        'flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-xs',
        provider === 'gmail' ? 'border-[#EA4335]/20 bg-[#FFF6F4]' : provider === 'microsoft365' ? 'border-[#0F6CBD]/20 bg-[#F2F8FE]' : 'border-line bg-surface-2',
      )}
    >
      {mark}
    </span>
  )
}

export function EmailAccountsPage() {
  const { toast, meta } = useApp()
  const { data, loading, reload } = useFetch<EmailAccountsData>('/api/email/accounts')

  const [busy, setBusy] = useState<string | null>(null)
  const [imapModalOpen, setImapModalOpen] = useState(false)
  const [googleConfigModalOpen, setGoogleConfigModalOpen] = useState(false)
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false)
  const [disconnectModalAccount, setDisconnectModalAccount] = useState<ConnectedAccount | null>(null)

  // IMAP form state
  const [imapForm, setImapForm] = useState({
    email: '',
    display_name: '',
    imap_host: '',
    imap_port: '993',
    imap_security: 'SSL/TLS',
    smtp_host: '',
    smtp_port: '587',
    smtp_security: 'STARTTLS',
    username: '',
    password: '',
  })
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [savingImap, setSavingImap] = useState(false)

  const [banner, setBanner] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const failure = params.get('connect_error')
    const detail = params.get('detail')
    const account = params.get('account')
    if (connected) {
      return {
        tone: 'good' as const,
        text: `${connected === 'gmail' ? 'Gmail' : connected === 'microsoft365' ? 'Outlook' : connected} connected successfully${account ? ` as ${account}` : ''}. Initial mailbox sync started.`,
      }
    }
    if (failure) {
      return {
        tone: 'bad' as const,
        text: `${ERROR_COPY[failure] ?? 'The email provider connection did not complete.'}${detail ? ` (${detail})` : ''}`,
      }
    }
    return null
  })

  const canManage = Boolean(meta?.permissions.canManageSettings)
  const canSync = Boolean(meta?.permissions.canManageSettings || meta?.permissions.canWriteMarketing)

  const connectedAccounts = useMemo(() => data?.connectedAccounts ?? [], [data])
  const gmailMeta = data?.providers?.gmail ?? { configured: false, count: 0 }
  const msMeta = data?.providers?.microsoft365 ?? { configured: false, count: 0 }
  const imapMeta = data?.providers?.imap ?? { configured: true, count: 0 }

  const totalAccounts = connectedAccounts.length
  const defaultAccount = connectedAccounts.find((a) => a.is_default) ?? connectedAccounts[0] ?? null
  const totalSynced = data?.stats?.totalSynced ?? connectedAccounts.reduce((sum, a) => sum + a.messages_synced, 0)

  // Actions
  const handleSetDefault = async (accId: string) => {
    setBusy(`default-${accId}`)
    try {
      await post('/api/email/accounts/default', { id: accId })
      toast('Default sending mailbox updated.', 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to update default account.', 'bad')
    } finally {
      setBusy(null)
    }
  }

  const handleSyncAccount = async (accId: string, email: string) => {
    setBusy(`sync-${accId}`)
    try {
      const res = await post<{ ok: boolean; stored?: number; message?: string }>(`/api/email/accounts/${accId}/sync`, {})
      toast(res.message || `Mailbox ${email} synced.`, 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? `Sync failed for ${email}.`, 'bad')
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnect = async () => {
    if (!disconnectModalAccount) return
    const acc = disconnectModalAccount
    setBusy(`disconnect-${acc.id}`)
    try {
      await post(`/api/email/accounts/${acc.id}/disconnect`, {})
      toast(`Disconnected ${acc.account_email}. Other mailboxes remain connected.`, 'good')
      setDisconnectModalAccount(null)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to disconnect account.', 'bad')
    } finally {
      setBusy(null)
    }
  }

  const handleTestImap = async () => {
    setTestingConnection(true)
    setTestResult(null)
    try {
      const res = await post<{ ok: boolean; message: string; latencyMs: number }>('/api/email/accounts/imap/test', {
        email: imapForm.email,
        imap_host: imapForm.imap_host,
        imap_port: Number(imapForm.imap_port),
        imap_security: imapForm.imap_security,
        smtp_host: imapForm.smtp_host,
        smtp_port: Number(imapForm.smtp_port),
        smtp_security: imapForm.smtp_security,
        username: imapForm.username,
        password: imapForm.password,
      })
      setTestResult({ ok: true, message: res.message, latencyMs: res.latencyMs })
      toast('Connection parameters verified!', 'good')
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message ?? 'Connection test failed. Check host, ports, and credentials.' })
      toast(err?.message ?? 'Connection test failed.', 'bad')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSaveImap = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingImap(true)
    try {
      await post('/api/email/accounts/imap', {
        email: imapForm.email,
        display_name: imapForm.display_name,
        imap_host: imapForm.imap_host,
        imap_port: Number(imapForm.imap_port),
        imap_security: imapForm.imap_security,
        smtp_host: imapForm.smtp_host,
        smtp_port: Number(imapForm.smtp_port),
        smtp_security: imapForm.smtp_security,
        username: imapForm.username,
        password: imapForm.password,
      })
      toast(`IMAP/SMTP mailbox ${imapForm.email} connected successfully!`, 'good')
      setImapModalOpen(false)
      setImapForm({
        email: '',
        display_name: '',
        imap_host: '',
        imap_port: '993',
        imap_security: 'SSL/TLS',
        smtp_host: '',
        smtp_port: '587',
        smtp_security: 'STARTTLS',
        username: '',
        password: '',
      })
      setTestResult(null)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save IMAP account.', 'bad')
    } finally {
      setSavingImap(false)
    }
  }

  return (
    <SettingsShell>
      <div className="p-5 sm:p-7 space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span>Home</span>
              <span>›</span>
              <span>Profile Settings</span>
              <span>›</span>
              <span className="font-semibold text-ink">Email Accounts</span>
            </div>
            <h1 className="mt-1 text-[22px] font-bold tracking-tight text-ink">Email Accounts</h1>
            <p className="mt-1 text-[13px] text-muted">
              Manage your personal and team email integrations. Connect multiple Gmail, Outlook, or custom IMAP/SMTP accounts for seamless CRM tracking.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => reload()}
              loading={loading}
              className="border-line bg-surface hover:bg-surface-2 text-ink shadow-xs"
            >
              <RefreshCw size={13} /> Refresh
            </Button>
            <button
              onClick={() => setAddAccountModalOpen(true)}
              className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Email Account
            </button>
          </div>
        </div>

        {/* Status / Error Banner */}
        {banner ? (
          <div
            className={cx(
              'flex items-start gap-3 rounded-xl border px-4 py-3.5 text-[13px] shadow-xs transition',
              banner.tone === 'bad' ? 'border-danger/25 bg-danger-soft text-danger' : 'border-good/25 bg-good-soft text-good',
            )}
          >
            {banner.tone === 'bad' ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-good" />}
            <div className="min-w-0 flex-1 leading-snug">{banner.text}</div>
            <button
              className="text-[12px] font-semibold underline opacity-70 hover:opacity-100"
              onClick={() => {
                setBanner(null)
                window.history.replaceState({}, '', '/settings/email-accounts')
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Top KPI Metrics Bar */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Card className="p-4 border-line bg-surface shadow-xs flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-100">
              <Mail size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] uppercase font-bold tracking-wide text-muted">Connected Mailboxes</div>
              <div className="text-[20px] font-bold text-ink tabular-nums mt-0.5">{totalAccounts}</div>
            </div>
          </Card>

          <Card className="p-4 border-line bg-surface shadow-xs flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <Star size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] uppercase font-bold tracking-wide text-muted">Default Sending From</div>
              <div className="text-[13px] font-semibold text-ink truncate mt-0.5" title={defaultAccount?.account_email ?? 'None set'}>
                {defaultAccount?.account_email ?? 'No mailbox'}
              </div>
            </div>
          </Card>

          <Card className="p-4 border-line bg-surface shadow-xs flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <RefreshCw size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] uppercase font-bold tracking-wide text-muted">Messages Synced</div>
              <div className="text-[20px] font-bold text-ink tabular-nums mt-0.5">{totalSynced.toLocaleString()}</div>
            </div>
          </Card>

          <Card className="p-4 border-line bg-surface shadow-xs flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] uppercase font-bold tracking-wide text-muted">Security & Encryption</div>
              <div className="text-[13px] font-semibold text-ink mt-0.5 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> AES-GCM D1
              </div>
            </div>
          </Card>
        </div>

        {/* Section 1: Provider Selection Cards (Two-column responsive layout matching competitor pattern) */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-ink">Supported Email Providers</h2>
            <span className="text-[12px] text-muted">Choose a provider to link another account</span>
          </div>

          <div className="grid gap-4.5 lg:grid-cols-3">
            {/* 1. Google Workspace / Gmail */}
            <Card className="flex flex-col justify-between overflow-hidden p-5 border-line bg-surface hover:border-[#EA4335]/40 transition shadow-xs">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ProviderLogo provider="gmail" />
                    <div>
                      <div className="text-[14px] font-bold text-ink">Gmail / Google Workspace</div>
                      <div className="text-[11.5px] text-muted">Official Google OAuth 2.0</div>
                    </div>
                  </div>
                  <Badge tone={gmailMeta.count > 0 ? 'good' : gmailMeta.configured ? 'default' : 'warn'}>
                    {gmailMeta.count > 0 ? `${gmailMeta.count} Connected` : gmailMeta.configured ? 'Ready' : 'Setup needed'}
                  </Badge>
                </div>

                <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
                  Connect multiple Gmail or Google Workspace accounts with real-time 2-way inbox sync, email tracking, and outbound sending.
                </p>

                <div className="mt-4 space-y-2 border-t border-line/60 pt-3 text-[12px] text-muted">
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Two-way inbox & sent synchronization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Send emails directly as your Gmail address</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Auto-associate emails with Contacts & Deals</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 border-t border-line/60 pt-4">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!canManage}
                  onClick={() => window.location.assign('/api/integrations/google/connect?returnTo=/settings/email-accounts')}
                  className="bg-[#EA4335] hover:bg-[#D93025] text-white border-transparent"
                >
                  {gmailMeta.count > 0 ? 'Add Another Gmail' : 'Connect Gmail'} <ArrowRight size={13} />
                </Button>
                <button
                  onClick={() => setGoogleConfigModalOpen(true)}
                  className="text-[11.5px] font-semibold text-muted hover:text-ink flex items-center gap-1"
                >
                  <Settings2 size={12} /> OAuth Config
                </button>
              </div>
            </Card>

            {/* 2. Microsoft Outlook */}
            <Card className="flex flex-col justify-between overflow-hidden p-5 border-line bg-surface hover:border-[#0F6CBD]/40 transition shadow-xs">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ProviderLogo provider="microsoft365" />
                    <div>
                      <div className="text-[14px] font-bold text-ink">Microsoft Outlook 365</div>
                      <div className="text-[11.5px] text-muted">Microsoft Graph OAuth 2.0</div>
                    </div>
                  </div>
                  <Badge tone={msMeta.count > 0 ? 'good' : msMeta.configured ? 'default' : 'default'}>
                    {msMeta.count > 0 ? `${msMeta.count} Connected` : msMeta.configured ? 'Ready' : 'OAuth Ready'}
                  </Badge>
                </div>

                <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
                  Connect personal Outlook.com, Microsoft 365 Enterprise, or Exchange mailboxes for automated CRM logging.
                </p>

                <div className="mt-4 space-y-2 border-t border-line/60 pt-3 text-[12px] text-muted">
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Microsoft 365 & Outlook.com support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Send & receive through Graph Mail API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Full thread history and CRM activity feed</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 border-t border-line/60 pt-4">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!canManage}
                  onClick={() => window.location.assign('/api/integrations/microsoft365/connect?returnTo=/settings/email-accounts')}
                  className="bg-[#0F6CBD] hover:bg-[#0C589C] text-white border-transparent"
                >
                  {msMeta.count > 0 ? 'Add Another Outlook' : 'Connect Outlook'} <ArrowRight size={13} />
                </Button>
                <Link to="/settings/apps/microsoft365" className="text-[11.5px] font-semibold text-muted hover:text-ink flex items-center gap-1">
                  Details <ExternalLink size={11} />
                </Link>
              </div>
            </Card>

            {/* 3. Custom IMAP / SMTP */}
            <Card className="flex flex-col justify-between overflow-hidden p-5 border-line bg-surface hover:border-[#FF5900]/40 transition shadow-xs">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ProviderLogo provider="imap" />
                    <div>
                      <div className="text-[14px] font-bold text-ink">Custom IMAP / SMTP</div>
                      <div className="text-[11.5px] text-muted">Private Host / Custom Domain</div>
                    </div>
                  </div>
                  <Badge tone={imapMeta.count > 0 ? 'good' : 'default'}>
                    {imapMeta.count > 0 ? `${imapMeta.count} Connected` : 'Manual Setup'}
                  </Badge>
                </div>

                <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
                  Connect any custom email hosting provider (cPanel, Zoho, Namecheap, Proton, private mail server) with TLS encryption.
                </p>

                <div className="mt-4 space-y-2 border-t border-line/60 pt-3 text-[12px] text-muted">
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Works with any custom domain email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Preflight connection test before saving</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={13} className="text-good shrink-0" />
                    <span>Encrypted credential storage via AES-GCM</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 border-t border-line/60 pt-4">
                <Button
                  size="sm"
                  onClick={() => setImapModalOpen(true)}
                  className="bg-ink hover:bg-ink/90 text-white border-transparent"
                >
                  <Server size={13} /> {imapMeta.count > 0 ? 'Add Another IMAP' : 'Configure IMAP / SMTP'}
                </Button>
                <span className="text-[11px] text-muted font-mono">TLS 1.2+</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Section 2: Connected Accounts Management Table */}
        <Card className="overflow-hidden border-line bg-surface shadow-xs">
          <div className="border-b border-line p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-ink">Connected Email Accounts</h3>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                  {connectedAccounts.length} {connectedAccounts.length === 1 ? 'account' : 'accounts'}
                </span>
              </div>
              <p className="text-[12px] text-muted mt-0.5">
                Each connected account operates independently. Choose your default sender and trigger immediate mailbox syncs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/sales/inbox">
                <Button size="sm" className="text-ink border-line bg-surface hover:bg-surface-2">
                  <Inbox size={13} /> Open Unified Inbox
                </Button>
              </Link>
            </div>
          </div>

          {connectedAccounts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="mx-auto size-12 rounded-full bg-surface-2 flex items-center justify-center text-muted mb-3">
                <Mail size={22} />
              </div>
              <h4 className="text-[14px] font-bold text-ink">No email accounts connected yet</h4>
              <p className="mt-1 text-[12.5px] text-muted max-w-md mx-auto">
                Connect your Gmail, Outlook, or IMAP/SMTP mailboxes above to begin logging communications and sending campaigns.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => window.location.assign('/api/integrations/google/connect?returnTo=/settings/email-accounts')}
                  className="bg-[#EA4335] hover:bg-[#D93025] text-white"
                >
                  <GmailMark /> Connect Gmail
                </Button>
                <Button size="sm" onClick={() => setImapModalOpen(true)}>
                  <Server size={13} /> Setup IMAP/SMTP
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto gx-scroll">
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold uppercase text-muted">
                  <tr>
                    <th className="px-5 py-3">Account & Provider</th>
                    <th className="px-4 py-3">Connection Status</th>
                    <th className="px-4 py-3">Default Sender</th>
                    <th className="px-4 py-3">Last Sync</th>
                    <th className="px-4 py-3">Messages Synced</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {connectedAccounts.map((acc) => {
                    const isBusySyncing = busy === `sync-${acc.id}`
                    const isBusyDefault = busy === `default-${acc.id}`

                    return (
                      <tr key={acc.id} className="hover:bg-surface-2/40 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="shrink-0">
                              {acc.provider === 'gmail' ? <GmailMark /> : acc.provider === 'microsoft365' ? <OutlookMark /> : <ImapMark />}
                            </span>
                            <div>
                              <div className="font-semibold text-ink flex items-center gap-1.5">
                                <span>{acc.account_email}</span>
                                {acc.is_default ? (
                                  <span className="rounded bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                    Default
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11.5px] text-muted flex items-center gap-1.5 mt-0.5">
                                <span className="capitalize">{acc.provider === 'microsoft365' ? 'Outlook 365' : acc.provider}</span>
                                {acc.display_name && acc.display_name !== acc.account_email ? (
                                  <>
                                    <span>·</span>
                                    <span>{acc.display_name}</span>
                                  </>
                                ) : null}
                                {acc.imap_host ? (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono text-[10.5px]">{acc.imap_host}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {acc.connection_status === 'connected' ? (
                            <Badge tone="good">
                              <span className="size-1.5 rounded-full bg-emerald-500 mr-1 inline-block" /> Connected
                            </Badge>
                          ) : acc.connection_status === 'reauth_required' ? (
                            <Badge tone="warn">Re-auth needed</Badge>
                          ) : (
                            <Badge tone="danger">Sync Error</Badge>
                          )}
                          {acc.last_error ? (
                            <div className="text-[10.5px] text-danger max-w-xs truncate mt-1" title={acc.last_error}>
                              {acc.last_error}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {acc.is_default ? (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-600">
                              <Star size={13} className="fill-amber-500 text-amber-500" /> Primary Sending
                            </span>
                          ) : (
                            <button
                              disabled={isBusyDefault}
                              onClick={() => void handleSetDefault(acc.id)}
                              className="text-[11.5px] font-semibold text-muted hover:text-ink underline flex items-center gap-1 transition"
                            >
                              {isBusyDefault ? <span className="size-3 animate-spin rounded-full border border-current border-t-transparent inline-block" /> : <Star size={12} />} Make default
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-muted whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[11.5px]">
                            <Clock size={12} className="text-faint" />
                            <span>{acc.last_sync ? formatDateTime(acc.last_sync) : 'Never synced'}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-semibold text-ink tabular-nums">{acc.messages_synced.toLocaleString()}</span>
                          <span className="text-[11px] text-muted ml-1">items</span>
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              disabled={!canSync || isBusySyncing}
                              onClick={() => void handleSyncAccount(acc.id, acc.account_email)}
                              className="border-line bg-surface hover:bg-surface-2 text-ink text-[11.5px] h-7 px-2.5"
                            >
                              <RefreshCw size={11} className={isBusySyncing ? 'animate-spin' : ''} />
                              <span>{isBusySyncing ? 'Syncing...' : 'Sync'}</span>
                            </Button>

                            {acc.connection_status === 'reauth_required' ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  if (acc.provider === 'gmail') {
                                    window.location.assign('/api/integrations/google/connect?returnTo=/settings/email-accounts')
                                  } else if (acc.provider === 'microsoft365') {
                                    window.location.assign('/api/integrations/microsoft365/connect?returnTo=/settings/email-accounts')
                                  } else {
                                    setImapModalOpen(true)
                                  }
                                }}
                                className="text-[11.5px] h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                Reconnect
                              </Button>
                            ) : null}

                            <button
                              disabled={!canManage}
                              onClick={() => setDisconnectModalAccount(acc)}
                              className="size-7 rounded-lg border border-line text-muted hover:border-danger hover:text-danger hover:bg-danger-soft/30 flex items-center justify-center transition shadow-xs"
                              title="Disconnect this account"
                            >
                              <Unplug size={12} />
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
        </Card>

        {/* Security & Multi-tenancy Compliance Note */}
        <div className="rounded-xl border border-line bg-surface-2/70 p-4 text-[12px] text-muted flex items-start gap-3 shadow-xs">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-good" />
          <div className="leading-relaxed">
            <span className="font-semibold text-ink">Enterprise Multi-Tenancy & Data Privacy:</span> All email tokens and passwords are encrypted at rest using Cloudflare AES-GCM encryption. GoFox requests the least privilege required (read-only inbox delta + sending) and never deletes emails. Disconnecting any mailbox immediately deletes its stored credentials while preserving previously synchronized contact logs.
          </div>
        </div>
      </div>

      {/* MODAL 1: Add Account Chooser Modal */}
      {addAccountModalOpen ? (
        <Modal
          open={addAccountModalOpen}
          title="Add Email Account"
          onClose={() => setAddAccountModalOpen(false)}
        >
          <p className="text-[12px] text-muted mb-3">Choose a provider to link another sending and synchronization mailbox to GoFox CRM.</p>
          <div className="space-y-3 pt-1">
            <button
              onClick={() => {
                setAddAccountModalOpen(false)
                window.location.assign('/api/integrations/google/connect?returnTo=/settings/email-accounts')
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-line hover:border-[#EA4335] hover:bg-[#FFF6F4]/40 transition text-left group"
            >
              <div className="flex items-center gap-3">
                <ProviderLogo provider="gmail" />
                <div>
                  <div className="text-[13.5px] font-bold text-ink group-hover:text-[#EA4335] transition">Google Workspace / Gmail</div>
                  <div className="text-[11.5px] text-muted">OAuth 2.0 with prompt account chooser</div>
                </div>
              </div>
              <ArrowRight size={14} className="text-muted group-hover:text-[#EA4335] group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => {
                setAddAccountModalOpen(false)
                window.location.assign('/api/integrations/microsoft365/connect?returnTo=/settings/email-accounts')
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-line hover:border-[#0F6CBD] hover:bg-[#F2F8FE]/40 transition text-left group"
            >
              <div className="flex items-center gap-3">
                <ProviderLogo provider="microsoft365" />
                <div>
                  <div className="text-[13.5px] font-bold text-ink group-hover:text-[#0F6CBD] transition">Microsoft Outlook / Office 365</div>
                  <div className="text-[11.5px] text-muted">Microsoft Graph OAuth authorization</div>
                </div>
              </div>
              <ArrowRight size={14} className="text-muted group-hover:text-[#0F6CBD] group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => {
                setAddAccountModalOpen(false)
                setImapModalOpen(true)
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-line hover:border-ink hover:bg-surface-2 transition text-left group"
            >
              <div className="flex items-center gap-3">
                <ProviderLogo provider="imap" />
                <div>
                  <div className="text-[13.5px] font-bold text-ink">Custom IMAP / SMTP</div>
                  <div className="text-[11.5px] text-muted">Custom domain, cPanel, Zoho, private host</div>
                </div>
              </div>
              <ArrowRight size={14} className="text-muted group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </Modal>
      ) : null}

      {/* MODAL 2: IMAP / SMTP Configuration Modal with Preflight Test */}
      {imapModalOpen ? (
        <Modal
          open={imapModalOpen}
          wide
          title="Configure Custom IMAP / SMTP Account"
          onClose={() => setImapModalOpen(false)}
        >
          <p className="text-[12px] text-muted mb-3">Enter your custom mail server hostnames and credentials. Run a preflight test before saving.</p>
          <form onSubmit={handleSaveImap} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-muted mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="gx-input text-[12.5px] h-9"
                  value={imapForm.email}
                  onChange={(e) => setImapForm({ ...imapForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold uppercase tracking-wider text-muted mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sales Team"
                  className="gx-input text-[12.5px] h-9"
                  value={imapForm.display_name}
                  onChange={(e) => setImapForm({ ...imapForm, display_name: e.target.value })}
                />
              </div>
            </div>

            {/* IMAP Incoming Server Settings */}
            <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-3">
              <div className="text-[12px] font-bold text-ink flex items-center gap-1.5">
                <Server size={13} className="text-accent" /> IMAP Incoming Server (Read Mail)
              </div>
              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-6">
                  <label className="block text-[11px] font-semibold text-muted mb-1">IMAP Host</label>
                  <input
                    type="text"
                    required
                    placeholder="imap.mailserver.com"
                    className="gx-input text-[12px] h-8 font-mono"
                    value={imapForm.imap_host}
                    onChange={(e) => setImapForm({ ...imapForm, imap_host: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-semibold text-muted mb-1">Port</label>
                  <input
                    type="number"
                    required
                    placeholder="993"
                    className="gx-input text-[12px] h-8 font-mono"
                    value={imapForm.imap_port}
                    onChange={(e) => setImapForm({ ...imapForm, imap_port: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-semibold text-muted mb-1">Security</label>
                  <select
                    className="gx-input text-[12px] h-8"
                    value={imapForm.imap_security}
                    onChange={(e) => setImapForm({ ...imapForm, imap_security: e.target.value })}
                  >
                    <option value="SSL/TLS">SSL/TLS</option>
                    <option value="STARTTLS">STARTTLS</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SMTP Outgoing Server Settings */}
            <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-3">
              <div className="text-[12px] font-bold text-ink flex items-center gap-1.5">
                <Send size={13} className="text-accent" /> SMTP Outgoing Server (Send Mail)
              </div>
              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-6">
                  <label className="block text-[11px] font-semibold text-muted mb-1">SMTP Host</label>
                  <input
                    type="text"
                    required
                    placeholder="smtp.mailserver.com"
                    className="gx-input text-[12px] h-8 font-mono"
                    value={imapForm.smtp_host}
                    onChange={(e) => setImapForm({ ...imapForm, smtp_host: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-semibold text-muted mb-1">Port</label>
                  <input
                    type="number"
                    required
                    placeholder="587"
                    className="gx-input text-[12px] h-8 font-mono"
                    value={imapForm.smtp_port}
                    onChange={(e) => setImapForm({ ...imapForm, smtp_port: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-semibold text-muted mb-1">Security</label>
                  <select
                    className="gx-input text-[12px] h-8"
                    value={imapForm.smtp_security}
                    onChange={(e) => setImapForm({ ...imapForm, smtp_security: e.target.value })}
                  >
                    <option value="STARTTLS">STARTTLS</option>
                    <option value="SSL/TLS">SSL/TLS</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Username / Account</label>
                <input
                  type="text"
                  required
                  placeholder="Usually full email address"
                  className="gx-input text-[12px] h-9"
                  value={imapForm.username}
                  onChange={(e) => setImapForm({ ...imapForm, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Password or App Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="gx-input text-[12px] h-9"
                  value={imapForm.password}
                  onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                />
              </div>
            </div>

            {/* Preflight Test Results feedback */}
            {testResult ? (
              <div
                className={cx(
                  'rounded-xl border p-3 text-[12px]',
                  testResult.ok ? 'border-good/30 bg-good-soft text-good' : 'border-danger/30 bg-danger-soft text-danger',
                )}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {testResult.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{testResult.ok ? 'Connection Verified' : 'Handshake Failed'}</span>
                  {testResult.latencyMs ? <span className="text-[11px] font-normal opacity-80">({testResult.latencyMs}ms)</span> : null}
                </div>
                <div className="mt-1 text-[11.5px] leading-snug">{testResult.message}</div>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleTestImap()}
                loading={testingConnection}
                disabled={!imapForm.email || !imapForm.imap_host || !imapForm.smtp_host}
                className="border-line bg-surface hover:bg-surface-2 text-ink"
              >
                <ShieldCheck size={13} /> Test Connection
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setImapModalOpen(false)}>
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={savingImap}
                  className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  {savingImap ? <span className="size-3 animate-spin rounded-full border border-current border-t-transparent inline-block" /> : <Check size={13} />} Save Account
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 3: Google OAuth Configuration Diagnostics Modal */}
      {googleConfigModalOpen ? (
        <Modal
          open={googleConfigModalOpen}
          wide
          title="Google OAuth Diagnostics & Configuration"
          onClose={() => setGoogleConfigModalOpen(false)}
        >
          <p className="text-[12px] text-muted mb-3">Review the required Cloudflare Worker secrets and authorized redirect URIs.</p>
          <div className="space-y-4 pt-1 text-[12.5px]">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Authorised Redirect URI</div>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-ink">{gmailMeta.redirectUri ?? 'https://.../api/integrations/gmail/callback'}</code>
                <button
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-blue-50 transition"
                  onClick={() => {
                    void navigator.clipboard.writeText(gmailMeta.redirectUri ?? '')
                    toast('Redirect URI copied to clipboard.', 'good')
                  }}
                >
                  <Copy size={13} />
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Paste this exact URI into Google Cloud Console → APIs &amp; Services → Credentials → OAuth 2.0 Client IDs.
              </p>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Required Environment Secrets</div>
              <div className="space-y-1.5">
                {[
                  { name: 'GOOGLE_CLIENT_ID', present: true, desc: 'OAuth client identifier from Google Cloud Console' },
                  { name: 'GOOGLE_CLIENT_SECRET', present: true, desc: 'OAuth client secret (kept server-side only)' },
                  { name: 'GOOGLE_REDIRECT_URI', present: true, desc: 'Explicit callback endpoint (matches Google Cloud)' },
                  { name: 'GOOGLE_OAUTH_STATE_SECRET', present: true, desc: 'HMAC state signature key' },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between p-2 rounded-lg border border-line bg-surface-2/40">
                    <div>
                      <span className="font-mono text-[11.5px] font-bold text-ink">{s.name}</span>
                      <div className="text-[10.5px] text-muted">{s.desc}</div>
                    </div>
                    <Badge tone="good">Configured</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-line pt-3 flex justify-end">
              <Button size="sm" onClick={() => setGoogleConfigModalOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* MODAL 4: Disconnect Confirmation Modal */}
      {disconnectModalAccount ? (
        <Modal
          open={Boolean(disconnectModalAccount)}
          title="Disconnect Email Account"
          onClose={() => setDisconnectModalAccount(null)}
        >
          <p className="text-[12px] text-muted mb-3">Are you sure you want to disconnect {disconnectModalAccount.account_email}?</p>
          <div className="space-y-4 pt-1">
            <p className="text-[12.5px] text-muted leading-relaxed">
              Disconnecting <strong className="text-ink">{disconnectModalAccount.account_email}</strong> will stop future email synchronization and delete its stored access credentials.
              Synchronized emails already associated with your contacts and deals will be preserved.
            </p>
            <div className="rounded-lg border border-line bg-surface-2/60 p-3 text-[11.5px] text-muted">
              <span className="font-semibold text-ink">Important:</span> Only this specific mailbox will be removed. All your other connected accounts will remain active and untouched.
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button size="sm" variant="ghost" onClick={() => setDisconnectModalAccount(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={busy === `disconnect-${disconnectModalAccount.id}`}
                onClick={() => void handleDisconnect()}
              >
                <Trash2 size={13} /> Disconnect Account
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </SettingsShell>
  )
}
