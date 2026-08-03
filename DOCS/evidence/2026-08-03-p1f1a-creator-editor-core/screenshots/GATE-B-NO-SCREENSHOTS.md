# Why there are no Gate B screenshots

Every screenshot attempt during the Gate B browser walkthrough failed with:

```
  Screenshot timed out after 5s: the Browser pane is not displayed,
  so the page is not compositing frames.
```

The in-app browser pane was not on screen for this session. A page that is not
displayed does not paint, so there was nothing to capture. This is a limitation
of the session, not a fault in the product.

**What was captured instead:** live geometry read out of the running DOM with
`getBoundingClientRect()` and `getComputedStyle()` — panel widths, row heights,
thumbnail sizes, which controls were visible, whether anything was clipped, and
whether anything scrolled horizontally. Those are in
`../media-responsive-matrix.md`.

**What that means, stated honestly:** the layout is proved. The *appearance* is
not. Nobody has looked at Gate B's Media panel in a picture.

The Gate A screenshots in this folder were captured when the pane was displayed.
