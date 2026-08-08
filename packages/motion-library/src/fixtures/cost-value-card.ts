import type { MotionFixtureV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import type { CostValueCardProps, CostValueCardStyle } from '../components/cost-value-card.tsx'
import { costValueCardStyleFromPack } from '../components/cost-value-card.tsx'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const clean = costValueCardStyleFromPack(SANVERSE_CLEAN_STYLE)
const energetic = costValueCardStyleFromPack(CREATOR_ENERGETIC_STYLE)
const duration = SANVERSE_TICKS_PER_SECOND * 5
const samples = Object.freeze([0, Math.round(duration * 0.18), Math.round(duration * 0.36), Math.round(duration * 0.60), Math.round(duration * 0.9)])
const metric = (label: string, value: number, prefix = '$', suffix = '', note = '') => Object.freeze({ label, value, prefix, suffix, note })

const base: CostValueCardProps = Object.freeze({
  eyebrow: 'COST VS VALUE',
  title: 'What one month buys you',
  cost: metric('Manual editing cost', 2_400, '$', '', 'Time + repetitive work'),
  value: metric('Workflow value created', 24_000, '$', '', 'More output from the same month'),
  footer: '10× more value from the workflow',
})

const fixture = (
  id: string,
  name: string,
  props: CostValueCardProps,
  style: CostValueCardStyle,
  ratio: keyof typeof MOTION_REFERENCE_COMPOSITIONS = '16:9',
  reducedMotion = false,
  durationTicks = duration,
): MotionFixtureV1<CostValueCardProps, CostValueCardStyle> => Object.freeze({
  id,
  name,
  componentId: 'sanverse.cost-value-card',
  props: Object.freeze(props),
  style: Object.freeze(style),
  composition: MOTION_REFERENCE_COMPOSITIONS[ratio],
  durationTicks,
  sampleTicks: durationTicks === duration ? samples : Object.freeze([0, Math.round(durationTicks * 0.5), durationTicks]),
  reducedMotion,
  background: 'black',
})

export const COST_VALUE_CARD_FIXTURES = Object.freeze([
  fixture('cost-value-default', 'Default', base, clean),
  fixture('cost-value-small', 'Small values', { ...base, cost: metric('Minutes spent', 18, '', ' min'), value: metric('Minutes saved', 55, '', ' min') }, clean),
  fixture('cost-value-large', 'Large values', { ...base, cost: metric('Annual cost', 1_250_000), value: metric('Annual value', 24_000_000) }, clean),
  fixture('cost-value-long-labels', 'Long labels', { ...base, cost: metric('Monthly manual production operating cost', 2_400), value: metric('Estimated monthly business value created', 24_000) }, clean),
  fixture('cost-value-unicode', 'Unicode', { eyebrow: '価値 / قيمة', title: 'Cost versus value', cost: metric('現在のコスト', 2_400, '¥'), value: metric('القيمة الجديدة', 24_000, '¥'), footer: '10× ↑' }, clean),
  fixture('cost-value-landscape', 'Landscape', base, clean, '16:9'),
  fixture('cost-value-portrait', 'Portrait', base, clean, '9:16'),
  fixture('cost-value-square', 'Square', base, clean, '1:1'),
  fixture('cost-value-four-five', '4:5', base, clean, '4:5'),
  fixture('cost-value-clean', 'Sanverse Clean', base, clean),
  fixture('cost-value-energetic', 'Creator Energetic', base, energetic),
  fixture('cost-value-reduced', 'Reduced motion', base, clean, '16:9', true),
  fixture('cost-value-min-duration', 'Minimum duration', base, energetic, '16:9', false, Math.round(SANVERSE_TICKS_PER_SECOND * 1.5)),
  fixture('cost-value-max-duration', 'Maximum duration', base, clean, '9:16', false, SANVERSE_TICKS_PER_SECOND * 12),
])
