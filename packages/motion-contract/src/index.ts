import type { ComponentType } from 'react'

export * from './creative-engine.ts'

export const MOTION_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'] as const
export type MotionAspectRatio = (typeof MOTION_ASPECT_RATIOS)[number]

export const MOTION_PERFORMANCE_CLASSES = ['light', 'medium', 'heavy'] as const
export type MotionPerformanceClass = (typeof MOTION_PERFORMANCE_CLASSES)[number]

export const MOTION_EXPOSURE_LEVELS = ['creator', 'designer', 'advanced'] as const
export type MotionExposureLevel = (typeof MOTION_EXPOSURE_LEVELS)[number]

export interface MotionComponentCapabilitiesV1 {
  readonly semanticParts: boolean
  readonly orderedEffects: boolean
  readonly masks: boolean
  readonly blendModes: boolean
  readonly responsiveLayout: boolean
  readonly formatOverrides: boolean
  readonly keyframeReady: boolean
  readonly bindingReady: boolean
}

export const MOTION_COMPONENT_CATEGORIES = [
  'headline','typography','lower-third','callout','card','counter','timer','comparison','diagram','ui','cta','transition','accent',
] as const
export type MotionComponentCategory = (typeof MOTION_COMPONENT_CATEGORIES)[number]

export interface MotionCompositionV1 {
  readonly width: number
  readonly height: number
  readonly fpsNumerator: number
  readonly fpsDenominator: number
}

export interface MotionRenderContextV1 {
  readonly localTicks: number
  readonly durationTicks: number
  readonly ticksPerSecond: number
  readonly composition: MotionCompositionV1
  readonly reducedMotion: boolean
}

export interface MotionEventDefinitionV1 {
  readonly name: string
  readonly normalizedTime: number
}

export interface MotionContentLimitV1 {
  readonly field: string
  readonly description: string
  readonly minimum?: number
  readonly recommendedMaximum?: number
  readonly maximum?: number
  readonly unit: 'characters' | 'items' | 'nodes' | 'connections' | 'lines' | 'values' | 'seconds'
}

export interface MotionComponentDefinitionV1 {
  readonly id: `sanverse.${string}`
  readonly version: number
  readonly name: string
  readonly purpose: string
  readonly category: MotionComponentCategory
  readonly performanceClass: MotionPerformanceClass
  readonly supportedAspectRatios: readonly MotionAspectRatio[]
  readonly minDurationTicks: number
  readonly defaultDurationTicks: number
  readonly maxDurationTicks: number
  readonly events: readonly MotionEventDefinitionV1[]
  readonly contentLimits: readonly MotionContentLimitV1[]
  readonly capabilities?: MotionComponentCapabilitiesV1
}

export interface MotionValidationIssueV1 {
  readonly path: string
  readonly code:
    | 'TYPE_INVALID'
    | 'FIELD_REQUIRED'
    | 'FIELD_UNKNOWN'
    | 'VALUE_INVALID'
    | 'VALUE_OUT_OF_RANGE'
    | 'CONTENT_TOO_SMALL'
    | 'CONTENT_TOO_LARGE'
    | 'CONTENT_IMPOSSIBLE'
  readonly message: string
}

export type MotionValidationResultV1<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly MotionValidationIssueV1[] }>

export interface MotionComponentRenderPropsV1<Props, Style> {
  readonly props: Props
  readonly style: Style
  readonly context: MotionRenderContextV1
}

export interface MotionComponentModuleV1<Props, Style> {
  readonly definition: MotionComponentDefinitionV1
  readonly defaultProps: Props
  readonly defaultStyle: Style
  readonly validateProps: (input: unknown) => MotionValidationResultV1<Props>
  readonly validateStyle: (input: unknown) => MotionValidationResultV1<Style>
  readonly Component: ComponentType<MotionComponentRenderPropsV1<Props, Style>>
}

export type MotionFixtureBackgroundV1 = 'black' | 'white' | 'neutral-gray' | 'dark-photo' | 'bright-photo' | 'busy-photo' | 'low-detail-photo'

export interface MotionFixtureV1<Props, Style> {
  readonly id: string
  readonly name: string
  readonly componentId: `sanverse.${string}`
  readonly props: Props
  readonly style: Style
  readonly composition: MotionCompositionV1
  readonly durationTicks: number
  readonly sampleTicks: readonly number[]
  readonly reducedMotion: boolean
  readonly background: MotionFixtureBackgroundV1
}

export interface MotionStyleTokensV1 {
  readonly typography: {
    readonly displayFont: string
    readonly bodyFont: string
    readonly numericFont: string
    readonly headingWeight: number
    readonly bodyWeight: number
  }
  readonly colors: {
    readonly background: string
    readonly surface: string
    readonly text: string
    readonly textSecondary: string
    readonly accent: string
    readonly success: string
    readonly warning: string
    readonly danger: string
  }
  readonly shape: {
    readonly radiusSmall: number
    readonly radiusMedium: number
    readonly radiusLarge: number
    readonly borderWidth: number
  }
  readonly depth: {
    readonly shadowStrength: number
    readonly glowStrength: number
  }
  readonly motion: {
    readonly intensity: number
    readonly distanceScale: number
    readonly springiness: number
    readonly staggerScale: number
  }
}

export interface MotionStylePackV1 {
  readonly id: `sanverse.style.${string}`
  readonly name: string
  readonly description: string
  readonly tokens: MotionStyleTokensV1
}

export const motionValidationOk = <T>(value: T): MotionValidationResultV1<T> => ({ ok: true, value })
export const motionValidationError = <T = never>(...issues: readonly MotionValidationIssueV1[]): MotionValidationResultV1<T> => ({ ok: false, issues })
