# Test results

- Focused Media/Monitor/Studio: 76 passed.
- Full API: 239 passed.
- Full edit-domain: 299 passed.
- Full render-contract: 65 passed.
- Full intent-domain: 27 passed.
- First parallel full-web run: 537 passed, 7 failed. Six failures were timeouts under contention; one was a stale visual assertion expecting the entire Media shell to scroll.
- Failure-only serial rerun after correcting that assertion: 39 passed.
- Final bounded two-worker full-web: 544/544 passed.
- Final repository total before blocker review: 1,174/1,174 passed (API 239, web 544, edit-domain 299, render-contract 65, intent-domain 27).
- Post-review affected gate: 31/31 passed, including two new tests. Current test inventory: 1,176.
