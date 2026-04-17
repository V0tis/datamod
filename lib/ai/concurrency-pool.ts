/**
 * Pool worker: at most `maxConcurrent` invocations of `worker` run at a time.
 * Results are placed in input order (by index).
 */
export async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  maxConcurrent: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = items.length
  if (n === 0) return []
  const results = new Array<R>(n)
  const limit = Math.max(1, Math.min(maxConcurrent, n))
  let next = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const i = next++
      if (i >= n) return
      results[i] = await worker(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()))
  return results
}

export function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  if (chunkSize < 1) return [items.slice()]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize))
  }
  return out
}
