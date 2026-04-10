import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { ToastStack } from '@/components/layout/toast-stack'
import { CommandPalette } from '@/components/layout/command-palette'
import { ErrorBoundary } from '@/components/error-boundary'
import { AuthGate } from '@/components/auth-gate'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Larchmont OS',
  description: 'Creative director command center for Larchmont Builds & ScaleGenie',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body suppressHydrationWarning className="h-screen overflow-hidden bg-[var(--background)] antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
          storageKey="larchmont-theme"
        >
          <AuthGate>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main
                id="main-content"
                className="flex-1 overflow-y-auto"
                tabIndex={-1}
              >
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <CommandPalette />
            <ToastStack />
          </AuthGate>
        </ThemeProvider>
      </body>
    </html>
  )
}
