'use client'

import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const TOAST_STYLES = {
  success: {
    border: 'border-l-[3px] border-l-green-400',
    icon: CheckCircle2,
    iconColor: 'text-green-400',
  },
  error: {
    border: 'border-l-[3px] border-l-red-400',
    icon: AlertCircle,
    iconColor: 'text-red-400',
  },
  warning: {
    border: 'border-l-[3px] border-l-yellow-400',
    icon: AlertTriangle,
    iconColor: 'text-yellow-400',
  },
  info: {
    border: 'border-l-[3px] border-l-[var(--text-secondary)]',
    icon: Info,
    iconColor: 'text-[var(--text-secondary)]',
  },
}

export function ToastStack() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div
      className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type]
          const Icon = style.icon

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn(
                'flex min-w-[280px] max-w-[360px] items-start gap-3 rounded-[8px]',
                'border border-[var(--border)] bg-[var(--surface)] px-4 py-3',
                'shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
                style.border
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', style.iconColor)} />
              <p className="flex-1 text-[13px] text-[var(--text-primary)] leading-relaxed">
                {toast.message}
              </p>
              <button
                onClick={() => removeToast(toast.id)}
                className="mt-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
