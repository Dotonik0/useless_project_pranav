import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  geolocation: { latitude: 10.0026, longitude: 76.2144 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.getByRole('button', { name: /SKIP BOOT/i }).click({ timeout: 15000 });
await page.waitForFunction(
  () => document.body.innerText.includes('GIS CORE // ONLINE') || document.querySelector('#bat-map-container canvas'),
  { timeout: 45000 }
);
await page.getByPlaceholder(/ENTER LOCATION/i).fill('Marine Drive Kochi');
await page.waitForTimeout(2500);
await page.locator('button', { hasText: /Marine Drive/i }).first().click({ timeout: 20000 });
await page.waitForFunction(() => document.body.innerText.includes('PATHWAY LOCKED'), { timeout: 75000 }).catch(() => {});
await page.waitForTimeout(8000);

const deep = await page.evaluate(() => {
  const m = window.__batMap;
  const out = {};
  try {
    const feats = m.querySourceFeatures('bat-route-source');
    out.querySourceFeatures = feats.map((f) => ({
      geom: f.geometry?.type,
      n: f.geometry?.coordinates?.length,
      first: f.geometry?.coordinates?.[0],
      mid: f.geometry?.coordinates?.[Math.floor((f.geometry?.coordinates?.length || 0) / 2)],
    }));
  } catch (e) { out.querySourceFeaturesErr = String(e).slice(0, 200); }
  try {
    const rendered = m.queryRenderedFeatures({ layers: ['bat-route-line', 'bat-route-glow', 'bat-route-casing', 'bat-route-dashes'] });
    out.renderedCount = rendered.length;
    out.renderedLayers = [...new Set(rendered.map((r) => r.layer.id))];
  } catch (e) { out.renderedErr = String(e).slice(0, 200); }
  try {
    out.paint = {
      color: m.getPaintProperty('bat-route-line', 'line-color'),
      width: m.getPaintProperty('bat-route-line', 'line-width'),
      opacity: m.getPaintProperty('bat-route-line', 'line-opacity'),
      vis: m.getLayoutProperty('bat-route-line', 'visibility'),
    };
    out.styleLoaded = m.isStyleLoaded();
    out.loaded = m.loaded();
  } catch (e) { out.paintErr = String(e).slice(0, 200); }
  return out;
});
console.log('DEEP =', JSON.stringify(deep, null, 1));
await browser.close();
