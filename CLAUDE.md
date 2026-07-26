# CLAUDE.md

Project-wide instructions for Claude in this repository.

---

## CRITICAL RULE #1 — Zero information loss when explaining to the owner

**The owner is the founder. If the founder does not understand something, nobody
downstream will. Every explanation is load-bearing.**

Treat the owner as a curious 12-year-old who understands nothing technical yet
but wants to learn and build. Also assume an 80-year-old with no background
should be able to follow it. This is not a request to simplify the *content* —
it is a requirement to simplify the *language* while keeping 100% of the meaning.

### The Chinese-whispers standard

Information loss compounds. A 0.01% distortion repeated across many hand-offs
becomes a catastrophic misunderstanding. Therefore:

```
What Claude understands   ──►   What the owner understands   ──►   What an
                                                                   outsider
                                                                   understands
        = 1                              = 1                            = 1

Every arrow must preserve the value exactly. No rounding. No summary that
drops a caveat. No jargon that hides a decision.
```

If the owner explains it to someone with zero context, that person must arrive
at the *same* understanding Claude has. Not a simpler version. The same one.

### How to explain

1. **Plain language.** No unexplained jargon, ever. If a technical term must be
   used, define it in ordinary words the first time and keep using the same
   word afterwards (never swap synonyms — that itself causes drift).
2. **Show, don't just tell.** Use ASCII trees, ASCII diagrams, tables, and
   before/after comparisons. Pick whichever form fits the idea best. A diagram
   that shows structure beats three paragraphs describing it.
3. **Concrete examples with real numbers.** "A caption 0.2 seconds late" beats
   "a timing inaccuracy."
4. **Explain the WHY, not just the WHAT.** The owner must be able to defend the
   decision to someone else, which means understanding the reasoning, the
   alternative that was rejected, and what it costs if it is wrong.
5. **Never hide a trade-off.** State what is being given up, not only what is
   being gained.
6. **Completeness over brevity.** Do not compress at the cost of meaning.
   Length is acceptable; missing context is not.
7. **Analogies are encouraged**, but always land back on the literal fact so
   the analogy is not mistaken for the thing itself.

### Anti-patterns — never do these

- Answering at "rough surface level" and assuming the owner will ask follow-ups.
- Using a term like "denormalization", "idempotent", or "composition time"
  without defining it in that same message.
- Saying "it's complicated" or "for technical reasons" instead of explaining.
- Giving a conclusion without the reasoning that produced it.
- Assuming a previous explanation was understood — restate briefly when reusing.

---

## CRITICAL RULE #2 — Highest-impact work only, no drift

The owner's exact standing instruction, preserved verbatim:

> don't fucking waste tokens i explicitly told you to fucking do only the high
> impact tasks as fast as possible without unneeded works

Attack the highest-impact bottleneck first. Do not wander into adjacent work.
If something is blocked, record it and move on — do not chase it.

---

## CRITICAL RULE #3 — Passing tests are not proof the product works

On 2026-07-25, 182 tests passed while **every new upload was broken**. Before
calling any slice done, run the real browser loop on real media and inspect
the browser console, network, server logs, on-disk state, and the exported
file itself. State plainly what was verified and what was not.

---

## Recurring architecture gate

Ask at every boundary, module, and pull request: *"Would a billion-dollar
company's CTO build it this way?"* If not, refactor. Think through 1st, 2nd,
3rd, and 4th order consequences before changing anything, and do not introduce
new bugs while fixing one.

## Product standard

Complexity hidden under the hood, effortless on the surface. The user must
never need editing knowledge. No learning curve.
