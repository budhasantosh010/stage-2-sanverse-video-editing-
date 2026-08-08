# T3 Shuttle and Dynamic Trim

J/K/L uses the existing single composition playhead:
- J = reverse shuttle,
- K = stop,
- L = forward shuttle,
- repeated J/L = 1x, 2x, 4x, 8x.

No negative HTMLVideoElement playback rate, second player, or second clock is introduced.

Real Edge:
- J/J/K/L/L ended at `Shuttle forwards 2x` with revision unchanged and exactly one `<video>`;
- Dynamic Trim cancellation after a frame nudge created zero revision;
- a second Dynamic Trim session committed on Enter with exactly one revision;
- Undo restored the prior accepted Roll state.

Dynamic Trim owns only a detached Roll delta; J/K/L and frame nudge advance the existing playhead/session preview.
