import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CREATIVE_CONSTRAINT_TYPES,
  CREATIVE_DIRECTIVE_KINDS,
  CREATIVE_EMPHASIS_INTENTS,
  CREATIVE_FOOTAGE_TREATMENTS,
  CREATIVE_MOTION_CHARACTERS,
  CREATIVE_TRANSITION_INTENTS,
  FixtureCreativePlanner,
  PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
  PRODUCT_LAUNCH_FIXTURE_CATALOG,
  applyCreativeDirectionOperation,
  createCreativeDirective,
  creativeTicksToSeconds,
  validateCreativeDirectionDocument,
} from '@sanverse/creative-direction'
import type {
  CreativeDirectiveKindV1,
  CreativeDirectiveV1,
  CreativeDirectionDocumentV1,
  CreativeEditProposalV1,
} from '@sanverse/creative-direction'

const TICKS_PER_SECOND = 1_440_000
const trackClass = (track: string) => `creative-direction__region creative-direction__region--${track.toLowerCase()}`
const formatSeconds = (ticks: number) => `${creativeTicksToSeconds(ticks).toFixed(2)}s`

const summaryForDirective = (directive: CreativeDirectiveV1): string => {
  if (directive.kind === 'style') return directive.styleIntent
  if (directive.kind === 'graphic') return directive.communicationIntent
  if (directive.kind === 'motion') return directive.character
  if (directive.kind === 'footage') return directive.treatment
  if (directive.kind === 'transition') return directive.transitionIntent
  if (directive.kind === 'emphasis') return directive.emphasisIntent
  if (directive.kind === 'note') return directive.text
  return directive.constraint
}

const cloneDirective = (directive: CreativeDirectiveV1, patch: Record<string, unknown>): CreativeDirectiveV1 => Object.freeze({ ...directive, ...patch }) as CreativeDirectiveV1

