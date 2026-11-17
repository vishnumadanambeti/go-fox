import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from '../lib/router'
import { Button, FormRow } from '../components/ui'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    setSubmitted(true)
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
          <ArrowLeft size={13} /> Back to sign in
        </Link>
        <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Enter your work email and we&apos;ll send a secure link to reset your password.
        </p>
        {submitted ? (
          <div className="mt-6 rounded-lg border border-line bg-good-soft px-3 py-2.5 text-[12.5px] text-good">
            If an account exists for <span className="font-medium">{email}</span>, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form className="mt-6 space-y-3.5" onSubmit={submit}>
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
            <Button variant="primary" className="w-full" type="submit" loading={busy}>
              Send reset link
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
