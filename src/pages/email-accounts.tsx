import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Inbox,
  Mail,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Unplug,
} from 'lucide-react'
import { post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link } from '../lib/router'
import { Badge, Button, Card, ErrorState, PageHeader, Spinner, cx } from '../components/ui'
import { formatDateTime } from '../lib/format'

type Account = {
  provider: 'gmail' | 'microsoft365' | 'imap'
  name: string
  description: string
  connected: boolean
  account: string | null
  status: string
  lastSync: string | null
  note?: string | null
  configured: boolean
  missing?: string[]
  redirectUri?: string
  scopes?: string[]
  canSend?: boolean
  tokenExpiresAt?: string | null
  sync?: {
    status: string
    lastSync: string | null
    lastError: string | null
    messagesSynced: number
    historyId?: string | null
    cursor?: boolean
  } | null
  counts?: { inbox: number; sent: number; draft: number }
  scope?: string | null
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

function Logo({ provider }: { provider: Account['provider'] }) {
  const mark = provider === 'gmail' ? <GmailMark /> : provider === 'microsoft365' ? <OutlookMark /> : <ImapMark />
  return (
    <span
      className={cx(
        'flex size-11 shrink-0 items-center justify-center rounded-xl border',
        provider === 'gmail' ? 'border-[#EA4335]/15 bg-[#FFF6F4]' : provider === 'microsoft365' ? 'border-[#0F6CBD]/15 bg-[#F2F8FE]' : 'border-line bg-surface-2',
      )}
    >
      {mark}
    </span>
  )
}

export function EmailAccountsPage() {
  const { toast, meta } = useApp()
  const { data, loading, error, reload } = useFetch<{ accounts: Account[] }>('/api/email/accounts')
  const [busy, setBusy] = useState<string | null>(null)
  const [banner, setBanner] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const failure = params.get('connect_error')
    const detail = params.get('detail')
    const account = params.get('account')
    if (connected) return { tone: 'good' as const, text: `${connected === 'gmail' ? 'Gmail' : connected === 'microsoft365' ? 'Outlook' : connected} connected${account ? ` as ${account}` : ''}. Run a sync to import mail.` }
    if (failure) return { tone: 'bad' as const, text: `${ERROR_COPY[failure] ?? 'The provider connection did not complete.'}${detail ? ` (${detail})` : ''}` }
    return null
  })
  const canManage = Boolean(meta?.permissions.canManageSettings)
  const canSync = Boolean(meta?.permissions.canManageSettings || meta?.permissions.canWriteMarketing)

  if (loading) return <Spinner label="Loading email accounts" />
  if (error || !data) return <ErrorState message={error?.message ?? 'Email accounts are unavailable.'} onRetry={reload} />
  const gmail = data.accounts.find((account) => account.provider === 'gmail')!
  const totalMessages = (gmail.counts?.inbox ?? 0) + (gmail.counts?.sent ?? 0)

  const sync = async () => {
    setBusy('sync')
    try {
      const result = await post<{ message: string; stored: number; remaining: number }>('/api/email/gmail/sync', {})
      toast(result.message || `Synced ${result.stored} message${result.stored === 1 ? '' : 's'}.`, 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Gmail sync failed.', 'bad')
      reload()
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect Gmail? The stored token is deleted and synchronised mail stays in GoFox but stops updating.')) return
    setBusy('disconnect')
    try {
      await post('/api/email/gmail/disconnect', {})
      toast('Gmail disconnected and token deleted.', 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not disconnect Gmail.', 'bad')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Email accounts"
        subtitle="Connect the mailbox this workspace sends and receives from. Status shown here is read live from the provider."
      >
        <Badge tone={gmail.connected ? 'good' : 'default'}>
          {gmail.connected ? `Gmail · ${gmail.account}` : 'No mailbox connected'}
        </Badge>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
          {banner ? (
            <div
              className={cx(
                'mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px]',
                banner.tone === 'bad' ? 'border-danger/25 bg-danger-soft text-danger' : 'border-good/25 bg-good-soft text-good',
              )}
            >
              {banner.tone === 'bad' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">{banner.text}</div>
              <button className="text-[11px] font-semibold underline opacity-70" onClick={() => { setBanner(null); window.history.replaceState({}, '', '/general-settings/email-accounts') }}>
                Dismiss
              </button>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Gmail */}
            <Card className="relative flex min-w-0 flex-col overflow-hidden p-0">
              <div className="h-1 w-full bg-[#EA4335]" />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Logo provider="gmail" />
                    <div>
                      <div className="text-[13.5px] font-semibold tracking-[-0.01em]">Gmail</div>
                      <div className="text-[11px] text-muted">Google Workspace · OAuth 2.0</div>
                    </div>
                  </div>
                  <Badge tone={gmail.connected ? 'good' : gmail.configured ? 'default' : 'warn'}>
                    {gmail.connected ? 'Connected' : gmail.status === 'reauth_required' ? 'Reconnect needed' : gmail.configured ? 'Not connected' : 'Setup needed'}
                  </Badge>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-muted">{gmail.description}</p>

                {gmail.connected ? (
                  <>
                    <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
                        <Mail size={12} className="text-[#EA4335]" />
                        {gmail.account}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                        <Clock size={11} />
                        {gmail.lastSync ? `Last sync ${formatDateTime(gmail.lastSync)}` : 'Not synchronised yet'}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Inbox', value: gmail.counts?.inbox ?? 0, icon: <Inbox size={12} /> },
                        { label: 'Sent', value: gmail.counts?.sent ?? 0, icon: <Send size={12} /> },
                        { label: 'Synced', value: gmail.sync?.messagesSynced ?? 0, icon: <RefreshCw size={12} /> },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-lg border border-line px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1 text-faint">{stat.icon}</div>
                          <div className="mt-0.5 text-[13px] font-semibold tabular-nums">{stat.value}</div>
                          <div className="text-[10px] uppercase tracking-wide text-faint">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {gmail.sync?.status === 'error' && gmail.sync.lastError ? (
                      <p className="mt-2.5 rounded-lg border border-danger/20 bg-danger-soft px-2.5 py-2 text-[11px] leading-snug text-danger">{gmail.sync.lastError}</p>
                    ) : gmail.lastSync === null ? (
                      <p className="mt-2.5 text-[11px] leading-snug text-muted">Connected. Run the first sync to import recent inbox and sent mail.</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    {gmail.status === 'reauth_required' && gmail.note ? (
                      <p className="mt-3 rounded-lg border border-warn/25 bg-warn-soft px-2.5 py-2 text-[11px] leading-snug text-warn">{gmail.note}</p>
                    ) : null}
                    <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted">
                      <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-good" /> Inbox and sent synchronisation</div>
                      <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-good" /> Send as your own address</div>
                      <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-good" /> Attachments and threads</div>
                    </div>
                  </>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                  {gmail.connected ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => void sync()} loading={busy === 'sync'} disabled={!canSync}>
                        <RefreshCw size={12} /> Sync now
                      </Button>
                      <Link to="/sales/inbox">
                        <Button size="sm">
                          <Inbox size={12} /> Open inbox
                        </Button>
                      </Link>
                      <Link to="/settings/apps/gmail">
                        <Button size="sm">Manage account</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => void disconnect()} loading={busy === 'disconnect'} disabled={!canManage}>
                        <Unplug size={12} /> Disconnect
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!canManage}
                        onClick={() => window.location.assign('/api/integrations/google/connect?returnTo=/general-settings/email-accounts')}
                      >
                        {gmail.status === 'reauth_required' ? 'Reconnect Gmail' : 'Connect Gmail'} <ArrowRight size={12} />
                      </Button>
                      <Link to="/settings/apps/gmail">
                        <Button size="sm" variant="ghost">Details</Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* Microsoft */}
            <Card className="flex min-w-0 flex-col overflow-hidden p-0">
              <div className="h-1 w-full bg-[#0F6CBD]" />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Logo provider="microsoft365" />
                    <div>
                      <div className="text-[13.5px] font-semibold tracking-[-0.01em]">Microsoft Outlook</div>
                      <div className="text-[11px] text-muted">Microsoft 365 · Graph API</div>
                    </div>
                  </div>
                  <Badge tone={data.accounts[1].connected ? 'good' : data.accounts[1].configured ? 'default' : 'warn'}>
                    {data.accounts[1].connected ? 'Connected' : data.accounts[1].configured ? 'Not connected' : 'Setup needed'}
                  </Badge>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">Connect a Microsoft 365 mailbox to read and send mail through Microsoft Graph.</p>
                {data.accounts[1].connected ? (
                  <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[11.5px] font-semibold">{data.accounts[1].account}</div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-[11px] leading-relaxed text-muted">
                    {data.accounts[1].configured ? 'Ready to connect with your Microsoft tenant.' : 'Requires MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET as Worker secrets.'}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-1.5 pt-4">
                  {data.accounts[1].connected ? (
                    <Button size="sm" variant="ghost" disabled>Managed by Microsoft 365</Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canManage}
                      onClick={() => window.location.assign('/api/integrations/microsoft365/connect?returnTo=/general-settings/email-accounts')}
                    >
                      Connect Outlook <ArrowRight size={12} />
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* IMAP */}
            <Card className="flex min-w-0 flex-col overflow-hidden p-0">
              <div className="h-1 w-full bg-slate-300" />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Logo provider="imap" />
                    <div>
                      <div className="text-[13.5px] font-semibold tracking-[-0.01em]">IMAP mailbox</div>
                      <div className="text-[11px] text-muted">Any provider · relay required</div>
                    </div>
                  </div>
                  <Badge tone="warn">Unavailable</Badge>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">Bring your own mailbox over IMAP and SMTP.</p>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-warn/25 bg-warn-soft px-3 py-2.5 text-[11px] leading-relaxed text-warn">
                  <Server size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Cloudflare Workers cannot open raw TCP IMAP sockets. This card stays disabled until an IMAP/SMTP relay is configured
                    (<span className="font-mono">IMAP_RELAY_URL</span>). Nothing is simulated.
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-1.5 pt-4">
                  <Button size="sm" disabled>Not available</Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Gmail setup / status panel */}
          <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Card className="min-w-0 p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <h3 className="text-[13px] font-semibold">Google OAuth configuration</h3>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {gmail.configured ? 'Client credentials are present on this deployment.' : 'Two Worker secrets are missing, so Google sign-in cannot start.'}
                  </p>
                </div>
                <Badge tone={gmail.configured ? 'good' : 'warn'}>{gmail.configured ? 'Configured' : 'Not configured'}</Badge>
              </div>
              <div className="space-y-3 px-4 py-3.5">
                <div className="flex flex-wrap gap-1.5">
                  {['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_OAUTH_STATE_SECRET', 'APP_BASE_URL'].map((name) => (
                    <span
                      key={name}
                      className={cx(
                        'rounded-md border px-2 py-1 font-mono text-[10.5px]',
                        gmail.missing?.includes(name) ? 'border-warn/30 bg-warn-soft text-warn' : 'border-line bg-surface-2 text-muted',
                      )}
                    >
                      {name}
                    </span>
                  ))}
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Authorised redirect URI</div>
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-ink">{gmail.redirectUri}</code>
                    <button
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-accent hover:bg-accent-soft"
                      onClick={() => {
                        void navigator.clipboard.writeText(gmail.redirectUri ?? '')
                        toast('Redirect URI copied.', 'good')
                      }}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                    Paste this exact value into Google Cloud Console → APIs &amp; Services → Credentials → OAuth client → Authorised redirect URIs.
                    It must match character for character.
                  </p>
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Scopes requested</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(gmail.scopes ?? []).map((scope) => (
                      <span key={scope} className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-[10.5px] text-muted">{scope}</span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                    Read-only inbox access plus send. GoFox never requests <span className="font-mono">gmail.modify</span> and cannot delete your mail.
                  </p>
                </div>

                {!gmail.configured ? (
                  <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
                    <div className="mb-1 font-semibold text-ink">What to do</div>
                    <ol className="list-decimal space-y-1 pl-4">
                      <li>Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console.</li>
                      <li>Enable the Gmail API on the project.</li>
                      <li>Add the redirect URI above.</li>
                      <li>Add <span className="font-mono">GOOGLE_CLIENT_ID</span> and <span className="font-mono">GOOGLE_CLIENT_SECRET</span> as Worker secrets for this site, then reload this page.</li>
                    </ol>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="min-w-0 p-0">
              <div className="border-b border-line px-4 py-3">
                <h3 className="text-[13px] font-semibold">Synchronisation</h3>
                <p className="mt-0.5 text-[11.5px] text-muted">Gmail history-based incremental sync with a bounded first import.</p>
              </div>
              <div className="space-y-2.5 px-4 py-3.5 text-[12px]">
                <Row label="Status" value={<Badge tone={gmail.sync?.status === 'error' ? 'danger' : gmail.connected ? 'good' : 'default'}>{gmail.sync?.status ?? 'idle'}</Badge>} />
                <Row label="Messages stored" value={<span className="font-semibold tabular-nums">{totalMessages}</span>} />
                <Row label="Last sync" value={gmail.lastSync ? formatDateTime(gmail.lastSync) : '—'} />
                <Row label="History checkpoint" value={<span className="font-mono text-[10.5px]">{gmail.sync?.historyId ?? 'not set'}</span>} />
                <Row label="Backlog" value={gmail.sync?.cursor ? 'More messages available' : 'Caught up'} />
                <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0 text-good" />
                  Tokens are stored in D1 server-side and refreshed automatically. Refresh tokens are never sent to the browser.
                </div>
                {gmail.connected ? (
                  <Button size="sm" className="w-full" onClick={() => void sync()} loading={busy === 'sync'} disabled={!canSync}>
                    <RefreshCw size={12} /> Run synchronisation
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>

          <p className="mt-4 text-center text-[11px] text-faint">
            Email accounts are workspace-scoped. Mail synchronised from Gmail is stored in this workspace's D1 database and is only visible to members with inbox access.
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/70 pb-2 last:border-0">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="text-right text-[11.5px] text-ink">{value}</span>
    </div>
  )
}
