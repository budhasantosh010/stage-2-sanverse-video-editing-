# Git Runbook

## Branching

- `main` must remain a coherent, verified baseline.
- Use short-lived branches for implementation after G0 unless the owner approves another workflow.
- Keep commits small enough to review and revert, but complete enough to preserve a meaningful invariant.

## Before commit

1. Inspect `git status --short` and the diff.
2. Run targeted and broader relevant checks.
3. Scan for secrets, private media, generated outputs, and unrelated changes.
4. Update state, tracker, log, and change record where required.
5. State evidence and limitations honestly.

## Safety

- Never use `git reset --hard`, destructive checkout, or forced push without explicit owner approval.
- Prefer `git revert` for published history.
- Never commit raw user media, environment files, credentials, or private prompt transcripts.
- Verify remote owner, repository visibility, branch, and pushed commit after external operations.

## Release principle

A Git tag or GitHub release is a distribution marker, not proof of product quality. Link releases to acceptance evidence.
