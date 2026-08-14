import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MotionAspectRatio, MotionRenderContextV1 } from '@sanverse/motion-contract'
import type { MotionGraphBackedComponentModuleV1 } from '@sanverse/motion-graph'
import { COMPONENT_PARITY_SCHEMA_VERSION, createImmutableIntakeSnapshot, inspectApprovedComponentPackage, readIntegrationRecord, readParityRecord, registerProductizedComponent, validateProductizedMotionComponent, writeIntegrationRecord, writeParityRecord } from '@sanverse/motion-ingest'
import type { ComponentProductizationDescriptorV1, ComponentProductizationReportV1, ComponentRegistrationDescriptorV1, MotionComponentIntegrationRecordV1 } from '@sanverse/motion-ingest'
import { MOTION_COMPONENT_CATALOG, MOTION_REFERENCE_COMPOSITIONS } from '@sanverse/motion-library'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'

const repositoryRoot=resolve(process.cwd())
const action=process.argv[2]??''
const target=process.argv[3]??''
const fail=(message:string):never=>{console.error(message);process.exit(1)}
const safeId=(componentId:string)=>componentId.replace(/[^a-z0-9._-]+/giu,'_')
const intakeRoot=(componentId:string)=>join(repositoryRoot,'motion','component-intake',safeId(componentId))
const integrationDescriptorPath=(componentId:string)=>join(intakeRoot(componentId),'integration','productization.json')
const productizationReportPath=(componentId:string)=>join(intakeRoot(componentId),'reports','productization.json')
const knownPublicIds=new Set(MOTION_COMPONENT_CATALOG.map(definition=>definition.id))
const readJson=<T>(path:string):T=>JSON.parse(readFileSync(path,'utf8')) as T

interface StoredProductizationDescriptorV1 extends ComponentProductizationDescriptorV1, ComponentRegistrationDescriptorV1 { readonly moduleFile:string }

const contextsFor=(durationTicks:number):Readonly<Record<MotionAspectRatio,MotionRenderContextV1>>=>Object.freeze(Object.fromEntries((['16:9','9:16','1:1','4:5'] as const).map(ratio=>[ratio,Object.freeze({localTicks:Math.round(durationTicks*.5),durationTicks,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition:MOTION_REFERENCE_COMPOSITIONS[ratio],reducedMotion:false})])) as Record<MotionAspectRatio,MotionRenderContextV1>)

const inspect=()=>{
  if(!target) fail('Usage: npm run motion:inspect -- "<approved-component-directory>"')
  const report=inspectApprovedComponentPackage(target,{knownPublicComponentIds:knownPublicIds})
  console.log(JSON.stringify(report,null,2))
  if(!report.readyForIntake) process.exitCode=2
}

const ingest=()=>{
  if(!target) fail('Usage: npm run motion:ingest -- "<approved-component-directory>"')
  const report=inspectApprovedComponentPackage(target,{knownPublicComponentIds:knownPublicIds})
  if(!report.readyForIntake) fail(`INGEST_BLOCKED\n${report.issues.map(issue=>`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`).join('\n')}`)
  const result=createImmutableIntakeSnapshot(report,repositoryRoot,'ChatGPT Harness visual-agent handoff')
  console.log(JSON.stringify({componentId:report.componentId,sourceKind:report.sourceKind,lane:report.lane,foreignDecision:report.foreignDecision,integrationStrategy:report.recommendedStrategy,approvedSourceHash:result.snapshot.approvedSourceHash,intakeRoot:result.intakeRoot,publicRegistryChanged:false,blockingReasons:result.integrationRecord.blockingReasons},null,2))
}

const productize=async()=>{
  if(!target) fail('Usage: npm run motion:productize -- <component-id>')
  const descriptorPath=integrationDescriptorPath(target)
  if(!existsSync(descriptorPath)) fail(`PRODUCTIZATION_DESCRIPTOR_MISSING: ${descriptorPath}`)
  const descriptor=readJson<StoredProductizationDescriptorV1>(descriptorPath)
  if(descriptor.componentId!==target) fail('PRODUCTIZATION_DESCRIPTOR_IDENTITY_MISMATCH')
  const modulePath=resolve(repositoryRoot,descriptor.moduleFile)
  const moduleRelation=relative(repositoryRoot,modulePath)
  if(moduleRelation.startsWith('..')||isAbsolute(moduleRelation)) fail('PRODUCTIZED_MODULE_ESCAPES_REPOSITORY')
  if(!existsSync(modulePath)) fail(`PRODUCTIZED_MODULE_MISSING: ${descriptor.moduleFile}`)
  const imported=await import(pathToFileURL(modulePath).href)
  const module=imported[descriptor.moduleExportName] as MotionGraphBackedComponentModuleV1<unknown,unknown>|undefined
  if(!module) fail(`PRODUCTIZED_MODULE_EXPORT_MISSING: ${descriptor.moduleExportName}`)
  const report=validateProductizedMotionComponent(module,descriptor,contextsFor(module.definition.defaultDurationTicks))
  mkdirSync(dirname(productizationReportPath(target)),{recursive:true})
  writeFileSync(productizationReportPath(target),`${JSON.stringify(report,null,2)}\n`,'utf8')
  const previous=readIntegrationRecord(repositoryRoot,target)
  const fixedBlockers=previous.blockingReasons.filter(reason=>!['PRODUCTIZATION_REQUIRED'].includes(reason))
  const updated:MotionComponentIntegrationRecordV1=Object.freeze({...previous,productizationStatus:report.status==='ready'?'ready':'blocked',semanticMappingStatus:report.semanticMapping,c3Status:report.c3,c4Status:report.c4,c5Status:report.c5,aiEditabilityStatus:report.aiEditability,blockingReasons:Object.freeze(report.status==='ready'?fixedBlockers:[...fixedBlockers,...report.blockingReasons])})
  writeIntegrationRecord(repositoryRoot,updated)
  console.log(JSON.stringify(report,null,2))
  if(report.status!=='ready') process.exitCode=2
}

