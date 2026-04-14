/**
 * 파이프라인 태스크 스냅샷을 세션·로컬에 저장해, DB 동기화 전 단계 재실행 시 참고할 수 있게 한다.
 * sessionStorage는 탭 단위, localStorage는 브라우저 단위로 이어져 탭을 닫았다가 재시도해도 스냅샷을 찾을 수 있다.
 */
const SESSION_PREFIX = 'datamod:pipeline-tasks:v1:'
const LOCAL_PREFIX = 'datamod:pipeline-tasks-local:v1:'

type StoredPayload = {
  tasks: Array<{ step_name: string; status: string; output_data: unknown }>
  taskData: Partial<Record<string, unknown>>
  savedAt: number
}

function parsePayload(raw: string | null): StoredPayload | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as { tasks?: unknown; taskData?: unknown; savedAt?: unknown }
    const tasks = Array.isArray(p.tasks) ? p.tasks : []
    const taskData =
      p.taskData && typeof p.taskData === 'object' && !Array.isArray(p.taskData)
        ? (p.taskData as Partial<Record<string, unknown>>)
        : {}
    const savedAt = typeof p.savedAt === 'number' ? p.savedAt : Date.now()
    return {
      tasks: tasks as Array<{ step_name: string; status: string; output_data: unknown }>,
      taskData,
      savedAt,
    }
  } catch {
    return null
  }
}

function mergeTasksByStep(
  a: Array<{ step_name: string; status: string; output_data: unknown }>,
  b: Array<{ step_name: string; status: string; output_data: unknown }>
): Array<{ step_name: string; status: string; output_data: unknown }> {
  const byStep = new Map<string, { step_name: string; status: string; output_data: unknown }>()
  for (const r of b) {
    byStep.set(r.step_name, r)
  }
  for (const r of a) {
    byStep.set(r.step_name, r)
  }
  return Array.from(byStep.values())
}

export function writePipelineClientCache(
  analysisId: string,
  tasks: Array<{
    step_name: string
    status: string
    output_data: unknown
  }> | null,
  taskData: Partial<Record<string, unknown>>
): void {
  if (typeof window === 'undefined' || !analysisId) return
  try {
    const payload: StoredPayload = {
      tasks: tasks ?? [],
      taskData,
      savedAt: Date.now(),
    }
    const s = JSON.stringify(payload)
    sessionStorage.setItem(SESSION_PREFIX + analysisId, s)
    try {
      localStorage.setItem(LOCAL_PREFIX + analysisId, s)
    } catch {
      /* quota / private mode */
    }
  } catch {
    /* quota / private mode */
  }
}

export function readPipelineClientCache(analysisId: string): {
  tasks: Array<{ step_name: string; status: string; output_data: unknown }>
  taskData: Partial<Record<string, unknown>>
} | null {
  if (typeof window === 'undefined' || !analysisId) return null
  try {
    const session = parsePayload(sessionStorage.getItem(SESSION_PREFIX + analysisId))
    let local: StoredPayload | null = null
    try {
      local = parsePayload(localStorage.getItem(LOCAL_PREFIX + analysisId))
    } catch {
      local = null
    }
    if (!session && !local) return null

    const tasks =
      session && local
        ? mergeTasksByStep(local.tasks, session.tasks)
        : (session ?? local)!.tasks
    const taskData = {
      ...(local?.taskData ?? {}),
      ...(session?.taskData ?? {}),
    }
    return { tasks, taskData }
  } catch {
    return null
  }
}
