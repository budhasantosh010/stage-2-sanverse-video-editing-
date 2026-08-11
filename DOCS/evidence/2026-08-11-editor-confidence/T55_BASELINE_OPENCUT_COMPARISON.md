# T5.5 Baseline — OpenCut Comparison

Date: 2026-08-11
Base: `a89483deea214927bf44b6d82229ca6ffa72650c`
Branch: `timeline-t55-editor-confidence`

## Purpose

T5.5 compares interaction confidence, not feature count. The owner implementation brief identifies OpenCut Classic v0.3 as the reference for predictable selection, drag, trim, scrolling, properties and playback interaction.

## Verified Sanverse machine baseline

- T5 base: 2,501/2,501 tests, all-workspace build PASS.
- T5.5 current machine suite: 2,510/2,510 tests PASS.
- T5.5 all-workspace production build: PASS.
- No T6/T7 capability was added.

## Owner same-task baseline

**PENDING OWNER SESSION.**

The required 25-step OpenCut-vs-Sanverse recording, timing, accidental-action counts and 1–5 owner scores cannot be produced by automated tests and are not invented here. Complete the owner session before declaring T5.5 verified.

## Machine-discovered baseline defect

A concrete confidence defect was found before owner scoring: Razor was visibly enabled and described as a working clip-cut tool, but clips did not receive/read the active tool, so clicking with Razor did not route a split. T5.5 now routes Razor through the existing split authority and holds it with regression coverage.
