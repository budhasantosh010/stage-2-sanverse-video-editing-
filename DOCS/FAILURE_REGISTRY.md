# Sanverse Internal Issue and Failure Registry

Record failures that can teach the project, including rejected architectural assumptions and misleading verification.

Use this file for defects, risks, UX problems, performance observations,
environment failures, documentation conflicts, and technical debt. Milestone
tasks stay in `PLAN_CHECKLIST.md`; architecture decisions stay in
`DOCS/decisions/`; proof stays in `DOCS/evidence/`.

Allowed status values are `OPEN`, `INVESTIGATING`, `PLANNED`, `IN_PROGRESS`,
`BLOCKED`, `MONITORING`, `RESOLVED`, `WONT_FIX`, and `DUPLICATE`. Status text is
authoritative. A checked box means `RESOLVED`, `WONT_FIX`, or `DUPLICATE`.

## Active issues

| Done | ID | Severity | Type | One-line issue | Status | Target |
|---|---|---:|---|---|---|---|
| [x] | UX-001 | P1 | UX | Home composer occupies too much vertical space | RESOLVED | P0-D.1 |
| [x] | UX-002 | P1 | UX/A11Y | Disabled Undo, Redo, and Export lack explanations | RESOLVED | P0-D.1 |
| [x] | UX-003 | P1 | UX | Empty proposal state exposes an unusable Accept action | RESOLVED | P0-D.1 |
| [x] | UX-004 | P2 | UX | Add-text control appears before a valid point exists | RESOLVED | P0-D.1 |
| [x] | UX-005 | P1 | UX | Assist side-panel text and hierarchy need owner visual approval | RESOLVED | P0-D.1 |
| [x] | UX-006 | P2 | UX/A11Y | Pending and accepted changes need stronger visual distinction | RESOLVED | P0-D.1 |
| [x] | UX-007 | P1 | UX | P0-E Studio layout required owner approval before P1-A | RESOLVED | P0-E |
| [x] | UX-008 | P1 | UX | Timeline items display technical clip suffixes instead of human-readable media labels | RESOLVED | P1-C |
| [ ] | UX-009 | P2 | UX | Dialogue lane uses a temporary visual pattern until waveform rendering exists | PLANNED | Audio waveform milestone |
| [x] | UX-010 | P1 | UX | Studio video preview collapsed below a usable Canvas height | RESOLVED | P1-D |
| [x] | UX-011 | P2 | UX | Media, Timeline, Canvas, and Inspector use different display names for the same imported asset | RESOLVED | P1-E |
| [x] | FAIL-032 | P1 | React lifecycle | Unstable optional media-name defaults retriggered source probing and caused an infinite Studio render loop | RESOLVED | P1-E |
| [x] | FAIL-033 | P3 | Verification typing | Deferred source-probe test resolver narrowed to `never` during production TypeScript build | RESOLVED | P1-E |
| [x] | UX-012 | P1 | UX gate | P1-D Canvas direct manipulation required owner visual and interaction approval | RESOLVED | P1-D |
| [x] | UX-013 | P1 | UX/Layout | Studio prevents document-level vertical scrolling and clips lower Timeline content | RESOLVED | P1-E.1 |
| [ ] | FEATURE-003 | P2 | Capability gap | No server-authoritative remove-unused-asset action exists | PLANNED | Post-P1-E asset service |
| [x] | FAIL-030 | P1 | Revision authority | Immediate B-roll placement used the stale pre-upload project revision | RESOLVED | P1-D |
| [x] | FAIL-031 | P0 | Preview/export fidelity | FFmpeg crop dimensions were calculated from the target box instead of the actual scaled image | RESOLVED | P1-D |
| [ ] | FAIL-021 | P2 | Performance | 30-second export crossed the 60-second walkthrough budget | MONITORING | E5 benchmark |
| [x] | FAIL-027 | P1 | UX | Sticky visual Apply footer intercepted another Inspector section's Apply button | RESOLVED | P1-C |
| [x] | FAIL-028 | P1 | Product interaction | Pending proposal resolution actions inherited the unrelated timeline-busy state | RESOLVED | P1-C |
| [x] | FAIL-029 | P0 | Preview/export fidelity | FFmpeg applied permanent alpha zero before an entrance fade, hiding written overlays in export | RESOLVED | P1-C |
| [ ] | INFRA-005 | P3 | Verification infrastructure | Windows filesystem contention made broad export lifecycle tests unreliable until HTTP lifecycle and durability concerns were isolated | MONITORING | Windows test stability |
| [x] | FAIL-024 | P2 | Verification debt | Contract files named `.test.ts` contain no Vitest suites, so broad domain/API commands exit 1 after their real assertions pass | RESOLVED | P1-B.1 |
| [x] | FAIL-025 | P2 | API test drift | Two server tests expect old synchronous export statuses while the current API correctly returns asynchronous 202 | RESOLVED | P1-B.1 |
| [x] | FAIL-026 | P2 | Web test drift | Overlay music-gain test enters `-24` through jsdom/user-event but submits `+24` | RESOLVED | P1-B.1 |
| [ ] | FEATURE-001 | P3 | Deferred UX | Optional desktop composer resize preference | PLANNED | Post-P1 |
| [ ] | FEATURE-002 | P2 | Capability gap | Accepted nameplate text cannot be repaired because no set-nameplate operation exists | PLANNED | Capability-gap review after P1-G |
| [x] | INFRA-001 | P3 | Verification infrastructure | In-app viewport screenshots tiled the page texture | RESOLVED | P0-D.1 |
| [x] | INFRA-004 | P3 | Dev-process cleanup | Stopping the Harness dev parent left Sanverse Vite/API children listening on ports 2000/2001 | RESOLVED | P1-B |
| [x] | FAIL-036 | P1 | React continuity | Re-parenting the AI panel between Assist and Studio remounted ChatComposer and cleared unsent text | RESOLVED | P1-F.0.1 |
| [x] | FAIL-037 | P1 | Interaction routing | Selecting a proposed Timeline item forced the AI tab instead of revealing authoritative Inspector actions | RESOLVED | P1-F.0.1 |
| [x] | FAIL-038 | P0 | Layout authority | AI toggle state could say collapsed while Reset left the panel physically expanded | RESOLVED | P1-F.0.2.1 |
| [x] | FAIL-039 | P0 | Responsive layout | Nested Preview and Timeline panels inherited zero-height ancestors at tablet/mobile breakpoints | RESOLVED | P1-F.0.2.1 |

## P1-F.0.1 validation-found issue details

### FAIL-036 — AI panel re-parenting cleared the unsent draft

- **What failed:** Assist and Studio placed the same conversation subtree under different parents. React remounted `ChatComposer`, so an unsent request disappeared even though project and proposal state survived.
- **Resolution:** Keep one permanent right-dock component mounted across both top-level modes. Assist hides Studio dock tabs and exposes the same AI subtree; Studio reveals Tool/AI tabs around it.
- **Evidence:** App continuity test preserves the same textarea value through Assist → Studio → Assist and Edit → Effects → Color → Audio → Edit. Real Edge recorded `workspace draft survives every surface` in every workspace.

### FAIL-037 — proposed Timeline selection hid Inspector resolution actions

- **What failed:** Opening a proposed Timeline item activated the AI tab, while Accept/Reject and repair authority already lived in the Inspector Tool surface.
- **Resolution:** Route `onOpenProposal` to the Tool tab and focus the Inspector region. AI remains available as a separate preserved tab.
- **Evidence:** Studio regression coverage and the final Edge Tool/AI walkthrough pass with one proposal authority and no state duplication.

## P1-F.0 browser-found issue details

### FAIL-034 — empty FFmpeg filter in the primary-motion chain

- **What failed:** Real export failed because the generated graph contained `[motion_video],format=...`; the comma after the input label represented an empty filter.
- **Why tests missed it:** Existing assertions checked individual expressions but did not reject the exact invalid label/comma sequence.
- **Resolution:** Build the post-motion filter list separately, prefix it directly with the input label, and assert the graph contains `[motion_video]format=...` and never `],format=`.
- **Evidence:** Focused renderer tests, exact-project FFmpeg reproduction, and the final Edge export all pass.

### FAIL-035 — unnecessary full-frame work made ordinary zoom/pan impractical

- **What failed:** Zero crop still ran per-pixel GEQ alpha masking and zero rotation still expanded and rotated every frame.
- **Resolution:** Detect constant-zero crop and rotation expressions. Scale/pan-only motion now uses `scale → background → overlay`; crop/rotation retain the full alpha path only when authored.
- **Evidence:** Regression test proves scale/pan graphs omit `geq=` and `rotate=`. The final 30.033-second 1080p export completed in 53.3 seconds.

### UX-014 — false unsupported Canvas message

- **What failed:** The old overlay Canvas layer rendered an unsupported-state message over the new primary-footage controls.
- **Resolution:** Primary video selection renders only `PrimaryFootageCanvasControls`; the generic overlay layer remains authoritative for overlay selections.
- **Evidence:** Studio regression assertion and final Edge screenshots contain the real footage controls without the false message.

## Gate T3 validation-found issue details

### FAIL-055 — precision timing ceiling lost its track-bound constant

- **What failed:** the in-progress T3 branch defined `MAX_PRECISION_TIMING_CHANGES = MAX_CLIPS_PER_TRACK`, but an earlier partial edit had removed the single `MAX_CLIPS_PER_TRACK` declaration (and one repair attempt briefly duplicated it). The web/domain typecheck therefore could not compile the precision operation ceiling.
- **Why it mattered:** a 60-minute primary sequence must remain bounded by the same 512-piece track ceiling; replacing the missing symbol with an unrelated magic number would have created two limits that could drift.
- **Resolution:** restore one exported `MAX_CLIPS_PER_TRACK = 512` authority and derive `MAX_PRECISION_TIMING_CHANGES` from it. Keep the 60-minute/250-clip stress test as evidence that precision planning remains within the current track bound.
- **Evidence:** edit-domain/web builds pass, focused T3 long-form suite passes, final repository gate is 2,345/2,345, and all-workspace production build passes.

No unresolved T3 P0/P1 blocker remains. Browser automation limitations encountered during evidence collection (controlled-input driving, temporary Edge extension tabs, and private API hot reload resetting the disposable evidence project) were verification-harness issues, not accepted-project defects; they are recorded in T3 browser evidence rather than misclassified as product failures.

## Gate T4 validation-found issue details

### FAIL-056 — easing overshoot could leave the valid visual render domain between valid keyframes

- **What failed:** the shared Editor evaluator correctly bounded authored endpoint values but Spring/Custom-Bezier interpolation could mathematically overshoot between them, allowing evaluated opacity, scale or opposing crop values to leave the same numeric domain the operation validator requires.
- **Why it mattered:** T4 makes extreme easing directly editable in the Graph. Valid canonical keyframes must never produce invalid intermediate Preview/export state, and Preview and FFmpeg must not invent separate clamps.
- **Resolution:** keep canonical authored keyframes unchanged, but clamp only the shared evaluated render state to the existing visual-property limits; normalize opposing crop edges below a combined width/height of 1. Both Preview and export already consume this evaluator.
- **Evidence:** focused evaluator tests prove raw easing can overshoot while evaluated opacity/scale/crop remain safe; final repository gate is 2,419/2,419; real revision-7 Graph/Bezier export succeeds and decoded frames are valid.

