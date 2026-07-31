# P1-C Verification Results

Date: 2026-07-31

## Final automated gates

| Gate | Result |
|---|---:|
| Full web suite | 39 files, 380 tests passed |
| Full edit-domain suite | 23 files, 265 tests passed |
| Full API suite | 20 files, 234 tests passed |
| Full render-contract suite | 5 files, 51 tests passed |
| Full intent-domain suite | 3 files, 27 tests passed |
| All-workspace TypeScript and production build | Passed |

## Focused evidence accumulated during implementation

- Inspector resolver and Timeline labels: 38/38.
- Inspector shell, drafts, resolver, builders, and Timeline projection: 66/66.
- Studio and Timeline integration: 63/63 after the proposal-action regression was added.
- App server-authority boundary: 11/11.
- FFmpeg overlay filter graph: 32/32 after the entrance-fade alpha repair.
- Final full web suite includes 53 Studio tests, 12 visual-contract tests, and all Inspector editing tests.

## Renderer red and green proof

The new FFmpeg title-fade test failed before the renderer repair because the filter graph contained both:

```text
colorchannelmixer=aa=0
fade=t=in
```

That permanent alpha zero made the later fade unable to reveal the title. After neutralizing enter and exit transitions during base visual evaluation, the same test passed and a fresh real export showed the title during fade-in and at full visibility.

## Transient API suite observation

The first final full API run reported 233 passing assertions and one failed mocked export-job assertion. The exact export test then passed alone in 92 ms, and the complete API suite rerun passed 234/234. No code change was made between the isolated pass and the full rerun. This is recorded as a transient parallel-test observation, not hidden as a clean first attempt.

## Final production bundle

| Asset | P1-B baseline | P1-C final | Delta |
|---|---:|---:|---:|
| CSS raw | 59.20 kB | 63.89 kB | +4.69 kB |
| CSS gzip | 10.54 kB | 11.40 kB | +0.86 kB |
| JS raw | 419.56 kB | 463.68 kB | +44.12 kB |
| JS gzip | 118.43 kB | 128.38 kB | +9.95 kB |
| Production modules | 123 | 140 | +17 |

No runtime dependency was added. The unchanged build warning is that `/api/render-assets/nameplate-font` remains runtime-resolved.
