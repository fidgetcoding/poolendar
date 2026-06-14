'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const FLOATERS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  size: 18 + ((i * 7 + 3) % 24),
  left: ((i * 17 + 5) % 86) + 7,
  delay: (i * 1.7) % 12,
  duration: 14 + ((i * 3 + 2) % 10),
}))

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
        scopes:
          'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`,
        },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{
        background:
          'linear-gradient(145deg, #1a0f08 0%, #0a0a0a 50%, #0d0806 100%)',
      }}
    >
      {FLOATERS.map((f) => (
        <div
          key={f.id}
          className="pointer-events-none absolute select-none animate-float"
          style={{
            fontSize: f.size,
            left: `${f.left}%`,
            bottom: '-8%',
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
          }}
          aria-hidden="true"
        >
          💩
        </div>
      ))}

      <div
        className="pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(249,168,37,0.08) 0%, rgba(139,105,20,0.04) 40%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="mb-10 text-center">
          <div className="poop-logo relative mx-auto mb-5 inline-block overflow-hidden rounded-full">
            <div
              className="animate-pulse-glow absolute inset-0 rounded-full"
              aria-hidden="true"
            />
            <span className="relative inline-block text-[64px] leading-none sm:text-[80px] drop-shadow-[0_4px_24px_rgba(249,168,37,0.25)]">
              💩
            </span>
          </div>
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--fg)' }}
          >
            Pool<span style={{ color: 'var(--accent)' }}>endar</span>
          </h1>
          <p
            className="mt-2 text-sm tracking-wide"
            style={{ color: 'var(--muted)' }}
          >
            The fully jailbroken calendar
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(25, 18, 10, 0.55)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(249, 168, 37, 0.12)',
            boxShadow:
              '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 1px 0 rgba(255,255,255,0.05) inset',
          }}
        >
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="group relative flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl px-6 py-3.5 text-base font-semibold transition-all duration-200 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            style={{
              background:
                'linear-gradient(180deg, #f9a825 0%, #ef8a1a 100%)',
              color: '#1a0e08',
              boxShadow:
                '0 2px 12px rgba(249,168,37,0.3), 0 1px 0 rgba(255,255,255,0.2) inset',
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <div
              className="h-px flex-1"
              style={{ background: 'rgba(249,168,37,0.15)' }}
            />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              or
            </span>
            <div
              className="h-px flex-1"
              style={{ background: 'rgba(249,168,37,0.15)' }}
            />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              minLength={6}
            />

            {error && (
              <p
                className="text-sm"
                style={{ color: 'var(--destructive)' }}
                role="alert"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              {loading
                ? 'Loading...'
                : mode === 'login'
                  ? 'Sign in with email'
                  : 'Create account'}
            </Button>
          </form>

          <p
            className="mt-4 text-center text-sm"
            style={{ color: 'var(--muted)' }}
          >
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                  }}
                  className="cursor-pointer hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                  className="cursor-pointer hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <div
          className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs"
          style={{ color: 'var(--muted)' }}
        >
          <span>🗓️ Google Calendar</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>🤖 AI scheduling</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>📱 Push alerts</span>
        </div>
      </div>
    </div>
  )
}
