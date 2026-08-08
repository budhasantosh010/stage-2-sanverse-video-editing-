import type { MotionValidationIssueV1, MotionValidationResultV1 } from '@sanverse/motion-contract'
import { motionValidationError, motionValidationOk } from '@sanverse/motion-contract'
import { MOTION_BLEND_MODES, MOTION_EFFECT_REGISTRY, MOTION_EFFECT_TYPES } from './effects.ts'
import { MOTION_MASK_TYPES } from './masks.ts'
import type { Animatable, MotionNodePropertyPathV1, MotionPropertyPathV1, MotionScalarExpressionV1 } from './properties.ts'
import type { MotionNodeV1 } from './nodes.ts'
import type { MotionSceneV1 } from './scene.ts'

const issue = (path: string, message: string): MotionValidationIssueV1 => ({ path, code: 'VALUE_INVALID', message })
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const validEasing = (value: unknown): boolean => ['linear', 'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic'].includes(String(value))

const validateScalarExpression = (raw: unknown, path: string, issues: MotionValidationIssueV1[]): void => {
  if (!isRecord(raw) || typeof raw.kind !== 'string') { issues.push(issue(path, 'Formula expression must be a tagged object.')); return }
  const expression = raw as unknown as MotionScalarExpressionV1
  if (expression.kind === 'constant') { if (!finite(expression.value)) issues.push(issue(`${path}.value`, 'Formula constant must be finite.')); return }
  if (expression.kind === 'progress') return
  if (expression.kind === 'sequence') { if (!finite(expression.start) || !finite(expression.end) || expression.start < 0 || expression.end > 1 || expression.start >= expression.end) issues.push(issue(path, 'Formula sequence must satisfy 0 <= start < end <= 1.')); validateScalarExpression(expression.input, `${path}.input`, issues); return }
  if (expression.kind === 'ease') { if (!validEasing(expression.easing)) issues.push(issue(`${path}.easing`, 'Formula easing is unsupported.')); validateScalarExpression(expression.input, `${path}.input`, issues); return }
  if (expression.kind === 'spring') { if (!finite(expression.damping) || expression.damping <= 0 || !finite(expression.frequency) || expression.frequency <= 0) issues.push(issue(path, 'Formula spring damping and frequency must be positive finite values.')); validateScalarExpression(expression.input, `${path}.input`, issues); return }
  if (expression.kind === 'stagger') { if (!Number.isSafeInteger(expression.index) || !Number.isSafeInteger(expression.count) || expression.count <= 0 || expression.index < 0 || expression.index >= expression.count || !finite(expression.overlap) || expression.overlap < 0 || expression.overlap > 1) issues.push(issue(path, 'Formula stagger index/count/overlap are invalid.')); validateScalarExpression(expression.input, `${path}.input`, issues); return }
  if (expression.kind === 'sin') { if (!finite(expression.cycles) || expression.cycles < 0) issues.push(issue(`${path}.cycles`, 'Formula sine cycles must be a non-negative finite number.')); validateScalarExpression(expression.input, `${path}.input`, issues); return }
  if (expression.kind === 'clamp01') { validateScalarExpression(expression.input, `${path}.input`, issues); return }
  if (expression.kind === 'max' || expression.kind === 'min' || expression.kind === 'subtract') { validateScalarExpression(expression.a, `${path}.a`, issues); validateScalarExpression(expression.b, `${path}.b`, issues); return }
  if (expression.kind === 'add' || expression.kind === 'multiply') { if (!Array.isArray(expression.values) || expression.values.length === 0) issues.push(issue(`${path}.values`, 'Formula add/multiply needs at least one input.')); else expression.values.forEach((value, index) => validateScalarExpression(value, `${path}.values[${index}]`, issues)); return }
  if (expression.kind === 'lerp') { validateScalarExpression(expression.from, `${path}.from`, issues); validateScalarExpression(expression.to, `${path}.to`, issues); validateScalarExpression(expression.progress, `${path}.progress`, issues); return }
  if (expression.kind === 'if-reduced-motion') { validateScalarExpression(expression.reduced, `${path}.reduced`, issues); validateScalarExpression(expression.normal, `${path}.normal`, issues); return }
  issues.push(issue(`${path}.kind`, `Unsupported formula expression kind: ${String((raw as Record<string, unknown>).kind)}`))
}

