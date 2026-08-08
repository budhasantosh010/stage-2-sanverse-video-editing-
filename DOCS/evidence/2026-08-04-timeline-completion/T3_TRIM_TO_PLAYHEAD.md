# T3 Trim To Playhead and Extend Edit

Timeline commands exist in the shared keyboard/command authority for:
- Trim Start to Playhead (`Q`),
- Trim End to Playhead (`W`),
- Ripple Trim Start (`Shift+Q`),
- Ripple Trim End (`Shift+W`),
- Extend Nearest Edit (`E`).

They do not contain separate mutation logic. They translate the current playhead/selection into the existing Standard/Ripple/Roll planner requests. Nearest-edit ties use deterministic earlier-cut ordering.

Focused component/planner tests cover valid/invalid playhead positions and deterministic nearest-left/right behavior. In the headless Edge evidence project, scripted menu activation was visible but the automation could not establish a stable playhead-inside-selection state after API hot reload, so the browser run did not use those zero-delta attempts as acceptance evidence; the typed command matrix remains covered by the passing automated suite.
