import { describe, expect, it } from 'vitest'

import {
  buildTimelineMonitorDiagnostics,
  diagnosticsAreAvailable,
  diagnosticsAsText,
  diagnosticsSummary,
  sourceIdentity,
  type BuildDiagnosticsInput,
} from './timeline-monitor-diagnostics.ts'

const activeInput = (overrides: Partial<BuildDiagnosticsInput> = {}): BuildDiagnosticsInput => ({
  projectId: 'project_1ad7b832a52d6faf',
  acceptedRevision: 12,
  compositionTicks: 43_200_000,
  playheadTicks: 7_200_000,
  timelineItemId: 'clip:clip_aaaaaaaa',
  primaryDecision: {
    kind: 'active',
    clipId: 'clip_aaaaaaaa',
    assetId: 'asset_aaaaaaaa',
    compositionTicks: 7_200_000,
    sourceTicks: 7_200_000,
    localTicks: 7_200_000,
  },
  v1OutputEnabled: true,
  currentVideoSrc: '/api/projects/project_1ad7b832a52d6faf/media',
  requestedVideoSrc: '/api/projects/project_1ad7b832a52d6faf/media',
  videoReadyState: 4,
  videoNetworkState: 1,
  monitorBaseLayer: 'native-video',
  sourceSwitchGeneration: 3,
  selectedItemIds: ['clip:clip_aaaaaaaa'],
  proposalBaseRevision: null,
  proposalStatus: null,
  saveState: { status: 'saved', persistedRevision: 12 },
  ...overrides,
})

describe('a snapshot of what the preview decided, and why', () => {
  it('carries every value the monitor used, so nothing has to be deduced', () => {
    // Working out the original false gap meant reading the code backwards from
    // the message to the compiler, because nothing on screen said which of these
    // was the wrong one.
    const snapshot = buildTimelineMonitorDiagnostics(activeInput())
    expect(snapshot.activeClipId).toBe('clip_aaaaaaaa')
    expect(snapshot.activeAssetId).toBe('asset_aaaaaaaa')
    expect(snapshot.sourceTicks).toBe(7_200_000)
    expect(snapshot.localTicks).toBe(7_200_000)
    expect(snapshot.v1OutputEnabled).toBe(true)
    expect(snapshot.clipEnabled).toBe(true)
    expect(snapshot.assetAvailable).toBe(true)
    expect(snapshot.gapReason).toBeNull()
    expect(snapshot.acceptedRevision).toBe(12)
    expect(snapshot.lastPersistedRevision).toBe(12)
    expect(snapshot.sourceSwitchGeneration).toBe(3)
  })

  it('says "we did not check" rather than "we checked and it was off"', () => {
    // The distinction that made the original bug hard. If the whole track is
    // off, the clip's own switch was never looked at — reporting `false` there
    // would send the next person to the wrong switch, which is exactly the
    // mistake the gap wording itself was designed to avoid.
    const snapshot = buildTimelineMonitorDiagnostics(activeInput({
      primaryDecision: { kind: 'gap', compositionTicks: 7_200_000, reason: 'V1_OUTPUT_DISABLED' },
      v1OutputEnabled: false,
    }))
    expect(snapshot.v1OutputEnabled).toBe(false)
    expect(snapshot.clipEnabled).toBeNull()
    expect(snapshot.assetAvailable).toBeNull()
    expect(snapshot.gapReason).toBe('V1_OUTPUT_DISABLED')
  })

  it('reports a switched-off clip as switched off, and says nothing about the file', () => {
    const snapshot = buildTimelineMonitorDiagnostics(activeInput({
      primaryDecision: { kind: 'gap', compositionTicks: 7_200_000, reason: 'CLIP_DISABLED' },
    }))
    expect(snapshot.clipEnabled).toBe(false)
    expect(snapshot.assetAvailable).toBeNull()
  })

  it('reports a missing file as missing', () => {
    const snapshot = buildTimelineMonitorDiagnostics(activeInput({
      primaryDecision: { kind: 'gap', compositionTicks: 7_200_000, reason: 'ASSET_MISSING' },
    }))
    expect(snapshot.assetAvailable).toBe(false)
    expect(snapshot.clipEnabled).toBeNull()
  })
})

