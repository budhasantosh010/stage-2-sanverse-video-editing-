import { describe, expect, it, vi } from 'vitest'

import { defaultStudioLayoutV2 } from './studio-layout-defaults'
import { loadStudioLayoutV2, saveStudioLayoutV2, STUDIO_LAYOUT_V2_STORAGE_KEY } from './studio-layout-persistence'

const storage = () => {
  const values = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
  }
}

describe('studio layout v2 persistence', () => {
  it('round trips the closed v2 layout', () => {
    const target = storage()
    const layout = { ...defaultStudioLayoutV2(), preset: 'custom' as const, mainVerticalLayout: [55, 45] as const }
    expect(saveStudioLayoutV2(target, layout)).toBe(true)
    expect(target.setItem).toHaveBeenCalledTimes(1)
    expect(loadStudioLayoutV2(target, { width: 1440, height: 900 })).toEqual(layout)
  })

  it('recovers from corrupt storage without rewriting during load', () => {
    const target = storage()
    target.setItem(STUDIO_LAYOUT_V2_STORAGE_KEY, '{not json')
    target.setItem.mockClear()
    expect(loadStudioLayoutV2(target, { width: 1440, height: 900 })).toEqual(defaultStudioLayoutV2())
    expect(target.setItem).not.toHaveBeenCalled()
  })
})
