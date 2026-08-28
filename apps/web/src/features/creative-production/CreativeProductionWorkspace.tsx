import { useState } from 'react'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import type { CreativeProductionController } from './useCreativeProductionController'
import './creative-production.css'

const seconds = (ticks: number) => `${(ticks / PROJECT_TIMESCALE).toFixed(2)}s`
const status = (value: string | undefined) => value ?? 'not started'
const displayValue = (value: string | number | boolean) => typeof value === 'number' ? Number(value.toFixed(3)) : String(value)

type DeepView = 'layers' | 'timeline' | 'curves' | 'nodes'

function CreativeDeepControls({ controller }: Readonly<{ controller: CreativeProductionController }>) {
  const [view, setView] = useState<DeepView>('layers')
  const details = controller.projectionDetails
  if (!details) return null
  const selectedNodeId = controller.selectedNodeId
  return <div className="creative-production__section creative-production__deep" aria-labelledby="creative-deep-heading">
    <div className="creative-production__deep-heading">
      <div>
        <h3 id="creative-deep-heading">Deep motion controls</h3>
        <code className="creative-production__semantic-id">{selectedNodeId}</code>
      </div>
      <span className="creative-production__badge">same Motion Graph</span>
    </div>
    <div className="creative-production__deep-tabs" role="tablist" aria-label="Creative deep controls">
      {(['layers', 'timeline', 'curves', 'nodes'] as const).map((item) => <button
        key={item}
        type="button"
        role="tab"
        aria-selected={view === item}
        onClick={() => setView(item)}
      >{item === 'layers' ? 'C3 Layers' : item === 'timeline' ? 'C4 Timeline' : item === 'curves' ? 'C5 Curves' : 'C6 Nodes'}</button>)}
    </div>

    {view === 'layers' ? <div className="creative-production__deep-list" role="tabpanel" aria-label="C3 Layers">
      {details.layers.map((layer) => <button
        key={layer.nodeId}
        type="button"
        className="creative-production__deep-row"
        data-selected={selectedNodeId === layer.nodeId}
        style={{ paddingLeft: `${8 + layer.depth * 12}px` }}
        onClick={() => controller.selectNode(layer.nodeId)}
      >
        <span><strong>{layer.displayName}</strong><small>{layer.nodeType} · {layer.nodeId}</small></span>
        <small>{layer.hasKeyframes ? 'keys' : layer.hasMotionDriver ? 'driver' : layer.hasBinding ? 'bound' : 'static'}{layer.effectCount ? ` · ${layer.effectCount} fx` : ''}{layer.maskCount ? ` · ${layer.maskCount} masks` : ''}</small>
      </button>)}
    </div> : null}

    {view === 'timeline' ? <div className="creative-production__deep-list" role="tabpanel" aria-label="C4 Timeline">
      {details.dopeTracks.map((track) => <button
        key={track.trackId}
        type="button"
        className="creative-production__deep-row creative-production__track-row"
        data-selected={selectedNodeId === track.nodeId}
        onClick={() => controller.selectNode(track.nodeId)}
      >
        <span><strong>{track.label}</strong><small>{track.nodeId} · {track.animationKind}</small></span>
        <span className="creative-production__keys" aria-label={`${track.keyframes.length} keyframes`}>
          {track.keyframes.map((key) => <i key={key.selectionId} title={`${seconds(key.tick)} · ${displayValue(key.value)} · ${key.interpolation}`}>{seconds(key.tick)}</i>)}
        </span>
      </button>)}
    </div> : null}

    {view === 'curves' ? <div className="creative-production__deep-list" role="tabpanel" aria-label="C5 Curves">
      {details.curveTracks.map((track) => {
        const canPreset = track.editable && track.keyframes.length > 1
        const leftKey = track.keyframes[0]
        return <article key={track.trackId} className="creative-production__curve" data-selected={selectedNodeId === track.nodeId}>
          <button type="button" className="creative-production__curve-heading" onClick={() => controller.selectNode(track.nodeId)}>
            <span><strong>{track.label}</strong><small>{track.nodeId} · {track.property}</small></span>
            <small>{track.editable ? `${track.keyframes.length} keys` : track.readOnlyReason}</small>
          </button>
          <div className="creative-production__curve-keys">
            {track.keyframes.map((key) => <span key={key.selectionId}><b>{seconds(key.tick)}</b>{key.value.toFixed(3)} · {key.interpolation}</span>)}
          </div>
          {canPreset && leftKey ? <div className="creative-production__curve-actions" aria-label={`Curve presets for ${track.label}`}>
            {(['linear', 'soft', 'snappy', 'heavy'] as const).map((preset) => <button key={preset} type="button" disabled={controller.busy} onClick={() => controller.applyCurvePreset(track.trackId, leftKey.keyframeId, preset)}>{preset}</button>)}
          </div> : null}
        </article>
      })}
    </div> : null}

    {view === 'nodes' ? <div className="creative-production__deep-list" role="tabpanel" aria-label="C6 Nodes">
      {details.nodes.map((node) => <button
        key={node.nodeId}
        type="button"
        className="creative-production__deep-row"
        data-selected={selectedNodeId === node.nodeId}
        onClick={() => controller.selectNode(node.nodeId)}
      >
        <span><strong>{node.name}</strong><small>{node.type} · {node.nodeId}</small></span>
        <small>{node.childNodeIds.length} child · {node.effectIds.length} fx · {node.maskIds.length} mask · {node.bindingSourceNodeIds.length} bind</small>
      </button>)}
    </div> : null}

    <p className="creative-production__muted">C3, C4, C5 and C6 are projections over the same canonical Motion Graph. A C5 edit uses the existing graph operation builder and discards the previous approval chain before a new production apply is allowed.</p>
  </div>
}

