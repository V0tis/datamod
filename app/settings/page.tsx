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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Eye, EyeOff, User, KeyRound, Loader2 } from 'lucide-react'

type LicenseOrigin = 'USER' | 'SYSTEM'

type SettingsData = {
  email: string
  nickname: string
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

const LICENSE_ROWS: Array<{
  id: keyof Pick<SettingsData, 'hasGeminiKey' | 'hasGroqKey' | 'hasOpenAIKey' | 'hasAnthropicKey'>
  label: string
  stateKey: 'geminiApiKey' | 'groqApiKey' | 'openaiApiKey' | 'anthropicApiKey'
  showKey: 'showGeminiKey' | 'showGroqKey' | 'showOpenAIKey' | 'showAnthropicKey'
}> = [
  { id: 'hasGeminiKey', label: 'Gemini — 시장 분석', stateKey: 'geminiApiKey', showKey: 'showGeminiKey' },
  { id: 'hasGroqKey', label: 'Groq — 인사이트·탭 분석', stateKey: 'groqApiKey', showKey: 'showGroqKey' },
  { id: 'hasOpenAIKey', label: 'OpenAI — Fallback', stateKey: 'openaiApiKey', showKey: 'showOpenAIKey' },
  { id: 'hasAnthropicKey', label: 'Claude — 인사이트 (선택)', stateKey: 'anthropicApiKey', showKey: 'showAnthropicKey' },
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
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)

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
    fetch('/api/settings')
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
          setGeminiApiKey('')
          setGroqApiKey('')
          setOpenaiApiKey('')
          setAnthropicApiKey('')
        }
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '설정을 불러오지 못했습니다.' }))
      .finally(() => setLoading(false))
  }, [user, router])

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

  const handleSaveLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (geminiApiKey !== '') body.gemini_api_key = geminiApiKey
      if (groqApiKey !== '') body.groq_api_key = groqApiKey
      if (openaiApiKey !== '') body.openai_api_key = openaiApiKey
      if (anthropicApiKey !== '') body.anthropic_api_key = anthropicApiKey
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(json, { fallbackMessage: '저장에 실패했습니다.' })
        return
      }
      setGeminiApiKey('')
      setGroqApiKey('')
      setOpenaiApiKey('')
      setAnthropicApiKey('')
      const nextRes = await fetch('/api/settings')
      if (nextRes.ok) {
        const nextJson = (await nextRes.json()) as SettingsData
        setData(nextJson)
      }
      toast.success('라이선스 설정이 저장되었습니다.')
    } finally {
      setSaving(false)
    }
  }

  const getKeyState = (row: typeof LICENSE_ROWS[0]) => {
    const value = { geminiApiKey, groqApiKey, openaiApiKey, anthropicApiKey }[row.stateKey] as string
    const hasUser = !!data?.[row.id]
    const hasServer = row.id === 'hasGeminiKey' ? data?.hasServerGemini : row.id === 'hasGroqKey' ? data?.hasServerGroq : row.id === 'hasOpenAIKey' ? data?.hasServerOpenAI : data?.hasServerAnthropic
    const origin = row.id === 'hasGeminiKey' ? data?.licenseOrigin?.gemini : row.id === 'hasGroqKey' ? data?.licenseOrigin?.groq : row.id === 'hasOpenAIKey' ? data?.licenseOrigin?.openai : data?.licenseOrigin?.anthropic
    const isUserTyped = value.length > 0
    const placeholder =
      hasServer && !hasUser ? MASKED_PLACEHOLDER
      : hasUser ? MASKED_PLACEHOLDER
      : '키를 입력하세요'
    const canReveal = isUserTyped
    const show = { showGeminiKey, showGroqKey, showOpenAIKey, showAnthropicKey }[row.showKey] as boolean
    const setShow = { showGeminiKey: setShowGeminiKey, showGroqKey: setShowGroqKey, showOpenAIKey: setShowOpenAIKey, showAnthropicKey: setShowAnthropicKey }[row.showKey]
    const setValue = { geminiApiKey: setGeminiApiKey, groqApiKey: setGroqApiKey, openaiApiKey: setOpenaiApiKey, anthropicApiKey: setAnthropicApiKey }[row.stateKey]
    return { value, hasUser, hasServer, origin, isUserTyped, placeholder, canReveal, show, setShow, setValue }
  }

  const handleKeyFocus = (row: typeof LICENSE_ROWS[0]) => {
    const s = getKeyState(row)
    if (s.hasServer && !s.hasUser && !s.value) {
      s.setValue('')
    }
  }

  if (!user) {
    return (
      <div className="p-6 md:p-8">
        <Card className="mx-auto max-w-2xl border border-border bg-card shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            로그인한 후 설정을 변경할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">설정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 w-full max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">설정</h1>
      <p className="text-muted-foreground text-sm mb-6">
        내 정보와 분석용 API 키를 관리하세요.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 h-11 rounded-lg bg-muted/50 p-1 mb-6">
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

        <TabsContent value="license" className="m-0">
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-foreground">API 키</CardTitle>
              <CardDescription className="text-muted-foreground">
                별도 입력이 없는 경우 시스템 기본 라이선스가 적용됩니다. 직접 입력한 키만 눈 아이콘으로 확인할 수 있으며, 서버 키는 보안상 노출하지 않습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleSaveLicense} className="space-y-4">
                {LICENSE_ROWS.map((row) => {
                  const s = getKeyState(row)
                  const badgeLabel = s.origin === 'USER' ? 'User' : (s.hasServer || s.origin === 'SYSTEM') ? 'System' : null
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center py-2 border-b border-border/80 last:border-0 last:pb-0 first:pt-0"
                    >
                      <div className="md:col-span-4">
                        <Label className="text-sm font-medium text-foreground">{row.label}</Label>
                      </div>
                      <div className="md:col-span-8 relative">
                        <div className="relative flex items-center">
                          <Input
                            type={s.show && s.canReveal ? 'text' : 'password'}
                            placeholder={s.placeholder}
                            value={s.value}
                            onChange={(e) => s.setValue(e.target.value)}
                            onFocus={() => handleKeyFocus(row)}
                            className="bg-muted/50 border-border pr-16 h-9 text-sm placeholder:text-muted-foreground focus:bg-background text-foreground"
                            autoComplete="off"
                          />
                          <div className="absolute right-2 flex items-center gap-1.5">
                            {badgeLabel && (
                              <Badge
                                variant={badgeLabel === 'User' ? 'default' : 'secondary'}
                                className="text-[10px] px-1.5 py-0 font-normal bg-muted text-muted-foreground border-0 data-[variant=default]:bg-primary/10 data-[variant=default]:text-primary"
                              >
                                {badgeLabel}
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => s.canReveal && s.setShow(!s.show)}
                              title={s.canReveal ? (s.show ? '숨기기' : '보기') : '서버 키는 보안상 표시하지 않습니다'}
                              className={`p-1 rounded ${s.canReveal ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50 cursor-default'}`}
                              aria-label={s.show ? '숨기기' : '보기'}
                            >
                              {s.show && s.canReveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="pt-4">
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
                </div>
              </form>
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
