# ADR-004 — The assistant proposes; deterministic code executes

- Status: Accepted
- Date: 2026-07-27
- Applies from: G4-B onwards

## The problem

Everything before this point was typed by a person. From G4-B on, a sentence
typed into a chat box can cause an edit. That sentence is processed by something
that can be talked into things, and its reply arrives as data from outside the
program.

The failure to avoid is not "the AI is wrong". A wrong suggestion the user can
see and reject is a normal, survivable event. The failure to avoid is **an
instruction becoming an action without a person agreeing to it.**

## Decisions

### The provider never returns an operation

A provider returns an `IntentCandidate`: a claim about which capability applies
and a bag of raw arguments. It is not an operation, not a change set, and not a
render plan. Deterministic code builds the operation.

The gap is the whole defence. If a provider could return an operation, then
anything that can influence what a provider says — a sentence in the user's own
video, a filename, text pasted from a website — could write into the project.

### The reply's shape is closed, and an unknown key is a refusal

`validateIntentCandidate` accepts an exact set of keys. `{"shellCommand": ...}`,
a whole operation object, or an extra field is rejected outright. The extra is
never stripped and the rest used, because "mostly what it said" is not what
anyone approved.

### A capability that was not offered has no code path

The service intersects the requested capabilities with the registry, and a reply
naming anything else is refused. This is what makes prompt injection
uninteresting: a provider that has been persuaded to say
`sanverse.shell.run/v1` is naming something no code will ever look up.

### The provider does not choose positions or times it was not told

When it leaves a field null, deterministic code fills it from what the user was
actually doing — where they pointed, where the playhead is — or asks one short
question. Null means "I do not know", which is a good answer. A model guessing
a position is how a nameplate lands on someone's face.

### One request equals one proposal, never an application

The AI route returns a **pending** change set and writes nothing. Acceptance
goes through the same `POST /change-sets` route a hand-made edit uses, with the
same revision fence, the same validators, and the same one-Undo guarantee.

### Provenance is recorded and shown

An accepted AI change set is stored with `source: "ai"` and the request ID that
produced it, and the pending proposal says "Suggested by the assistant" on
screen. This survives repair: a proposal the user edited by hand is still
recorded as having been suggested.

### Repair does not re-ask

Changing the wording, the timing, or the position of a pending proposal is local
and instant. Re-asking would discard everything already right and return a new
answer that has to be judged from scratch.

### Clarification is bounded to facts that change the edit

Six fields, listed in the domain: main text, second line, position, start, how
long, which clip. There is no free-form question, so the product cannot drift
into interviewing the user instead of editing.

### Nothing leaves the machine without an allowlist

`outbound-data-policy.ts` builds the only object a provider is ever handed. The
video, every filesystem path, the original filename, the project and clip IDs,
the edit history, and the file hash are all excluded by construction — the
sender is never given them. What is sent: the typed message, the language, the
capability list, the frame size, three times in seconds, and the pointed-at
spot. A payload is re-checked immediately before the wire, because once bytes
leave they may be logged or cached by someone else and cannot be recalled.

### The default provider is a fake

The build ships with a deterministic fake. Nothing goes anywhere until a real
provider is deliberately configured. The fake also behaves badly on purpose —
it tries to smuggle a made-up capability, replies in prose, and returns
out-of-range values — because a real model will do all three and the only way to
know the system survives is to make it happen every test run.

## Consequences

- Adding a capability means adding it to the registry and to the operation
  domain. It cannot be added by prompt.
- Every provider swap re-runs the same corpus unchanged, because the corpus
  asserts product behaviour and never model wording.
- Latency is now user-visible in a way it was not before; the chat has an
  explicit "working" state and the project is untouched while it waits.
- A stale revision is detected before the provider is called, so a wasted call
  costs nothing.

## Not decided here

- Which real provider. That is an adapter choice, deliberately deferred to
  G4B-10, and it needs the owner's decision about data leaving the machine.
- Multi-step requests ("tighten my intro"). One request currently produces at
  most one operation. Compound workflows are G7.
