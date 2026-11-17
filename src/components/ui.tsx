import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X, Check, AlertTriangle, Loader2, Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { initials, toneForStatus, titleCase } from '../lib/format'
import { useApp } from '../lib/app-context'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ buttons */
export function Button({
  children,
  variant = 'default',
  size = 'md',
  loading,
  className,
  ...rest
}: {
  children: ReactNode
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        'gx-btn',
        variant === 'primary' && 'gx-btn-primary',
        variant === 'ghost' && 'gx-btn-ghost',
        variant === 'danger' && 'gx-btn-danger',
        size === 'sm' && 'gx-btn-sm',
        className,
      )}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  children,
  label,
  className,
  ...rest
}: { children: ReactNode; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx('gx-icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------- badge */
export function StatusBadge({ value, className }: { value: unknown; className?: string }) {
  const tone = toneForStatus(value)
  return (
    <span
      className={cx(
        'gx-badge',
        tone === 'good' && 'gx-badge-good',
        tone === 'warn' && 'gx-badge-warn',
        tone === 'danger' && 'gx-badge-danger',
        tone === 'info' && 'gx-badge-info',
        className,
      )}
    >
      {titleCase(value) || '—'}
    </span>
  )
}

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'good' | 'warn' | 'danger' | 'info'; className?: string }) {
  return (
    <span
      className={cx(
        'gx-badge',
        className,
        tone === 'accent' && 'gx-badge-accent',
        tone === 'good' && 'gx-badge-good',
        tone === 'warn' && 'gx-badge-warn',
        tone === 'danger' && 'gx-badge-danger',
        tone === 'info' && 'gx-badge-info',
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ avatars */
const HUES = [22, 205, 325, 150, 265, 45]
export function Avatar({ name, hue, size = 28 }: { name: unknown; hue?: number; size?: number }) {
  const color = hue ?? HUES[String(name ?? '').length % HUES.length]
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${color} 82% 92%)`,
        color: `hsl(${color} 55% 32%)`,
      }}
      title={String(name ?? '')}
    >
      {initials(name)}
    </span>
  )
}

/* -------------------------------------------------------------------- cards */
export function Card({ children, className, ...rest }: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('gx-card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icon ?? <Inbox size={20} />}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('gx-skeleton', className)} />
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cx('h-3.5', c === 0 ? 'w-40' : 'w-24')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <AlertTriangle size={20} className="text-danger" />
      <p className="text-[13px] text-muted">{message}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------- modal */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <>
      <div className="gx-scrim" onClick={onClose} />
      <div className="gx-modal" role="dialog" aria-modal="true" aria-label={title} style={{ width: wide ? 'min(720px, calc(100vw - 32px))' : undefined }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto gx-scroll px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
      </div>
    </>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
  dirty,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  dirty?: boolean
}) {
  useEscape(open, () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  })
  if (!open) return null
  return (
    <>
      <div
        className="gx-scrim"
        onClick={() => {
          if (dirty && !window.confirm('Discard your unsaved changes?')) return
          onClose()
        }}
      />
      <aside className={cx('gx-drawer', wide && 'gx-drawer-wide')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <IconButton
            label="Close"
            onClick={() => {
              if (dirty && !window.confirm('Discard your unsaved changes?')) return
              onClose()
            }}
          >
            <X size={16} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto gx-scroll px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
      </aside>
    </>
  )
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onClose])
}

/* -------------------------------------------------------------------- tabs */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={cx('flex flex-wrap items-center gap-5 border-b border-line px-1', className)}>
      {tabs.map((tab) => (
        <button key={tab.key} className="gx-tab flex items-center gap-1.5" data-active={active === tab.key} onClick={() => onChange(tab.key)}>
          {tab.label}
          {tab.count !== undefined ? <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- form bits */
export function FormRow({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        {hint ? <span className="text-[10.5px] text-faint">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11.5px] text-danger">{error}</span> : null}
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
      <input className="gx-input gx-input-icon" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ?? 'Search…'} />
    </div>
  )
}

/* -------------------------------------------------------------- pagination */
export function Pagination({
  page,
  limit,
  total,
  onPage,
  onLimit,
}: {
  page: number
  limit: number
  total: number
  onPage: (page: number) => void
  onLimit: (limit: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap">
          {total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`} of {total}
        </span>
        <select className="gx-select w-auto py-1 text-xs" value={limit} onChange={(event) => onLimit(Number(event.target.value))} aria-label="Rows per page">
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeft size={15} />
        </IconButton>
        <span className="hidden px-2 whitespace-nowrap sm:inline">
          Page {page} of {pages}
        </span>
        <IconButton label="Next page" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>
          <ChevronRight size={15} />
        </IconButton>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ toasts */
export function Toasts() {
  const { toasts, dismiss } = useApp()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="gx-toast gx-fade flex items-center gap-2">
          {toast.tone === 'good' ? <Check size={14} /> : toast.tone === 'bad' ? <AlertTriangle size={14} /> : null}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => dismiss(toast.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- dropdown */
export function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open ? (
        <div
          className={cx(
            'gx-card absolute z-50 mt-1.5 min-w-[190px] overflow-hidden p-1 shadow-[var(--shadow-pop)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  )
}

export function MenuItem({ children, onClick, tone }: { children: ReactNode; onClick?: () => void; tone?: 'danger' }) {
  return (
    <button
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-2',
        tone === 'danger' ? 'text-danger' : 'text-ink',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------- page header */
export function PageHeader({
  title,
  subtitle,
  children,
  breadcrumb,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  breadcrumb?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        {breadcrumb}
        <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted">
      <Loader2 size={16} className="animate-spin" />
      {label ?? 'Loading'}
    </div>
  )
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'good' | 'danger' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: tone === 'good' ? 'var(--color-good)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--color-accent)',
        }}
      />
    </div>
  )
}

const KPI_ACCENTS: Record<string, string> = {
  accent: 'var(--color-accent)',
  good: 'var(--color-good)',
  danger: 'var(--color-danger)',
  info: '#1d4ed8',
  teal: 'var(--color-teal)',
  purple: 'var(--color-purple)',
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'accent' | 'good' | 'danger' | 'info' | 'teal' | 'purple'
  icon?: ReactNode
}) {
  return (
    <div className="gx-kpi" style={{ '--kpi-accent': KPI_ACCENTS[tone ?? 'accent'] } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint">{label}</span>
        {icon ? (
          <span
            className="flex size-7 items-center justify-center rounded-lg"
            style={{
              background:
                tone === 'good' ? 'var(--color-good-soft)' : tone === 'danger' ? 'var(--color-danger-soft)' : tone === 'info' ? 'var(--color-info-soft)' : 'var(--color-accent-soft)',
              color: tone === 'good' ? 'var(--color-good)' : tone === 'danger' ? 'var(--color-danger)' : tone === 'info' ? 'var(--color-info)' : 'var(--color-accent)',
            }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-[11.5px] text-muted">{hint}</div> : null}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-muted">{message}</p>
    </Modal>
  )
}
