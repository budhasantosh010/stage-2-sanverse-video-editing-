(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const root = $('componentRoot');
  const viewport = $('componentViewport');
  if (!root || !viewport || !window.CH1_REVIEW) return;

  const STORAGE_KEY = 'sanverse.ch1.deep-overrides/v1';
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
  const lerp = (a, b, t) => a + (b - a) * clamp(t);
  const seq = (p, a, b) => clamp((p - a) / Math.max(0.000001, b - a));
  const easing = Object.freeze({
    linear: (t) => clamp(t),
    'ease-out-cubic': (t) => 1 - Math.pow(1 - clamp(t), 3),
    'ease-in-cubic': (t) => Math.pow(clamp(t), 3),
    'ease-in-out-cubic': (t) => {
      const x = clamp(t);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    },
    back: (t) => {
      const x = clamp(t) - 1;
      const c1 = 1.8;
      return 1 + (c1 + 1) * x * x * x + c1 * x * x;
    },
  });

  const els = Object.freeze({
    templateControls: $('templateControls'),
    deepEditor: $('deepEditor'),
    templateModeButton: $('templateModeButton'),
    deepModeButton: $('deepModeButton'),
    deepScope: $('deepScope'),
    deepNodeList: $('deepNodeList'),
    deepNodeCount: $('deepNodeCount'),
    deepSelectedNode: $('deepSelectedNode'),
    resetDeepNode: $('resetDeepNode'),
    resetAllDeep: $('resetAllDeep'),
    copyVariant: $('copyVariant'),
    exportVariant: $('exportVariant'),
    importVariantButton: $('importVariantButton'),
    importVariantFile: $('importVariantFile'),
    variantStatus: $('variantStatus'),
  });

  const fieldSpec = Object.freeze({
    deepText: ['text', 'string'],
    deepVisible: ['visible', 'select-inherit'],
    deepZ: ['zIndex', 'number'],
    deepBlend: ['blendMode', 'string'],
    deepX: ['x', 'number'],
    deepY: ['y', 'number'],
    deepScaleX: ['scaleX', 'number'],
    deepScaleY: ['scaleY', 'number'],
    deepRotation: ['rotation', 'number'],
    deepOpacity: ['opacity', 'number'],
    deepSkewX: ['skewX', 'number'],
    deepSkewY: ['skewY', 'number'],
    deepTransformOrigin: ['transformOrigin', 'string'],
    deepWidth: ['width', 'number'],
    deepHeight: ['height', 'number'],
    deepPadding: ['padding', 'string'],
    deepGap: ['gap', 'string'],
    deepOverflow: ['overflow', 'string'],
    deepFontFamily: ['fontFamily', 'string'],
    deepFontSize: ['fontSize', 'string'],
    deepFontWeight: ['fontWeight', 'number'],
    deepLineHeight: ['lineHeight', 'string'],
    deepLetterSpacing: ['letterSpacing', 'string'],
    deepTextAlign: ['textAlign', 'string'],
    deepColor: ['color', 'string'],
    deepBackground: ['background', 'string'],
    deepBorderColor: ['borderColor', 'string'],
    deepBorderWidth: ['borderWidth', 'string'],
    deepBorderRadius: ['borderRadius', 'string'],
    deepBoxShadow: ['boxShadow', 'string'],
    deepFilter: ['filter', 'string'],
    deepBackdropFilter: ['backdropFilter', 'string'],
    deepClipPath: ['clipPath', 'string'],
    deepEnterStart: ['enterStart', 'number'],
    deepEnterEnd: ['enterEnd', 'number'],
    deepEnterX: ['enterX', 'number'],
    deepEnterY: ['enterY', 'number'],
    deepEnterScale: ['enterScale', 'number'],
    deepExitStart: ['exitStart', 'number'],
    deepExitEnd: ['exitEnd', 'number'],
    deepExitX: ['exitX', 'number'],
    deepExitY: ['exitY', 'number'],
    deepExitScale: ['exitScale', 'number'],
    deepEase: ['ease', 'string'],
    deepRawCss: ['rawCss', 'string'],
    deepKeyframes: ['keyframes', 'string'],
  });

  const fields = Object.fromEntries(Object.keys(fieldSpec).map((id) => [id, $(id)]));

  function loadOverrides() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  const deepState = {
    mode: 'template',
    scope: 'global',
    selectedNodeId: null,
    overrides: loadOverrides(),
    applying: false,
  };

  function reviewState() {
    return window.CH1_REVIEW.getState();
  }

  function currentComponentId() {
    return reviewState().component;
  }

  function currentShape() {
    return viewport.dataset.shape || 'balanced';
  }

  function currentRatio() {
    return reviewState().ratio || 'custom';
  }

  function blankComponentStore() {
    return { global: {}, ratios: {}, shapes: {} };
  }

  function componentStore(create = true, componentId = currentComponentId()) {
    if (!deepState.overrides[componentId] && create) deepState.overrides[componentId] = blankComponentStore();
    return deepState.overrides[componentId] || null;
  }

  function scopeStore(create = true) {
    const store = componentStore(create);
    if (!store) return null;
    if (deepState.scope === 'ratio') {
      const key = currentRatio();
      if (!store.ratios[key] && create) store.ratios[key] = {};
      return store.ratios[key] || null;
    }
    if (deepState.scope === 'shape') {
      const key = currentShape();
      if (!store.shapes[key] && create) store.shapes[key] = {};
      return store.shapes[key] || null;
    }
    return store.global;
  }

  function mergedOverride(nodeId) {
    const store = componentStore(false);
    if (!store) return {};
    return Object.assign(
      {},
      store.global?.[nodeId] || {},
      store.shapes?.[currentShape()]?.[nodeId] || {},
      store.ratios?.[currentRatio()]?.[nodeId] || {},
    );
  }

  function editableOverride(create = true) {
    if (!deepState.selectedNodeId) return null;
    const store = scopeStore(create);
    if (!store) return null;
    if (!store[deepState.selectedNodeId] && create) store[deepState.selectedNodeId] = {};
    return store[deepState.selectedNodeId] || null;
  }

  function saveOverrides() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(deepState.overrides)); } catch (_) { /* local file can still export */ }
  }

  function hasKeys(value) {
    return value && typeof value === 'object' && Object.keys(value).length > 0;
  }

  function cleanEmptyBranches(componentId = currentComponentId()) {
    const store = componentStore(false, componentId);
    if (!store) return;
    for (const map of [store.global, ...Object.values(store.ratios || {}), ...Object.values(store.shapes || {})]) {
      for (const [nodeId, override] of Object.entries(map || {})) if (!hasKeys(override)) delete map[nodeId];
    }
  }

  function parseRawCss(text) {
    const declarations = [];
    for (const chunk of String(text || '').split(';')) {
      const colon = chunk.indexOf(':');
      if (colon <= 0) continue;
      const property = chunk.slice(0, colon).trim();
      const value = chunk.slice(colon + 1).trim();
      if (property && value) declarations.push([property, value]);
    }
    return declarations;
  }

  function parseKeyframes(text) {
    if (!String(text || '').trim()) return [];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry) => entry && typeof entry === 'object' && Number.isFinite(Number(entry.at)))
        .map((entry) => ({ ...entry, at: clamp(Number(entry.at)) }))
        .sort((a, b) => a.at - b.at);
    } catch (_) {
      return [];
    }
  }

  function sampleKeyframes(frames, p) {
    if (!frames.length) return {};
    if (p <= frames[0].at) return frames[0];
    if (p >= frames[frames.length - 1].at) return frames[frames.length - 1];
    let left = frames[0];
    let right = frames[frames.length - 1];
    for (let index = 1; index < frames.length; index += 1) {
      if (p <= frames[index].at) { right = frames[index]; left = frames[index - 1]; break; }
    }
    const raw = seq(p, left.at, right.at);
    const easeName = right.ease || left.ease || 'linear';
    const t = (easing[easeName] || easing.linear)(raw);
    const result = {};
    for (const key of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'blur']) {
      const a = Number(left[key]);
      const b = Number(right[key]);
      if (Number.isFinite(a) && Number.isFinite(b)) result[key] = lerp(a, b, t);
      else if (Number.isFinite(b)) result[key] = b;
      else if (Number.isFinite(a)) result[key] = a;
    }
    return result;
  }

  function motionState(override, p) {
    const hasMotion = ['enterStart','enterEnd','enterX','enterY','enterScale','exitStart','exitEnd','exitX','exitY','exitScale','ease'].some((key) => override[key] !== undefined);
    const base = {
      x: Number(override.x) || 0,
      y: Number(override.y) || 0,
      scaleX: Number.isFinite(Number(override.scaleX)) ? Number(override.scaleX) : 1,
      scaleY: Number.isFinite(Number(override.scaleY)) ? Number(override.scaleY) : 1,
      rotation: Number(override.rotation) || 0,
      opacity: Number.isFinite(Number(override.opacity)) ? clamp(Number(override.opacity)) : 1,
      blur: null,
    };

    if (hasMotion) {
      const enterStart = clamp(Number.isFinite(Number(override.enterStart)) ? Number(override.enterStart) : 0);
      const enterEnd = clamp(Number.isFinite(Number(override.enterEnd)) ? Number(override.enterEnd) : Math.min(1, enterStart + 0.18));
      const exitStart = clamp(Number.isFinite(Number(override.exitStart)) ? Number(override.exitStart) : 0.84);
      const exitEnd = clamp(Number.isFinite(Number(override.exitEnd)) ? Number(override.exitEnd) : 1);
      const easeFn = easing[override.ease] || easing['ease-out-cubic'];
      const enter = easeFn(seq(p, enterStart, Math.max(enterStart + 0.0001, enterEnd)));
      const exit = easeFn(seq(p, exitStart, Math.max(exitStart + 0.0001, exitEnd)));
      base.x += lerp(Number(override.enterX) || 0, 0, enter) + lerp(0, Number(override.exitX) || 0, exit);
      base.y += lerp(Number(override.enterY) || 0, 0, enter) + lerp(0, Number(override.exitY) || 0, exit);
      const enterScale = Number.isFinite(Number(override.enterScale)) ? Number(override.enterScale) : 1;
      const exitScale = Number.isFinite(Number(override.exitScale)) ? Number(override.exitScale) : 1;
      const motionScale = lerp(enterScale, 1, enter) * lerp(1, exitScale, exit);
      base.scaleX *= motionScale;
      base.scaleY *= motionScale;
      base.opacity *= enter * (1 - exit);
    }

    const keyframeSample = sampleKeyframes(parseKeyframes(override.keyframes), p);
    for (const key of ['x','y','scaleX','scaleY','rotation','opacity','blur']) if (keyframeSample[key] !== undefined) base[key] = keyframeSample[key];
    return base;
  }

  function applyOneNode(node, override, p) {
    if (!hasKeys(override)) return;
    node.classList.add('deep-edited-node');

    if (override.text !== undefined && override.text !== '') node.textContent = override.text;
    if (override.visible === 'hidden') node.style.display = 'none';
    else if (override.visible === 'visible') node.style.display = '';
    if (override.zIndex !== undefined) node.style.zIndex = String(override.zIndex);
    if (override.blendMode) node.style.mixBlendMode = override.blendMode;
    if (override.transformOrigin) node.style.transformOrigin = override.transformOrigin;
    if (override.width !== undefined) node.style.width = `${Math.max(0, Number(override.width) || 0)}cqw`;
    if (override.height !== undefined) node.style.height = `${Math.max(0, Number(override.height) || 0)}cqh`;
    if (override.padding) node.style.padding = override.padding;
    if (override.gap) node.style.gap = override.gap;
    if (override.overflow) node.style.overflow = override.overflow;
    if (override.fontFamily) node.style.fontFamily = override.fontFamily;
    if (override.fontSize) node.style.fontSize = override.fontSize;
    if (override.fontWeight !== undefined) node.style.fontWeight = String(override.fontWeight);
    if (override.lineHeight) node.style.lineHeight = override.lineHeight;
    if (override.letterSpacing) node.style.letterSpacing = override.letterSpacing;
    if (override.textAlign) node.style.textAlign = override.textAlign;
    if (override.color) node.style.color = override.color;
    if (override.background) node.style.background = override.background;
    if (override.borderColor) node.style.borderColor = override.borderColor;
    if (override.borderWidth) node.style.borderWidth = override.borderWidth;
    if (override.borderRadius) node.style.borderRadius = override.borderRadius;
    if (override.boxShadow) node.style.boxShadow = override.boxShadow;
    if (override.filter) node.style.filter = override.filter;
    if (override.backdropFilter) node.style.backdropFilter = override.backdropFilter;
    if (override.clipPath) node.style.clipPath = override.clipPath;

    const motion = motionState(override, p);
    const originalTransform = node.style.transform && node.style.transform !== 'none' ? node.style.transform : '';
    const deepTransform = ` translate3d(${motion.x}cqw,${motion.y}cqh,0) scale(${motion.scaleX},${motion.scaleY}) rotate(${motion.rotation}deg) skew(${Number(override.skewX) || 0}deg,${Number(override.skewY) || 0}deg)`;
    node.style.transform = `${originalTransform}${deepTransform}`.trim();
    const templateOpacity = node.style.opacity === '' ? 1 : Number(node.style.opacity);
    node.style.opacity = String((Number.isFinite(templateOpacity) ? templateOpacity : 1) * motion.opacity);
    if (motion.blur !== null && Number.isFinite(Number(motion.blur))) node.style.filter = `${node.style.filter || ''} blur(${Math.max(0, Number(motion.blur))}px)`.trim();

    for (const [property, value] of parseRawCss(override.rawCss)) node.style.setProperty(property, value);
  }

  function allSemanticNodes() {
    return [...root.querySelectorAll('[data-semantic-id]')];
  }

  function applyOverrides() {
    if (deepState.applying) return;
    deepState.applying = true;
    try {
      const p = clamp(Number(reviewState().exactTick) / Math.max(1, Number(reviewState().durationTicks)));
      for (const node of allSemanticNodes()) {
        const id = node.getAttribute('data-semantic-id');
        applyOneNode(node, mergedOverride(id), p);
        if (deepState.mode === 'deep' && id === deepState.selectedNodeId) node.classList.add('deep-selected-node');
      }
      if (deepState.mode === 'deep') refreshNodeList();
    } finally {
      deepState.applying = false;
    }
  }

  function availableNodeIds() {
    const seen = new Set();
    const ids = [];
    for (const node of allSemanticNodes()) {
      const id = node.getAttribute('data-semantic-id');
      if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
    }
    return ids;
  }

  function refreshNodeList() {
    if (!els.deepNodeList) return;
    const ids = availableNodeIds();
    els.deepNodeCount.textContent = String(ids.length);
    if (!ids.includes(deepState.selectedNodeId)) deepState.selectedNodeId = ids[0] || null;
    els.deepNodeList.innerHTML = ids.map((id) => {
      const edited = hasKeys(mergedOverride(id));
      return `<button type="button" class="deep-node-button ${id === deepState.selectedNodeId ? 'is-active' : ''}" data-deep-node="${escapeHtml(id)}">${edited ? '● ' : ''}${escapeHtml(id)}</button>`;
    }).join('');
    els.deepSelectedNode.textContent = deepState.selectedNodeId || '—';
    syncFieldsFromOverride();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function syncFieldsFromOverride() {
    const override = editableOverride(false) || {};
    for (const [id, [key, type]] of Object.entries(fieldSpec)) {
      const control = fields[id];
      if (!control) continue;
      const value = override[key];
      if (type === 'select-inherit') control.value = value || 'inherit';
      else control.value = value === undefined || value === null ? '' : String(value);
    }
  }

  function updateOverrideFromControl(id) {
    const control = fields[id];
    const spec = fieldSpec[id];
    if (!control || !spec || !deepState.selectedNodeId) return;
    const [key, type] = spec;
    const override = editableOverride(true);
    const raw = control.value;
    if (type === 'number') {
      if (raw === '' || !Number.isFinite(Number(raw))) delete override[key];
      else override[key] = Number(raw);
    } else if (type === 'select-inherit') {
      if (!raw || raw === 'inherit') delete override[key];
      else override[key] = raw;
    } else {
      if (raw === '') delete override[key];
      else override[key] = raw;
    }
    cleanEmptyBranches();
    saveOverrides();
    applyOverrides();
    updateStatus('Deep variant auto-saved.');
  }

  function setMode(mode) {
    deepState.mode = mode === 'deep' ? 'deep' : 'template';
    els.templateControls.hidden = deepState.mode !== 'template';
    els.deepEditor.hidden = deepState.mode !== 'deep';
    els.templateModeButton.classList.toggle('is-active', deepState.mode === 'template');
    els.deepModeButton.classList.toggle('is-active', deepState.mode === 'deep');
    root.classList.toggle('deep-pick-mode', deepState.mode === 'deep');
    applyOverrides();
    if (deepState.mode === 'deep') refreshNodeList();
  }

  function resetSelectedNode() {
    if (!deepState.selectedNodeId) return;
    const store = scopeStore(false);
    if (store) delete store[deepState.selectedNodeId];
    cleanEmptyBranches();
    saveOverrides();
    syncFieldsFromOverride();
    requestTemplateRerender();
    updateStatus('Selected node reset to the approved template in this scope.');
  }

  function resetAllForComponent() {
    deepState.overrides[currentComponentId()] = blankComponentStore();
    saveOverrides();
    requestTemplateRerender();
    updateStatus('All deep edits for this component were removed. Approved template restored.');
  }

  function requestTemplateRerender() {
    const p = clamp(Number(reviewState().exactTick) / Math.max(1, Number(reviewState().durationTicks)));
    window.CH1_REVIEW.setProgress(p);
    queueMicrotask(() => { refreshNodeList(); applyOverrides(); });
  }

  function exportPayload() {
    const rs = reviewState();
    return {
      schema: 'sanverse.ch1-component-variant/v1',
      componentId: currentComponentId(),
      approvedTemplateVisualVersion: 1,
      canvas: { ratio: rs.ratio, width: rs.width, height: rs.height },
      deepOverrides: JSON.parse(JSON.stringify(componentStore(false) || blankComponentStore())),
    };
  }

  function updateStatus(message) {
    if (els.variantStatus) els.variantStatus.textContent = message;
  }

  async function copyVariant() {
    const text = JSON.stringify(exportPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      updateStatus('Variant JSON copied to clipboard.');
    } catch (_) {
      updateStatus('Clipboard access was blocked. Use Export JSON instead.');
    }
  }

  function downloadVariant() {
    const payload = exportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${payload.componentId}-variant.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    updateStatus('Portable variant JSON exported.');
  }

  async function importVariant(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.schema !== 'sanverse.ch1-component-variant/v1' || !payload.componentId || !payload.deepOverrides) throw new Error('Unsupported variant file.');
      deepState.overrides[payload.componentId] = payload.deepOverrides;
      saveOverrides();
      if (payload.componentId === currentComponentId()) requestTemplateRerender();
      updateStatus(`Imported variant for ${payload.componentId}.`);
    } catch (error) {
      updateStatus(`Import failed: ${error.message || 'invalid JSON'}`);
    }
  }

  els.templateModeButton?.addEventListener('click', () => setMode('template'));
  els.deepModeButton?.addEventListener('click', () => setMode('deep'));
  els.deepScope?.addEventListener('change', () => {
    deepState.scope = els.deepScope.value;
    syncFieldsFromOverride();
    applyOverrides();
  });

  els.deepNodeList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-deep-node]');
    if (!button) return;
    deepState.selectedNodeId = button.dataset.deepNode;
    refreshNodeList();
    applyOverrides();
  });

  root.addEventListener('click', (event) => {
    if (deepState.mode !== 'deep') return;
    const node = event.target.closest('[data-semantic-id]');
    if (!node || !root.contains(node)) return;
    event.preventDefault();
    event.stopPropagation();
    deepState.selectedNodeId = node.getAttribute('data-semantic-id');
    refreshNodeList();
    applyOverrides();
  }, true);

  for (const id of Object.keys(fieldSpec)) {
    const control = fields[id];
    if (!control) continue;
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(eventName, () => updateOverrideFromControl(id));
  }

  els.resetDeepNode?.addEventListener('click', resetSelectedNode);
  els.resetAllDeep?.addEventListener('click', resetAllForComponent);
  els.copyVariant?.addEventListener('click', copyVariant);
  els.exportVariant?.addEventListener('click', downloadVariant);
  els.importVariantButton?.addEventListener('click', () => els.importVariantFile?.click());
  els.importVariantFile?.addEventListener('change', () => {
    const file = els.importVariantFile.files?.[0];
    if (file) importVariant(file);
    els.importVariantFile.value = '';
  });

  const observer = new MutationObserver(() => {
    if (deepState.applying) return;
    queueMicrotask(applyOverrides);
  });
  observer.observe(root, { childList: true, subtree: true });

  window.CH1_DEEP = Object.freeze({
    getVariant: () => exportPayload(),
    setMode,
    selectNode: (nodeId) => {
      deepState.selectedNodeId = nodeId;
      setMode('deep');
    },
    resetComponent: resetAllForComponent,
  });

  const query = new URLSearchParams(location.search);
  setMode(query.get('deep') === '1' ? 'deep' : 'template');
  const queryNode = query.get('deepNode');
  if (queryNode) {
    deepState.selectedNodeId = queryNode;
    const preview = {};
    const numericParams = { deepX:'x', deepY:'y', deepScaleX:'scaleX', deepScaleY:'scaleY', deepRotation:'rotation', deepOpacity:'opacity' };
    for (const [param, key] of Object.entries(numericParams)) {
      const value = Number(query.get(param));
      if (query.has(param) && Number.isFinite(value)) preview[key] = value;
    }
    const stringParams = { deepBackground:'background', deepColor:'color', deepText:'text', deepRawCss:'rawCss', deepKeyframes:'keyframes' };
    for (const [param, key] of Object.entries(stringParams)) if (query.has(param)) preview[key] = query.get(param);
    if (Object.keys(preview).length) {
      const store = componentStore(true);
      store.global[queryNode] = Object.assign({}, store.global[queryNode] || {}, preview);
    }
  }
  queueMicrotask(() => { applyOverrides(); if (deepState.mode === 'deep') refreshNodeList(); });
})();