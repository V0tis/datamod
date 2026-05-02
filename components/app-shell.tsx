'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { PageTransition } from '@/components/common/PageTransition'
import { ErrorBoundary } from '@/components/error-boundary'
import { AppSidebar } from '@/components/app-sidebar'
import { AnalysisJobSync } from '@/components/research/analysis-job-sync'
import { useResearchStore } from '@/lib/stores/research-store'
import { useResultsMainScrolledPast } from '@/hooks/use-results-main-scroll'
import { cn } from '@/lib/utils'

const isAuthOnlyPath = (path: string) =>
  path === '/login' ||
  path.startsWith('/login/') ||
  path === '/auth/signup' ||
  path.startsWith('/auth/signup/') ||
  path === '/auth/verify' ||
  path.startsWith('/auth/verify/') ||
  path === '/auth/verify-email' ||
  path.startsWith('/auth/verify-email/') ||
  path === '/auth/login' ||
  path.startsWith('/auth/login/') ||
  path === '/auth/callback' ||
  path.startsWith('/auth/callback/')

const isSharePath = (path: string) => path?.startsWith('/share/')

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

  // 공유 페이지: 사이드바·내부 UI 없이 읽기 전용 리포트만 표시
  if (isSharePath(pathname ?? '')) {
    return (
      <main className="min-h-screen overflow-auto bg-background text-foreground">
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
    )
  }

  const isResultsPage = pathname?.startsWith('/results')
  const resultsScrollPastHeader = useResultsMainScrolledPast(28)

  return (
    <>
      <ErrorBoundary sectionName="sidebar" compact fallbackTitle="사이드바" fallbackMessage="일시적 오류">
        <AppSidebar />
      </ErrorBoundary>
      <div
        className={cn(
          'min-h-screen w-full transition-[padding] duration-200',
          /* <md: 햄버거만, md~lg: 아이콘 레일 72px, lg+: 전체 사이드바 180px */
          isResultsPage
            ? resultsScrollPastHeader
              ? 'pt-0'
              : 'pt-14'
            : 'pt-14 md:pl-[4.5rem] lg:pt-0 lg:pl-[calc(180px+1.5rem)]'
        )}
      >
        <main
          className={cn(
            'min-h-screen overflow-auto px-2 sm:px-4 lg:px-8 xl:px-10',
            isResultsPage ? 'bg-white ' : 'bg-[#F7F8FA]'
          )}
        >
          <ErrorBoundary>
            <PageTransition>{children}</PageTransition>
          </ErrorBoundary>
        </main>
      </div>
      <ErrorBoundary sectionName="job-sync" compact fallbackTitle="백그라운드 동기화" fallbackMessage="일시적 오류">
        <AnalysisJobSync />
      </ErrorBoundary>
    </>
  )
}
