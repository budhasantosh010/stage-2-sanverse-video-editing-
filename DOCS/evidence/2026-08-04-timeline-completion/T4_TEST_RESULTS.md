# T4 Test Results

Date: 2026-08-10
Branch: `timeline-t4-keyframe-graph`
Exact base: `aed76ac0232e8a920812b800d234a96e32de7396`

Starting T3 baseline: **2,345 / 2,345**.

Final T4 repository gate: **2,419 / 2,419**.

- API: 404 / 404
- Web: 1,334 / 1,334
- edit-domain: 536 / 536
- intent-domain: 27 / 27
- render-contract: 118 / 118

T4 adds 74 passing tests over the T3 baseline.

The stable Windows full-suite command was:

`npm test -- --run --pool=forks --poolOptions.forks.singleFork=true`

The first broad sweep exposed two failures only in the newly written T4 long-form test itself: one test looked for keyframe diamonds outside its selected visible window and another tried to spy on `URL.createObjectURL` even though jsdom did not define it. Both test-harness mistakes were corrected without changing production behavior. The complete stable sweep then passed 2,419/2,419.

Focused T4 coverage includes the closed property matrix, source/visual time projection, full-state planners, selection, marquee, numeric editing, keyboard movement, clipboard, interpolation, bounded graph sampling, Graph/Inspector/Canvas synchronization, T2/T3 speed/reverse/trim/split interaction mapping, export identity, runtime easing safety and 60-minute bounds.

All-workspace production build: **PASS**.

Web production build at closure: 297 modules, CSS about 133.35 kB, JS about 928.62 kB. The existing runtime nameplate-font warning and Vite >500 kB advisory remain non-blocking.

Ownership boundary checker passed against the exact T3 base; no protected Motion or Plan-B file changed.
