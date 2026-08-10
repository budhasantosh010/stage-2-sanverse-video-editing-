const media = process.argv[2]
const pages = await (await fetch('http://127.0.0.1:9225/json/list')).json()
const page = pages.find((x) => x.url.includes('127.0.0.1:2000'))
if (!page) throw new Error('No app page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 1
const pending = new Map()
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const entry = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
  else entry.resolve(message.result)
}
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = id++
  pending.set(messageId, { resolve, reject })
  ws.send(JSON.stringify({ id: messageId, method, params }))
})
const evaluateRaw = (expression) => call('Runtime.evaluate', { expression, returnByValue: false, awaitPromise: true, userGesture: true })
const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })).result.value
await call('Runtime.enable')
await call('DOM.enable')
const object = await evaluateRaw(`document.querySelector('input[aria-label="Choose video"]')`)
if (!object.result.objectId) throw new Error('Input object missing')
await call('DOM.setFileInputFiles', { objectId: object.result.objectId, files: [media] })
console.log('after-set', JSON.stringify(await evaluate(`(()=>{const i=document.querySelector('input[aria-label="Choose video"]');return {n:i.files.length,name:i.files[0]?.name,size:i.files[0]?.size}})()`)))
await evaluate(`(()=>{const i=document.querySelector('input[aria-label="Choose video"]');i.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
await new Promise((resolve) => setTimeout(resolve, 1500))
console.log('page', JSON.stringify(await evaluate(`({timeline:!!document.querySelector('[data-project-revision]'),status:[...document.querySelectorAll('[role="status"]')].map(x=>x.textContent),alerts:[...document.querySelectorAll('[role="alert"]')].map(x=>x.textContent)})`)))
ws.close()
