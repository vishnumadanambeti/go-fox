import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useApp } from '../lib/app-context'
import { ApiError } from '../lib/api'
import { Link } from '../lib/router'
import { Button, FormRow } from '../components/ui'
import { currentAuthHost, firebaseConfig, firebaseErrorText, getRedirectIdToken, initAnalytics, signInWithGoogle } from '../lib/firebase'

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6c1.9-5.7 7.2-10.3 13.6-10.3z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.7c-.3 2.1-1.6 5.2-4.7 7.3l7.6 5.9c4.5-4.2 6.9-10.3 6.9-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.2c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6C.9 16.4 0 20.1 0 23.7c0 3.6.9 7.3 2.6 10.5l7.8-6z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.5l-7.6-5.9c-2 1.4-4.7 2.4-7.7 2.4-6.4 0-11.7-4.6-13.6-10.3l-7.8 6C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
  )
}

export function LoginPage() {
  const { login, loginWithToken } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [ssoError, setSsoError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ssoBusy, setSsoBusy] = useState(false)
  const [showDomainFix, setShowDomainFix] = useState(false)
  const [copiedHost, setCopiedHost] = useState(false)

  useEffect(() => {
    void initAnalytics()
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const token = await getRedirectIdToken()
      if (!token || cancelled) return
      setSsoBusy(true)
      try {
        await loginWithToken(token)
      } catch (err) {
        if (err instanceof ApiError) setSsoError(err.message)
        else setSsoError(firebaseErrorText(err))
      } finally {
        if (!cancelled) setSsoBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loginWithToken])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Sign in failed', 'UNKNOWN', 0))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setSsoBusy(true)
    setSsoError(null)
    setError(null)
    try {
      const idToken = await signInWithGoogle()
      await loginWithToken(idToken)
    } catch (err) {
      if (err instanceof Error && err.message === 'REDIRECT_STARTED') return
      if (err instanceof ApiError) setSsoError(err.message)
      else setSsoError(firebaseErrorText(err))
      setShowDomainFix(/not yet authorised|unauthorized-domain/i.test(String((err as Error)?.message ?? (err as { code?: string })?.code ?? '')))
    } finally {
      setSsoBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#17243a] p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 10% 0%, rgba(255,116,23,0.55) 0%, rgba(255,116,23,0.12) 38%, transparent 70%), radial-gradient(80% 60% at 95% 100%, rgba(255,116,23,0.28) 0%, transparent 60%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-white">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
                <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div>
              <div className="text-[15px] font-semibold leading-tight">GoFox CRM</div>
              <div className="text-[11px] text-white/60">Revenue workspace</div>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight">
            Sell with confidence. Win more deals.
          </h1>
          <p className="mt-4 text-[13.5px] leading-relaxed text-white/70">
            Generate quality leads, track your pipeline, and automate follow-ups so every opportunity moves closer to a successful close.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              ['36', 'modules covered'],
              ['Live', 'workflow engine'],
              ['SSO', 'Google sign-in'],
              ['RBAC', 'enforced server-side'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="text-[17px] font-semibold">{value}</div>
                <div className="text-[11px] text-white/55">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/40">
          Provider integrations show their real connection state — no messages, calls or payments are fabricated.
        </p>
      </div>

      <div className="flex items-center justify-center bg-surface px-5 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-7 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
                  <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold">GoFox CRM</span>
            </div>
          </div>

          <h2 className="text-[22px] font-semibold tracking-tight">Sign in to your workspace</h2>
          <p className="mt-1 text-[12.5px] text-muted">Continue with Google, or use your work email.</p>

          <button
            type="button"
            onClick={() => void google()}
            disabled={ssoBusy}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-[13.5px] font-medium shadow-[var(--shadow-card)] transition hover:border-accent hover:bg-surface-2 disabled:opacity-60"
          >
            {ssoBusy ? (
              <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            ) : (
              <GoogleMark />
            )}
            {ssoBusy ? 'Checking with Google…' : 'Continue with Google'}
          </button>
          {ssoError ? (
            <div className="mt-2.5 rounded-lg border border-transparent bg-danger-soft px-3 py-2 text-[12px] text-danger">
              <p className="font-medium">{ssoError}</p>
              {showDomainFix ? (
                <div className="mt-2 rounded-md border border-line bg-surface px-2.5 py-2 text-[11px] text-ink">
                  <p className="font-semibold">Administrator fix (Firebase Console)</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted">
                    <li>Open Firebase Console → project <code className="font-mono">{firebaseConfig.projectId}</code>.</li>
                    <li>Go to Authentication → Settings → Authorized domains.</li>
                    <li>Add the host below, then retry Google sign-in.</li>
                  </ol>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink">
                      {currentAuthHost() || 'this hostname'}
                    </code>
                    <button
                      type="button"
                      className="shrink-0 rounded border border-line px-2 py-1 text-[10.5px] font-medium hover:border-accent"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(currentAuthHost())
                          setCopiedHost(true)
                          window.setTimeout(() => setCopiedHost(false), 1500)
                        } catch {
                          /* clipboard may be blocked */
                        }
                      }}
                    >
                      {copiedHost ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-muted">
                    Until this host is listed, Firebase refuses the Google popup. Email sign-in below works normally in the meantime.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-[10.5px] leading-snug text-faint">
            SSO requires a Google account whose email is already a member of this workspace. Tokens are verified server-side against Google&apos;s
            public keys before a session is created.
          </p>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10.5px] uppercase tracking-wide text-faint">or email</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form className="space-y-3.5" onSubmit={submit}>
            <FormRow label="Work email">
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className="gx-input gx-input-icon"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </FormRow>
            <FormRow label="Password">
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className="gx-input gx-input-icon"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </FormRow>
            <div className="flex items-center justify-between text-[12px]">
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                Remember me
              </label>
              <Link to="/forgot-password" className="font-medium text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            {error ? (
              <div className="rounded-lg border border-transparent bg-danger-soft px-3 py-2 text-[12px] text-danger">{error.message}</div>
            ) : null}
            <Button variant="primary" className="w-full" type="submit" loading={busy}>
              Sign in <ArrowRight size={14} />
            </Button>
          </form>

          <p className="mt-6 text-center text-[12.5px] text-muted">
            New to GoFox?{' '}
            <Link to="/signup" className="font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
