import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type RouterValue = {
  path: string
  navigate: (to: string, options?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterValue>({ path: '/', navigate: () => {} })

export function RouterProvider({ children }: { children: ReactNode }) {
  // Route matching is pathname-only. Keeping the query string here made every redirect that
  // carries a result flag (e.g. ?connected=gmail) fall through to the 404 route.
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const next = to.startsWith('/') ? to : `/${to}`
    if (next === window.location.pathname + window.location.search) return
    if (options?.replace) window.history.replaceState({}, '', next)
    else window.history.pushState({}, '', next)
    setPath(next.split('?')[0])
    window.scrollTo({ top: 0 })
  }, [])

  const value = useMemo(() => ({ path, navigate }), [path, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  return useContext(RouterContext)
}

export function useNavigate() {
  return useContext(RouterContext).navigate
}

export function usePath() {
  return useContext(RouterContext).path
}

export function Link({
  to,
  children,
  className,
  onClick,
  ...rest
}: {
  to: string
  children: ReactNode
  className?: string
  onClick?: () => void
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  const navigate = useNavigate()
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onClick?.()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

/** Matches `/contacts/:id` style patterns and returns the params. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i]
    const actual = pathParts[i]
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual)
    else if (expected !== actual) return null
  }
  return params
}
