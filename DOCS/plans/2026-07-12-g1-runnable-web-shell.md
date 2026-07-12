# G1 Runnable Web Shell Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build the first runnable Stage 2 web interface so the owner can start it at http://localhost:2000, select a cleaned local MP4, move from Home to Studio, preview the video, and evaluate the interaction without any fake editing behavior.

**Architecture:** Use an npm workspace with a React and TypeScript application under apps/web. Keep screen state, local-media intake, and presentation separate so the shell can survive later backend and renderer integration. This slice is browser-only: the selected file stays local through an object URL, and no upload, persistence, AI, render, or export capability is implied.

**Tech Stack:** npm workspaces, React, TypeScript, Vite, Vitest, React Testing Library, CSS. The generated package lock pins actual dependency versions during implementation.

---

## AOCS Omega decision

Classification: Type 2, medium risk, fractal depth 1.

Root problem: the owner cannot validate the intended low-learning-curve workflow because only static wireframes and isolated renderer spikes exist.

Highest-value vertical: a real Home-to-Studio browser loop.

Red-team challenge: a frontend-only prototype could become throwaway code or mislead the owner into believing editing works.

Mitigation: production-quality module boundaries, typed state, automated tests, real local video preview, strict unavailable states, and no backend until a verified workflow needs it.

## Slice boundary

Included:

- Root command starts the web development server.
- Browser URL is exactly http://localhost:2000.
- Port 2000 is strict; occupied means a visible startup failure.
- Calm Home screen with prompt, drop zone, file picker, and recent-project empty state.
- MP4 selection transitions to Studio.
- Studio previews the selected local video.
- Draft prompt is carried into Studio but explicitly not executed.
- Return Home action cleans up the object URL.
- Desktop-first responsive black, white, and grayscale styling.
- Automated tests, production build, and a manual owner walkthrough.

Excluded:

- Backend/API server.
- Upload to cloud or local persistence.
- Database, authentication, and accounts.
- Timeline editing or drawing tools.
- AI requests or agent orchestration.
- Renderer integration and export.
- HyperFrames installation/execution.

## Acceptance criterion

From the repository root:

    npm install
    npm run dev

must start the browser application at:

    http://localhost:2000

The owner must be able to select or drop a cleaned MP4, enter Studio, play the local video, see the draft request labeled as not executed, return Home, and understand which capabilities are unavailable. Starting a second server on port 2000 must fail instead of selecting another port.

### Task 1: Create the reproducible web workspace

**Objective:** Establish one root command and strict port configuration without introducing backend infrastructure.

**Files:**

- Create: package.json
- Create: package-lock.json
- Create: apps/web/package.json
- Create: apps/web/index.html
- Create: apps/web/tsconfig.json
- Create: apps/web/tsconfig.app.json
- Create: apps/web/tsconfig.node.json
- Create: apps/web/vite.config.ts
- Create: apps/web/vite.config.test.ts
- Create: apps/web/src/main.tsx

**Step 1: Create the root workspace, then scaffold dependencies**

Create the root package.json first:

    {
      "name": "sanverse-stage-2",
      "private": true,
      "workspaces": ["apps/*"],
      "scripts": {
        "dev": "npm run dev --workspace apps/web",
        "test": "npm run test --workspace apps/web",
        "build": "npm run build --workspace apps/web"
      }
    }

Then run:

    npm create vite@latest apps/web -- --template react-ts
    npm install
    npm install --workspace apps/web --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event

Add the web-workspace test script:

    "test": "vitest"

Expected: apps/web exists, the root recognizes it as a workspace, and package-lock.json records exact resolved versions.

**Step 2: Write the failing port test**

Create apps/web/vite.config.test.ts:

    import type { UserConfig } from "vite";
    import { describe, expect, test } from "vitest";
    import config from "./vite.config";

    describe("local server contract", () => {
      test("uses the owner-reserved strict local port", () => {
        const server = (config as UserConfig).server;
        expect(server?.port).toBe(2000);
        expect(server?.strictPort).toBe(true);
      });
    });

Run:

    npm test -- --run vite.config.test.ts

Expected: FAIL because the strict port is not configured.

**Step 3: Configure port 2000**

Create apps/web/src/test/setup.ts:

    import "@testing-library/jest-dom/vitest";

In apps/web/vite.config.ts, export:

    import react from "@vitejs/plugin-react";
    import { defineConfig } from "vitest/config";

    export default defineConfig({
      plugins: [react()],
      server: {
        host: "127.0.0.1",
        port: 2000,
        strictPort: true,
      },
      test: {
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
      },
    });

**Step 4: Verify**

Run:

    npm test -- --run vite.config.test.ts
    npm run build

Expected: port test passes and production build succeeds.

**Step 5: Commit**

    git add package.json package-lock.json apps/web
    git commit -m "build: scaffold strict-port web workspace"

### Task 2: Add the typed Home-to-Studio state model

**Objective:** Keep navigation and project-entry rules outside UI components.

**Files:**