No unresolved T4 P0/P1 blocker remains. The first broad regression sweep also found two mistakes in the newly written T4 long-form test harness (an off-window diamond query and a jsdom-only missing `URL.createObjectURL` spy target); both were corrected without production changes. Four `ERR_ABORTED` requests in final browser reporting were canceled by the deliberate forced reload and had no HTTP error response.

## Legacy risk and failure summary

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
| FAIL-019 | 2026-07-29 | Upstream audit network | Shell Git was forced through unreachable `127.0.0.1:9`, so six read-only `git ls-remote` probes failed | Managed; audit completed through GitHub connector | Use connector or approved unrestricted Git; do not retry dead proxy |

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

### FAIL-019 — Shell Git could not reach upstream repositories

- **What failed:** Six read-only `git ls-remote` requests could not reach
  GitHub.
- **Where:** P0-R probes for OpenCut, OpenCut Classic, OpenTimelineIO, MLT,
  Kdenlive, and Natron.
- **When:** During P0-R upstream pinning on 2026-07-29.
- **Who was affected:** This audit path only; Sanverse runtime was unaffected.
- **Why/how:** The shell Git HTTPS path attempted unreachable
  `127.0.0.1:9`; every probe returned the same connection failure.
- **What was tried:** One bounded six-repository probe; no retries or proxy
  debugging. GitHub connector then returned exact commits, files, and licenses.
- **Evidence:** `DOCS/decisions/P0-R_OPENCUT_TIMELINE_REUSE_DECISION.md`.
- **Blocking:** No.
- **Status:** Managed; connector completed the audit.
- **One-line solution:** Use the GitHub connector or approved unrestricted Git
  instead of retrying the dead shell proxy.

### FAIL-020 — P0-D baseline Studio tests encoded browser assumptions

- **What failed:** Two existing Studio tests failed before P0-D behavior was evaluated: one expected collapsed `<details>` content to be absent from the DOM, and one typed `-6` into a number input in a way that jsdom reduced to `6`.
- **Where:** `apps/web/src/screens/studio/StudioScreen.test.tsx`.
- **When:** During the focused P0-D baseline and regression run on 2026-07-29.
- **Who was affected:** The test harness only; the corresponding browser controls remained usable.
- **Why:** Native `<details>` keeps collapsed descendants in the DOM but hidden, and `userEvent.type()` cannot represent the transient minus-only state of a number input reliably in jsdom.
- **How reproduced:** The baseline focused suite returned 54 passes and these two failures.
- **What was tried:** The assertions were corrected to test visibility and to dispatch the final numeric value; the final focused P0-D suite then passed 67/67.
- **Evidence:** `DOCS/evidence/2026-07-29-p0d-assist/P0-D_IMPLEMENTATION_REPORT.md`.
- **Blocking:** No; resolved before commit.
- **One-line solution:** Assert collapsed native controls by visibility and set signed number-input values atomically in jsdom.
- **Status:** Resolved.

### FAIL-021 — Real 30-second export crossed the 60-second walkthrough wait

- **What failed:** The browser harness timed out while waiting 60 seconds for the Download MP4 action.
- **Where:** Local P0-D walkthrough of `test-30s.mp4` through the API export path.
- **When:** After Accept, Undo, and Redo on 2026-07-29.
- **Who was affected:** A user waiting for this local export; project state and the accepted edit remained safe.
- **Why:** Local FFmpeg render and verification took slightly longer than the walkthrough's 60-second wait budget.
- **How reproduced:** The wait timed out once; the immediately following state read showed `Export ready`, `1920 × 1080 · 30s`, and `Download MP4`.
- **What was tried:** No renderer or performance work was attempted because it is outside P0-D. The download event was then verified and returned an MP4 filename and media URL.
- **Evidence:** `DOCS/evidence/2026-07-29-p0d-assist/P0-D_IMPLEMENTATION_REPORT.md`.
- **Blocking:** No; the valid result and download completed.
- **One-line solution:** Establish the later E5 export-time budget, measure repeated runs, then optimize only if the agreed budget is missed.
- **Status:** Open performance observation; nonblocking for P0-D.

### FAIL-022 — Managed process sandbox blocked the first screenshot browser launch

- **What failed:** Playwright could not spawn its bundled or system Chromium process directly (`spawn EPERM`), and the first Edge attempt split the spaced profile path into multiple targets.
- **Where:** The managed Codex browser-evidence harness, outside Sanverse runtime code.
- **When:** During P0-D responsive screenshot capture on 2026-07-29.
- **Who was affected:** Automated evidence capture only; the already running app and in-app browser were unaffected.
- **Why:** The managed process sandbox blocks direct child-process launch, and PowerShell `Start-Process` requires explicit quoting for an argument containing a spaced path.
- **How reproduced:** Direct Playwright launch returned `spawn EPERM`; the first Edge log returned `Multiple targets are not supported in headless mode`.
- **What was tried:** One direct Chrome attempt and one malformed Edge attempt; a quoted, hidden Edge CDP launch succeeded.
- **Evidence:** Exact-size screenshots in `DOCS/evidence/2026-07-29-p0d-assist/`.
- **Blocking:** No; resolved without product changes.
- **One-line solution:** Launch the approved hidden system browser with a quoted profile path and connect Playwright over local CDP.
- **Status:** Resolved environment limitation.

### FAIL-023 — Conversation failure was announced twice

- **What failed:** A single assistant request failure produced two identical accessibility alerts.
- **Where:** `ChatComposer` and `AssistProposalPanel` inside the same mounted `StudioScreen`.
- **When:** Found by the independent P0-D pre-commit review on 2026-07-29.
- **Who was affected:** Screen-reader users would hear repeated interruption; sighted users would see duplicate failure copy.
- **Why:** Both the composer and the proposal panel rendered `conversation.notice`, although the composer already owns conversation status.
- **How reproduced:** Rendered `StudioScreen` with `conversation.status = "error"` and found two `role="alert"` nodes.
- **What was tried:** Removed conversation-error rendering from the proposal panel, kept proposal/edit errors there, and added an integrated one-alert regression test.
- **Evidence:** Final focused suite passed 67/67.
- **Blocking:** It was milestone-invalidating for accessible core feedback and was fixed before commit.
- **One-line solution:** Give each error domain one announcement owner: conversation errors in `ChatComposer`, proposal/edit errors in `AssistProposalPanel`.
- **Status:** Resolved.

### FAIL-024 — Empty contract files make broad Vitest commands exit 1

- **What failed:** Full edit-domain and API test commands exit 1 even after their executable assertions pass because three files named `*.test.ts` contain contracts but no Vitest suite.
- **Where:** `motion-fidelity.contract.test.ts`, `local-export-job-store.contract.test.ts`, and `portable-project.contract.test.ts`.
- **When:** P1-B final broad verification on 2026-07-30.
- **Who was affected:** Developers and CI interpretation; no runtime user path failed.
- **Why:** Vitest collects the filenames as test modules and treats “No test suite found” as failure.
- **How reproduced:** Full edit-domain produced 263 passing assertions then exited 1; full API produced 228 passing assertions plus the two empty-suite collection failures.
- **What was tried:** Focused affected suites were run explicitly and passed. The files were not changed because that is unrelated test-contract maintenance.
- **Previous status:** OPEN; nonblocking for P1-B's focused/affected acceptance gate.
- **Resolution:** The three files were genuine executable contracts, so their existing Node assertions were preserved and their runner import was changed from `node:test` to Vitest. No fake empty tests and no runtime code were added.
- **Evidence:** Full edit-domain passes 23 files/265 tests; full API passes 20 files/233 tests; the three converted contract files pass directly. See `DOCS/evidence/2026-07-30-p1b1-test-truth/` and the focused P1-B.1 completion commit.
- **Status:** RESOLVED in P1-B.1.
- **One-line solution:** Collect real executable contracts with the repository's actual test runner instead of hiding or weakening them.

### FAIL-025 — Export API tests expect obsolete synchronous statuses

- **What failed:** Two API server tests expect 201 and 503, while the current durable export-job route correctly accepts work asynchronously with 202.
- **Where:** Two export assertions in `apps/api/src/server.test.ts`.
- **When:** P1-B final broad verification on 2026-07-30.
- **Who was affected:** Test-suite truthfulness; the real browser export completed, verified, and downloaded normally.
- **Why:** The tests were not advanced when export moved to the asynchronous job contract.
- **How reproduced:** Full API run returned 202 in both assertions. Stopping the real dev server and rerunning produced the same result, ruling out browser-run interference.
- **What was tried:** No API change was made because P1-B touches no API behavior. Real Edge export plus downloaded MP4 probe supplied product evidence.
- **Previous status:** OPEN; unrelated to P1-B.
- **Resolution:** The tests now assert `202 Accepted`, the safe queued public-job body, deterministic job polling through `GET /export-jobs/:jobId`, successful result/download metadata, and the terminal failed state with the safe `RENDER_PROCESS_BLOCKED` error. The production route and job implementation were not changed.
- **Evidence:** Full API passes 20 files/233 tests, including both asynchronous lifecycle cases; the all-workspace build and P1-B bundle remain unchanged. See `DOCS/evidence/2026-07-30-p1b1-test-truth/` and the focused P1-B.1 completion commit.
- **Status:** RESOLVED in P1-B.1.
- **One-line solution:** Test the complete 202 → poll → terminal job contract instead of asserting the removed synchronous response.

### FAIL-026 — Signed music-gain test submits the wrong sign in jsdom

- **What failed:** The overlay-repair test expects `gainDb: -24`, but its user-event number-input sequence submits `gainDb: 24`.
- **Where:** `apps/web/src/features/overlays/OverlayRepairPanel.test.tsx`.
- **When:** P1-B full web verification on 2026-07-30.
- **Who was affected:** One unrelated web test; Timeline V1 does not modify the component.
- **Why:** The current jsdom/user-event signed-number input sequence loses the minus sign, the same class of issue previously recorded in FAIL-020.
- **How reproduced:** Full web reported 324 passing and one failure; rerunning only this file reproduced 1 pass/1 failure with `+24` received.
- **What was tried:** The failure was isolated and recorded. No overlay behavior or test was changed inside P1-B.
- **Previous status:** OPEN; unrelated to P1-B.
- **Resolution:** The test now sends the complete `-24` value in one change event, verifies the controlled input displays `-24`, submits, and proves the callback receives `gainDb: -24`. Product code was not changed.
- **Evidence:** The focused overlay suite passes 2/2 and the full web suite passes 34 files/332 tests. See `DOCS/evidence/2026-07-30-p1b1-test-truth/` and the focused P1-B.1 completion commit.
- **Status:** RESOLVED in P1-B.1.
- **One-line solution:** Set signed numeric values atomically in jsdom, verify the displayed value, then assert the submitted domain value.

### UX-008 — Timeline labels expose technical clip suffixes

- **What:** Split video and dialogue items use labels such as `Clip ec623c` and `Dialogue ec623c`, which expose internal identity instead of recognizable media names.
- **Where:** Timeline V1 item-label derivation and the contextual Inspector header.
- **When:** Confirmed at the P1-C baseline on 2026-07-30.
- **Who is affected:** Non-editors trying to understand what the selected item represents.
- **Why:** P1-B used stable clip-ID suffixes as a temporary disambiguator before a contextual Inspector existed.
- **How reproduced:** Split one source clip and inspect V1/A1 labels.
- **Attempted fix:** P1-C accepts a derived asset-display-label map, keeps stable item IDs internal, and falls back to `Video 1`, `Dialogue · Video 1`, and media-kind names when no filename is available.
- **Status:** RESOLVED. Focused tests and real Edge screenshots prove the final Timeline and Inspector labels without exposing clip suffixes.
- **One-line solution:** Keep identity in stable IDs while presenting the source filename or a plain media-family label.
- **Severity:** P1.
- **Owner:** Web editor.
- **Target:** P1-C.

