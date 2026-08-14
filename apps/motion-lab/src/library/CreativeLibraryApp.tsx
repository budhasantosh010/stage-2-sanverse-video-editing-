import { useEffect, useMemo, useRef, useState } from 'react'
import type { MotionAspectRatio } from '@sanverse/motion-contract'
import {
  INITIAL_MOTION_STYLE_PACKS,
  MOTION_LIBRARY_CATALOG,
  MOTION_LIBRARY_CATEGORIES,
  MOTION_LIBRARY_MILESTONES,
  MOTION_LIBRARY_QUALITY_TIERS,
  MOTION_LIBRARY_REVIEW_STATUSES,
  MOTION_LIBRARY_SCORE_DIMENSIONS,
  MOTION_LIBRARY_TAB_DEFINITIONS,
  MOTION_USE_CONTEXTS,
  MOTION_FORMAT_USES,
  filterMotionLibraryCatalog,
  getMotionLibraryCollections,
  withMotionLibraryReviews,
} from '@sanverse/motion-library'
import type {
  MotionLibraryBackgroundV1,
  MotionLibraryCatalogEntryV1,
  MotionLibraryQualityTierV1,
  MotionLibraryReviewStatusV1,
  MotionQualityReviewV1,
} from '@sanverse/motion-library'
import { LibraryPlayer, LibraryPosterStage } from './LibraryPlayer.tsx'
import { libraryComponentLabUrl, libraryCompositorUrl } from './preview-model.ts'
import { useLibraryReviewStore } from './review-store.ts'
import type { PlaybackSpeed } from '../transport.ts'

const RATIOS: readonly MotionAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']
const BACKGROUNDS: readonly MotionLibraryBackgroundV1[] = ['dark', 'light', 'neutral', 'busy']
const SPEEDS: readonly PlaybackSpeed[] = [0.5, 1, 2]
const labelize = (value: string) => value.replace(/-/gu, ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase())
const entryById = (id: string) => MOTION_LIBRARY_CATALOG.find((entry) => entry.componentId === id) ?? null
const selectValue = <T extends string>(value: string, allowed: readonly T[]): T | undefined => allowed.includes(value as T) ? value as T : undefined

