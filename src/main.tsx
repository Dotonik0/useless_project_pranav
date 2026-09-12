import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css' // <-- THIS LINE FIXES THE BLANK MAP
import { setWorkerUrl } from 'maplibre-gl'
// Explicit worker bundle URL. MapLibre otherwise resolves its worker
// relative to the (Vite pre-bundled) main script — a 404 in dev — which
// silently kills ALL GeoJSON rendering (route lines) while raster tiles
// keep working. `?url` emits/serves the real worker file in dev + prod.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import App from './App.tsx'

setWorkerUrl(maplibreWorkerUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)