import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CreativeDirectionLab } from './CreativeDirectionLab.tsx'
import { MotionLabApp } from './MotionLabApp.tsx'
import './styles.css'
import './creative-direction.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Motion Lab root element not found.')

const mode = new URLSearchParams(window.location.search).get('mode')

createRoot(rootElement).render(
  <StrictMode>
    {mode === 'creative-direction' ? <CreativeDirectionLab /> : <MotionLabApp />}
  </StrictMode>,
)
