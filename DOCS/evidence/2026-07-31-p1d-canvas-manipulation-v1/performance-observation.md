# P1-D performance observation

P1-D does not persist or call the server during pointer movement. Move, resize, rotation, crop, and guide calculations use local immutable session state and one shared visual draft. A completed gesture emits at most one existing operation.

The representative Canvas module adds 15 production modules over P1-C. Final web output is 489.05 kB raw / 135.73 kB gzip JavaScript and 69.04 kB raw / 12.39 kB gzip CSS. No runtime dependency was added.

Real Edge interaction remained responsive during title, callout, and image manipulation at 1440×900. The browser report recorded no page, console, or HTTP errors. No per-pointer revision or network request was observed.

The 30-second 1080p export remains substantial work and `FAIL-021` stays monitoring. Export optimization was not part of P1-D.
