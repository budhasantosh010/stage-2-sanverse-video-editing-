import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  emptyMotionLibraryReviewDocument,
  motionLibraryReviewByComponent,
  parseMotionLibraryReviewDocument,
  serializeMotionLibraryReviewDocument,
  validateMotionLibraryReviewDocument,
} from '@sanverse/motion-library'
import type { MotionLibraryReviewDocumentV1, MotionQualityReviewV1 } from '@sanverse/motion-library'

const REVIEW_ENDPOINT = '/library-reviews/reviews.v1.json'
const DRAFT_KEY = 'sanverse.motion-library-reviews.draft.v1'

export interface LibraryReviewStoreV1 {
  readonly document: MotionLibraryReviewDocumentV1
  readonly byComponent: Readonly<Record<string, MotionQualityReviewV1>>
  readonly loading: boolean
  readonly persistence: 'repo' | 'browser-draft' | 'unavailable'
  readonly error: string | null
  readonly saveReview: (review: MotionQualityReviewV1) => Promise<boolean>
  readonly importJson: (source: string) => Promise<boolean>
  readonly exportJson: () => string
  readonly reload: () => Promise<void>
}

const readBrowserDraft = (): MotionLibraryReviewDocumentV1 | null => {
  if (typeof localStorage === 'undefined') return null
  const source = localStorage.getItem(DRAFT_KEY)
  if (!source) return null
  try { return parseMotionLibraryReviewDocument(source) } catch { return null }
}

const persistBrowserDraft = (document: MotionLibraryReviewDocumentV1): void => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DRAFT_KEY, serializeMotionLibraryReviewDocument(document))
}

const postDocument = async (document: MotionLibraryReviewDocumentV1): Promise<boolean> => {
  const response = await fetch(REVIEW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: serializeMotionLibraryReviewDocument(document),
  })
  return response.ok
}

export const useLibraryReviewStore = (): LibraryReviewStoreV1 => {
  const [document, setDocument] = useState<MotionLibraryReviewDocumentV1>(() => readBrowserDraft() ?? emptyMotionLibraryReviewDocument())
  const [loading, setLoading] = useState(true)
  const [persistence, setPersistence] = useState<LibraryReviewStoreV1['persistence']>('unavailable')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(REVIEW_ENDPOINT, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Review store returned HTTP ${response.status}.`)
      const source = await response.text()
      const parsed = parseMotionLibraryReviewDocument(source)
      setDocument(parsed)
      persistBrowserDraft(parsed)
      setPersistence('repo')
    } catch (reason) {
      const draft = readBrowserDraft()
      if (draft) {
        setDocument(draft)
        setPersistence('browser-draft')
      } else {
        setPersistence('unavailable')
      }
      setError(reason instanceof Error ? reason.message : 'Review store unavailable.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const persist = useCallback(async (next: MotionLibraryReviewDocumentV1): Promise<boolean> => {
    const validation = validateMotionLibraryReviewDocument(next)
    if (!validation.ok) {
      setError(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
      return false
    }
    setDocument(validation.value)
    persistBrowserDraft(validation.value)
    try {
      const ok = await postDocument(validation.value)
      if (!ok) throw new Error('Review store rejected the validated document.')
      setPersistence('repo')
      setError(null)
      return true
    } catch (reason) {
      setPersistence('browser-draft')
      setError(reason instanceof Error ? reason.message : 'Repo review persistence unavailable; browser draft retained.')
      return false
    }
  }, [])

  const saveReview = useCallback(async (review: MotionQualityReviewV1): Promise<boolean> => {
    const remaining = document.reviews.filter((candidate) => !(candidate.componentId === review.componentId && candidate.fixtureId === review.fixtureId))
    return persist(Object.freeze({ schemaVersion: 'sanverse.motion-library-reviews/v1', reviews: Object.freeze([...remaining, review].sort((a, b) => a.componentId.localeCompare(b.componentId) || a.fixtureId.localeCompare(b.fixtureId))) }))
  }, [document, persist])

  const importJson = useCallback(async (source: string): Promise<boolean> => {
    try { return persist(parseMotionLibraryReviewDocument(source)) } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Imported review JSON is invalid.')
      return false
    }
  }, [persist])

  return Object.freeze({
    document,
    byComponent: useMemo(() => motionLibraryReviewByComponent(document), [document]),
    loading,
    persistence,
    error,
    saveReview,
    importJson,
    exportJson: () => serializeMotionLibraryReviewDocument(document),
    reload,
  })
}
