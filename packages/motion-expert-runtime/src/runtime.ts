import { creativeRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { validateMotionExpertSpecV1, type MotionExpertSpecV1 } from '@sanverse/motion-graph'

export const MOTION_EXPERT_TICKS_PER_SECOND_V1 = 1_440_000 as const

export interface MotionExpertRingPrimitiveV1 {
  readonly id: string
  readonly kind: 'ring'
  readonly centerX: number
  readonly centerY: number
  readonly radius: number
  readonly thickness: number
  readonly rotationDeg: number
  readonly opacity: number
}
export interface MotionExpertParticlePrimitiveV1 {
  readonly id: string
  readonly kind: 'particle'
  readonly x: number
  readonly y: number
  readonly size: number
  readonly opacity: number
  readonly rotationDeg: number
  readonly hue: number
}
export type MotionExpertPrimitiveV1 = MotionExpertRingPrimitiveV1 | MotionExpertParticlePrimitiveV1

export interface MotionExpertShaderPlanV1 {
  readonly program: 'plasma-field'
  readonly uniforms: Readonly<{
    canonicalTick: number
    seconds: number
    seed: number
    seedPhase: number
    frequency: number
    amplitude: number
    hueShift: number
    scale: number
  }>
  /** Bounded browser preview plan for the fixed shader program. It is data, never arbitrary CSS/source input. */
  readonly cssBackground: string
}

export interface MotionExpertRuntimeFrameV1 {
  readonly schemaVersion: 'sanverse.motion-expert-frame/v1'
  readonly tick: number
  readonly ticksPerSecond: 1_440_000
  readonly kind: MotionExpertSpecV1['kind']
  readonly program: MotionExpertSpecV1['program']
  readonly seed: number
  readonly width: number
  readonly height: number
  readonly primitives: readonly MotionExpertPrimitiveV1[]
  readonly shader: MotionExpertShaderPlanV1 | null
  readonly resourceUsage: Readonly<{
    primitiveCount: number
    referencedAssetCount: number
    workUnits: number
  }>
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const finite = (value: number): number => Number.isFinite(value) ? value : 0
const round6 = (value: number): number => Math.round(finite(value) * 1_000_000) / 1_000_000
const hash32 = (seed: number, index: number, salt: number): number => {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value ^= value >>> 16
  return value >>> 0
}
const noise01 = (seed: number, index: number, salt: number): number => hash32(seed, index, salt) / 0xffffffff
const fixed = (value: number): string => round6(value).toFixed(6)

const proceduralFrame = (spec: Extract<MotionExpertSpecV1, { kind: 'procedural' }>, tick: number): MotionExpertRuntimeFrameV1 => {
  const seconds = tick / MOTION_EXPERT_TICKS_PER_SECOND_V1
  const { ringCount, radius, thickness, wobble, speed } = spec.parameters
  const rings: MotionExpertRingPrimitiveV1[] = []
  for (let index = 0; index < ringCount; index += 1) {
    const fraction = (index + 1) / ringCount
    const seedOffset = noise01(spec.seed, index, 0x41c64e6d) * Math.PI * 2
    const phase = seconds * speed + seedOffset + index * 0.73
    rings.push(Object.freeze({
      id: `ring:${index}`,
      kind: 'ring',
      centerX: round6(spec.width / 2),
      centerY: round6(spec.height / 2),
      radius: round6(Math.max(0, radius * fraction + Math.sin(phase) * wobble)),
      thickness: round6(thickness),
      rotationDeg: round6((phase * 180) / Math.PI),
      opacity: round6(0.25 + 0.7 * (1 - fraction * 0.55)),
    }))
  }
  return Object.freeze({
    schemaVersion: 'sanverse.motion-expert-frame/v1', tick, ticksPerSecond: MOTION_EXPERT_TICKS_PER_SECOND_V1,
    kind: spec.kind, program: spec.program, seed: spec.seed, width: spec.width, height: spec.height,
    primitives: Object.freeze(rings), shader: null,
    resourceUsage: Object.freeze({ primitiveCount: rings.length, referencedAssetCount: spec.assets?.length ?? 0, workUnits: rings.length }),
  })
}

const particleFrame = (spec: Extract<MotionExpertSpecV1, { kind: 'particles' }>, tick: number): MotionExpertRuntimeFrameV1 => {
  const { count, lifetimeTicks, radius, size, speed } = spec.parameters
  const progress = clamp01(tick / lifetimeTicks)
  const particles: MotionExpertParticlePrimitiveV1[] = []
  for (let index = 0; index < count; index += 1) {
    const angleNoise = noise01(spec.seed, index, 0xa511e9b3)
    const travelNoise = noise01(spec.seed, index, 0x63d83595)
    const sizeNoise = noise01(spec.seed, index, 0x9e3779b9)
    const angle = angleNoise * Math.PI * 2 + progress * speed * 0.24
    const distance = radius * progress * (0.55 + travelNoise * 0.45) * Math.max(0.05, Math.abs(speed))
    const localSize = size * (0.65 + sizeNoise * 0.7) * (1 - progress * 0.35)
    particles.push(Object.freeze({
      id: `particle:${index}`,
      kind: 'particle',
      x: round6(spec.width / 2 + Math.cos(angle) * distance),
      y: round6(spec.height / 2 + Math.sin(angle) * distance),
      size: round6(Math.max(0, localSize)),
      opacity: round6((1 - progress) * (0.45 + 0.55 * travelNoise)),
      rotationDeg: round6((angle * 180) / Math.PI + progress * 180 * speed),
      hue: round6((spec.seed * 13 + index * 29 + progress * 140) % 360),
    }))
  }
  return Object.freeze({
    schemaVersion: 'sanverse.motion-expert-frame/v1', tick, ticksPerSecond: MOTION_EXPERT_TICKS_PER_SECOND_V1,
    kind: spec.kind, program: spec.program, seed: spec.seed, width: spec.width, height: spec.height,
    primitives: Object.freeze(particles), shader: null,
    resourceUsage: Object.freeze({ primitiveCount: particles.length, referencedAssetCount: spec.assets?.length ?? 0, workUnits: particles.length }),
  })
}

const shaderFrame = (spec: Extract<MotionExpertSpecV1, { kind: 'shader' }>, tick: number): MotionExpertRuntimeFrameV1 => {
  const seconds = tick / MOTION_EXPERT_TICKS_PER_SECOND_V1
  const seedPhase = noise01(spec.seed, 0, 0x27d4eb2d)
  const { frequency, amplitude, hueShift, scale } = spec.parameters
  const phase = seconds * frequency + seedPhase * Math.PI * 2
  const x = 50 + Math.sin(phase) * 28 * Math.min(1, amplitude)
  const y = 50 + Math.cos(phase * 0.73) * 24 * Math.min(1, amplitude)
  const hueA = ((hueShift + spec.seed * 17 + seconds * 18) % 360 + 360) % 360
  const hueB = (hueA + 118 + scale * 3) % 360
  const cssBackground = `radial-gradient(circle at ${fixed(x)}% ${fixed(y)}%, hsl(${fixed(hueA)} 86% 62% / 0.92) 0%, transparent ${fixed(28 + 12 * Math.min(1, amplitude))}%), linear-gradient(${fixed((phase * 57.295779513) % 360)}deg, hsl(${fixed(hueB)} 78% 28%), hsl(${fixed((hueA + 220) % 360)} 74% 12%))`
  const shader: MotionExpertShaderPlanV1 = Object.freeze({
    program: 'plasma-field',
    uniforms: Object.freeze({ canonicalTick: tick, seconds: round6(seconds), seed: spec.seed, seedPhase: round6(seedPhase), frequency, amplitude, hueShift, scale }),
    cssBackground,
  })
  return Object.freeze({
    schemaVersion: 'sanverse.motion-expert-frame/v1', tick, ticksPerSecond: MOTION_EXPERT_TICKS_PER_SECOND_V1,
    kind: spec.kind, program: spec.program, seed: spec.seed, width: spec.width, height: spec.height,
    primitives: Object.freeze([]), shader,
    resourceUsage: Object.freeze({ primitiveCount: 1, referencedAssetCount: spec.assets?.length ?? 0, workUnits: 1 }),
  })
}

export const evaluateMotionExpertAtTickV1 = (input: Readonly<{ spec: MotionExpertSpecV1; tick: number; ticksPerSecond?: number }>): CreativeValidationResultV1<MotionExpertRuntimeFrameV1> => {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) return creativeRefusal('EXPERT_TICK_INVALID', 'Expert evaluation requires a non-negative safe-integer canonical tick.')
  if ((input.ticksPerSecond ?? MOTION_EXPERT_TICKS_PER_SECOND_V1) !== MOTION_EXPERT_TICKS_PER_SECOND_V1) return creativeRefusal('EXPERT_CLOCK_INVALID', 'Expert V1.4 accepts only the canonical 1,440,000-tick clock.')
  const validated = validateMotionExpertSpecV1(input.spec)
  if (!validated.ok) return creativeRefusal('EXPERT_SPEC_INVALID', 'Expert node failed the canonical Motion Graph validator.', validated.issues)
  const spec = validated.value
  const frame = spec.kind === 'procedural' ? proceduralFrame(spec, input.tick) : spec.kind === 'particles' ? particleFrame(spec, input.tick) : shaderFrame(spec, input.tick)
  if (frame.resourceUsage.primitiveCount > spec.maxPrimitives) return creativeRefusal('EXPERT_RESOURCE_BUDGET_EXCEEDED', 'Expert evaluation exceeded its serialized primitive budget.')
  return creativeValidationOk(frame)
}
