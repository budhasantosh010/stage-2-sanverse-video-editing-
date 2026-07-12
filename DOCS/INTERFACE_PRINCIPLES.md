# Interface Principles

## Direction

The interface should feel as clean and approachable as the supplied OpenDesign reference while being designed around video editing. This is inspiration for simplicity, spacing, and conversational entry—not a request to copy branding or layout literally.

## Progressive application anatomy

### Screen 1 — Home

~~~text
┌──────────────────────────────────────────────────────────────┐
│ Sanverse                                             Projects │
│                                                              │
│                 What do you want to edit?                    │
│      Drop a cleaned video or describe the desired result.    │
│                                                              │
│      ┌────────────────────────────────────────────────┐      │
│      │ Describe the edit, attach, or drop video here  │      │
│      │                                      Start →   │      │
│      └────────────────────────────────────────────────┘      │
│                                                              │
│                       Recent projects                        │
└──────────────────────────────────────────────────────────────┘
~~~

No canvas tools, time strip, effects, inspector, model selector, or export controls appear on Home.

### Screen 2 — Studio

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

- Home is the first surface. It contains one dominant starting action and recent projects.
- The Studio is revealed only after a video is attached/dropped or an existing project is opened.
- The canvas is the primary place to point, draw, and inspect.
- Chat describes intent and handles clarification; it is not a terminal or prompt-engineering surface.
- Proposed changes show what, where, when, and expected visual result before acceptance.
- Advanced controls appear progressively when required; they do not dominate the default experience.
- Technical filenames, filesystem trees, codecs, and render flags stay hidden unless a recovery path requires them.

## Primary usability question

Can a first-time user understand how to begin without seeing editing controls, then complete a representative edit without being taught timeline terminology? If not, the interface has missed the product goal even if the engine is technically capable.