### UX-009 — Dialogue lane has no waveform yet

- **What:** A1 dialogue previously mirrored clip timing with a temporary visual pattern rather than a rendered waveform.
- **Where:** Production Timeline dialogue/audio lanes.
- **When:** Carried into P1-C on 2026-07-30; waveform rendering landed in Gate D and channel-presentation truth closed in Gate T5 on 2026-08-10.
- **Who was affected:** Users judging speech intensity visually.
- **Why:** Waveform generation, caching and rendering were deliberately separated from P1-B/P1-C; T5 additionally required real channel identity rather than a fake stereo split.
- **How verified:** Gate D real derived-media evidence plus T5 Combined/Separate L/R tests and real Edge persistence/export evidence.
- **Attempted fix:** Gate D added bounded FFmpeg-derived waveforms; T5 added FFprobe channel truth, stable per-track presentation preferences and Combined fallback for unsupported layouts.
- **Status:** RESOLVED.
- **One-line solution:** Implemented real derived waveform assets and truthful per-track channel presentation.
- **Severity:** P2.
- **Owner:** Media/render pipeline.
- **Closed by:** Gate D / Gate T5.

### UX-010 — Studio video preview collapses below a usable Canvas height

- **What:** The Studio preview becomes a shallow horizontal strip at common desktop sizes, leaving too little visible footage for Canvas move, resize, rotation, crop, or Point placement.
- **Where:** `apps/web/src/screens/studio/StudioScreen.css`, the Studio two-row editor grid, video frame, video surface, and video element sizing contract.
- **When:** Reproduced during P1-D continuation on 2026-07-31.
- **Who is affected:** Anyone directly manipulating a visual object in Studio, especially at 1440×900 and 1280×800.
- **Why:** The desktop grid reserved at least 390px for the Timeline while its first row used `minmax(0, 1fr)`. Inside that shrinking row, the video surface and video both used unresolved `height: 100%`. At 1280×800 the stage fell to 158px and the real 16:9 footage to 245×138; at 1024×768 the same percentage-height chain instead let intrinsic width produce an oversized 532px preview.
- **Reproduction:** Open `test-30s.mp4`, switch to Studio, and inspect computed rectangles. Before repair: 1440×900 stage 814×243 with visible footage 396×223; 1280×800 stage 654×158 with visible footage 245×138.
- **Attempted fix:** Replaced the circular percentage-height chain with a bounded stage, reduced the desktop Timeline reservation, retained `object-fit: contain`, and kept Studio's existing video `ResizeObserver` as the sole geometry observer.
- **Final solution:** Studio now uses a responsive bounded stage and computes one exact contained-footage rectangle that serves browser overlays, Point mode, Canvas bounds, guides, hit targets, and crop controls.
- **Acceptance tests:** Pure landscape/portrait/square/ultrawide geometry, strict unknown-metadata capture refusal, CSS contracts, real Edge at 1440×900, 1280×800, 1024×768, and 390×844, one-video assertion, Canvas/Point alignment, native-control hit testing, and no horizontal overflow.
- **Evidence:** `DOCS/evidence/2026-07-31-p1d-canvas-manipulation-v1/`; real stage heights are 342px, 280px, about 292px, and 280px at the four required viewports.
- **Commit:** P1-D completion commit.
- **Status:** RESOLVED.
- **One-line solution:** Give Studio one bounded responsive video stage and derive Canvas/Point geometry from the exact contained-footage rectangle.
- **Severity:** P1.
- **Owner:** Web editor.
- **Target:** P1-D.

### UX-012 — P1-D Canvas owner visual and interaction approval

- **What:** P1-D remained technically complete but its final visual and interaction gate required the owner's decision.
- **Where:** P1-D Canvas Direct Manipulation V1 evidence and project authority documents.
- **When:** The owner approved P1-D by supplying the P1-E implementation contract and instructing implementation to begin on 2026-07-31.
- **Who was affected:** The owner and future agents deciding whether P1-E was authorized.
- **Why:** Browser evidence can prove behavior, but the product owner must decide whether the direct-manipulation experience is acceptable.
- **How verified:** P1-D completion commit `b79d6fd21b4aff9d162a4e5f29a569a1298cf870` was clean, pushed, and named as the required P1-E start point by the owner.
- **What was tried:** No additional product change was needed; the explicit owner decision closed the human gate.
- **Status:** RESOLVED.
- **One-line solution:** Record the owner's explicit P1-D approval and use its verified commit as the P1-E baseline.
- **Severity:** P1.
- **Owner:** Product owner.
- **Target:** P1-D.
- **Evidence:** `DOCS/evidence/2026-07-31-p1e-media-bin-v1/P1-D_OWNER_APPROVAL.md`.

### UX-013 — Studio prevents document-level vertical scrolling

- **What:** The complete Studio workspace was forced into one viewport-height grid, so the lower Timeline lanes and controls were clipped or compressed instead of contributing to ordinary page height.
- **Where:** `.editor-shell .studio-screen--studio` in `apps/web/src/screens/studio/StudioScreen.css`, together with the document/root overflow contract in `apps/web/src/styles/global.css`.
- **When:** Reproduced during the P1-E owner visual correction at laptop-height desktop viewports on 2026-08-01.
- **Who was affected:** Laptop users, keyboard users reaching lower controls, users opening long Media/Inspector content, and future motion/keyframe workflows.
- **Why:** `height: calc(100vh - 64px)`, fixed grid rows, and `overflow: hidden` made the editor itself exactly viewport-sized. Its lower content could not extend the document, so the browser had no vertical scroll range.
- **How reproduced:** Open Studio at 1440×900 or 1280×800 and inspect `document.documentElement.scrollHeight`; the fixed editor height contains the upper workspace and Timeline while clipping the lower region.
- **What was tried:** The layout authority was traced from `html/body/#root` through EditorShell and Studio before changing overflow; random nested overflow rules were rejected.
- **One-line solution:** Give the browser document one vertical-scroll authority, let Studio use natural height and normal-flow rows, retain bounded panel scrolling, and refresh the existing client-space geometry controller passively on document scroll.
- **Status:** RESOLVED on 2026-08-01. Real Edge proved document scrolling, full Timeline reachability, unchanged playhead/selection/zoom/horizontal scroll, Canvas and Point alignment after scrolling, playback continuity, one video, five lanes, zero horizontal overflow, and listener cleanup at all four required viewports.
- **Severity:** P1.
- **Owner:** Web editor.
- **Target:** P1-E.1.
- **Evidence:** `DOCS/evidence/2026-08-01-p1e1-studio-vertical-flow/`.

### UX-011 — Media panel and Timeline label the same image differently

- **What:** After importing one image behind the main video, Media and editor surfaces could show different ordinal names for the same asset identity.
- **Where:** Media-card label derivation versus Timeline/Canvas/Inspector asset-label derivation.
- **When:** Found during the final P1-D Edge walkthrough and closed in P1-E on 2026-07-31.
- **Who was affected:** Users matching an imported asset across Media, Timeline, Canvas, and Inspector.
- **Why:** Each surface counted or formatted assets independently instead of consuming one label authority.
- **Reproduction:** Open one video, import one image, then compare its Media card, V2 Timeline item, Canvas move control, and Inspector heading.
- **What was tried:** P1-D documented the mismatch without patching separate components. P1-E extracted one pure `deriveAssetDisplayLabels` map and passed it to every surface.
- **Final solution:** Media, Timeline, Canvas, and Inspector now consume the same deterministic label map, including safe filenames, family fallbacks, and duplicate disambiguation.
- **Acceptance tests:** `media-display-labels.test.ts`; `StudioMediaBinIntegration.test.tsx`; full web 473/473.
- **Browser proof:** `browser-report.json` records `hero-frame.png` on all four surfaces; `screenshots/image-added-to-timeline-1440x900.png` visibly shows the shared name.
- **Evidence:** `DOCS/evidence/2026-07-31-p1e-media-bin-v1/media-label-authority.md`.
- **Commit:** P1-E completion commit.
- **One-line solution:** Feed every visible asset name from one pure display-label authority.
- **Severity:** P2.
- **Owner:** Web editor.
- **Target:** P1-E.
- **Status:** RESOLVED.

### FAIL-032 — Unstable optional media-name default caused an infinite Studio render loop

- **What:** The final web suite stopped after most files because `StudioCanvasIntegration.test.tsx` consumed CPU indefinitely instead of finishing.
- **Where:** `apps/web/src/screens/studio/StudioScreen.tsx`, optional `assetOriginalNames` default and media-source probe effect.
- **When:** P1-E closure verification on 2026-07-31.
- **Who was affected:** Tests and any caller omitting the optional upload-name map while Studio remained mounted.
- **Why:** The parameter default created a fresh `{}` on every render. That changed `mediaSourceEntries`, retriggered the source-probe effect, and scheduled another `mediaSourceStatuses` state update. The loop repeated even when no probe adapter existed.
- **How reproduced:** Run `StudioCanvasIntegration.test.tsx` alone or the full web suite after P1-E source probing; the worker remains CPU-bound and writes no terminal result.
- **What was tried:** Duplicate Vitest roots were removed and the suite was serialized, which isolated the hang to one file but did not solve it.
- **Final solution:** Use one frozen module-level empty original-name map and make the no-probe effect return without scheduling state.
- **Acceptance tests:** Formerly hanging Canvas integration 4/4; affected Canvas/Media integration 9/9; normal full web suite 55 files and 473/473 tests.
- **One-line solution:** Stable optional collection defaults must not create new effect dependencies on every render.
- **Severity:** P1.
- **Owner:** Web Studio lifecycle.
- **Target:** P1-E.
- **Status:** RESOLVED.

### FAIL-033 — Deferred source-probe test resolver narrowed to never during build

- **What:** All runtime tests passed, but the all-workspace TypeScript build failed because a test-local deferred resolver was inferred as non-callable.
- **Where:** `apps/web/src/screens/studio/StudioMediaBinIntegration.test.tsx`.
- **When:** First P1-E final production build on 2026-07-31.
- **Who was affected:** Repository build verification only; production code did not fail.
- **Why:** TypeScript control-flow narrowing could not prove that the promise constructor had assigned the nullable resolver before the later call.
- **How reproduced:** Run `npm run build`; TypeScript reports `TS2349` at the resolver call.
- **What was tried:** The focused runtime test already passed, confirming behavior. The fixture was then changed to an explicit typed deferred helper.
- **Final solution:** Use an explicitly typed deferred promise object whose resolver exists by construction.
- **Acceptance tests:** Affected integration tests 9/9 and the complete all-workspace build pass; all six gates were rerun afterward.
- **One-line solution:** Represent deferred test promises with an explicit typed helper instead of nullable closure assignment.
- **Severity:** P3.
- **Owner:** Web verification.
- **Target:** P1-E.
- **Status:** RESOLVED.

### FAIL-030 — Immediate B-roll placement used a stale project revision

