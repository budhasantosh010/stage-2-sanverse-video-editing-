import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/tokens.css'
import './styles/global.css'
import { App } from './app/App'
import { CreativeSceneRenderPage } from './features/creative-scene/CreativeSceneRenderPage'
import { supportsNativeViewTransitions } from './features/view-transition/view-transition'

document.documentElement.dataset.viewTransition = supportsNativeViewTransitions() ? 'native' : 'fallback'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

const rootView = window.location.pathname === '/render/creative-scene'
  ? <CreativeSceneRenderPage />
  : <App />

createRoot(rootElement).render(
  <StrictMode>
    {rootView}
  </StrictMode>,
)
