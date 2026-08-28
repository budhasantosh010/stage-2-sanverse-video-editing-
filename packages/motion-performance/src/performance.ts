export interface CreativePerformanceSampleV1 {
  readonly subsystem: string
  readonly operation: string
  readonly durationMs: number
  readonly tick?: number
  readonly nodeCount?: number
  readonly animatedPropertyCount?: number
  readonly memoryBytes?: number
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface CreativePerformanceSummaryV15 {
  readonly subsystem: string
  readonly operation: string
  readonly samples: number
  readonly totalMs: number
  readonly meanMs: number
  readonly minMs: number
  readonly maxMs: number
  readonly p50Ms: number
  readonly p95Ms: number
}

export interface CreativePerformanceRecorderV15 {
  readonly record: (sample: CreativePerformanceSampleV1) => CreativePerformanceSampleV1
  readonly measure: <T>(input: Readonly<Omit<CreativePerformanceSampleV1, 'durationMs'>>, operation: () => T) => T
  readonly measureAsync: <T>(input: Readonly<Omit<CreativePerformanceSampleV1, 'durationMs'>>, operation: () => Promise<T>) => Promise<T>
  readonly snapshot: () => readonly CreativePerformanceSampleV1[]
  readonly summaries: () => readonly CreativePerformanceSummaryV15[]
  readonly clear: () => void
}

const round6 = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
const percentile = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))
  return sorted[index] ?? 0
}

/**
 * Wall-clock timing is evidence only. It is intentionally injected and never
 * used to calculate visual state, ticks, animation progress, seeds or export
 * output. Tests can inject a deterministic clock without changing rendering.
 */
export const createCreativePerformanceRecorderV15 = (
  now: () => number = () => Date.now(),
): CreativePerformanceRecorderV15 => {
  let samples: CreativePerformanceSampleV1[] = []
  const record = (sample: CreativePerformanceSampleV1): CreativePerformanceSampleV1 => {
    if (!sample.subsystem.trim() || !sample.operation.trim()) throw new RangeError('Performance sample subsystem and operation are required.')
    if (!Number.isFinite(sample.durationMs) || sample.durationMs < 0) throw new RangeError('Performance duration must be finite and non-negative.')
    const frozen = Object.freeze({
      ...sample,
      durationMs: round6(sample.durationMs),
      ...(sample.metadata ? { metadata: Object.freeze({ ...sample.metadata }) } : {}),
    })
    samples.push(frozen)
    return frozen
  }
  const measure = <T>(input: Readonly<Omit<CreativePerformanceSampleV1, 'durationMs'>>, operation: () => T): T => {
    const start = now()
    try {
      return operation()
    } finally {
      record({ ...input, durationMs: Math.max(0, now() - start) })
    }
  }
  const measureAsync = async <T>(input: Readonly<Omit<CreativePerformanceSampleV1, 'durationMs'>>, operation: () => Promise<T>): Promise<T> => {
    const start = now()
    try {
      return await operation()
    } finally {
      record({ ...input, durationMs: Math.max(0, now() - start) })
    }
  }
  return Object.freeze({
    record,
    measure,
    measureAsync,
    snapshot: () => Object.freeze([...samples]),
    summaries: () => {
      const groups = new Map<string, CreativePerformanceSampleV1[]>()
      for (const sample of samples) {
        const key = `${sample.subsystem}\u0000${sample.operation}`
        const group = groups.get(key) ?? []
        group.push(sample)
        groups.set(key, group)
      }
      return Object.freeze([...groups.entries()].map(([key, group]) => {
        const [subsystem = '', operation = ''] = key.split('\u0000')
        const durations = group.map((sample) => sample.durationMs).sort((a, b) => a - b)
        const total = durations.reduce((sum, value) => sum + value, 0)
        return Object.freeze({
          subsystem,
          operation,
          samples: durations.length,
          totalMs: round6(total),
          meanMs: round6(total / Math.max(1, durations.length)),
          minMs: round6(durations[0] ?? 0),
          maxMs: round6(durations.at(-1) ?? 0),
          p50Ms: round6(percentile(durations, 0.5)),
          p95Ms: round6(percentile(durations, 0.95)),
        })
      }).sort((a, b) => a.subsystem.localeCompare(b.subsystem) || a.operation.localeCompare(b.operation)))
    },
    clear: () => { samples = [] },
  })
}
