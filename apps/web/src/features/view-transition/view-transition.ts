type ViewTransitionDocument = Document & {
  startViewTransition?(update: () => void): unknown
}

export function supportsNativeViewTransitions(): boolean {
  return typeof (document as ViewTransitionDocument).startViewTransition === 'function'
}

export function transitionView(update: () => void): void {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const transitionDocument = document as ViewTransitionDocument

  if (prefersReducedMotion || !supportsNativeViewTransitions()) {
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

    update()
  }
}
