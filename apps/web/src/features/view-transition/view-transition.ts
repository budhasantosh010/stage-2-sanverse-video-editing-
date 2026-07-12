type ViewTransitionDocument = Document & {
  startViewTransition?(update: () => void): unknown
}

export function supportsNativeViewTransitions(): boolean {
  return typeof (document as ViewTransitionDocument).startViewTransition === 'function'
}

export function transitionView(update: () => void): void {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const transitionDocument = document as ViewTransitionDocument
  const hasNativeTransition = supportsNativeViewTransitions()

  document.documentElement.dataset.viewTransition = hasNativeTransition ? 'native' : 'fallback'

  if (prefersReducedMotion || !hasNativeTransition) {
    update()
    return
  }

  let updateStarted = false
  const guardedUpdate = () => {
    updateStarted = true
    update()
  }

  try {
    transitionDocument.startViewTransition(guardedUpdate)
  } catch (error) {
    if (updateStarted) {
      throw error
    }

    document.documentElement.dataset.viewTransition = 'fallback'
    update()
  }
}
