import type { MotionFixtureV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import type { TimerStatusPillProps, TimerStatusPillStyle } from '../components/timer-status-pill.tsx'
import { timerStatusPillStyleFromPack } from '../components/timer-status-pill.tsx'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const clean = timerStatusPillStyleFromPack(SANVERSE_CLEAN_STYLE)
const energetic = timerStatusPillStyleFromPack(CREATOR_ENERGETIC_STYLE)
const duration = SANVERSE_TICKS_PER_SECOND * 5
const samples = Object.freeze([0, Math.round(duration * 0.12), Math.round(duration * 0.42), Math.round(duration * 0.72), Math.round(duration * 0.9)])

const base: TimerStatusPillProps = Object.freeze({
  label: 'RECORDING WINDOW',
  status: 'LIVE',
  caption: 'Time left for this section',
  mode: 'countdown',
  totalSeconds: 90,
  alwaysShowHours: false,
})

const fixture = (
  id: string,
  name: string,
  props: TimerStatusPillProps,
  style: TimerStatusPillStyle,
  ratio: keyof typeof MOTION_REFERENCE_COMPOSITIONS = '16:9',
  reducedMotion = false,
  durationTicks = duration,
): MotionFixtureV1<TimerStatusPillProps, TimerStatusPillStyle> => Object.freeze({
  id,
  name,
  componentId: 'sanverse.timer-status-pill',
  props: Object.freeze(props),
  style: Object.freeze(style),
  composition: MOTION_REFERENCE_COMPOSITIONS[ratio],
  durationTicks,
  sampleTicks: durationTicks === duration ? samples : Object.freeze([0, Math.round(durationTicks * 0.5), durationTicks]),
  reducedMotion,
  background: 'black',
})

export const TIMER_STATUS_PILL_FIXTURES = Object.freeze([
  fixture('timer-countdown', 'Countdown 90 sec', base, clean),
  fixture('timer-countup', 'Count up', { ...base, label: 'SESSION ELAPSED', caption: 'Elapsed time in this segment', mode: 'countup' }, clean),
  fixture('timer-hours', 'Hours display', { ...base, label: 'LONG SESSION', totalSeconds: 12_345, alwaysShowHours: true }, clean),
  fixture('timer-max-time', 'Maximum time', { ...base, label: 'MAXIMUM TIMER', totalSeconds: 359_999, alwaysShowHours: true }, clean),
  fixture('timer-unicode', 'Unicode', { ...base, label: '録画時間', status: 'مباشر', caption: '残り時間 ⏱️' }, clean),
  fixture('timer-landscape', 'Landscape', base, clean, '16:9'),
  fixture('timer-portrait', 'Portrait', base, clean, '9:16'),
  fixture('timer-square', 'Square', base, clean, '1:1'),
  fixture('timer-four-five', '4:5', base, clean, '4:5'),
  fixture('timer-clean', 'Sanverse Clean', base, clean),
  fixture('timer-energetic', 'Creator Energetic', base, energetic),
  fixture('timer-reduced', 'Reduced motion', base, clean, '16:9', true),
  fixture('timer-min-duration', 'Minimum duration', base, energetic, '16:9', false, SANVERSE_TICKS_PER_SECOND),
  fixture('timer-max-duration', 'Maximum duration', base, clean, '9:16', false, SANVERSE_TICKS_PER_SECOND * 30),
])
