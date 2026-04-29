'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { User, Loader2, ExternalLink, Cpu, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDepthEstimates, formatEstimatedTime } from '@/lib/analysis-estimates'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FullPageBrandLoader } from '@/components/full-page-brand-loader'

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

type SettingsTab = 'profile' | 'ai-settings'
type ProviderKey = 'gemini' | 'groq'
type ConnectionStatus = 'unconfigured' | 'connected' | 'failed' | 'testing'

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SettingsData | null>(null)
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [serperApiKey, setSerperApiKey] = useState('')
  const [saving, setSaving] = useState<ProviderKey | null>(null)
  const [savingSerper, setSavingSerper] = useState(false)
  const [testing, setTesting] = useState<ProviderKey | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<Record<ProviderKey, ConnectionStatus>>({
    gemini: 'unconfigured',
    groq: 'unconfigured',
  })
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>('standard')
  const [aiPrimaryModel, setAiPrimaryModel] = useState<'gemini' | 'groq'>('gemini')
  const [stepAIModels, setStepAIModels] = useState<StepAIModels>({
    ai_market_model: null, ai_competitor_model: null, ai_insight_model: null, ai_strategy_model: null,
    ai_action_model: null, ai_risk_model: null, ai_creative_model: null, ai_consensus_model: null,
  })
  const [savingStepAI, setSavingStepAI] = useState(false)
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
          setConnectionStatus({
            gemini: json.hasGeminiKey ? 'connected' : 'unconfigured',
            groq: json.hasGroqKey ? 'connected' : 'unconfigured',
          })
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

  const handleSaveApiKey = useCallback(
    async (provider: ProviderKey, value: string) => {
      if (!user) return
      const validation = provider === 'gemini' ? validateGeminiKey(value) : validateGroqKey(value)
      if (!validation.valid) {
        toast.error(validation.error ?? '유효하지 않은 키입니다.')
        return
      }

      setSaving(provider)
      const trimmed = value.trim()
      const hasValue = trimmed.length > 0
      const previous = connectionStatus[provider]
      setConnectionStatus((prev) => ({ ...prev, [provider]: hasValue ? 'connected' : 'unconfigured' }))

      try {
        const body =
          provider === 'gemini'
            ? { gemini_api_key: trimmed || undefined }
            : { groq_api_key: trimmed || undefined }
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setConnectionStatus((prev) => ({ ...prev, [provider]: previous }))
          showErrorToast(json, { fallbackMessage: '저장에 실패했습니다.' })
          return
        }
        setData((prev) =>
          prev
            ? {
                ...prev,
                hasGeminiKey: provider === 'gemini' ? hasValue : prev.hasGeminiKey,
                hasGroqKey: provider === 'groq' ? hasValue : prev.hasGroqKey,
              }
            : prev
        )
        toast.success(`${provider === 'gemini' ? 'Gemini' : 'Groq'} API 키가 저장되었습니다.`)
      } catch {
        setConnectionStatus((prev) => ({ ...prev, [provider]: previous }))
        toast.error('저장에 실패했습니다.')
      } finally {
        setSaving(null)
      }
    },
    [user, connectionStatus]
  )

  const handleSaveSerper = async () => {
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
      setData((prev) => (prev ? { ...prev, hasSerperKey: !!rawKey } : prev))
      toast.success('Serper API 키가 저장되었습니다.')
    } finally {
      setSavingSerper(false)
    }
  }

  const handleTestConnection = useCallback(async (provider: ProviderKey) => {
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
    setTesting(provider)
    setConnectionStatus((prev) => ({ ...prev, [provider]: 'testing' }))
    try {
      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.ok) {
        setConnectionStatus((prev) => ({ ...prev, [provider]: 'connected' }))
        toast.success(`${provider === 'gemini' ? 'Gemini' : 'Groq'} 연결에 성공했습니다.`)
      } else {
        setConnectionStatus((prev) => ({ ...prev, [provider]: 'failed' }))
        toast.error(json?.error ?? '연결에 실패했습니다.')
      }
    } catch {
      setConnectionStatus((prev) => ({ ...prev, [provider]: 'failed' }))
      toast.error('연결 확인 중 오류가 발생했습니다.')
    } finally {
      setTesting(null)
    }
  }, [geminiApiKey, groqApiKey])

  const hasConfiguredAnyKey = [geminiApiKey, groqApiKey, serperApiKey].some((key) => key.trim().length > 0)

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

      <div className="mb-8 border-b border-gray-200">
        <div className="flex gap-0">
          {[
            { id: 'profile' as const, label: '내 정보', icon: User },
            { id: 'ai-settings' as const, label: 'AI 분석 설정', icon: Cpu },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="max-w-lg space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">이메일</label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              {data?.email ?? ''}
              <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">인증 완료</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호 변경</label>
            {user && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <ChangePasswordForm user={user} userEmail={(data?.email ?? user.email ?? '').trim()} />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai-settings' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {([
              {
                type: 'gemini' as const,
                label: 'Gemini API',
                description: '시장 신호 분석, 뉴스 요약, 인사이트 생성에 사용됩니다.',
                docsUrl: 'https://aistudio.google.com/apikey',
                value: geminiApiKey,
                setValue: setGeminiApiKey,
              },
              {
                type: 'groq' as const,
                label: 'Groq API',
                description: 'Logic·Creative·Fact 인사이트와 합의 요약에 사용됩니다.',
                docsUrl: 'https://console.groq.com/keys',
                value: groqApiKey,
                setValue: setGroqApiKey,
              },
            ]).map((item) => {
              const status = connectionStatus[item.type]
              return (
                <div key={item.type} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                        {status === 'connected' && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ 연결됨</span>
                        )}
                        {status === 'failed' && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">연결 실패</span>
                        )}
                        {status === 'unconfigured' && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">미설정</span>
                        )}
                        {status === 'testing' && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">테스트 중</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="API 키를 입력하세요"
                      value={item.value}
                      onChange={(e) => item.setValue(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveApiKey(item.type, item.value)}
                      className="rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      {saving === item.type ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTestConnection(item.type)}
                      disabled={!item.value || testing === item.type}
                      className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {testing === item.type ? <Loader2 className="h-4 w-4 animate-spin" /> : '테스트'}
                    </button>
                  </div>
                  <a
                    href={item.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                  >
                    {item.label} 발급 방법 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="mb-2 text-sm font-semibold text-gray-900">Serper API (웹 검색)</p>
            <p className="mb-3 text-xs text-gray-400">트렌드/경쟁사 웹 검색 데이터 수집에 사용됩니다.</p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="API 키를 입력하세요"
                value={serperApiKey}
                onChange={(e) => setSerperApiKey(e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => void handleSaveSerper()}
                disabled={savingSerper}
                className="rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                {savingSerper ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
              </button>
            </div>
            <a
              href="https://serper.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
            >
              Serper API 발급 방법 <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {hasConfiguredAnyKey && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">시스템 상태</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Gemini', status: connectionStatus.gemini },
                  { name: 'Groq', status: connectionStatus.groq },
                  { name: 'Serper', status: serperApiKey.trim().length > 0 ? 'connected' : 'unconfigured' as ConnectionStatus },
                ].map((item) => (
                  <div
                    key={item.name}
                    className={cn(
                      'rounded-xl border p-3 text-center',
                      item.status === 'connected' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'mb-0.5 text-xs font-semibold',
                        item.status === 'connected' ? 'text-green-700' : 'text-gray-500'
                      )}
                    >
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-400">{item.status === 'connected' ? '✓ 연결됨' : '미설정'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  상황에 따라 필요한 분석 깊이가 달라 한 가지 방식만으로는 유연한 대응이 어려워, 빠른·표준·심층 세 가지
                  유형을 제공합니다.
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
        </div>
      )}
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
