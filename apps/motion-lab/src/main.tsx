import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionLabApp } from './MotionLabApp.tsx'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Motion Lab root element not found.')

createRoot(rootElement).render(
  <StrictMode>
    <MotionLabApp />
  </StrictMode>,
)
