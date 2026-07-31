# P1-E performance observation

Media search and filters operate on the immutable in-memory view model and do not recompile the Timeline or send requests. The representative model fixture contains 85 assets: 25 videos, 40 images, and 20 audio files.

Source checks are App-owned, bounded to four concurrent requests, and keyed by project asset/source identity. A stable empty-name map prevents source-probe render loops when the optional upload-name map is absent.

Real Edge remained responsive through image, B-roll, music, missing-source, responsive, and export workflows. No object URLs were created. After editor unmount, no hidden media element remained.

Final bundle: 168 modules; CSS 73.55 kB raw / 13.16 kB gzip; JavaScript 505.46 kB raw / 140.55 kB gzip. Delta from P1-D: +13 modules, +4.51/+0.77 kB CSS, +16.41/+4.82 kB JavaScript. No runtime dependency was added.

`FAIL-021` remains monitoring because the 30-second native export remains outside the earlier 60-second walkthrough target.
