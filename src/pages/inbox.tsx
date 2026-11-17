import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  AtSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  Paperclip,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings2,
  X,
} from 'lucide-react'
import { get, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link } from '../lib/router'
import { Button, Card, ErrorState, Modal, PageHeader, Spinner, cx } from '../components/ui'
import { formatDateTime } from '../lib/format'

type Message = {
  id: string
  provider_message_id: string
  thread_id: string
  folder: string
  from_email: string
  from_name: string
  to_emails: string
  cc_emails: string
  subject: string
  snippet: string
  has_attachments: number
  unread: number
  received_at: string
}

type Detail = Message & {
  body_html: string
  body_text: string
  attachments: string
  direction: string
  account: string
}

type Attachment = { id: string; filename: string; mimeType: string; size: number }
type DraftAttachment = { filename: string; mimeType: string; content: string; size: number }

function parseList(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  try {
    const parsed = JSON.parse(String(raw))
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function displayName(message: { from_name?: string; from_email?: string }) {
  return message.from_name || message.from_email || 'Unknown sender'
}

export function InboxPage() {
  const { toast } = useApp()
  const accounts = useFetch<{ accounts: Row[] }>('/api/email/accounts')
  const gmail = accounts.data?.accounts.find((account) => account.provider === 'gmail')
  const connected = Boolean(gmail?.connected)
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 30
  const list = useFetch<{ data: Message[]; total: number }>(
    `/api/email/messages?folder=${folder}&limit=${pageSize}&offset=${page * pageSize}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`,
  )
  const [selected, setSelected] = useState<Message | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [compose, setCompose] = useState<null | { to?: string; subject?: string }>(null)
  const [syncing, setSyncing] = useState(false)

  const refresh = () => {
    list.reload()
    accounts.reload()
  }

  const open = async (message: Message) => {
    setSelected(message)
    setDetail(null)
    setDetailLoading(true)
    try {
      const result = await get<{ message: Detail }>(`/api/email/messages/${message.id}`)
      setDetail(result.message)
      list.reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not open that message.', 'bad')
    } finally {
      setDetailLoading(false)
    }
  }

  const sync = async () => {
    setSyncing(true)
    try {
      const result = await post<{ message: string }>('/api/email/gmail/sync', {})
      toast(result.message || 'Mailbox synchronised.', 'good')
      refresh()
    } catch (err: any) {
      toast(err?.message ?? 'Sync failed.', 'bad')
      refresh()
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    setPage(0)
  }, [folder, query])

  const messages = list.data?.data ?? []
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Inbox"
        subtitle={connected ? `${gmail?.account} · ${gmail?.counts?.inbox ?? 0} inbox · ${gmail?.counts?.sent ?? 0} sent` : 'Connect a mailbox to synchronise real email'}
      >
        {connected ? (
          <>
            <Button size="sm" onClick={() => void sync()} loading={syncing}>
              <RefreshCw size={13} /> Sync now
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCompose({})}>
              <Send size={13} /> Compose
            </Button>
          </>
        ) : (
          <Link to="/settings/email-accounts">
            <Button size="sm" variant="primary">
              <Settings2 size={13} /> Connect a mailbox
            </Button>
          </Link>
        )}
      </PageHeader>

      {!connected ? (
        <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
          <Card className="mx-auto max-w-lg p-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Inbox size={22} /></span>
            <h2 className="mt-3 text-[16px] font-semibold">No mailbox connected</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
              Connect Gmail to read inbox and sent mail inside GoFox and send as your own address. Nothing is pre-filled or simulated — this list stays empty until Google authorises the connection.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/settings/email-accounts"><Button size="sm" variant="primary">Open email accounts</Button></Link>
              <Link to="/settings/apps"><Button size="sm">Integration marketplace</Button></Link>
            </div>
            {gmail && !gmail.configured ? (
              <p className="mx-auto mt-4 max-w-sm rounded-lg border border-warn/25 bg-warn-soft px-3 py-2 text-[11.5px] leading-relaxed text-warn">
                Google OAuth is not configured on this deployment yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Email accounts to enable the Connect button.
              </p>
            ) : null}
          </Card>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
                {(['inbox', 'sent'] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => { setFolder(value); setSelected(null); setDetail(null) }}
                    className={cx('rounded-md px-2.5 py-1 text-[11.5px] font-semibold capitalize', folder === value ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted')}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="relative min-w-0 flex-1">
                <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail" className="gx-input gx-input-sm gx-input-icon" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto gx-scroll">
              {list.loading && !messages.length ? (
                <div className="p-6"><Spinner label="Loading mail" /></div>
              ) : list.error ? (
                <ErrorState message={list.error.message} onRetry={list.reload} />
              ) : messages.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Mail size={22} className="mx-auto text-faint" />
                  <p className="mt-2 text-[12.5px] font-medium">{folder === 'inbox' ? 'Inbox is empty' : 'No sent mail yet'}</p>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {query.trim() ? 'No messages match that search.' : 'Run a synchronisation from Email accounts, or send your first email.'}
                  </p>
                  <Button size="sm" className="mt-3" onClick={() => void sync()} loading={syncing}><RefreshCw size={12} /> Sync</Button>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {messages.map((message) => (
                    <li key={message.id}>
                      <button
                        onClick={() => void open(message)}
                        className={cx(
                          'flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left transition hover:bg-surface-2',
                          selected?.id === message.id && 'bg-accent-soft/50',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {Number(message.unread) ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                          <span className={cx('min-w-0 flex-1 truncate text-[12px]', Number(message.unread) ? 'font-semibold text-ink' : 'text-ink')}>
                            {folder === 'sent' ? `To ${parseList(message.to_emails).join(', ') || 'recipient'}` : displayName(message)}
                          </span>
                          <span className="shrink-0 text-[10px] text-faint">{formatDateTime(message.received_at)}</span>
                        </div>
                        <div className="truncate text-[11.5px] text-ink">{message.subject || '(no subject)'}</div>
                        <div className="flex items-center gap-1">
                          <span className="line-clamp-1 flex-1 text-[11px] text-muted">{message.snippet}</span>
                          {Number(message.has_attachments) ? <Paperclip size={10} className="shrink-0 text-faint" /> : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {total > pageSize ? (
              <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11px] text-muted">
                <span>{page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}</span>
                <div className="flex items-center gap-1">
                  <button className="rounded p-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={14} /></button>
                  <span className="tabular-nums">{page + 1}/{pages}</span>
                  <button className="rounded p-1 disabled:opacity-40" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={14} /></button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 overflow-auto gx-scroll bg-surface-2/40">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-faint"><AtSign size={22} /></span>
                <p className="text-[13px] font-medium">Select a message to read it</p>
                <p className="max-w-xs text-[11.5px] text-muted">Messages are fetched from Gmail. Opening one marks it read in GoFox without changing Gmail.</p>
              </div>
            ) : detailLoading ? (
              <Spinner label="Opening message" />
            ) : detail ? (
              <article className="mx-auto w-full max-w-3xl p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">{detail.subject || '(no subject)'}</h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                      <span className="font-medium text-ink">{detail.from_name || detail.from_email}</span>
                      <span>&lt;{detail.from_email}&gt;</span>
                      <span>· {formatDateTime(detail.received_at)}</span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-faint">
                      To {parseList(detail.to_emails).join(', ') || 'you'}
                      {parseList(detail.cc_emails).length ? ` · Cc ${parseList(detail.cc_emails).join(', ')}` : ''}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setCompose({ to: detail.from_email, subject: `Re: ${detail.subject}` })}
                  >
                    <Reply size={13} /> Reply
                  </Button>
                </div>

                {(() => {
                  const attachments = parseAttachments(detail.attachments)
                  return attachments.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={`/api/email/messages/${detail.id}/attachments/${attachment.id}`}
                          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] hover:border-accent/40"
                        >
                          <Paperclip size={12} className="text-accent" />
                          <span className="max-w-[180px] truncate">{attachment.filename}</span>
                          <span className="text-faint">{Math.round(attachment.size / 1024)} KB</span>
                        </a>
                      ))}
                    </div>
                  ) : null
                })()}

                <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
                  <iframe
                    title="Message body"
                    sandbox=""
                    srcDoc={detail.body_html || `<pre style="font-family:Arial;font-size:13px;line-height:1.7;white-space:pre-wrap;padding:20px;color:#344054">${(detail.body_text || detail.snippet || '').replace(/</g, '&lt;')}</pre>`}
                    className="h-[520px] w-full border-0"
                  />
                </div>
              </article>
            ) : (
              <ErrorState message="Message could not be loaded." />
            )}
          </div>
        </div>
      )}

      <ComposeModal
        open={Boolean(compose)}
        initial={compose ?? {}}
        onClose={() => setCompose(null)}
        onSent={() => {
          setCompose(null)
          refresh()
          toast('Email sent through Gmail.', 'good')
        }}
      />
    </div>
  )
}

function parseAttachments(raw: unknown): Attachment[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? (parsed as Attachment[]) : []
  } catch {
    return []
  }
}

function ComposeModal({
  open,
  initial,
  onClose,
  onSent,
}: {
  open: boolean
  initial: { to?: string; subject?: string }
  onClose: () => void
  onSent: () => void
}) {
  const { toast } = useApp()
  const [to, setTo] = useState(initial.to ?? '')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [html, setHtml] = useState('')
  const [attachments, setAttachments] = useState<DraftAttachment[]>([])
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTo(initial.to ?? '')
    setSubject(initial.subject ?? '')
    setHtml('')
    setCc('')
    setBcc('')
    setAttachments([])
  }, [open, initial.to, initial.subject])

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const next: DraftAttachment[] = []
    for (const file of Array.from(files).slice(0, 5 - attachments.length)) {
      if (file.size > 6 * 1024 * 1024) {
        toast(`${file.name} is larger than 6 MB and was skipped.`, 'bad')
        continue
      }
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      next.push({ filename: file.name, mimeType: file.type || 'application/octet-stream', content, size: file.size })
    }
    setAttachments((current) => [...current, ...next])
  }

  const send = async () => {
    if (!to.trim()) {
      toast('Add at least one recipient.', 'bad')
      return
    }
    setSending(true)
    try {
      await post('/api/email/send', {
        to,
        cc: showCc ? cc : '',
        bcc: showCc ? bcc : '',
        subject,
        html: html
          ? html.includes('<') ? html : `<p>${html.replace(/\n/g, '<br>')}</p>`
          : `<p>${html.replace(/\n/g, '<br>')}</p>`,
        text: html.replace(/<[^>]+>/g, ''),
        attachments: attachments.map(({ filename, mimeType, content }) => ({ filename, mimeType, content })),
      })
      onSent()
    } catch (err: any) {
      toast(err?.message ?? 'Gmail rejected the message.', 'bad')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      wide
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-[11px] text-muted">
            <Mail size={12} /> Sent through your connected Gmail account
          </span>
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" loading={sending} onClick={() => void send()}>
            <Send size={13} /> Send
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <span className="w-12 text-[11.5px] text-muted">To</span>
          <input value={to} onChange={(event) => setTo(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" placeholder="customer@company.com" />
          <button className="text-[11px] font-medium text-accent" onClick={() => setShowCc((value) => !value)}>{showCc ? 'Hide Cc' : 'Cc/Bcc'}</button>
        </div>
        {showCc ? (
          <>
            <div className="flex items-center gap-2 border-b border-line pb-2">
              <span className="w-12 text-[11.5px] text-muted">Cc</span>
              <input value={cc} onChange={(event) => setCc(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
            </div>
            <div className="flex items-center gap-2 border-b border-line pb-2">
              <span className="w-12 text-[11.5px] text-muted">Bcc</span>
              <input value={bcc} onChange={(event) => setBcc(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
            </div>
          </>
        ) : null}
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <span className="w-12 text-[11.5px] text-muted">Subject</span>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none" placeholder="Subject line" />
        </div>
        <textarea
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          rows={12}
          placeholder={'Hi {{first_name}},\n\nWrite your message… HTML is supported.'}
          className="w-full resize-none bg-transparent px-1 text-[13px] leading-relaxed outline-none"
        />
        {attachments.length ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <span key={`${attachment.filename}-${index}`} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px]">
                <Paperclip size={11} className="text-accent" />
                <span className="max-w-[160px] truncate">{attachment.filename}</span>
                <button onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))} className="text-faint hover:text-danger"><X size={11} /></button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2 pt-1">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => void addFiles(event.target.files)} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={attachments.length >= 5}>
            <Paperclip size={12} /> Attach
          </Button>
          <span className="text-[11px] text-muted">{attachments.length}/5 · max 6 MB each</span>
        </div>
        <p className="rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] text-muted">
          Gmail applies its own sending limits to personal accounts. For bulk campaigns use a dedicated marketing provider.
        </p>
      </div>
    </Modal>
  )
}

export function InboxSidebarLink() {
  return (
    <Link to="/sales/inbox" className="flex items-center gap-2 text-[12px] text-muted hover:text-ink">
      <Inbox size={14} /> Inbox
    </Link>
  )
}

export function InboxEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 text-center">
      <CheckCircle2 size={20} className="mx-auto text-faint" />
      <h3 className="mt-2 text-[13px] font-semibold">{title}</h3>
      <p className="mt-1 text-[11.5px] text-muted">{body}</p>
    </div>
  )
}

export function InboxBack({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1 text-[11.5px] text-muted"><ArrowLeft size={12} /> {children}</span>
}
