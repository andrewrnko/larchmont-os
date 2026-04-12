import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { TopChrome } from '@/components/layout/top-chrome'
import { ToastStack } from '@/components/layout/toast-stack'
import { CommandPalette } from '@/components/layout/command-palette'
import { ErrorBoundary } from '@/components/error-boundary'
import { AuthGate } from '@/components/auth-gate'
import { AppHydration } from '@/components/layout/app-hydration'

// Inter is the single app font per the Anytype reskin.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

// Monospace fallback for code/tabular text. Geist Mono was removed with Geist Sans;
// JetBrains Mono matches Anytype's tabular feel.
const mono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
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
      className={`dark ${inter.variable} ${mono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="h-screen overflow-hidden bg-[var(--bg0)] font-sans antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
          storageKey="larchmont-theme"
        >
          <AuthGate>
            <AppHydration />
            <div className="flex h-screen flex-col overflow-hidden">
              <TopChrome />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main
                  id="main-content"
                  className="flex-1 overflow-y-auto bg-[var(--bg0)]"
                  tabIndex={-1}
                >
                  <ErrorBoundary>{children}</ErrorBoundary>
                </main>
              </div>
            </div>
            <CommandPalette />
            <ToastStack />
          </AuthGate>
        </ThemeProvider>
      </body>
    </html>
  )
}
