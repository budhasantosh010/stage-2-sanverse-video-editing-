# G6 motion quality rubric — owner approval pending

Date: 2026-07-29

The requested reference feeling is Open Design-like interaction: movement
should feel continuous instead of like an abrupt cut, with deliberate
ease-in/ease-out and a restrained bounce where it communicates completion.

The fixtures for G6-09 through G6-11 must include:

1. A title entering with position, scale, opacity, and rotation together.
2. A callout moving while its crop, layer, and mask remain stable.
3. A B-roll box animated by ordered keyframes.
4. Linear and cubic-Bezier versions of the same move.
5. Spring and bounce versions at restrained and deliberately excessive values.
6. Seek to the start, middle, one frame before the end, and the exact end.
7. Reduced-motion mode producing the final state without spatial motion.
8. Preview and exported frames compared at the same project ticks.

Pass conditions:

- no jump at animation start or end;
- no change when paused at the same tick repeatedly;
- no property outside its bounded contract;
- bounce settles at the requested final value;
- crop/mask never reveal pixels outside the intended visual;
- layer order is stable through the whole animation;
- browser and export agree at sampled ticks;
- controls use plain language and stay progressively disclosed.

G6-01 is not complete until the owner explicitly approves this rubric and the
chosen reference fixtures.
