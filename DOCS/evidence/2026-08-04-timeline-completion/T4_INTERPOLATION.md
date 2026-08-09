# T4 Interpolation

T4 preserves the existing Editor Program `VisualEasing` authority and exposes:

- Linear;
- Ease In (cubic-bezier preset);
- Ease Out (cubic-bezier preset);
- Ease In-Out (cubic-bezier preset);
- Custom Bezier;
- Spring;
- Bounce.

Easing belongs to the LEFT keyframe and controls its outgoing segment. The final keyframe therefore has no editable outgoing interpolation and the UI disables/explains it.

Custom Bezier stores only canonical x1/y1/x2/y2 using existing bounds. Graph handle pixels are converted to those normalized values. Equal-value segments truthfully suppress useful Bezier manipulation because easing cannot change a constant segment.

Spring and Bounce render by sampling the existing shared evaluator. They are not faked as Bezier curves. Spring edits existing mass/stiffness/damping/velocity parameters; Bounce edits existing intensity.

## Hold

Hold/Step is intentionally **not shipped in T4**. The existing Editor `VisualEasing` union does not contain Hold. Shipping it truthfully would require coordinated editor-domain validation, shared evaluator and FFmpeg/render verification. T4 does not add a UI-only Hold or touch Motion Program easing contracts. This is a deliberate truthful omission permitted by the T4 contract.
