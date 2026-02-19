'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useResearchStore } from '@/lib/stores/research-store'

/** Poll ONLY while status === 'running'. Single source of truth. */
export function AnalysisJobSync() {
  const refreshJobs = useResearchStore((s) => s.refreshJobs)
  const jobs = useResearchStore((s) => s.jobs)
  const hasRunning = Object.values(jobs).some((j) => j.status === 'running')

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const tick = async () => {
      if (!mounted) return
      await refreshJobs()
    }

    const subscribe = async () => {
      const { data } = await supabase.auth.getUser()
      const userId = data.user?.id
      if (!userId) return
      channel = supabase
        .channel('analysis_jobs_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'analysis_jobs',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void tick()
          }
        )
        .subscribe()
    }

    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id) return
      void tick()
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
      void subscribe()
    })

    void tick()
    void subscribe()
    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
      auth.subscription.unsubscribe()
    }
  }, [refreshJobs])

  useEffect(() => {
    if (!hasRunning) return
    const id = window.setInterval(() => void refreshJobs(), 8000)
    return () => window.clearInterval(id)
  }, [hasRunning, refreshJobs])

  return null
}
