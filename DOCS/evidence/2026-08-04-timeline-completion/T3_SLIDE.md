# T3 Slide

Slide moves the selected primary clip in composition while preserving its source interval. Its two neighbors compensate by trimming/growing so the total sequence duration stays unchanged.

Real Edge proof:
- accepted revision 46;
- selected source interval unchanged;
- selected composition moved +48,000 ticks;
- total primary sequence duration unchanged.

The planner validates both neighbors, source handles, rational speed, reverse, linked audio/J-L state, Freeze, transitions, groups and track locks before returning one compound plan.

Trim View is bounded to at most four exact source frames: left boundary, selected In, selected Out and right boundary.
