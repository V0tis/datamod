'use client'

import { usePathname } from 'next/navigation'
import { PageTransition } from '@/components/common/PageTransition'
import { ErrorBoundary } from '@/components/error-boundary'
import { GlobalHeader } from '@/components/global-header'
import { AnalysisJobSync } from '@/components/research/analysis-job-sync'

const isAuthOnlyPath = (path: string) =>
  path === '/login' ||
  path.startsWith('/login/') ||
  path === '/auth/signup' ||
  path.startsWith('/auth/signup/')

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = isAuthOnlyPath(pathname ?? '')

  if (isAuthPage) {
    return (
      <main className="min-h-screen overflow-auto bg-gradient-to-br from-background via-[#15181c] to-background text-foreground">
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
    )
  }

  return (
    <>
      <GlobalHeader />
      <main className="min-h-screen bg-background overflow-auto">
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
      <AnalysisJobSync />
    </>
  )
}
