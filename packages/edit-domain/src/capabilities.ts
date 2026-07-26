/**
 * What the system can be asked to do.
 *
 * Three levels exist so the AI can choose from a short, reliable list while
 * users still get the expressive power of the deep list underneath. A workflow
 * expands deterministically into components, and a component into primitives.
 * The AI never names a primitive directly, and never invents a capability.
 */
export type CapabilityLevel = 'primitive' | 'component' | 'workflow'

export type CapabilityDescriptor = Readonly<{
  capabilityId: string
  version: number
  level: CapabilityLevel
  /** Human-readable statement of what this capability accepts. */
  accepts: string
  /** Operation kinds this capability may produce. */
  produces: readonly string[]
  /** Capability IDs this one expands into. Empty for primitives. */
  requires: readonly string[]
}>

export const NAMEPLATE_PRIMITIVE_ID = 'sanverse.nameplate.primitive/v1'
export const NAMEPLATE_COMPONENT_ID = 'sanverse.nameplate.component/v1'

/**
 * G4-A registers only what already exists. Workflow-level capabilities begin
 * in G4-B, when the AI first proposes an edit.
 */
export const CAPABILITY_REGISTRY: readonly CapabilityDescriptor[] = Object.freeze([
  Object.freeze({
    capabilityId: NAMEPLATE_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One clip, one composition interval, one anchored point, and two lines of text.',
    produces: Object.freeze(['add-nameplate']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: NAMEPLATE_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'A person\'s name and role, shown at a point the user indicated.',
    produces: Object.freeze(['add-nameplate']),
    requires: Object.freeze([NAMEPLATE_PRIMITIVE_ID]),
  }),
])

export const findCapability = (capabilityId: string): CapabilityDescriptor | undefined =>
  CAPABILITY_REGISTRY.find((capability) => capability.capabilityId === capabilityId)

/**
 * True only when this capability is allowed to emit this operation kind.
 * An operation naming a capability that cannot produce it is rejected, so a
 * mislabelled proposal cannot smuggle an unrelated edit through review.
 */
export const capabilityProduces = (capabilityId: string, operationKind: string): boolean => {
  const capability = findCapability(capabilityId)
  return capability !== undefined && capability.produces.includes(operationKind)
}

/** Expand a capability to the primitives it ultimately relies on. */
export const expandCapability = (capabilityId: string): readonly string[] => {
  const capability = findCapability(capabilityId)
  if (!capability) return []
  if (capability.requires.length === 0) return [capability.capabilityId]
  const expanded = new Set<string>()
  const visit = (id: string, depth: number) => {
    if (depth > 8 || expanded.has(id)) return
    const found = findCapability(id)
    if (!found) return
    if (found.requires.length === 0) {
      expanded.add(found.capabilityId)
      return
    }
    for (const required of found.requires) visit(required, depth + 1)
  }
  visit(capabilityId, 0)
  return Object.freeze([...expanded])
}
