# Motion Language

Default phase allocation:

```text
0%          18%       30%                         80%       100%
|------------|---------|----------------------------|----------|
ENTER        SETTLE                  HOLD           EXIT
```

This is a reusable default, not a mandatory timing for every component.

`motionIntensity` is semantic: 0 removes non-essential movement, 0.3 is subtle, 0.6 standard and 1 energetic. Reduced motion preserves meaning with short opacity/reveal behavior while removing large movement, spring and stagger.

Components expose normalized semantic events such as `enter-start`, `reveal-start`, `reveal-peak`, `settled`, `count-start`, `count-end`, `exit-start` and `exit-peak`. Plan A defines events only; it does not attach sounds or production actions.