const validateAnimatable = (value: unknown, path: string, issues: MotionValidationIssueV1[]): void => {
  if (!isRecord(value) || typeof value.kind !== 'string') { issues.push(issue(path, 'Animatable value must be a tagged object.')); return }
  if (value.kind === 'constant') {
    if (!['string', 'boolean', 'number'].includes(typeof value.value) || (typeof value.value === 'number' && !Number.isFinite(value.value))) issues.push(issue(path, 'Constant value must be a finite number, string or boolean.'))
    return
  }
  if (value.kind === 'motion') {
    if (!isRecord(value.driver) || typeof value.driver.kind !== 'string') { issues.push(issue(path, 'Motion driver is invalid.')); return }
    const driver = value.driver
    const numbers = Object.entries(driver).filter(([key]) => !['kind', 'easing', 'positiveOnly', 'before', 'after'].includes(key)).map(([, entry]) => entry).filter((entry) => typeof entry === 'number')
    if (numbers.some((entry) => !Number.isFinite(entry))) issues.push(issue(path, 'Motion driver contains a non-finite number.'))
    if (['interpolation', 'spring', 'stagger', 'pulse'].includes(String(driver.kind))) {
      if (!finite(driver.start) || !finite(driver.end) || driver.start < 0 || driver.end > 1 || driver.start >= driver.end) issues.push(issue(path, 'Motion driver range must satisfy 0 <= start < end <= 1.'))
    }
    if (driver.kind === 'spring' && (!finite(driver.damping) || driver.damping <= 0 || !finite(driver.frequency) || driver.frequency <= 0)) issues.push(issue(path, 'Spring damping and frequency must be positive.'))
    if (driver.kind === 'stagger' && (!Number.isSafeInteger(driver.index) || !Number.isSafeInteger(driver.count) || Number(driver.count) <= 0 || Number(driver.index) < 0 || Number(driver.index) >= Number(driver.count))) issues.push(issue(path, 'Stagger index/count are invalid.'))
    if (driver.kind === 'boolean-step' && (!finite(driver.at) || driver.at < 0 || driver.at > 1 || typeof driver.before !== 'boolean' || typeof driver.after !== 'boolean')) issues.push(issue(path, 'Boolean step is invalid.'))
    if (driver.kind === 'formula') validateScalarExpression(driver.expression, `${path}.driver.expression`, issues)
    if (driver.kind === 'compact-number') {
      const numericValues = [driver.from, driver.to, driver.start, driver.end, driver.decimals]
      const numericValid = numericValues.every(finite)
      const start = numericValid ? driver.start as number : Number.NaN
      const end = numericValid ? driver.end as number : Number.NaN
      const decimals = numericValid ? driver.decimals as number : Number.NaN
      if (!numericValid || start < 0 || end > 1 || start >= end || decimals < 0 || decimals > 6 || !validEasing(driver.easing) || typeof driver.prefix !== 'string' || typeof driver.suffix !== 'string' || !['integer', 'none'].includes(String(driver.rounding))) issues.push(issue(path, 'Compact-number driver is invalid.'))
    }
    if (driver.kind === 'clock') {
      const totalSeconds = Number.isSafeInteger(driver.totalSeconds) ? driver.totalSeconds as number : Number.NaN
      const start = finite(driver.start) ? driver.start : Number.NaN
      const end = finite(driver.end) ? driver.end : Number.NaN
      if (!Number.isSafeInteger(totalSeconds) || totalSeconds < 1 || totalSeconds > 359_999 || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1 || start >= end || !['countdown', 'countup'].includes(String(driver.mode)) || typeof driver.alwaysShowHours !== 'boolean') issues.push(issue(path, 'Clock driver is invalid.'))
    }
    return
  }
  if (value.kind === 'keyframes') {
    if (!Array.isArray(value.keyframes) || value.keyframes.length === 0) { issues.push(issue(path, 'Keyframed value needs at least one keyframe.')); return }
    const ids = new Set<string>(); let previous = -1
    value.keyframes.forEach((raw, index) => {
      if (!isRecord(raw)) { issues.push(issue(`${path}.keyframes[${index}]`, 'Keyframe must be an object.')); return }
      if (typeof raw.id !== 'string' || !raw.id || ids.has(raw.id)) issues.push(issue(`${path}.keyframes[${index}].id`, 'Keyframe id must be unique and non-empty.')); else ids.add(raw.id)
      if (!Number.isSafeInteger(raw.tick) || Number(raw.tick) < 0 || Number(raw.tick) <= previous) issues.push(issue(`${path}.keyframes[${index}].tick`, 'Keyframe ticks must be unique, non-negative safe integers in ascending order.')); else previous = Number(raw.tick)
      if (!['hold', 'linear', 'bezier'].includes(String(raw.interpolation))) issues.push(issue(`${path}.keyframes[${index}].interpolation`, 'Unsupported keyframe interpolation.'))
      if (typeof raw.value === 'number' && !Number.isFinite(raw.value)) issues.push(issue(`${path}.keyframes[${index}].value`, 'Keyframe number must be finite.'))
    })
    return
  }
  if (value.kind === 'binding') {
    if (!isRecord(value.binding) || !isRecord(value.binding.source) || typeof value.binding.source.nodeId !== 'string' || typeof value.binding.source.property !== 'string') issues.push(issue(path, 'Binding source is invalid.'))
    return
  }
  issues.push(issue(path, `Unsupported animatable kind: ${String(value.kind)}`))
}

