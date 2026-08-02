import { describe, expect, it } from 'vitest'

import { migrateWorkspaceLayoutV1 } from './studio-layout-migration'

const v1 = {
  schemaVersion: 'sanverse.workspace-layout/v1' as const,
  activeWorkspace: 'effects' as const,
  leftDockWidthPx: 260,
  rightDockWidthPx: 360,
  timelineHeightPx: 360,
  leftDockCollapsed: false,
  rightDockCollapsed: false,
  aiExpanded: true,
  activeRightTab: 'ai' as const,
  preset: 'motion' as const,
}

describe('workspace layout v1 migration', () => {
  it('maps one old presentation preference into the nested v2 groups', () => {
    const migrated = migrateWorkspaceLayoutV1(v1, { width: 1440, height: 900 })
    expect(migrated).toMatchObject({
      schemaVersion: 'sanverse.studio-layout/v2',
      aiMode: 'expanded',
      mediaCollapsed: false,
      toolCollapsed: false,
      activeWorkspace: 'effects',
      preset: 'motion',
    })
    expect(migrated.upperLayout[1]).toBeGreaterThan(migrated.upperLayout[0])
  })

  it('falls back safely when old values are malformed', () => {
    expect(migrateWorkspaceLayoutV1({ ...v1, leftDockWidthPx: Number.NaN }, { width: 1440, height: 900 }))
      .toMatchObject({ schemaVersion: 'sanverse.studio-layout/v2', preset: 'edit' })
  })
})
