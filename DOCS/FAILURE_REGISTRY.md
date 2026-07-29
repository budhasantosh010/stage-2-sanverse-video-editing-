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
| [ ] | UX-005 | P1 | UX | Assist side-panel text and hierarchy need owner visual approval | IN_PROGRESS | Owner review |
| [x] | UX-006 | P2 | UX/A11Y | Pending and accepted changes need stronger visual distinction | RESOLVED | P0-D.1 |
| [ ] | FAIL-021 | P2 | Performance | 30-second export crossed the 60-second walkthrough budget | MONITORING | E5 benchmark |
| [ ] | FEATURE-001 | P3 | Deferred UX | Optional desktop composer resize preference | PLANNED | Post-P1 |
| [x] | INFRA-001 | P3 | Verification infrastructure | In-app viewport screenshots tiled the page texture | RESOLVED | P0-D.1 |

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

- **Done:** [ ]
- **Status:** IN_PROGRESS
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
- Decision: owner approval pending.

### Resolution

Implementation evidence is complete; subjective product approval is intentionally not self-certified.

### Current status

IN_PROGRESS; the only remaining action is owner visual review.

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

## Entry rules

Do not delete a failure because it is fixed. Mark it resolved, link evidence, and preserve what prevented recurrence.
