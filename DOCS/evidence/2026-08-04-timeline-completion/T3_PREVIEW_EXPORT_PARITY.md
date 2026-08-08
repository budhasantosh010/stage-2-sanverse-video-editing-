# T3 Preview / Export Parity

T3 does not add a new project or render schema. Precision planners update the existing v5 primary timing state; Preview and the v8 render compiler already consume that accepted timing authority.

Real owner-media export was triggered from the product UI after accepted T3 timing edits. Downloaded MP4:
- container: MP4 (`mov,mp4,m4a,3gp,3g2,mj2`)
- video: H.264 High, 1920x1080, SAR 1:1, 30 fps, 717 frames
- audio: AAC-LC stereo, 48 kHz
- duration: 23.900000 s
- size: 10,899,271 bytes
- SHA-256: `79FDA906C32B6454ED83B6A8FF1F513C906B7770690A82086E49F9F695E08F38`

Start (2 s), middle (12 s), and end (22.5 s) frames were decoded and visually inspected. Landscape source is full frame; the portrait source remains correctly contained with intentional side bars. No precision-edit black gap, stretch, decode failure, or geometry corruption was observed.

Evidence frames: `t3-export-frames/`.
