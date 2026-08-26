import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MotionPlanV1 } from '@sanverse/creative-direction'
import { applyMotionPlanV1 } from '@sanverse/motion-agent-tools'
import { CostValueCardModule, DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, MOTION_REFERENCE_COMPOSITIONS } from '@sanverse/motion-library'
import { MotionComponentHost, MotionCompositionFrame } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { advancePlaybackTicks } from './transport.ts'

const composition = MOTION_REFERENCE_COMPOSITIONS['16:9']
const durationTicks = 5 * SANVERSE_TICKS_PER_SECOND
const criticalTicks = Object.freeze([0, 720_000, 1_800_000, 3_600_000, durationTicks])
const reviewPlan: MotionPlanV1 = Object.freeze({
  id: 'motion-plan:closed-loop-review',
  storyboardId: 'storyboard:closed-loop-review',
  storyboardApprovedRevision: 2,
  animaticId: 'animatic:closed-loop-review',
  animaticApprovedRevision: 2,
  beats: Object.freeze([
    Object.freeze({
      id: 'beat:value-payoff',
      purpose: 'payoff' as const,
      startTick: 720_000,
      endTick: 3_600_000,
      nodeIds: Object.freeze(['cost-card.value']),
      operationIntents: Object.freeze([
        Object.freeze({ id: 'intent:value-scale', type: 'motion.scale' as const, nodeIds: Object.freeze(['cost-card.value']), startTick: 720_000, endTick: 2_160_000, parameters: Object.freeze({ from: 0.78, to: 1 }) }),
        Object.freeze({ id: 'intent:value-move', type: 'motion.move' as const, nodeIds: Object.freeze(['cost-card.value']), startTick: 720_000, endTick: 2_160_000, parameters: Object.freeze({ fromX: 84, toX: 0, fromY: 20, toY: 0 }) }),
      ]),
    }),
  ]),
  revision: 1,
})

const pageStyle: CSSProperties = { minHeight: '100vh', margin: 0, boxSizing: 'border-box', padding: 24, background: '#090909', color: '#f5f5f5', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }
const panelStyle: CSSProperties = { border: '1px solid #303030', borderRadius: 14, background: '#111', padding: 16 }
const badgeStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #343434', borderRadius: 999, padding: '5px 9px', fontSize: 12, color: '#d7d7d7', background: '#171717' }

export function ClosedLoopReviewLab() {
  const [tick, setTick] = useState(0)
  const [fullPlayback, setFullPlayback] = useState(false)
  const playback = useRef({ anchorTime: 0, anchorTicks: 0 })
  const context = useMemo(() => Object.freeze({ localTicks: tick, durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition, reducedMotion: false }), [tick])
  const graphOperations = useMemo(() => {
    const baseContext = Object.freeze({ ...context, localTicks: 0 })
    const baseScene = CostValueCardModule.createScene(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, baseContext)
    const compiled = applyMotionPlanV1(baseScene, reviewPlan)
    if (!compiled.ok) throw new RangeError(`${compiled.refusal.code}: ${compiled.refusal.message}`)
    return compiled.value.operations
  }, [])

  useEffect(() => {
    playback.current = { anchorTime: performance.now(), anchorTicks: 0 }
    let frame = 0
    const animate = (now: number) => {
      const next = advancePlaybackTicks({ anchorTicks: playback.current.anchorTicks, elapsedMilliseconds: Math.max(0, now - playback.current.anchorTime), speed: 1, durationTicks, loop: false })
      setTick(next.ticks)
      if (next.ended) { setFullPlayback(true); return }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const seconds = tick / SANVERSE_TICKS_PER_SECOND
  return <main style={pageStyle} data-closed-loop-review="true" data-closed-loop-current-tick={tick} data-closed-loop-duration-ticks={durationTicks} data-closed-loop-full-playback={fullPlayback ? 'true' : 'false'}>
    <header style={{ maxWidth: 1180, margin: '0 auto 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9a9a9a' }}>Sanverse Creative Engine</div><h1 style={{ margin: '7px 0 4px', fontSize: 28 }}>Closed-Loop V1 · Canonical 1× Review</h1><p style={{ margin: 0, color: '#aaa', fontSize: 14 }}>One Motion Graph. Stable semantic IDs. Exact ticks. Owner approval stays outside the renderer.</p></div>
        <div style={{ ...badgeStyle, borderColor: fullPlayback ? '#5a5a5a' : '#343434' }}>{fullPlayback ? '✓ Full 1× playback verified' : `▶ Playing ${seconds.toFixed(2)} / 5.00s`}</div>
      </div>
    </header>
    <section style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 270px', gap: 16 }}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><strong>Motion Review</strong><span style={{ color: '#999', fontSize: 12 }}>semantic node: cost-card.value</span></div>
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #2b2b2b', width: 960, maxWidth: '100%', aspectRatio: '16 / 9', margin: '0 auto', background: '#050505' }}>
          <MotionCompositionFrame composition={composition} displayScale={0.5} background="#050505">
            <div data-source-composite="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 28% 42%, #303030 0, #161616 32%, #080808 75%)' }} />
            <MotionComponentHost module={CostValueCardModule} props={DEFAULT_COST_VALUE_CARD_PROPS} style={DEFAULT_COST_VALUE_CARD_STYLE} context={context} graphOperations={graphOperations} selectedGraphNodeId="cost-card.value" />
          </MotionCompositionFrame>
        </div>
        <div style={{ height: 4, marginTop: 12, borderRadius: 999, background: '#242424', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, Math.max(0, tick / durationTicks * 100))}%`, height: '100%', background: '#ededed' }} /></div>
      </div>
      <aside style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <div style={panelStyle}><strong style={{ display: 'block', marginBottom: 10 }}>Review chain</strong>{['Storyboard r2 · approved','Animatic r2 · approved','MotionPlan r1 · compiled','Motion Draft r1 · QA passed'].map(item => <div key={item} style={{ ...badgeStyle, display: 'flex', marginBottom: 7 }}>{item}</div>)}</div>
        <div style={panelStyle}><strong style={{ display: 'block', marginBottom: 10 }}>Evidence windows</strong>{criticalTicks.map((value, index) => <div key={value} data-closed-loop-critical-tick={value} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: tick >= value ? '#eee' : '#777', padding: '4px 0' }}><span>{['entrance','KVS A','payoff','KVS B','exit'][index]}</span><span>{(value / SANVERSE_TICKS_PER_SECOND).toFixed(2)}s</span></div>)}</div>
        <div style={panelStyle}><strong style={{ display: 'block', marginBottom: 8 }}>Canonical authorities</strong><div style={{ fontSize: 12, lineHeight: 1.65, color: '#aaa' }}>C3 Layers · C4 Dope Sheet · C5 Curves · C6 Node Graph · C8 Masks/Mattes<br/>No second renderer. No second graph. No MCP-owned state.</div></div>
      </aside>
    </section>
  </main>
}
