import type { MotionNodeId } from './properties.ts'
export const MOTION_SEMANTIC_ROLES = ['surface', 'primary-text', 'secondary-text', 'value', 'icon', 'accent', 'decoration', 'content-group'] as const
export type MotionSemanticRoleV1 = (typeof MOTION_SEMANTIC_ROLES)[number]
export interface MotionSemanticPartV1 { readonly id: string; readonly label: string; readonly role: MotionSemanticRoleV1; readonly nodeIds: readonly MotionNodeId[] }
