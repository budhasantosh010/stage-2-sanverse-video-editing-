import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { compileCreativeDirection } from './compiler.ts'
import type { CreativeIntentResolverV1 } from './compiler.ts'
import type { CreativeCommentV1 } from './comments.ts'
import type { CreativeDirectiveV1, CreativeGraphicDirectiveV1, CreativeStyleDirectiveV1 } from './directives.ts'
import { CREATIVE_DIRECTION_SCHEMA_VERSION } from './document.ts'
import type { CreativeDirectionDocumentV1 } from './document.ts'
import type { CreativePlanningInputV1, CreativePlanningModelV1 } from './model-adapter.ts'
import type { CreativeEditProposalV1, CreativeResolutionCatalogV1 } from './proposal.ts'
import { createDefaultCreativeDirectionTracks } from './tracks.ts'
import { createCreativeDirectionVersion } from './versions.ts'
import { validateCreativeDirectionDocument } from './validation-directives.ts'

const t = (seconds: number): number => seconds * PROJECT_TIMESCALE
const base = (id: string, start: number, end: number) => ({ id, startTicks: t(start), endTicks: t(end), source: 'human' as const, priority: 'preferred' as const, status: 'accepted' as const })

const directives: readonly CreativeDirectiveV1[] = Object.freeze([
  Object.freeze({ ...base('style:warm-product', 0, 95), kind: 'style', track: 'STYLE', priority: 'required', styleIntent: 'warm-premium-product', motionCharacter: 'restrained', density: 'medium' }),
  Object.freeze({ ...base('motion:precise', 0, 95), kind: 'motion', track: 'MOTION', character: 'restrained', entranceCharacter: 'fade-rise', exitCharacter: 'soft-crossfade', intensity: 0.45 }),
  Object.freeze({ ...base('graphic:notification-hook', 0, 5), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'conversation-notification-stack', preferredFamily: 'notification-story', content: Object.freeze({ primaryText: 'A teammate mentioned the new workspace', secondaryText: 'A small notification starts the product story.' }), placementIntent: 'top-right', motionIntent: 'restrained' }),
  Object.freeze({ ...base('graphic:semantic-highlight', 5, 9), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'semantic-highlight-statement', preferredFamily: 'kinetic-headline', content: Object.freeze({ primaryText: 'One mention changed the workflow', fields: Object.freeze({ emphasis: 'changed the workflow' }) }), placementIntent: 'center', motionIntent: 'premium' }),
  Object.freeze({ ...base('graphic:speaker-lower-third', 12, 18), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'speaker-identification', preferredFamily: 'lower-third', content: Object.freeze({ primaryText: 'Maya Chen', secondaryText: 'Product lead' }), placementIntent: 'bottom-left', motionIntent: 'subtle' }),
  Object.freeze({ ...base('constraint:protect-presenter', 12, 31), kind: 'constraint', track: 'CONSTRAINTS', priority: 'required', constraint: 'do-not-cover-face' }),
  Object.freeze({ ...base('constraint:preserve-subtitles', 12, 31), kind: 'constraint', track: 'CONSTRAINTS', priority: 'required', constraint: 'preserve-subtitles' }),
  Object.freeze({ ...base('graphic:floating-prompt', 21, 27), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'floating-prompt-composer', preferredFamily: 'product-ui', content: Object.freeze({ primaryText: 'Summarize the launch feedback and assign next steps' }), placementIntent: 'center-right', motionIntent: 'premium' }),
  Object.freeze({ ...base('footage:screen-focus', 33, 58), kind: 'footage', track: 'FOOTAGE', treatment: 'screen-focus', placementIntent: 'center', intensity: 0.7 }),
  Object.freeze({ ...base('graphic:workflow-demo', 33, 58), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'product-ui-story', preferredFamily: 'product-ui', content: Object.freeze({ primaryText: 'Launch workspace', secondaryText: 'Collect → organize → act', items: Object.freeze(['Collect feedback', 'Group themes', 'Create actions']) }), placementIntent: 'center', motionIntent: 'technical' }),
  Object.freeze({ ...base('graphic:agent-progress', 62, 68), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'agent-work-log', preferredFamily: 'product-ui', content: Object.freeze({ primaryText: 'Assistant is preparing the launch brief', items: Object.freeze(['Reading feedback', 'Grouping requests', 'Drafting next steps']) }), placementIntent: 'center-right', motionIntent: 'technical' }),
  Object.freeze({ ...base('graphic:scoped-access', 72, 80), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'scoped-access-comparison', preferredFamily: 'comparison', content: Object.freeze({ primaryText: 'Same assistant, different context', items: Object.freeze(['Legal · policies only', 'Engineering · technical docs only']) }), placementIntent: 'center', motionIntent: 'restrained' }),
  Object.freeze({ ...base('graphic:callback', 85, 91), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'conversation-notification-stack', preferredFamily: 'notification-story', content: Object.freeze({ primaryText: 'Launch brief ready', secondaryText: 'The opening notification returns as a callback.' }), placementIntent: 'top-right', motionIntent: 'subtle' }),
  Object.freeze({ ...base('graphic:brand-lockup', 91, 95), kind: 'graphic', track: 'GRAPHICS', communicationIntent: 'keyword-brand-lockup', preferredFamily: 'outro', content: Object.freeze({ primaryText: 'SANVERSE', secondaryText: 'From signal to finished story' }), placementIntent: 'center', motionIntent: 'premium' }),
  Object.freeze({ ...base('note:simplify-middle', 45, 52), kind: 'note', track: 'NOTES', text: 'Keep the middle of the workflow demo calm; let the product UI carry the explanation.' }),
])

