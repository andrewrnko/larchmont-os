'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <p className="text-[var(--text-secondary)]">Something went wrong</p>
          {this.state.error && (
            <p className="text-[12px] max-w-md text-[var(--text-tertiary)] font-mono break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border text-sm transition-opacity hover:opacity-90"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
