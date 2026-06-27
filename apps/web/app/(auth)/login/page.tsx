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
          <span>🗓️ Calendar</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>📋 Tasks</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>📱 Push alerts</span>
        </div>
      </div>
    </div>
  )
}
