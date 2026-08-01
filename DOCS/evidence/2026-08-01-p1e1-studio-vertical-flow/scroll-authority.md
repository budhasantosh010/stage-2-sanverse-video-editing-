# P1-E.1 Scroll Authority

## Decision

The browser document is the single outer vertical-scroll authority.

```text
html
  → owns overflow-y: auto
body / #root / EditorShell / Studio
  → contribute natural document height
Studio upper workspace
  → normal-flow content
Production Timeline
  → normal-flow content below the upper workspace
Media / Inspector / AI panel
  → bounded internal scroll only where their panel height is intentionally bounded
Timeline viewport
  → horizontal scrolling only
```

## Proven former root cause

The desktop Studio rule combined:

```css
.editor-shell .studio-screen--studio {
  height: calc(100vh - 64px);
  grid-template-rows: minmax(400px, 1fr) minmax(260px, 34vh);
  overflow: hidden;
}
```

The upper workspace and Production Timeline were therefore forced into a box exactly as tall as the remaining viewport. Content below that box did not contribute a larger document scroll height, so laptop-height viewports compressed or clipped the Timeline instead of letting the user scroll.

## Current contract

- `html` owns vertical document scrolling.
- `body` and `#root` support full natural height and prohibit page-level horizontal overflow.
- Studio uses `height: auto`, `grid-template-rows: auto auto`, and `overflow: visible`.
- The upper workspace retains a useful minimum height so P1-D's video preview does not collapse.
- The Timeline has a useful minimum height but remains below the upper workspace in document flow.
- Media, Inspector, and AI keep bounded internal scrolling while normal browser scroll chaining remains available at panel boundaries.
- The existing sticky EditorShell header remains the only sticky navigation layer.

## Rejected alternatives

- A second vertically scrolling EditorShell was rejected because it would compete with body scrolling.
- Making the Timeline internally vertical-scrollable was rejected because it would preserve the cramped one-viewport editor.
- Removing all panel scroll surfaces was rejected because long Media, Inspector, and AI content needs bounded panel navigation.
- Adding a second `ResizeObserver` was rejected because Studio already owns video client geometry.