const useLocationState = () => {
  const [location, setLocation] = useState(() => ({ pathname: window.location.pathname, search: window.location.search }))
  useEffect(() => {
    const onPop = () => setLocation({ pathname: window.location.pathname, search: window.location.search })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (href: string) => {
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return { ...location, navigate }
}

function LibraryNav({ navigate }: Readonly<{ navigate: (href: string) => void }>) {
  return <nav className="creative-library__nav" aria-label="Creative Engine navigation">
    <button className="is-active" onClick={() => navigate('/library')}>Library</button>
    <a href="/?component=kinetic-headline">Component Lab</a>
    <a href="/?mode=creative-direction">Creative Direction</a>
    <a href="/?component=kinetic-headline&level=compositor&panel=curves">Compositor</a>
  </nav>
}

function LibraryHeader({ count, navigate }: Readonly<{ count: number; navigate: (href: string) => void }>) {
  return <header className="creative-library__header"><div><div className="creative-library__eyebrow">SANVERSE / CREATIVE ENGINE</div><div className="creative-library__title-row"><h1>Creative Library</h1><strong>{count} COMPONENTS</strong></div></div><LibraryNav navigate={navigate} /></header>
}

function QualityBadge({ entry }: Readonly<{ entry: MotionLibraryCatalogEntryV1 }>) {
  return <span className={`creative-library__quality creative-library__quality--${entry.review.status}`}>{entry.review.status === 'unreviewed' ? 'UNREVIEWED' : `${entry.review.qualityTier} · ${entry.review.status.toUpperCase()}`}</span>
}

function ComponentCard({ entry, activePreviewId, onPreview, navigate, autoPreview }: Readonly<{ entry: MotionLibraryCatalogEntryV1; activePreviewId: string | null; onPreview: (id: string | null) => void; navigate: (href: string) => void; autoPreview: boolean }>) {
  const cardRef = useRef<HTMLElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const active = activePreviewId === entry.componentId
  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined') return
    const target = cardRef.current
    if (!target) return
    const observer = new IntersectionObserver((records) => { if (records[0] && !records[0].isIntersecting) onPreview(null) }, { threshold: 0.05 })
    observer.observe(target)
    return () => observer.disconnect()
  }, [active, onPreview])
  useEffect(() => () => { if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current) }, [])
  const onEnter = () => { if (!autoPreview) return; hoverTimerRef.current = window.setTimeout(() => onPreview(entry.componentId), 450) }
  const onLeave = () => { if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; if (autoPreview && active) onPreview(null) }
  return <article ref={cardRef} className="creative-library__card" data-library-card={entry.componentId} onMouseEnter={onEnter} onMouseLeave={onLeave}>
    <div className="creative-library__card-media">
      {active ? <LibraryPlayer entry={entry} ratio="16:9" stylePackId={entry.preview.stylePackId} background={entry.preview.backgroundPreset} reducedMotion={false} speed={1} autoplay controls={false} returnToPosterAfterEnd onComplete={() => window.setTimeout(() => onPreview(null), 700)} /> : <>
        <img loading="lazy" src={`/posters/${entry.componentId}.png?v=${entry.preview.previewHash}`} alt={`${entry.displayName} poster`} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling?.removeAttribute('hidden') }} />
        <div hidden className="creative-library__poster-fallback"><span>Preview unavailable</span></div>
        <button className="creative-library__play-card" type="button" aria-label={`Play ${entry.displayName}`} onClick={() => onPreview(entry.componentId)}>▶</button>
      </>}
    </div>
    <button className="creative-library__card-body" type="button" onClick={() => navigate(`/library/component/${encodeURIComponent(entry.componentId)}`)}>
      <div className="creative-library__card-heading"><strong>{entry.displayName}</strong><QualityBadge entry={entry} /></div>
      <span>{labelize(entry.primaryCategory)}</span>
      <div className="creative-library__tag-row">{entry.recommendedContexts.slice(0, 3).map((tag) => <small key={tag}>{labelize(tag)}</small>)}</div>
    </button>
  </article>
}

