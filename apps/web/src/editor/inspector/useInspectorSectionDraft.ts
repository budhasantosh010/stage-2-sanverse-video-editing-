import { useCallback, useEffect, useState } from 'react'

import {
  createInspectorDraft,
  reconcileInspectorDraft,
  resetInspectorDraft,
  updateInspectorDraft,
  type InspectorDraft,
} from './inspector-draft'

export function useInspectorSectionDraft<T>(input: Readonly<{
  sectionId: string
  selectionKey: string
  projectRevision: number
  authoritative: T
  onDirtyChange(sectionId: string, dirty: boolean): void
}>) {
  const [draft, setDraft] = useState<InspectorDraft<T>>(() => createInspectorDraft(
    input.selectionKey,
    input.projectRevision,
    input.authoritative,
  ))

  useEffect(() => {
    setDraft((current) => reconcileInspectorDraft(
      current,
      input.selectionKey,
      input.projectRevision,
      input.authoritative,
    ))
  }, [input.authoritative, input.projectRevision, input.selectionKey])

  useEffect(() => {
    input.onDirtyChange(input.sectionId, draft.dirty)
    return () => input.onDirtyChange(input.sectionId, false)
  }, [draft.dirty, input.onDirtyChange, input.sectionId])

  const update = useCallback((value: T) => {
    setDraft((current) => updateInspectorDraft(current, value))
  }, [])

  const reset = useCallback(() => {
    setDraft((current) => resetInspectorDraft(current))
  }, [])

  const markApplied = useCallback(() => {
    setDraft((current) => createInspectorDraft(
      current.selectionKey,
      current.projectRevision,
      current.value,
    ))
  }, [])

  return Object.freeze({ draft, update, reset, markApplied })
}