- **What:** Uploading an additional asset succeeded, but the immediately following `add-media-overlay` change set was rejected, so no B-roll appeared on the Timeline.
- **Where:** `apps/web/src/app/App.tsx`, between `uploadProjectAsset` and `onCreateOverlay`.
- **When:** Real P1-D Edge workflow on 2026-07-31.
- **Who is affected:** Users importing B-roll or an image and expecting it to appear immediately.
- **Why:** Asset intake advanced the server project revision, but React's state update had not rendered before the overlay callback closed over the previous revision.
- **Reproduction:** Import an extra media file through Add overlay and inspect the server project: the asset revision exists but the overlay operation is absent.
- **Attempted fix:** Traced the upload response and rejected change set, then introduced one latest-authoritative-project ref updated synchronously from both upload and accepted change-set responses.
- **Final solution:** Immediate placement now builds against the revision returned by asset intake; the server remains authoritative and stale revisions remain rejected.
- **Acceptance tests:** App regression proves upload revision 1 becomes the overlay's base revision and final revision 2; the real Edge workflow imports, places, moves, resizes, crops, and exports the image.
- **Evidence:** `DOCS/evidence/2026-07-31-p1d-canvas-manipulation-v1/`.
- **Commit:** P1-D completion commit.
- **One-line solution:** Build the immediate post-upload edit from the exact project revision returned by the upload response.
- **Severity:** P1.
- **Owner:** Web/App authority boundary.
- **Target:** P1-D.
- **Status:** RESOLVED.

### FAIL-031 — FFmpeg crop used the planned box instead of the actual scaled image

- **What:** Preview crop worked, but the final export failed with an invalid FFmpeg crop size.
- **Where:** `apps/api/src/render/ffmpeg-render-adapter.ts`, media-overlay visual filters.
- **When:** Final P1-D real export on 2026-07-31.
- **Who is affected:** Users exporting a contained image or B-roll after Canvas crop.
- **Why:** Contain scaling and yuv420p rounding produced an actual 806×452 image, while crop arithmetic still requested the planned 454px box height.
- **Reproduction:** Crop the imported image about 12.6% from the left and export; FFmpeg reports crop height 454 exceeds input height 452.
- **Attempted fix:** Reproduced the exact revision through a logging render adapter and inspected the generated filter graph and FFmpeg error.
- **Final solution:** Crop width, height, and offsets are now expressions based on FFmpeg's actual current `iw` and `ih`, rounded to valid even dimensions.
- **Acceptance tests:** Filter-graph regression 33/33, exact revision render, fresh Edge export/download, H.264/AAC probe, and extracted crop frame inspection.
- **Evidence:** `DOCS/evidence/2026-07-31-p1d-canvas-manipulation-v1/preview-export-parity.md` and `export-frames/03-cropped-image.png`.
- **Commit:** P1-D completion commit.
- **One-line solution:** Derive crop pixels from FFmpeg's actual post-scale `iw`/`ih`, never from the pre-scale target box.
- **Severity:** P0.
- **Owner:** Render adapter.
- **Target:** P1-D.
- **Status:** RESOLVED.

### FEATURE-003 — No server-authoritative remove-unused-asset action

- **What:** P1-E can identify unused assets, but the current domain/API has no safe operation or route that removes one project asset.
- **Where:** Edit-domain asset operations, App project adapters, and API project-asset routes.
- **When:** Confirmed during the P1-E AQ-1 preflight on 2026-07-31.
- **Who is affected:** Users who import media they later decide not to use.
- **Why:** Asset upload exists, but removal was deliberately not modeled; deleting only frontend state would create a second false project authority and deleting the user's source file would be unsafe.
- **How reproduced:** Search current capabilities, operations, App adapters, and API routes for a remove-unused-asset contract; none exists.
- **What was tried:** P1-E computes usage once, disables Remove for used assets, and also disables it for unused assets with a plain explanation that the source remains safe.
- **Status:** PLANNED. It does not block Media Bin search, selection, import, placement, Undo/Redo, preview, or export.
- **One-line solution:** Add a server-authoritative remove-unused-asset service that refuses any asset with accepted project references and never deletes the user's original source file.
- **Severity:** P2.
- **Owner:** Edit domain and project asset service.
- **Target:** Post-P1-E asset service.

### FEATURE-002 — Accepted nameplate text has no repair operation

- **What:** An accepted nameplate has editable visual properties but its primary and secondary text cannot be changed through an existing typed repair operation.
- **Where:** `add-nameplate` capability and P1-C Nameplate Inspector.
- **When:** Confirmed during the P1-C domain-contract review on 2026-07-30.
- **Who is affected:** Users who notice a name or role typo after accepting the nameplate.
- **Why:** The executable operation set contains `add-nameplate` and `set-visual-properties`, but deliberately has no `set-nameplate` operation.
- **How reproduced:** Accept a nameplate and inspect the available operation kinds.
- **Attempted fix:** P1-C keeps accepted text read-only and explains the limitation; it does not mutate the original add operation or invent a browser-only value.
- **Status:** PLANNED.
- **One-line solution:** Design and approve a dedicated full-state nameplate repair operation during the post-P1-G capability-gap review.
- **Severity:** P2.
- **Owner:** Edit domain/capability review.
- **Target:** Capability-gap review after P1-G.

### FAIL-027 — Visual Apply footer intercepted another section's Apply

- **What:** The sticky visual-properties footer covered the Title section Apply button inside the 220-pixel desktop Inspector.
- **Where:** `apps/web/src/editor/inspector/Inspector.css`.
- **When:** Real Edge P1-C walkthrough on 2026-07-31.
- **Why:** The footer used sticky positioning, z-index, and a negative edge offset inside the same short scroll surface as other section actions.
- **Resolution:** The visual Apply footer now participates in normal document flow. A visual-contract test forbids sticky/fixed positioning, z-index, and negative margin on that footer.
- **Status:** RESOLVED.
- **One-line solution:** Never overlay one Inspector section's action controls on another section.

### FAIL-028 — Proposal resolution actions inherited unrelated timeline busy state

- **What:** Selecting a pending proposal opened the correct Inspector state, but Accept and Reject were disabled.
- **Where:** Studio-to-Inspector busy-state wiring.
- **When:** Real Edge P1-C walkthrough on 2026-07-31.
- **Why:** `timelineBusy` included the existence of a proposal, which is correct for unrelated direct edits but incorrect for the actions required to resolve that proposal.
- **Resolution:** Proposal-action busy state is separate and is true only while rendering. A Studio regression proves Reject remains enabled while unrelated timeline edits are paused.
- **Status:** RESOLVED.
- **One-line solution:** Pause conflicting edits without disabling the only controls that can resolve the pending proposal.

### FAIL-029 — Entrance fade produced permanent alpha zero in export

- **What:** Preview showed the repaired title, but the first exported frames contained no title during its entire interval.
- **Where:** `apps/api/src/render/ffmpeg-render-adapter.ts` written-overlay visual filters.
- **When:** Export-frame inspection during P1-C on 2026-07-31.
- **Why:** The shared evaluator was called at relative time zero with the entrance fade active, producing opacity zero. FFmpeg then wrote permanent alpha zero before applying its own frame-timed fade, so no pixels remained to reveal.
- **Resolution:** Base visual evaluation neutralizes enter/exit transitions; FFmpeg applies the transition once as a frame-timed filter. A red/green filter-graph test and fresh real export prove the title fades in and remains visible.
- **Status:** RESOLVED.
- **One-line solution:** Evaluate authored base appearance without transitions when the renderer applies those transitions separately.

### INFRA-005 — Filesystem export-job tests contend under full Windows load

- **What:** Export lifecycle tests intermittently stayed `running`, failed before attempt 1 with `EPERM`, or observed the wrong terminal result under the full parallel API suite, while each lifecycle passed alone.
- **Where:** `apps/api/src/server.test.ts` when API lifecycle tests used the real filesystem job store; durability itself remains covered by `local-export-job-store.contract.test.ts`.
- **When:** First observed in P1-C and reproduced repeatedly during P1-D final verification on 2026-07-31.
- **Who is affected:** Repository verification on Windows; the final real browser export completed successfully.
- **Why:** Several parallel tests performed atomic job-file replacement and cleanup while Windows still held short-lived filesystem handles.
- **Reproduction:** Run the full API suite repeatedly with filesystem-backed job storage in server lifecycle tests; run the same test alone and it passes.
- **Attempted fix:** Stopped live dev listeners, reran focused and full suites, then separated concerns instead of increasing sleeps.
- **Final solution:** Server lifecycle tests inject a deterministic in-memory job store; the dedicated filesystem contract still tests real durable storage. Production job storage is unchanged.
- **Acceptance tests:** Focused server 14/14 and full API 235/235 pass; real Edge export/download also passes.
- **Evidence:** P1-D `test-results.md` and browser report.
- **Status:** MONITORING for Windows production-store contention; the broad test-isolation failure is resolved.
- **One-line solution:** Test HTTP lifecycle with an in-memory store and test filesystem durability separately in its dedicated contract suite.

### INFRA-004 — Dev parent stopped but Vite/API children kept ports open

- **What failed:** A later `npm run dev` launch returned `EADDRINUSE` for ports 2000 and 2001 after the Harness parent process had been stopped.
- **Where:** P1-B visual-QA process cleanup on Windows.
- **When:** 2026-07-30.
- **Who was affected:** Local verification only.
- **Why:** The orchestrator parent exited while its two Node children remained listening.
- **How reproduced:** `Get-NetTCPConnection` found PIDs 18640/22336; command-line inspection proved they were this workspace's Vite and API processes.
- **What was tried:** Only those two proven Sanverse child PIDs were stopped, then the app relaunched normally.
- **Status:** RESOLVED.
- **One-line solution:** Inspect port owners and stop only verified workspace child processes when the parent does not propagate termination.

## UX-001 — Home composer occupies too much vertical space

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P1
- **Type:** UX
- **Found:** 2026-07-29
- **Target milestone:** P0-D.1
- **Owner:** Codex
- **One-line issue:** The new-project composer pushed useful context below the fold and felt disproportionate to its job.

### What?

The initial prompt, card, upload row, and intro spacing occupied too much height.

### Where?

`HomeScreen.tsx` and `HomeScreen.css` at 1440×900, 1280×800, and 1024×768.

### When?

Immediately after opening Home before selecting a video.

### Who is affected?

Every user starting or reopening a project, especially on laptop displays.

### Why does it matter?

The first screen should explain one action without visually overwhelming a non-editor.

### How is it reproduced?

Open Home at the starting commit and compare the five-row composer with the final three-row layout.

### Root cause

`rows={5}`, 136px prompt height, 30px card padding, 104px upload row, and oversized intro spacing accumulated.

### What was tried?

The values were reduced as one coherent layout correction; the focused Home tests and three responsive browser sizes passed.

### Proposed solution

Use a three-row prompt, 88px initial height, 24px card padding, 64px upload row, and reduced intro spacing.

### One-line solution

Make the Home composer compact enough to explain one action without dominating the page.

### Acceptance tests

Three-row controlled prompt; exact responsive screenshots; no horizontal overflow.

### Evidence

- Test: `HomeScreen.test.tsx`; focused P0-D.1 suite 78/78.
- Screenshot: `DOCS/evidence/2026-07-29-p0d1-visual-corrections/home-before-1440x900.png` and `home-after-*.png`.
- Walkthrough: `browser-walkthrough.md`.
- Commit: focused P0-D.1 commit.
- Decision: `P0-D1_IMPLEMENTATION_REPORT.md`.

