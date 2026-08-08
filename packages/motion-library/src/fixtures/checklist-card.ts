import type { MotionFixtureV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import type { ChecklistCardProps, ChecklistCardStyle } from '../components/checklist-card.tsx'
import { checklistCardStyleFromPack } from '../components/checklist-card.tsx'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const DEFAULT_DURATION = SANVERSE_TICKS_PER_SECOND * 5
const SAMPLE_TICKS = Object.freeze([
  0,
  Math.round(DEFAULT_DURATION * 0.12),
  Math.round(DEFAULT_DURATION * 0.34),
  Math.round(DEFAULT_DURATION * 0.62),
  Math.round(DEFAULT_DURATION * 0.90),
])

const clean = checklistCardStyleFromPack(SANVERSE_CLEAN_STYLE)
const energetic = checklistCardStyleFromPack(CREATOR_ENERGETIC_STYLE)
const item = (id: string, label: string, state: 'complete' | 'pending') => Object.freeze({ id, label, state })

const fixture = (
  id: string,
  name: string,
  props: ChecklistCardProps,
  style: ChecklistCardStyle,
  ratio: keyof typeof MOTION_REFERENCE_COMPOSITIONS = '16:9',
  reducedMotion = false,
  durationTicks = DEFAULT_DURATION,
): MotionFixtureV1<ChecklistCardProps, ChecklistCardStyle> => Object.freeze({
  id,
  name,
  componentId: 'sanverse.checklist-card',
  props: Object.freeze({ ...props, items: Object.freeze([...props.items]) }),
  style: Object.freeze(style),
  composition: MOTION_REFERENCE_COMPOSITIONS[ratio],
  durationTicks,
  sampleTicks: durationTicks === DEFAULT_DURATION
    ? SAMPLE_TICKS
    : Object.freeze([0, Math.round(durationTicks * 0.4), durationTicks]),
  reducedMotion,
  background: 'black',
})

const base: ChecklistCardProps = Object.freeze({
  eyebrow: 'LAUNCH CHECKLIST',
  title: 'Ready before you publish',
  items: Object.freeze([
    item('hook', 'Hook is clear in the first five seconds', 'complete'),
    item('visuals', 'Visual changes support the point', 'complete'),
    item('cta', 'Call to action matches the viewer intent', 'pending'),
  ]),
  footer: '2 of 3 ready',
})

const sixItems: ChecklistCardProps = Object.freeze({
  eyebrow: 'FINAL PASS',
  title: 'Six checks before export',
  items: Object.freeze([
    item('hook', 'Hook earns attention immediately', 'complete'),
    item('audio', 'Voice is clear and balanced', 'complete'),
    item('captions', 'Captions are readable and timed', 'complete'),
    item('visuals', 'Visuals support each main idea', 'complete'),
    item('pace', 'Pacing keeps the explanation moving', 'pending'),
    item('cta', 'Final call to action is specific', 'pending'),
  ]),
  footer: '4 of 6 ready',
})

export const CHECKLIST_CARD_FIXTURES = Object.freeze([
  fixture('checklist-one-item', 'One item', { eyebrow: 'ONE THING', title: 'Before you post', items: [item('hook', 'Make the hook clear', 'complete')], footer: 'Ready' }, clean),
  fixture('checklist-three-items', 'Three items', base, clean),
  fixture('checklist-six-items', 'Six items', sixItems, clean),
  fixture('checklist-long-label', 'Long label', { ...base, items: [item('clarity', 'Make every visual change support the exact sentence the viewer is hearing right now', 'pending')] }, clean),
  fixture('checklist-unicode', 'Unicode', { eyebrow: 'チェック', title: 'جاهز للنشر؟', items: [item('jp', '映像はポイントを支える', 'complete'), item('ar', 'الصوت واضح ومفهوم', 'pending'), item('emoji', 'Final review 🚀', 'complete')], footer: '2 / 3 ✓' }, clean),
  fixture('checklist-landscape', 'Landscape', base, clean, '16:9'),
  fixture('checklist-portrait', 'Portrait', base, clean, '9:16'),
  fixture('checklist-square', 'Square', base, clean, '1:1'),
  fixture('checklist-four-five', '4:5', base, clean, '4:5'),
  fixture('checklist-clean-style', 'Sanverse Clean', base, clean),
  fixture('checklist-energetic-style', 'Creator Energetic', base, energetic),
  fixture('checklist-reduced-motion', 'Reduced motion', base, clean, '16:9', true),
  fixture('checklist-min-duration', 'Minimum duration', base, energetic, '16:9', false, Math.round(SANVERSE_TICKS_PER_SECOND * 1.5)),
  fixture('checklist-max-duration', 'Maximum duration', sixItems, clean, '9:16', false, SANVERSE_TICKS_PER_SECOND * 12),
])
