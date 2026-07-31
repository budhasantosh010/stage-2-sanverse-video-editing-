# P1-E architecture preflight — final

Decision: **PROCEED**

## Bounded refactor

Duplicated boundary before P1-E: Studio/editor surfaces and the Media placeholder derived asset names independently, which could display different names for one identity. Source availability also had no presentation adapter for the real App.

Why needed: a Media Bin cannot be trustworthy when identity changes by surface or when an unavailable local source is shown as usable.

### Ownership before

- Project/revision: App and server.
- History: accepted project change sets.
- Editor selection: Studio.
- Asset labels: partly duplicated inside Studio/editor presentation.
- Source availability: not supplied to Media presentation.

### Ownership after

- Project/revision → App and server.
- History → accepted project change sets.
- Media sources and bounded probing → App.
- Media labels → one pure shared authority.
- Media usage → one derived index.
- Media selection → presentation state only.
- Timeline/Canvas/Inspector selection → existing shared Studio selection.
- Media placement → existing typed operations.
- Media components → callbacks and presentation data; no direct project API access.

### Files affected

- `apps/web/src/features/media/*`
- `apps/web/src/editor/media/*`
- `apps/web/src/app/App.tsx`
- `apps/web/src/screens/studio/StudioScreen.tsx`
- focused App/Studio/Media tests

### Consequences

1. First order: one asset has one visible name and one usage/status projection.
2. Second order: search/filter/selection cannot mutate project or editor state because they consume an immutable view model.
3. Third order: future thumbnail or remote-source adapters can replace App probing without rewriting Timeline, Canvas, Inspector, or the project schema.
4. Fourth order: safe asset deletion can later be added server-side without migrating a frontend-only media library or reconciling duplicate histories.

### Regression tests

Pure label, usage, view-model, action, and source-status tests; Media component tests; Studio image/audio placement and selection integration; App latest-revision regression; full web/domain/API/render/intent suites; real Edge/export walkthrough.

### Rollback boundary

The P1-E completion commit is one reversible web/evidence change over `b79d6fd21b4aff9d162a4e5f29a569a1298cf870`. It adds no schema, route, domain operation, renderer architecture, or dependency.
