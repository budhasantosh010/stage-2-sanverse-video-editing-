# Test and build results

- Focused affected P1-F.0.2.1 suite: 4 files, 91/91 passed.
- API: 239/239.
- Web: 534/534.
- Edit domain: 299/299.
- Intent domain: 27/27.
- Render contract: 65/65.
- Total: 1,164/1,164.
- `git diff --check`: passed.
- `npm run build`: passed for all five workspaces.

Production web output: 199 modules; CSS 93.53 kB raw / 16.17 kB gzip; JavaScript 589.90 kB raw / 164.81 kB gzip.

Existing nonblocking build warnings remain: runtime font URL resolution and a JavaScript chunk above Vite's 500 kB advisory threshold.
