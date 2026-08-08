import type { MotionFixtureV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { FAMILY_COMPONENT_MODULES, familyComponentStyleFromPack } from '../components/component-families.tsx'
import type { FamilyComponentProps, FamilyComponentStyle } from '../components/component-families.tsx'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import { INITIAL_MOTION_STYLE_PACKS } from '../style-packs.ts'

const ratios = ['16:9', '9:16', '1:1', '4:5'] as const
const durationTicks = SANVERSE_TICKS_PER_SECOND * 4
const sampleTicks = Object.freeze([0, Math.round(durationTicks * 0.18), Math.round(durationTicks * 0.56), Math.round(durationTicks * 0.91)])

export const FAMILY_COMPONENT_FIXTURES = Object.freeze(FAMILY_COMPONENT_MODULES.map((module, index): MotionFixtureV1<FamilyComponentProps, FamilyComponentStyle> => {
  const ratio = ratios[index % ratios.length]!
  const stylePack = INITIAL_MOTION_STYLE_PACKS[index % INITIAL_MOTION_STYLE_PACKS.length]!
  return Object.freeze({
    id: `fixture.${module.definition.id.replace(/^sanverse\./u, '')}`,
    name: `${module.definition.name} · ${ratio} · ${stylePack.name}`,
    componentId: module.definition.id,
    props: module.defaultProps,
    style: familyComponentStyleFromPack(stylePack),
    composition: MOTION_REFERENCE_COMPOSITIONS[ratio],
    durationTicks,
    sampleTicks,
    reducedMotion: index % 7 === 0,
    background: index % 5 === 0 ? 'busy-photo' : 'black',
  })
}))
