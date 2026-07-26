# Cross-Cutting Quality and Evidence Plan

> **For the implementer:** Whether Codex, Claude, or a human engineer, apply
> these checks to each approved visible slice; do not postpone them to cleanup.

**Status:** Proposed for owner approval. Applies continuously; it is not a
separate late cleanup phase.

**Goal:** Ensure each vertical slice is correct, attractive, understandable,
safe, recoverable, and supported by evidence.

**Architecture:** Cross-cutting contracts attach to each goal's entry and exit
gates. They do not become horizontal infrastructure projects detached from a
user workflow.

**Tech Stack:** Existing project stack plus documentation fixtures, browser
walkthroughs, ffprobe/frame inspection, accessibility checks, and bounded
provider/security probes when their goal is active.

---

## Track Q1 - Creative quality

### Q1-01 Reference library

- Owner supplies at least three reference videos or exact moments.
- Record what is admired: typography, caption rhythm, whitespace, motion,
  callout behavior, density, pacing, B-roll, and restraint.
- Record what must not be copied.
- Store links/notes, not copyrighted media, unless the owner owns the source.

Planned file: `DOCS/CREATIVE_QUALITY_CONTRACT.md`

### Q1-02 Initial Sanverse style profile

Define:

- black/white/grayscale palette;
- typefaces and licensed font files;
- text hierarchy;
- safe margins;
- caption line length and reading speed;
- nameplate padding and anchor;
- callout density;
- motion duration/easing/spring character;
- transition restraint;
- mobile legibility;
- prohibited decoration.

### Q1-03 Capability quality fixture

Every visual capability gets:

- canonical input fixture;
- browser screenshot;
- rendered output frame(s);
- expected timing;
- owner verdict;
- known acceptable differences;
- regression rule.

### Q1-04 Creative-quality exit

Correctness tests cannot substitute for the owner's visual judgment. Record
both separately.

## Track U1 - Owner and representative-user evidence

### U1-01 Owner test after every visible slice

Record:

- task attempted;
- whether instructions were needed;
- first action;
- wrong turns;
- confusion;
- repair steps;
- completion time;
- output verdict;
- exact owner correction.

### U1-02 Bounded non-editor smoke tests

Run when the slice is stable enough not to waste participants' time.

- A small number such as three is a smoke test, not statistical proof.
- State the narrow question being tested.
- Do not coach while observing.
- Record what users try, not only what they say.
- Do not treat requested features as automatically approved roadmap items.

### U1-03 Re-prioritization rule

Evidence may reorder later goals. It cannot silently violate safety,
immutability, or deterministic execution boundaries.

## Track R1 - Real-media fixture matrix

Build fixtures only as active capabilities require them:

- landscape H.264/AAC;
- portrait H.264/AAC;
- no-audio MP4;
- 23.976, 29.97, and 30 fps;
- VFR;
- long duration;
- high resolution;
- long filenames and Unicode;
- caption languages required by actual users;
- HDR/color fixture before public alpha;
- corrupt/truncated/malicious media;
- multiple audio tracks only when supported.

For every fixture record ownership/license, hash, codec, duration, dimensions,
frame rate, audio, color properties, and purpose.

## Track F1 - Preview/export fidelity

For each supported primitive:

1. compile one canonical render plan;
2. capture browser preview at declared times;
3. render final media;
4. extract corresponding frames;
5. compare geometry, text, timing, color, and layering;
6. define tolerance;
7. fail if outside tolerance;
8. record what remains human-judged.

Structural comparison is not pixel comparison. Pixel comparison is not motion
quality. Both distinctions remain explicit.

## Track S1 - Security and privacy

### Local media

- immutable source;
- controlled opaque IDs;
- no arbitrary paths from UI/AI;
- traversal/symlink/hard-link defense;
- bounded upload/request sizes;
- safe subprocess argument arrays;
- cancellation and cleanup;
- no secrets/media/exports in Git.

### Provider boundary

- outbound field allowlist;
- no raw media by default;
- no filesystem paths;
- secret storage outside source/docs/chat;
- timeouts and cancellation;
- safe logs;
- terms/rate/schema probe;
- no provider coupling in domain types.

### Future SaaS

Threat modeling, tenancy, authorization, encryption, retention, backup,
incident response, and abuse controls begin only at the G10 entry gate, while
earlier code already preserves explicit boundaries.

## Track A1 - Accessibility and low learning curve

Every visible slice checks:

- keyboard completion;
- visible focus;
- logical focus movement;
- screen-reader names and status;
- reduced motion;
- contrast;
- touch targets;
- plain-language errors;
- no required professional editor terminology;
- advanced controls hidden by default.

## Track C1 - Continuity and migrations

- Every serialized schema has a version.
- Every semantic structural change has migration or explicit incompatibility.
- Migration is read-validate-transform-validate-backup-atomic-write-re-read.
- Rollback never modifies immutable source media.
- Unknown executable operations fail loudly.
- Unknown metadata extensions round-trip.
- Current-state docs contain one truth; history stays in logs/change records.

## Track P1 - Performance

Measure before optimizing:

- intake throughput;
- time to Studio;
- seek responsiveness;
- proposal latency;
- preview update latency;
- export queue/start/render/verify time;
- memory/disk growth;
- project reopen time;
- recovery time.

Attack the largest measured bottleneck. Do not add GPU, proxies, distributed
workers, or caches merely because they may be useful later.

## Track O1 - Observability and recovery

Each failure has:

- stable safe code;
- user-visible truth without guessed cause;
- local diagnostic detail;
- affected state;
- whether accepted work is safe;
- recovery action;
- retry/idempotency behavior;
- cleanup proof.

Failures enter `DOCS/FAILURE_REGISTRY.md` with What, Where, When, Who, Why, How,
attempts, status, and one-line solution.

## Track E1 - Evidence levels

- E0: plan only.
- E1: static inspection.
- E2: targeted automated checks.
- E3: integrated controlled workflow.
- E4: owner real workflow.
- E5: repeated representative use within measured budgets.

Never close a user-visible goal below its declared evidence gate.

## Per-goal cross-cutting checklist

- [ ] Creative reference and rubric selected
- [ ] Correctness acceptance defined
- [ ] Security/privacy boundary reviewed
- [ ] Accessibility behavior specified
- [ ] Migration/rollback impact recorded
- [ ] Real-media fixtures selected
- [ ] Preview/export comparison defined
- [ ] Failure/recovery paths tested
- [ ] Performance measured
- [ ] Owner workflow completed
- [ ] Evidence level recorded truthfully
- [ ] Limitations and next trigger recorded
