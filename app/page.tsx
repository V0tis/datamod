'use client'

import React from "react"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { ResultsDashboard, type ResearchResponse } from '@/components/results-dashboard'

const MIN_LOADING_MS = 2500 // 최소 로딩 표시 시간 (API가 빨라도 UX를 위해 유지)

const loadingMessages = [
  '린이 최신 시장 뉴스를 검색 중입니다...',
  '커뮤니티의 유저 반응을 수집하고 있습니다...',
  '데이터 신선도를 검증하는 중입니다...',
]

export default function RinAISearch() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [results, setResults] = useState<ResearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    const searchQuery = query.trim()
    setIsSearching(true)
    setCurrentMessageIndex(0)
    setResults(null)
    setError(null)

    // Cycle through loading messages
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        if (prev < loadingMessages.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 2000)

    try {
      // API 호출과 최소 로딩 시간을 동시에 대기 (API가 빨라도 로딩 UX 유지)
      const [apiResponse] = await Promise.all([
        fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery }),
        }),
        new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS)),
      ])

      const data: ResearchResponse = await apiResponse.json()

      if (!apiResponse.ok) {
        throw new Error(data.error ?? '리서치 요청에 실패했습니다.')
      }

      // API 성공 → 결과 대시보드로 전환
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      clearInterval(interval)
      setIsSearching(false)
      setQuery('')
      setCurrentMessageIndex(0)
    }
  }

  const handleSearchAgain = () => {
    setResults(null)
    setError(null)
  }

  // API 응답 수신 시 → 결과 대시보드 화면으로 전환
  if (results && !isSearching) {
    return (
      <ResultsDashboard
        results={results}
        onSearchAgain={handleSearchAgain}
      />
    )
  }

  if (isSearching) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-2xl space-y-8 flex flex-col items-center">
          {/* Dog Animation Placeholder */}
          <div className="relative w-48 h-48 rounded-full bg-primary/10 flex items-center justify-center animate-bounce-slow">
            <div className="text-8xl animate-wiggle">🐕</div>
          </div>

          {/* Progress Log */}
          <div className="w-full space-y-3">
            {loadingMessages.map((message, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-500 ${
                  index <= currentMessageIndex
                    ? 'bg-card shadow-sm border border-border opacity-100'
                    : 'bg-muted/30 opacity-40'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    index === currentMessageIndex
                      ? 'bg-primary animate-pulse'
                      : index < currentMessageIndex
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30'
                  }`}
                />
                <p
                  className={`text-sm ${
                    index <= currentMessageIndex
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {message}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl space-y-8 flex flex-col items-center">
        {/* Logo/Brand */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl">🐕</span>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              Rin-AI
            </h1>
          </div>
        </div>

        {error && (
          <div className="w-full p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} className="w-full space-y-4">
          <div className="relative flex items-center gap-2 bg-card rounded-full shadow-lg border border-border p-2 hover:shadow-xl transition-shadow">
            <div className="flex-1 flex items-center gap-2 px-4">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="검색어를 입력하세요..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8"
            >
              검색
            </Button>
          </div>

          {/* Subtext */}
          <p className="text-center text-muted-foreground text-sm">
            린(Rin)이 오늘 어떤 최신 소식을 물어다 줄까요?
          </p>
        </form>

        {/* Decorative Element */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>AI가 실시간으로 신선한 정보를 찾아드립니다</span>
        </div>
      </div>
    </main>
  )
}
