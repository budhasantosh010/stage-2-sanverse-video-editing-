import { createContext, useContext, useSyncExternalStore } from 'react'

import type { MediaAnalysisController } from './media-analysis-controller'

/**
 * How a clip on screen reaches the one thing that fetches derived media.
 *
 * A plain React context holding ONE controller. Not a controller per clip: see
 * the long note at the top of `media-analysis-controller.ts` for what a hundred
 * independent fetchers does to a machine.
 *
 * The context may legitimately be absent. Tests that only care about clip
 * geometry, and any screen that has no timeline, should not have to build a
 * network client to render. Absent means "no decorations", never a crash.
 */
export const MediaAnalysisContext = createContext<MediaAnalysisController | null>(null)

export const useMediaAnalysisController = (): MediaAnalysisController | null =>
  useContext(MediaAnalysisContext)

/**
 * Re-render this component whenever anything the controller holds changes.
 *
 * `useSyncExternalStore` is used rather than an effect-plus-state pair because
 * it is the one React mechanism that cannot show a value from before the last
 * change — which here would be a picture that has already been closed.
 */
export const useMediaAnalysisVersion = (controller: MediaAnalysisController | null): number =>
  useSyncExternalStore(
    (listener) => controller?.subscribe(listener) ?? (() => undefined),
    () => controller?.version() ?? 0,
    () => 0,
  )
