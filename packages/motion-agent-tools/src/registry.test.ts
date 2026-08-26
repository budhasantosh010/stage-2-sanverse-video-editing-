import { describe, expect, it } from 'vitest'
import { createSanverseToolRegistryV1 } from './registry.ts'

describe('X internal tool registry', () => {
  it('registers distinct typed T0 and T1 tools and fails duplicate IDs closed', () => {
    const registry = createSanverseToolRegistryV1()
    expect(registry.register({ id: 'node.create', version: 1, level: 'T0', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, requiresSandbox: true, validateInput: () => ({ ok: true, value: {} }), execute: () => ({ ok: true, value: {}, revision: 1 }) })).toMatchObject({ ok: true })
    expect(registry.register({ id: 'motion.soften', version: 1, level: 'T1', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, requiresSandbox: true, validateInput: () => ({ ok: true, value: {} }), execute: () => ({ ok: true, value: {}, revision: 1 }) })).toMatchObject({ ok: true })
    expect(registry.list().map((tool) => tool.level)).toEqual(['T0','T1'])
    expect(registry.register({ id: 'node.create', version: 1, level: 'T0', inputSchema: {}, outputSchema: {}, requiresSandbox: true, validateInput: () => ({ ok: true, value: {} }), execute: () => ({ ok: true, value: {}, revision: 1 }) })).toMatchObject({ ok: false, refusal: { code: 'TOOL_ALREADY_REGISTERED' } })
  })
})
