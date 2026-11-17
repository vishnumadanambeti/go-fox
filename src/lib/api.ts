export type Row = Record<string, any>

export class ApiError extends Error {
  code: string
  status: number
  fields?: Record<string, string>

  constructor(message: string, code: string, status: number, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = fields
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function api<T = any>(path: string, options: Options = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {},
    signal: options.signal,
  }
  if (options.body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(options.body)
  }
  const response = await fetch(path, init)
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok) {
    let payload: any = null
    if (contentType.includes('application/json')) payload = await response.json().catch(() => null)
    const error = new ApiError(
      (payload as any)?.error?.message ?? `Request failed (${response.status})`,
      (payload as any)?.error?.code ?? 'HTTP_ERROR',
      response.status,
      (payload as any)?.error?.fields,
    )
    if (response.status === 401 && !path.startsWith('/api/auth/login')) {
      window.dispatchEvent(new CustomEvent('gofox:unauthorized'))
    }
    throw error
  }
  if (contentType.includes('application/json')) return (await response.json()) as T
  return (await response.text()) as unknown as T
}

export const get = <T = any>(path: string) => api<T>(path)
export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body })
export const patch = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body })
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' })

export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export async function downloadCsv(entity: string) {
  const response = await fetch(`/api/export/${entity}`, { credentials: 'same-origin' })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError((payload as any)?.error?.message ?? 'Export failed', (payload as any)?.error?.code ?? 'HTTP_ERROR', response.status)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
