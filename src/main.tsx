import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Anchor } from './pages/Anchor'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Anchor />
  </StrictMode>,
)
