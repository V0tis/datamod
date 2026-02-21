'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { PageTransition } from '@/components/common/PageTransition'
import { ErrorBoundary } from '@/components/error-boundary'
import { GlobalHeader } from '@/components/global-header'
import { AnalysisJobSync } from '@/components/research/analysis-job-sync'
import { useResearchStore } from '@/lib/stores/research-store'

const isAuthOnlyPath = (path: string) =>
  path === '/login' ||
  path.startsWith('/login/') ||
  path === '/auth/signup' ||
  path.startsWith('/auth/signup/')

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = isAuthOnlyPath(pathname ?? '')
  const prevPathnameRef = useRef(pathname)
  const abortAnalysis = useResearchStore((s) => s.abortAnalysis)
  const isAnalyzingNow = useResearchStore((s) => s.isAnalyzingNow)

  useEffect(() => {
    const prevPath = prevPathnameRef.current
    prevPathnameRef.current = pathname

    if (prevPath !== pathname) {
      const wasOnResults = prevPath?.startsWith('/results')
      const isLeavingResults = wasOnResults && !pathname?.startsWith('/results')

      if (isLeavingResults && isAnalyzingNow()) {
        abortAnalysis()
      }
    }
  }, [pathname, abortAnalysis, isAnalyzingNow])

  if (isAuthPage) {
    return (
      <main className="min-h-screen overflow-auto bg-background text-foreground">
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
