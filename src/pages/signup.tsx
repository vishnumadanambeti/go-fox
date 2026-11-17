import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { useApp } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { Button, FormRow } from '../components/ui'
import { initAnalytics, signInWithGoogle } from '../lib/firebase'

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

function passwordStrength(password: string): { score: number; label: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[Math.min(score, 4)] }
}

export function SignupPage() {
  const { loginWithToken } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [terms, setTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ssoBusy, setSsoBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    void initAnalytics()
  }, [])

  const strength = useMemo(() => passwordStrength(password), [password])
  const passwordsMatch = confirm.length === 0 || password === confirm

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim() || !email.trim() || !company.trim()) {
      setError('Please complete all required fields.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid work email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!terms) {
      setError('You must accept the Terms and Privacy Policy.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), company: company.trim(), password }),
      })
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string; user?: unknown }
      if (!response.ok) throw new Error(data?.message ?? data?.error ?? 'Registration failed.')
      setDone(true)
      if (data?.user) {
        // Auto sign-in handled by cookie; reload app state by navigating home.
        window.setTimeout(() => navigate('/', { replace: true }), 1200)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setSsoBusy(true)
    setError(null)
    try {
      const idToken = await signInWithGoogle()
      await loginWithToken(idToken)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed.')
    } finally {
      setSsoBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-good-soft text-good">
            <Check size={22} />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Workspace created</h1>
          <p className="mt-2 text-[13px] text-muted">
            Your GoFox workspace is ready. Redirecting you to the dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex items-center justify-center bg-surface px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-7">
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

          <h2 className="text-[22px] font-semibold tracking-tight">Create your workspace</h2>
          <p className="mt-1 text-[12.5px] text-muted">Start free. No credit card required.</p>

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
            {ssoBusy ? 'Checking with Google…' : 'Sign up with Google'}
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10.5px] uppercase tracking-wide text-faint">or email</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form className="space-y-3.5" onSubmit={submit}>
            <FormRow label="Full name">
              <div className="relative">
                <User size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className="gx-input gx-input-icon"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
            </FormRow>
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
            <FormRow label="Company name">
              <input
                className="gx-input"
                type="text"
                autoComplete="organization"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                required
              />
            </FormRow>
            <FormRow label="Password">
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className="gx-input gx-input-icon"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
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
              {password.length > 0 ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < strength.score ? 'bg-accent' : 'bg-line'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10.5px] text-muted">{strength.label}</span>
                </div>
              ) : null}
            </FormRow>
            <FormRow label="Confirm password">
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className="gx-input gx-input-icon"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                  aria-invalid={!passwordsMatch}
                  style={{ borderColor: !passwordsMatch ? 'var(--color-danger)' : undefined }}
                />
              </div>
              {!passwordsMatch ? <p className="mt-1 text-[11px] text-danger">Passwords do not match.</p> : null}
            </FormRow>

            <label className="flex items-start gap-2 text-[12px] text-muted">
              <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5" />
              <span>
                I agree to the{' '}
                <a href="#terms" className="font-medium text-accent hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="font-medium text-accent hover:underline">
                  Privacy Policy
                </a>
                .
              </span>
            </label>

            {error ? (
              <div className="rounded-lg border border-transparent bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</div>
            ) : null}
            <Button variant="primary" className="w-full" type="submit" loading={busy}>
              Create workspace <ArrowRight size={14} />
            </Button>
          </form>

          <p className="mt-6 text-center text-[12.5px] text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-accent hover:underline">
              Sign in
            </Link>
          </p>

          <p className="mt-8 text-center text-[10.5px] text-faint">
            <ShieldCheck size={11} className="mr-1 inline" />
            Your data is tenant-isolated and encrypted in transit.
          </p>
        </div>
      </div>

      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#17243a] p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 10% 0%, rgba(255,116,23,0.55) 0%, rgba(255,116,23,0.12) 38%, transparent 70%), radial-gradient(80% 60% at 95% 100%, rgba(21,156,145,0.22) 0%, transparent 60%)',
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
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight">Unlock your growth potential.</h1>
          <p className="mt-4 text-[13.5px] leading-relaxed text-white/70">
            Capture every opportunity the moment it arrives, nurture relationships with every follow-up, and turn customer insights into measurable growth.
          </p>
          <ul className="mt-8 space-y-2.5 text-[13px] text-white/80">
            {['36 integrated modules', 'Visual workflow automation', 'Drag-and-drop form builder', 'Role-based access control', 'Tenant-isolated data'].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <Check size={15} className="text-accent" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11px] text-white/40">Free plan available. Upgrade when your team grows.</p>
      </div>
    </div>
  )
}