export function CreativeProductionWorkspace({
  controller,
  assetLabel,
}: Readonly<{
  controller: CreativeProductionController
  assetLabel: string
}>) {
  const candidate = controller.candidate
  const state = controller.workflowState
  return (
    <section className="creative-production" aria-labelledby="creative-production-heading">
      <header className="creative-production__heading">
        <div>
          <span className="creative-production__eyebrow">CREATIVE ENGINE V1.6</span>
          <h2 id="creative-production-heading">Production motion</h2>
        </div>
        <span className="creative-production__badge">{controller.opportunities.length} Library</span>
      </header>

      <div className="creative-production__section">
        <h3>Source context</h3>
        <p>The Program Canvas remains the one read-only production source preview while this Creative sandbox is being designed.</p>
        {candidate ? <dl className="creative-production__facts">
          <div><dt>Source</dt><dd>{assetLabel}</dd></div>
          <div><dt>Project revision</dt><dd>{candidate.source.projectRevision}</dd></div>
          <div><dt>Composition</dt><dd>{seconds(candidate.source.compositionTicks)}</dd></div>
          <div><dt>Source</dt><dd>{seconds(candidate.source.sourceStartTicks)}–{seconds(candidate.source.sourceEndTicks)}</dd></div>
          <div><dt>Ratio</dt><dd>{candidate.renderContext.composition.width}×{candidate.renderContext.composition.height}</dd></div>
        </dl> : <p className="creative-production__muted">Choose a visible moment in primary footage, then create a Creative draft.</p>}
      </div>

      <div className="creative-production__section">
        <h3>Creative Library</h3>
        <div className="creative-production__counts" aria-label="Creative production adapter coverage">
          <span><strong>{controller.nativeOpportunityCount}</strong> production adapter</span>
          <span><strong>{controller.previewOnlyOpportunityCount}</strong> Creative preview only</span>
        </div>
        <article className="creative-production__library-card">
          <strong>Kinetic Headline</strong>
          <span>Native V1.6 production adapter</span>
          <p>Canonical Motion Graph design → existing production title + visual-properties render path.</p>
        </article>
        <details>
          <summary>Why the other {controller.previewOnlyOpportunityCount} components are preview-only</summary>
          <p>They remain fully available in the canonical Creative Library. V1.6 refuses to silently flatten them into a different production primitive until an explicit lossless adapter exists.</p>
        </details>
      </div>

      <div className="creative-production__section creative-production__form">
        <h3>Storyboard setup</h3>
        <label>Headline<input value={controller.headline} maxLength={60} onChange={(event) => controller.setHeadline(event.target.value)} /></label>
        <label>Subhead<input value={controller.subhead} maxLength={90} onChange={(event) => controller.setSubhead(event.target.value)} /></label>
        <button type="button" className="creative-production__primary" disabled={controller.busy || !controller.headline.trim()} onClick={controller.createDraft}>Create Creative draft</button>
      </div>

      {candidate ? <div className="creative-production__section">
        <h3>Closed-loop review</h3>
        <ol className="creative-production__stages">
          <li><span><strong>Storyboard + KVS</strong><small>{status(state?.storyboardSandbox?.storyboard.status)}</small></span><button type="button" disabled={controller.busy || state?.storyboardSandbox?.storyboard.status === 'owner-approved'} onClick={controller.approveStoryboard}>Approve Storyboard</button></li>
          <li><span><strong>Animatic</strong><small>{status(state?.animatic?.status)}</small></span><button type="button" disabled={controller.busy || state?.storyboardSandbox?.storyboard.status !== 'owner-approved' || Boolean(state?.animatic)} onClick={controller.buildAnimatic}>Build Animatic</button></li>
          <li><span><strong>Animatic approval</strong><small>{status(state?.animatic?.status)}</small></span><button type="button" disabled={controller.busy || !state?.animatic || state.animatic.status === 'owner-approved'} onClick={controller.approveAnimatic}>Approve Animatic</button></li>
          <li><span><strong>Motion Forge</strong><small>{status(state?.motionDraft?.status)}</small></span><button type="button" disabled={controller.busy || state?.animatic?.status !== 'owner-approved' || Boolean(state?.motionDraft)} onClick={controller.buildMotion}>Build Motion</button></li>
          <li><span><strong>Motion Review</strong><small>{state?.visualEvidence ? 'review ready' : 'not rendered'}</small></span><button type="button" disabled={controller.busy || !state?.motionDraft || Boolean(state?.visualEvidence)} onClick={() => void controller.prepareMotionReview()}>Prepare Review</button></li>
          <li><span><strong>Motion approval</strong><small>{status(state?.motionDraft?.status)}</small></span><button type="button" disabled={controller.busy || !state?.visualEvidence || state?.motionDraft?.status === 'owner-approved'} onClick={controller.approveMotion}>Approve Motion</button></li>
        </ol>
      </div> : null}

      {controller.projection ? <div className="creative-production__section">
        <h3>One semantic selection</h3>
        <code className="creative-production__semantic-id">{controller.projection.selectedNodeId}</code>
        <div className="creative-production__projection-grid">
          <span data-pass={controller.projection.c3HasSelection}>C3 Layers · {controller.projection.layerCount}</span>
          <span data-pass={controller.projection.c4HasSelection}>C4 Timeline · {controller.projection.dopeTrackCount}</span>
          <span data-pass={controller.projection.c5HasSelection}>C5 Curves · {controller.projection.curveTrackCount}</span>
          <span data-pass={controller.projection.c6HasSelection}>C6 Nodes · {controller.projection.nodeGraphCount}</span>
        </div>
      </div> : null}

      <CreativeDeepControls controller={controller} />

      {candidate ? <div className="creative-production__section creative-production__apply">
        <button type="button" className="creative-production__primary" disabled={controller.busy || state?.motionDraft?.status !== 'owner-approved' || controller.appliedCandidateId === candidate.id} onClick={() => void controller.apply()}>
          {controller.appliedCandidateId === candidate.id ? 'Applied to production' : 'Apply to production'}
        </button>
        <p>One approved Creative result is submitted as one existing production change set, so one Undo removes it.</p>
        <button type="button" className="creative-production__text" disabled={controller.busy} onClick={controller.rebuildFromCurrentRevision}>Rebuild from current revision</button>
      </div> : null}

      {controller.notice ? <p className="creative-production__notice" role="status">{controller.notice}</p> : null}
    </section>
  )
}

