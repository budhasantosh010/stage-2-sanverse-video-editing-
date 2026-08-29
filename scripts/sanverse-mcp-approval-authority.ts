import { randomBytes } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { validateOwnerApprovalV1, type OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import type { HostApprovalRequestV1 } from '@sanverse/creative-production-adapter'
import { SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const ROOT = resolve(SANVERSE_ROOT, '.sanverse-data', 'mcp', 'owner-approvals')
const REF = /^approvalref_[a-f0-9]{32}$/u

export interface HostApprovalRecordV1 {
  readonly schemaVersion: 'sanverse.host-owner-approval-record/v1'
  readonly approvalRef: string
  readonly requestRef: string
  readonly approval: OwnerApprovalV1
}

const pathFor = (approvalRef: string) => join(ROOT, `${approvalRef}.json`)

/**
 * Host-only issuance. This function is intentionally not registered as an MCP
 * tool. A UI/host action may call it after the owner actually approves the
 * exact review subject; an external model can only present the opaque ref later.
 */
export async function issueHostOwnerApprovalV1(input: Readonly<{ request: HostApprovalRequestV1; approvedAt?: string }>): Promise<Readonly<{ approvalRef: string }>> {
  await mkdir(ROOT, { recursive: true })
  const approvalRef = `approvalref_${randomBytes(16).toString('hex')}`
  const approval: OwnerApprovalV1 = Object.freeze({
    schemaVersion: 'sanverse.owner-approval/v1',
    id: `approval:${randomBytes(16).toString('hex')}`,
    scope: input.request.scope,
    subjectId: input.request.subjectId,
    subjectRevision: input.request.subjectRevision,
    status: 'owner-approved',
    approvedAt: input.approvedAt ?? new Date().toISOString(),
  })
  const valid = validateOwnerApprovalV1(approval)
  if (!valid.ok) throw new Error(valid.refusal.message)
  const record: HostApprovalRecordV1 = Object.freeze({ schemaVersion:'sanverse.host-owner-approval-record/v1', approvalRef, requestRef:input.request.requestRef, approval:valid.value })
  const finalPath = pathFor(approvalRef)
  const temp = join(ROOT, `.${approvalRef}-${randomBytes(8).toString('hex')}.tmp`)
  let handle
  try {
    handle = await open(temp, 'wx', 0o600)
    await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8')
    await handle.sync()
    await handle.close(); handle = undefined
    await rename(temp, finalPath)
  } catch (error) {
    await handle?.close().catch(()=>undefined)
    await rm(temp,{force:true}).catch(()=>undefined)
    throw error
  }
  return Object.freeze({ approvalRef })
}

export async function resolveHostOwnerApprovalRefV1(input: Readonly<{ approvalRef: string; request: HostApprovalRequestV1 }>): Promise<OwnerApprovalV1 | null> {
  if (!REF.test(input.approvalRef)) return null
  const path = pathFor(input.approvalRef)
  try {
    const before = await lstat(path)
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size <= 0 || before.size > 32 * 1024) return null
    const actual = await realpath(path)
    if (resolve(actual) !== resolve(path) || dirname(actual) !== ROOT) return null
    const parsed = JSON.parse(await readFile(path,'utf8')) as Partial<HostApprovalRecordV1>
    if (parsed.schemaVersion !== 'sanverse.host-owner-approval-record/v1' || parsed.approvalRef !== input.approvalRef || parsed.requestRef !== input.request.requestRef || !parsed.approval) return null
    const valid = validateOwnerApprovalV1(parsed.approval)
    if (!valid.ok) return null
    if (valid.value.scope !== input.request.scope || valid.value.subjectId !== input.request.subjectId || valid.value.subjectRevision !== input.request.subjectRevision) return null
    return valid.value
  } catch {
    return null
  }
}
