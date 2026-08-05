# OpenEdit — what we may take, what we may not, and why

2026-08-06 · Gate P0

## What this document is for

Somebody looked at two outside projects and asked whether Sanverse should use
them. This is the answer, written so it can be read by a lawyer, by an engineer,
and by the owner, and produce the same understanding in all three.

The short answer:

```
  OpenEdit          ──►  read it, learn from it, copy NO code by default
  veed-engine-cli   ──►  do not use it at all
```

## OpenEdit

### What it actually is

OpenEdit is a **command-line, script-driven** video tool. You describe an edit in
a file, you run it, you get a video out.

**It has no graphical interface and no timeline.** There is nothing in it to look
at, nothing to drag, and nothing to click. That single fact decides most of this
document: the thing Sanverse is — a screen a non-editor can point at — is the
exact thing OpenEdit does not have.

So OpenEdit cannot be "adopted" in the way people usually mean. There is no
timeline to lift.

### Licence position

OpenEdit is Apache-2.0. In plain words, Apache-2.0 means:

| you may | on condition that |
|---|---|
| read the source | — |
| use it | you keep the copyright notices |
| change it | you say what you changed |
| ship it inside a commercial product | you include the LICENSE and any NOTICE file |

It does **not** force Sanverse to become open source. That is the difference
between Apache-2.0 and a copyleft licence like GPL, and it is why studying
OpenEdit is safe where studying some other projects would not be.

**The rule this repository follows:** we may *read* Apache-2.0 code freely. If we
ever *copy* any of it, that file must carry the original copyright header and the
LICENSE and NOTICE must be shipped with the product. Today we copy nothing, so
there is nothing to ship.

### What we adopt — six ideas, no code

These are **shapes of thinking**, not files. Each one is written here with the
reason it is worth having, because an idea adopted without its reason gets
dropped the first time it is inconvenient.

**1. A deterministic script and a separate agent that writes it.**

Two jobs, kept apart:

```
   the AI                        the executor
   ──────                        ────────────
   reads what the user said      reads a written-down plan
   writes a plan                 produces the video
   may be wrong                  must be repeatable

              the plan is the only thing that crosses
```

Sanverse already works this way — `EditOperation` **is** that written-down plan,
and `compileProjectToRenderPlan` is that executor. This is confirmation that the
shape is right, not a change to make.

Why it matters: if the AI reached into the renderer directly, the same request
could produce two different videos on two different days, and nobody could say
which was correct.

**2. Provider-neutral transcript evidence.**

A transcript should record *what was said and when*, not *which company's speech
service said it*. If it records the provider's own answer shape, changing
provider later means rewriting every stored transcript.

This lands in **T7**, and it is recorded here so T7 starts from it.

**3. An executable agent skill.**

A capability the AI can use should be a real, runnable, testable thing — not a
paragraph of instructions in a prompt hoping the model behaves. Sanverse's
`CAPABILITY_REGISTRY` is this. Confirmation, again, not a change.

**4. Gates: lint, verify, render, probe.**

Do not believe a video is correct because the code ran without error. Actually
measure the file that came out.

This one has already earned its place here. In Gate T0 the exporter was fixed
correctly and the first export still failed, because the running server had the
old code. Only probing the real output file told the truth. This is the same rule
as `CLAUDE.md` #3 and it now has an outside project agreeing with it.

**5. Plain-language user communication.**

Say what happened in words the user can act on. Sanverse's refusal codes each
carry a sentence a non-editor can read. Confirmation.

**6. HTML/CSS compositions only through a future validated external adapter.**

OpenEdit can describe a graphic as a web page and photograph it. That is genuinely
useful for titles and lower-thirds, because designing in HTML is far easier than
in a video filter.

If Sanverse ever does that, it must be **behind an adapter that is checked**, not
wired straight in. Two reasons, and the first is a security reason:

- A web page can load anything from anywhere and run code. Turning user text into
  a live web page and rendering it is a way for text somebody typed to become a
  program. It must be sealed off and validated first.
- It must never become a second way to describe timing. Timing is integer ticks,
  in `EditProject`. A CSS animation is floating-point seconds. Two clocks is how
  a caption ends up 40 milliseconds out and nobody can say which one is lying.

## veed-engine-cli — do not use

**Refused. Not on technical grounds. On licence grounds.**

Its licence forbids use in a product that competes with the licensor. Sanverse is
a video editor. The licensor sells a video editor. Sanverse competes with it.

That is the whole argument. It does not matter how good the code is, whether we
only use "a small part", or whether it is only used internally and never shipped.
A licence that says "not for competitors" is not negotiable by being careful.

**It is not to be read, copied, linked, vendored, or installed as a dependency.**
Not reading it also protects against the harder accusation later — that our
version was derived from theirs — which is expensive to disprove even when true.

## Four things that must not happen

Written as hard rules because each one, if it happened quietly, would be very
expensive to reverse.

**1. OpenEdit must not become a dependency.**

Not in any `package.json`, not vendored into the repository, not installed by a
setup script. A dependency is something whose bugs, security holes and release
schedule become ours.

**2. Its renderer must not be copied.**

Sanverse has one renderer, `ffmpeg-render-adapter.ts`, and one geometry authority,
`visual-normalization.ts`. Gate T0 exists *because* two things calculated the same
geometry separately and drifted apart. A second renderer is that same mistake at
full size.

**3. `EditProject` must not be replaced.**

`EditProject` is the user's work: an ordered list of accepted edits, each one
undoable, each one replayable. A `.wv` script file is a different idea — a
document you run. Swapping one for the other would mean every project ever saved
becomes unreadable, and Undo, history and proposals would all need reinventing.

**4. Integer ticks must not be replaced by CSS animation time.**

```
   Sanverse today          CSS animation
   ──────────────          ─────────────
   1 tick = 1/1,440,000s   seconds, as a decimal
   whole numbers only      0.1 + 0.2 = 0.30000000000000004
   exact, always           drifts a little every time it is added
```

1,440,000 was chosen because it divides exactly by 24, 25, 30, 48, 50, 60 and
more — every frame rate anybody uses lands on a whole number. Decimal seconds do
not. Ten thousand additions of a frame length in decimals ends up visibly off; in
ticks it is exact forever.

## What actually changes because of this document

Nothing in the code. That is the correct outcome, and it is worth saying out loud
rather than inventing a change to look busy: the review found that the four ideas
worth having are ideas Sanverse already implements, one belongs to T7, and one is
a future option with a security condition attached.

The value of the review is the **written refusal** of veed-engine-cli and the
four hard rules above — so that the next person who finds these projects does not
have to work it out again, and does not get it wrong.
