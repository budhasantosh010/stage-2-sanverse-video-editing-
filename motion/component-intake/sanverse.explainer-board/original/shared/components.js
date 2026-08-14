(() => {
  'use strict';

  const TICKS_PER_SECOND = 1_440_000;

  const CATALOG = Object.freeze([
    {
      order: 1,
      id: 'icon-rail',
      name: 'Frosted Icon Rail',
      purpose: 'Introduce a small set of tools, brands, platforms, people or categories as a compact floating group.',
      reference: { start: 0.067, end: 1.067, occurrences: ['0.07–1.07s', '90.47–92.50s'] },
      reuse: 'Tool stacks · platform sets · partner logos · category groups',
      motionNotes: { entrance: 'Tiles arrive one-by-one into a frosted tray.', hold: 'Balanced compact icon group.', exit: 'Soft fade/drift; cut-safe.', },
      semanticParts: ['rail.root', 'rail.surface', 'rail.item:*', 'rail.icon:*'],
      defaults: {
        labels: 'A\nB\nC',
        glyphs: '◆\n✦\n∞',
        direction: 'horizontal',
      },
      fields: [
        { key: 'labels', label: 'Item labels', type: 'textarea' },
        { key: 'glyphs', label: 'Glyphs / emoji', type: 'textarea' },
        { key: 'direction', label: 'Direction', type: 'select', options: ['horizontal', 'vertical'] },
      ],
      render: renderIconRail,
    },
    {
      order: 2,
      id: 'progressive-choice-stack',
      name: 'Progressive Choice Stack',
      purpose: 'Reveal options, stages, tiers, pros/cons or states one at a time while keeping previous items visible.',
      reference: { start: 1.10, end: 3.80, occurrences: ['1.10–3.80s', '43.57–45.83s'] },
      reuse: 'Options · steps · before/after · tiers · comparisons · status lists',
      motionNotes: { entrance: 'Rows arrive sequentially with small scale/position settle.', hold: 'Stack remains readable long enough to compare.', exit: 'Group exits as one visual unit.' },
      semanticParts: ['choices.root', 'choices.item:*', 'choices.label:*', 'choices.icon:*'],
      defaults: {
        items: 'Private\nShared source\nOpen weights',
        icons: '🔒\n🔓\n📂',
        direction: 'vertical',
      },
      fields: [
        { key: 'items', label: 'Items', type: 'textarea' },
        { key: 'icons', label: 'Trailing icons', type: 'textarea' },
        { key: 'direction', label: 'Layout', type: 'select', options: ['vertical', 'horizontal'] },
      ],
      render: renderChoiceStack,
    },
    {
      order: 3,
      id: 'kinetic-phrase',
      name: 'Kinetic Phrase',
      purpose: 'Turn a short question, term or takeaway into a high-attention typographic beat with one controlled emphasis.',
      reference: { start: 3.83, end: 5.33, occurrences: ['3.83–5.33s', '84.60–87.80s'] },
      reuse: 'Questions · chapter beats · definitions · punchlines · key terms',
      motionNotes: { entrance: 'Words build in readable beats rather than all at once.', hold: 'Emphasis word becomes the payoff.', exit: 'Fast clean fade or cut-safe hold.' },
      semanticParts: ['phrase.root', 'phrase.line:*', 'phrase.emphasis'],
      defaults: {
        text: 'Which one\nis actually reusable?',
        emphasis: 'reusable?',
        emphasisStyle: 'accent',
      },
      fields: [
        { key: 'text', label: 'Phrase', type: 'textarea' },
        { key: 'emphasis', label: 'Emphasis text', type: 'text' },
        { key: 'emphasisStyle', label: 'Emphasis treatment', type: 'select', options: ['accent', 'highlight', 'plain'] },
      ],
      render: renderKineticPhrase,
    },
    {
      order: 4,
      id: 'explainer-board',
      name: 'Explainer Board',
      purpose: 'Place a clean educational panel above or beside footage for code, passwords, diagrams, UI, rules or definitions.',
      reference: { start: 10.87, end: 15.30, occurrences: ['10.87–15.30s', '19.80–24.87s', '51.23–57.57s'] },
      reuse: 'Code · UI demos · password concepts · definitions · lock/blur examples',
      motionNotes: { entrance: 'Board establishes first; internal content follows.', hold: 'Clear top-level title and one focal visual.', exit: 'Internal focus can resolve before the board leaves.' },
      semanticParts: ['board.root', 'board.title', 'board.window', 'board.content', 'board.obscure', 'board.badge'],
      defaults: {
        title: 'Workflow',
        code: 'status = "ready"\nfor item in queue:\n    publish(item)',
        mode: 'plain',
        badge: 'Example',
      },
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'code', label: 'Panel content', type: 'textarea' },
        { key: 'mode', label: 'Content mode', type: 'select', options: ['plain', 'password', 'blurred', 'locked'] },
        { key: 'badge', label: 'Small label', type: 'text' },
      ],
      render: renderExplainerBoard,
    },
    {
      order: 5,
      id: 'milestone-stage',
      name: 'Milestone Brand Stage',
      purpose: 'Introduce a date, version, era or launch milestone, then attach a hero mark and optional related platforms.',
      reference: { start: 19.80, end: 23.10, occurrences: ['19.80–23.10s', '28.80–31.37s'] },
      reuse: 'Timeline beats · launches · historical moments · version reveals',
      motionNotes: { entrance: 'Date appears first as context.', hold: 'Hero mark becomes the second beat.', exit: 'Related marks can arrive as a final supporting beat.' },
      semanticParts: ['milestone.root', 'milestone.year', 'milestone.mark', 'milestone.label', 'milestone.related:*'],
      defaults: {
        year: '2026',
        mark: 'S',
        label: 'Sanverse',
        related: 'Desktop\nWeb',
      },
      fields: [
        { key: 'year', label: 'Year / version', type: 'text' },
        { key: 'mark', label: 'Hero mark', type: 'text' },
        { key: 'label', label: 'Hero label', type: 'text' },
        { key: 'related', label: 'Related items', type: 'textarea' },
      ],
      render: renderMilestone,
    },
    {
      order: 6,
      id: 'feature-matrix',
      name: 'Feature Matrix',
      purpose: 'Compare a few important properties with simple pass/fail states and one larger explanatory criterion.',
      reference: { start: 57.57, end: 61.27, occurrences: ['57.57–61.27s', '63.27–66.43s'] },
      reuse: 'Feature checks · qualification rules · product comparison · requirements',
      motionNotes: { entrance: 'Labels establish first.', hold: 'Statuses arrive as the comparison payoff.', exit: 'Whole matrix remains grouped and readable.' },
      semanticParts: ['matrix.root', 'matrix.metric:*', 'matrix.status:*', 'matrix.criteria'],
      defaults: {
        metricA: 'Code',
        metricB: 'Weights',
        criterion: 'Transparency about the training data.',
        statusA: 'pass',
        statusB: 'pass',
        statusCriterion: 'fail',
      },
      fields: [
        { key: 'metricA', label: 'Metric A', type: 'text' },
        { key: 'metricB', label: 'Metric B', type: 'text' },
        { key: 'criterion', label: 'Large criterion', type: 'textarea' },
        { key: 'statusA', label: 'Metric A status', type: 'select', options: ['pass', 'fail', 'neutral'] },
        { key: 'statusB', label: 'Metric B status', type: 'select', options: ['pass', 'fail', 'neutral'] },
        { key: 'statusCriterion', label: 'Criterion status', type: 'select', options: ['pass', 'fail', 'neutral'] },
      ],
      render: renderFeatureMatrix,
    },
    {
      order: 7,
      id: 'media-cutaway',
      name: 'Media Cutaway Stage',
      purpose: 'Temporarily promote an image, webpage, screenshot, document or b-roll into a clean visual evidence panel.',
      reference: { start: 72.30, end: 74.77, occurrences: ['61.27–63.27s', '72.30–74.77s'] },
      reuse: 'Screenshots · documents · product captures · b-roll · evidence images',
      motionNotes: { entrance: 'Media plane enters as one deliberate surface.', hold: 'Image gets uncluttered reading time.', exit: 'Panel clears quickly back to the presenter.' },
      semanticParts: ['media.root', 'media.frame', 'media.asset', 'media.caption'],
      defaults: {
        caption: 'Reference visual',
        mediaText: 'MEDIA',
        mediaUrl: '',
      },
      fields: [
        { key: 'caption', label: 'Caption', type: 'text' },
        { key: 'mediaText', label: 'Placeholder label', type: 'text' },
        { key: 'mediaUrl', label: 'Image URL or relative path', type: 'text' },
      ],
      render: renderMediaCutaway,
    },
    {
      order: 8,
      id: 'stat-burst',
      name: 'Stat Burst',
      purpose: 'Reveal one large number, count or metric, then add its unit and supporting label in a second beat.',
      reference: { start: 74.77, end: 78.00, occurrences: ['74.77–78.00s'] },
      reuse: 'Users · revenue · growth · speed · percentages · counts',
      motionNotes: { entrance: 'Value lands first and carries the visual weight.', hold: 'Suffix/label completes the meaning.', exit: 'Small scale-down/fade keeps the stat punchy.' },
      semanticParts: ['stat.root', 'stat.value', 'stat.suffix', 'stat.label'],
      defaults: {
        startValue: '0',
        endValue: '12',
        suffix: 'M+',
        label: 'monthly users',
      },
      fields: [
        { key: 'startValue', label: 'Start value', type: 'number' },
        { key: 'endValue', label: 'End value', type: 'number' },
        { key: 'suffix', label: 'Suffix', type: 'text' },
        { key: 'label', label: 'Supporting label', type: 'text' },
      ],
      render: renderStatBurst,
    },
    {
      order: 9,
      id: 'floating-value-cloud',
      name: 'Floating Value Cloud',
      purpose: 'Surround a subject or focal area with multiple values, prices, labels or outcomes without turning the scene into a chart.',
      reference: { start: 86.30, end: 87.80, occurrences: ['86.30–87.80s'] },
      reuse: 'Costs · savings · scores · prices · outcomes · objections',
      motionNotes: { entrance: 'Values arrive from different nearby directions with small offsets.', hold: 'Cloud remains spatially balanced around a clear center.', exit: 'Chips clear in reverse order.' },
      semanticParts: ['values.root', 'values.item:*'],
      defaults: {
        values: '-$1,500\n-$1,770\n-$5,370\n-$9,500\n-$10,700',
      },
      fields: [
        { key: 'values', label: 'Values', type: 'textarea' },
      ],
      render: renderPriceCloud,
    },
    {
      order: 10,
      id: 'cta-pill',
      name: 'CTA Pill',
      purpose: 'Land a short call-to-action as a final focal button-like graphic over any footage or background.',
      reference: { start: 92.70, end: 94.47, occurrences: ['92.70–94.47s'] },
      reuse: 'Follow · Subscribe · Download · Learn more · Watch next',
      motionNotes: { entrance: 'CTA grows from subtle/transparent to confident but not bouncy.', hold: 'Simple readable hero state.', exit: 'Optional; usually a video cut can end it.' },
      semanticParts: ['cta.root', 'cta.surface', 'cta.label', 'cta.subtext'],
      defaults: {
        label: 'Follow',
        subtext: 'for more',
      },
      fields: [
        { key: 'label', label: 'CTA label', type: 'text' },
        { key: 'subtext', label: 'Supporting text', type: 'text' },
      ],
      render: renderCta,
    },
  ]);

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));
  const lerp = (a, b, t) => a + (b - a) * clamp(t);
  const seq = (p, a, b) => clamp((p - a) / Math.max(0.000001, b - a));
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeInCubic = (t) => Math.pow(clamp(t), 3);
  const easeInOutCubic = (t) => {
    const x = clamp(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const easeOutBack = (t, amount = 1.15) => {
    const x = clamp(t) - 1;
    const c1 = amount + 1;
    return 1 + c1 * x * x * x + amount * x * x;
  };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const lines = (value) => String(value ?? '').split(/\r?\n/).map((v) => v.trim()).filter(Boolean);

  function baseMotion(progress, style) {
    const p = clamp(progress);
    const intensity = clamp(style.motionIntensity, 0, 1);
    const reduced = Boolean(style.reducedMotion);
    const enter = easeOutCubic(seq(p, 0, reduced ? 0.10 : 0.18));
    const exit = style.exitStyle === 'none' ? 0 : easeInCubic(seq(p, 0.84, 1));
    let x = 0, y = 0, scale = 1;
    if (!reduced) {
      if (style.entranceStyle === 'rise-soft') { y += lerp(28 * intensity, 0, enter); scale *= lerp(0.98, 1, enter); }
      else if (style.entranceStyle === 'pop') { scale *= lerp(0.86, 1, easeOutBack(enter, 0.8 + intensity)); }
      else if (style.entranceStyle === 'slide') { x += lerp(44 * intensity, 0, enter); }
      if (style.exitStyle === 'fade-drop') y += 22 * intensity * exit;
      else if (style.exitStyle === 'scale') scale *= lerp(1, 0.92, exit);
      else if (style.exitStyle === 'slide') x -= 52 * intensity * exit;
    }
    return { enter, exit, opacity: enter * (1 - exit), x, y, scale };
  }

  function rootStyle(style, motion) {
    const shadowAlpha = clamp((Number(style.shadowStrength) || 0) * 0.18, 0, 0.4);
    return [
      `--sv-font:${style.fontFamily}`,
      `--sv-font-weight:${Number(style.fontWeight) || 900}`,
      `--sv-type-scale:${Number(style.typeScale) || 1}`,
      `--sv-text:${style.textColor}`,
      `--sv-accent:${style.accentColor}`,
      `--sv-surface:${style.surfaceColor}`,
      `--sv-highlight:${style.highlightColor}`,
      `--sv-surface-alpha:${clamp(style.surfaceOpacity)}`,
      `--sv-radius:${Number(style.radius) || 0}`,
      `--sv-padding:${Number(style.padding) || 0}`,
      `--sv-spacing:${Number(style.spacing) || 0}`,
      `--sv-border-width:${Math.max(0, Number(style.borderWidth) || 0)}px`,
      `--sv-border-color:${style.borderColor || '#d8dce5'}`,
      `--sv-shadow-alpha:${shadowAlpha}`,
      `--sv-blur:${Math.max(0, Number(style.blur) || 0)}px`,
      `opacity:${clamp(motion.opacity * style.opacity)}`,
      `transform:translate3d(${motion.x}px,${motion.y}px,0) scale(${motion.scale * style.scale}) rotate(${Number(style.rotation) || 0}deg)`,
    ].join(';');
  }

  function layerAttrs(style) {
    const allowed = new Set(['center', 'top-safe', 'bottom-safe', 'left-safe', 'right-safe']);
    const preset = allowed.has(style.positionPreset) ? style.positionPreset : 'center';
    const x = Number(style.offsetX) || 0;
    const y = Number(style.offsetY) || 0;
    return `data-position="${preset}" style="--sv-offset-x:${x}px;--sv-offset-y:${y}px"`;
  }

  function itemMotion(progress, index, count, style, start = 0.04, end = 0.62) {
    if (style.reducedMotion) return easeOutCubic(seq(progress, 0, 0.16));
    const stagger = clamp(style.stagger, 0, 1);
    const window = Math.max(0.08, end - start);
    const startSpan = window * 0.9 * stagger;
    const step = count <= 1 ? 0 : startSpan / Math.max(1, count - 1);
    const itemStart = start + index * step;
    const itemDuration = Math.max(0.08, window * (0.75 - 0.5 * stagger));
    const itemEnd = Math.min(0.98, itemStart + itemDuration);
    return easeOutCubic(seq(progress, itemStart, itemEnd));
  }

  function renderIconRail(content, style, p) {
    const labels = lines(content.labels); const glyphs = lines(content.glyphs); const count = Math.max(1, labels.length);
    const motion = baseMotion(p, style);
    const items = labels.map((label, index) => {
      const q = itemMotion(p, index, count, style, 0.02, 0.58);
      const localScale = style.reducedMotion ? 1 : lerp(0.72, 1, easeOutBack(q, 0.85));
      const localY = style.reducedMotion ? 0 : lerp(14, 0, q);
      return `<div class="sv-icon-tile" data-semantic-id="rail.item:${index}" title="${esc(label)}" style="opacity:${q};transform:translate3d(0,${localY}px,0) scale(${localScale})"><span class="sv-icon-glyph" data-semantic-id="rail.icon:${index}">${esc(glyphs[index] ?? label.slice(0,1) ?? '•')}</span></div>`;
    }).join('');
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-surface sv-icon-rail" data-semantic-id="rail.root" style="${rootStyle(style,motion)};flex-direction:${content.direction === 'vertical' ? 'column' : 'row'}">${items}</div></div>`;
  }

  function renderChoiceStack(content, style, p) {
    const items = lines(content.items); const icons = lines(content.icons); const count = Math.max(1, items.length); const motion = baseMotion(p, style);
    const nodes = items.map((label, index) => {
      const q = itemMotion(p, index, count, style, 0.02, 0.74);
      const y = style.reducedMotion ? 0 : lerp(18 + index * 3, 0, q);
      const s = style.reducedMotion ? 1 : lerp(0.94, 1, easeOutBack(q, .62));
      return `<div class="sv-pill" data-semantic-id="choices.item:${index}" style="opacity:${q};transform:translate3d(0,${y}px,0) scale(${s})"><span data-semantic-id="choices.label:${index}">${esc(label)}</span><span class="sv-pill-icon" data-semantic-id="choices.icon:${index}">${esc(icons[index] ?? '')}</span></div>`;
    }).join('');
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-pill-stack ${content.direction === 'horizontal' ? 'horizontal' : ''}" data-semantic-id="choices.root" style="${rootStyle(style,motion)}">${nodes}</div></div>`;
  }

  function renderKineticPhrase(content, style, p) {
    const phraseLines = lines(content.text); const count = Math.max(1, phraseLines.length); const motion = baseMotion(p, style);
    const emphasis = String(content.emphasis ?? '');
    const nodes = phraseLines.map((line, index) => {
      const q = itemMotion(p, index, count, style, 0.03, 0.56);
      const words = esc(line).replace(esc(emphasis), emphasis ? `<span class="emphasis ${content.emphasisStyle === 'highlight' ? 'highlight' : ''}" data-semantic-id="phrase.emphasis">${esc(emphasis)}</span>` : '');
      const x = style.reducedMotion ? 0 : lerp(index % 2 ? 20 : -20, 0, q);
      return `<div class="line" data-semantic-id="phrase.line:${index}" style="opacity:${q};transform:translate3d(${x}px,0,0)">${words}</div>`;
    }).join('');
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-kinetic" data-semantic-id="phrase.root" style="${rootStyle(style,motion)}">${nodes}</div></div>`;
  }

  function codeMarkup(code) {
    return esc(code)
      .replace(/\b(for|if|else|return|const|let|status)\b/g, '<span class="kw">$1</span>')
      .replace(/\b(range|publish|render|queue)\b/g, '<span class="fn">$1</span>')
      .replace(/(&quot;.*?&quot;)/g, '<span class="str">$1</span>');
  }

  function renderExplainerBoard(content, style, p) {
    const motion = baseMotion(p, style);
    const titleQ = itemMotion(p, 0, 2, style, 0.02, 0.30);
    const windowQ = itemMotion(p, 1, 2, style, 0.10, 0.48);
    const focusQ = easeOutCubic(seq(p, 0.42, 0.68));
    let body = `<div class="sv-code" data-semantic-id="board.content">${codeMarkup(content.code)}</div>`;
    if (content.mode === 'password') body = `<div class="sv-code" data-semantic-id="board.content" style="text-align:center;font-size:clamp(24px,7vw,54px);letter-spacing:.26em;padding-top:28px">* * * * *<br>* * * * *<br>* * * * *</div>`;
    let obscure = '';
    if (content.mode === 'blurred') obscure = `<div class="sv-obscure" data-semantic-id="board.obscure" style="opacity:${focusQ}"><span>•••</span></div>`;
    if (content.mode === 'locked') obscure = `<div class="sv-obscure" data-semantic-id="board.obscure" style="opacity:${focusQ}"><span>🔒</span></div>`;
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-explainer" data-semantic-id="board.root" style="${rootStyle(style,motion)}">
      <div class="sv-explainer-title" data-semantic-id="board.title" style="opacity:${titleQ};transform:translate3d(0,${lerp(14,0,titleQ)}px,0)">${esc(content.title)}</div>
      <div class="sv-code-window" data-semantic-id="board.window" style="opacity:${windowQ};transform:translate3d(0,${lerp(24,0,windowQ)}px,0)">
        <div style="position:absolute;right:14px;top:12px;font-size:11px;font-weight:900;color:#737a86" data-semantic-id="board.badge">${esc(content.badge)}</div>
        <div class="sv-window-dots"><i></i><i></i><i></i></div>${body}${obscure}
      </div>
    </div></div>`;
  }

  function renderMilestone(content, style, p) {
    const motion = baseMotion(p, style);
    const yearQ = itemMotion(p, 0, 3, style, 0.02, 0.34);
    const markQ = itemMotion(p, 1, 3, style, 0.18, 0.56);
    const relatedQ = itemMotion(p, 2, 3, style, 0.42, 0.76);
    const related = lines(content.related).map((item,index)=>`<span data-semantic-id="milestone.related:${index}">${esc(item)}</span>`).join('');
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-milestone" data-semantic-id="milestone.root" style="${rootStyle(style,motion)}">
      <div class="sv-year" data-semantic-id="milestone.year" style="opacity:${yearQ};transform:scale(${lerp(.9,1,yearQ)})">${esc(content.year)}</div>
      <div class="sv-brand-mark" data-semantic-id="milestone.mark" style="opacity:${markQ};transform:translate3d(0,${lerp(16,0,markQ)}px,0) scale(${lerp(.82,1,easeOutBack(markQ,.7))})">${esc(content.mark)}</div>
      <div class="sv-brand-label" data-semantic-id="milestone.label" style="opacity:${markQ}">${esc(content.label)}</div>
      <div class="sv-secondary-marks" style="opacity:${relatedQ};transform:translate3d(0,${lerp(12,0,relatedQ)}px,0)">${related}</div>
    </div></div>`;
  }

  const statusMark = (value) => value === 'pass' ? '<span class="sv-check">✓</span>' : value === 'fail' ? '<span class="sv-cross">×</span>' : '<span style="opacity:.35">•</span>';
  function renderFeatureMatrix(content, style, p) {
    const motion = baseMotion(p, style);
    const labelQ = itemMotion(p,0,2,style,.02,.38); const criteriaQ = itemMotion(p,1,2,style,.16,.54); const statusQ = easeOutBack(easeOutCubic(seq(p,.48,.74)),.55);
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-matrix" data-semantic-id="matrix.root" style="${rootStyle(style,motion)}">
      <div class="sv-matrix-top" style="opacity:${labelQ};transform:translate3d(0,${lerp(14,0,labelQ)}px,0)">
        <div class="sv-matrix-chip" data-semantic-id="matrix.metric:0">${esc(content.metricA)} <span data-semantic-id="matrix.status:0" style="transform:scale(${statusQ})">${statusMark(content.statusA)}</span></div>
        <div class="sv-matrix-chip" data-semantic-id="matrix.metric:1">${esc(content.metricB)} <span data-semantic-id="matrix.status:1" style="transform:scale(${statusQ})">${statusMark(content.statusB)}</span></div>
      </div>
      <div class="sv-matrix-wide" data-semantic-id="matrix.criteria" style="opacity:${criteriaQ};transform:translate3d(0,${lerp(18,0,criteriaQ)}px,0)">${esc(content.criterion)} <span data-semantic-id="matrix.status:2" style="display:inline-block;transform:scale(${statusQ})">${statusMark(content.statusCriterion)}</span></div>
    </div></div>`;
  }

  function renderMediaCutaway(content, style, p) {
    const motion = baseMotion(p, style); const frameQ = itemMotion(p,0,2,style,.02,.36); const captionQ = itemMotion(p,1,2,style,.24,.58);
    const media = String(content.mediaUrl ?? '').trim()
      ? `<img data-semantic-id="media.asset" src="${esc(content.mediaUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`
      : `<div class="mock-scene" data-semantic-id="media.asset"><span style="position:absolute;left:5%;top:7%;color:white;font-weight:950;letter-spacing:.12em;font-size:12px;z-index:1">${esc(content.mediaText)}</span></div>`;
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-media-stage" data-semantic-id="media.root" style="${rootStyle(style,motion)}">
      <div class="sv-media-frame" data-semantic-id="media.frame" style="opacity:${frameQ};transform:translate3d(0,${lerp(26,0,frameQ)}px,0) scale(${lerp(.96,1,frameQ)})">${media}</div>
      <div class="sv-media-caption" data-semantic-id="media.caption" style="opacity:${captionQ};transform:translate3d(${lerp(-18,0,captionQ)}px,0,0)">${esc(content.caption)}</div>
    </div></div>`;
  }

  function renderStatBurst(content, style, p) {
    const motion = baseMotion(p, style); const valueQ = itemMotion(p,0,2,style,.02,.42); const labelQ = itemMotion(p,1,2,style,.28,.62);
    const start = Number(content.startValue) || 0; const end = Number(content.endValue) || 0; const numberQ = easeInOutCubic(seq(p,.08,.50)); const value = Math.round(lerp(start,end,numberQ));
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-stat" data-semantic-id="stat.root" style="${rootStyle(style,motion)}">
      <div class="sv-stat-value" data-semantic-id="stat.value" style="opacity:${valueQ};transform:scale(${lerp(.82,1,easeOutBack(valueQ,.72))})">${esc(value)}<span data-semantic-id="stat.suffix" style="font-size:.42em;letter-spacing:-.03em">${esc(content.suffix)}</span></div>
      <div class="sv-stat-label" data-semantic-id="stat.label" style="opacity:${labelQ};transform:translate3d(0,${lerp(12,0,labelQ)}px,0)">${esc(content.label)}</div>
    </div></div>`;
  }

  function renderPriceCloud(content, style, p) {
    const motion = baseMotion(p, style); const values = lines(content.values); const positions = [[8,14],[52,4],[56,35],[9,54],[49,66],[29,30],[27,73]];
    const nodes = values.map((value,index)=>{ const q=itemMotion(p,index,values.length,style,.02,.74); const pos=positions[index%positions.length]; const dx=style.reducedMotion?0:lerp(index%2?24:-24,0,q); const dy=style.reducedMotion?0:lerp(index%3?18:-18,0,q); return `<div class="sv-price-chip" data-semantic-id="values.item:${index}" style="left:${pos[0]}%;top:${pos[1]}%;opacity:${q};transform:translate3d(${dx}px,${dy}px,0) scale(${lerp(.88,1,easeOutBack(q,.55))})">${esc(value)}</div>`; }).join('');
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap sv-price-cloud" data-semantic-id="values.root" style="${rootStyle(style,motion)}">${nodes}</div></div>`;
  }

  function renderCta(content, style, p) {
    const motion = baseMotion(p, style); const q = easeOutBack(easeOutCubic(seq(p,.02,.42)),.48); const subQ=easeOutCubic(seq(p,.34,.58));
    return `<div class="sv-layer" ${layerAttrs(style)}><div class="sv-wrap" data-semantic-id="cta.root" style="${rootStyle(style,motion)};flex-direction:column;gap:8px">
      <div class="sv-cta" data-semantic-id="cta.surface" style="opacity:${q};transform:scale(${lerp(.86,1,q)})"><span data-semantic-id="cta.label">${esc(content.label)}</span></div>
      <div class="sv-caption" data-semantic-id="cta.subtext" style="font-size:clamp(12px,2.7vw,20px);opacity:${subQ};transform:translate3d(0,${lerp(8,0,subQ)}px,0)">${esc(content.subtext)}</div>
    </div></div>`;
  }

  function renderAt(component, content, style, exactTick, durationTicks) {
    const safeDuration = Math.max(1, Math.round(durationTicks));
    const tick = Math.min(safeDuration, Math.max(0, Math.round(exactTick)));
    const progress = tick / safeDuration;
    const background = `<div class="sv-component-background" data-semantic-id="component.background" style="background:${esc(style.backgroundColor || '#000000')};opacity:${clamp(style.backgroundOpacity)}"></div>`;
    return `${background}${component.render(content, style, progress)}`;
  }

  window.CH1_COMPONENTS = Object.freeze({
    TICKS_PER_SECOND,
    CATALOG,
    renderAt,
    clamp,
  });
})();
