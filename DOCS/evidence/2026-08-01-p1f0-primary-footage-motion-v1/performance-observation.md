# P1-F.0 Performance Observation

## Measured interaction timings

From the final Edge walkthrough:

- Home to ready Studio: 2,826.6 ms.
- Static preset local draft: 312.1 ms.
- Static Apply round trip: 180.4 ms.
- Canvas drag plus release commit: 823.6 ms.
- Animated Apply round trip: 183.0 ms.
- 30.033-second 1080p animated export: 53,302.8 ms.

## Export repair

The first real export found two adapter defects that isolated tests had not exposed together:

1. an extra comma created an empty FFmpeg filter after the motion output label;
2. scale/pan-only motion always ran full-frame GEQ crop masking and expanded rotation even when crop and rotation were zero.

After repair:

```text
zero crop     → no GEQ mask
zero rotation → no rotate/expanded frame
scale + pan   → scale → background → overlay
```

The exact previously failing project rendered successfully. The final browser export completed in 53.3 seconds, within the existing monitored 60-second walkthrough budget. Crop and rotation still take the full alpha path when authored.

`FAIL-021` remains a general performance-monitoring item; P1-F.0 does not claim real-time export.
