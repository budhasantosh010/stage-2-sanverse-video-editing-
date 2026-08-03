export function MonitorSafeAreas({ visible }: Readonly<{ visible: boolean }>) {
  if (!visible) return null
  return <div className="editor-monitor__safe-areas" aria-hidden="true"><span className="editor-monitor__safe-action" /><span className="editor-monitor__safe-title" /><span className="editor-monitor__guide-x" /><span className="editor-monitor__guide-y" /></div>
}
