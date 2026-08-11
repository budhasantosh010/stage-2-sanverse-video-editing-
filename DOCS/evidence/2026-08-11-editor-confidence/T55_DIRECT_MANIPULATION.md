# T5.5 Direct Manipulation

Implemented confidence changes:

- trim handles: 18 px desktop hit width / 24 px mobile hit width, with a restrained 4 px visible edge mark;
- visible trim marks sit outside clip edges instead of covering filmstrip/waveform content;
- Razor uses a crosshair; movable overlay/music items use grab/grabbing;
- dragged Timeline items render above ordinary content;
- snap guide names the target (`Playhead`, `Marker`, `Clip edge`);
- Shift drag bypass remains supported; drag state tracks snapping bypass;
- Timeline vertical scrolling is internal and synchronizes body/header rows;
- ruler/header remain sticky within the Timeline viewport;
- actionable empty-row copy replaces a dead `Empty` label.

All edit commits still use pre-existing T0–T5 authorities.
