import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, get, patch, post, type Row } from './api'
import {
  type ThemeConfig,
  applyThemeToDom,
  loadSavedThemeConfig,
  saveThemeConfig,
} from './theme'
import {
  type LocaleCode,
  applyLocaleToDom,
  getSavedLocale,
  saveLocale,
  translate,
} from './i18n'

export type Me = {
  id: string
  email: string
  name: string
  role: 'owner' | 'admin' | 'manager' | 'sales' | 'marketer' | 'support'
  title: string | null
  avatar_hue: number
  avatar_url?: string | null
  photo_url?: string | null
  theme: 'light' | 'dark'
  locale: string
  timezone: string | null
  org_name: string
  currency: string
  org_timezone: string
}

export type FieldSchema = {
  key: string
  label: string
  type?: string
  options?: string[]
  required?: boolean
  ref?: string
  half?: boolean
  placeholder?: string
}

export type EntitySchema = {
  table: string
  label: string
  singular: string
  module: string
  permission: string
  list: string[]
  fields: FieldSchema[]
  filters: string[]
  sort: string
  dir: 'asc' | 'desc'
  detailPath: string | null
  softDelete: boolean
}

export type Permissions = {
  role: string
  canWriteCrm: boolean
  canWriteMarketing: boolean
  canWriteSales: boolean
  canWriteSupport: boolean
  canWriteFinance: boolean
  canManageSettings: boolean
  canManageUsers: boolean
  canDelete: boolean
  canExport: boolean
  canReadAudit: boolean
}

export type Meta = {
  users: Row[]
  companies: Row[]
  contacts: Row[]
  stages: Row[]
  pipelines: Row[]
  lists: Row[]
  templates: Row[]
  forms: Row[]
  deals: Row[]
  products: Row[]
  sla: Row[]
  sequences: Row[]
  documents: Row[]
  currentUser: Me
  permissions: Permissions
}

export type Toast = { id: number; message: string; tone: 'info' | 'good' | 'bad' }

