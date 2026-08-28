import { describe, expect, it } from 'vitest'
import { createCreativePerformanceRecorderV15 } from './performance.ts'
import { compareMotionPreviewExportParityV15 } from './parity.ts'
import { auditMotionSceneReferencesV15, createMotionResourceLedgerV15, runMotionLongProjectLifecycleV15, runMotionSerializationStressV15 } from './reliability.ts'
import { createV15StressScene, createV15TextParityScene, createV15TrackingStressTracks, runV15CameraStress, runV15SeekStress, runV15TrackingStress, v15StressContext } from './stress.ts'

const countAnimatedProperties = (scene: ReturnType<typeof createV15StressScene>): number => {
  let count = 0
  const inspect = (value: unknown) => { if (value && typeof value === 'object' && (value as { kind?: string }).kind === 'keyframes') count += 1 }
  for (const node of Object.values(scene.nodes)) {
    inspect(node.visible); inspect(node.opacity)
    Object.values(node.transform).forEach(inspect)
    node.masks.forEach((mask) => { inspect(mask.opacity); inspect(mask.feather); inspect(mask.expansion); inspect(mask.x); inspect(mask.y); inspect(mask.width); inspect(mask.height); inspect(mask.radius) })
    if (node.type === 'shape') { inspect(node.width); inspect(node.height); inspect(node.fillColor); inspect(node.strokeColor); inspect(node.strokeWidth); inspect(node.radius) }
  }
  return count
}

describe('V1.5 performance maturity', () => {
  it('records evidence without making wall clock a rendering authority', () => {
    let now = 10
    const recorder = createCreativePerformanceRecorderV15(() => now)
    const value = recorder.measure({ subsystem: 'Motion Graph', operation: 'evaluate', tick: 720_000 }, () => { now = 14.5; return 'render-result' })
    expect(value).toBe('render-result')
    expect(recorder.snapshot()).toEqual([expect.objectContaining({ subsystem: 'Motion Graph', operation: 'evaluate', durationMs: 4.5, tick: 720_000 })])
    expect(recorder.summaries()[0]).toMatchObject({ samples: 1, meanMs: 4.5, p95Ms: 4.5 })
  })

  it('builds the canonical native/animated/mask/expert stress fixture at required scale', () => {
    const scene = createV15StressScene()
    const nativeNodes = Object.values(scene.nodes).filter((node) => node.type !== 'group' && node.type !== 'expert')
    const masks = Object.values(scene.nodes).reduce((sum, node) => sum + node.masks.length, 0)
    expect(nativeNodes.length).toBeGreaterThanOrEqual(500)
    expect(countAnimatedProperties(scene)).toBeGreaterThanOrEqual(2_000)
    expect(masks).toBeGreaterThanOrEqual(20)
    expect(Object.values(scene.nodes).filter((node) => node.type === 'expert').map((node) => node.type === 'expert' ? node.expert.kind : null)).toEqual(['procedural','particles','shader'])
  })

  it('keeps one-shot and prepared preview evaluation bit-equivalent under direct/backward/random seek load', () => {
    const scene = createV15StressScene({ nativeNodeCount: 500, animatedNodeCount: 500, maskedNodeCount: 20 })
    const recorder = createCreativePerformanceRecorderV15()
    const result = runV15SeekStress(scene, recorder)
    expect(result.equal).toBe(true)
    expect(result.nodeCount).toBeGreaterThanOrEqual(504)
    expect(result.baselineMs).toBeGreaterThanOrEqual(0)
    expect(result.preparedMs).toBeGreaterThanOrEqual(0)
    expect(result.expertChecks.every((check) => check.directSeekEqual)).toBe(true)
  }, 30_000)

  it('stresses ten canonical tracks and camera/depth projection without seek-history drift', () => {
    const recorder = createCreativePerformanceRecorderV15()
    const tracks = createV15TrackingStressTracks(10, 160)
    const tracking = runV15TrackingStress(recorder, tracks)
    expect(tracking.trackCount).toBeGreaterThanOrEqual(10)
    expect(tracking.sampleCount).toBeGreaterThanOrEqual(1_600)
    expect(tracking.directSeekEqual).toBe(true)
    const camera = runV15CameraStress(createV15StressScene({ includeExperts: false }), recorder, 24)
    expect(camera.depthBindings).toBeGreaterThanOrEqual(24)
    expect(camera.directSeekEqual).toBe(true)
  }, 30_000)

  it('proves prepared preview and canonical export parity including non-vacuous graph text authority', () => {
    const stress = compareMotionPreviewExportParityV15({ scene: createV15StressScene({ includeExperts: false }), contexts: [0, 720_000, 7_200_000, 12_960_000].map((tick) => v15StressContext(tick)) })
    expect(stress.ok).toBe(true)
    const text = compareMotionPreviewExportParityV15({ scene: createV15TextParityScene(), contexts: [0, 720_000, 7_200_000, 12_960_000].map((tick) => v15StressContext(tick)) })
    expect(text.ok).toBe(true)
    expect(text.checkpoints.every((checkpoint) => checkpoint.equal && checkpoint.textParity && checkpoint.previewHash === checkpoint.exportHash)).toBe(true)
  })

  it('round-trips a large scene repeatedly and releases every sandbox/cache resource', () => {
    const scene = createV15StressScene({ includeExperts: true })
    expect(auditMotionSceneReferencesV15(scene)).toMatchObject({ ok: true })
    expect(runMotionSerializationStressV15(scene, 20)).toMatchObject({ ok: true, cycles: 20 })
    const ledger = createMotionResourceLedgerV15()
    ledger.acquire({ id: 'preview:a', kind: 'preview-cache', ownerId: 'sandbox:a' })
    ledger.acquire({ id: 'sandbox:a', kind: 'sandbox', ownerId: 'sandbox:a' })
    expect(ledger.releaseOwner('sandbox:a')).toBe(2)
    expect(ledger.assertReleased()).toMatchObject({ ok: true })
    expect(runMotionLongProjectLifecycleV15(75)).toMatchObject({ ok: true, finalResources: 0 })
  }, 30_000)
})