- Create: apps/web/src/app/app-state.ts
- Create: apps/web/src/app/app-state.test.ts

**Step 1: Write failing state tests**

Test these transitions:

    const home = createInitialState();
    expect(home.screen).toBe("home");

    const studio = openLocalProject(home, {
      name: "cleaned.mp4",
      mediaUrl: "blob:test",
      draftRequest: "Add my name here",
    });
    expect(studio.screen).toBe("studio");

    expect(returnHome(studio)).toEqual({ screen: "home", draftRequest: "" });

**Step 2: Run RED**

    npm test -- --run src/app/app-state.test.ts

Expected: FAIL because the state module does not exist.

**Step 3: Implement the minimum model**

Use a discriminated union:

    export type AppState =
      | { screen: "home"; draftRequest: string }
      | {
          screen: "studio";
          project: {
            name: string;
            mediaUrl: string;
            draftRequest: string;
          };
        };

Export createInitialState, updateDraftRequest, openLocalProject, and returnHome as pure functions.

**Step 4: Run GREEN**

    npm test -- --run src/app/app-state.test.ts

Expected: all state tests pass.

**Step 5: Commit**

    git add apps/web/src/app
    git commit -m "feat: add typed Home-to-Studio state"

### Task 3: Add safe local MP4 intake

**Objective:** Accept a real local MP4 without uploading or mutating it.

**Files:**

- Create: apps/web/src/features/local-media/local-media.ts
- Create: apps/web/src/features/local-media/local-media.test.ts

**Step 1: Write failing validation tests**

Cover:

- video/mp4 is accepted.
- A file named with the .mp4 extension and an empty MIME type is accepted for Windows/browser compatibility.
- A non-MP4 filename with an empty MIME type is rejected.
- text/plain is rejected.
- empty file selection is rejected.
- object URL creation is called once.
- cleanup revokes the exact object URL.

Example:

    expect(() => validateLocalVideo(new File(["x"], "notes.txt", { type: "text/plain" })))
      .toThrow("Choose an MP4 video");

**Step 2: Run RED**

    npm test -- --run src/features/local-media/local-media.test.ts

Expected: FAIL because the module does not exist.

**Step 3: Implement**

Export:

    validateLocalVideo(file: File): void
    createLocalMediaHandle(file: File): {
      file: File;
      url: string;
      dispose(): void;
    }

Use URL.createObjectURL and URL.revokeObjectURL. Do not read file bytes into application state and do not send a network request.

**Step 4: Run GREEN**

    npm test -- --run src/features/local-media/local-media.test.ts

Expected: all local-media tests pass.

**Step 5: Commit**

    git add apps/web/src/features/local-media
    git commit -m "feat: add local MP4 intake"

### Task 4: Build the calm Home screen

**Objective:** Reproduce the approved progressive-disclosure entry experience as a real accessible screen.

**Files:**

- Create: apps/web/src/screens/home/HomeScreen.tsx
- Create: apps/web/src/screens/home/HomeScreen.test.tsx
- Create: apps/web/src/screens/home/HomeScreen.css

**Step 1: Write failing interaction tests**

Verify:

- Heading asks what the user wants to edit.
- Advanced editing controls are absent.
- Prompt input is accessible by label.
- Choose video button opens the hidden file input.
- Dropping an MP4 calls onStartProject with the file and draft prompt.
- Invalid files show a visible error.
- Recent projects shows an honest empty state.

**Step 2: Run RED**

    npm test -- --run src/screens/home/HomeScreen.test.tsx

Expected: FAIL because HomeScreen does not exist.

**Step 3: Implement the screen**

Component contract:

    type HomeScreenProps = {
      draftRequest: string;
      onDraftRequestChange(value: string): void;
      onStartProject(file: File): void;
    };

The visual hierarchy is:

- Small Sanverse mark.
- Central heading.
- One large prompt/file composer.
- Drop instruction and Choose video action.
- Recent projects empty state.
- No timeline, canvas tools, history, export, or effects.

**Step 4: Run GREEN**

    npm test -- --run src/screens/home/HomeScreen.test.tsx

Expected: Home interaction tests pass.

**Step 5: Commit**

    git add apps/web/src/screens/home
    git commit -m "feat: build calm project Home"

### Task 5: Build the honest Studio shell

**Objective:** Let the owner preview the selected video and evaluate the second-screen layout without implying editing works.

**Files:**

- Create: apps/web/src/screens/studio/StudioScreen.tsx
- Create: apps/web/src/screens/studio/StudioScreen.test.tsx
- Create: apps/web/src/screens/studio/StudioScreen.css

**Step 1: Write failing Studio tests**

Verify:

- Selected filename appears.
- Video element uses the local object URL.
- Draft request appears under a Draft, not executed label.
- Chat send, edit acceptance, and export are disabled or labeled unavailable.
- Back to Home calls the supplied callback.
- Canvas, conversation panel, and simple time strip regions have accessible labels.

**Step 2: Run RED**

    npm test -- --run src/screens/studio/StudioScreen.test.tsx

