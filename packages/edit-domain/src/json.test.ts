import { describe, expect, it } from 'vitest'

import { EXTENSION_LIMITS, validateExtensions } from './json'

describe('bounded, preserved extensions', () => {
  it('preserves an unknown namespaced value untouched', () => {
    // The whole point: a future version's note survives a read and a write by
    // this version, instead of being silently destroyed.
    const input = { 'future.app/setting': { mode: 'wide', level: 3 } }
    const result = validateExtensions(input)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.value).toEqual(input)
    expect(JSON.parse(JSON.stringify(result.value))).toEqual(input)
  })

  it('deep-copies and freezes so later mutation cannot reach project state', () => {
    const input: { 'sanverse.ui/note': { text: string } } = { 'sanverse.ui/note': { text: 'before' } }
    const result = validateExtensions(input)
    if (!result.ok) throw new Error('setup failed')
    input['sanverse.ui/note'].text = 'after'
    expect((result.value['sanverse.ui/note'] as { text: string }).text).toBe('before')
    expect(Object.isFrozen(result.value)).toBe(true)
  })

  it('requires namespaced keys', () => {
    expect(validateExtensions({ note: 'hello' })).toEqual({
      ok: false,
      error: { code: 'EXTENSIONS_INVALID', issues: [{ path: 'note', code: 'KEY_NOT_NAMESPACED' }] },
    })
  })

  it('refuses prototype-pollution keys at any depth', () => {
    // Read from disk, so `__proto__` arrives as a real own key rather than as
    // an object-literal prototype assignment.
    const topLevel = JSON.parse('{"__proto__":{"polluted":true}}')
    expect(validateExtensions(topLevel)).toMatchObject({ ok: false })
    const nested = JSON.parse('{"sanverse.ui/note":{"__proto__":{"polluted":true}}}')
    expect(validateExtensions(nested)).toMatchObject({ ok: false })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('refuses unsafe numbers and non-JSON values', () => {
    expect(validateExtensions({ 'sanverse.ui/a': Number.NaN })).toMatchObject({ ok: false })
    expect(validateExtensions({ 'sanverse.ui/a': Number.POSITIVE_INFINITY })).toMatchObject({ ok: false })
    expect(validateExtensions({ 'sanverse.ui/a': 2 ** 53 })).toMatchObject({ ok: false })
    expect(validateExtensions({ 'sanverse.ui/a': () => 1 })).toMatchObject({ ok: false })
    expect(validateExtensions({ 'sanverse.ui/a': undefined })).toMatchObject({ ok: false })
  })

  it('bounds depth and total size', () => {
    let deep: unknown = 'leaf'
    for (let level = 0; level < EXTENSION_LIMITS.maxDepth + 2; level += 1) deep = { nested: deep }
    expect(validateExtensions({ 'sanverse.ui/deep': deep })).toMatchObject({ ok: false })

    const huge = 'x'.repeat(EXTENSION_LIMITS.maxSerializedBytes)
    expect(validateExtensions({ 'sanverse.ui/huge': huge })).toMatchObject({ ok: false })
  })

  it('treats a missing bag as empty rather than invalid', () => {
    expect(validateExtensions(undefined)).toEqual({ ok: true, value: {} })
    expect(validateExtensions(null)).toMatchObject({ ok: false })
  })
})