### Resolution

Resolved with the bounded Home layout correction.

### Current status

RESOLVED; owner comparison remains available in the evidence folder.

## UX-002 — Disabled global actions lacked explanations

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P1
- **Type:** UX/A11Y
- **Found:** 2026-07-29
- **Target milestone:** P0-D.1
- **Owner:** Codex
- **One-line issue:** Disabled Undo, Redo, and Export controls did not explain what prerequisite was missing.

### What?

Native disabled controls communicated unavailability but not the reason or recovery action.

### Where?

`App.tsx`, `EditorShell.tsx`, and the new `DisabledAction.tsx`.

### When?

With no accepted edit, with a pending proposal, or while export is rendering.

### Who is affected?

Keyboard, screen-reader, and sighted users deciding what to do next.

### Why does it matter?

An unexplained disabled primary action looks broken and creates avoidable guessing.

### How is it reproduced?

Open a clean project and inspect Undo, Redo, and Export before any proposal or accepted edit.

### Root cause

The shell received booleans only, so domain-specific disabled reasons were discarded.

### What was tried?

Reason derivation was centralized in `App`; a small focusable wrapper exposes exact descriptions while the real button remains disabled.

### Proposed solution

Pass nullable reason strings as the single authority for action availability.

### One-line solution

Keep real actions disabled while making the exact prerequisite keyboard and screen-reader accessible.

### Acceptance tests

Exact reason copy; wrapper keyboard focus; disabled callback cannot fire; enabled action remains normal.

### Evidence

- Test: `DisabledAction.test.tsx`, `EditorShell.test.tsx`, and `App.test.tsx`.
- Screenshot: final Assist screenshots.
- Walkthrough: empty, pending, accepted, Undo, and Redo states in `browser-walkthrough.md`.
- Commit: focused P0-D.1 commit.
- Decision: `P0-D1_IMPLEMENTATION_REPORT.md`.

### Resolution

Resolved with one reusable accessible disabled-action pattern.

### Current status

RESOLVED; no tooltip framework or second action-state authority was introduced.

## UX-003 — Empty proposal state exposed an unusable Accept action

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P1
- **Type:** UX
- **Found:** 2026-07-29
- **Target milestone:** P0-D.1
- **Owner:** Codex
- **One-line issue:** Assist showed a disabled Accept action when no proposal existed.

### What?

The empty proposal area displayed a dead action instead of calm next-step guidance.

### Where?

`AssistProposalPanel.tsx`.

### When?

On a newly opened project and after a proposal is accepted or rejected.

### Who is affected?

Normal users who may interpret the disabled control as a broken workflow.

### Why does it matter?

Actions should appear only when they can act on a real object.

### How is it reproduced?

Open Assist with `proposal=null` and inspect the Proposal region.

### Root cause

The empty state reused pending-action presentation instead of modeling its own state.

### What was tried?

The dead button was removed and the three-line instruction hierarchy was retained.

### Proposed solution

Render Accept and Reject only for a real pending proposal.

### One-line solution

Do not show proposal actions until a proposal exists.

### Acceptance tests

No Accept/Reject in empty state; both actions present and functional in pending state.

### Evidence

- Test: `AssistProposalPanel.test.tsx`, `StudioScreen.test.tsx`.
- Screenshot: final empty Assist screenshots.
- Walkthrough: empty and pending proposal snapshots in `browser-walkthrough.md`.
- Commit: focused P0-D.1 commit.
- Decision: `P0-D1_IMPLEMENTATION_REPORT.md`.

### Resolution

Resolved by making proposal actions contextual.

### Current status

RESOLVED.

## UX-004 — Add text appeared before a valid point existed

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P2
- **Type:** UX
- **Found:** 2026-07-29
- **Target milestone:** P0-D.1
- **Owner:** Codex
- **One-line issue:** A disabled Add text control appeared before Point had produced a usable target.

### What?

The canvas exposed the next-step control too early.

### Where?

`StudioScreen.tsx` around `NameplateComposer`.

### When?

Before entering Point mode or choosing a location.

### Who is affected?

Users learning the Point → Add text sequence.

### Why does it matter?

Premature controls add noise and hide the actual next action.

### How is it reproduced?

Open Assist with no captured point and inspect the canvas actions.

### Root cause

`NameplateComposer` was always mounted and defended itself with a disabled trigger.

### What was tried?

The composer now mounts only when `pointTarget` exists; its internal defensive check remains.

### Proposed solution

Make Add text visible only after a valid Point target is captured.

### One-line solution

Reveal Add text after Point, not before it.

### Acceptance tests

No Add text before Point; enabled Add text after mouse or keyboard capture; proposal remains bounded.

### Evidence

- Test: `StudioScreen.test.tsx`.
- Screenshot: final Assist screenshots.
- Walkthrough: keyboard Point capture and contextual Add text in `browser-walkthrough.md`.
- Commit: focused P0-D.1 commit.
- Decision: `P0-D1_IMPLEMENTATION_REPORT.md`.

### Resolution

Resolved with conditional composition, without changing point or nameplate operations.

### Current status

RESOLVED.

## UX-005 — Assist hierarchy needed more readable proportions

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P1
- **Type:** UX
- **Found:** 2026-07-29
- **Target milestone:** Owner review after P0-D.1
- **Owner:** Codex
- **One-line issue:** The side panel was too compressed and visually competed with the video.

### What?

Assist needed a wider video region, bounded side panel, and less compressed secondary typography.

### Where?

`StudioScreen.css` and `AssistProposalPanel.css` across the three required laptop widths.

### When?

While reviewing an empty, pending, or accepted Assist state.

### Who is affected?

Non-editors who need a clear video-first reading order.

### Why does it matter?

Assist fails its purpose if it feels like a dense admin panel.

### How is it reproduced?

Compare the P0-D 1440×900 screenshot with the P0-D.1 final responsive set.

### Root cause

The earlier grid ratio, 1400px cap, and sub-12px secondary text compressed the conversation hierarchy.

### What was tried?

The video column ratio, layout cap, gap, and proposal type sizes were adjusted without changing workspace structure.

### Proposed solution

Keep the video dominant, bound the conversation column to 340–420px, and await owner visual approval.

### One-line solution

Use readable Assist proportions, then close this issue only after owner visual approval.

### Acceptance tests

No overflow at required widths; one-column video-first layout near 1024px; owner approves readability and hierarchy.

### Evidence

- Test: focused P0-D.1 suite 78/78.
- Screenshot: `assist-before-1440x900.png` and `assist-after-*.png`.
- Walkthrough: `browser-walkthrough.md`.
- Commit: focused P0-D.1 commit.
- Owner approval: the owner started P0-E from the P0-D.1 completion commit on
  2026-07-30 and explicitly required UX-005 to be resolved before work began.

### Resolution

Implementation evidence is complete. Owner approval was supplied by the
2026-07-30 instruction to begin P0-E from commit
`645d5804c2cdbee57ff58f0f0a0ea4405b6d4571`.

### Current status

RESOLVED by owner approval on 2026-07-30.

## UX-006 — Pending and accepted changes lacked a strong non-color distinction

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P2
- **Type:** UX/A11Y
- **Found:** 2026-07-29
- **Target milestone:** P0-D.1
- **Owner:** Codex
- **One-line issue:** Pending, accepted, and blocked change cards relied too heavily on subtle border differences.

### What?

Change states were not quickly distinguishable without close reading.

### Where?

`AssistChangeStrip.tsx` and `AssistChangeStrip.css`.

### When?

After creating a proposal or accepting an edit.

### Who is affected?

All users, including those who cannot rely on color or subtle contrast.

### Why does it matter?

Pending versus accepted is a safety boundary, not decorative status.

### How is it reproduced?

Render one accepted, pending, and blocked item and compare their non-text visual cues.

### Root cause

Status labels and border styles were the only cues.

### What was tried?

Accepted now uses `✓`, pending `○`, and blocked `!`, all decorative beside explicit status text; border treatments remain secondary.

### Proposed solution

Keep redundant marker, text, and border cues.

### One-line solution

Represent each change state with explicit text plus a unique non-color marker.

### Acceptance tests

All three markers render with `aria-hidden`; text labels remain available; timed items still seek safely.

### Evidence

- Test: `AssistChangeStrip.test.tsx`.
- Screenshot: pending and accepted states covered by the browser walkthrough.
- Walkthrough: `browser-walkthrough.md`.
- Commit: focused P0-D.1 commit.
- Decision: `P0-D1_IMPLEMENTATION_REPORT.md`.

### Resolution

Resolved without changing the derived change model.

### Current status

RESOLVED.

## FEATURE-001 — Optional desktop composer resize preference

- **Done:** [ ]
- **Status:** PLANNED
- **Severity:** P3
- **Type:** Deferred UX
- **Found:** 2026-07-29
- **Target milestone:** Post-P1
- **Owner:** Product
- **One-line issue:** A remembered horizontal desktop composer size was requested as an optional enhancement, not a current core need.

### What?

Potential preference for manually widening the Home composer and persisting that preference.

### Where?

Future Home settings/persistence only; no current implementation file is assigned.

### When?

Only if owner evidence shows the bounded responsive width is insufficient after P1.

### Who is affected?

Desktop users who prefer a wider drafting surface.

### Why does it matter?

Building resize state now would add complexity without proving a core workflow benefit.

### How is it reproduced?

Not a defect; evaluate through future owner/user feedback.

### Root cause

Deferred enhancement request.

### What was tried?

P0-D.1 kept vertical textarea resizing and a responsive 740px composer; no preference system was added.

### Proposed solution

Reassess after P1 and implement only if repeated evidence justifies it.

### One-line solution

Defer remembered desktop composer sizing until core editor evidence proves it useful.

### Acceptance tests

Future contract must define resizing limits, persistence scope, reset behavior, keyboard accessibility, and responsive fallback.

### Evidence

- Test: none required while deferred.
- Screenshot: current responsive Home set.
- Walkthrough: current composer is usable at all required widths.
- Commit: not implemented.
- Decision: explicitly deferred by P0-D.1 scope.

### Resolution

Not resolved because it is intentionally deferred.

### Current status

PLANNED for post-P1 reassessment; not a P0-D.1 blocker.

## INFRA-001 — In-app viewport screenshots tiled the page texture

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P3
- **Type:** Verification infrastructure
- **Found:** 2026-07-29
- **Target milestone:** P0-D.1
- **Owner:** Codex
- **One-line issue:** The in-app browser returned repeated texture tiles instead of one valid responsive screenshot.

### What?

Every viewport-override PNG repeated partial page surfaces across the image.

### Where?

P0-D.1 screenshot capture only; application DOM, layout, and runtime were not
implicated.

### When?

After the functional browser walkthrough when the files were opened for visual
inspection.

### Who is affected?

Milestone reviewers relying on screenshot evidence.

### Why does it matter?

Correct dimensions do not make a tiled screenshot truthful visual evidence.

### How is it reproduced?

Set an explicit in-app-browser viewport, capture the tab, and open the resulting
PNG; multiple partial copies are visible.

### Root cause

The in-app screenshot surface and explicit viewport override used incompatible
device/backing scaling in this desktop session.

### What was tried?

