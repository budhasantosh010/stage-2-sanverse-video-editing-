import { createContext, useContext } from 'react'
import type { CSSProperties, PropsWithChildren, ReactNode } from 'react'
import type { MotionComponentModuleV1, MotionCompositionV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import type { MotionGraphBackedComponentModuleV1, MotionGraphOperationV1, MotionGraphPatchV1, ResolvedMotionNodeV1, ResolvedMotionSceneV1 } from '@sanverse/motion-graph'
import { applyMotionGraphPatches, applyMotionOperations, evaluateScene } from '@sanverse/motion-graph'

export interface MotionCompositionFrameProps extends PropsWithChildren {
  readonly composition: MotionCompositionV1
  readonly displayScale?: number
  readonly background?: string
  readonly className?: string
  readonly overlays?: ReactNode
}

export function MotionCompositionFrame({ composition, displayScale = 1, background = 'transparent', className, children, overlays }: MotionCompositionFrameProps) {
  if (!Number.isFinite(displayScale) || displayScale <= 0) throw new RangeError('displayScale must be a positive finite number.')
  const shellStyle: CSSProperties = { position: 'relative', width: composition.width * displayScale, height: composition.height * displayScale, overflow: 'hidden', flex: '0 0 auto' }
  const compositionStyle: CSSProperties = { position: 'absolute', inset: 0, width: composition.width, height: composition.height, transformOrigin: 'top left', transform: `scale(${displayScale})`, background, overflow: 'hidden', isolation: 'isolate' }
  return <div className={className} style={shellStyle} data-motion-frame-shell="true"><div style={compositionStyle} data-motion-composition="true">{children}{overlays}</div></div>
}

interface MotionResolvedSceneContextValue {
  readonly scene: ResolvedMotionSceneV1
  readonly selectedNodeId: string | null
}
const MotionResolvedSceneContext = createContext<MotionResolvedSceneContextValue | null>(null)

const isGraphBackedModule = <Props, Style>(module: MotionComponentModuleV1<Props, Style>): module is MotionGraphBackedComponentModuleV1<Props, Style> =>
  typeof (module as Partial<MotionGraphBackedComponentModuleV1<Props, Style>>).createScene === 'function'

export interface MotionComponentHostProps<Props, Style> {
  readonly module: MotionComponentModuleV1<Props, Style>
  readonly props: Props
  readonly style: Style
  readonly context: MotionRenderContextV1
  readonly graphPatches?: readonly MotionGraphPatchV1[]
  readonly graphOperations?: readonly MotionGraphOperationV1[]
  readonly selectedGraphNodeId?: string | null
}

export function MotionComponentHost<Props, Style>({ module, props, style, context, graphPatches = [], graphOperations = [], selectedGraphNodeId = null }: MotionComponentHostProps<Props, Style>) {
  const Component = module.Component
  const resolvedScene = isGraphBackedModule(module)
    ? (() => {
        const patchedScene = applyMotionGraphPatches(module.createScene(props, style, context), graphPatches)
        const operated = applyMotionOperations(patchedScene, graphOperations)
        if (!operated.ok) throw new RangeError(`Motion operation ${operated.error.operationId} failed in component host: ${operated.error.message}`)
        return evaluateScene(operated.scene, context)
      })()
    : null
  const component = <Component props={props} style={style} context={context} />
  return (
    <div data-motion-component-id={module.definition.id} data-motion-component-version={module.definition.version} data-motion-graph-backed={resolvedScene ? 'true' : 'false'} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {resolvedScene
        ? <MotionResolvedSceneContext.Provider value={{ scene: resolvedScene, selectedNodeId: selectedGraphNodeId }}>{component}</MotionResolvedSceneContext.Provider>
        : component}
    </div>
  )
}

export const useMotionGraphPresentation = (): Readonly<{ scene: ResolvedMotionSceneV1 | null; selectedNodeId: string | null }> => {
  const value = useContext(MotionResolvedSceneContext)
  return value ? { scene: value.scene, selectedNodeId: value.selectedNodeId } : { scene: null, selectedNodeId: null }
}
export const useResolvedMotionScene = (): ResolvedMotionSceneV1 | null => useMotionGraphPresentation().scene
export const useResolvedMotionNode = (nodeId: string): ResolvedMotionNodeV1 | null => useResolvedMotionScene()?.nodes[nodeId] ?? null

const alphaColor = (color: string, opacity: number): string => {
  const bounded = Math.max(0, Math.min(1, opacity))
  const match = /^#([0-9a-f]{6})$/iu.exec(color)
  if (!match) return color
  const hex = match[1]!
  return `rgba(${Number.parseInt(hex.slice(0, 2), 16)},${Number.parseInt(hex.slice(2, 4), 16)},${Number.parseInt(hex.slice(4, 6), 16)},${bounded})`
}

export const motionGraphEffectFilter = (node: ResolvedMotionNodeV1): string => node.effects
  .filter((effect) => effect.enabled)
  .map((effect) => {
    const number = (name: string, fallback: number): number => typeof effect.parameters[name] === 'number' ? effect.parameters[name] as number : fallback
    const color = (name: string, fallback: string): string => typeof effect.parameters[name] === 'string' ? effect.parameters[name] as string : fallback
    if (effect.effectType === 'blur') return `blur(${number('radius', 0)}px)`
    if (effect.effectType === 'drop-shadow') return `drop-shadow(${number('offsetX', 0)}px ${number('offsetY', 16)}px ${number('blur', 28)}px ${alphaColor(color('color', '#000000'), number('opacity', 0.3))})`
    if (effect.effectType === 'glow') return `drop-shadow(0 0 ${number('radius', 18)}px ${alphaColor(color('color', '#ffffff'), number('intensity', 0.25))})`
    if (effect.effectType === 'brightness') return `brightness(${number('amount', 1)})`
    if (effect.effectType === 'contrast') return `contrast(${number('amount', 1)})`
    if (effect.effectType === 'saturation') return `saturate(${number('amount', 1)})`
    return `hue-rotate(${number('degrees', 0)}deg)`
  })
  .join(' ')

const escapeSvg = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const maskImageFor = (node: ResolvedMotionNodeV1): string | null => {
  const masks = node.masks.filter((mask) => mask.enabled)
  if (masks.length === 0) return null
  const hasInvert = masks.some((mask) => mask.invert)
  const background = hasInvert ? 'white' : 'black'
  const shapes = masks.map((mask, index) => {
    const expansion = mask.expansion * 100
    const x = mask.x * 100 - expansion
    const y = mask.y * 100 - expansion
    const width = mask.width * 100 + expansion * 2
    const height = mask.height * 100 + expansion * 2
    const fill = mask.invert ? 'black' : 'white'
    const filterId = `f${index}`
    const filter = mask.feather > 0 ? `<filter id="${filterId}"><feGaussianBlur stdDeviation="${Math.max(0, mask.feather * 50)}"/></filter>` : ''
    const filterAttr = mask.feather > 0 ? ` filter="url(#${filterId})"` : ''
    const common = `fill="${fill}" opacity="${Math.max(0, Math.min(1, mask.opacity))}"${filterAttr}`
    if (mask.type === 'ellipse') return `${filter}<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${Math.max(0, width / 2)}" ry="${Math.max(0, height / 2)}" ${common}/>`
    const radius = mask.type === 'rounded-rectangle' ? Math.max(0, mask.radius * 100) : 0
    return `${filter}<rect x="${x}" y="${y}" width="${Math.max(0, width)}" height="${Math.max(0, height)}" rx="${radius}" ry="${radius}" ${common}/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="${background}"/>${shapes}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(escapeSvg(svg))}")`
}

export const mergeMotionGraphNodeStyle = (base: CSSProperties, node: ResolvedMotionNodeV1 | null, selected = false): CSSProperties => {
  if (!node) return base
  const hasGraphTransform = node.transform.positionX !== 0 || node.transform.positionY !== 0 || node.transform.rotationDeg !== 0 || node.transform.scaleX !== 1 || node.transform.scaleY !== 1
  const hasEnabledEffects = node.effects.some((effect) => effect.enabled)
  const hasEnabledMasks = node.masks.some((mask) => mask.enabled)
  const hasGraphPresentation = !node.visible || node.opacity !== 1 || hasGraphTransform || node.blendMode !== 'normal' || hasEnabledEffects || hasEnabledMasks || selected
  if (!hasGraphPresentation) return base
  const baseOpacity = typeof base.opacity === 'number' ? base.opacity : 1
  const transformParts: string[] = []
  if (node.transform.positionX !== 0 || node.transform.positionY !== 0) transformParts.push(`translate3d(${node.transform.positionX}px, ${node.transform.positionY}px, 0)`)
  if (node.transform.rotationDeg !== 0) transformParts.push(`rotate(${node.transform.rotationDeg}deg)`)
  if (node.transform.scaleX !== 1 || node.transform.scaleY !== 1) transformParts.push(node.transform.scaleX === node.transform.scaleY ? `scale(${node.transform.scaleX})` : `scale(${node.transform.scaleX}, ${node.transform.scaleY})`)
  const graphTransform = transformParts.join(' ')
  const baseTransform = typeof base.transform === 'string' && base.transform !== 'none' ? base.transform : ''
  const hasGraphAnchor = node.transform.anchorX !== 0.5 || node.transform.anchorY !== 0.5
  const graphFilter = motionGraphEffectFilter(node)
  const baseFilter = typeof base.filter === 'string' ? base.filter : ''
  const maskImage = maskImageFor(node)
  return {
    ...base,
    visibility: node.visible ? base.visibility : 'hidden',
    opacity: baseOpacity * node.opacity,
    transform: graphTransform ? `${baseTransform}${baseTransform ? ' ' : ''}${graphTransform}` : base.transform,
    transformOrigin: hasGraphAnchor ? `${node.transform.anchorX * 100}% ${node.transform.anchorY * 100}%` : base.transformOrigin,
    filter: `${baseFilter}${baseFilter && graphFilter ? ' ' : ''}${graphFilter}` || undefined,
    mixBlendMode: node.blendMode === 'normal' ? base.mixBlendMode : node.blendMode,
    WebkitMaskImage: maskImage ?? undefined,
    maskImage: maskImage ?? undefined,
    WebkitMaskSize: maskImage ? '100% 100%' : undefined,
    maskSize: maskImage ? '100% 100%' : undefined,
    outline: selected ? '3px solid rgba(84,180,255,.92)' : base.outline,
    outlineOffset: selected ? 3 : base.outlineOffset,
  }
}

export const mergeMotionGraphNodeDecorationStyle = (base: CSSProperties, node: ResolvedMotionNodeV1 | null, selected = false): CSSProperties => {
  if (!node) return base
  const graphFilter = motionGraphEffectFilter(node)
  const baseFilter = typeof base.filter === 'string' ? base.filter : ''
  const maskImage = maskImageFor(node)
  const hasPresentation = !node.visible || graphFilter || node.blendMode !== 'normal' || maskImage || selected
  if (!hasPresentation) return base
  return {
    ...base,
    visibility: node.visible ? base.visibility : 'hidden',
    filter: `${baseFilter}${baseFilter && graphFilter ? ' ' : ''}${graphFilter}` || undefined,
    mixBlendMode: node.blendMode === 'normal' ? base.mixBlendMode : node.blendMode,
    WebkitMaskImage: maskImage ?? undefined,
    maskImage: maskImage ?? undefined,
    WebkitMaskSize: maskImage ? '100% 100%' : undefined,
    maskSize: maskImage ? '100% 100%' : undefined,
    outline: selected ? '3px solid rgba(84,180,255,.92)' : base.outline,
    outlineOffset: selected ? 3 : base.outlineOffset,
  }
}

export const useMotionGraphNodeStyle = (nodeId: string, base: CSSProperties): CSSProperties => {
  const context = useContext(MotionResolvedSceneContext)
  const node = context?.scene.nodes[nodeId] ?? null
  return mergeMotionGraphNodeStyle(base, node, context?.selectedNodeId === nodeId)
}

export function MotionSafeArea({ composition, insetRatio = 0.075, visible = true }: Readonly<{ composition: MotionCompositionV1; insetRatio?: number; visible?: boolean }>) {
  if (!visible) return null
  if (!Number.isFinite(insetRatio) || insetRatio < 0 || insetRatio >= 0.5) throw new RangeError('insetRatio must be inside [0, 0.5).')
  const insetX = composition.width * insetRatio
  const insetY = composition.height * insetRatio
  return <div aria-hidden="true" data-motion-safe-area="true" style={{ position:'absolute', left:insetX, right:insetX, top:insetY, bottom:insetY, border:'1px dashed rgba(255,255,255,.62)', boxSizing:'border-box', pointerEvents:'none', zIndex:50 }} />
}

export function MotionDebugBounds({ visible = true, label = 'component', inset = 0 }: Readonly<{ visible?: boolean; label?: string; inset?: number }>) {
  if (!visible) return null
  return <div aria-hidden="true" data-motion-debug-bounds={label} style={{ position:'absolute', inset, border:'2px solid rgba(255,79,79,.8)', boxSizing:'border-box', pointerEvents:'none', zIndex:51 }} />
}

export function MotionCenterGuides({ visible = true }: Readonly<{ visible?: boolean }>) {
  if (!visible) return null
  return <div aria-hidden="true" data-motion-center-guides="true" style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:49 }}><div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'rgba(84,180,255,.52)' }} /><div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'rgba(84,180,255,.52)' }} /></div>
}

export function MotionGridOverlay({ visible = true, size = 80 }: Readonly<{ visible?: boolean; size?: number }>) {
  if (!visible) return null
  return <div aria-hidden="true" data-motion-grid="true" style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:48, backgroundImage:'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize:`${size}px ${size}px` }} />
}

export const SafeAreaOverlay = MotionSafeArea
export const DebugBounds = MotionDebugBounds