Expected: FAIL because StudioScreen does not exist.

**Step 3: Implement**

Component contract:

    type StudioScreenProps = {
      project: {
        name: string;
        mediaUrl: string;
        draftRequest: string;
      };
      onBack(): void;
    };

Render the actual browser video control and static shell regions. Do not create fake timeline edits or export downloads.

**Step 4: Run GREEN**

    npm test -- --run src/screens/studio/StudioScreen.test.tsx

Expected: Studio tests pass.

**Step 5: Commit**

    git add apps/web/src/screens/studio
    git commit -m "feat: build honest Studio shell"

### Task 6: Connect the app and clean media lifecycle

**Objective:** Complete one real Home-to-Studio-to-Home loop without leaking object URLs.

**Files:**

- Create: apps/web/src/app/App.tsx
- Create: apps/web/src/app/App.test.tsx
- Modify: apps/web/src/main.tsx
- Delete only if generated and unused: apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/assets/react.svg

**Step 1: Write the failing integration test**

Simulate:

1. Type a draft request.
2. Select cleaned.mp4.
3. Confirm Studio appears with the video and draft label.
4. Click Back to Home.
5. Confirm URL.revokeObjectURL received the created URL.

**Step 2: Run RED**

    npm test -- --run src/app/App.test.tsx

Expected: FAIL because the application coordinator does not exist.

**Step 3: Implement**

App owns only:

- Current AppState.
- Current LocalMediaHandle.
- Transition coordination.
- Object URL cleanup on return and unmount.

HomeScreen and StudioScreen remain presentation components.

**Step 4: Run GREEN and regression suite**

    npm test -- --run src/app/App.test.tsx
    npm test -- --run

Expected: all tests pass.

**Step 5: Commit**

    git add apps/web/src
    git commit -m "feat: connect runnable Home-to-Studio loop"

### Task 7: Apply the approved visual language and accessibility gate

**Objective:** Make the runnable shell visually faithful enough for owner evaluation without decorative scope.

**Files:**

- Create: apps/web/src/styles/tokens.css
- Create: apps/web/src/styles/global.css
- Modify: apps/web/src/main.tsx
- Modify: Home and Studio CSS files
- Add or modify relevant component tests

**Step 1: Add failing checks**

Assert that:

- Focusable controls have accessible names.
- Error and unavailable messages are exposed to assistive technology.
- Primary flow is keyboard usable.
- No decorative gradient token exists.
- Reduced-motion users receive no unnecessary animation.

**Step 2: Implement**

Use:

- Black, white, and grayscale tokens.
- One readable sans-serif stack.
- Thin borders, generous whitespace, restrained radii.
- Visible focus rings.
- Responsive layout that remains usable below desktop width.
- No ornamental animation or gradient.

**Step 3: Verify**

    npm test -- --run
    npm run build

Expected: all tests and production build pass.

**Step 4: Commit**

    git add apps/web
    git commit -m "style: apply accessible Sanverse visual system"

### Task 8: Add the exact owner startup and walkthrough guide

**Objective:** Let a non-technical owner start and evaluate the app without guessing.

**Files:**

- Create: DOCS/LOCAL_DEVELOPMENT.md
- Modify: README.md
- Modify: DOCS/CURRENT_STATE.md
- Modify: DOCS/BUILD_TRACKER.md
- Modify: DOCS/PROJECT_LOG.md
- Create: DOCS/changes/2026-07-12-runnable-web-shell.md

**Step 1: Document exact startup**

Guide:

    cd "C:UsersLenovoMusicStartupsYT AutomationsA1 Talking Head Youtube VideoSanverse YT ChannelStage 2 Sanverse Editing Workflow"
    npm install
    npm run dev

Open:

    http://localhost:2000

Include port-conflict troubleshooting and the clear distinction between local video preview and upload.

**Step 2: Manual owner walkthrough**

Record:

1. Home initially contains no editing controls.
2. Prompt can be entered.
3. MP4 can be selected or dropped.
4. Studio opens and video plays.
5. Draft is labeled not executed.
6. Editing/export actions are unavailable rather than simulated.
7. Back returns Home.
8. A second server process fails on port 2000.

**Step 3: Final verification**

    npm test -- --run
    npm run build
    powershell -ExecutionPolicy Bypass -File hooks/verify_governance.ps1
    git diff --check

Expected: all checks pass.

**Step 4: Independent review and coherent commit**

Run the pre-commit verification pipeline, then:

    git add README.md package.json package-lock.json apps/web DOCS
    git commit -m "[verified] feat: add runnable Home-to-Studio web shell"
    git push origin main

## Owner review gate

After implementation, stop and let the owner use the interface. Record corrections before resuming HyperFrames or hybrid renderer work.

The shell is accepted only if the owner can explain:

- where to start;
- how to choose a video;
- why Studio appears only afterward;
- what is real;
- what is intentionally unavailable;
- whether the experience feels calm enough compared with the OpenDesign reference.