import { describe, expect, it } from 'vitest'

import { defaultStudioLayoutV2 } from './studio-layout-defaults'
import { validateStudioLayoutV2 } from './studio-layout-contract'
import { adaptStudioLayoutToViewport } from './studio-layout-responsive'

describe('studio layout v2 contract', () => {
  it('creates a closed valid nested-layout default', () => {
    const layout = defaultStudioLayoutV2()
    expect(validateStudioLayoutV2(layout)).toEqual(layout)
    expect(layout.rootLayout.reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(layout.mainVerticalLayout.reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(layout.upperLayout.reduce((sum, value) => sum + value, 0)).toBe(100)
  })

  it('rejects unknown keys, invalid numbers, and impossible group totals', () => {
    const valid = defaultStudioLayoutV2()
    expect(validateStudioLayoutV2({ ...valid, surprise: true })).toBeNull()
    expect(validateStudioLayoutV2({ ...valid, rootLayout: [Number.NaN, 100] })).toBeNull()
    expect(validateStudioLayoutV2({ ...valid, upperLayout: [20, 20, 20] })).toBeNull()
  })

  it('preserves persisted user intent while responsive presentation adapts', () => {
    const saved = { ...defaultStudioLayoutV2(), aiMode: 'expanded' as const }
    const tablet = adaptStudioLayoutToViewport(saved, { width: 1024, height: 768 })
    const mobile = adaptStudioLayoutToViewport(saved, { width: 390, height: 844 })
    expect(tablet).toBe(saved)
    expect(mobile).toBe(saved)
  })
})
