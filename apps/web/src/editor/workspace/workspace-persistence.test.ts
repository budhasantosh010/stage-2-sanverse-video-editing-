import { describe, expect, it } from 'vitest'

import { WORKSPACE_STORAGE_KEY } from './workspace-contract'
import { defaultWorkspaceLayout } from './workspace-layout'
import { loadWorkspaceLayout, saveWorkspaceLayout, validateWorkspaceLayout } from './workspace-persistence'

type MemoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { values: Map<string, string> }
const memoryStorage = (): MemoryStorage => {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

const viewport = Object.freeze({ width: 1440, height: 900 })

describe('workspace persistence', () => {
  it('round-trips only the namespaced presentation preference', () => {
    const storage = memoryStorage()
    const layout = Object.freeze({ ...defaultWorkspaceLayout(), activeWorkspace: 'effects' as const, activeRightTab: 'ai' as const })
    expect(saveWorkspaceLayout(storage, layout)).toBe(true)
    expect([...storage.values.keys()]).toEqual([WORKSPACE_STORAGE_KEY])
    expect(loadWorkspaceLayout(storage, viewport)).toMatchObject({ activeWorkspace: 'effects', activeRightTab: 'ai' })
  })

  it.each([
    ['old schema', { ...defaultWorkspaceLayout(), schemaVersion: 'sanverse.workspace-layout/v0' }],
    ['unknown workspace', { ...defaultWorkspaceLayout(), activeWorkspace: 'grade' }],
    ['unknown field', { ...defaultWorkspaceLayout(), projectId: 'must-not-persist' }],
    ['negative dimension', { ...defaultWorkspaceLayout(), leftDockWidthPx: -1 }],
    ['nonfinite dimension', { ...defaultWorkspaceLayout(), timelineHeightPx: Number.NaN }],
  ])('rejects %s', (_label, value) => {
    expect(validateWorkspaceLayout(value)).toBeNull()
  })

  it('recovers safely from corrupt JSON', () => {
    const storage = memoryStorage()
    storage.setItem(WORKSPACE_STORAGE_KEY, '{not-json')
    expect(loadWorkspaceLayout(storage, viewport)).toEqual(defaultWorkspaceLayout())
  })

  it('clamps a large-monitor layout when opened on a laptop', () => {
    const storage = memoryStorage()
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({
      ...defaultWorkspaceLayout(),
      leftDockWidthPx: 420,
      rightDockWidthPx: 520,
      timelineHeightPx: 800,
    }))
    const loaded = loadWorkspaceLayout(storage, { width: 1024, height: 768 })
    expect(loaded.leftDockCollapsed).toBe(true)
    expect(loaded.rightDockCollapsed).toBe(true)
    expect(loaded.timelineHeightPx).toBeLessThan(800)
  })
})
