# Noticeable Motion Fallback

## Links

- Requirements: REQ-014
- Decision: DEC-010

## Acceptance criterion

When native View Transitions are unavailable, Home-to-Studio navigation has one visible entry transition; focus and enabled primary controls have brief spring feedback; reduced-motion mode removes these transforms; native browsers do not receive the fallback animation.

## Affected boundary

Only the shared motion tokens, transition-capability marker, Home/Studio CSS, visual contract tests, and governance records change. No edit-domain or media behavior changes.

## TDD evidence

- RED: focused visual-contract run failed two new assertions because fallback capability gating and explicit reduced-motion overrides were absent.
- GREEN: the focused visual-contract and transition suites passed 16 of 16 tests after the correction.
- Full frontend suite: 56 of 56 tests passed after the final correction.
- Production build, project setup verification, governance verification, and `git diff --check` passed.
- Independent motion review passed after two fix-and-re-review cycles.

## Rollback

Revert this coherent change. No data migration or media transformation exists.

## Limitations

Automated evidence validates capability gating and CSS contracts, not subjective feel. Owner acceptance remains pending on the representative browser workflow.
