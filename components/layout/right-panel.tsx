'use client'

import { X, ExternalLink } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface RightPanelProps {
  title?: string
  fullPageHref?: string
  children?: React.ReactNode
}

export function RightPanel({ title, fullPageHref, children }: RightPanelProps) {
  const { rightPanelOpen, setRightPanelOpen } = useUIStore()

  return (
    <AnimatePresence>
      {rightPanelOpen && (
        <>
          {/* Mobile overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setRightPanelOpen(false)}
          />

          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              'fixed right-0 top-0 z-50 h-screen w-[320px]',
              'border-l border-[var(--border)] bg-[var(--surface)]',
              'flex flex-col',
              'lg:relative lg:z-auto'
            )}
            role="complementary"
            aria-label="Detail panel"
          >
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
              {title && (
                <span className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                  {title}
                </span>
              )}
              <div className="flex items-center gap-1 ml-auto">
                {fullPageHref && (
                  <a
                    href={fullPageHref}
                    className="rounded-[6px] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
                    aria-label="Open full page"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="rounded-[6px] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {children ?? (
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-tertiary)]">
                  Select an item to view details
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