export function CreativeDirectionLab() {
  const [document, setDocument] = useState<CreativeDirectionDocumentV1>(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
  const [selectedDirectiveId, setSelectedDirectiveId] = useState<string | null>('graphic:semantic-highlight')
  const [proposal, setProposal] = useState<CreativeEditProposalV1 | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newKind, setNewKind] = useState<CreativeDirectiveKindV1>('graphic')
  const [newStartTicks, setNewStartTicks] = useState(0)
  const [newEndTicks, setNewEndTicks] = useState(TICKS_PER_SECOND * 5)
  const idCounter = useRef(1)
  const operationCounter = useRef(1)

  const selectedDirective = document.directives.find((directive) => directive.id === selectedDirectiveId) ?? null
  const selectedPlacement = proposal?.placements.find((placement) => placement.sourceDirectiveId === selectedDirectiveId) ?? null

  useEffect(() => {
    let active = true
    new FixtureCreativePlanner().propose({ document, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG }).then((nextProposal) => {
      if (active) setProposal(nextProposal)
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : String(caught))
    })
    return () => { active = false }
  }, [document])

  const directivesByTrack = useMemo(() => new Map(document.tracks.map((track) => [track.type, document.directives.filter((directive) => directive.track === track.type)] as const)), [document])
  const validation = useMemo(() => validateCreativeDirectionDocument(document), [document])

  const apply = (operation: Parameters<typeof applyCreativeDirectionOperation>[1]): boolean => {
    const result = applyCreativeDirectionOperation(document, operation)
    if (!result.ok) {
      setError(`${result.error.code}: ${result.error.message}`)
      return false
    }
    setDocument(result.document)
    setError(null)
    return true
  }

  const nextOperationId = (kind: string) => `creative-lab:${kind}:${operationCounter.current++}`

  const replaceSelected = (directive: CreativeDirectiveV1): void => {
    if (!selectedDirectiveId) return
    apply({ operationId: nextOperationId('replace'), type: 'replace-directive', directiveId: selectedDirectiveId, directive })
  }

  const addRegion = (): void => {
    const id = `lab-directive:${newKind}:${idCounter.current++}`
    const directive = createCreativeDirective(newKind, { id, startTicks: newStartTicks, endTicks: newEndTicks })
    if (apply({ operationId: nextOperationId('add'), type: 'add-directive', directive })) setSelectedDirectiveId(id)
  }

  const deleteSelected = (): void => {
    if (!selectedDirective) return
    if (apply({ operationId: nextOperationId('delete'), type: 'remove-directive', directiveId: selectedDirective.id })) setSelectedDirectiveId(null)
  }

  const duplicateSelected = (): void => {
    if (!selectedDirective) return
    const duplicateId = `${selectedDirective.id}:copy-${idCounter.current++}`
    if (apply({ operationId: nextOperationId('duplicate'), type: 'duplicate-directive', directiveId: selectedDirective.id, duplicateId, offsetTicks: TICKS_PER_SECOND })) setSelectedDirectiveId(duplicateId)
  }

  const moveSelected = (deltaTicks: number): void => {
    if (!selectedDirective) return
    apply({ operationId: nextOperationId('move'), type: 'move-directive', directiveId: selectedDirective.id, deltaTicks })
  }

  const changeKind = (kind: CreativeDirectiveKindV1): void => {
    if (!selectedDirective) return
    apply({ operationId: nextOperationId('kind'), type: 'change-directive-kind', directiveId: selectedDirective.id, kind })
  }

  const resize = (edge: 'start' | 'end', tick: number): void => {
    if (!selectedDirective) return
    apply({ operationId: nextOperationId(`resize-${edge}`), type: 'resize-directive', directiveId: selectedDirective.id, edge, tick })
  }

  const resetFixture = (): void => {
    setDocument(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
    setSelectedDirectiveId('graphic:semantic-highlight')
    setError(null)
  }

  return (
    <main className="creative-direction" data-creative-direction-lab="true">
      <header className="creative-direction__topbar">
        <div>
          <small>SANVERSE CREATIVE ENGINE · PLAN B0</small>
          <h1>Creative Direction Lab</h1>
        </div>
        <div className="creative-direction__topbar-meta">
          <strong>{formatSeconds(document.durationTicks)}</strong>
          <span>{document.directives.length} directives</span>
          <button type="button" onClick={resetFixture}>Reset fixture</button>
        </div>
      </header>

      <section className="creative-direction__workspace">
        <section className="creative-direction__main">
          <section className="creative-direction__preview" aria-label="Creative Direction preview">
            <div className="creative-direction__preview-frame">
              <div className="creative-direction__preview-eyebrow">SEMANTIC PREVIEW</div>
              <h2>{selectedDirective ? summaryForDirective(selectedDirective) : 'Select a Creative Direction region'}</h2>
              {selectedDirective ? <p>{formatSeconds(selectedDirective.startTicks)} → {formatSeconds(selectedDirective.endTicks)} · {selectedDirective.track}</p> : <p>The preview is intentionally semantic in B0. Plan A resolution is shown beside it.</p>}
              {selectedPlacement ? (
                <div className="creative-direction__resolved-card">
                  <small>Fixture planner resolves this graphic to</small>
                  <strong>{selectedPlacement.selectedComponentId ?? 'Unresolved Plan-A component'}</strong>
                  <span>{selectedPlacement.placementIntent} · {selectedPlacement.motionIntent ?? 'no motion preference'}</span>
                </div>
              ) : selectedDirective?.kind === 'style' ? (
                <div className="creative-direction__resolved-card"><small>Style intent</small><strong>{selectedDirective.styleIntent}</strong></div>
              ) : null}
            </div>
          </section>

          <section className="creative-direction__timeline" aria-label="Creative Direction timeline">
            <div className="creative-direction__timeline-heading">
              <div>
                <strong>CREATIVE DIRECTION</strong>
                <small>Canonical authority: exact project ticks · 1,440,000 ticks/second</small>
              </div>
              <div className="creative-direction__ticks"><span>0</span><span>{Math.round(document.durationTicks / 2).toLocaleString()}</span><span>{document.durationTicks.toLocaleString()}</span></div>
            </div>
            <div className="creative-direction__ruler" aria-hidden="true">
              {Array.from({ length: 11 }, (_, index) => <span key={index} style={{ left: `${index * 10}%` }}><i />{Math.round((document.durationTicks / TICKS_PER_SECOND) * index / 10)}s</span>)}
            </div>
            <div className="creative-direction__tracks">
              {document.tracks.map((track) => (
                <div className="creative-direction__track" key={track.id} data-creative-track={track.type}>
                  <div className="creative-direction__track-label"><strong>{track.label}</strong><small>{track.type}</small></div>
                  <div className="creative-direction__track-lane">
                    {(directivesByTrack.get(track.type) ?? []).map((directive) => {
                      const left = (directive.startTicks / document.durationTicks) * 100
                      const width = ((directive.endTicks - directive.startTicks) / document.durationTicks) * 100
                      return (
                        <button
                          type="button"
                          key={directive.id}
                          className={`${trackClass(track.type)}${selectedDirectiveId === directive.id ? ' is-selected' : ''}`}
                          data-directive-id={directive.id}
                          aria-pressed={selectedDirectiveId === directive.id}
                          style={{ left: `${left}%`, width: `${Math.max(width, 0.7)}%` }}
                          onClick={() => setSelectedDirectiveId(directive.id)}
                          title={`${directive.id} · ${directive.startTicks} → ${directive.endTicks}`}
                        >
                          <strong>{summaryForDirective(directive)}</strong>
                          <small>{formatSeconds(directive.endTicks - directive.startTicks)}</small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="creative-direction__inspector" aria-label="Creative Direction inspector">
          <section>
            <h2>Add region</h2>
            <label><span>Directive type</span><select aria-label="New directive type" value={newKind} onChange={(event) => setNewKind(event.target.value as CreativeDirectiveKindV1)}>{CREATIVE_DIRECTIVE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label><span>Start tick</span><input aria-label="New region start tick" type="number" min={0} max={document.durationTicks - 1} step={1} value={newStartTicks} onChange={(event) => setNewStartTicks(Number(event.target.value))} /></label>
            <label><span>End tick</span><input aria-label="New region end tick" type="number" min={1} max={document.durationTicks} step={1} value={newEndTicks} onChange={(event) => setNewEndTicks(Number(event.target.value))} /></label>
            <button type="button" onClick={addRegion}>+ Add exact-tick region</button>
          </section>

          <section>
            <h2>Selected region</h2>
            {selectedDirective ? (
              <>
                <div className="creative-direction__identity"><strong>{selectedDirective.id}</strong><small>{selectedDirective.source} · {selectedDirective.priority} · {selectedDirective.status}</small></div>
                <label><span>Directive type</span><select aria-label="Selected directive type" value={selectedDirective.kind} onChange={(event) => changeKind(event.target.value as CreativeDirectiveKindV1)}>{CREATIVE_DIRECTIVE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
                <label><span>Start tick</span><input aria-label="Selected start tick" type="number" min={0} max={selectedDirective.endTicks - 1} step={1} value={selectedDirective.startTicks} onChange={(event) => resize('start', Number(event.target.value))} /></label>
                <label><span>End tick</span><input aria-label="Selected end tick" type="number" min={selectedDirective.startTicks + 1} max={document.durationTicks} step={1} value={selectedDirective.endTicks} onChange={(event) => resize('end', Number(event.target.value))} /></label>
                <div className="creative-direction__button-row"><button type="button" onClick={() => moveSelected(-TICKS_PER_SECOND)}>← 1 second</button><button type="button" onClick={() => moveSelected(TICKS_PER_SECOND)}>1 second →</button></div>
                {selectedDirective.kind === 'style' ? <label><span>Style intent</span><input aria-label="Style intent" value={selectedDirective.styleIntent} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { styleIntent: event.target.value }))} /></label> : null}
                {selectedDirective.kind === 'graphic' ? <><label><span>Communication intent</span><input aria-label="Communication intent" value={selectedDirective.communicationIntent} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { communicationIntent: event.target.value }))} /></label><label><span>Primary text</span><textarea aria-label="Graphic primary text" value={selectedDirective.content.primaryText ?? ''} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { content: Object.freeze({ ...selectedDirective.content, primaryText: event.target.value }) }))} /></label></> : null}
                {selectedDirective.kind === 'motion' ? <label><span>Motion character</span><select aria-label="Motion character" value={selectedDirective.character} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { character: event.target.value }))}>{CREATIVE_MOTION_CHARACTERS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
                {selectedDirective.kind === 'footage' ? <label><span>Footage treatment</span><select aria-label="Footage treatment" value={selectedDirective.treatment} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { treatment: event.target.value }))}>{CREATIVE_FOOTAGE_TREATMENTS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
                {selectedDirective.kind === 'transition' ? <label><span>Transition intent</span><select aria-label="Transition intent" value={selectedDirective.transitionIntent} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { transitionIntent: event.target.value }))}>{CREATIVE_TRANSITION_INTENTS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
                {selectedDirective.kind === 'emphasis' ? <label><span>Emphasis intent</span><select aria-label="Emphasis intent" value={selectedDirective.emphasisIntent} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { emphasisIntent: event.target.value }))}>{CREATIVE_EMPHASIS_INTENTS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
                {selectedDirective.kind === 'note' ? <label><span>Note</span><textarea aria-label="Creative note" value={selectedDirective.text} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { text: event.target.value }))} /></label> : null}
                {selectedDirective.kind === 'constraint' ? <label><span>Constraint</span><select aria-label="Constraint type" value={selectedDirective.constraint} onChange={(event) => replaceSelected(cloneDirective(selectedDirective, { constraint: event.target.value }))}>{CREATIVE_CONSTRAINT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
                <div className="creative-direction__button-row"><button type="button" onClick={duplicateSelected}>Duplicate +1s</button><button type="button" className="creative-direction__danger" onClick={deleteSelected}>Delete</button></div>
              </>
            ) : <p>Select a region to edit it.</p>}
          </section>

          <section>
            <h2>Typed proposal</h2>
            {proposal ? <><div className="creative-direction__proposal-summary"><strong>{proposal.placements.length} placements</strong><span>{proposal.styleAssignments.length} style · {proposal.motionAssignments.length} motion · {proposal.footageTreatments.length} footage</span></div><div className="creative-direction__proposal-list">{proposal.placements.map((placement) => <div key={placement.id}><small>{formatSeconds(placement.startTicks)} → {formatSeconds(placement.endTicks)}</small><strong>{placement.selectedComponentId ?? 'unresolved'}</strong><span>{placement.communicationIntent}</span></div>)}</div></> : <p>Planning fixture…</p>}
          </section>

          <section>
            <h2>Validation</h2>
            <div className={validation.ok ? 'creative-direction__validation is-ok' : 'creative-direction__validation is-error'}>{validation.ok ? 'Document valid' : `${validation.issues.length} issue(s)`}</div>
            {error ? <div className="creative-direction__error" role="status">{error}</div> : null}
          </section>
        </aside>
      </section>
    </main>
  )
}
