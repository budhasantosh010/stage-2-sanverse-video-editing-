import { WORKSPACE_STORAGE_KEY, validateWorkspaceLayout, type WorkspaceViewport } from '../workspace'
import { defaultStudioLayoutV2 } from './studio-layout-defaults'
import { migrateWorkspaceLayoutV1 } from './studio-layout-migration'
import { adaptStudioLayoutToViewport } from './studio-layout-responsive'
import { STUDIO_LAYOUT_V2_SCHEMA, validateStudioLayoutV2, type StudioLayoutV2State } from './studio-layout-contract'

export const STUDIO_LAYOUT_V2_STORAGE_KEY = STUDIO_LAYOUT_V2_SCHEMA
type LayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const loadStudioLayoutV2 = (storage: LayoutStorage | null, viewport: WorkspaceViewport): StudioLayoutV2State => {
  if (!storage) return adaptStudioLayoutToViewport(defaultStudioLayoutV2(), viewport)
  try {
    const current = storage.getItem(STUDIO_LAYOUT_V2_STORAGE_KEY)
    if (current) {
      const validated = validateStudioLayoutV2(JSON.parse(current))
      return adaptStudioLayoutToViewport(validated ?? defaultStudioLayoutV2(), viewport)
    }
    const legacy = storage.getItem(WORKSPACE_STORAGE_KEY)
    const validatedLegacy = legacy ? validateWorkspaceLayout(JSON.parse(legacy)) : null
    return adaptStudioLayoutToViewport(validatedLegacy ? migrateWorkspaceLayoutV1(validatedLegacy, viewport) : defaultStudioLayoutV2(), viewport)
  } catch {
    return adaptStudioLayoutToViewport(defaultStudioLayoutV2(), viewport)
  }
}

export const saveStudioLayoutV2 = (storage: LayoutStorage | null, layout: StudioLayoutV2State): boolean => {
  if (!storage || !validateStudioLayoutV2(layout)) return false
  try {
    storage.setItem(STUDIO_LAYOUT_V2_STORAGE_KEY, JSON.stringify(layout))
    return true
  } catch {
    return false
  }
}
