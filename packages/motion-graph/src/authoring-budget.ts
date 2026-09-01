import type { MotionSceneV1 } from './scene.ts'

export interface MotionAuthoringBudgetV1 {
  readonly maxNodes: number
  readonly maxPathBytesPerNode: number
  readonly maxEffectsPerNode: number
  readonly maxMasksPerNode: number
  readonly maxSerializedGraphBytes: number
}

export interface MotionAuthoringBudgetReportV1 {
  readonly ok: boolean
  readonly code: 'OK' | 'AUTHORING_BUDGET_EXCEEDED'
  readonly findings: readonly string[]
  readonly observed: Readonly<{
    nodes: number
    maxPathBytes: number
    maxEffectsPerNode: number
    maxMasksPerNode: number
    serializedGraphBytes: number
  }>
  readonly budget: MotionAuthoringBudgetV1
}

export const DEFAULT_MOTION_AUTHORING_BUDGET_V1: MotionAuthoringBudgetV1 = Object.freeze({
  maxNodes: 2_000,
  maxPathBytesPerNode: 131_072,
  maxEffectsPerNode: 32,
  maxMasksPerNode: 32,
  maxSerializedGraphBytes: 8 * 1024 * 1024,
})

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength

export const validateMotionAuthoringBudgetV1 = (
  scene: MotionSceneV1,
  budget: MotionAuthoringBudgetV1 = DEFAULT_MOTION_AUTHORING_BUDGET_V1,
): MotionAuthoringBudgetReportV1 => {
  const nodes = Object.values(scene.nodes)
  const pathBytes = nodes.filter((node) => node.type === 'path').map((node) => byteLength(node.pathData))
  const observed = Object.freeze({
    nodes: nodes.length,
    maxPathBytes: pathBytes.length > 0 ? Math.max(...pathBytes) : 0,
    maxEffectsPerNode: nodes.length > 0 ? Math.max(...nodes.map((node) => node.effects.length)) : 0,
    maxMasksPerNode: nodes.length > 0 ? Math.max(...nodes.map((node) => node.masks.length)) : 0,
    serializedGraphBytes: byteLength(JSON.stringify(scene)),
  })
  const findings: string[] = []
  if (observed.nodes > budget.maxNodes) findings.push(`Node count ${observed.nodes} exceeds ${budget.maxNodes}.`)
  if (observed.maxPathBytes > budget.maxPathBytesPerNode) findings.push(`Path geometry ${observed.maxPathBytes} bytes exceeds ${budget.maxPathBytesPerNode}.`)
  if (observed.maxEffectsPerNode > budget.maxEffectsPerNode) findings.push(`Effects per node ${observed.maxEffectsPerNode} exceeds ${budget.maxEffectsPerNode}.`)
  if (observed.maxMasksPerNode > budget.maxMasksPerNode) findings.push(`Masks per node ${observed.maxMasksPerNode} exceeds ${budget.maxMasksPerNode}.`)
  if (observed.serializedGraphBytes > budget.maxSerializedGraphBytes) findings.push(`Serialized graph ${observed.serializedGraphBytes} bytes exceeds ${budget.maxSerializedGraphBytes}.`)
  return Object.freeze({
    ok: findings.length === 0,
    code: findings.length === 0 ? 'OK' : 'AUTHORING_BUDGET_EXCEEDED',
    findings: Object.freeze(findings),
    observed,
    budget,
  })
}
