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
const value = (await call('Runtime.evaluate', { expression: `({revision:Number(document.querySelector('[data-project-revision]')?.dataset.projectRevision??-1),tracks:[...document.querySelectorAll('[data-track-display-id]')].map((h)=>({label:h.dataset.trackDisplayId,id:h.dataset.trackId,role:h.dataset.trackRole,text:h.textContent.trim().slice(0,220),buttons:[...h.querySelectorAll('button')].map(b=>({text:b.textContent.trim(),disabled:b.disabled,aria:b.getAttribute('aria-label')}))}))})`, returnByValue: true })).result.value
console.log(JSON.stringify(value, null, 2))
ws.close()
