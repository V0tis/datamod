'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { PageTransition } from '@/components/common/PageTransition'
import { ErrorBoundary } from '@/components/error-boundary'
import { AppSidebar } from '@/components/app-sidebar'
import { AnalysisJobSync } from '@/components/research/analysis-job-sync'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'

const isAuthOnlyPath = (path: string) =>
  path === '/login' ||
  path.startsWith('/login/') ||
  path === '/auth/signup' ||
  path.startsWith('/auth/signup/') ||
  path === '/auth/verify' ||
  path.startsWith('/auth/verify/') ||
  path === '/auth/login' ||
  path.startsWith('/auth/login/') ||
  path === '/auth/callback' ||
  path.startsWith('/auth/callback/')

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

  const isResultsPage = pathname?.startsWith('/results')

  return (
    <>
      <AppSidebar />
      <div
        className={cn(
          'min-h-screen',
          isResultsPage ? 'pt-14' : 'pt-14 lg:pt-0 lg:pl-[220px]'
        )}
      >
        <main className="min-h-screen bg-background overflow-auto">
          <ErrorBoundary>
            <PageTransition>{children}</PageTransition>
          </ErrorBoundary>
        </main>
      </div>
      <AnalysisJobSync />
    </>
  )
}
