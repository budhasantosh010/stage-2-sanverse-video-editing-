# T3 Audio Scrubbing

Audio Scrubbing is presentation state. It reuses the T2 composition-audio controller and shared composition clock.

It does not create:
- an EditProject field,
- a revision/history record,
- one AudioContext per clip,
- a second audible video/audio element,
- overlapping uncontrolled snippets.

Each movement replaces the previous bounded snippet and inherits current A1/A2 mute, gain, fades, pan, linked J/L windows, speed and reverse policy.

Real Edge toggled Audio Scrubbing on/off with revision unchanged. The full web suite covers A1/A2/J-L/speed/reverse/muted cleanup behavior.
