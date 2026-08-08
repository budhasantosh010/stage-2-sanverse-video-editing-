# T3 Long Form Bounds

The T3 stress fixture is a schema-valid 60-minute composition containing 250 primary clips. It is constructed directly as an initial composition so the measurement covers one precision-planner call instead of replaying 249 historical Split revisions.

Observed automated gate (65/65 focused long-form/precision/media tests, ~5.2 s):
- Ripple timing changes are bounded by the target plus affected downstream primary clips, never frames/pixels/project seconds.
- Roll, Slip and Slide modify at most three clip timing states; two-point Multi-Roll modifies at most four.
- active Trim View requests at most four exact source frames.
- Gate-D browser controller remains capped at six concurrent requested resources and existing derived-media cache/process bounds are reused.
- no full-project serialization, render-plan rebuild or whole-file frame sheet is performed on pointer movement.

The broader T3 interaction matrix passed 227/227, including existing long-form decoration/virtualization tests and one-video authority.
