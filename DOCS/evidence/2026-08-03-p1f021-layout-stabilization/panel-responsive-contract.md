# Panel-responsive contract

Panel content responds to its allocated container, not only the browser viewport:

- `studio-media`: compact filters/cards at narrow dock widths.
- `studio-tool`: Inspector rows stack below 340 px.
- `studio-preview`: tighter Canvas padding below 620 px.
- `studio-timeline`: compact controls and lane headers below 760 px; short-height presentation below 290 px.
- `studio-ai`: suppresses redundant rail text below 360 px.

Named containers are presentation-only and do not observe or mutate editor state.
