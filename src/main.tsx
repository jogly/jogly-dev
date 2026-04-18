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
import './styles/global.css'

const rootRoute = createRootRoute({ component: () => <Outlet /> })
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })
const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
