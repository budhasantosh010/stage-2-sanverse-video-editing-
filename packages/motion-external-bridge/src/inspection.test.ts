import { describe, expect, it } from 'vitest'
import { inspectExternalMotionAssetV1, materializeExternalMotionAssetV1 } from './inspection.ts'
import type { ExternalMotionProvenanceV1 } from './provenance.ts'

const rights = (sourceKind: ExternalMotionProvenanceV1['sourceKind']): ExternalMotionProvenanceV1 => ({ schemaVersion: 'sanverse.external-motion-provenance/v1', sourceKind, sourceName: 'fixture', rightsClass: 'owner-authored', attributionRequired: false, reusableLibraryAllowed: true, projectUseAllowed: true, aiModificationAllowed: true, restrictions: [] })

describe('external inspection/materialization V1', () => {
  it('inspects and materializes a safe SVG subset into the canonical Motion graph with stable IDs', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect id="card" x="10" y="20" width="80" height="60" rx="8" fill="#111111"/><path id="tick" d="M 25 52 L 44 70 L 76 34" fill="none" stroke="#ffffff" stroke-width="4"/></svg>'
    const inspection = inspectExternalMotionAssetV1({ assetId: 'asset:svg:1', sourceKind: 'svg', bytes: svg, provenance: rights('svg') })
    expect(inspection.ok).toBe(true)
    if (!inspection.ok) return
    expect(inspection.value.editability).toBe('high')
    expect(inspection.value.materialization).toBe('canonical-scene')
    const materialized = materializeExternalMotionAssetV1(inspection.value, svg)
    expect(materialized.ok, !materialized.ok ? JSON.stringify(materialized.refusal) : '').toBe(true)
    if (!materialized.ok || materialized.value.kind !== 'canonical-scene') return
    expect(materialized.value.scene.nodes['asset:svg:1::card']).toBeDefined()
    expect(materialized.value.scene.nodes['asset:svg:1::tick']).toBeDefined()
    expect(materialized.value.scene.rootNodeId).toBe('asset:svg:1::root')
  })

  it('refuses SVG scripts/external references instead of rendering a plausible approximation', () => {
    for (const svg of ['<svg><script>alert(1)</script></svg>', '<svg><image href="https://example.com/a.png"/></svg>', '<svg><foreignObject/></svg>']) {
      const result = inspectExternalMotionAssetV1({ assetId: 'asset:svg:bad', sourceKind: 'svg', bytes: svg, provenance: rights('svg') })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.refusal.code).toBe('EXTERNAL_ASSET_UNSUPPORTED_FEATURE')
    }
  })

  it('materializes the deterministic static Lottie shape subset and refuses animated/unsupported layers', () => {
    const lottie = JSON.stringify({v:'5.12.0',fr:30,ip:0,op:60,w:100,h:100,layers:[{ty:4,nm:'Card',ind:1,shapes:[{ty:'fl',c:{a:0,k:[0.1,0.1,0.1,1]}},{ty:'rc',nm:'card',p:{a:0,k:[50,50]},s:{a:0,k:[80,60]},r:{a:0,k:8}}]}]})
    const inspection=inspectExternalMotionAssetV1({assetId:'asset:lottie:1',sourceKind:'lottie',bytes:lottie,provenance:rights('lottie')})
    expect(inspection).toMatchObject({ok:true,value:{materialization:'canonical-scene',directSeekSafe:true,metadata:{durationTicks:2_880_000}}})
    if(inspection.ok){const materialized=materializeExternalMotionAssetV1(inspection.value,lottie);expect(materialized).toMatchObject({ok:true,value:{kind:'canonical-scene'}});if(materialized.ok&&materialized.value.kind==='canonical-scene')expect(materialized.value.scene.nodes['asset:lottie:1::card']).toBeDefined()}
    const animated=JSON.stringify({v:'5.12.0',fr:30,ip:0,op:60,w:100,h:100,layers:[{ty:4,shapes:[{ty:'rc',p:{a:1,k:[]},s:{a:0,k:[80,60]},r:{a:0,k:0}}]}]})
    expect(inspectExternalMotionAssetV1({assetId:'asset:lottie:animated',sourceKind:'lottie',bytes:animated,provenance:rights('lottie')})).toMatchObject({ok:false,refusal:{code:'EXTERNAL_ASSET_UNSUPPORTED_FEATURE'}})
    const imageLayer=JSON.stringify({v:'5.12.0',fr:30,ip:0,op:60,w:100,h:100,layers:[{ty:2,nm:'Image'}]})
    expect(inspectExternalMotionAssetV1({assetId:'asset:lottie:image',sourceKind:'lottie',bytes:imageLayer,provenance:rights('lottie')})).toMatchObject({ok:false,refusal:{code:'EXTERNAL_ASSET_UNSUPPORTED_FEATURE'}})
  })

  it('keeps alpha-video as an exact-time external runtime asset instead of inventing a fake graph node', () => {
    const result = inspectExternalMotionAssetV1({ assetId: 'asset:alpha:1', sourceKind: 'alpha-video', bytes: new Uint8Array([0,1,2]), provenance: rights('alpha-video'), metadata: { width: 1920, height: 1080, durationTicks: 7_200_000, hasAlpha: true, codec: 'prores-4444' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.materialization).toBe('external-runtime-asset')
    const materialized = materializeExternalMotionAssetV1(result.value, new Uint8Array([0,1,2]))
    expect(materialized).toMatchObject({ ok: true, value: { kind: 'external-runtime-asset', asset: { hasAlpha: true, durationTicks: 7_200_000 } } })
  })

  it('fails closed when rights are not usable or source kinds are outside the supported V1 adapters', () => {
    const blocked = { ...rights('svg'), rightsClass: 'unknown' as const, reusableLibraryAllowed: false, projectUseAllowed: false }
    expect(inspectExternalMotionAssetV1({ assetId: 'asset:blocked', sourceKind: 'svg', bytes: '<svg/>', provenance: blocked })).toMatchObject({ ok: false, refusal: { code: 'EXTERNAL_RIGHTS_BLOCKED' } })
    expect(inspectExternalMotionAssetV1({ assetId: 'asset:rive', sourceKind: 'rive', bytes: new Uint8Array([1]), provenance: rights('rive') })).toMatchObject({ ok: false, refusal: { code: 'EXTERNAL_ADAPTER_NOT_AVAILABLE' } })
  })
})
