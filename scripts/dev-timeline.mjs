// Dedicated local timeline preview. Never displace the Motion/MCP server on 2000.
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createSanverseServer } from '../apps/api/src/server.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const api = createSanverseServer({
  dataRoot: fileURLToPath(new URL('../.sanverse-data', import.meta.url)),
  maxUploadBytes: 20 * 1024 * 1024 * 1024,
  fontPath: process.platform === 'win32' ? 'C:\\Windows\\Fonts\\arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  allowedOrigins: ['http://localhost:2010', 'http://127.0.0.1:2010'],
})
let web
const stop = async () => {
  await web?.close()
  api.closeAllConnections()
  await new Promise((resolve) => api.close(resolve))
}
try {
  await new Promise((resolve, reject) => {
    api.once('error', reject)
    api.listen(2011, '127.0.0.1', resolve)
  })
  web = await createServer({
    root: `${root}apps/web`,
    configFile: `${root}apps/web/vite.config.ts`,
    server: {
      port: 2010,
      strictPort: true,
      proxy: { '/api': { target: 'http://127.0.0.1:2011', changeOrigin: false } },
    },
  })
  await web.listen()
  console.log(`Timeline editor: http://localhost:2010\nCheckout: ${root}\nAPI: 2011; isolated local data; deterministic test AI. Motion/MCP on 2000 is untouched.`)
} catch (error) {
  await stop()
  throw error
}
process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
