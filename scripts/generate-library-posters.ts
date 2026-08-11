import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOTION_LIBRARY_CATALOG, filterMotionLibraryCatalog } from '@sanverse/motion-library'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'motion/library-previews/posters')
const manifestPath = resolve(root, 'motion/library-previews/poster-manifest.v1.json')
const serverUrl = 'http://127.0.0.1:2010'
const args = new Set(process.argv.slice(2))
const valueAfter = (flag: string) => { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] : undefined }
const component = valueAfter('--component')
const category = valueAfter('--category')
const force = args.has('--force')
const all = args.has('--all') || (!component && !category)
const staleOnly = args.has('--stale') || (!force && all)
const edge = process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : process.env.CHROME_BIN ?? 'google-chrome'

interface PosterManifestV1 { readonly schemaVersion: 'sanverse.library-posters/v1'; readonly generatedAt: string; readonly posters: Readonly<Record<string, Readonly<{ previewHash: string; file: string }>>> }
const emptyManifest = (): PosterManifestV1 => ({ schemaVersion: 'sanverse.library-posters/v1', generatedAt: new Date(0).toISOString(), posters: {} })
const loadManifest = async (): Promise<PosterManifestV1> => { try { const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as PosterManifestV1; return parsed.schemaVersion === 'sanverse.library-posters/v1' ? parsed : emptyManifest() } catch { return emptyManifest() } }
const exists = async (path: string) => { try { return (await stat(path)).isFile() } catch { return false } }
const serverReady = async () => { try { return (await fetch(`${serverUrl}/library`)).ok } catch { return false } }
const waitForServer = async () => { for (let attempt = 0; attempt < 40; attempt += 1) { if (await serverReady()) return; await new Promise((resolveDelay) => setTimeout(resolveDelay, 250)) } throw new Error('Motion Lab did not become ready on port 2010.') }

const selected = component
  ? MOTION_LIBRARY_CATALOG.filter((entry) => entry.componentId === (component.startsWith('sanverse.') ? component : `sanverse.${component}`))
  : category
    ? filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { category: category as never })
    : MOTION_LIBRARY_CATALOG
if (!selected.length) throw new Error('No Creative Library components matched poster selection.')

await mkdir(outputDir, { recursive: true })
let startedServer: ReturnType<typeof spawn> | null = null
if (!(await serverReady())) {
  startedServer = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','dev','--workspace=@sanverse/motion-lab','--','--host','127.0.0.1','--port','2010','--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true })
  await waitForServer()
}

const previous = await loadManifest()
const posters: Record<string, { previewHash: string; file: string }> = { ...previous.posters }
let generated = 0, skipped = 0
try {
  for (const entry of selected) {
    const fileName = `${entry.componentId}.png`
    const target = resolve(outputDir, fileName)
    const fresh = previous.posters[entry.componentId]?.previewHash === entry.preview.previewHash && await exists(target)
    if (!force && staleOnly && fresh) { skipped += 1; continue }
    const url = `${serverUrl}/library/poster/${encodeURIComponent(entry.componentId)}`
    const result = spawnSync(edge, ['--headless=new','--disable-gpu','--hide-scrollbars','--window-size=480,270','--force-device-scale-factor=1','--virtual-time-budget=1200',`--screenshot=${target}`,url], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000 })
    if (result.status !== 0 || !(await exists(target))) throw new Error(`Poster generation failed for ${entry.componentId}: ${result.stderr || result.stdout || `exit ${result.status}`}`)
    posters[entry.componentId] = { previewHash: entry.preview.previewHash, file: `posters/${fileName}` }
    generated += 1
    process.stdout.write(`POSTER ${entry.componentId} ${entry.preview.previewHash}\n`)
  }
} finally {
  if (startedServer) startedServer.kill()
}
await writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 'sanverse.library-posters/v1', generatedAt: new Date().toISOString(), posters }, null, 2)}\n`, 'utf8')
console.log(`POSTER_SUMMARY selected=${selected.length} generated=${generated} skippedFresh=${skipped} catalog=${MOTION_LIBRARY_CATALOG.length}`)
