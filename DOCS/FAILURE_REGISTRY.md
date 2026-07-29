# Failure Registry

Record failures that can teach the project, including rejected architectural assumptions and misleading verification.

| ID | Date | Area | Failure or risk | Status | Next evidence |
|---|---|---|---|---|---|
| RISK-001 | 2026-07-12 | Renderer | No renderer has been proven for both interactive preview and final export | Open; FFmpeg static fixture measured | HyperFrames, hybrid, motion, and preview/export comparisons |
| RISK-002 | 2026-07-12 | AI providers | Free OpenCode Zen/NVIDIA availability, schemas, rate limits, and terms may change | Open | Provider adapter probe in G4, not core coupling |
| RISK-003 | 2026-07-12 | Accuracy | Semantic point/draw/chat intent cannot honestly be guaranteed at 100% | Managed | Clarification, preview, fail-closed evaluation |
| RISK-004 | 2026-07-12 | Continuity | Hooks may require a new trusted session before integrated firing can be verified | Open | Restart/session verification after baseline |
| RISK-005 | 2026-07-12 | Scope | Attempting full NLE parity would delay the first useful workflow | Managed | Goal gates and deferred-ideas register |
| FAIL-006 | 2026-07-25 | Media serving | Media/export identity guard required a safe-integer inode; Windows 64-bit NTFS file IDs exceed `Number.MAX_SAFE_INTEGER`, so every newly created project 404'd its own source video and Studio blamed the file. Passing unit tests and a working older project hid it | Resolved at `fcc41eb` | Both identity guards read `{ bigint: true }` stats; live re-test serves all projects. Rule: never validate OS-issued 64-bit identifiers as JS numbers |
| FAIL-007 | 2026-07-25 | Verification | The defect above was invisible to 182 passing tests because no test used a real Windows-created project through the real HTTP route. Automated suites proved the code, not the product | Managed | Every slice needs at least one real-browser walkthrough on real media before its gate closes |
| FAIL-008 | 2026-07-25 | Error reporting | Studio converted a server-side 404 into "This browser could not preview this MP4", blaming the user's file for a cause it cannot know, which sent debugging in the wrong direction | Resolved at `fcc41eb` | Failure copy states only what is known and offers recovery |
| FAIL-009 | 2026-07-26 | Media resources | `openMedia`/`openExport` opened an OS file handle before returning an `AsyncIterable`, but the result exposed no explicit close operation. Callers that inspected metadata without iterating leaked the handle until garbage collection; three repository tests exposed the warning | Resolved in rollback tag `rollback-2026-07-26-cleanup-g4-ready` | `OpenMediaResult.close()` is explicit and idempotent, full iteration closes automatically, HTTP routes close in `finally`, and tests close unconsumed results |
| FAIL-010 | 2026-07-26 | Continuity | Authoritative documents contradicted one another: current sections said persistence and G2/G3 were complete while older sections still said they were absent or pending | Resolved in rollback tag `rollback-2026-07-26-cleanup-g4-ready` | Current-state documents now state one present truth; historical detail remains in logs/change records |
| FAIL-011 | 2026-07-26 | Verification environment | The managed Codex sandbox denies child-process creation, so Vitest/Vite cannot start workers or esbuild and a fresh full-suite run cannot collect tests in this session | Open environment limitation; not a product failure | Run `npm test` and `npm run build` from normal PowerShell outside the managed sandbox |
| FAIL-012 | 2026-07-26 | Local data hygiene | An accidental empty `.sanverse-data/projects/projects` directory remained from a launch that used the projects folder as the data root | Resolved in cleanup change | Verify the exact target is empty and inside `.sanverse-data/projects`, then remove only that directory |
| FAIL-013 | 2026-07-26 | HTTP resource cleanup | The first ownership fix entered `try/finally` only after response headers were created, so a metadata/header failure after opening media could still skip `close()` | Resolved during independent review | Enter `try/finally` immediately after `openMedia`/`openExport`, before reading response metadata or writing headers |
| FAIL-014 | 2026-07-26 | Error observability | The first idempotent `close()` implementation swallowed `FileHandle.close()` rejection, making a failed release appear successful | Resolved during independent review | Memoize and return the original close promise without converting rejection into success |
| FAIL-015 | 2026-07-29 | Git environment | The managed Codex session can edit the project but cannot create `.git/index.lock`, so the completed G5C-07 batch cannot be staged or committed here | Open environment limitation; files are complete and uncommitted | Commit the existing working tree from normal PowerShell outside the managed sandbox |
| FAIL-016 | 2026-07-29 | Job durability | Windows rejected directory `fsync` with `EPERM` after an export-job file was atomically renamed, causing job creation to report failure even though the file write itself was valid | Resolved in G8-03 | Preserve file flush/atomic rename; tolerate only Windows directory-sync `EPERM`, then prove restart recovery |

