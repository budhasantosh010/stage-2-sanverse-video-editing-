import { useMemo, useRef, useState } from 'react'
import type { EditProject } from '@sanverse/edit-domain'
import {
  applyCreativeCurvePresetV16,
  buildCreativeProductionApplyBundleV16,
  buildKineticHeadlineCandidateV16,
  createCreativeProductionWorkflowV16,
  listCreativeInternalToolsV16,
  listCreativeProductionOpportunitiesV16,
  projectCreativeCandidateDetailsV16,
  projectCreativeCandidateV16,
  type CreativeProductionCandidateV16,
  type CreativeProductionWorkflowV16,
} from '@sanverse/creative-production-adapter'
import type { CreativeProductionApply } from './creative-production-contract'

export type CreativeProductionController = ReturnType<typeof useCreativeProductionController>

const stateOf = (workflow: CreativeProductionWorkflowV16 | null) => workflow?.state() ?? null

export function useCreativeProductionController(input: Readonly<{
  project: EditProject
  playheadTicks: number
  onApply: CreativeProductionApply
}>) {
  const [headline, setHeadline] = useState('Make this point impossible to miss')
  const [subhead, setSubhead] = useState('')
  const [candidate, setCandidate] = useState<CreativeProductionCandidateV16 | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [workflowState, setWorkflowState] = useState<ReturnType<CreativeProductionWorkflowV16['state']> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [appliedCandidateId, setAppliedCandidateId] = useState<string | null>(null)
  const workflowRef = useRef<CreativeProductionWorkflowV16 | null>(null)

  const opportunities = useMemo(() => listCreativeProductionOpportunitiesV16(), [])
  const internalTools = useMemo(() => listCreativeInternalToolsV16(), [])
  const selectedCandidate = useMemo(() => candidate
    ? Object.freeze({ ...candidate, selectedNodeId: selectedNodeId ?? candidate.selectedNodeId })
    : null, [candidate, selectedNodeId])
  const projection = useMemo(() => selectedCandidate ? projectCreativeCandidateV16(selectedCandidate) : null, [selectedCandidate])
  const projectionDetails = useMemo(() => selectedCandidate ? projectCreativeCandidateDetailsV16(selectedCandidate) : null, [selectedCandidate])
  const nativeOpportunityCount = useMemo(() => opportunities.filter((item) => item.productionStatus === 'native-production-adapter').length, [opportunities])

  const refreshWorkflow = () => setWorkflowState(stateOf(workflowRef.current))
  const finishStep = (result: Readonly<{ ok: boolean; message: string }>) => {
    refreshWorkflow()
    setNotice(result.message)
    return result.ok
  }

  const createDraft = () => {
    setNotice(null)
    setAppliedCandidateId(null)
    const result = buildKineticHeadlineCandidateV16({
      project: input.project,
      compositionTicks: input.playheadTicks,
      headline,
      subhead,
    })
    if (!result.ok) {
      workflowRef.current = null
      setCandidate(null)
      setSelectedNodeId(null)
      setWorkflowState(null)
      setNotice(result.refusal.message)
      return false
    }
    const workflow = createCreativeProductionWorkflowV16(result.value)
    workflowRef.current = workflow
    setCandidate(result.value)
    setSelectedNodeId(result.value.selectedNodeId)
    const initialized = workflow.initialize()
    setWorkflowState(workflow.state())
    setNotice(initialized.message)
    return initialized.ok
  }

  const rebuildFromCurrentRevision = () => {
    workflowRef.current = null
    setCandidate(null)
    setSelectedNodeId(null)
    setWorkflowState(null)
    setAppliedCandidateId(null)
    return createDraft()
  }

  const approveStoryboard = () => {
    const workflow = workflowRef.current
    if (!workflow) return false
    return finishStep(workflow.approve('storyboard'))
  }

  const buildAnimatic = () => {
    const workflow = workflowRef.current
    if (!workflow) return false
    return finishStep(workflow.advanceAfterStoryboardApproval())
  }

  const approveAnimatic = () => {
    const workflow = workflowRef.current
    if (!workflow) return false
    return finishStep(workflow.approve('animatic'))
  }

  const buildMotion = () => {
    const workflow = workflowRef.current
    if (!workflow) return false
    return finishStep(workflow.advanceAfterAnimaticApproval())
  }

  const prepareMotionReview = async () => {
    const workflow = workflowRef.current
    if (!workflow || busy) return false
    setBusy(true)
    try {
      const result = await workflow.prepareMotionReview()
      return finishStep(result)
    } finally {
      setBusy(false)
    }
  }

  const approveMotion = () => {
    const workflow = workflowRef.current
    if (!workflow) return false
    return finishStep(workflow.approve('motion'))
  }

  const selectNode = (nodeId: string) => {
    if (!projectionDetails?.nodes.some((node) => node.nodeId === nodeId)) return false
    setSelectedNodeId(nodeId)
    return true
  }

  const applyCurvePreset = (
    trackId: string,
    leftKeyframeId: string,
    preset: Parameters<typeof applyCreativeCurvePresetV16>[0]['preset'],
  ) => {
    if (!candidate || busy) return false
    const result = applyCreativeCurvePresetV16({ candidate, trackId, leftKeyframeId, preset })
    if (!result.ok) {
      setNotice(result.refusal.message)
      return false
    }
    const workflow = createCreativeProductionWorkflowV16(result.value)
    workflowRef.current = workflow
    setCandidate(result.value)
    setSelectedNodeId(result.value.selectedNodeId)
    setAppliedCandidateId(null)
    const initialized = workflow.initialize()
    setWorkflowState(workflow.state())
    setNotice(initialized.ok
      ? `Curve changed with ${preset}. Previous approvals were discarded; review and approve this exact new Motion Graph revision.`
      : initialized.message)
    return initialized.ok
  }

  const apply = async () => {
    if (!candidate || !selectedCandidate || busy) return false
    if (input.project.projectId !== candidate.source.projectId) {
      setNotice('This Creative draft belongs to a different production project. Rebuild it from the current project.')
      return false
    }
    if (input.project.revision !== candidate.source.projectRevision) {
      setNotice(`Project changed from revision ${candidate.source.projectRevision} to ${input.project.revision}. Rebuild this Creative draft against the current project before applying it.`)
      return false
    }
    if (workflowState?.motionDraft?.status !== 'owner-approved') {
      setNotice('Approve the exact Motion Review revision before applying this Creative draft to production.')
      return false
    }
    const bundle = buildCreativeProductionApplyBundleV16(selectedCandidate)
    if (!bundle.ok) {
      setNotice(bundle.refusal.message)
      return false
    }
    setBusy(true)
    try {
      const failure = await input.onApply(bundle.value.operations, bundle.value.changeSetId, {
        provenance: bundle.value.provenance,
        extensions: bundle.value.extensions,
        expectedBaseRevision: candidate.source.projectRevision,
      })
      if (failure) {
        setNotice(failure)
        return false
      }
      setAppliedCandidateId(candidate.id)
      setNotice('Creative motion applied as one production change set. One Undo removes the complete accepted result.')
      return true
    } finally {
      setBusy(false)
    }
  }

  return Object.freeze({
    headline,
    subhead,
    setHeadline,
    setSubhead,
    candidate,
    selectedNodeId: selectedNodeId ?? candidate?.selectedNodeId ?? null,
    projection,
    projectionDetails,
    selectNode,
    applyCurvePreset,
    workflowState,
    notice,
    busy,
    appliedCandidateId,
    opportunities,
    internalTools,
    nativeOpportunityCount,
    previewOnlyOpportunityCount: opportunities.length - nativeOpportunityCount,
    createDraft,
    rebuildFromCurrentRevision,
    approveStoryboard,
    buildAnimatic,
    approveAnimatic,
    buildMotion,
    prepareMotionReview,
    approveMotion,
    apply,
  })
}
