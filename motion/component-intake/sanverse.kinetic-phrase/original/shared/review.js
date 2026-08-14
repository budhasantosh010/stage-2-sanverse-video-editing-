(() => {
  'use strict';

  const { TICKS_PER_SECOND, CATALOG, renderAt, clamp } = window.CH1_COMPONENTS;
  const $ = (id) => document.getElementById(id);

  const els = Object.freeze({
    componentCount: $('componentCount'),
    componentList: $('componentList'),
    componentIndexLabel: $('componentIndexLabel'),
    componentName: $('componentName'),
    componentPurpose: $('componentPurpose'),
    referenceRange: $('referenceRange'),
    referenceVideo: $('referenceVideo'),
    referenceFrame: $('referenceFrame'),
    componentViewport: $('componentViewport'),
    previewBackdrop: $('previewBackdrop'),
    componentRoot: $('componentRoot'),
    ratioReadout: $('ratioReadout'),
    playButton: $('playButton'),
    restartButton: $('restartButton'),
    scrubber: $('scrubber'),
    progressReadout: $('progressReadout'),
    tickReadout: $('tickReadout'),
    entranceReadout: $('entranceReadout'),
    holdReadout: $('holdReadout'),
    exitReadout: $('exitReadout'),
    reuseReadout: $('reuseReadout'),
    contentControls: $('contentControls'),
    resetButton: $('resetButton'),
    ratioSelect: $('ratioSelect'),
    canvasWidth: $('canvasWidth'),
    canvasHeight: $('canvasHeight'),
    backgroundMode: $('backgroundMode'),
    componentBackgroundColor: $('componentBackgroundColor'),
    componentBackgroundOpacity: $('componentBackgroundOpacity'),
    positionPreset: $('positionPreset'),
    offsetX: $('offsetX'),
    offsetY: $('offsetY'),
    scale: $('scale'),
    rotation: $('rotation'),
    opacity: $('opacity'),
    fontFamily: $('fontFamily'),
    typeScale: $('typeScale'),
    fontWeight: $('fontWeight'),
    textColor: $('textColor'),
    accentColor: $('accentColor'),
    surfaceColor: $('surfaceColor'),
    highlightColor: $('highlightColor'),
    borderColor: $('borderColor'),
    borderWidth: $('borderWidth'),
    surfaceOpacity: $('surfaceOpacity'),
    radius: $('radius'),
    padding: $('padding'),
    spacing: $('spacing'),
    shadowStrength: $('shadowStrength'),
    blur: $('blur'),
    entranceStyle: $('entranceStyle'),
    exitStyle: $('exitStyle'),
    motionIntensity: $('motionIntensity'),
    stagger: $('stagger'),
    duration: $('duration'),
    reducedMotion: $('reducedMotion'),
    compareGrid: $('compareGrid'),
  });

  const ratioPresets = Object.freeze({
    '9:16': Object.freeze([1080, 1920]),
    '16:9': Object.freeze([1920, 1080]),
    '1:1': Object.freeze([1080, 1080]),
    '4:5': Object.freeze([1080, 1350]),
  });

  const DEFAULT_STYLE = Object.freeze({
    backgroundColor: '#111111',
    backgroundOpacity: 0,
    positionPreset: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    fontFamily: 'Arial, Helvetica, sans-serif',
    typeScale: 1,
    fontWeight: 900,
    textColor: '#111111',
    accentColor: '#275EFE',
    surfaceColor: '#FFFFFF',
    highlightColor: '#F7F7C6',
    borderColor: '#D8DCE5',
    borderWidth: 0,
    surfaceOpacity: 0.94,
    radius: 24,
    padding: 20,
    spacing: 12,
    shadowStrength: 0.72,
    blur: 14,
    entranceStyle: 'rise-soft',
    exitStyle: 'fade-drop',
    motionIntensity: 0.72,
    stagger: 0.55,
    reducedMotion: false,
  });

  // Default art-direction placements are part of the visual prototype only.
  // They remain editable and are not owner-approved until the owner says APPROVED.
  const COMPONENT_STYLE_DEFAULTS = Object.freeze({
    'icon-rail': Object.freeze({ positionPreset: 'top-safe', scale: 0.92 }),
    'progressive-choice-stack': Object.freeze({ stagger: 0.90 }),
    'explainer-board': Object.freeze({ scale: 0.92 }),
    'feature-matrix': Object.freeze({ scale: 0.90 }),
    'media-cutaway': Object.freeze({ scale: 0.94 }),
  });

  const defaultStyleFor = (id) => ({ ...DEFAULT_STYLE, ...(COMPONENT_STYLE_DEFAULTS[id] ?? {}) });

  const state = {
    componentIndex: 0,
    content: { ...CATALOG[0].defaults },
    style: defaultStyleFor(CATALOG[0].id),
    ratio: '9:16',
    width: 1080,
    height: 1920,
    previewBackground: 'transparent',
    durationSeconds: Math.max(1, CATALOG[0].reference.end - CATALOG[0].reference.start),
    exactTick: 0,
    playing: false,
    rafId: 0,
    fallbackStartMs: 0,
    fallbackStartProgress: 0,
  };

  const component = () => CATALOG[state.componentIndex];
  const durationTicks = () => Math.max(1, Math.round(state.durationSeconds * TICKS_PER_SECOND));
  const progress = () => clamp(state.exactTick / durationTicks());
  const referenceStage = () => els.referenceVideo.closest('.reference-stage');

  function formatTime(seconds) {
    return `${Number(seconds).toFixed(2)}s`;
  }

  function setViewport() {
    const ratio = state.width / state.height;
    els.componentViewport.dataset.ratio = state.ratio;
    els.componentViewport.dataset.shape = ratio < 0.8 ? 'portrait' : ratio > 1.25 ? 'landscape' : 'balanced';
    if (state.ratio === 'custom') {
      els.componentViewport.style.aspectRatio = `${state.width} / ${state.height}`;
      els.componentViewport.style.width = ratio > 1.2 ? 'min(100%, 620px)' : ratio < 0.78 ? 'min(100%, 360px)' : 'min(100%, 480px)';
    } else {
      els.componentViewport.style.aspectRatio = '';
      els.componentViewport.style.width = '';
    }
    els.ratioReadout.textContent = `${state.width}×${state.height}`;

    const mode = state.previewBackground;
    els.componentViewport.classList.toggle('checkerboard', mode === 'transparent');
    els.componentViewport.style.backgroundImage = mode === 'transparent' ? '' : 'none';
    els.componentViewport.style.backgroundColor = mode === 'white' ? '#ffffff' : mode === 'black' ? '#090a0d' : mode === 'soft' ? '#d4d2cb' : '';
    els.previewBackdrop.className = `preview-backdrop${mode === 'soft' ? ' soft' : ''}`;
  }

  function render() {
    setViewport();
    els.componentRoot.innerHTML = renderAt(component(), state.content, state.style, state.exactTick, durationTicks());
    els.scrubber.value = Math.round(progress() * 1000);
    els.progressReadout.textContent = progress().toFixed(3);
    els.tickReadout.textContent = `${Math.round(state.exactTick).toLocaleString()} ticks`;
  }

  function renderCatalog() {
    els.componentCount.textContent = `${CATALOG.length} unique`;
    els.componentList.innerHTML = CATALOG.map((item, index) => `
      <button type="button" class="component-button ${index === state.componentIndex ? 'is-active' : ''}" data-component-index="${index}">
        <span class="component-number">${String(item.order).padStart(2, '0')}</span>
        <span class="component-copy"><strong>${item.name}</strong><span>${item.purpose}</span></span>
      </button>`).join('');
  }

  function makeContentControl(field) {
    const value = state.content[field.key] ?? '';
    const label = document.createElement('label');
    label.textContent = field.label;
    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.value = value;
    } else if (field.type === 'select') {
      input = document.createElement('select');
      for (const option of field.options) {
        const node = document.createElement('option');
        node.value = option;
        node.textContent = option.replace(/(^|-)\w/g, (match) => match.toUpperCase());
        input.appendChild(node);
      }
      input.value = value;
    } else {
      input = document.createElement('input');
      input.type = field.type === 'number' ? 'number' : 'text';
      input.value = value;
      if (field.type === 'number') input.step = '1';
    }
    input.dataset.contentKey = field.key;
    label.appendChild(input);
    return label;
  }

  function renderContentControls() {
    els.contentControls.replaceChildren(...component().fields.map(makeContentControl));
  }

  function renderComponentMeta() {
    const def = component();
    els.componentIndexLabel.textContent = `COMPONENT ${String(def.order).padStart(2, '0')} · ${def.id}`;
    els.componentName.textContent = def.name;
    els.componentPurpose.textContent = def.purpose;
    els.referenceRange.textContent = `${formatTime(def.reference.start)} → ${formatTime(def.reference.end)}`;
    els.entranceReadout.textContent = def.motionNotes.entrance;
    els.holdReadout.textContent = def.motionNotes.hold;
    els.exitReadout.textContent = def.motionNotes.exit;
    els.reuseReadout.textContent = def.reuse;
  }

  const styleControlKeys = Object.freeze([
    'positionPreset', 'offsetX', 'offsetY', 'scale', 'rotation', 'opacity',
    'fontFamily', 'typeScale', 'fontWeight', 'textColor', 'accentColor', 'surfaceColor', 'highlightColor',
    'borderColor', 'borderWidth', 'surfaceOpacity', 'radius', 'padding', 'spacing', 'shadowStrength', 'blur',
    'entranceStyle', 'exitStyle', 'motionIntensity', 'stagger',
  ]);

  function syncControlsFromState() {
    for (const key of styleControlKeys) {
      if (els[key]) els[key].value = state.style[key];
    }
    els.componentBackgroundColor.value = state.style.backgroundColor;
    els.componentBackgroundOpacity.value = state.style.backgroundOpacity;
    els.reducedMotion.checked = state.style.reducedMotion;
    els.duration.value = state.durationSeconds;
    els.ratioSelect.value = state.ratio;
    els.canvasWidth.value = state.width;
    els.canvasHeight.value = state.height;
    els.backgroundMode.value = state.previewBackground;
  }

  function referenceFrameForProgress(p) {
    const def = component();
    const local = clamp(p);
    const seconds = def.reference.start + (def.reference.end - def.reference.start) * local;
    const frame = Math.max(0, Math.min(2833, Math.round(seconds * 30)));
    return { seconds, frame, path: `reference_analysis/frames_all/frame_${String(frame).padStart(4, '0')}.jpg` };
  }

  function seekReferenceToProgress(p, allowPlay = false) {
    const target = referenceFrameForProgress(p);
    els.referenceFrame.src = target.path;
    try { els.referenceVideo.currentTime = target.seconds; } catch (_) { /* local metadata may not be ready yet */ }
    if (!allowPlay) {
      els.referenceVideo.pause();
      referenceStage()?.classList.remove('is-playing');
    }
  }

  function setProgress(p, syncReference = true) {
    state.exactTick = Math.round(clamp(p) * durationTicks());
    if (syncReference) seekReferenceToProgress(p, false);
    render();
  }

  function stopPlayback() {
    state.playing = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    els.referenceVideo.pause();
    referenceStage()?.classList.remove('is-playing');
    els.playButton.textContent = '▶ Play 1×';
  }

  function playbackFrame(now) {
    if (!state.playing) return;
    const def = component();
    const refDuration = Math.max(0.001, def.reference.end - def.reference.start);
    let p;
    if (!els.referenceVideo.paused && Number.isFinite(els.referenceVideo.currentTime)) {
      p = (els.referenceVideo.currentTime - def.reference.start) / refDuration;
    } else {
      const elapsed = Math.max(0, now - state.fallbackStartMs) / 1000;
      p = state.fallbackStartProgress + elapsed / refDuration;
    }

    if (p >= 1 || els.referenceVideo.currentTime >= def.reference.end - 0.008) {
      state.exactTick = durationTicks();
      render();
      stopPlayback();
      seekReferenceToProgress(1, false);
      return;
    }

    state.exactTick = Math.round(clamp(p) * durationTicks());
    render();
    state.rafId = requestAnimationFrame(playbackFrame);
  }

  async function startPlayback() {
    if (state.playing) {
      stopPlayback();
      seekReferenceToProgress(progress(), false);
      return;
    }
    if (progress() >= 0.998) setProgress(0);

    const p = progress();
    seekReferenceToProgress(p, true);
    state.playing = true;
    referenceStage()?.classList.add('is-playing');
    els.playButton.textContent = 'Ⅱ Pause';
    state.fallbackStartMs = performance.now();
    state.fallbackStartProgress = p;

    try {
      await els.referenceVideo.play();
    } catch (_) {
      // Component preview still advances deterministically from exact requested ticks.
    }
    state.rafId = requestAnimationFrame(playbackFrame);
  }

  function resetComponentVisuals() {
    stopPlayback();
    state.content = { ...component().defaults };
    state.style = defaultStyleFor(component().id);
    state.durationSeconds = Math.max(1, component().reference.end - component().reference.start);
    state.exactTick = 0;
    state.previewBackground = 'transparent';
    renderContentControls();
    syncControlsFromState();
    seekReferenceToProgress(0, false);
    render();
  }

  function selectComponent(index, requestedProgress = 0) {
    stopPlayback();
    state.componentIndex = Math.min(CATALOG.length - 1, Math.max(0, Number(index) || 0));
    state.content = { ...component().defaults };
    state.style = defaultStyleFor(component().id);
    state.durationSeconds = Math.max(1, component().reference.end - component().reference.start);
    state.exactTick = Math.round(clamp(requestedProgress) * durationTicks());
    renderCatalog();
    renderComponentMeta();
    renderContentControls();
    syncControlsFromState();
    seekReferenceToProgress(progress(), false);
    render();
  }

  els.componentList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-component-index]');
    if (button) selectComponent(Number(button.dataset.componentIndex), 0);
  });

  els.contentControls.addEventListener('input', (event) => {
    const input = event.target.closest('[data-content-key]');
    if (!input) return;
    state.content[input.dataset.contentKey] = input.value;
    render();
  });

  for (const key of styleControlKeys) {
    els[key]?.addEventListener('input', () => {
      const control = els[key];
      state.style[key] = control.type === 'range' || control.type === 'number' ? Number(control.value) : control.value;
      render();
    });
  }

  els.componentBackgroundColor.addEventListener('input', () => {
    state.style.backgroundColor = els.componentBackgroundColor.value;
    render();
  });
  els.componentBackgroundOpacity.addEventListener('input', () => {
    state.style.backgroundOpacity = Number(els.componentBackgroundOpacity.value);
    render();
  });
  els.reducedMotion.addEventListener('change', () => {
    state.style.reducedMotion = els.reducedMotion.checked;
    render();
  });
  els.duration.addEventListener('input', () => {
    const oldProgress = progress();
    state.durationSeconds = Math.max(1, Number(els.duration.value) || 1);
    state.exactTick = Math.round(oldProgress * durationTicks());
    render();
  });

  els.ratioSelect.addEventListener('change', () => {
    state.ratio = els.ratioSelect.value;
    if (ratioPresets[state.ratio]) {
      [state.width, state.height] = ratioPresets[state.ratio];
      els.canvasWidth.value = state.width;
      els.canvasHeight.value = state.height;
    }
    render();
  });

  function updateCustomSize() {
    state.width = Math.max(160, Math.min(7680, Number(els.canvasWidth.value) || state.width));
    state.height = Math.max(160, Math.min(7680, Number(els.canvasHeight.value) || state.height));
    const exactPreset = Object.entries(ratioPresets).find(([, dimensions]) => dimensions[0] === state.width && dimensions[1] === state.height)?.[0];
    state.ratio = exactPreset ?? 'custom';
    els.ratioSelect.value = state.ratio;
    render();
  }
  els.canvasWidth.addEventListener('input', updateCustomSize);
  els.canvasHeight.addEventListener('input', updateCustomSize);
  els.backgroundMode.addEventListener('change', () => {
    state.previewBackground = els.backgroundMode.value;
    render();
  });

  els.scrubber.addEventListener('input', () => {
    stopPlayback();
    setProgress(Number(els.scrubber.value) / 1000, true);
  });
  els.playButton.addEventListener('click', startPlayback);
  els.restartButton.addEventListener('click', () => {
    stopPlayback();
    setProgress(0, true);
  });
  els.resetButton.addEventListener('click', resetComponentVisuals);

  document.querySelectorAll('.mode-tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach((node) => node.classList.toggle('is-active', node === button));
      els.compareGrid.classList.toggle('component-only', button.dataset.view === 'component');
    });
  });

  els.referenceVideo.addEventListener('loadedmetadata', () => {
    if (!state.playing) seekReferenceToProgress(progress(), false);
  });
  els.referenceVideo.addEventListener('ended', () => {
    stopPlayback();
    seekReferenceToProgress(1, false);
  });

  const params = new URLSearchParams(location.search);
  const requestedId = params.get('component');
  const requestedProgress = clamp(Number(params.get('p') ?? 0));
  const requestedRatio = params.get('ratio');
  const requestedWidth = Number(params.get('w'));
  const requestedHeight = Number(params.get('h'));
  if (params.get('snapshot') === '1') document.body.classList.add('snapshot-mode');

  let initialIndex = 0;
  if (requestedId) {
    const byId = CATALOG.findIndex((item) => item.id === requestedId);
    const numeric = Number(requestedId);
    const byNumber = Number.isFinite(numeric) ? numeric - 1 : -1;
    initialIndex = byId >= 0 ? byId : byNumber >= 0 && byNumber < CATALOG.length ? byNumber : 0;
  }

  selectComponent(initialIndex, requestedProgress);
  if (requestedRatio && ratioPresets[requestedRatio]) {
    state.ratio = requestedRatio;
    [state.width, state.height] = ratioPresets[requestedRatio];
    syncControlsFromState();
    render();
  } else if (Number.isFinite(requestedWidth) && Number.isFinite(requestedHeight) && requestedWidth >= 160 && requestedHeight >= 160) {
    state.ratio = 'custom';
    state.width = Math.min(7680, Math.round(requestedWidth));
    state.height = Math.min(7680, Math.round(requestedHeight));
    syncControlsFromState();
    render();
  }

  window.CH1_REVIEW = Object.freeze({
    getState: () => JSON.parse(JSON.stringify({ ...state, component: component().id, durationTicks: durationTicks() })),
    setProgress: (p) => {
      stopPlayback();
      setProgress(p, true);
    },
    selectComponent: (id) => {
      const index = typeof id === 'number' ? id : CATALOG.findIndex((item) => item.id === id);
      if (index >= 0) selectComponent(index, 0);
    },
  });
})();
