import { useMemo, useState } from 'react'
import { filterMotionLayerProjection } from '@sanverse/motion-graph'
import type { MotionLayerProjectionResultV1, MotionSelectionStateV1 } from '@sanverse/motion-graph'

export type LayerDropIntent = 'before' | 'inside' | 'after'

export interface LayerSelectionModifiers {
  readonly toggle: boolean
  readonly range: boolean
  readonly visibleNodeIds: readonly string[]
}

export interface LayerPanelProps {
  readonly projection: MotionLayerProjectionResultV1 | null
  readonly selection: MotionSelectionStateV1
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onSelectNode: (nodeId: string, modifiers: LayerSelectionModifiers) => void
  readonly onClearSelection: () => void
  readonly onToggleEnabled: (nodeId: string) => void
  readonly onToggleLock: (nodeId: string) => void
  readonly onRename: (nodeId: string, name: string) => void
  readonly onDuplicate: (nodeId: string) => void
  readonly onDuplicateSelection: (nodeIds: readonly string[]) => void
  readonly onDelete: (nodeIds: readonly string[]) => void
  readonly onGroup: (nodeIds: readonly string[]) => void
  readonly onToggleSelectionEnabled: (nodeIds: readonly string[]) => void
  readonly onToggleSelectionLock: (nodeIds: readonly string[]) => void
  readonly onUngroup: (nodeId: string) => void
  readonly onMove: (nodeId: string, direction: -1 | 1) => void
  readonly onDrop: (sourceNodeId: string, targetNodeId: string, intent: LayerDropIntent) => void
  readonly onAddEffect: (nodeId: string) => void
  readonly onAddMask: (nodeId: string) => void
  readonly onFocusSection: (section: 'effects' | 'masks' | 'animation') => void
  readonly onUndo: () => void
  readonly onRedo: () => void
  readonly onReset: () => void
}

const typeIcon: Readonly<Record<string, string>> = Object.freeze({ group: 'G', text: 'T', shape: 'S', path: 'P', image: 'I' })

