import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-gpu-sandbox',
    '--no-sandbox',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  geolocation: { latitude: 10.0026, longitude: 76.2144 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 300)}`));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
// Skip boot
await page.getByRole('button', { name: /SKIP BOOT/i }).click({ timeout: 15000 });
// Wait for map engine online (footer) or canvas
await page.waitForFunction(
  () => document.body.innerText.includes('GIS CORE // ONLINE') || document.querySelector('#bat-map-container canvas'),
  { timeout: 45000 }
);
await page.waitForTimeout(6000);
await page.screenshot({ path: 'repro-map.png' });

const mapState = await page.evaluate(() => {
  const m = window.__batMap;
  if (!m) return { present: false };
  const style = m.getStyle();
  let routeInfo = null;
  try {
    const src = m.getSource('bat-route-source');
    const data = src && src._data ? src._data : null;
    routeInfo = {
      hasSource: !!src,
      layers: ['bat-route-casing', 'bat-route-glow', 'bat-route-line', 'bat-route-dashes'].map((id) => ({ id, ok: !!m.getLayer(id) })),
      features: data?.features?.length ?? -1,
      coords: data?.features?.[0]?.geometry?.coordinates?.length ?? -1,
    };
  } catch (e) { routeInfo = { err: String(e).slice(0, 200) }; }
  const canvas = document.querySelector('#bat-map-container canvas');
  return {
    present: true,
    zoom: m.getZoom(), center: m.getCenter().toArray(),
    styleLayers: (style?.layers || []).map((l) => l.id),
    canvasSize: canvas ? [canvas.width, canvas.height] : null,
    tilesLoaded: (() => { try { return m.areTilesLoaded(); } catch { return 'n/a'; } })(),
    routeInfo,
  };
});
console.log('MAP_STATE_AFTER_LOAD =', JSON.stringify(mapState, null, 1));

// Search + select destination
await page.getByPlaceholder(/ENTER LOCATION/i).fill('Marine Drive Kochi');
await page.waitForTimeout(2500);
const firstResult = page.locator('button', { hasText: /Marine Drive/i }).first();
await firstResult.waitFor({ timeout: 20000 });
await firstResult.click();
// Wait for pathway locked (up to 75s: parallel OSRM + margin)
await page.waitForFunction(() => document.body.innerText.includes('PATHWAY LOCKED'), { timeout: 75000 }).catch(() => {});
await page.waitForTimeout(8000);
await page.screenshot({ path: 'repro-route.png' });

const footer = await page.locator('footer').innerText().catch(() => 'NO FOOTER');
console.log('FOOTER =', footer);
const routePanel = await page.locator('text=ROUTE ESTABLISHED').count();
console.log('ROUTE_PANEL_VISIBLE =', routePanel > 0);

const mapState2 = await page.evaluate(() => {
  const m = window.__batMap;
  if (!m) return { present: false };
  let routeInfo = null;
  try {
    const src = m.getSource('bat-route-source');
    const data = src && src._data ? src._data : null;
    routeInfo = {
      hasSource: !!src,
      layers: ['bat-route-casing', 'bat-route-glow', 'bat-route-line', 'bat-route-dashes'].map((id) => ({ id, ok: !!m.getLayer(id) })),
      features: data?.features?.length ?? -1,
      coords: data?.features?.[0]?.geometry?.coordinates?.length ?? -1,
      first: data?.features?.[0]?.geometry?.coordinates?.[0] ?? null,
    };
  } catch (e) { routeInfo = { err: String(e).slice(0, 200) }; }
  // Where would the line render on screen? project first route coord
  let projected = null;
  try {
    const src = m.getSource('bat-route-source');
    const c = src?._data?.features?.[0]?.geometry?.coordinates?.[0];
    if (c) projected = m.project(c).toArray();
  } catch {}
  return { present: true, zoom: m.getZoom(), center: m.getCenter().toArray(), routeInfo, projectedFirst: projected };
});
console.log('MAP_STATE_AFTER_ROUTE =', JSON.stringify(mapState2, null, 1));
console.log('CONSOLE_ISSUES =', JSON.stringify(logs.slice(0, 30), null, 1));
await browser.close();
