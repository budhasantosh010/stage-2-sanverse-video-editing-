import type { MotionComponentDefinitionV1 } from '@sanverse/motion-contract'
import { CHECKLIST_CARD_DEFINITION, ChecklistCardModule } from './components/checklist-card.tsx'
import { COST_VALUE_CARD_DEFINITION, CostValueCardModule } from './components/cost-value-card.tsx'
import { KINETIC_HEADLINE_DEFINITION, KineticHeadlineModule } from './components/kinetic-headline.tsx'
import { TIMER_STATUS_PILL_DEFINITION, TimerStatusPillModule } from './components/timer-status-pill.tsx'
import { TEAM_NETWORK_DIAGRAM_DEFINITION, TeamNetworkDiagramModule } from './components/team-network-diagram.tsx'
import { FAMILY_COMPONENT_DEFINITIONS, FAMILY_COMPONENT_MODULES_BY_ID } from './components/component-families.tsx'

export const MOTION_COMPONENT_CATALOG = Object.freeze([
  KINETIC_HEADLINE_DEFINITION,
  CHECKLIST_CARD_DEFINITION,
  COST_VALUE_CARD_DEFINITION,
  TIMER_STATUS_PILL_DEFINITION,
  TEAM_NETWORK_DIAGRAM_DEFINITION,
  ...FAMILY_COMPONENT_DEFINITIONS,
] satisfies readonly MotionComponentDefinitionV1[])

export const MOTION_COMPONENT_MODULES = Object.freeze({
  [KineticHeadlineModule.definition.id]: KineticHeadlineModule,
  [ChecklistCardModule.definition.id]: ChecklistCardModule,
  [CostValueCardModule.definition.id]: CostValueCardModule,
  [TimerStatusPillModule.definition.id]: TimerStatusPillModule,
  [TeamNetworkDiagramModule.definition.id]: TeamNetworkDiagramModule,
  ...FAMILY_COMPONENT_MODULES_BY_ID,
})
