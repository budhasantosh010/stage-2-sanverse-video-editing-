import type { WorkspaceViewport } from '../workspace'
import type { StudioLayoutV2State } from './studio-layout-contract'

export type StudioResponsiveMode = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export const studioResponsiveMode = (viewport: WorkspaceViewport): StudioResponsiveMode => {
  if (viewport.width < 600) return 'mobile'
  if (viewport.width < 1100) return 'tablet'
  if (viewport.width < 1360) return 'laptop'
  return 'desktop'
}

export const adaptStudioLayoutToViewport = (layout: StudioLayoutV2State, viewport: WorkspaceViewport): StudioLayoutV2State => {
  studioResponsiveMode(viewport)
  return layout
}
