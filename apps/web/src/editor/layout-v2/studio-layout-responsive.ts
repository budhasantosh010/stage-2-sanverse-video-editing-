import type { WorkspaceViewport } from '../workspace'
import type { StudioLayoutV2State } from './studio-layout-contract'
import { studioResponsiveMode } from './studio-responsive-authority'

/**
 * The mode itself now lives in `studio-responsive-authority`, which is the one
 * place the breakpoints are written down and the one place the subscription is
 * made. This file keeps only the layout adaptation and re-exports the mode so
 * existing imports keep working.
 */
export {
  STUDIO_BREAKPOINTS,
  STUDIO_MEDIA_QUERIES,
  currentStudioViewport,
  readStudioResponsiveMode,
  studioHidesSideDocks,
  studioResponsiveMode,
  subscribeStudioResponsiveMode,
  useStudioResponsiveMode,
  type StudioResponsiveMode,
} from './studio-responsive-authority'

export const adaptStudioLayoutToViewport = (layout: StudioLayoutV2State, viewport: WorkspaceViewport): StudioLayoutV2State => {
  studioResponsiveMode(viewport)
  return layout
}
