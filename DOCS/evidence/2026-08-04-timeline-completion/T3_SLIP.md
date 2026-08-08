# T3 Slip

Slip changes source In/Out while keeping composition start, composition end, duration and neighboring positions fixed.

Real Edge proof on `primary-30s.mp4`:
- accepted revision 44;
- composition start unchanged;
- duration unchanged;
- source interval moved -48,000 ticks;
- Undo restored the prior source window.

The planner explicitly handles speed/reverse and preserves linked A1/J-L semantics. Freeze is refused because a held source instant has no source interval to slip.

Trim View shows exact `New Source In` and `New Source Out` frames through the existing Gate-D derived-frame controller.
