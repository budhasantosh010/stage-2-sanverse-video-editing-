import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CreativeDirectionLab } from './CreativeDirectionLab.tsx'
import { MotionLabApp } from './MotionLabApp.tsx'
import { CreativeLibraryApp } from './library/CreativeLibraryApp.tsx'
import { ComponentParityLab } from './ingest/ComponentParityLab.tsx'
import './styles.css'
import './library/library.css'
import './creative-direction.css'
import './source-understanding.css'
import './dope-sheet.css'
import './curve-editor.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Motion Lab root element not found.')

const mode = new URLSearchParams(window.location.search).get('mode')
const libraryRoute = window.location.pathname === '/library' || window.location.pathname.startsWith('/library/')
const ingestParityRoute = window.location.pathname.startsWith('/ingest/parity/sanverse.')

createRoot(rootElement).render(
  <StrictMode>
    {ingestParityRoute ? <ComponentParityLab /> : libraryRoute ? <CreativeLibraryApp /> : mode === 'creative-direction' ? <CreativeDirectionLab /> : <MotionLabApp />}
  </StrictMode>,
)