describe('what it must never put on screen', () => {
  it('shows the last part of an address and nothing else', () => {
    // Diagnostic panels get screenshotted and pasted into chats. The only
    // question worth asking is "is the element pointed at the file we asked
    // for?", and that needs a name, not a location.
    expect(sourceIdentity('/api/projects/project_1ad7/assets/asset_bbbb')).toBe('asset_bbbb')
    expect(sourceIdentity('blob:http://localhost:2000/9f2a-11ee')).toBe('9f2a-11ee')
    expect(sourceIdentity('/api/projects/p/media?revision=12')).toBe('media')
    expect(sourceIdentity(null)).toBeNull()
    expect(sourceIdentity('')).toBeNull()
  })

  it('never prints a folder on anybody’s computer', () => {
    const snapshot = buildTimelineMonitorDiagnostics(activeInput({
      currentVideoSrc: 'file:///C:/Users/Lenovo/Music/Startups/project/source.mp4',
      requestedVideoSrc: '/home/someone/.sanverse/projects/p/source.mp4',
    }))
    const text = diagnosticsAsText(snapshot)
    expect(text).not.toContain('Users')
    expect(text).not.toContain('home')
    expect(text).not.toContain('.sanverse')
    expect(text).not.toContain('C:')
    expect(snapshot.currentVideoSrcIdentity).toBe('source.mp4')
  })

  it('refuses an identity long enough to be hiding something', () => {
    expect(sourceIdentity(`/api/${'x'.repeat(200)}`)).toBeNull()
  })

  it('is not built at all outside development', () => {
    expect(diagnosticsAreAvailable('production')).toBe(false)
    expect(diagnosticsAreAvailable(undefined)).toBe(false)
    expect(diagnosticsAreAvailable('development')).toBe(true)
    expect(diagnosticsAreAvailable('test')).toBe(true)
  })

  it('does not copy the project into itself', () => {
    // Serializing the project on every frame would make the editor slow in
    // exactly the situation somebody is trying to measure.
    const snapshot = buildTimelineMonitorDiagnostics(activeInput())
    expect(Object.keys(snapshot)).not.toContain('project')
    expect(Object.keys(snapshot)).not.toContain('composition')
    expect(diagnosticsAsText(snapshot).length).toBeLessThan(2_000)
  })
})

describe('reading it', () => {
  it('is stable enough that two snapshots can be compared line by line', () => {
    const first = diagnosticsAsText(buildTimelineMonitorDiagnostics(activeInput()))
    const second = diagnosticsAsText(buildTimelineMonitorDiagnostics(activeInput({ playheadTicks: 8_640_000 })))
    const changed = first.split('\n').filter((line, index) => line !== second.split('\n')[index])
    expect(changed.length).toBeLessThanOrEqual(2)
  })

  it('summarises the whole situation in one readable line', () => {
    expect(diagnosticsSummary(buildTimelineMonitorDiagnostics(activeInput())))
      .toBe('5.00s: clip_aaaaaaaa from asset_aaaaaaaa at 5.00s')
    expect(diagnosticsSummary(buildTimelineMonitorDiagnostics(activeInput({
      primaryDecision: { kind: 'gap', compositionTicks: 7_200_000, reason: 'NO_CLIP_AT_TICK' },
    })))).toBe('5.00s: nothing, because NO_CLIP_AT_TICK')
  })

  it('changes nothing it was given', () => {
    const input = activeInput()
    const before = JSON.stringify(input)
    const snapshot = buildTimelineMonitorDiagnostics(input)
    expect(JSON.stringify(input)).toBe(before)
    expect(Object.isFrozen(snapshot)).toBe(true)
  })
})