Calibrated viewport values and verified DOM dimensions; visual inspection still
showed tiling. The invalid files were deleted and recaptured through the proven
disposable local Edge/CDP fallback.

### Proposed solution

Reject tiled files and use exact-size local CDP capture until the in-app
viewport screenshot backend is corrected.

### One-line solution

Visually inspect every evidence PNG and replace tiled backend output with a
truthful exact-size capture.

### Acceptance tests

Every PNG opens as one page, matches its filename dimensions, and its browser
inner size equals the requested viewport.

### Evidence

- Test: disk dimensions and visual inspection.
- Screenshot: every final `home-*.png` and `assist-*.png` in the P0-D.1 evidence folder.
- Walkthrough: `browser-walkthrough.md`.
- Commit: focused P0-D.1 commit.
- Decision: use the established P0-D local CDP fallback only for evidence.

### Resolution

All invalid files were replaced; disposable processes and profiles were removed.

### Current status

RESOLVED; this was an evidence-tool defect, not a Sanverse product defect.

## UX-007 — P0-E Studio layout required owner approval before P1-A

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P1
- **Type:** UX approval gate
- **Found:** 2026-07-30
- **Target milestone:** P0-E
- **Owner:** Owner

### What / where / when / how / why?

P0-E delivered the five-region Studio frame, but its final hierarchy and density
could not be accepted by automated tests. P1-A was intentionally blocked until
the owner judged the real 1440×900, 1280×800, and 1024×768 layouts.

### What was tried?

The implementation supplied 64/64 focused tests, an all-workspace build, a real
browser continuity/edit/export walkthrough, and exact-size responsive evidence.
No code change was attempted to replace the owner's visual judgment.

### One-line solution

Record the owner's explicit approval of the P0-E layout and then begin P1-A from
the approved completion commit.

### Evidence and status

The owner approved P0-E in the 2026-07-30 instruction to implement P1-A from
commit `d48aabf34fdadbd6899807fa0c6de0c854a5dc5f`. RESOLVED.

## FAIL-022 — Studio video overflow covered Point controls

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P1
- **Type:** Product interaction
- **Found:** 2026-07-30
- **Target milestone:** P0-E
- **Owner:** Codex

### What / where / when / how / why?

In the real P0-E browser walkthrough, clicking `Point` focused the video instead
of entering Point mode. In Studio, the fixed-height canvas allowed the rendered
video surface to overflow over the controls below it, so the video intercepted
the click. This blocked a core pointing workflow even though component tests
passed.

### What was tried?

Role click, DOM click, and coordinate click all reproduced the same interception.
The video surface was then bounded to the canvas and Point controls were placed
in the foreground.

### One-line solution

Constrain Studio video overflow and keep Point controls above the video layer.

### Evidence and status

Re-test entered Point mode, captured 00:01.155, and Inspector showed the target.
RESOLVED.

## INFRA-002 — Parallel final gates hit Windows spawn EPERM

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P3
- **Type:** Verification infrastructure
- **Found:** 2026-07-30
- **Target milestone:** P0-E
- **Owner:** Codex

### What / where / when / how / why?

Starting Vitest and the production build concurrently caused esbuild startup to
fail with `spawn EPERM` on Windows. It occurred only in the parallel gate, due
to process-policy/contention, and did not identify an application defect.

### What was tried?

The same focused tests and build were rerun sequentially.

### One-line solution

Run esbuild-backed acceptance gates sequentially in this managed Windows session.

### Evidence and status

Focused tests passed 64/64 and the all-workspace build passed. RESOLVED.

## INFRA-003 — P0-E in-app screenshots tiled the page

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P3
- **Type:** Verification infrastructure
- **Found:** 2026-07-30
- **Target milestone:** P0-E
- **Owner:** Codex

### What / where / when / how / why?

The in-app screenshot surface again returned repeated page tiles after viewport
calibration. The DOM sizes were correct but the PNG pixels were not truthful,
due to incompatible backing/device scaling in the desktop capture surface.

### What was tried?

Viewport calibration and recapture still tiled. Invalid images were overwritten
using disposable headless Edge contexts at the exact required dimensions.

### One-line solution

Visually reject tiled captures and use exact-size disposable Edge evidence.

### Evidence and status

All three final PNGs open as one page at 1440×900, 1280×800, and 1024×768.
RESOLVED.

## INFRA-004 — P1-F.0.2 desktop screenshot capture tiled the page

- **Done:** [ ]
- **Status:** OPEN, nonblocking application behavior
- **Severity:** P3
- **Type:** Verification infrastructure
- **Found:** 2026-08-03
- **Target milestone:** Evidence infrastructure maintenance
- **Owner:** Codex/desktop capture surface

### What / where / when / who / how / why?

During the P1-F.0.2 responsive walkthrough, Codex captured the Studio page at
1440×900, 1280×800, and 1024×768 through the desktop in-app browser. The DOM
reported the intended responsive geometry, but each PNG repeated page tiles and
had device-scaled pixel dimensions. This is a recurrence of the capture-surface
scaling class previously recorded as INFRA-003, not an editor-layout failure.

### What was tried?

Viewport calibration and recapture were attempted again during P1-F.0.2.1.
The in-app browser reported DPR 0.67 and tiled captures even when the video and
parent DOM rectangles were identical and bounded. Chrome control was not
available. Application geometry, keyboard resizing, state continuity, ten
collapse cycles, real edit, Undo/Redo, export, and ffprobe were verified
independently. Invalid PNGs are not presented as product evidence.

### One-line solution

Capture exact-size screenshots in a disposable browser context whose device scale is explicitly fixed to 1.

## INFRA-005 — Local Vite HMR websocket host mismatch

- **Done:** [ ]
- **Status:** OPEN, nonblocking production behavior
- **Severity:** P3
- **Type:** Local development infrastructure
- **Found:** 2026-08-03
- **Target milestone:** Development-server maintenance
- **Owner:** Web runtime

### What / where / when / who / how / why?

During the P1-F.0.2 browser walkthrough on port 2000, the page loaded through
`127.0.0.1` while Vite attempted its HMR websocket through `localhost`. The host
mismatch prevented only hot-reload reconnection; application APIs, editing,
Undo/Redo, export, download, tests, and production build remained functional.

### What was tried?

The finding was isolated through the browser console/network walkthrough. It was
not changed because HMR configuration is outside the bounded layout milestone.

### One-line solution

Configure one canonical dev-server and HMR host for port 2000.

## SEC-001 — Installed dependency graph reports one high-severity advisory

- **Done:** [ ]
- **Status:** OPEN
- **Severity:** P2
- **Type:** Dependency security
- **Found:** 2026-08-03
- **Target milestone:** Bounded dependency security review
- **Owner:** Web platform

### What / where / when / who / how / why?

After installing the contract-required `react-resizable-panels@4.12.2`, npm
reported one high-severity advisory somewhere in the aggregate dependency graph.
The advisory was not attributed or auto-fixed because a broad dependency upgrade
could change unrelated production behavior outside P1-F.0.2.

### What was tried?

The exact package version, full regression suite, and production build were
verified. No broad audit fix was attempted.

### One-line solution

Run a bounded advisory attribution and upgrade review before production release.

## FAIL-038 — Reset could visually re-expand a collapsed AI rail

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P0
- **Found:** 2026-08-03
- **Target milestone:** P1-F.0.2.1

### What / where / when / how / why?

In the real Studio browser, Reset followed by collapse changed the action to
`Expand AI`, but a later persisted percentage layout effect restored the panel
to roughly 320 px. Competing effects both believed they owned root geometry.

### What was tried?

The initial default layout was stabilized for the mounted group. Percentage
geometry now applies only while AI is expanded, and the presentation-mode
effect is the final authority.

### One-line solution

Give collapsed pixel geometry final authority over persisted expanded percentages.

### Evidence and status

Ten browser collapse cycles ended identically at 52 px; regression tests pass.

## FAIL-039 — responsive nested panels had zero-height ancestors

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P0
- **Found:** 2026-08-03
- **Target milestone:** P1-F.0.2.1

### What / where / when / how / why?

At 1024×768 and 390×843, the old 1100 px natural-flow breakpoint removed the
height authority while resizable panels still used percentage flex geometry and
size containment. Preview and Timeline wrappers measured zero height even though
their children overflowed.

### What was tried?

Tablet desktops retain the bounded panel authority through 981 px. Below that,
groups and required panels explicitly leave flex sizing, hidden docks are
removed, size containment becomes inline-size containment, and root height
becomes natural.

### One-line solution

Use one bounded tablet authority and one explicit intrinsic-height mobile authority.

### Evidence and status

1024: Preview 940×309, Timeline 940×258. Mobile: Preview 339×425, Timeline
339×492, reachable through document scroll, with zero horizontal overflow.

## Entry rules

Do not delete a failure because it is fixed. Mark it resolved, link evidence, and preserve what prevented recurrence.

## FAIL-040 — Media and Preview owner-visible gaps

- **Done:** [x]
- **Status:** RESOLVED TECHNICALLY — OWNER REVIEW OPEN
- **Severity:** P1
- **Found/target:** 2026-08-03 / P1-F.0.2.2

### What / where / when / how / why?

Media squeezed fixed desktop content into narrow panes and Preview exposed
native controls, technical status, and a permanent Point row because both
surfaces lacked container-owned responsive presentation.

### What was tried?

Added container-responsive Media layout with one results scroll owner and one
custom monitor around the existing video/content layer; inspected real browser
widths and screenshots.

### One-line solution

Adapt presentation at the panel boundary while retaining the single editor authority.

## FAIL-041 — parallel full-web run exceeded test timeouts

- **Done:** [x]
- **Status:** RESOLVED / INFRASTRUCTURE OBSERVATION
- **Severity:** P2
- **Found/target:** 2026-08-03 / P1-F.0.2.2

### What / where / when / how / why?

Six integration tests exceeded existing 5/10 second deadlines only in the
parallel full-web run under machine contention. The same affected files passed
39/39 with one worker. One additional failure was a stale assertion expecting
the entire Media shell to scroll.

### What was tried?

Corrected the stale assertion to results-only scrolling and reran only affected
files with `--maxWorkers=1` without weakening behavior assertions.

### One-line solution

Use deterministic worker bounds for acceptance runs.

## FAIL-042 — real browser export stayed rendering beyond 90 seconds

- **Done:** [ ]
- **Status:** OPEN — OUTSIDE THIS MILESTONE
- **Severity:** P1
- **Found/target:** 2026-08-03 / future export-runtime repair

### What / where / when / how / why?

After a real nameplate Accept → Undo → Redo path on `test-30s.mp4`, Export stayed
at `Rendering and verifying your MP4…` for more than 90 seconds. No completion,
download, visible failure, console error, or API diagnostic surfaced. Renderer
work was explicitly forbidden for P1-F.0.2.2, so root cause remains unverified.

### What was tried?

Observed the real browser state and checked browser and local dev logs.

### One-line solution

Trace the export job ID through API/job-store completion with a bounded UI timeout in a dedicated renderer milestone.

## FAIL-043 — in-app browser full-viewport screenshots tiled

- **Done:** [ ]
- **Status:** OPEN — TOOLING
- **Severity:** P2
- **Found/target:** 2026-08-03 / evidence tooling

### What / where / when / how / why?

The in-app screenshot compositor returned repeated/tiled pixels for full-viewport
captures under its scaled viewport. Malformed PNGs were deleted; bounded
non-tiled JPEG captures were retained. Screen recording was not exposed.

