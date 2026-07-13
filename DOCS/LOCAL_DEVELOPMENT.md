# Local Development

This guide starts the current Stage 2 local web application on this Windows computer. It imports an MP4 into a project-owned local copy and supports the bounded point/nameplate preview, in-memory history, and clickable MP4 export loop.

## Normal start on this laptop

The dependencies are already installed. For normal use, do **not** run `npm install` again:

```powershell
cd "C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\Stage 2 Sanverse Editing Workflow"
npm run dev
```

The Windows launcher deliberately runs npm through the installed Node executable. This avoids the `spawn EINVAL` failure caused by trying to execute `npm.cmd` directly with Node 24.

`npm install` is needed only for a first setup, after `package.json` or `package-lock.json` changes, or if `node_modules` was removed or damaged.

`npm run dev` starts two coordinated local processes:

- the only user-facing web address at `http://127.0.0.1:2000`;
- an internal API at `127.0.0.1:2001`, reached by the browser only through the web app's same-origin `/api` proxy.

Do not open port 2001 directly for normal use. Both processes bind to loopback, and stopping the root command stops the pair.

## First installation

Open PowerShell, then run these commands exactly:

```powershell
cd "C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\Stage 2 Sanverse Editing Workflow"
npm install
npm run dev
```

Open this address in a browser:

<http://localhost:2000>

`npm install` downloads the versions recorded in `package-lock.json`. Run it on the first installation, and run it again after pulling a change that updates `package.json` or `package-lock.json`.

## Later runs

For later runs, when dependencies have not changed:

```powershell
cd "C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\Stage 2 Sanverse Editing Workflow"
npm run dev
```

Keep the PowerShell window open while using the app. Press `Ctrl+C` in that window to stop the server.

## If port 2000 is already in use

The app deliberately uses port 2000 and will not silently move to a different port. A second startup currently fails with this visible message:

```text
Error: Port 2000 is already in use
```

1. Check whether the Stage 2 app is already open at <http://localhost:2000>.
2. If another Stage 2 `npm run dev` window is running, press `Ctrl+C` in that window, then start the app again.
3. If another legitimate service uses port 2000, do not change the Stage 2 app port silently. Stop that service only if it is safe, or choose a different arrangement with the owner.

## What happens to the selected video

- The browser streams the selected MP4 to the loopback-only local API; it is not sent to a cloud service.
- The original source remains unchanged. The API writes a separate project-owned `source.mp4`, records its byte size and SHA-256 hash, and publishes the project only after the complete copy and manifest are durable.
- Local project data lives under ignored `.sanverse-data/` in this repository by default. Never commit that folder.
- The project-owned media copy persists locally. Accepted edit history is still in browser memory and is cleared on Back, reload, or project replacement.
- A completed export is stored under the controlled project's `exports/` directory and downloaded through a same-origin project/export URL.
- There is no database, AI editing, persisted edit history, accounts, billing, or cloud storage in this slice.

## Owner walkthrough

A ready 60-second MP4 testing copy now exists at:

```text
C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\Stage 2 Sanverse Editing Workflow\resources\test video\session 3 j curve - 60s app test.mp4
```

It is a separate H.264/AAC MP4 derivative of the supplied MOV; the original MOV remains unchanged. Use that MP4 and check each item in order:

- [ ] Open <http://localhost:2000> and confirm Home appears without advanced editing controls.
- [ ] Type a request in the prompt.
- [ ] Choose or drag and drop an MP4.
- [ ] Confirm Home visibly says it is importing, then Studio opens only after import completes.
- [ ] Confirm Studio shows the selected filename and plays `/api/projects/.../media` through the same web origin.
- [ ] Confirm the carried request is labeled **Draft, not executed**.
- [ ] Pause, choose **Point**, select a place, choose **Add text here**, and create a proposal.
- [ ] Confirm the nameplate appears only in its time window, then Accept, Undo, and Redo it.
- [ ] Confirm **Export** becomes available only after an accepted edit.
- [ ] Choose **Export**, confirm visible rendering progress, then choose **Download MP4** after verification completes.
- [ ] Open the downloaded MP4 and confirm video, audio, duration, and nameplate placement are acceptable.
- [ ] Confirm chat remains explicitly unavailable rather than simulated.
- [ ] Select **Back to Home** and confirm Home returns.
- [ ] Record anything confusing, visually wrong, or slower than expected before G1-01B is considered complete.

Automated browser control still cannot attach the private local fixture through the native file picker. The owner walkthrough above remains the E4 usability gate even when API-level fixture intake passes.