const parity=()=>{
  if(!target) fail('Usage: npm run motion:parity -- <component-id> [--owner-approve|--owner-batch-authorize]')
  let record=readIntegrationRecord(repositoryRoot,target)
  let parityRecord=readParityRecord(repositoryRoot,target)
  const ownerApprove=process.argv.includes('--owner-approve')
  const batchAuthorize=process.argv.includes('--owner-batch-authorize')
  if(ownerApprove&&batchAuthorize) fail('PARITY_PROMOTION_AMBIGUOUS: choose one owner promotion mode.')
  if(ownerApprove||batchAuthorize){
    if(!parityRecord||parityRecord.status!=='passed'||parityRecord.reviewer!=='engineering-evidence') fail('OWNER_PARITY_PROMOTION_BLOCKED: engineering parity evidence must pass first.')
    parityRecord=ownerApprove
      ? Object.freeze({...parityRecord,reviewer:'owner' as const,notes:Object.freeze([...parityRecord.notes,'Owner explicitly approved the Sanverse-integrated visual parity after reviewing the synchronized comparison.'])})
      : Object.freeze({...parityRecord,reviewer:'owner-batch-authorized-engineering-evidence' as const,notes:Object.freeze([...parityRecord.notes,'Owner explicitly approved the CH1 source component set and authorized the Sanverse coding agent on 2026-08-14 to self-verify source-preserving integrations and insert the remaining CH1 components into the Library.'])})
    writeParityRecord(repositoryRoot,parityRecord)
    record=Object.freeze({...record,visualParityStatus:'passed' as const,blockingReasons:Object.freeze(record.blockingReasons.filter(reason=>reason!=='OWNER_INTEGRATED_PARITY_APPROVAL_REQUIRED'&&reason!=='VISUAL_PARITY_REQUIRED'))})
    writeIntegrationRecord(repositoryRoot,record)
  }
  const ownerAuthorized=parityRecord?.reviewer==='owner'||parityRecord?.reviewer==='owner-batch-authorized-engineering-evidence'
  console.log(JSON.stringify({componentId:target,approvedSourceHash:record.approvedSourceHash,canonicalVideoHash:record.canonicalVideoHash,visualParityStatus:record.visualParityStatus,parity:parityRecord??{schemaVersion:COMPONENT_PARITY_SCHEMA_VERSION,status:'pending',reason:'No parity record exists yet.'},registrationAllowed:record.visualParityStatus==='passed'&&parityRecord?.status==='passed'&&ownerAuthorized},null,2))
}

const register=()=>{
  if(!target) fail('Usage: npm run motion:register -- <component-id>')
  if(knownPublicIds.has(target)) fail(`DUPLICATE_PUBLIC_COMPONENT_ID: ${target}`)
  const descriptorPath=integrationDescriptorPath(target)
  if(!existsSync(descriptorPath)) fail('REGISTRATION_DESCRIPTOR_MISSING')
  const descriptor=readJson<StoredProductizationDescriptorV1>(descriptorPath)
  const registration:ComponentRegistrationDescriptorV1={componentId:descriptor.componentId,componentVersion:descriptor.componentVersion,moduleImportPath:descriptor.moduleImportPath,moduleExportName:descriptor.moduleExportName,definitionExportName:descriptor.definitionExportName}
  const record=readIntegrationRecord(repositoryRoot,target)
  const parityRecord=readParityRecord(repositoryRoot,target)
  const productization=existsSync(productizationReportPath(target))?readJson<ComponentProductizationReportV1>(productizationReportPath(target)):null
  const ledger=registerProductizedComponent(repositoryRoot,registration,record,parityRecord,productization)
  writeIntegrationRecord(repositoryRoot,Object.freeze({...record,libraryStatus:'registered',blockingReasons:Object.freeze([])}))
  console.log(JSON.stringify({registered:target,publicIngestedComponents:ledger.components.length},null,2))
}

if(action==='inspect') inspect()
else if(action==='ingest') ingest()
else if(action==='parity') parity()
else if(action==='productize') await productize()
else if(action==='register') register()
else fail('Expected one of: inspect, ingest, parity, productize, register')
