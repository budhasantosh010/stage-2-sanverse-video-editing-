# T4 Interaction Matrix with T2/T3

Date: 2026-08-09

T4 source-animation projection is tested against the existing T2/T3 time authority. Canonical footage keyframes remain source-relative; only their composition projection changes.

| Existing edit | T4 result |
|---|---|
| Standard Trim | canonical source keyframes unchanged; visible subset changes |
| Ripple Trim | downstream composition projection shifts; source ticks unchanged |
| Roll | visible source range changes; source animation is not deleted/retimed |
| Slip | visible source-keyframe subset changes to the new source window; old keyframes do not follow old composition X |
| Slide | selected source interval stays; projected composition X shifts |
| Speed / Rate Stretch | rational mapper changes spacing; stored source ticks unchanged |
| Reverse | canonical order unchanged; displayed composition order reverses; inverse mapping remains direction aware |
| Freeze | no source-animation lane/projection |
| J/L | keyframe operations use existing full-state animation operations and do not mutate linked-audio windows |
| Transition | visual animation rebuild preserves transition state; footage motion does not own transitions |
| Split | both placements project the same source-owned motion; exact-boundary keyframe is one canonical keyframe, not cloned |
| Repeated source | the same source-owned motion can project independently into every placement that exposes that source range |

Focused interaction coverage includes 1x, 0.5x, 2x, 7/3 rational speed, reverse, reverse+2x, trim, ripple, roll, slip, slide, split boundary, repeated placement and Freeze refusal.

The existing rational time mapper has a documented maximum one-tick inverse edge-rounding difference for non-simple rational rates such as 7/3. T4 preserves that T2 authority rather than adding a second mapper. Exact simple rates round-trip exactly.
