'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
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
import { Eye, EyeOff, User, KeyRound, Loader2, CheckCircle2, XCircle, Wifi, ExternalLink, Cpu, Copy, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDepthEstimates, formatEstimatedTime } from '@/lib/analysis-estimates'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FullPageBrandLoader } from '@/components/full-page-brand-loader'

type LicenseOrigin = 'USER' | 'NONE'

type StepAIModels = {
  ai_market_model: string | null
  ai_competitor_model: string | null
  ai_insight_model: string | null
  ai_strategy_model: string | null
  ai_action_model: string | null
  ai_risk_model: string | null
  ai_creative_model: string | null
  ai_consensus_model: string | null
}

type SettingsData = {
  email: string
  aiPrimaryModel?: 'gemini' | 'groq'
  analysisDepth?: 'fast' | 'standard' | 'deep'
  stepAIModels?: StepAIModels
  hasGeminiKey: boolean
  hasGroqKey?: boolean
  hasSerperKey?: boolean
  hasServerGemini?: boolean
  hasServerGroq?: boolean
  hasServerSerper?: boolean
  licenseOrigin?: { gemini: LicenseOrigin; groq?: LicenseOrigin }
  geminiApiKey?: string
  groqApiKey?: string
  serperApiKey?: string
}

const MASKED_PLACEHOLDER = '••••••••••••••••'

const GEMINI_KEY_PREFIX = 'AIza'
const GROQ_KEY_PREFIX = 'gsk_'

function validateGeminiKey(key: string): { valid: boolean; error?: string } {
  const k = key.trim()
  if (!k) return { valid: true }
  if (k === MASKED_PLACEHOLDER) return { valid: true }
  if (k.length < 30) return { valid: false, error: 'Gemini API 키 형식이 올바르지 않습니다.' }
  if (!k.startsWith(GEMINI_KEY_PREFIX)) return { valid: false, error: 'Gemini API 키는 AIza로 시작합니다.' }
  return { valid: true }
}

function validateGroqKey(key: string): { valid: boolean; error?: string } {
  const k = key.trim()
  if (!k) return { valid: true }
  if (k === MASKED_PLACEHOLDER) return { valid: true }
  if (k.length < 20) return { valid: false, error: 'Groq API 키 형식이 올바르지 않습니다.' }
  if (!k.startsWith(GROQ_KEY_PREFIX)) return { valid: false, error: 'Groq API 키는 gsk_로 시작합니다.' }
  return { valid: true }
}

const ANALYSIS_DEPTH_KEY = 'rin_analysis_depth'
type AnalysisDepth = 'fast' | 'standard' | 'deep'

const ANALYSIS_OPTIONS: { value: AnalysisDepth; label: string }[] = [
  { value: 'fast', label: '빠른 분석' },
  { value: 'standard', label: '표준 분석' },
  { value: 'deep', label: '심층 분석' },
]

const AI_PRIMARY_OPTIONS: {
  value: 'gemini' | 'groq'
  label: string
  tagline: string
  tooltip: string
}[] = [
  {
    value: 'gemini',
    label: 'Gemini',
    tagline: '긴 문맥·멀티모달',
    tooltip:
      'Google Gemini. 긴 컨텍스트로 뉴스·보고서 등 대량 자료를 한 번에 다루기 좋고, 한국어 품질이 안정적입니다. 시장·인사이트 분석에 적합합니다.',
  },
  {
    value: 'groq',
    label: 'Groq',
    tagline: '초저지연·빠른 응답',
    tooltip:
      'Groq LPU 기반으로 응답 지연이 매우 짧습니다. 짧은 루프·반복 호출이 많은 단계에서 유리하며, 빠른 피드백이 필요할 때 유용합니다.',
  },
]

const SETTINGS_TAB_PARAM = 'tab'
const TAB_LICENSE = 'license'
const TAB_PROFILE = 'profile'
const TAB_AI_CONFIG = 'ai-config'

