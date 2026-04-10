'use client'

import { useState, useEffect } from 'react'

const LS_KEY = 'larchmont-auth'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'locked' | 'unlocked'>('loading')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const appPassword = process.env.NEXT_PUBLIC_APP_PASSWORD

  useEffect(() => {
    // No password configured — skip gate entirely
    if (!appPassword) {
      setState('unlocked')
      return
    }
    const stored = localStorage.getItem(LS_KEY)
    setState(stored === appPassword ? 'unlocked' : 'locked')
  }, [appPassword])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === appPassword) {
      localStorage.setItem(LS_KEY, password)
      setState('unlocked')
      setError(false)
    } else {
      setError(true)
      setPassword('')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-amber-500" />
      </div>
    )
  }

  if (state === 'locked') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 px-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <span className="text-xl font-bold text-amber-500">L</span>
            </div>
            <h1 className="text-lg font-semibold text-white">Larchmont OS</h1>
            <p className="mt-1 text-[13px] text-neutral-500">Enter password to continue</p>
          </div>

          <div>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              placeholder="Password"
              className={`w-full rounded-lg border bg-[#141414] px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-neutral-600 transition-colors ${
                error ? 'border-red-500/60' : 'border-[#2a2a2a] focus:border-amber-500/50'
              }`}
            />
            {error && (
              <p className="mt-1.5 text-[12px] text-red-400">Incorrect password</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-amber-500 py-2.5 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}

export function logout() {
  localStorage.removeItem(LS_KEY)
  window.location.reload()
}