type AppValue = {
  me: Me | null
  meta: Meta | null
  schema: Record<string, EntitySchema>
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithToken: (idToken: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  refreshMeta: () => Promise<void>
  toast: (message: string, tone?: Toast['tone']) => void
  toasts: Toast[]
  dismiss: (id: number) => void
  notifications: Row[]
  unread: number
  refreshNotifications: () => Promise<void>
  markRead: (id?: string) => Promise<void>
  toggleTheme: () => Promise<void>
  dark: boolean
  themeConfig: ThemeConfig
  updateThemeConfig: (partial: Partial<ThemeConfig>) => void
  locale: LocaleCode
  updateLocale: (code: LocaleCode) => void
  t: (key: string, fallback?: string) => string
}

const AppContext = createContext<AppValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [schema, setSchema] = useState<Record<string, EntitySchema>>({})
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [notifications, setNotifications] = useState<Row[]>([])
  const [themeConfig, setThemeConfigState] = useState<ThemeConfig>(() => loadSavedThemeConfig())
  const [locale, setLocaleState] = useState<LocaleCode>(() => getSavedLocale())
  const toastId = useRef(0)
  const sessionChecked = useRef(false)

  // Initialize theme and locale on DOM mount
  useEffect(() => {
    applyThemeToDom(themeConfig)
    applyLocaleToDom(locale)
  }, [themeConfig, locale])

  const updateThemeConfig = useCallback((partial: Partial<ThemeConfig>) => {
    setThemeConfigState((curr) => {
      const next: ThemeConfig = { ...curr, ...partial }
      applyThemeToDom(next)
      saveThemeConfig(next)
      return next
    })
  }, [])

  const updateLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code)
    saveLocale(code)
    applyLocaleToDom(code)
    setMe((curr) => (curr ? { ...curr, locale: code } : curr))
  }, [])

  const t = useCallback((key: string, fallback?: string) => {
    return translate(key, locale, fallback)
  }, [locale])

  const toast = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastId.current
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4600)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const applyTheme = useCallback((theme: string) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('gofox:theme', theme)
    } catch {
      /* storage may be blocked; the server preference still wins */
    }
  }, [])

  const refreshMeta = useCallback(async () => {
    try {
      const data = await get<Meta>('/api/meta')
      setMeta(data)
      setMe((current) => current ?? data.currentUser)
    } catch {
      setMeta(null)
    }
  }, [])

  const refreshSchema = useCallback(async () => {
    try {
      const data = await get<{ schema: Record<string, EntitySchema> }>('/api/schema')
      setSchema(data.schema)
    } catch {
      setSchema({})
    }
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const data = await get<{ user: Me }>('/api/auth/me')
      setMe(data.user)
      applyTheme(data.user.theme)
    } catch {
      setMe(null)
    }
  }, [applyTheme])

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await get<{ data: Row[]; unread: number }>('/api/notifications')
      setNotifications(data.data)
    } catch {
      /* notifications are non-critical */
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await get<{ user: Me }>('/api/auth/me')
        if (!alive) return
        setMe(data.user)
        applyTheme(data.user.theme)
        await Promise.all([refreshMeta(), refreshSchema(), refreshNotifications()])
        if (!sessionChecked.current) {
          sessionChecked.current = true
          const key = `gofox:tick:${data.user.id}`
          if (sessionStorage.getItem(key) !== 'done') {
            sessionStorage.setItem(key, 'done')
            post('/api/scheduler/tick').catch(() => undefined)
          }
        }
      } catch {
        if (alive) setMe(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [applyTheme, refreshMeta, refreshSchema, refreshNotifications])

  useEffect(() => {
    const onUnauthorized = () => {
      setMe(null)
      setMeta(null)
    }
    window.addEventListener('gofox:unauthorized', onUnauthorized)
    return () => window.removeEventListener('gofox:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await post<{ user: Me }>('/api/auth/login', { email, password })
      setMe(data.user)
      applyTheme(data.user.theme)
      await Promise.all([refreshMeta(), refreshSchema(), refreshNotifications()])
      post('/api/scheduler/tick').catch(() => undefined)
    },
    [applyTheme, refreshMeta, refreshSchema, refreshNotifications],
  )

  const loginWithToken = useCallback(
    async (idToken: string) => {
      const data = await post<{ user: Me }>('/api/auth/firebase', { idToken })
      setMe(data.user)
      applyTheme(data.user.theme)
      await Promise.all([refreshMeta(), refreshSchema(), refreshNotifications()])
      post('/api/scheduler/tick').catch(() => undefined)
    },
    [applyTheme, refreshMeta, refreshSchema, refreshNotifications],
  )

  const logout = useCallback(async () => {
    await post('/api/auth/logout').catch(() => undefined)
    setMe(null)
    setMeta(null)
  }, [])

  const markRead = useCallback(async (id?: string) => {
    await post('/api/notifications/read', id ? { id } : {}).catch(() => undefined)
    setNotifications((current) =>
      current.map((n) => (id ? (n.id === id ? { ...n, read_at: new Date().toISOString() } : n) : { ...n, read_at: n.read_at ?? new Date().toISOString() })),
    )
  }, [])

  const toggleTheme = useCallback(async () => {
    const next = themeConfig.mode === 'dark' ? 'light' : 'dark'
    updateThemeConfig({ mode: next })
    if (me) {
      setMe({ ...me, theme: next })
      try {
        await patch('/api/auth/profile', { theme: next })
      } catch (error) {
        toast(error instanceof ApiError ? error.message : 'Could not save the theme preference', 'bad')
      }
    }
  }, [me, themeConfig.mode, updateThemeConfig, toast])

  const unread = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications])

  const value = useMemo<AppValue>(
    () => ({
      me,
      meta,
      schema,
      loading,
      login,
      loginWithToken,
      logout,
      refreshMe,
      refreshMeta,
      toast,
      toasts,
      dismiss,
      notifications,
      unread,
      refreshNotifications,
      markRead,
      toggleTheme,
      dark: themeConfig.mode === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')),
      themeConfig,
      updateThemeConfig,
      locale,
      updateLocale,
      t,
    }),
    [me, meta, schema, loading, login, loginWithToken, logout, refreshMe, refreshMeta, toast, toasts, dismiss, notifications, unread, refreshNotifications, markRead, toggleTheme, themeConfig, updateThemeConfig, locale, updateLocale, t],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}

type FetchState<T> = { data: T | null; loading: boolean; error: ApiError | null; reload: () => void }

export function useFetch<T = any>(path: string | null, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState<ApiError | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!path) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    get<T>(path)
      .then((result) => {
        if (alive) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err: ApiError) => {
        if (alive) {
          setError(err)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps])

  return { data, loading, error, reload: () => setNonce((n) => n + 1) }
}

export function labelFor(meta: Meta | null, ref: string | undefined, id: unknown): string {
  if (!meta || !ref || !id) return ''
  const list = (meta as unknown as Record<string, Row[]>)[ref] ?? []
  const row = list.find((item) => item.id === id)
  if (!row) return ''
  if (ref === 'contacts') return `${row.first_name} ${row.last_name ?? ''}`.trim()
  return String(row.name ?? row.number ?? row.id)
}

export function useRefOptions(ref: string | undefined): { value: string; label: string }[] {
  const { meta } = useApp()
  return useMemo(() => {
    if (!meta || !ref) return []
    const list = (meta as unknown as Record<string, Row[]>)[ref] ?? []
    return list.map((row) => ({
      value: String(row.id),
      label: ref === 'contacts' ? `${row.first_name} ${row.last_name ?? ''}`.trim() : String(row.name ?? row.number ?? row.id),
    }))
  }, [meta, ref])
}
