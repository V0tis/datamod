'use client'

import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Eye, EyeOff, User, KeyRound, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type LicenseOrigin = 'USER' | 'SYSTEM'

type SettingsData = {
  email: string
  nickname: string
  aiPrimaryModel?: 'gemini' | 'groq'
  hasGeminiKey: boolean
  hasGroqKey?: boolean
  hasOpenAIKey?: boolean
  hasAnthropicKey?: boolean
  hasServerGemini?: boolean
  hasServerGroq?: boolean
  hasServerOpenAI?: boolean
  hasServerAnthropic?: boolean
  licenseOrigin?: { gemini: LicenseOrigin; groq?: LicenseOrigin; openai?: LicenseOrigin | null; anthropic?: LicenseOrigin | null }
}

const MASKED_PLACEHOLDER = '••••••••••••••••'

const ANALYSIS_DEPTH_KEY = 'rin_analysis_depth'
type AnalysisDepth = 'fast' | 'standard' | 'deep'

const ANALYSIS_OPTIONS: { value: AnalysisDepth; label: string }[] = [
  { value: 'fast', label: '빠른 분석' },
  { value: 'standard', label: '표준 분석' },
  { value: 'deep', label: '심층 분석' },
]

const AI_PRIMARY_OPTIONS: { value: 'gemini' | 'groq'; label: string }[] = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'groq', label: 'Groq' },
]

const SETTINGS_TAB_PARAM = 'tab'
const TAB_LICENSE = 'license'
const TAB_PROFILE = 'profile'

function SettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get(SETTINGS_TAB_PARAM)
  const activeTab = tabFromUrl === TAB_LICENSE ? TAB_LICENSE : TAB_PROFILE

  const setActiveTab = (value: string) => {
    const query = value === TAB_PROFILE ? '' : `?${SETTINGS_TAB_PARAM}=${value}`
    router.replace(`/settings${query}`)
  }

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<SettingsData | null>(null)
  const [nickname, setNickname] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [editingGemini, setEditingGemini] = useState(false)
  const [editingGroq, setEditingGroq] = useState(false)
  const [savingGemini, setSavingGemini] = useState(false)
  const [savingGroq, setSavingGroq] = useState(false)
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>('standard')
  const [aiPrimaryModel, setAiPrimaryModel] = useState<'gemini' | 'groq'>('gemini')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/auth/login')
          return null
        }
        return res.json()
      })
      .then((json: SettingsData | null) => {
        if (json) {
          setData(json)
          setNickname(json.nickname ?? '')
          setAiPrimaryModel(json.aiPrimaryModel === 'groq' ? 'groq' : 'gemini')
          setGeminiApiKey('')
          setGroqApiKey('')
        }
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '설정을 불러오지 못했습니다.' }))
      .finally(() => setLoading(false))
  }, [user, router])

  // 라이선스 탭 진입 시 설정 재조회 (input에 연동 상태가 확실히 반영되도록)
  useEffect(() => {
    if (!user || activeTab !== TAB_LICENSE) return
    fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: SettingsData | null) => {
        if (json) setData(json)
      })
      .catch(() => {})
  }, [user, activeTab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(ANALYSIS_DEPTH_KEY)
    if (stored === 'fast' || stored === 'standard' || stored === 'deep') {
      setAnalysisDepth(stored)
    }
  }, [])

  const handleAnalysisDepthChange = (value: AnalysisDepth) => {
    setAnalysisDepth(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ANALYSIS_DEPTH_KEY, value)
      toast.success('분석 깊이가 저장되었습니다.')
    }
  }

  const handleAiPrimaryChange = async (value: 'gemini' | 'groq') => {
    setAiPrimaryModel(value)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_primary_model: value }),
      })
      if (!res.ok) throw new Error('저장 실패')
      setData((prev) => (prev ? { ...prev, aiPrimaryModel: value } : null))
      toast.success('AI 우선 분석이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(json, { fallbackMessage: '저장에 실패했습니다.' })
        return
      }
      setData((prev) => (prev ? { ...prev, nickname: nickname.trim() } : null))
      toast.success('저장되었습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSavingGemini(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_api_key: geminiApiKey || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(json, { fallbackMessage: '저장에 실패했습니다.' })
        return
      }
      setGeminiApiKey('')
      const nextRes = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      if (nextRes.ok) {
        const nextJson = (await nextRes.json()) as SettingsData
        setData(nextJson)
      }
      toast.success('Gemini API 키가 저장되었습니다.')
    } finally {
      setSavingGemini(false)
    }
  }

  const handleSaveGroq = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSavingGroq(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groq_api_key: groqApiKey || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(json, { fallbackMessage: '저장에 실패했습니다.' })
        return
      }
      setGroqApiKey('')
      const nextRes = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      if (nextRes.ok) {
        const nextJson = (await nextRes.json()) as SettingsData
        setData(nextJson)
      }
      toast.success('Groq API 키가 저장되었습니다.')
    } finally {
      setSavingGroq(false)
    }
  }

  const getKeyState = (provider: 'gemini' | 'groq') => {
    if (provider === 'gemini') {
      const hasUser = !!data?.hasGeminiKey
      const hasServer = !!data?.hasServerGemini
      const placeholder = hasServer && !hasUser ? MASKED_PLACEHOLDER : hasUser ? MASKED_PLACEHOLDER : '키를 입력하세요'
      const canReveal = geminiApiKey.length > 0
      const showMask = hasUser && !geminiApiKey && !editingGemini
      const displayValue = geminiApiKey || (showMask ? MASKED_PLACEHOLDER : '')
      return { value: displayValue, hasUser, hasServer, placeholder, canReveal, show: showGeminiKey, setShow: setShowGeminiKey, setValue: setGeminiApiKey, setEditing: setEditingGemini }
    }
    const hasUser = !!data?.hasGroqKey
    const hasServer = !!data?.hasServerGroq
    const placeholder = hasServer && !hasUser ? MASKED_PLACEHOLDER : hasUser ? MASKED_PLACEHOLDER : '키를 입력하세요'
    const canReveal = groqApiKey.length > 0
    const showMask = hasUser && !groqApiKey && !editingGroq
    const displayValue = groqApiKey || (showMask ? MASKED_PLACEHOLDER : '')
    return { value: displayValue, hasUser, hasServer, placeholder, canReveal, show: showGroqKey, setShow: setShowGroqKey, setValue: setGroqApiKey, setEditing: setEditingGroq }
  }

  const geminiConnected = !!(data?.hasGeminiKey || data?.hasServerGemini)
  const groqConnected = !!(data?.hasGroqKey || data?.hasServerGroq)

  if (!user) {
    return (
      <div className="p-4 md:p-6">
        <Card className="mx-auto max-w-2xl border border-border bg-card shadow-sm">
          <CardContent className="p-6 text-center text-muted-foreground">
            로그인한 후 설정을 변경할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">설정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 w-full max-w-5xl mx-auto">
      <h1 className="text-lg font-semibold text-foreground mb-0.5">설정</h1>
      <p className="text-muted-foreground text-xs mb-4">
        내 정보와 분석용 API 키를 관리하세요.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 h-9 rounded-lg bg-muted/50 p-1 mb-4">
          <TabsTrigger value="profile" className="rounded-md gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="h-4 w-4" />
            내 정보
          </TabsTrigger>
          <TabsTrigger value="license" className="rounded-md gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <KeyRound className="h-4 w-4" />
            라이선스
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="m-0">
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">내 정보</CardTitle>
              <CardDescription>이메일은 읽기 전용이며, 닉네임만 수정할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input id="email" type="email" value={data?.email ?? ''} readOnly className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">닉네임</Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="닉네임을 입력하세요"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      저장 중...
                    </>
                  ) : (
                    '저장'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="license" className="m-0 space-y-6">
          {/* 1. AI Provider Settings */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">AI Provider 설정</CardTitle>
              <CardDescription>시장 분석에 사용되는 AI API 키를 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Gemini API Key */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Gemini API Key</Label>
                  <p className="text-sm text-muted-foreground mt-1">시장 신호 분석 및 리서치에 사용됩니다.</p>
                </div>
                <form onSubmit={handleSaveGemini} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Input
                      type={getKeyState('gemini').show && getKeyState('gemini').canReveal ? 'text' : 'password'}
                      placeholder={getKeyState('gemini').placeholder}
                      value={getKeyState('gemini').value}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      onFocus={() => getKeyState('gemini').hasUser && !geminiApiKey && getKeyState('gemini').setEditing(true)}
                      onBlur={() => getKeyState('gemini').setEditing(false)}
                      className="pr-10 bg-muted/50 focus:bg-background"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => getKeyState('gemini').canReveal && setShowGeminiKey(!showGeminiKey)}
                      title={getKeyState('gemini').canReveal ? (showGeminiKey ? '숨기기' : '보기') : '입력한 키만 확인할 수 있습니다'}
                      className={cn('absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded', getKeyState('gemini').canReveal ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50 cursor-default')}
                      aria-label={showGeminiKey ? '숨기기' : '보기'}
                    >
                      {showGeminiKey && getKeyState('gemini').canReveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="submit" disabled={savingGemini} className="shrink-0">
                    {savingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
                  </Button>
                </form>
              </div>

              {/* Groq API Key */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Groq API Key</Label>
                  <p className="text-sm text-muted-foreground mt-1">인사이트·탭별 분석에 사용됩니다.</p>
                </div>
                <form onSubmit={handleSaveGroq} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Input
                      type={getKeyState('groq').show && getKeyState('groq').canReveal ? 'text' : 'password'}
                      placeholder={getKeyState('groq').placeholder}
                      value={getKeyState('groq').value}
                      onChange={(e) => setGroqApiKey(e.target.value)}
                      onFocus={() => getKeyState('groq').hasUser && !groqApiKey && getKeyState('groq').setEditing(true)}
                      onBlur={() => getKeyState('groq').setEditing(false)}
                      className="pr-10 bg-muted/50 focus:bg-background"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => getKeyState('groq').canReveal && setShowGroqKey(!showGroqKey)}
                      title={getKeyState('groq').canReveal ? (showGroqKey ? '숨기기' : '보기') : '입력한 키만 확인할 수 있습니다'}
                      className={cn('absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded', getKeyState('groq').canReveal ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50 cursor-default')}
                      aria-label={showGroqKey ? '숨기기' : '보기'}
                    >
                      {showGroqKey && getKeyState('groq').canReveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="submit" disabled={savingGroq} className="shrink-0">
                    {savingGroq ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* 2. Analysis Configuration */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">분석 설정</CardTitle>
              <CardDescription>분석 깊이를 선택하세요. 심층 분석일수록 더 상세한 결과를 제공합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-2 block">분석 깊이</Label>
                <div className="flex flex-wrap gap-2 p-1 rounded-lg bg-muted/50 w-fit">
                  {ANALYSIS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleAnalysisDepthChange(opt.value)}
                      className={cn(
                        'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                        analysisDepth === opt.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">AI 우선 분석</Label>
                <p className="text-xs text-muted-foreground mb-2">먼저 사용할 AI 모델을 선택하세요. 실패 시 다른 모델로 자동 폴백됩니다.</p>
                <div className="flex flex-wrap gap-2 p-1 rounded-lg bg-muted/50 w-fit">
                  {AI_PRIMARY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleAiPrimaryChange(opt.value)}
                      className={cn(
                        'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                        aiPrimaryModel === opt.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. System Status */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">시스템 상태</CardTitle>
              <CardDescription>API 연결 상태를 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border border-border/80 p-4">
                  {geminiConnected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Gemini API</p>
                    <p className="text-sm text-muted-foreground">{geminiConnected ? '연결됨' : '연결되지 않음'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border/80 p-4">
                  {groqConnected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Groq API</p>
                    <p className="text-sm text-muted-foreground">{groqConnected ? '연결됨' : '연결되지 않음'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    }>
      <SettingsPageInner />
    </Suspense>
  )
}