const tracks = createDefaultCreativeDirectionTracks()
const version = createCreativeDirectionVersion({
  id: 'version:product-launch-v1',
  label: 'V1 · Product story direction',
  sequence: 1,
  parentVersionId: null,
  reason: 'initial',
  summary: 'Original generic product-launch storytelling direction used for offline ABC development.',
  tracks,
  directives,
})

const comments: readonly CreativeCommentV1[] = Object.freeze([
  Object.freeze({ id: 'comment:motion', source: 'human', text: 'Keep the graphic but simplify the motion.', sequence: 1, target: Object.freeze({ kind: 'directive', directiveId: 'graphic:workflow-demo' }), resolved: false }),
  Object.freeze({ id: 'comment:premium', source: 'human', text: 'Make the final section feel more premium.', sequence: 2, target: Object.freeze({ kind: 'region', startTicks: t(85), endTicks: t(95) }), resolved: false }),
])

export const PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE: CreativeDirectionDocumentV1 = Object.freeze({
  schemaVersion: CREATIVE_DIRECTION_SCHEMA_VERSION,
  durationTicks: t(95),
  tracks,
  directives,
  comments,
  versions: Object.freeze([version]),
})

const fixtureValidation = validateCreativeDirectionDocument(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
if (!fixtureValidation.ok) throw new Error(`Invalid product-launch Creative Direction fixture: ${fixtureValidation.issues.map((entry) => entry.message).join('; ')}`)

export const PRODUCT_LAUNCH_PLANNED_COMPONENT_IDS = Object.freeze([
  'sanverse.conversation-toast-stack',
  'sanverse.kinetic-headline',
  'sanverse.lower-third-title',
  'sanverse.floating-prompt-composer',
  'sanverse.product-ui-story-scene',
  'sanverse.agent-work-log',
  'sanverse.scoped-access-comparison',
  'sanverse.keyword-brand-lockup',
] as const)

const componentForIntent: Readonly<Record<string, string>> = Object.freeze({
  'conversation-notification-stack': 'sanverse.conversation-toast-stack',
  'semantic-highlight-statement': 'sanverse.kinetic-headline',
  'speaker-identification': 'sanverse.lower-third-title',
  'floating-prompt-composer': 'sanverse.floating-prompt-composer',
  'product-ui-story': 'sanverse.product-ui-story-scene',
  'agent-work-log': 'sanverse.agent-work-log',
  'scoped-access-comparison': 'sanverse.scoped-access-comparison',
  'keyword-brand-lockup': 'sanverse.keyword-brand-lockup',
})

const fixtureResolver: CreativeIntentResolverV1 = Object.freeze({
  resolveGraphic(directive: CreativeGraphicDirectiveV1, catalog: CreativeResolutionCatalogV1) {
    const preferred = componentForIntent[directive.communicationIntent] ?? 'sanverse.kinetic-headline'
    const availableFallback = catalog.componentIds.find((id) => id === preferred) ?? null
    return Object.freeze({ candidateComponentIds: Object.freeze([preferred]), selectedComponentId: availableFallback })
  },
  resolveStyle(directive: CreativeStyleDirectiveV1, catalog: CreativeResolutionCatalogV1) {
    const desired = directive.styleIntent === 'warm-premium-product' ? 'sanverse.style.clean' : 'sanverse.style.tech-ui'
    return Object.freeze({ candidateStylePackIds: Object.freeze([desired]), selectedStylePackId: catalog.stylePackIds.includes(desired) ? desired : null })
  },
})

export class FixtureCreativePlanner implements CreativePlanningModelV1 {
  readonly id = 'sanverse.fixture-creative-planner/v1'
  async propose(input: CreativePlanningInputV1): Promise<CreativeEditProposalV1> {
    return compileCreativeDirection({
      document: input.document,
      proposalId: 'proposal:fixture-product-launch-v1',
      resolver: fixtureResolver,
      catalog: input.catalog,
      confidence: 1,
      rationale: 'Deterministic offline fixture mapping for Creative Direction contract and integration tests.',
      status: 'proposed',
    })
  }
}

export const PRODUCT_LAUNCH_FIXTURE_CATALOG: CreativeResolutionCatalogV1 = Object.freeze({
  componentIds: Object.freeze([...PRODUCT_LAUNCH_PLANNED_COMPONENT_IDS]),
  stylePackIds: Object.freeze(['sanverse.style.clean', 'sanverse.style.tech-ui']),
})
