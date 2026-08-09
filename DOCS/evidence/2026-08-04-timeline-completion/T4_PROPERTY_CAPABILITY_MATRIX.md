# T4 Editor Animation Property Capability Matrix

Date: 2026-08-09
Base: `aed76ac0232e8a920812b800d234a96e32de7396`

T4 exposes only properties already accepted and rendered by the production Editor Program.

## Primary footage motion

Owner kind: `primary-footage-motion`
Canonical time: source-relative to the accepted motion interval.

| Property | Label | Unit | Domain range | Keyframeable | Graphable |
|---|---|---:|---:|---|---|
| translate-x | Position X | frame fraction / % display | -2..2 | yes | yes |
| translate-y | Position Y | frame fraction / % display | -2..2 | yes | yes |
| scale | Scale | ratio / % display | 0.01..20 | yes | yes |
| rotation | Rotation | degrees | -3600..3600 | yes | yes |
| crop-top | Crop Top | fraction / % display | 0..0.99 | yes | yes |
| crop-right | Crop Right | fraction / % display | 0..0.99 | yes | yes |
| crop-bottom | Crop Bottom | fraction / % display | 0..0.99 | yes | yes |
| crop-left | Crop Left | fraction / % display | 0..0.99 | yes | yes |
| opacity | Opacity | % | — | **no** | **no** |

Primary opacity is deliberately refused because `set-footage-motion` requires an opaque base layer.

## Existing visual-property targets

Owner kind: `visual-properties`
Canonical time: visual-relative to the rendered node interval.

Target families currently resolved end-to-end:

- caption cue;
- nameplate;
- title;
- callout;
- media overlay (video/image/B-roll).

These targets already accept/render the complete `VisualProperties.tracks` property union through the shared visual evaluator, so T4 may expose:

- Position X;
- Position Y;
- Scale;
- Rotation;
- Opacity;
- Crop Top;
- Crop Right;
- Crop Bottom;
- Crop Left.

The same current domain ranges apply.

## Deliberately absent T4 lanes

- dialogue gain/pan/fades: static T2 audio authority only;
- A2 music gain/fades: static music authority only;
- Speed/Rate Stretch: constant rational timing authority, no variable-speed track;
- transition duration/style: T2 edit-point transition authority, not a continuous property track;
- Freeze source motion: no animatable source interval;
- masks/effects/layer: existing static full-state fields but not `VisualPropertyTrack` IDs, therefore not falsely exposed as keyframe lanes.

## Interpolation capability

Every exposed editor-owned visual property uses the existing `VisualEasing` segment authority:

- Linear;
- Ease In (cubic-bezier preset);
- Ease Out (cubic-bezier preset);
- Ease In-Out (cubic-bezier preset);
- Custom Bezier;
- Spring;
- Bounce.

Hold/Step is intentionally not shipped unless the existing editor easing/render contract is extended end-to-end and independently verified.
