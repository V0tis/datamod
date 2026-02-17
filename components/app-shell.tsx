'use client'

import { usePathname } from 'next/navigation'
import { PageTransition } from '@/components/common/PageTransition'
import { ErrorBoundary } from '@/components/error-boundary'
import { GlobalHeader } from '@/components/global-header'
import { AnalysisJobSync } from '@/components/research/analysis-job-sync'
import { useReadingModeStore } from '@/lib/stores/reading-mode-store'

const isAuthOnlyPath = (path: string) =>
  path === '/login' ||
  path.startsWith('/login/') ||
  path === '/auth/signup' ||
  path.startsWith('/auth/signup/')

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = isAuthOnlyPath(pathname ?? '')
  const readingMode = useReadingModeStore((s) => s.mode)

  if (isAuthPage) {
    return (
      <main className="min-h-screen overflow-auto bg-gradient-to-br from-background via-background-elevated to-background text-foreground">
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
    )
  }

  return (
    <>
      <GlobalHeader />
      {/* Reading mode wrapper: compact/focus drives CSS variables for density and spacing */}
      <main className="min-h-screen bg-background overflow-auto">
        <div data-reading-mode={readingMode} className="min-h-full">
          <ErrorBoundary>
            <PageTransition>{children}</PageTransition>
          </ErrorBoundary>
        </div>
      </main>
      <AnalysisJobSync />
    </>
  )
}