function LibraryHome({ search, navigate, reviewByComponent, reviewLoading }: Readonly<{ search: string; navigate: (href: string) => void; reviewByComponent: Readonly<Record<string, MotionQualityReviewV1>>; reviewLoading: boolean }>) {
  const params = useMemo(() => new URLSearchParams(search), [search])
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const [autoPreview, setAutoPreview] = useState(false)
  const reviewedCatalog = useMemo(() => withMotionLibraryReviews(MOTION_LIBRARY_CATALOG, reviewByComponent), [reviewByComponent])
  const collections = useMemo(() => getMotionLibraryCollections(reviewedCatalog), [reviewedCatalog])
  const options = useMemo(() => ({
    query: params.get('q') ?? undefined,
    category: selectValue(params.get('category') ?? '', MOTION_LIBRARY_CATEGORIES),
    collectionId: params.get('collection') ?? undefined,
    context: selectValue(params.get('context') ?? '', MOTION_USE_CONTEXTS),
    milestone: selectValue(params.get('milestone') ?? '', MOTION_LIBRARY_MILESTONES),
    reviewStatus: selectValue(params.get('review') ?? '', MOTION_LIBRARY_REVIEW_STATUSES),
    qualityTier: selectValue(params.get('quality') ?? '', MOTION_LIBRARY_QUALITY_TIERS),
    performanceClass: selectValue(params.get('performance') ?? '', ['light','medium','heavy'] as const),
    format: selectValue(params.get('format') ?? '', MOTION_FORMAT_USES),
    sort: selectValue(params.get('sort') ?? '', ['recommended','recent','a-z','milestone','quality'] as const) ?? 'recommended',
  }), [params])
  const entries = useMemo(() => filterMotionLibraryCatalog(reviewedCatalog, options), [reviewedCatalog, options])
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); navigate(`/library${next.size ? `?${next.toString()}` : ''}`) }
  const currentTab = MOTION_LIBRARY_TAB_DEFINITIONS.find((tab) => tab.collectionId === options.collectionId || tab.category === options.category)?.id ?? 'all'
  const selectTab = (id: string) => { const tab = MOTION_LIBRARY_TAB_DEFINITIONS.find((candidate) => candidate.id === id); const next = new URLSearchParams(params); next.delete('category'); next.delete('collection'); if (tab?.category) next.set('category', tab.category); if (tab?.collectionId) next.set('collection', tab.collectionId); navigate(`/library${next.size ? `?${next.toString()}` : ''}`) }
  const newest = reviewedCatalog.filter((entry) => entry.introducedInMilestone === 'CH1')
  return <main className="creative-library"><LibraryHeader count={reviewedCatalog.length} navigate={navigate} />
    <section className="creative-library__toolbar"><label className="creative-library__search-label">Search components<input aria-label="Search components" value={params.get('q') ?? ''} placeholder="toast, agent, percentage, glass…" onChange={(event) => update('q', event.target.value)} /></label><div className="creative-library__toolbar-links"><label className="creative-library__auto-preview"><input type="checkbox" checked={autoPreview} onChange={(event) => setAutoPreview(event.target.checked)} /> Auto-preview on hover</label><button onClick={() => navigate(`/library/showreel${search}`)}>▶ Showreel</button><button onClick={() => navigate('/library/review')}>Review Queue</button></div></section>
    <div className="creative-library__tabs" role="tablist" aria-label="Library categories">{MOTION_LIBRARY_TAB_DEFINITIONS.map((tab) => <button role="tab" aria-selected={currentTab === tab.id} className={currentTab === tab.id ? 'is-active' : ''} key={tab.id} onClick={() => selectTab(tab.id)}>{tab.label}</button>)}</div>
    <section className="creative-library__filters" aria-label="Library filters">
      <select aria-label="Collection" value={options.collectionId ?? ''} onChange={(event) => update('collection', event.target.value)}><option value="">All collections</option>{collections.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>)}</select>
      <select aria-label="Context" value={options.context ?? ''} onChange={(event) => update('context', event.target.value)}><option value="">All contexts</option>{MOTION_USE_CONTEXTS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
      <select aria-label="Milestone" value={options.milestone ?? ''} onChange={(event) => update('milestone', event.target.value)}><option value="">All milestones</option>{MOTION_LIBRARY_MILESTONES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Review status" value={options.reviewStatus ?? ''} onChange={(event) => update('review', event.target.value)}><option value="">All review states</option>{MOTION_LIBRARY_REVIEW_STATUSES.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
      <select aria-label="Quality tier" value={options.qualityTier ?? ''} onChange={(event) => update('quality', event.target.value)}><option value="">All quality tiers</option>{MOTION_LIBRARY_QUALITY_TIERS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Performance class" value={options.performanceClass ?? ''} onChange={(event) => update('performance', event.target.value)}><option value="">All performance</option>{['light','medium','heavy'].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
      <select aria-label="Format" value={options.format ?? ''} onChange={(event) => update('format', event.target.value)}><option value="">All formats</option>{MOTION_FORMAT_USES.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
      <select aria-label="Sort components" value={options.sort} onChange={(event) => update('sort', event.target.value)}><option value="recommended">Recommended</option><option value="recent">Recently Added</option><option value="a-z">A–Z</option><option value="milestone">Milestone</option><option value="quality">Quality</option></select>
    </section>
    {!options.query && !options.category && !options.collectionId && newest.length > 0 ? <section className="creative-library__recent"><div><span>RECENTLY ADDED</span><strong>CH1 · {newest.length} approved components</strong></div><button onClick={() => update('collection', 'recently-added')}>View CH1 →</button></section> : null}
    <section className="creative-library__results-heading"><div><strong>{entries.length} results</strong><span>{reviewLoading ? 'Loading review data…' : 'Static posters · live Motion on play'}</span></div>{options.collectionId ? <button onClick={() => navigate(`/library/showreel?collection=${encodeURIComponent(String(options.collectionId))}`)}>Play this collection ▶</button> : null}</section>
    {entries.length ? <section className="creative-library__grid">{entries.map((entry) => <ComponentCard key={entry.componentId} entry={entry} activePreviewId={activePreviewId} onPreview={setActivePreviewId} navigate={navigate} autoPreview={autoPreview} />)}</section> : <div className="creative-library__empty"><strong>No components match.</strong><span>Clear one or more filters or search terms.</span></div>}
  </main>
}

function PlayerOptions({ ratio, setRatio, stylePackId, setStylePackId, background, setBackground, reducedMotion, setReducedMotion, speed, setSpeed }: Readonly<{ ratio: MotionAspectRatio; setRatio: (value: MotionAspectRatio) => void; stylePackId: string; setStylePackId: (value: string) => void; background: MotionLibraryBackgroundV1; setBackground: (value: MotionLibraryBackgroundV1) => void; reducedMotion: boolean; setReducedMotion: (value: boolean) => void; speed: PlaybackSpeed; setSpeed: (value: PlaybackSpeed) => void }>) {
  return <div className="creative-library__player-options"><div><span>Ratio</span>{RATIOS.map((value) => <button key={value} className={ratio === value ? 'is-active' : ''} onClick={() => setRatio(value)}>{value}</button>)}</div><label>Style<select value={stylePackId} onChange={(event) => setStylePackId(event.target.value)}>{INITIAL_MOTION_STYLE_PACKS.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label><label>Background<select value={background} onChange={(event) => setBackground(event.target.value as MotionLibraryBackgroundV1)}>{BACKGROUNDS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></label><label>Speed<select value={speed} onChange={(event) => setSpeed(Number(event.target.value) as PlaybackSpeed)}>{SPEEDS.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label><label className="creative-library__switch"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> Reduced motion</label></div>
}

const defaultScores = () => Object.fromEntries(MOTION_LIBRARY_SCORE_DIMENSIONS.map((dimension) => [dimension, 4])) as Record<(typeof MOTION_LIBRARY_SCORE_DIMENSIONS)[number], number>

function ReviewEditor({ entry, existing, fullPlaybackVerified, onSave }: Readonly<{ entry: MotionLibraryCatalogEntryV1; existing?: MotionQualityReviewV1; fullPlaybackVerified: boolean; onSave: (review: MotionQualityReviewV1) => Promise<boolean> }>) {
  const [status, setStatus] = useState<MotionLibraryReviewStatusV1>(existing?.status ?? 'unreviewed')
  const [tier, setTier] = useState<MotionLibraryQualityTierV1>(existing?.qualityTier ?? 'Experimental')
  const [notes, setNotes] = useState(existing?.notes.join('\n') ?? '')
  const [scores, setScores] = useState<Record<(typeof MOTION_LIBRARY_SCORE_DIMENSIONS)[number], number>>(() => ({ ...defaultScores(), ...(existing?.scores ?? {}) }))
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setStatus(existing?.status ?? 'unreviewed')
    setTier(existing?.qualityTier ?? 'Experimental')
    setNotes(existing?.notes.join('\n') ?? '')
    setScores({ ...defaultScores(), ...(existing?.scores ?? {}) })
    setSaved(false)
  }, [entry.componentId, existing])
  const verified = fullPlaybackVerified || existing?.fullPlaybackVerified === true
  const save = async () => {
    const nextStatus = status === 'passed' && !verified ? 'in-review' : status
    const review = Object.freeze({ componentId: entry.componentId, fixtureId: entry.preview.fixtureId, status: nextStatus, qualityTier: tier, scores: Object.freeze({ ...scores }), notes: Object.freeze(notes.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)), reviewedAt: new Date().toISOString(), reviewer: 'Sanverse L1 visual review', fullPlaybackVerified: verified, playbackSpeed: 1 as const, canonicalDurationTicks: entry.preview.durationTicks })
    setSaved(await onSave(review))
  }
  return <section className="creative-library__review-editor"><div className="creative-library__review-title"><div><span>MOTION REVIEW</span><strong>{fullPlaybackVerified ? '✓ Full canonical 1× playback verified in this session' : existing?.fullPlaybackVerified ? '✓ Stored canonical 1× playback verification' : 'Play from 0 → end at 1× before Pass'}</strong></div></div><div className="creative-library__review-fields"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as MotionLibraryReviewStatusV1)}>{MOTION_LIBRARY_REVIEW_STATUSES.map((value) => <option key={value} value={value} disabled={value === 'passed' && !verified}>{labelize(value)}</option>)}</select></label><label>Quality tier<select value={tier} onChange={(event) => setTier(event.target.value as MotionLibraryQualityTierV1)}>{MOTION_LIBRARY_QUALITY_TIERS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><div className="creative-library__score-grid">{MOTION_LIBRARY_SCORE_DIMENSIONS.map((dimension) => <label key={dimension}>{labelize(dimension)}<select value={scores[dimension]} onChange={(event) => setScores((current) => ({ ...current, [dimension]: Number(event.target.value) }))}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div><label>Review notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What feels strong? What needs polish?" /></label><div className="creative-library__review-actions"><button type="button" onClick={() => setStatus('needs-polish')}>Needs Polish</button><button type="button" disabled={!verified} onClick={() => setStatus('passed')}>Pass</button><button type="button" onClick={() => setStatus('rejected')}>Reject</button><button type="button" className="is-primary" onClick={() => void save()}>Save Review</button>{saved ? <span>Saved</span> : null}</div></section>
}

function ComponentDetail({ id, navigate, reviewByComponent, saveReview }: Readonly<{ id: string; navigate: (href: string) => void; reviewByComponent: Readonly<Record<string, MotionQualityReviewV1>>; saveReview: (review: MotionQualityReviewV1) => Promise<boolean> }>) {
  const entry = entryById(id)
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const [ratio, setRatio] = useState<MotionAspectRatio>(() => selectValue(initialParams.get('ratio') ?? '', RATIOS) ?? '16:9')
  const [stylePackId, setStylePackId] = useState(() => INITIAL_MOTION_STYLE_PACKS.some((pack) => pack.id === initialParams.get('style')) ? initialParams.get('style')! : entry?.preview.stylePackId ?? INITIAL_MOTION_STYLE_PACKS[0]!.id)
  const [background, setBackground] = useState<MotionLibraryBackgroundV1>(() => selectValue(initialParams.get('background') ?? '', BACKGROUNDS) ?? entry?.preview.backgroundPreset ?? 'neutral')
  const [reducedMotion, setReducedMotion] = useState(initialParams.get('reduced') === '1')
  const [speed, setSpeed] = useState<PlaybackSpeed>(() => { const requested = Number(initialParams.get('speed') ?? 1); return SPEEDS.includes(requested as PlaybackSpeed) ? requested as PlaybackSpeed : 1 })
  const [fullPlaybackVerified, setFullPlaybackVerified] = useState(false)
  const [fixtureId, setFixtureId] = useState(initialParams.get('fixture') ?? entry?.preview.fixtureId ?? 'default')
  useEffect(() => {
    if (!entry) return
    const next = new URLSearchParams({ ratio, style: stylePackId, background, speed: String(speed), fixture: fixtureId })
    if (reducedMotion) next.set('reduced', '1')
    window.history.replaceState({}, '', `/library/component/${encodeURIComponent(entry.componentId)}?${next.toString()}`)
  }, [entry, ratio, stylePackId, background, reducedMotion, speed, fixtureId])
  if (!entry) return <main className="creative-library"><LibraryHeader count={MOTION_LIBRARY_CATALOG.length} navigate={navigate} /><div className="creative-library__empty"><strong>Component not found.</strong><button onClick={() => navigate('/library')}>Back to Library</button></div></main>
  const effectiveReview = reviewByComponent[entry.componentId]
  const visibleEntry = effectiveReview ? Object.freeze({ ...entry, review: Object.freeze({ status: effectiveReview.status, qualityTier: effectiveReview.qualityTier, fullPlaybackVerified: effectiveReview.fullPlaybackVerified }) }) : entry
  const labState = { ratio, stylePackId, background, reducedMotion, fixtureId }
  return <main className="creative-library creative-library--detail"><LibraryHeader count={MOTION_LIBRARY_CATALOG.length} navigate={navigate} /><section className="creative-library__detail-head"><button onClick={() => navigate('/library')}>← Library</button><div><span>{labelize(entry.primaryCategory)} · Added {entry.introducedInMilestone}</span><h2>{entry.displayName}</h2><p>{entry.shortDescription}</p></div><QualityBadge entry={visibleEntry} /></section><section className="creative-library__detail-player"><LibraryPlayer entry={entry} fixtureId={fixtureId} ratio={ratio} stylePackId={stylePackId} background={background} reducedMotion={reducedMotion} speed={speed} controls onFullPlaybackVerified={() => setFullPlaybackVerified(true)} /></section><PlayerOptions ratio={ratio} setRatio={setRatio} stylePackId={stylePackId} setStylePackId={setStylePackId} background={background} setBackground={setBackground} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} speed={speed} setSpeed={setSpeed} />{entry.componentId === 'sanverse.kinetic-headline' ? <section className="creative-library__examples"><strong>Examples</strong><button className={fixtureId === 'default' ? 'is-active' : ''} onClick={() => setFixtureId('default')}>Default</button><button className={fixtureId === 'semantic-highlight' ? 'is-active' : ''} onClick={() => setFixtureId('semantic-highlight')}>Semantic Highlight</button></section> : null}<section className="creative-library__detail-meta"><div><span>ABOUT</span><p>{entry.shortDescription}</p><dl><dt>Component ID</dt><dd>{entry.componentId}</dd><dt>Milestone</dt><dd>{entry.introducedInMilestone}</dd><dt>Performance</dt><dd>{entry.performanceClass}</dd>{entry.referenceLineage.length ? <><dt>Reference lineage</dt><dd>{entry.referenceLineage.map(labelize).join(', ')}</dd></> : null}</dl></div><div><span>DISCOVERY</span><strong>Communication intents</strong><div className="creative-library__tag-row">{entry.communicationIntents.map((value) => <small key={value}>{labelize(value)}</small>)}</div><strong>Recommended contexts</strong><div className="creative-library__tag-row">{entry.recommendedContexts.map((value) => <small key={value}>{labelize(value)}</small>)}</div></div><div><span>CONTROLS</span><p>Creator, Designer and Advanced controls are schema-driven in Component Lab. Deep editing uses the same C3 Layers, C4 Timeline and C5 Curves.</p><div className="creative-library__open-actions"><a href={libraryComponentLabUrl(entry, labState)}>Open in Component Lab ↗</a><a href={libraryCompositorUrl(entry, labState)}>Open in Compositor ↗</a></div></div></section><ReviewEditor entry={entry} existing={effectiveReview} fullPlaybackVerified={fullPlaybackVerified} onSave={saveReview} /></main>
}

function Showreel({ search, navigate, reviewByComponent, saveReview }: Readonly<{ search: string; navigate: (href: string) => void; reviewByComponent: Readonly<Record<string, MotionQualityReviewV1>>; saveReview: (review: MotionQualityReviewV1) => Promise<boolean> }>) {
  const params = useMemo(() => new URLSearchParams(search), [search])
  const reviewed = useMemo(() => withMotionLibraryReviews(MOTION_LIBRARY_CATALOG, reviewByComponent), [reviewByComponent])
  const collectionId = params.get('collection')
  const collections = getMotionLibraryCollections(reviewed)
  const collection = collectionId ? collections.find((candidate) => candidate.id === collectionId) ?? null : null
  const entries = collection
    ? collection.items.map((member) => reviewed.find((entry) => entry.componentId === member.componentId)).filter((entry): entry is MotionLibraryCatalogEntryV1 => Boolean(entry))
    : [...filterMotionLibraryCatalog(reviewed, {
        query: params.get('q') ?? undefined,
        category: selectValue(params.get('category') ?? '', MOTION_LIBRARY_CATEGORIES),
        context: selectValue(params.get('context') ?? '', MOTION_USE_CONTEXTS),
        milestone: selectValue(params.get('milestone') ?? '', MOTION_LIBRARY_MILESTONES),
        reviewStatus: selectValue(params.get('review') ?? '', MOTION_LIBRARY_REVIEW_STATUSES),
        qualityTier: selectValue(params.get('quality') ?? '', MOTION_LIBRARY_QUALITY_TIERS),
        performanceClass: selectValue(params.get('performance') ?? '', ['light','medium','heavy'] as const),
        format: selectValue(params.get('format') ?? '', MOTION_FORMAT_USES),
        sort: selectValue(params.get('sort') ?? '', ['recommended','recent','a-z','milestone','quality'] as const) ?? 'recommended',
      })]
  const [index, setIndex] = useState(0), [autoNext, setAutoNext] = useState(true), [restartToken, setRestartToken] = useState(0), [fullPlaybackVerified, setFullPlaybackVerified] = useState(false)
  const current = entries[Math.min(index, Math.max(0, entries.length - 1))]
  useEffect(() => { setFullPlaybackVerified(false) }, [current?.componentId])
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') setIndex((value) => Math.min(entries.length - 1, value + 1)); if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1)); if (event.key === ' ') { event.preventDefault(); setRestartToken((value) => value + 1) } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [entries.length])
  if (!current) return <main className="creative-library"><LibraryHeader count={reviewed.length} navigate={navigate} /><div className="creative-library__empty">This collection is empty.</div></main>
  const complete = () => { if (autoNext && index < entries.length - 1) window.setTimeout(() => setIndex((value) => Math.min(entries.length - 1, value + 1)), 700) }
  const showreelName = collection?.displayName ?? 'Current Library Filter'
  const backHref = collection ? `/library?collection=${encodeURIComponent(collection.id)}` : `/library${search}`
  return <main className="creative-library creative-library--showreel"><LibraryHeader count={reviewed.length} navigate={navigate} /><section className="creative-library__showreel-head"><button onClick={() => navigate(backHref)}>← Library</button><div><span>{showreelName.toUpperCase()}</span><strong>{index + 1} / {entries.length}</strong><h2>{current.displayName}</h2></div><label><input type="checkbox" checked={autoNext} onChange={(event) => setAutoNext(event.target.checked)} /> Auto-next</label></section><section className="creative-library__showreel-stage"><LibraryPlayer key={`${current.componentId}:${restartToken}`} entry={current} ratio="16:9" stylePackId={current.preview.stylePackId} background={current.preview.backgroundPreset} reducedMotion={false} speed={1} autoplay controls onFullPlaybackVerified={() => setFullPlaybackVerified(true)} onComplete={complete} externalRestartToken={restartToken} /></section><div className="creative-library__showreel-nav"><button disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>← Previous</button><button onClick={() => setRestartToken((value) => value + 1)}>Replay 1×</button><button disabled={index >= entries.length - 1} onClick={() => setIndex((value) => Math.min(entries.length - 1, value + 1))}>Next →</button></div><ReviewEditor entry={current} existing={reviewByComponent[current.componentId]} fullPlaybackVerified={fullPlaybackVerified} onSave={saveReview} /></main>
}

function ReviewQueue({ navigate, reviewByComponent }: Readonly<{ navigate: (href: string) => void; reviewByComponent: Readonly<Record<string, MotionQualityReviewV1>> }>) {
  const reviewed = withMotionLibraryReviews(MOTION_LIBRARY_CATALOG, reviewByComponent)
  const groups = MOTION_LIBRARY_REVIEW_STATUSES.map((status) => ({ status, entries: reviewed.filter((entry) => entry.review.status === status) }))
  return <main className="creative-library"><LibraryHeader count={reviewed.length} navigate={navigate} /><section className="creative-library__review-queue-head"><div><span>MOTION QUALITY</span><h2>Review Queue</h2><p>Pass requires one complete canonical 1× playback. Technical tests do not change this status.</p></div><button onClick={() => navigate('/library/showreel?collection=needs-motion-review')}>Play Needs Review ▶</button></section><section className="creative-library__review-summary">{groups.map(({ status, entries }) => <button key={status} onClick={() => navigate(`/library?review=${status}`)}><span>{labelize(status)}</span><strong>{entries.length}</strong></button>)}</section><section className="creative-library__review-list">{reviewed.map((entry) => <button key={entry.componentId} onClick={() => navigate(`/library/component/${encodeURIComponent(entry.componentId)}`)}><span>{entry.displayName}</span><QualityBadge entry={entry} /><small>{entry.introducedInMilestone}</small></button>)}</section></main>
}

function PosterCapture({ id }: Readonly<{ id: string }>) { const entry = entryById(id); if (!entry) return <div className="creative-library__poster-error">Unknown component</div>; return <div className="creative-library__poster-capture" data-poster-component={entry.componentId} data-poster-hash={entry.preview.previewHash}><LibraryPosterStage entry={entry} /></div> }

function AuditPlayback({ id }: Readonly<{ id: string }>) {
  const entry = entryById(id)
  if (!entry) return <div className="creative-library__poster-error">Unknown component</div>
  return <div className="creative-library__audit-capture" data-audit-component={entry.componentId}><LibraryPlayer entry={entry} ratio="16:9" stylePackId={entry.preview.stylePackId} background={entry.preview.backgroundPreset} reducedMotion={false} speed={1} autoplay controls={false} /></div>
}

export function CreativeLibraryApp() {
  const { pathname, search, navigate } = useLocationState()
  const reviews = useLibraryReviewStore()
  if (pathname.startsWith('/library/audit/')) return <AuditPlayback id={decodeURIComponent(pathname.slice('/library/audit/'.length))} />
  if (pathname.startsWith('/library/poster/')) return <PosterCapture id={decodeURIComponent(pathname.slice('/library/poster/'.length))} />
  if (pathname.startsWith('/library/component/')) return <ComponentDetail id={decodeURIComponent(pathname.slice('/library/component/'.length))} navigate={navigate} reviewByComponent={reviews.byComponent} saveReview={reviews.saveReview} />
  if (pathname === '/library/showreel') return <Showreel search={search} navigate={navigate} reviewByComponent={reviews.byComponent} saveReview={reviews.saveReview} />
  if (pathname === '/library/review') return <ReviewQueue navigate={navigate} reviewByComponent={reviews.byComponent} />
  return <LibraryHome search={search} navigate={navigate} reviewByComponent={reviews.byComponent} reviewLoading={reviews.loading} />
}