## 2026-07-26 cleanup incident details

### FAIL-016 — Windows directory sync blocked durable job creation

- **What failed:** The first persisted export-job creation returned `EPERM`.
- **Where:** Directory `fsync` after atomic rename in
  `apps/api/src/jobs/local-export-job-store.ts`.
- **When:** The focused G8-03 restart-recovery contract on 2026-07-29.
- **Who was affected:** Windows local-alpha export jobs.
- **Why:** Windows does not consistently permit `fsync` on a directory handle.
- **How reproduced:** Creating the first job in a fresh temporary data root
  failed after the job file itself was flushed and renamed.
- **What was tried:** No retry loop. The file flush and atomic rename were kept;
  only Windows directory-sync `EPERM` was treated as unsupported.
- **Status:** Resolved; persistence, concurrent idempotency, and restart recovery
  contract passes.
- **One-line solution:** Keep file `fsync` plus atomic rename, and tolerate only
  Windows directory-handle `EPERM`.

### FAIL-009 — Open media handles lacked explicit ownership

- **What failed:** Unconsumed media/export results left file handles for garbage collection.
- **Where:** `OpenMediaResult`, the filesystem repository, HTTP media/export routes, and three repository tests.
- **When:** Observed after the otherwise-passing 220-test run on 2026-07-25.
- **Who was affected:** Developers/tests immediately; repeated non-streaming repository callers could eventually affect the local app.
- **Why:** The repository opened the handle before returning, but exposed only an iterable whose cleanup started only when iteration started.
- **How reproduced:** Tests called `openMedia`/`openExport`, inspected metadata, and never iterated; Node emitted file-descriptor garbage-collection warnings.
- **What was tried:** Confirmed the warning and call paths; wrote RED contract checks; added idempotent close ownership; ran direct HTTP and real-filesystem GREEN checks.
- **Status:** Resolved in rollback tag `rollback-2026-07-26-cleanup-g4-ready`.
- **One-line solution:** Require every opened media result to expose idempotent `close()`, close automatically after iteration, and close HTTP results in `finally`.

### FAIL-010 — Authority documents drifted

- **What failed:** Resume documents reported mutually incompatible goal and persistence status.
- **Where:** `CURRENT_STATE.md`, `START_HERE.md`, `GOALS.md`, `BUILD_TRACKER.md`, and `plans/README.md`.
- **When:** Detected during the 2026-07-26 cleanup audit.
- **Who was affected:** The owner and every future agent/session relying on the handoff chain.
- **Why:** New evidence was appended at the top while obsolete current-state claims remained below; the plan registry was not advanced.
- **How reproduced:** Searching the authority files found G2/G3 simultaneously described as complete and pending and persistence as both connected and absent.
- **What was tried:** Replaced repeated historical current-state prose with one concise current truth and updated the roadmap, tracker, entry point, and plan registry together.
- **Status:** Resolved in rollback tag `rollback-2026-07-26-cleanup-g4-ready`.
- **One-line solution:** Keep one concise current-state truth and move historical details exclusively to append-only logs/change records.

