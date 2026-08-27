import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CreativeDirectionLab } from './CreativeDirectionLab.tsx'
import { MotionLabApp } from './MotionLabApp.tsx'
import { CreativeLibraryApp } from './library/CreativeLibraryApp.tsx'
import { ComponentParityLab } from './ingest/ComponentParityLab.tsx'
import { ClosedLoopReviewLab } from './ClosedLoopReviewLab.tsx'
import { PromotionReviewLab } from './PromotionReviewLab.tsx'
import { SourceAwareReviewLab } from './SourceAwareReviewLab.tsx'
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
const closedLoopReviewRoute = window.location.pathname === '/closed-loop-review' || mode === 'closed-loop-review'
const promotionReviewRoute = window.location.pathname === '/promotion-review' || mode === 'promotion-review'
const sourceAwareReviewRoute = window.location.pathname === '/source-aware-review' || mode === 'source-aware-review'

createRoot(rootElement).render(
  <StrictMode>
    {ingestParityRoute ? <ComponentParityLab /> : sourceAwareReviewRoute ? <SourceAwareReviewLab /> : promotionReviewRoute ? <PromotionReviewLab /> : closedLoopReviewRoute ? <ClosedLoopReviewLab /> : libraryRoute ? <CreativeLibraryApp /> : mode === 'creative-direction' ? <CreativeDirectionLab /> : <MotionLabApp />}
  </StrictMode>,
)
