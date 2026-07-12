import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/tokens.css'
import './styles/global.css'
import { App } from './app/App'
import { supportsNativeViewTransitions } from './features/view-transition/view-transition'

document.documentElement.dataset.viewTransition = supportsNativeViewTransitions() ? 'native' : 'fallback'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