### FAIL-011 — Managed sandbox blocks full Vitest/Vite execution

- **What failed:** Fresh `npm test` and the Vite production-build phase cannot start.
- **Where:** Vitest worker creation, Vite Windows network-drive discovery, and esbuild child-process launch.
- **When:** Reproduced during the 2026-07-26 pre-push verification.
- **Who was affected:** Only verification inside this managed Codex session; the application defect is not implicated.
- **Why:** Windows returned `spawn EPERM` because the session policy denies Node child processes.
- **How reproduced:** Normal Vitest, a thread pool, config runner, hidden process launch, and a bounded preload all reached the same policy boundary.
- **What was tried:** Normal test command; single-thread workers; runner config loader; hidden `Start-Process`; suppression of optional `net use`. The final unavoidable esbuild launch remained blocked.
- **Status:** Open environment limitation. API, domain, and web TypeScript builds plus direct RED/GREEN integrations pass; the prior baseline remains 220/220.
- **One-line solution:** Run the unchanged full test/build commands from a normal PowerShell session outside the managed sandbox.

### FAIL-012 — Empty duplicate local data directory

- **What failed:** A redundant nested `projects` directory existed.
- **Where:** `.sanverse-data/projects/projects`.
- **When:** Created during earlier local test launching and found on 2026-07-25.
- **Who was affected:** No user data; the directory was empty, but it made the storage layout misleading.
- **Why:** One launch supplied the projects directory where the repository expected the data-root directory.
- **How reproduced:** Filesystem inspection showed the directory existed with zero children.
- **What was tried:** Verified the resolved path, containment, and emptiness, then removed only that directory.
- **Status:** Resolved.
- **One-line solution:** Pass `.sanverse-data` as the data root and refuse cleanup unless the nested target is verified empty.

### FAIL-013 — Pre-stream exceptions could bypass close

- **What/where:** In both HTTP media routes, `try/finally` began after header metadata access and `flushHeaders()`.
- **When/who:** Found by independent pre-commit review on 2026-07-26; it could affect any request hitting a response-metadata/header exception.
- **Why/how:** The handle was already open, but an exception before entering `try` skipped `media.close()`.
- **What was tried:** Added a result whose `end` metadata getter throws; the RED integration observed zero closes, then the corrected boundary observed one close.
- **Status:** Resolved.
- **One-line solution:** Start ownership `try/finally` immediately after repository open, before every response operation.

### FAIL-014 — Close failure was hidden

- **What/where:** The filesystem repository converted every `FileHandle.close()` rejection into successful `undefined`.
- **When/who:** Found by independent pre-commit review on 2026-07-26; it affected callers and diagnostics if the OS rejected a close.
- **Why/how:** The idempotent promise was created with `.catch(() => undefined)`, prioritizing cleanup convenience over truthful observability.
- **What was tried:** Removed the swallowing catch while retaining a single memoized promise, so repeated callers observe the same success or failure.
- **Status:** Resolved.
- **One-line solution:** Preserve the original memoized close promise and never report a failed resource release as success.

### FAIL-015 — Managed sandbox blocks the Git index

- **What failed:** `git add` and `git commit` could not start because Git could not create its index lock.
- **Where:** `.git/index.lock` in the authoritative Stage 2 project.
- **When:** After G5C-07 implementation, focused checks, and documentation were complete on 2026-07-29.
- **Who was affected:** Only the local commit step in this managed Codex session; the completed working-tree files are intact.
- **Why:** The session grants project-file writes but exposes the repository's `.git` directory as read-only.
- **How reproduced:** The focused `git add` command returned `fatal: Unable to create '.git/index.lock': Permission denied`; `git commit` returned the same failure.
- **What was tried:** One focused stage-and-commit attempt. No retry or permission-debugging loop was performed.
- **Status:** Open environment limitation. G5C-07 is complete but uncommitted.
- **One-line solution:** From normal PowerShell, stage the listed G5C-07 files and run `git commit -m "[wip] feat(web): repair titles callouts media and music"`.