const STEP_AI_FIELDS: { key: keyof StepAIModels; label: string; desc: string }[] = [
  {
    key: 'ai_market_model',
    label: '시장 리서치 AI',
    desc: '트렌드 분석, 시장 데이터 수집, 수집 기사 AI 요약',
  },
  { key: 'ai_competitor_model', label: '경쟁 분석 AI', desc: '경쟁사 환경 및 포지셔닝 분석' },
  { key: 'ai_insight_model', label: '인사이트 AI', desc: '핵심 인사이트 및 시사점 추출' },
  { key: 'ai_strategy_model', label: '전략 생성 AI', desc: '전략적 추천 및 방향성 생성' },
  { key: 'ai_action_model', label: 'PM 액션 AI', desc: 'PM 액션 플랜 및 실행 계획 수립' },
  { key: 'ai_risk_model', label: '리스크 분석 AI', desc: '리스크 평가 및 전략 검증' },
  { key: 'ai_creative_model', label: 'Creative AI', desc: 'Creative 관점 분석 및 대안 도출' },
  { key: 'ai_consensus_model', label: 'Consensus AI', desc: '멀티 AI 결과 종합 및 교차 검증' },
]

function SettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get(SETTINGS_TAB_PARAM)
  const activeTab = tabFromUrl === TAB_LICENSE ? TAB_LICENSE : tabFromUrl === TAB_AI_CONFIG ? TAB_AI_CONFIG : TAB_PROFILE

  const setActiveTab = (value: string) => {
    const query = value === TAB_PROFILE ? '' : `?${SETTINGS_TAB_PARAM}=${value}`
    router.replace(`/settings${query}`)
  }

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettingsData | null>(null)
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [editingGemini, setEditingGemini] = useState(false)
  const [editingGroq, setEditingGroq] = useState(false)
  const [serperApiKey, setSerperApiKey] = useState('')
  const [showSerperKey, setShowSerperKey] = useState(false)
  const [editingSerper, setEditingSerper] = useState(false)
  const [savingSerper, setSavingSerper] = useState(false)
  const [saveSuccessSerper, setSaveSuccessSerper] = useState(false)
  const [savingGemini, setSavingGemini] = useState(false)
  const [savingGroq, setSavingGroq] = useState(false)
  const [testingGemini, setTestingGemini] = useState(false)
  const [testingGroq, setTestingGroq] = useState(false)
  const [saveSuccessGemini, setSaveSuccessGemini] = useState(false)
  const [saveSuccessGroq, setSaveSuccessGroq] = useState(false)
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>('standard')
  const [aiPrimaryModel, setAiPrimaryModel] = useState<'gemini' | 'groq'>('gemini')
  const [stepAIModels, setStepAIModels] = useState<StepAIModels>({
    ai_market_model: null, ai_competitor_model: null, ai_insight_model: null, ai_strategy_model: null,
    ai_action_model: null, ai_risk_model: null, ai_creative_model: null, ai_consensus_model: null,
  })
  const [savingStepAI, setSavingStepAI] = useState(false)
  const [geminiConnVerified, setGeminiConnVerified] = useState(false)
  const [groqConnVerified, setGroqConnVerified] = useState(false)
  const [llmUsage, setLlmUsage] = useState<{
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    callCount: number
  } | null>(null)

  useEffect(() => {
    setGeminiConnVerified(false)
  }, [geminiApiKey])

  useEffect(() => {
    setGroqConnVerified(false)
  }, [groqApiKey])

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
    void fetch('/api/settings/llm-usage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        if (
          j &&
          typeof j === 'object' &&
          'callCount' in j &&
          typeof (j as { callCount: unknown }).callCount === 'number'
        ) {
          const o = j as {
            totalPromptTokens: number
            totalCompletionTokens: number
            totalTokens: number
            callCount: number
          }
          setLlmUsage({
            totalPromptTokens: o.totalPromptTokens ?? 0,
            totalCompletionTokens: o.totalCompletionTokens ?? 0,
            totalTokens: o.totalTokens ?? 0,
            callCount: o.callCount,
          })
        }
      })
      .catch(() => setLlmUsage(null))
    fetch('/api/settings', { credentials: 'include' })
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
          setAiPrimaryModel(json.aiPrimaryModel === 'groq' ? 'groq' : 'gemini')
          if (json.analysisDepth === 'fast' || json.analysisDepth === 'standard' || json.analysisDepth === 'deep') {
            setAnalysisDepth(json.analysisDepth)
            try { window.localStorage.setItem(ANALYSIS_DEPTH_KEY, json.analysisDepth) } catch { /* ignore */ }
          }
          setGeminiApiKey(typeof json.geminiApiKey === 'string' ? json.geminiApiKey : '')
          setGroqApiKey(typeof json.groqApiKey === 'string' ? json.groqApiKey : '')
          setSerperApiKey(typeof json.serperApiKey === 'string' ? json.serperApiKey : '')
          if (json.stepAIModels) setStepAIModels(json.stepAIModels)
        }
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '설정을 불러오지 못했습니다.' }))
      .finally(() => setLoading(false))
  }, [user, router])


  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(ANALYSIS_DEPTH_KEY)
    if (stored === 'fast' || stored === 'standard' || stored === 'deep') {
      setAnalysisDepth(stored)
    }
  }, [])

  const handleAnalysisDepthChange = async (value: AnalysisDepth) => {
    setAnalysisDepth(value)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_depth: value }),
      })
      if (!res.ok) throw new Error('저장 실패')
      setData((prev) => (prev ? { ...prev, analysisDepth: value } : null))
      if (typeof window !== 'undefined') {
        localStorage.setItem(ANALYSIS_DEPTH_KEY, value)
      }
      toast.success('분석 깊이가 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
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

  const handleStepAIChange = (key: keyof StepAIModels, value: 'gemini' | 'groq' | null) => {
    setStepAIModels((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveStepAI = async () => {
    setSavingStepAI(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stepAIModels),
      })
      if (!res.ok) throw new Error('저장 실패')
      toast.success('단계별 AI 설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSavingStepAI(false)
    }
  }

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const rawKey = geminiApiKey.trim()
    if (rawKey && rawKey !== MASKED_PLACEHOLDER) {
      const val = validateGeminiKey(geminiApiKey)
      if (!val.valid) {
        toast.error(val.error ?? '유효하지 않은 키입니다.')
        return
      }
    }
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
      const nextRes = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      if (nextRes.ok) {
        const nextJson = (await nextRes.json()) as SettingsData
        setData(nextJson)
        setGeminiApiKey(typeof nextJson.geminiApiKey === 'string' ? nextJson.geminiApiKey : '')
      } else {
        setGeminiApiKey('')
      }
      toast.success('Gemini API 키가 저장되었습니다.')
      setSaveSuccessGemini(true)
      setTimeout(() => setSaveSuccessGemini(false), 3000)
    } finally {
      setSavingGemini(false)
    }
  }

  const handleSaveGroq = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const rawKey = groqApiKey.trim()
    if (rawKey && rawKey !== MASKED_PLACEHOLDER) {
      const val = validateGroqKey(groqApiKey)
      if (!val.valid) {
        toast.error(val.error ?? '유효하지 않은 키입니다.')
        return
      }
    }
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
      const nextRes = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      if (nextRes.ok) {
        const nextJson = (await nextRes.json()) as SettingsData
        setData(nextJson)
        setGroqApiKey(typeof nextJson.groqApiKey === 'string' ? nextJson.groqApiKey : '')
      } else {
        setGroqApiKey('')
      }
      toast.success('Groq API 키가 저장되었습니다.')
      setSaveSuccessGroq(true)
      setTimeout(() => setSaveSuccessGroq(false), 3000)
    } finally {
      setSavingGroq(false)
    }
  }

  const handleSaveSerper = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const rawKey = serperApiKey.trim()
    if (rawKey && rawKey !== MASKED_PLACEHOLDER && rawKey.length < 20) {
      toast.error('Serper API 키 형식이 올바르지 않습니다.')
      return
    }
    setSavingSerper(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serper_api_key: serperApiKey || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(json, { fallbackMessage: '저장에 실패했습니다.' })
        return
      }
      const nextRes = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      if (nextRes.ok) {
        const nextJson = (await nextRes.json()) as SettingsData
        setData(nextJson)
        setSerperApiKey(typeof nextJson.serperApiKey === 'string' ? nextJson.serperApiKey : '')
      } else {
        setSerperApiKey('')
      }
      toast.success('Serper API 키가 저장되었습니다.')
      setSaveSuccessSerper(true)
      setTimeout(() => setSaveSuccessSerper(false), 3000)
    } finally {
      setSavingSerper(false)
    }
  }

  const handleTestConnection = useCallback(async (provider: 'gemini' | 'groq') => {
    const key = provider === 'gemini' ? geminiApiKey : groqApiKey
    const val = provider === 'gemini' ? validateGeminiKey(key) : validateGroqKey(key)
    if (!val.valid) {
      toast.error(val.error ?? '유효하지 않은 키입니다.')
      return
    }
    if (!key || key === MASKED_PLACEHOLDER) {
      toast.error('테스트할 API 키를 입력해 주세요.')
      return
    }
    if (provider === 'gemini') setTestingGemini(true)
    else setTestingGroq(true)
    try {
      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.ok) {
        if (provider === 'gemini') setGeminiConnVerified(true)
        else setGroqConnVerified(true)
        toast.success(`${provider === 'gemini' ? 'Gemini' : 'Groq'} 연결에 성공했습니다.`)
      } else {
        if (provider === 'gemini') setGeminiConnVerified(false)
        else setGroqConnVerified(false)
        toast.error(json?.error ?? '연결에 실패했습니다.')
      }
    } catch {
      if (provider === 'gemini') setGeminiConnVerified(false)
      else setGroqConnVerified(false)
      toast.error('연결 확인 중 오류가 발생했습니다.')
    } finally {
      if (provider === 'gemini') setTestingGemini(false)
      else setTestingGroq(false)
    }
  }, [geminiApiKey, groqApiKey])

  const copyApiKeyToClipboard = useCallback(async (raw: string, label: string) => {
    const v = raw.trim()
    if (!v || v === MASKED_PLACEHOLDER) {
      toast.error('복사할 수 있는 키가 없습니다. 키를 입력하거나 편집한 뒤 다시 시도해 주세요.')
      return
    }
    try {
      await navigator.clipboard.writeText(v)
      toast.success(`${label} 키가 클립보드에 복사되었습니다.`)
    } catch {
      toast.error('클립보드 복사에 실패했습니다.')
    }
  }, [])

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

  const getSerperKeyState = () => {
    const hasUser = !!data?.hasSerperKey
    const hasServer = !!data?.hasServerSerper
    const placeholder = hasServer && !hasUser ? MASKED_PLACEHOLDER : hasUser ? MASKED_PLACEHOLDER : '키를 입력하세요'
    const canReveal = serperApiKey.length > 0
    const showMask = hasUser && !serperApiKey && !editingSerper
    const displayValue = serperApiKey || (showMask ? MASKED_PLACEHOLDER : '')
    return { value: displayValue, hasUser, hasServer, placeholder, canReveal, show: showSerperKey, setShow: setShowSerperKey, setValue: setSerperApiKey, setEditing: setEditingSerper }
  }

  const geminiConnected = !!(data?.hasGeminiKey || data?.hasServerGemini)
  const groqConnected = !!(data?.hasGroqKey || data?.hasServerGroq)
  const serperConnected = !!(data?.hasSerperKey || data?.hasServerSerper)

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
      <div className="rin-page">
        <div className="mx-auto w-full max-w-5xl">
        <header className="rin-page-header">
          <div className="h-8 w-24 rounded bg-muted/50 animate-pulse mb-2" />
          <div className="h-4 w-56 rounded bg-muted/30 animate-pulse" />
        </header>
        <div className="w-full max-w-md grid grid-cols-2 gap-1 h-9 rounded-lg bg-muted/30 p-1 mb-6">
          <div className="rounded-md bg-muted/40 animate-pulse" />
          <div className="rounded-md bg-muted/40 animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <div className="h-5 w-32 rounded bg-muted/50 animate-pulse mb-3" />
              <div className="h-10 w-full rounded bg-muted/30 animate-pulse mb-2" />
              <div className="h-4 w-48 rounded bg-muted/20 animate-pulse" />
            </div>
          ))}
        </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={280}>
    <div className="rin-page">
      <div className="mx-auto w-full max-w-5xl">
      <header className="rin-page-header">
        <h1 className="rin-page-title">설정</h1>
        <p className="rin-page-subtitle mb-1">
          내 정보와 분석용 API 키를 관리하세요.
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full rin-section gap-0">
        <TabsList className="w-full max-w-lg grid grid-cols-3 min-h-10 sm:h-10 rounded-lg bg-muted/50 p-1 gap-1">
          <TabsTrigger value="profile" className="rounded-md gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            내 정보
          </TabsTrigger>
          <TabsTrigger value="license" className="rounded-md gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <KeyRound className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            라이선스
          </TabsTrigger>
          <TabsTrigger value="ai-config" className="rounded-md gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">AI 분석 설정</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="m-0 mt-4 sm:mt-6">
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">내 정보</CardTitle>
              <CardDescription>로그인 이메일과 비밀번호를 한곳에서 확인·변경합니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 sm:gap-8 pb-6 sm:pb-8">
              <div className="max-w-md space-y-2 min-w-0">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={data?.email ?? ''}
                  readOnly
                  className="cursor-not-allowed border-[#E5E7EB] bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/80"
                />
              </div>
              {user && <ChangePasswordForm user={user} userEmail={(data?.email ?? user.email ?? '').trim()} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="license" className="m-0 mt-4 sm:mt-6 rin-section">
          {/* 1. AI Provider Settings */}
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">AI Provider 설정</CardTitle>
              <CardDescription>시장 분석에 사용되는 AI API 키를 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Gemini API Key */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Gemini API Key</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    시장 신호 분석, 뉴스 요약, 인사이트 생성에 사용됩니다. Google AI Studio에서 발급받을 수 있습니다.
                  </p>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    Google AI Studio에서 API 키 발급 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <form onSubmit={handleSaveGemini} className="space-y-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                      <div className="relative min-w-0 flex-1">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 w-full gap-1.5 sm:w-auto"
                        onClick={() => copyApiKeyToClipboard(geminiApiKey, 'Gemini API')}
                      >
                        <Copy className="h-4 w-4" />
                        복사
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="submit" disabled={savingGemini} className="shrink-0">
                        {savingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
                      </Button>
                      <Button
                        type="button"
                        variant={geminiConnVerified ? 'default' : 'outline'}
                        size="default"
                        className={cn(
                          geminiConnVerified &&
                            'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:ring-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-600'
                        )}
                        disabled={
                          testingGemini ||
                          geminiConnVerified ||
                          !geminiApiKey ||
                          geminiApiKey === MASKED_PLACEHOLDER
                        }
                        onClick={() => handleTestConnection('gemini')}
                        title={geminiConnVerified ? '연결됨' : '연결 테스트'}
                      >
                        {testingGemini ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : geminiConnVerified ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Wifi className="h-4 w-4" />
                        )}
                        {geminiConnVerified ? '연결됨' : '연결 테스트'}
                      </Button>
                      {saveSuccessGemini && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
                          <CheckCircle2 className="h-4 w-4" /> 저장됨
                        </span>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* Groq API Key */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Groq API Key</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Logic·Creative·Fact 탭별 AI 인사이트, 합의 요약에 사용됩니다. Groq Console에서 발급받을 수 있습니다.
                  </p>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    Groq Console에서 API 키 발급 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <form onSubmit={handleSaveGroq} className="space-y-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                      <div className="relative min-w-0 flex-1">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 w-full gap-1.5 sm:w-auto"
                        onClick={() => copyApiKeyToClipboard(groqApiKey, 'Groq API')}
                      >
                        <Copy className="h-4 w-4" />
                        복사
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="submit" disabled={savingGroq}>
                        {savingGroq ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
                      </Button>
                      <Button
                        type="button"
                        variant={groqConnVerified ? 'default' : 'outline'}
                        size="default"
                        className={cn(
                          groqConnVerified &&
                            'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:ring-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-600'
                        )}
                        disabled={
                          testingGroq ||
                          groqConnVerified ||
                          !groqApiKey ||
                          groqApiKey === MASKED_PLACEHOLDER
                        }
                        onClick={() => handleTestConnection('groq')}
                        title={groqConnVerified ? '연결됨' : '연결 테스트'}
                      >
                        {testingGroq ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : groqConnVerified ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Wifi className="h-4 w-4" />
                        )}
                        {groqConnVerified ? '연결됨' : '연결 테스트'}
                      </Button>
                      {saveSuccessGroq && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
                          <CheckCircle2 className="h-4 w-4" /> 저장됨
                        </span>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* Serper API Key */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Serper API Key (웹 검색)</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    트렌드 분석·경쟁사 검색 시 키워드로 웹 검색 후 상위 소스를 LLM 컨텍스트로 전달합니다. 미설정 시 경쟁사·포지셔닝이 나오지 않을 수 있습니다.
                  </p>
                  <a
                    href="https://serper.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    Serper에서 API 키 발급 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <form onSubmit={handleSaveSerper} className="space-y-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                      <div className="relative min-w-0 flex-1">
                        <Input
                          type={getSerperKeyState().show && getSerperKeyState().canReveal ? 'text' : 'password'}
                          placeholder={getSerperKeyState().placeholder}
                          value={getSerperKeyState().value}
                          onChange={(e) => setSerperApiKey(e.target.value)}
                          onFocus={() => getSerperKeyState().hasUser && !serperApiKey && setEditingSerper(true)}
                          onBlur={() => setEditingSerper(false)}
                          className="pr-10 bg-muted/50 focus:bg-background"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => getSerperKeyState().canReveal && setShowSerperKey(!showSerperKey)}
                          title={getSerperKeyState().canReveal ? (showSerperKey ? '숨기기' : '보기') : '입력한 키만 확인할 수 있습니다'}
                          className={cn('absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded', getSerperKeyState().canReveal ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50 cursor-default')}
                          aria-label={showSerperKey ? '숨기기' : '보기'}
                        >
                          {showSerperKey && getSerperKeyState().canReveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 w-full gap-1.5 sm:w-auto"
                        onClick={() => copyApiKeyToClipboard(serperApiKey, 'Serper API')}
                      >
                        <Copy className="h-4 w-4" />
                        복사
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="submit" disabled={savingSerper}>
                        {savingSerper ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
                      </Button>
                      {saveSuccessSerper && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
                          <CheckCircle2 className="h-4 w-4" /> 저장됨
                        </span>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* 2. System Status */}
          <Card className="border border-border bg-card shadow-sm rounded-xl">
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
                <div className="flex items-center gap-3 rounded-lg border border-border/80 p-4">
                  {serperConnected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Serper API (웹 검색)</p>
                    <p className="text-sm text-muted-foreground">{serperConnected ? '연결됨' : '연결되지 않음'}</p>
                  </div>
                </div>
                {llmUsage != null && (
                  <div className="sm:col-span-2 rounded-lg border border-border/80 bg-muted/20 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      분석 LLM 누적 사용량 (이 계정)
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      파이프라인 완료 시점에 기록됩니다. API가 반환한 토큰 수이며, 일부 호출은 추정치만 포함될 수 있습니다.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">총 토큰</p>
                        <p className="font-semibold tabular-nums">{llmUsage.totalTokens.toLocaleString('ko-KR')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">프롬프트</p>
                        <p className="font-semibold tabular-nums">{llmUsage.totalPromptTokens.toLocaleString('ko-KR')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">완성</p>
                        <p className="font-semibold tabular-nums">{llmUsage.totalCompletionTokens.toLocaleString('ko-KR')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">LLM 호출</p>
                        <p className="font-semibold tabular-nums">{llmUsage.callCount.toLocaleString('ko-KR')}회</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI 분석 설정 탭 */}
        <TabsContent value="ai-config" className="m-0 mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          {/* 기본 분석 설정 (License에서 이동) */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">기본 분석 설정</CardTitle>
              <CardDescription>분석 깊이와 기본 AI 모델을 선택합니다. 단계별 설정이 없으면 기본 모델이 사용됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 sm:space-y-8">
              <div className="min-w-0">
                <Label className="text-sm font-medium mb-2 block">분석 깊이</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  빠른 분석은 결과를 신속히 제공하고, 심층 분석은 더 많은 소스와 상세 인사이트를 생성합니다.
                </p>
                <div className="flex flex-wrap gap-2 p-1 rounded-lg bg-muted/50 w-full sm:w-fit min-w-0">
                  {ANALYSIS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleAnalysisDepthChange(opt.value)}
                      className={cn(
                        'px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-10',
                        analysisDepth === opt.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(() => {
                  const est = getDepthEstimates(analysisDepth)
                  return (
                    <p className="text-xs text-muted-foreground mt-2">
                      예상 시간 {formatEstimatedTime(est.estimatedTimeSec)} · 예상 토큰 약 {(est.estimatedTokens / 1000).toFixed(0)}K
                    </p>
                  )
                })()}
              </div>
              <div className="min-w-0">
                <Label className="text-sm font-medium mb-2 block">AI 우선 분석 모델 (기본값)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  단계별 설정이 없는 분석 단계에서 사용됩니다. 실패할 경우 다른 AI 모델이 자동으로 대체 실행됩니다.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {AI_PRIMARY_OPTIONS.map((opt) => {
                    const selected = aiPrimaryModel === opt.value
                    return (
                      <Tooltip key={opt.value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleAiPrimaryChange(opt.value)}
                            aria-pressed={selected}
                            className={cn(
                              'group relative text-left rounded-xl border-2 p-4 sm:p-5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[5.5rem]',
                              selected
                                ? 'border-primary bg-gradient-to-br from-primary/12 via-primary/[0.06] to-transparent shadow-sm ring-1 ring-primary/15'
                                : 'border-border bg-card hover:border-primary/35 hover:bg-muted/35'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-base font-semibold tracking-tight">{opt.label}</span>
                                  {selected && (
                                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                      선택
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{opt.tagline}</p>
                              </div>
                              <HelpCircle
                                className="h-4 w-4 shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors"
                                aria-hidden
                              />
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="leading-relaxed max-w-[min(20rem,calc(100vw-2rem))]">
                          {opt.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 단계별 AI 모델 설정 */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">단계별 AI 모델 설정</CardTitle>
              <CardDescription>각 분석 단계마다 사용할 AI 모델을 개별적으로 선택할 수 있습니다. &quot;기본값&quot;을 선택하면 위의 우선 분석 모델이 사용됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {STEP_AI_FIELDS.map((field) => {
                const current = stepAIModels[field.key]
                return (
                  <div
                    key={field.key}
                    className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 py-4 sm:py-3.5 border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{field.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{field.desc}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 p-0.5 rounded-lg bg-muted/50 shrink-0 w-full sm:w-auto justify-stretch sm:justify-end">
                      {([
                        { value: null, label: '기본값' },
                        { value: 'gemini' as const, label: 'Gemini' },
                        { value: 'groq' as const, label: 'Groq' },
                      ]).map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => handleStepAIChange(field.key, opt.value)}
                          className={cn(
                            'min-h-9 min-w-0 flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                            current === opt.value
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="pt-4">
                <Button onClick={handleSaveStepAI} disabled={savingStepAI}>
                  {savingStepAI ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  단계별 설정 저장
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
    </TooltipProvider>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<FullPageBrandLoader />}>
      <SettingsPageInner />
    </Suspense>
  )
}
