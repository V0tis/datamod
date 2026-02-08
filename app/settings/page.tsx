'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Eye, EyeOff } from 'lucide-react'

type LicenseOrigin = 'USER' | 'SYSTEM'

type SettingsData = {
  email: string
  nickname: string
  hasGeminiKey: boolean
  hasFirecrawlKey: boolean
  licenseOrigin?: { gemini: LicenseOrigin; firecrawl: LicenseOrigin }
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<SettingsData | null>(null)
  const [nickname, setNickname] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [firecrawlApiKey, setFirecrawlApiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showFirecrawlKey, setShowFirecrawlKey] = useState(false)

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
          setNickname(json.nickname)
          setGeminiApiKey('')
          setFirecrawlApiKey('')
        }
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '설정을 불러오지 못했어요.' }))
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
        showErrorToast(json, { fallbackMessage: '저장에 실패했어요.' })
        return
      }
      setData((prev) => (prev ? { ...prev, nickname: nickname.trim() } : null))
      toast.success('내 정보가 저장되었어요.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const body: { gemini_api_key?: string; firecrawl_api_key?: string } = {}
      if (geminiApiKey !== '') body.gemini_api_key = geminiApiKey
      if (firecrawlApiKey !== '') body.firecrawl_api_key = firecrawlApiKey
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(json, { fallbackMessage: '저장에 실패했어요.' })
        return
      }
      setGeminiApiKey('')
      setFirecrawlApiKey('')
      setData((prev) =>
        prev
          ? {
              ...prev,
              hasGeminiKey: prev.hasGeminiKey || !!body.gemini_api_key,
              hasFirecrawlKey: prev.hasFirecrawlKey || !!body.firecrawl_api_key,
            }
          : null
      )
      const nextRes = await fetch('/api/settings')
      if (nextRes.ok) {
        const nextJson = (await nextRes.json()) as SettingsData
        setData((prev) => (prev ? { ...prev, licenseOrigin: nextJson.licenseOrigin } : null))
      }
      toast.success('라이선스 설정이 저장되었어요.')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="p-6 md:p-8">
        <Card className="mx-auto max-w-2xl border border-border bg-white shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            로그인한 후 설정을 변경할 수 있어요.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <Card className="mx-auto max-w-2xl border border-border bg-white shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            설정을 불러오는 중...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-1">설정</h1>
        <p className="text-muted-foreground text-sm mb-6">
          내 정보와 분석용 라이선스 키를 관리하세요.
        </p>

        <Card className="border border-border bg-white shadow-sm overflow-hidden">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-12 rounded-none border-b border-border bg-muted/30 p-0">
              <TabsTrigger
                value="profile"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
              >
                내 정보
              </TabsTrigger>
              <TabsTrigger
                value="license"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
              >
                라이선스
              </TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="m-0 p-6">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">내 정보</CardTitle>
                <CardDescription>이메일은 읽기 전용이며, 닉네임만 수정할 수 있어요.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      type="email"
                      value={data?.email ?? ''}
                      readOnly
                      className="bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nickname">닉네임</Label>
                    <Input
                      id="nickname"
                      type="text"
                      placeholder="닉네임을 입력하세요"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
            <TabsContent value="license" className="m-0 p-6">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">라이선스</CardTitle>
                <CardDescription>
                  분석에 사용할 API 키를 입력하세요. 저장 후 검색 시 사용됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <form onSubmit={handleSaveLicense} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="gemini">Gemini API Key</Label>
                      {data?.licenseOrigin?.gemini && (
                        <Badge variant={data.licenseOrigin.gemini === 'USER' ? 'default' : 'secondary'} className="text-xs">
                          {data.licenseOrigin.gemini === 'USER' ? '직접 입력' : '서버 제공'}
                        </Badge>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <Input
                        id="gemini"
                        type={showGeminiKey ? 'text' : 'password'}
                        placeholder="키를 입력하거나 변경하려면 새 키를 입력하세요"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="bg-white pr-10"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey((v) => !v)}
                        className="absolute right-2 text-muted-foreground hover:text-foreground p-1"
                        aria-label={showGeminiKey ? '숨기기' : '보기'}
                      >
                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {data?.hasGeminiKey && !geminiApiKey && (
                      <p className="text-xs text-muted-foreground">현재 키가 등록되어 있어요.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="firecrawl">Firecrawl API Key</Label>
                      {data?.licenseOrigin?.firecrawl && (
                        <Badge variant={data.licenseOrigin.firecrawl === 'USER' ? 'default' : 'secondary'} className="text-xs">
                          {data.licenseOrigin.firecrawl === 'USER' ? '직접 입력' : '서버 제공'}
                        </Badge>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <Input
                        id="firecrawl"
                        type={showFirecrawlKey ? 'text' : 'password'}
                        placeholder="키를 입력하거나 변경하려면 새 키를 입력하세요"
                        value={firecrawlApiKey}
                        onChange={(e) => setFirecrawlApiKey(e.target.value)}
                        className="bg-white pr-10"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFirecrawlKey((v) => !v)}
                        className="absolute right-2 text-muted-foreground hover:text-foreground p-1"
                        aria-label={showFirecrawlKey ? '숨기기' : '보기'}
                      >
                        {showFirecrawlKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {data?.hasFirecrawlKey && !firecrawlApiKey && (
                      <p className="text-xs text-muted-foreground">현재 키가 등록되어 있어요.</p>
                    )}
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
