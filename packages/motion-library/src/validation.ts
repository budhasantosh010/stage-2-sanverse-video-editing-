import type { MotionValidationIssueV1, MotionValidationResultV1 } from '@sanverse/motion-contract'
import { motionValidationError, motionValidationOk } from '@sanverse/motion-contract'
export const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value)
export const unknownFieldIssues=(input:Record<string,unknown>,allowed:readonly string[]):readonly MotionValidationIssueV1[]=>{const set=new Set(allowed);return Object.keys(input).filter(key=>!set.has(key)).map(key=>({path:`$.${key}`,code:'FIELD_UNKNOWN' as const,message:`Unknown field: ${key}`}))}
export const validationSuccess=motionValidationOk
export const validationFailure=(...issues:readonly MotionValidationIssueV1[]):MotionValidationResultV1<never>=>motionValidationError(...issues)
export const valueIssue=(path:string,code:MotionValidationIssueV1['code'],message:string):MotionValidationIssueV1=>({path,code,message})
