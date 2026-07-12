# Local Development

This guide starts the current Stage 2 frontend on this Windows computer. The runnable application is a browser-only Home-to-Studio shell. It does not yet upload, save, edit, render, or export a video.

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

- The browser creates a temporary local object URL for the selected file. The app does not upload the file.
- The source video remains unchanged.
- The object URL is revoked when you select **Back to Home** or when the app is unmounted/closed.
- There is no backend, database, cloud storage, persistence, AI editing, real edit execution, render, or export in this slice.

## Owner walkthrough

Use a cleaned local MP4 and check each item in order:

- [ ] Open <http://localhost:2000> and confirm Home appears without advanced editing controls.
- [ ] Type a request in the prompt.
- [ ] Choose or drag and drop an MP4.
- [ ] Confirm Studio opens, shows the selected filename, and plays the local video.
- [ ] Confirm the carried request is labeled **Draft, not executed**.
- [ ] Confirm editing, accepting/sending, and export controls are disabled or explicitly unavailable rather than simulated.
- [ ] Select **Back to Home** and confirm Home returns.
- [ ] Record anything confusing, visually wrong, or slower than expected before G1-01B is considered complete.

The agent could verify Home in a live browser, but its browser-control surface could not attach a local file to the native file input. The owner walkthrough above is therefore still required.