export function LayerPanel({ projection, selection, canUndo, canRedo, onSelectNode, onClearSelection, onToggleEnabled, onToggleLock, onRename, onDuplicate, onDuplicateSelection, onDelete, onGroup, onToggleSelectionEnabled, onToggleSelectionLock, onUngroup, onMove, onDrop, onAddEffect, onAddMask, onFocusSection, onUndo, onRedo, onReset }: LayerPanelProps) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null)
  const [dragNodeId, setDragNodeId] = useState<string | null>(null)

  const filtered = useMemo(() => projection ? filterMotionLayerProjection(projection, query) : null, [projection, query])
  const filteredSet = useMemo(() => new Set(filtered?.visibleNodeIds ?? []), [filtered])
  const forcedExpanded = useMemo(() => new Set(filtered?.requiredAncestorNodeIds ?? []), [filtered])

  if (!projection) return <aside className="motion-lab__layers"><div className="motion-lab__panel-title">Layers</div><p className="motion-lab__layer-empty">No graph scene is available.</p></aside>

  const isExpanded = (nodeId: string): boolean => nodeId === projection.rootNodeId || expanded.has(nodeId) || forcedExpanded.has(nodeId)
  const toggleExpanded = (nodeId: string) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId)
    return next
  })

  const visibleRows: string[] = []
  const hasRootSelection = selection.selectedNodeIds.includes(projection.rootNodeId)
  const collect = (nodeId: string) => {
    if (!filteredSet.has(nodeId)) return
    visibleRows.push(nodeId)
    const layer = projection.layersById[nodeId]!
    if (isExpanded(nodeId)) layer.childNodeIds.forEach(collect)
  }
  collect(projection.rootNodeId)

  const submitRename = (nodeId: string) => {
    const next = renameDraft.trim()
    if (next) onRename(nodeId, next)
    setRenamingNodeId(null)
  }

  const renderRow = (nodeId: string) => {
    const layer = projection.layersById[nodeId]!
    const selected = selection.selectedNodeIds.includes(nodeId)
    const primary = selection.primaryNodeId === nodeId
    const isRoot = nodeId === projection.rootNodeId
    const isGroup = layer.nodeType === 'group'
    const rowLocked = layer.effectiveLocked
    const childrenVisible = isGroup && isExpanded(nodeId)
    const badges = <span className="motion-lab__layer-badges">{layer.hasKeyframes ? <button title="Keyframes" onClick={(event) => { event.stopPropagation(); onFocusSection('animation') }}>◆</button> : layer.hasMotionDriver ? <span title="Authored motion driver">~</span> : null}{layer.effectCount ? <button title={`${layer.effectCount} effect${layer.effectCount === 1 ? '' : 's'}`} onClick={(event) => { event.stopPropagation(); onFocusSection('effects') }}>fx{layer.effectCount > 1 ? layer.effectCount : ''}</button> : null}{layer.maskCount ? <button title={`${layer.maskCount} mask${layer.maskCount === 1 ? '' : 's'}`} onClick={(event) => { event.stopPropagation(); onFocusSection('masks') }}>M{layer.maskCount > 1 ? layer.maskCount : ''}</button> : null}</span>
    return <div key={nodeId} className="motion-lab__layer-row-wrap" data-layer-node-id={nodeId}>
      <div
        className={`motion-lab__layer-row${selected ? ' motion-lab__layer-row--selected' : ''}${primary ? ' motion-lab__layer-row--primary' : ''}`}
        style={{ paddingLeft: 8 + Math.min(layer.depth, 10) * 14 }}
        draggable={!isRoot && !rowLocked && renamingNodeId !== nodeId}
        onDragStart={(event) => { setDragNodeId(nodeId); event.dataTransfer.setData('text/x-sanverse-motion-node', nodeId); event.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => setDragNodeId(null)}
        onContextMenu={(event) => { event.preventDefault(); setMenuNodeId(nodeId) }}
        onClick={(event) => onSelectNode(nodeId, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey, visibleNodeIds: visibleRows })}
      >
        <button type="button" className="motion-lab__layer-disclosure" disabled={!isGroup || layer.childNodeIds.length === 0} aria-label={childrenVisible ? 'Collapse layer' : 'Expand layer'} onClick={(event) => { event.stopPropagation(); toggleExpanded(nodeId) }}>{isGroup && layer.childNodeIds.length ? (childrenVisible ? '▾' : '▸') : '·'}</button>
        <button type="button" className={`motion-lab__layer-eye${layer.effectiveEnabled ? '' : ' motion-lab__layer-eye--muted'}`} aria-label={layer.enabled ? 'Disable layer' : 'Enable layer'} title={layer.enabled ? 'Disable layer' : 'Enable layer'} onClick={(event) => { event.stopPropagation(); onToggleEnabled(nodeId) }}>{layer.enabled ? '◉' : '○'}</button>
        <button type="button" className={`motion-lab__layer-lock${layer.effectiveLocked ? ' motion-lab__layer-lock--active' : ''}`} aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'} title={layer.lockedByAncestorNodeId ? `Locked by ${projection.layersById[layer.lockedByAncestorNodeId]?.displayName ?? layer.lockedByAncestorNodeId}` : layer.locked ? 'Unlock layer' : 'Lock layer'} onClick={(event) => { event.stopPropagation(); onToggleLock(nodeId) }}>{layer.locked ? '🔒' : layer.effectiveLocked ? '⌁' : '·'}</button>
        <span className="motion-lab__layer-type" title={layer.nodeType}>{typeIcon[layer.nodeType] ?? '?'}</span>
        {renamingNodeId === nodeId ? <input className="motion-lab__layer-rename" autoFocus value={renameDraft} maxLength={240} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenameDraft(event.target.value)} onBlur={() => submitRename(nodeId)} onKeyDown={(event) => { if (event.key === 'Enter') submitRename(nodeId); if (event.key === 'Escape') setRenamingNodeId(null) }} /> : <span className="motion-lab__layer-name" title={`${layer.displayName}\n${layer.nodeId}`}>{layer.displayName}</span>}
        {badges}
      </div>
      {dragNodeId && dragNodeId !== nodeId ? <div className="motion-lab__layer-drop-zones" style={{ marginLeft: 30 + Math.min(layer.depth, 10) * 14 }}>
        <button type="button" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(dragNodeId, nodeId, 'before'); setDragNodeId(null) }}>Before</button>
        <button type="button" disabled={!isGroup} onDragOver={(event) => { if (isGroup) event.preventDefault() }} onDrop={(event) => { if (!isGroup) return; event.preventDefault(); onDrop(dragNodeId, nodeId, 'inside'); setDragNodeId(null) }}>Inside</button>
        <button type="button" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(dragNodeId, nodeId, 'after'); setDragNodeId(null) }}>After</button>
      </div> : null}
      {menuNodeId === nodeId ? <div className="motion-lab__layer-menu" style={{ marginLeft: 30 + Math.min(layer.depth, 10) * 14 }} onMouseLeave={() => setMenuNodeId(null)}>
        <button disabled={isRoot || rowLocked} onClick={() => { setRenamingNodeId(nodeId); setRenameDraft(layer.nodeName); setMenuNodeId(null) }}>Rename</button>
        <button disabled={isRoot || rowLocked} onClick={() => { onDuplicate(nodeId); setMenuNodeId(null) }}>Duplicate</button>
        <button disabled={isRoot || rowLocked} onClick={() => { onDelete([nodeId]); setMenuNodeId(null) }}>Delete</button>
        <button disabled={selection.selectedNodeIds.length < 1 || rowLocked} onClick={() => { onGroup(selection.selectedNodeIds); setMenuNodeId(null) }}>Group</button>
        <button disabled={!isGroup || isRoot || rowLocked} onClick={() => { onUngroup(nodeId); setMenuNodeId(null) }}>Ungroup</button>
        <button disabled={isRoot || rowLocked} onClick={() => { onMove(nodeId, -1); setMenuNodeId(null) }}>Move Up</button>
        <button disabled={isRoot || rowLocked} onClick={() => { onMove(nodeId, 1); setMenuNodeId(null) }}>Move Down</button>
        <button disabled={rowLocked} onClick={() => { onAddEffect(nodeId); onFocusSection('effects'); setMenuNodeId(null) }}>Add Effect</button>
        <button disabled={rowLocked} onClick={() => { onAddMask(nodeId); onFocusSection('masks'); setMenuNodeId(null) }}>Add Mask</button>
      </div> : null}
      {isGroup && childrenVisible ? layer.childNodeIds.map((childId) => filteredSet.has(childId) ? renderRow(childId) : null) : null}
    </div>
  }

  return <aside className="motion-lab__layers" aria-label="Motion Layers">
    <div className="motion-lab__panel-title-row"><div><div className="motion-lab__panel-title">Layers</div><small>{projection.preorderNodeIds.length} graph nodes</small></div><button type="button" onClick={onReset}>Reset</button></div>
    <input className="motion-lab__layer-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search layers…" aria-label="Search layers" />
    <div className="motion-lab__layer-toolbar">
      <button type="button" disabled={!canUndo} onClick={onUndo}>Undo</button><button type="button" disabled={!canRedo} onClick={onRedo}>Redo</button>
      <button type="button" disabled={selection.selectedNodeIds.length < 1 || hasRootSelection} onClick={() => onDuplicateSelection(selection.selectedNodeIds)}>Duplicate</button>
      <button type="button" disabled={selection.selectedNodeIds.length < 1 || hasRootSelection} onClick={() => onGroup(selection.selectedNodeIds)}>Group</button>
      <button type="button" disabled={selection.selectedNodeIds.length < 1} onClick={() => onToggleSelectionEnabled(selection.selectedNodeIds)}>Eye</button>
      <button type="button" disabled={selection.selectedNodeIds.length < 1} onClick={() => onToggleSelectionLock(selection.selectedNodeIds)}>Lock</button>
      <button type="button" disabled={selection.selectedNodeIds.length < 1 || hasRootSelection} onClick={() => onDelete(selection.selectedNodeIds)}>Delete</button>
    </div>
    <div className="motion-lab__layer-tree" onClick={(event) => { if (event.target === event.currentTarget) onClearSelection() }}>{renderRow(projection.rootNodeId)}</div>
    <div className="motion-lab__layer-selection-summary">{selection.selectedNodeIds.length ? `${selection.selectedNodeIds.length} selected · primary ${selection.primaryNodeId}` : 'No selection'}</div>
  </aside>
}