const nodeAnimatables = (node: MotionNodeV1): readonly [string, Animatable<string | number | boolean>][] => {
  const base: [string, Animatable<string | number | boolean>][] = [
    ['visible', node.visible], ['opacity', node.opacity],
    ['transform.positionX', node.transform.positionX], ['transform.positionY', node.transform.positionY], ['transform.scaleX', node.transform.scaleX], ['transform.scaleY', node.transform.scaleY], ['transform.rotationDeg', node.transform.rotationDeg], ['transform.anchorX', node.transform.anchorX], ['transform.anchorY', node.transform.anchorY],
  ]
  if (node.type === 'text') base.push(['text.text', node.text], ['text.fillColor', node.fillColor], ['text.fontSize', node.fontSize], ['text.fontWeight', node.fontWeight])
  if (node.type === 'shape') base.push(['shape.width', node.width], ['shape.height', node.height], ['shape.fillColor', node.fillColor], ['shape.strokeColor', node.strokeColor], ['shape.strokeWidth', node.strokeWidth], ['shape.radius', node.radius])
  if (node.type === 'path') base.push(['path.fillColor', node.fillColor], ['path.strokeColor', node.strokeColor], ['path.strokeWidth', node.strokeWidth], ['path.trimProgress', node.trimProgress])
  if (node.type === 'image') base.push(['image.width', node.width], ['image.height', node.height], ['image.opacity', node.imageOpacity])
  return base
}

const targetExists = (scene: MotionSceneV1, target: MotionPropertyPathV1): boolean => {
  if (target.kind === 'component') return Boolean(target.propertyId)
  if (target.kind === 'part') return scene.semanticParts.some((part) => part.id === target.semanticPartId)
  const node = scene.nodes[target.nodeId]
  if (!node) return false
  if (target.kind === 'effect') return node.effects.some((effect) => effect.id === target.effectId && target.parameter in effect.parameters)
  return true
}

const parentCycle = (scene: MotionSceneV1, startId: string): boolean => {
  const seen = new Set<string>(); let current: string | null = startId
  while (current) {
    if (seen.has(current)) return true
    seen.add(current)
    current = scene.nodes[current]?.parentId ?? null
  }
  return false
}

