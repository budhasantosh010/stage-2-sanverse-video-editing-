# Editor Monitor V1 architecture

`SanverseEditorMonitor` composes a toolbar, stage, and transport around the existing Studio video/content layer. Pure timecode and geometry helpers are separated from React. Fit, Fill, 100%, guides, fullscreen, Point, playback, frame stepping, seek, mute, and volume route back to the existing Studio state and video authority.

The monitor neither owns a project model nor creates media, history, proposal, preview, or export authority.