### What was tried?

Used bounded screenshot clips, visually inspected key captures, and removed the
malformed full-viewport file.

### One-line solution

Use a corrected capture backend or external recorder for exact full-viewport evidence.

## FAIL-044 — pre-commit accessibility and evidence blockers

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P0
- **Found/target:** 2026-08-03 / P1-F.0.2.2

### What / where / when / how / why?

Independent review found that `sr-only` had no CSS definition, monitor shortcuts
could intercept keys from native controls, Escape prioritized fullscreen over
active Point mode, Media exposed an inert options button, and the fullscreen
screenshot was not valid evidence.

### What was tried?

Added one global screen-reader utility and regression test, ignored bubbled
keyboard events from native controls, restored Point-first Escape order, removed
the inert action and CSS, deleted the screenshot, then passed 31/31 affected
tests and the final web production build.

### One-line solution

Keep hidden semantics, keyboard ownership, action truth, and evidence validity executable and review-gated.

## FAIL-045 — Preview showed black base footage with no explanation

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P0
- **Found/target:** 2026-08-03 / P1-F.1A Gate A

### What / where / when / how / why?

The owner recorded base footage going black while the monitor controls and an
accepted overlay stayed visible. `drawFootageMotionFrame`
(`apps/web/src/features/render-plan/footage-motion-preview.ts`) filled the motion
canvas black, called `drawImage`, and revealed the canvas unconditionally,
guarded only by `videoWidth > 0`. That is populated at `HAVE_METADATA`, before
any frame is decodable, so during load and every seek an empty black canvas was
shown over a perfectly healthy video. Separately, an intentional timeline gap,
loading, seeking, and a real error all rendered as identical black with nothing
distinguishing them.

### What was tried?

Split the drawing rule into a pure `draw | retain | hide` decision requiring
`readyState >= HAVE_CURRENT_DATA`; revealed the canvas only after a real frame
lands; retained the previous frame on a readiness dip, keyed per canvas AND per
source so a project change cannot show the previous project's frame. Added one
`MonitorBaseFrameState` (`loading | ready | seeking | gap | error`) derived from
real media events, with `showsGapLayer` as the only expression that can paint
the black layer. Proved the guards fail when the readiness check is reverted
(4 tests), then measured 96 real-browser samples across 20 cycles with zero
unexplained black and a motion canvas 97–100% lit.

### One-line solution

Never reveal a surface that has not been proved to contain a real frame, and give
every black state a name the user can read.

## FAIL-046 — Export spinner could never end

- **Done:** [x]
- **Status:** RESOLVED
- **Severity:** P0
- **Found/target:** 2026-08-03 / P1-F.1A Gate A

### What / where / when / how / why?

The export stayed in "Rendering and verifying your MP4…" past 90 seconds with no
way to tell a slow render from a dead one. `exportProject`
(`apps/web/src/features/project-export/project-export.ts`) polled
`while (status === 'queued' || 'running')` with no bound, collapsed queued,
encoding and verifying into one word, and showed no elapsed time. Measurement
proved the render was never hung: it genuinely takes 60–90 seconds on this
machine for a 30 s 1080p file with an overlay and full-length motion. Reading the
code also found that an orphaned `running` job was returned to the browser and
never executed, because work only started `if (created.job.status === 'queued')`.

### What was tried?

Added `RenderRequest.onMilestone` reporting the two boundaries the renderer
genuinely knows it crossed; derived `queued | rendering | verifying | done` on
the server so the browser holds no second copy of the thresholds; added a visible
`m:ss` elapsed clock, a ten-minute client bound producing a recoverable
timed-out state that deliberately leaves the job alive, and Retry that
re-attaches to the same job by idempotency. Added `startExportJob` to resume an
orphaned `running` job. Measured a real export succeeding and probed the MP4.

### One-line solution

Bound every wait, name every phase from something real, and never let "slow" and
"dead" look the same.

---

## FAIL-047 — Resizing the window strands the user with no Media or Inspector panel

- **Done:** [x]
- **Status:** FIXED in Gate B1, 2026-08-03 — **and the original diagnosis was
  partly wrong; see "What was tried?" below**
- **Severity:** P1
- **Found/target:** 2026-08-03 (during P1-F.1A Gate B browser testing) / Studio layout authority, NOT Gate B

### What / where / when / how / why?

Load Studio at 1440 px wide, then drag the window down to 1024 px. The Media
dock and the Inspector disappear and there is **no way to get either back**
without reloading the page.

Two authorities disagree because one of them never re-runs:

```
  CSS   apps/web/src/screens/studio/StudioScreen.css
        @media (max-width: 1100px) { .studio-screen--studio .studio-screen__media,
                                     .studio-screen--studio .studio-screen__inspector
                                     { display: none } }
        ── reacts to the window immediately, as CSS always does

  JS    apps/web/src/editor/layout-v2/StudioLayoutV2.tsx
        renders the compact panel switcher only when
        responsiveMode === 'tablet' || 'mobile'
        ── `responsiveMode` is computed from the viewport but is NOT recomputed
           on resize, so after shrinking from 1440 it is still 'laptop'
```

So between the two, the docks are hidden by CSS while the switcher that is meant
to replace them is not rendered at all. Confirmed live in the DOM:

```
  loaded at 1440, resized to 1024   window 1024   responsiveMode 'laptop'
                                    switcher in DOM: NO      Media: unreachable
  reloaded at 1024                  window 1024   responsiveMode 'tablet'
                                    switcher in DOM: YES     Media: reachable
```

It fails in the other direction too: loaded at 1024 and grown to 1280, the mode
stayed `tablet` when it should be `laptop`.

`studio-layout-responsive.ts` has the right thresholds
(`< 600 mobile`, `< 1100 tablet`, `< 1360 laptop`). Nothing re-reads them.

**Not caused by Gate B.** `git diff 0ecffc3 -- apps/web/src/screens/studio/StudioScreen.css`
is empty, and Gate B touched no layout file.

### What was tried?

**Gate B1, 2026-08-03 — and the original diagnosis above was PARTLY WRONG.
This is recorded rather than quietly corrected, because a wrong diagnosis that
looks convincing is more dangerous than an open bug.**

The code above *does* contain a `window.addEventListener('resize', …)` that
recomputes the mode. It was there the whole time. So why did the DOM readings
show a stale `'laptop'` after resizing to 1024?

Because **the browser pane used for that testing never runs the browser's
rendering steps** — it is not displayed, so it does not composite frames. That
is the same limitation that made every screenshot attempt time out during Gate
B. `resize` events, `matchMedia` change events, and `ResizeObserver` callbacks
are *all* delivered as part of the rendering steps. Measured directly on
2026-08-03 with counters installed in the page:

```
  viewport driven 1440 -> 1024 -> 1440 (window.innerWidth really changed,
                                        the 1100px media query really crossed)

  window 'resize' events fired                 0
  matchMedia '(max-width: 1100px)' changes     0
  ResizeObserver callbacks                     0
```

Manually dispatching one `resize` event corrected the mode immediately. **So the
staleness was the instrument, not the product**, and it cannot be reproduced or
disproved in that pane. It has never been observed in a normally displayed
browser.

**However, a real defect of exactly the described shape did exist**, and was
found by reading the two authorities against each other rather than by driving
the browser:

```
  CSS   @media (max-width: 1100px)   MATCHES at exactly 1100 -> docks hidden
  JS    viewport.width < 1100        is FALSE at 1100        -> mode 'laptop'
                                                             -> no replacement
  at a window exactly 1100px wide: no Media panel, no Tool panel, no way back
```

One pixel of disagreement between a stylesheet and a comparison operator is
enough to lose two whole panels.

### What was done

`apps/web/src/editor/layout-v2/studio-responsive-authority.ts` is now the single
place the breakpoints exist. It:

- compares with `<=`, so it agrees with `max-width` at the boundary pixel;
- generates the media-query strings from the same numbers, and
  `studio-responsive-authority.test.ts` **reads the real `.css` files** and fails
  if the stylesheet ever contains a `max-width` condition above the breakpoint
  the code knows about;
- exposes `useStudioResponsiveMode()`, a `useSyncExternalStore` hook that
  **re-reads the live width on every notification** — there is no copy of the
  mode sitting in React state that can go stale by construction;
- subscribes to `resize`, `orientationchange`, **and** `matchMedia` boundary
  crossings, so a browser that throttles one still delivers another.

`StudioResponsiveContinuity.test.tsx` drives the real screen from 1440 down
through 1101, 1100, 1024, 620 and back, and requires the Media panel to be
reachable at every single width, with the user's search text preserved and no
project revision created.

### One-line solution

Two authorities may not decide the same thing from different inputs — and when a
measurement disagrees with the code, check the instrument before you write down
a cause.

---

## FAIL-048 — Imported file names are forgotten on reload

- **Done:** [ ]
- **Status:** OPEN
- **Severity:** P2
- **Found/target:** 2026-08-03 (during P1-F.1A Gate B browser testing) / asset naming, NOT Gate B

### What / where / when / how / why?

Import `logo.png`. The Media list shows `logo.png`. Reload the page and the same
asset is now called **`Image 1`**.

The name the user recognises arrives with the upload and is kept only in browser
session state — `setAssetOriginalNames` in `apps/web/src/app/App.tsx` — which is
handed to `deriveAssetDisplayLabels` to build the label. Nothing persists it. On
a fresh load there are no original names, so the label falls back to a generated
one.

It is cosmetic in that no data is lost and no edit is affected. It is not
cosmetic in that it is directly against the product standard: the user should
never have to hold information the product could hold for them, and "which one
was my logo?" across eleven pictures called `Image 1` … `Image 11` is exactly
that.

### What was tried?

Nothing. Recorded rather than fixed: persisting it means either a new field on
the asset (which is inside `EditProject`, so it moves the revision and the
export key for a naming change — the very thing ADR-MEDIA-ORGANIZATION-V1
refused for folders) or a second server sidecar. That is a real decision and
needs an ADR, not a patch inside a gate about folders.

### One-line solution

A name the user typed or chose is theirs — decide where it lives before showing
it, or the product will quietly forget it.

---

## FAIL-049 — The preview went black whenever the mouse was not on it

- **Done:** [x]
- **Status:** FIXED in Gate B1, 2026-08-03
- **Severity:** P0 — the product's central surface showed nothing most of the time
- **Found/target:** owner screen recording / Studio preview base layer

### What / where / when / how / why?

Move the mouse off the video and the picture turned black. Move it back on and
the footage returned. Reported by the owner from a screen recording, which is the
only reason it was caught at all: no test could see it, because no test moves a
mouse away from something.

Two faults, one stacked on the other.

**Fault 1 — the motion canvas could not be switched off.** The canvas that draws
zooms and pans sits above the video with an opaque black background. It was
switched off with the HTML `hidden` attribute:

```
  code         canvas.hidden = true
  stylesheet   .studio-screen__footage-motion-canvas { display: block; ... }
```

An author rule beats the browser's built-in `[hidden] { display: none }`, so
`hidden` did **nothing**. Measured live in the running product:

```
  canvas.hidden = true  ->  computed display "block", background rgb(0,0,0),
                            z-index 1        ← an opaque black lid on the video
```

**Fault 2 — a hover rule was added to cover fault 1 up.**

```css
  .studio-screen__video:hover + .studio-screen__footage-motion-canvas,
  .studio-screen__video:focus + .studio-screen__footage-motion-canvas {
    opacity: 0 !important;
  }
```

