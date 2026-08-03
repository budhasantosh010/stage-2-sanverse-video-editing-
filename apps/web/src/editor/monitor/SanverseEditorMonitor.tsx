import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MonitorStage } from './MonitorStage'
import { MonitorToolbar } from './MonitorToolbar'
import { MonitorTransport } from './MonitorTransport'
import type { EditorMonitorProps } from './monitor-contract'
import './SanverseEditorMonitor.css'

const ownsNativeKeyboard = (target: EventTarget | null): boolean => target instanceof Element && Boolean(target.closest('button, input, textarea, select, a[href], [contenteditable="true"]'))

export function SanverseEditorMonitor(props: EditorMonitorProps) {
  const rootRef = useRef<HTMLElement>(null)
  const [fullscreenFallback, setFullscreenFallback] = useState(false)
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  useEffect(() => {
    const sync = () => setNativeFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const fullscreen = () => {
    if (fullscreenFallback) { setFullscreenFallback(false); return }
    if (document.fullscreenElement === rootRef.current) { void document.exitFullscreen?.(); return }
    const requestFullscreen = rootRef.current?.requestFullscreen
    if (requestFullscreen) {
      void requestFullscreen.call(rootRef.current).catch(() => setFullscreenFallback(true))
      return
    }
    setFullscreenFallback(true)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (ownsNativeKeyboard(event.target)) return
    if (event.key === 'Escape' && props.pointActive) { event.preventDefault(); props.onTogglePoint() }
    else if (event.key === 'Escape' && fullscreenFallback) { event.preventDefault(); setFullscreenFallback(false) }
    else if (event.key === ' ' || event.key.toLowerCase() === 'k') { event.preventDefault(); props.onTogglePlayback() }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); props.onStepFrame(-1) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); props.onStepFrame(1) }
    else if (event.key.toLowerCase() === 'p') { event.preventDefault(); props.onTogglePoint() }
  }
  const fullscreenActive = fullscreenFallback || nativeFullscreen
  return <section ref={rootRef} className={`editor-monitor editor-monitor--${props.fitMode}${fullscreenFallback ? ' editor-monitor--fullscreen-fallback' : ''}`} role="region" aria-label="Editor monitor" tabIndex={0} onKeyDown={onKeyDown}>
    <MonitorToolbar sourceStatus={props.sourceStatus} fitMode={props.fitMode} guides={props.guides} pointActive={props.pointActive} pointSelected={props.pointSelected} fullscreen={fullscreenActive} pointButtonRef={props.pointButtonRef} onTogglePoint={props.onTogglePoint} onFitModeChange={props.onFitModeChange} onGuidesChange={props.onGuidesChange} onFullscreen={fullscreen} />
    <MonitorStage fitMode={props.fitMode}>{props.children}</MonitorStage>
    <MonitorTransport playing={props.playing} currentTicks={props.currentTicks} durationTicks={props.durationTicks} frameRate={props.frameRate} muted={props.muted} volume={props.volume} onTogglePlayback={props.onTogglePlayback} onStepFrame={props.onStepFrame} onSeek={props.onSeek} onMutedChange={props.onMutedChange} onVolumeChange={props.onVolumeChange} />
  </section>
}
