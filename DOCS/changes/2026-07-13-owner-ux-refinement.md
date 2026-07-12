# Change Record — Owner UX Refinement

Date: 2026-07-13

## Linked truth

- Owner requirements: REQ-006, REQ-011, REQ-012, and REQ-014.
- Approved decisions: DEC-004, DEC-009, and DEC-010.
- Owner evidence: a real MP4 reached Studio, but the initial Home hierarchy and transition feel were rejected.

## Observable acceptance criterion

- The Home heading has a 3.75rem maximum rather than 6.15rem.
- Home-to-Studio and Studio-to-Home use one restrained browser-native transition when supported.
- Unsupported browsers and reduced-motion preferences update directly without animation.
- Primary upload and Back controls use the same short interaction easing.
- No editing, AI, render, or export capability is implied.

## Affected modules

- Shared visual tokens and global transition rules.
- Home and Studio presentation styles.
- App screen-transition coordination.
- Latest-selection guards and transition-start failure recovery for object-URL safety.
- View-transition feature and tests.
- Startup and project-truth documentation.

## Migration and rollback

There is no data migration. Rollback is a single commit revert. Local source videos remain unchanged, and the object-URL cleanup guarantee is preserved across the asynchronous transition boundary.

## Limitations

Automated tests can verify the transition branch and CSS contract but cannot prove that the motion feels right to the owner. A fresh real-video re-test is required. Pointing, chat interpretation, edit proposals, preview overlays, accept/undo, rendering, and export remain unimplemented.

## Verification

- `npm test -- --run`: 54 of 54 tests passed.
- `npm run build`: passed.
- Live Home at 1280 by 720: heading computed at 44.8px, composer radius at 16px, and interactive easing at 160ms with the shared cubic-bezier curve.
- Governance scope and governance truth checks: passed.
- Owner feel validation of the refined motion remains pending.
