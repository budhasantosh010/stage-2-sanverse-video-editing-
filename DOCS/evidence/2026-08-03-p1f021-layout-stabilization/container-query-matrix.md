# Container-query matrix

| Container | Trigger | Result |
|---|---:|---|
| Preview | ≤620 px wide | tighter Canvas frame and badge |
| AI | ≤360 px wide | compact expanded toggle |
| Timeline | ≤290 px high | compact heading/padding |
| Timeline | ≤760 px wide | compact controls and lane headers |
| Inspector | ≤340 px wide | stacked label/value rows |
| Media | narrow dock modes | compact filters and cards |

At mobile natural flow, Preview and Timeline downgrade from `size` to `inline-size` containment so intrinsic block height remains measurable.