export function CreativeProductionContext({
  controller,
  projectRevision,
  assetLabel,
}: Readonly<{
  controller: CreativeProductionController
  projectRevision: number
  assetLabel: string
}>) {
  const candidate = controller.candidate
  const selectedNode = controller.projectionDetails?.nodes.find((node) => node.nodeId === controller.selectedNodeId) ?? null
  const selectedLayer = controller.projectionDetails?.layers.find((layer) => layer.nodeId === controller.selectedNodeId) ?? null
  return <div className="creative-production-context">
    <section>
      <h3>Production authority</h3>
      <dl className="creative-production__facts">
        <div><dt>Current revision</dt><dd>{projectRevision}</dd></div>
        <div><dt>Source</dt><dd>{candidate ? assetLabel : 'No Creative draft'}</dd></div>
        <div><dt>Adapter</dt><dd>{candidate ? 'Kinetic Headline → title + visual properties' : '—'}</dd></div>
        <div><dt>History</dt><dd>One change set / one Undo</dd></div>
      </dl>
    </section>
    {candidate ? <section>
      <h3>Contextual properties</h3>
      <code className="creative-production__semantic-id">{controller.selectedNodeId}</code>
      {selectedNode ? <dl className="creative-production__facts">
        <div><dt>Name</dt><dd>{selectedNode.name}</dd></div>
        <div><dt>Type</dt><dd>{selectedNode.type}</dd></div>
        <div><dt>Children</dt><dd>{selectedNode.childNodeIds.length}</dd></div>
        <div><dt>Effects</dt><dd>{selectedNode.effectIds.length}</dd></div>
        <div><dt>Masks</dt><dd>{selectedNode.maskIds.length}</dd></div>
        <div><dt>Animation</dt><dd>{selectedLayer?.hasKeyframes ? 'Keyframed' : selectedLayer?.hasMotionDriver ? 'Motion driver' : selectedLayer?.hasBinding ? 'Binding' : 'Static'}</dd></div>
      </dl> : null}
      <label>Headline<input value={controller.headline} maxLength={60} onChange={(event) => controller.setHeadline(event.target.value)} /></label>
      <label>Subhead<input value={controller.subhead} maxLength={90} onChange={(event) => controller.setSubhead(event.target.value)} /></label>
      <p className="creative-production__muted">Changing content fields does not silently rewrite an approved sandbox. Rebuild the draft to create a new exact review revision.</p>
    </section> : null}
    <section>
      <h3>Truthful V1.6 boundary</h3>
      <p>Canonical Creative scenes remain Motion Graph state. Only the explicitly supported Kinetic Headline adapter can cross into the existing production edit/render path in this release.</p>
    </section>
  </div>
}

export function CreativeProductionAiTools({ controller }: Readonly<{ controller: CreativeProductionController }>) {
  const keyTools = controller.internalTools.filter((tool) => ['motion.apply-plan-atomic-v15', 'expert.assess-performance-v15', 'external.inspect-three-webgl'].includes(tool.id))
  return <section className="creative-production-ai" aria-labelledby="creative-ai-tools-heading">
    <h3 id="creative-ai-tools-heading">Creative Engine tools</h3>
    <p><strong>{controller.internalTools.length}</strong> existing internal T0/T1/T2 tools. AI uses this registry; it does not own a second project or approval path.</p>
    <ul>{keyTools.map((tool) => <li key={tool.id}><code>{tool.id}</code></li>)}</ul>
    <small>Exact owner approvals and current production revision are still required.</small>
  </section>
}