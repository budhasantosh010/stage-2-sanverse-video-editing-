import type { MotionExposureLevel } from '@sanverse/motion-contract'
import type { MotionPropertyPathV1, MotionPropertyPrimitiveV1 } from './properties.ts'
export type MotionEditorControlV1 =
  | Readonly<{ type: 'text' | 'textarea' | 'color' | 'asset' | 'readonly' }>
  | Readonly<{ type: 'number' | 'slider' }>
  | Readonly<{ type: 'toggle' }>
  | Readonly<{ type: 'select'; options: readonly Readonly<{ label: string; value: MotionPropertyPrimitiveV1 }>[] }>
export interface MotionPropertyConstraintsV1 { readonly minimum?: number; readonly maximum?: number; readonly step?: number; readonly allowedValues?: readonly MotionPropertyPrimitiveV1[] }
export interface MotionExposureV1 {
  readonly id: string
  readonly label: string
  readonly group: 'Content' | 'Style' | 'Surface' | 'Layout' | 'Transform' | 'Motion' | 'Parts' | 'Effects' | 'Masks' | 'Blend' | 'Advanced Motion'
  readonly level: MotionExposureLevel
  readonly target: MotionPropertyPathV1
  readonly editor: MotionEditorControlV1
  readonly keyframeable: boolean
  readonly constraints?: MotionPropertyConstraintsV1
}
export const exposureLevelRank = (level: MotionExposureLevel): number => level === 'creator' ? 1 : level === 'designer' ? 2 : 3
export const exposuresForLevel = (exposures: readonly MotionExposureV1[], level: MotionExposureLevel): readonly MotionExposureV1[] => exposures.filter((exposure) => exposureLevelRank(exposure.level) <= exposureLevelRank(level))
