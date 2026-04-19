import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router'
import { Home } from './pages/Home'
import { Specimen } from './pages/Specimen'
import { Margin } from './pages/Margin'
import { Watermark } from './pages/Watermark'
import { Ramp } from './pages/Ramp'
import { Anchor } from './pages/Anchor'
import './styles/global.css'
import './styles/vnav.css'

const rootRoute = createRootRoute({ component: () => <Outlet /> })
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })
const specimenRoute = createRoute({ getParentRoute: () => rootRoute, path: '/specimen', component: Specimen })
const marginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/margin', component: Margin })
const watermarkRoute = createRoute({ getParentRoute: () => rootRoute, path: '/watermark', component: Watermark })
const rampRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ramp', component: Ramp })
const anchorRoute = createRoute({ getParentRoute: () => rootRoute, path: '/anchor', component: Anchor })
const routeTree = rootRoute.addChildren([
  indexRoute,
  specimenRoute,
  marginRoute,
  watermarkRoute,
  rampRoute,
  anchorRoute,
])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
