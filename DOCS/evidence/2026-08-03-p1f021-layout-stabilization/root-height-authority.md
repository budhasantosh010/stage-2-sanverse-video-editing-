# Root height authority

Desktop: `html`, `body`, `#root`, `EditorShell`, workspace, Studio screen, and nested groups form one `100dvh`/`min-height: 0` chain. The shell owns viewport clipping; panel bodies own intentional internal scrolling.

Below 981 px: `html`, `body`, `#root`, EditorShell, and nested groups switch to `height: auto`; the document becomes the vertical scroll authority.

Browser evidence: desktop document overflow remained 0; mobile document height expanded to 1,209 px and the 492 px Timeline was reachable at the bottom.
