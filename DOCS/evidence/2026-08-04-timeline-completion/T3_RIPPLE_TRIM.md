# T3 Ripple Trim

`planPrecisionTrimRequest({ mode: 'ripple-trim', ... })` changes the selected source edge and shifts the current downstream ripple scope in one atomic timing operation.

Verified behavior:
- source/track-lock/speed/reverse/freeze/J-L/transition/group rules are validated before a plan is returned;
- no partial plan is returned on refusal;
- real Edge: one-frame end ripple moved the downstream real clip by exactly -48,000 ticks at the 1,440,000 ticks/s project clock;
- Undo restored the prior sequence;
- 60-minute fixture: 250 V1 clips, ripple work stayed bounded by the affected downstream clip set rather than frames, pixels, project seconds, or derived-media objects.

T5 Sync Lock is intentionally not introduced.
