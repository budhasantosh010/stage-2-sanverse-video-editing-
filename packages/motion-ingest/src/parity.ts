import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ComponentParityRecordV1 } from './contracts.ts'

const safeId=(componentId:string)=>componentId.replace(/[^a-z0-9._-]+/giu,'_')
export const parityRecordPath=(repositoryRoot:string,componentId:string)=>join(resolve(repositoryRoot),'motion','component-intake',safeId(componentId),'reports','parity.json')
export const readParityRecord=(repositoryRoot:string,componentId:string):ComponentParityRecordV1|null=>{
  const path=parityRecordPath(repositoryRoot,componentId)
  return existsSync(path)?JSON.parse(readFileSync(path,'utf8')) as ComponentParityRecordV1:null
}
export const writeParityRecord=(repositoryRoot:string,record:ComponentParityRecordV1):void=>writeFileSync(parityRecordPath(repositoryRoot,record.componentId),`${JSON.stringify(record,null,2)}\n`,'utf8')
