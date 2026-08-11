# T5.5 OpenCut Behavior Matrix

OpenCut behavior below comes from the owner-provided T5.5 reference brief. It is a comparison target, not source code and not Sanverse authority.

| Reference behavior | Sanverse decision / implementation |
|---|---|
| Trim handle positioning | Adapt principle: enlarged hit geometry, restrained visible mark outside edges. |
| Selection after trim | Keep existing continuity; regression coverage remains. |
| Selection after track move | Keep existing selection authority; selected track now visible. |
| Selection after drag | Keep existing continuity; active item/track context clearer. |
| Dragged-item stacking | Adapt: dragging item raised above ordinary Timeline content. |
| Adjacent clip spacing | Keep existing geometry; selection outline no longer dominates neighboring clips. |
| Selected track highlighting | Adapt: subtle lane/header semantic highlight. |
| Additive marquee modifiers | Keep existing selection-v2/marquee behavior. |
| Vertical Timeline scrolling | Adapt: Timeline body scrolls internally and header scroll is synchronized. |
| Fixed header/ruler | Adapt: ruler/header sticky inside Timeline viewport. |
| Initial Timeline scroll | Existing persisted viewport/continuity retained; owner browser session still required. |
| Snap bypass | Keep Shift bypass; add visible snap target language. |
| Numeric field scrubbing | Do not add risky scrub gesture in this gate; standardize numeric keyboard/validation semantics instead. |
| Preview transform handles | Keep existing Editor-owned Canvas handles. |
| Preview snap guides | Keep existing Canvas guides. |
| Properties organization | Adapt through one numeric primitive and explicit dirty-draft state. |
| Empty states | Adapt: actionable next-step copy replaces generic `Empty`. |
| Context menus | Keep one routed action authority; no placeholder commands added. |
| Playback while interacting | Existing playback reliability/one-video tests retained; real browser proof required. |
| Waveform visibility/performance | Keep verified T5 waveform/channel authority and bounded rendering. |

Sanverse deliberately does not copy OpenCut branding or visual design.
