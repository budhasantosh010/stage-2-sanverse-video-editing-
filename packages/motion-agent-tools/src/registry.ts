import { creativeOperationOk, creativeOperationRefusal, type CreativeOperationResultV1, type CreativeValidationResultV1 } from '@sanverse/motion-contract'

export type SanverseToolLevelV1 = 'T0'|'T1'|'T2'
export interface ToolExecutionContextV1 { readonly sandboxId?: string; readonly revision?: number; readonly availableCapabilities?: readonly string[] }
export interface SanverseToolDefinitionV1<TInput = unknown,TOutput = unknown> {
  readonly id: string
  readonly version: 1
  readonly level: SanverseToolLevelV1
  readonly inputSchema: unknown
  readonly outputSchema: unknown
  readonly requiresSandbox: boolean
  readonly requiresOwnerApproval?: boolean
  readonly validateInput: (input: unknown) => CreativeValidationResultV1<TInput>
  readonly execute: (input: TInput, context: ToolExecutionContextV1) => CreativeOperationResultV1<TOutput> | Promise<CreativeOperationResultV1<TOutput>>
}
export interface SanverseToolSummaryV1 { readonly id: string; readonly version: 1; readonly level: SanverseToolLevelV1; readonly requiresSandbox: boolean; readonly requiresOwnerApproval: boolean; readonly inputSchema: unknown; readonly outputSchema: unknown }

export interface SanverseToolRegistryV1 {
  readonly register: (definition: SanverseToolDefinitionV1) => CreativeOperationResultV1<SanverseToolSummaryV1>
  readonly get: (id: string) => SanverseToolDefinitionV1 | null
  readonly list: () => readonly SanverseToolSummaryV1[]
  readonly invoke: (id: string, input: unknown, context?: ToolExecutionContextV1) => Promise<CreativeOperationResultV1<unknown>>
}

const summary = (definition: SanverseToolDefinitionV1): SanverseToolSummaryV1 => Object.freeze({ id: definition.id, version: 1, level: definition.level, requiresSandbox: definition.requiresSandbox, requiresOwnerApproval: definition.requiresOwnerApproval === true, inputSchema: definition.inputSchema, outputSchema: definition.outputSchema })
export const createSanverseToolRegistryV1 = (): SanverseToolRegistryV1 => {
  const tools = new Map<string,SanverseToolDefinitionV1>()
  return Object.freeze({
    register: (definition: SanverseToolDefinitionV1) => {
      if (!definition.id.trim() || definition.version !== 1 || !['T0','T1','T2'].includes(definition.level) || typeof definition.validateInput !== 'function' || typeof definition.execute !== 'function') return creativeOperationRefusal('INVALID_TOOL_DEFINITION','Tool definition is invalid.')
      if (tools.has(definition.id)) return creativeOperationRefusal('TOOL_ALREADY_REGISTERED',`Tool ${definition.id} is already registered.`)
      tools.set(definition.id, definition)
      return creativeOperationOk(summary(definition), tools.size)
    },
    get: (id: string) => tools.get(id) ?? null,
    list: () => Object.freeze([...tools.values()].map(summary).sort((a,b) => a.level.localeCompare(b.level) || a.id.localeCompare(b.id))),
    invoke: async (id: string, input: unknown, context: ToolExecutionContextV1 = Object.freeze({})) => {
      const definition=tools.get(id)
      if(!definition)return creativeOperationRefusal('TOOL_NOT_FOUND',`Unknown Sanverse tool: ${id}.`)
      if(definition.requiresSandbox&&!context.sandboxId)return creativeOperationRefusal('SANDBOX_CONTEXT_REQUIRED',`Tool ${id} requires an explicit sandbox context.`)
      const validated=definition.validateInput(input)
      if(!validated.ok)return creativeOperationRefusal(validated.refusal.code,validated.refusal.message,validated.refusal.details)
      try{return await definition.execute(validated.value,context)}catch(error){return creativeOperationRefusal('TOOL_EXECUTION_FAILED',error instanceof Error?error.message:`Tool ${id} failed.`)}
    },
  })
}