export const validateMotionScene = (input: unknown): MotionValidationResultV1<MotionSceneV1> => {
  if (!isRecord(input) || input.schemaVersion !== 'sanverse.motion-scene/v1' || !isRecord(input.nodes) || typeof input.rootNodeId !== 'string') return motionValidationError(issue('$', 'Motion scene must be sanverse.motion-scene/v1 with a root and normalized node record.'))
  const scene = input as unknown as MotionSceneV1
  const issues: MotionValidationIssueV1[] = []
  const root = scene.nodes[scene.rootNodeId]
  if (!root) issues.push(issue('$.rootNodeId', 'Root node does not exist.'))
  const structuralIds = new Set<string>()
  Object.entries(scene.nodes).forEach(([key, node]) => {
    if (!node || typeof node !== 'object') { issues.push(issue(`$.nodes.${key}`, 'Node must be an object.')); return }
    if (node.id !== key) issues.push(issue(`$.nodes.${key}.id`, 'Normalized node key must equal node.id.'))
    if (structuralIds.has(node.id)) issues.push(issue(`$.nodes.${key}.id`, 'Duplicate node id.')); else structuralIds.add(node.id)
    if (node.parentId !== null && !scene.nodes[node.parentId]) issues.push(issue(`$.nodes.${key}.parentId`, 'Parent node does not exist.'))
    if (parentCycle(scene, node.id)) issues.push(issue(`$.nodes.${key}.parentId`, 'Parent hierarchy contains a cycle.'))
    if (!MOTION_BLEND_MODES.includes(node.blendMode)) issues.push(issue(`$.nodes.${key}.blendMode`, 'Unsupported blend mode.'))
    nodeAnimatables(node).forEach(([property, value]) => validateAnimatable(value, `$.nodes.${key}.${property}`, issues))
    if (node.type === 'group') {
      const childIds = new Set<string>()
      node.childIds.forEach((childId, index) => {
        if (childIds.has(childId)) issues.push(issue(`$.nodes.${key}.childIds[${index}]`, 'Group child id is duplicated.')); else childIds.add(childId)
        const child = scene.nodes[childId]
        if (!child) issues.push(issue(`$.nodes.${key}.childIds[${index}]`, 'Group child does not exist.'))
        else if (child.parentId !== node.id) issues.push(issue(`$.nodes.${key}.childIds[${index}]`, 'Group child parentId does not point back to this group.'))
      })
    }
    const effectIds = new Set<string>()
    node.effects.forEach((effect, index) => {
      if (!effect.id || effectIds.has(effect.id)) issues.push(issue(`$.nodes.${key}.effects[${index}].id`, 'Effect id must be unique and non-empty.')); else effectIds.add(effect.id)
      if (!MOTION_EFFECT_TYPES.includes(effect.effectType) || !MOTION_EFFECT_REGISTRY[effect.effectType]) issues.push(issue(`$.nodes.${key}.effects[${index}].effectType`, 'Unsupported effect type.'))
      else if (!MOTION_EFFECT_REGISTRY[effect.effectType].supportedNodeTypes.includes(node.type)) issues.push(issue(`$.nodes.${key}.effects[${index}]`, 'Effect does not support this node type.'))
      Object.entries(effect.parameters).forEach(([parameter, value]) => validateAnimatable(value, `$.nodes.${key}.effects[${index}].parameters.${parameter}`, issues))
    })
    const maskIds = new Set<string>()
    node.masks.forEach((mask, index) => {
      if (!mask.id || maskIds.has(mask.id)) issues.push(issue(`$.nodes.${key}.masks[${index}].id`, 'Mask id must be unique and non-empty.')); else maskIds.add(mask.id)
      if (!MOTION_MASK_TYPES.includes(mask.type)) issues.push(issue(`$.nodes.${key}.masks[${index}].type`, 'Unsupported mask type.'))
      for (const [property, value] of Object.entries({ opacity: mask.opacity, feather: mask.feather, expansion: mask.expansion, x: mask.x, y: mask.y, width: mask.width, height: mask.height, radius: mask.radius })) validateAnimatable(value, `$.nodes.${key}.masks[${index}].${property}`, issues)
    })
  })
  if (root && root.parentId !== null) issues.push(issue('$.rootNodeId', 'Root node must not have a parent.'))
  const partIds = new Set<string>()
  scene.semanticParts.forEach((part, index) => {
    if (!part.id || partIds.has(part.id)) issues.push(issue(`$.semanticParts[${index}].id`, 'Semantic part id must be unique and non-empty.')); else partIds.add(part.id)
    part.nodeIds.forEach((nodeId, nodeIndex) => { if (!scene.nodes[nodeId]) issues.push(issue(`$.semanticParts[${index}].nodeIds[${nodeIndex}]`, 'Semantic part references a missing node.')) })
  })
  const exposureIds = new Set<string>()
  scene.exposures.forEach((exposure, index) => {
    if (!exposure.id || exposureIds.has(exposure.id)) issues.push(issue(`$.exposures[${index}].id`, 'Exposure id must be unique and non-empty.')); else exposureIds.add(exposure.id)
    if (!targetExists(scene, exposure.target)) issues.push(issue(`$.exposures[${index}].target`, 'Exposure target does not exist.'))
  })
  for (const node of Object.values(scene.nodes)) for (const [property, value] of nodeAnimatables(node)) if (value.kind === 'binding' && !scene.nodes[value.binding.source.nodeId]) issues.push(issue(`$.nodes.${node.id}.${property}`, 'Binding source node does not exist.'))
  for (const ownership of scene.layout.ownership) if (!scene.nodes[ownership.target.nodeId]) issues.push(issue('$.layout.ownership', 'Layout ownership references a missing node.'))
  for (const override of scene.layout.formatOverrides) if (!scene.nodes[override.target.nodeId]) issues.push(issue('$.layout.formatOverrides', 'Format override references a missing node.'))
  return issues.length > 0 ? motionValidationError(...issues) : motionValidationOk(scene)
}

export const assertValidMotionScene = (scene: MotionSceneV1): MotionSceneV1 => {
  const result = validateMotionScene(scene)
  if (!result.ok) throw new RangeError(result.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'))
  return result.value
}

export const motionNodePropertyPath = (nodeId: string, property: MotionNodePropertyPathV1['property']): MotionNodePropertyPathV1 => ({ nodeId, property })