### FAIL-016 — Current-state document contradicts implemented G6 status

- **What failed:** The `Not built` section says transforms, crop, scale, rotation, keyframes, easing, spring/bounce, transitions, and general effects are absent, while later sections in the same document say the shared G6 visual-property model and bounded effects are implemented.
- **Where:** `DOCS/CURRENT_STATE.md`, primarily the `Not built`, `G5-C so far`, and `Known limitations` sections.
- **When:** Detected during the 2026-07-29 competitor-gap and dual-workspace planning inspection.
- **Who was affected:** The owner and future agents using the document to decide what remains.
- **Why:** Completion updates were added later without removing or narrowing the older `Not built` claim.
- **How reproduced:** A targeted read returns both claims in the same file.
- **What was tried:** Confirmed the contradiction against `packages/edit-domain/src/visual-properties.ts` and `packages/edit-domain/src/capabilities.ts`; no cleanup was attempted because the owner requested planning and high-impact work only.
- **Status:** Open documentation defect; it does not establish a runtime defect.
- **One-line solution:** Replace the obsolete bullet with a precise statement that the domain/render foundation exists while professional controls and broader effect coverage remain incomplete.

### FAIL-017 — Older authority documents report pre-G4 status

- **What failed:** `START_HERE.md` and `DOCS/GOALS.md` still describe G4-A through G8 as unimplemented even though the current branch contains and documents those completed technical batches.
- **Where:** The current-gate and status sections of `START_HERE.md` and `DOCS/GOALS.md`.
- **When:** Confirmed before P0-B/P0-C implementation on 2026-07-29.
- **Who was affected:** The owner and any future agent that reads those files without checking current code, `CURRENT_STATE.md`, and `HANDOFF.md`.
- **Why:** Later batches advanced the product without reconciling every older authority document in the same change set.
- **How reproduced:** Reading the files on commit `9f53005` reports G4-A as not started while the branch contains Project v2, intent, caption, timeline, overlay, motion, component and local-alpha code.
- **What was tried:** Branch and code truth were checked; the supplied 1,606-line context was saved; no broad documentation rewrite was attempted in the focused UI task.
- **Status:** Open documentation defect; P0-B/P0-C used current code plus `CURRENT_STATE.md` and `HANDOFF.md` as authority.
- **One-line solution:** Reconcile `START_HERE.md`, `GOALS.md`, and the canonical checklist together in one dedicated documentation-only change.

### FAIL-018 — Vite development WebSocket hostname mismatch

- **What failed:** The browser console reported that Vite's hot-reload WebSocket could not connect, even though the app loaded normally over HTTP.
- **Where:** `http://localhost:2000/@vite/client` while the server advertised `127.0.0.1:2000`.
- **When:** During the P0-B/P0-C real-browser walkthrough on 2026-07-29.
- **Who was affected:** Developers expecting automatic hot reload; the loaded Assist/Studio app and saved project were not blocked.
- **Why:** The browser hostname and the development server WebSocket hostname differ; the exact configuration cause was not investigated in this focused batch.
- **How reproduced:** Reloading `http://localhost:2000/` loaded the new shell, while the browser error log retained one failed WebSocket connection.
- **What was tried:** One reload proved current code was served over HTTP; no HMR configuration debugging was attempted.
- **Status:** Open nonblocking development-only problem.
- **One-line solution:** Configure Vite HMR to use the same public hostname as the page, or use `127.0.0.1:2000` consistently, then verify the WebSocket connects.

## Entry rules

Do not delete a failure because it is fixed. Mark it resolved, link evidence, and preserve what prevented recurrence.
