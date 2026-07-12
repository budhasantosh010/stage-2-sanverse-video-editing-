type ViewTransitionDocument = Document & {
  startViewTransition?(update: () => void): unknown
}

export function transitionView(update: () => void): void {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const transitionDocument = document as ViewTransitionDocument

  if (prefersReducedMotion || !transitionDocument.startViewTransition) {
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