"While the pointer is on the video, make the black lid transparent" —
which necessarily means "the moment it leaves, put the lid back".

### What was done

`apps/web/src/editor/monitor/monitor-base-layer.ts` — one resolver returning
`native-video | motion-canvas | gap | loading | error`, whose input type
contains no pointer, hover, or focus field at all. The canvas is shown through
one attribute that only the resolver writes:

```css
  .studio-screen__footage-motion-canvas[data-visible="false"] { display: none; }
```

Measured live: `data-visible="false"` -> computed display `"none"`. It actually
goes away now.

Two supporting rules:

- **when in doubt, show the native video.** Untransformed real footage beats
  black. The base picture is black in exactly one case now: a stretch the user
  deliberately emptied, which is black in the export too.
- **frame identity.** Every draw records a token (asset, source time,
  composition time, motion, geometry version); every render states the token it
  wants; the canvas is shown only when they match — so a cleared canvas, a stale
  seek, a swapped source, or a frame drawn at the old panel size can never be
  presented as the current picture.

Held by `monitor-base-layer.test.ts` (15), `StudioPreviewNoHover.test.tsx` (6,
which read the stylesheet as text because jsdom does not evaluate hover), and
proved in the real browser: 20.5 s of playback plus 5 seeks with the pointer
provably nowhere (`:hover` count 0 throughout) and **zero black frames**,
brightness never below 105 out of 255. Full evidence:
`DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-b1-preview-base-layer.md`.

### One-line solution

If a workaround is needed to make something look right, the thing it works
around is the bug — and two mechanisms fighting over whether a layer is visible
means neither of them is the authority.

---

## FAIL-049 — the original recording reported itself missing to the preview maker

**Found:** 2026-08-04, first real browser run of Gate D. No test had caught it.

The one file that is certainly there — the footage the project was made from —
answered `ASSET_MISSING` when the timeline asked for a preview frame of it.

It lives beside the project as `source.mp4`; everything the user adds afterwards
lives in `assets/`. The check that tells the two apart compared the asset's
storage reference against `project/<id>/source` with a **slash**, while every
saved project on disk writes `project:<id>/source` with a **colon**. The check
never matched, so the original recording was looked for in the added-files folder
and was truthfully not there.

The same mistaken comparison existed in the export path
(`server.ts`, building `extraSourcePaths`). There it was harmless by luck: the
lookup failed and the entry was dropped by the surrounding `catch`, which is the
right outcome for the wrong reason.

**Fixed.** `isOriginalRecording` accepts both spellings, is used in both places,
and is held by two tests — one that the assets folder is never even asked, and
one that the older spelling still works so nothing on disk has to be rewritten.

### One-line solution

A comparison that never matches is indistinguishable from a comparison that
always fails — write the check once, use it everywhere, and test that the branch
is actually taken.

---

## FAIL-050 — every timeline row shrank on a large monitor

**Found:** 2026-08-04, same browser run.

Row heights step down on a small screen so a phone can show more than one row.
The step was decided from the width of the TIMELINE. On a 1440-pixel desktop the
timeline shares the screen with the preview and the inspector and gets about 700
pixels — so the editor concluded the user was on a phone and shrank every row,
including the footage row the filmstrips live in.

**Fixed.** The decision now reads the width of the WINDOW, tracked on resize.
Held by two tests: one that a narrow timeline pane on a wide window keeps full
rows, and one that a genuinely small window shrinks them.

### One-line solution

"Is there room on this screen" and "how much room did this panel get" are two
different questions; measuring the panel to answer the screen question is how a
desktop gets treated like a phone.

---

## FAIL-051 — portrait footage cannot be exported into a landscape project

**Found:** 2026-08-04, while probing the export for Gate D.
**FIXED and CLOSED:** 2026-08-05, Gate T0.7.

A project whose main video track holds a 1920×1080 recording followed by a
714×1280 portrait recording fails to export:

```
  RENDER_FAILED — "The local renderer could not produce a verified MP4."
```

Switching that one clip off and exporting the same project at the same moment
succeeds. So the fault is specific to a portrait source inside a landscape
composition, in the render graph.

Gate D changed nothing in the render graph, and the program for that gate says to
fix Gate D blockers only and record everything else. Recorded here.

**This is a real gap for real users.** Somebody filming on a phone in portrait
and adding that clip to a landscape project cannot export at all, and the message
they get says nothing about why. It should be the next render task.

### The cause, proved rather than guessed

The exporter's own instructions were run through real FFmpeg on real files:

```
Input link in0:v0 parameters (size 714x1280, SAR 1:1) do not match the
corresponding output link in0:v0 parameters (1920x1080, SAR 1:1)
```

FFmpeg joins the pieces of a finished video end to end with a step called
`concat`, and `concat` refuses outright unless every piece is already the same
width, the same height and the same pixel shape. Nothing in the exporter made
that true: footage went in at whatever size it was recorded at.

That was invisible while a project could only hold ONE recording — "the size of
the footage" and "the size of the finished video" were the same number by
accident.

### This entry understated the bug

It was recorded as "portrait footage cannot be exported". The fault was never
about portrait. **Any two clips of different sizes failed identically** — 1080p
next to 720p, a 4K clip next to anything, a square clip from social media next to
a normal one. Anybody who filmed twice on different devices hit it.

### The fix, in one line

One file — `packages/render-contract/src/visual-normalization.ts` — owns the rule
for where a picture of one shape sits inside a canvas of another, and both the
browser preview and FFmpeg read it, so the two cannot drift apart. Every piece
reaching `concat` is now exactly the canvas size with square pixels, whatever was
imported. Default is Fit (whole picture, black bars); Fill is offered; Stretch
deliberately is not.

### Proof

Real export from the running app: `1920 × 1080 · 27s`, containing real 714×1280
phone footage. ffprobe: SAR 1:1, yuv420p, 818 frames, 27.278 s. Sampled
brightness at the portrait clip: left edge 16 (video black — a bar), centre 120.8
(real picture). Frames in
`DOCS/evidence/2026-08-04-timeline-completion/screenshots/`.

Full story: `DOCS/evidence/2026-08-04-timeline-completion/T0_MIXED_FORMAT_EXPORT.md`.

---

## FAIL-052 — the monitor reported "No media at this time" over footage that was there

**Found:** in the owner's own screen recording.
**Fixed:** 2026-08-05, Gate T0. **CLOSED** 2026-08-05 after real-browser proof.

The browser proof that was outstanding is now done, and it needed nothing to be
constructed: the owner's own saved project already contained the exact sequence.
Its history holds one `add-media-overlay`, three `set-visual-properties`, and one
`remove-overlay`, leaving three change sets blocked with `VISUAL_TARGET_UNKNOWN`.
With those present, the running app reports `primaryDecision: active` and
`gapReason: null` over the footage, the project compiles, and Export produces a
file. Seeking the whole composition reported three gaps, all three verified
against the composition to be genuinely empty stretches.

A **second instance of the same mistake** was found while doing Gate T0.3: which
recording the one video element should point at was also being read from the
compiled plan, so the same whole-project failure left the element showing the
wrong file. Fixed the same way — read it from the user's edit. Recorded here
because it is the same defect, not a new one: *a value that can mean "I could not
build this" must never be used to answer "is there anything here".*

The monitor claimed the timeline was empty while footage was plainly under the
playhead. It looked like selecting a V1 clip caused it. Selection was innocent,
and so were both monitor state machines — each already documented that a gap can
only come from one input. The lie was made two steps earlier, and once it began
it covered the WHOLE project; selecting a clip only drew attention to it.

The trigger: add a title or B-roll, MOVE or SCALE it, then DELETE it. The
adjustment naming that overlay stays behind. The compiler then refused the entire
project — "A visual adjustment names something that is not on screen." The
preview asks that same compiler whether footage exists, got `null`, and turned
that into an empty segment list, so every moment answered "no footage here".

```
  "the plan could not be built"   \
                                   >--- both expressed as  null
  "the timeline is empty"         /
```

Those are different statements. The preview could not tell them apart.

The same refusal also blocked Export, with a message that explained nothing.

### Why it matters more than it looks

A gap is a CLAIM ABOUT THE USER'S EDIT — *you left this empty, and the export
will be black here too*. Saying that over real footage teaches the user their own
timeline lies to them. After that every real gap reads as another bug, and every
real bug reads as probably fine.

### The fix, in two parts

1. `apps/web/src/features/render-plan/primary-source.ts` — whether footage exists
   at a moment is read from the COMPOSITION, never from a compiled artefact that
   can fail as a whole. One broken thing now costs only its own interval, and the
   four gap reasons are distinguished: no clip, track switched off, clip switched
   off, and file missing (which is reported as an error, not a gap).
2. `packages/render-contract/src/compile-project.ts` — an adjustment naming
   something no longer on screen contributes nothing instead of failing the
   project. The identical rule was already three lines above for a switched-off
   V2 track: "Failing here would mean that hiding a track made Export stop
   working altogether."

### One-line solution

`null` must never mean two things; "I could not build this" and "there is nothing
here" are opposite answers, and a preview that confuses them will call the user's
own footage missing.

---

## FAIL-053 — Hold Frame was enabled but did not open its panel

**Found:** final Gate T2 real-browser closure, 2026-08-08.
**Status:** RESOLVED.

The More menu truthfully enabled **Hold frame** for a valid primary-video clip,
but pressing it did nothing. The freeze planner, domain operation, Preview and
render path already existed; the command dispatcher was the missing link.

### Root cause

`Timeline.runToolbarAction` treated Speed, Transition and J/L Cut as
presentation-only panel actions, but omitted `freeze` from that branch. Freeze
therefore fell through to the generic edit action instead of setting
`freezePanelOpen`.

### Fix

`freeze` now goes through the same panel-opening branch, closing the other
mutually exclusive panels without creating a revision. The actual Freeze edit is
still created only by **Insert held frame**.

### Acceptance

- `Timeline.test.tsx`: `opens the Hold frame panel from More`.
- Final Edge workflow: 0.6 s hold accepted at revision 42; Undo removed it at 43;
  Redo restored exactly one freeze operation at 44; reopen preserved it.

### One-line solution

An enabled command must route to the UI it promises before its edit can be
considered reachable.

---

## FAIL-054 — Rate Stretch silently removed Reverse

**Found:** final Gate T2 accepted-project inspection, 2026-08-08.
**Status:** RESOLVED.

A reversed clip could be stretched with the real Rate Stretch handle, but the
new time-transform operation changed its direction back to forward. The duration
was correct while the meaning of the footage was wrong.

### Root cause

Both `describeRateStretch` and `handleRateStretchCommit` in `StudioScreen` passed
`direction: 'forward'` instead of carrying the selected clip's current time
transform.

### Fix

Both preview and commit now pass `speedSubject?.direction ?? 'forward'`. Rate
Stretch changes duration/rate only; it does not change direction unless the user
explicitly changes Reverse.

### Acceptance

- Existing speed/Rate Stretch planner and handle suites remain green.
- Final Edge workflow starts with Reverse, stretches the clip, and the resulting
  accepted Timeline label is `1.63x Backwards`.
- Accepted project inspection shows the latest time-transform operation for that
  clip still has `direction: reverse`.

### One-line solution

A duration gesture must preserve every time-transform property the user did not
ask it to change.
