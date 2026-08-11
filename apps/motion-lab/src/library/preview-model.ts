import type { CSSProperties } from 'react'
import type { MotionAspectRatio, MotionComponentModuleV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  MOTION_COMPONENT_MODULES,
  MOTION_REFERENCE_COMPOSITIONS,
  INITIAL_MOTION_STYLE_PACKS,
  motionStylePackById,
  FAMILY_COMPONENT_MODULES_BY_ID,
  KineticHeadlineModule,
  ChecklistCardModule,
  CostValueCardModule,
  TimerStatusPillModule,
  TeamNetworkDiagramModule,
  familyComponentStyleFromPack,
  kineticHeadlineStyleFromPack,
  checklistCardStyleFromPack,
  costValueCardStyleFromPack,
  timerStatusPillStyleFromPack,
  teamNetworkDiagramStyleFromPack,
} from '@sanverse/motion-library'
import type { KineticHeadlineProps, MotionLibraryBackgroundV1, MotionLibraryCatalogEntryV1 } from '@sanverse/motion-library'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'

export type LibraryComponentModule = MotionComponentModuleV1<unknown, unknown>

export interface LibraryPreviewModelV1 {
  readonly module: LibraryComponentModule
  readonly props: unknown
  readonly style: unknown
  readonly context: MotionRenderContextV1
}

const genericModule = (componentId: string): LibraryComponentModule => {
  const module = MOTION_COMPONENT_MODULES[componentId]
  if (!module) throw new RangeError(`Creative Library has no registered Motion module for ${componentId}.`)
  return module as unknown as LibraryComponentModule
}

const styleFor = (componentId: string, stylePackId: string): unknown => {
  const pack = motionStylePackById(stylePackId)
  if (FAMILY_COMPONENT_MODULES_BY_ID[componentId]) return familyComponentStyleFromPack(pack)
  if (componentId === KineticHeadlineModule.definition.id) return kineticHeadlineStyleFromPack(pack)
  if (componentId === ChecklistCardModule.definition.id) return checklistCardStyleFromPack(pack)
  if (componentId === CostValueCardModule.definition.id) return costValueCardStyleFromPack(pack)
  if (componentId === TimerStatusPillModule.definition.id) return timerStatusPillStyleFromPack(pack)
  if (componentId === TeamNetworkDiagramModule.definition.id) return teamNetworkDiagramStyleFromPack(pack)
  return genericModule(componentId).defaultStyle
}

const propsFor = (componentId: string, fixtureId: string): unknown => {
  const module = genericModule(componentId)
  if (fixtureId === 'default') return module.defaultProps
  if (fixtureId === 'semantic-highlight' && componentId === KineticHeadlineModule.definition.id) {
    const props: KineticHeadlineProps = Object.freeze({
      ...KineticHeadlineModule.defaultProps,
      text: 'One mention changed the workflow',
      emphasisIndices: Object.freeze([2, 3, 4]),
      emphasisTreatment: 'highlight-box',
    })
    return props
  }
  throw new RangeError(`Unknown Creative Library fixture ${fixtureId} for ${componentId}.`)
}

export const createLibraryPreviewModel = (input: Readonly<{
  entry: MotionLibraryCatalogEntryV1
  ratio: MotionAspectRatio
  stylePackId: string
  reducedMotion: boolean
  localTicks: number
  fixtureId?: string
}>): LibraryPreviewModelV1 => {
  const module = genericModule(input.entry.componentId)
  if (!module.definition.supportedAspectRatios.includes(input.ratio)) throw new RangeError(`${input.entry.componentId} does not support ratio ${input.ratio}.`)
  if (!INITIAL_MOTION_STYLE_PACKS.some((pack) => pack.id === input.stylePackId)) throw new RangeError(`Unknown Motion style pack ${input.stylePackId}.`)
  const props = propsFor(input.entry.componentId, input.fixtureId ?? input.entry.preview.fixtureId)
  const style = styleFor(input.entry.componentId, input.stylePackId)
  const propsValidation = module.validateProps(props)
  const styleValidation = module.validateStyle(style)
  if (!propsValidation.ok) throw new RangeError(propsValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  if (!styleValidation.ok) throw new RangeError(styleValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  const durationTicks = input.entry.preview.durationTicks
  const context: MotionRenderContextV1 = Object.freeze({
    localTicks: Math.max(0, Math.min(durationTicks, Math.round(input.localTicks))),
    durationTicks,
    ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
    composition: MOTION_REFERENCE_COMPOSITIONS[input.ratio],
    reducedMotion: input.reducedMotion,
  })
  return Object.freeze({ module, props: propsValidation.value, style: styleValidation.value, context })
}

export const libraryPreviewBackgroundStyle = (background: MotionLibraryBackgroundV1): CSSProperties => {
  if (background === 'light') return { background: '#f4f4f1' }
  if (background === 'neutral') return { background: '#767676' }
  if (background === 'busy') return {
    backgroundColor: '#252525',
    backgroundImage: 'radial-gradient(circle at 18% 22%, rgba(255,95,82,.72) 0 8%, transparent 9%), radial-gradient(circle at 76% 28%, rgba(85,185,255,.72) 0 12%, transparent 13%), linear-gradient(135deg, #161616 0 22%, #343434 22% 42%, #181818 42% 64%, #4b4b4b 64% 78%, #202020 78%)',
  }
  return { background: '#050505' }
}

export const motionLabStyleSlug = (stylePackId: string): string => stylePackId.replace(/^sanverse\.style\./u, '')

export const libraryComponentLabUrl = (entry: MotionLibraryCatalogEntryV1, state: Readonly<{ ratio: MotionAspectRatio; stylePackId: string; background: MotionLibraryBackgroundV1; reducedMotion: boolean; fixtureId?: string }>): string => {
  const params = new URLSearchParams({
    component: entry.componentId.replace(/^sanverse\./u, ''),
    ratio: state.ratio,
    style: motionLabStyleSlug(state.stylePackId),
    background: state.background === 'dark' ? 'black' : state.background === 'light' ? 'white' : state.background,
  })
  if (state.reducedMotion) params.set('reduced', '1')
  if ((state.fixtureId ?? entry.preview.fixtureId) === 'semantic-highlight') {
    params.set('text', 'One mention changed the workflow')
    params.set('emphasis', '2,3,4')
    params.set('treatment', 'highlight-box')
  }
  return `/?${params.toString()}`
}

export const libraryCompositorUrl = (entry: MotionLibraryCatalogEntryV1, state: Readonly<{ ratio: MotionAspectRatio; stylePackId: string; background: MotionLibraryBackgroundV1; reducedMotion: boolean; fixtureId?: string }>): string => {
  const url = new URL(libraryComponentLabUrl(entry, state), 'http://sanverse.local')
  url.searchParams.set('level', 'compositor')
  url.searchParams.set('panel', 'curves')
  return `${url.pathname}${url.search}`
}
