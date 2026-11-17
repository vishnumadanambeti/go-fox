export function money(value: unknown, currency = 'USD', compact = false): string {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: compact && Math.abs(amount) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(amount)
}

export function number(value: unknown): string {
  return new Intl.NumberFormat('en-US').format(Number(value ?? 0))
}

export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

export function formatDate(value: unknown, style: 'short' | 'long' | 'day' = 'short'): string {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '—'
  if (style === 'day') return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (style === 'long') {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value: unknown): string {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function timeAgo(value: unknown): string {
  if (!value) return '—'
  const date = new Date(String(value))
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(seconds)) return '—'
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(value)
}

export function dueLabel(value: unknown): { text: string; tone: 'danger' | 'warn' | 'default' } {
  if (!value) return { text: 'No due date', tone: 'default' }
  const date = new Date(String(value))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: 'danger' }
  if (diff === 0) return { text: 'Due today', tone: 'warn' }
  if (diff === 1) return { text: 'Due tomorrow', tone: 'warn' }
  return { text: `Due ${formatDate(value, 'day')}`, tone: 'default' }
}

export function initials(name: unknown): string {
  const text = String(name ?? '').trim()
  if (!text) return '?'
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function titleCase(value: unknown): string {
  return String(value ?? '')
    .replace(/[_.]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function toneForStatus(status: unknown): string {
  const value = String(status ?? '').toLowerCase()
  if (['active', 'won', 'paid', 'sent', 'published', 'connected', 'resolved', 'completed', 'live', 'accepted', 'qualified'].includes(value)) return 'good'
  if (['draft', 'new', 'open', 'pending', 'scheduled', 'in_progress', 'contacted', 'prospect'].includes(value)) return 'info'
  if (['paused', 'warning', 'at_risk', 'overdue', 'medium', 'expired'].includes(value)) return 'warn'
  if (['lost', 'cancelled', 'bounced', 'churned', 'unqualified', 'closed', 'suspended', 'failed', 'urgent', 'high', 'breached'].includes(value)) return 'danger'
  return 'default'
}

export function relativeToNowLabel(value: unknown): string {
  if (!value) return '—'
  const diff = new Date(String(value)).getTime() - Date.now()
  if (Number.isNaN(diff)) return '—'
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 60) return minutes >= 0 ? `in ${minutes}m` : `${Math.abs(minutes)}m ago`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return hours >= 0 ? `in ${hours}h` : `${Math.abs(hours)}h ago`
  const days = Math.round(hours / 24)
  return days >= 0 ? `in ${days}d` : `${Math.abs(days)}d ago`
}
