# Interface Principles

## Direction

The interface should feel as clean and approachable as the supplied OpenDesign reference while being designed around video editing. This is inspiration for simplicity, spacing, and conversational entry—not a request to copy branding or layout literally.

## Initial Studio anatomy

```text
┌──────────────────────────────────────────────────────────────┐
│ Project                                                   Export │
├──────────────────────────────────────┬───────────────────────┤
│                                      │ Chat / proposals      │
│          Video canvas                │ - request             │
│          point / draw / select       │ - clarification       │
│                                      │ - preview / approve   │
│                                      │ - history / undo      │
├──────────────────────────────────────┴───────────────────────┤
│ Simple time strip: playhead, moments, accepted edits          │
└──────────────────────────────────────────────────────────────┘
```

## Visual rules for the first product version

- Black, white, and grayscale only.
- A functional status color may be used only when accessibility or error/success recognition requires it.
- No gradients, glass effects, ornamental illustration, decorative motion, or crowded toolbars.
- Strong typography, generous whitespace, visible focus states, and accessible contrast.
- One primary action per state.

## Interaction rules

- The canvas is the primary place to point, draw, and inspect.
- Chat describes intent and handles clarification; it is not a terminal or prompt-engineering surface.
- Proposed changes show what, where, when, and expected visual result before acceptance.
- Advanced controls appear progressively when required; they do not dominate the default experience.
- Technical filenames, filesystem trees, codecs, and render flags stay hidden unless a recovery path requires them.

## Primary usability question

Can the owner complete a representative edit without being taught timeline terminology? If not, the interface has missed the product goal even if the engine is technically capable.
