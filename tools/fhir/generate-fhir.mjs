// Drives the app in headless Chromium the way a user does: Load Form Data, Format: FHIR, Package ZIP.
// Writes <name>-eICR.xml/.json and <name>-RR.xml/.json from each downloaded package.
// Usage (repo root, app served at APP_URL, default http://localhost:8137/):
//   npm i playwright jszip
//   python -m http.server 8137 --bind 127.0.0.1        (in another window)
//   OUT=build/fhir node tools/fhir/generate-fhir.mjs __default__ assets/forms/*.json tests/fhir/forms/*.json
// CDN scripts (JSZip, SheetJS) are served from node_modules when CDN=local is set.
import { chromium } from 'playwright';
import JSZip from 'jszip';
import fs from 'fs'; import path from 'path';
const appUrl = process.env.APP_URL || 'http://localhost:8137/';
const out = process.env.OUT || 'build/fhir';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ acceptDownloads: true });
if (process.env.CDN === 'local') {
  await ctx.route(/jszip(\.min)?\.js/, r => r.fulfill({ path: 'node_modules/jszip/dist/jszip.min.js', contentType: 'application/javascript' }));
  await ctx.route(/xlsx\.full\.min\.js/, r => r.fulfill({ path: 'node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
}
await ctx.addInitScript(() => { delete window.showSaveFilePicker; window.showSaveFilePicker = undefined; });
let failed = 0;
for (const form of process.argv.slice(2)) {
  const name = form === '__default__' ? 'default' : path.basename(form, '.json').replace(/[^A-Za-z0-9_-]/g, '_');
  const page = await ctx.newPage(); const msgs = [];
  page.on('dialog', d => { msgs.push(d.message()); d.accept(); });
  page.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  await page.goto(appUrl); await page.waitForSelector('.ui81-format-select'); await page.waitForTimeout(1000);
  if (form !== '__default__') { await page.setInputFiles('#loadFormDataInput', path.resolve(form)); await page.waitForTimeout(1500); }
  await page.evaluate(() => window.triggerReportabilityEvaluation && window.triggerReportabilityEvaluation());
  await page.waitForTimeout(300);
  await page.selectOption('.ui81-format-select', 'fhir');
  try {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }),
      page.click('.ui81-dock button:has-text("Package ZIP")')]);
    const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
    let n = 0;
    for (const [fn, f] of Object.entries(zip.files)) {
      const m = fn.match(/^(eICR|RR)_FHIR_.*\.(xml|json)$/);
      if (m) { fs.writeFileSync(path.join(out, `${name}-${m[1]}.${m[2]}`), await f.async('string')); n++; }
    }
    if (n !== 4) throw new Error(`package held ${n} FHIR files`);
    console.log(name, 'ok');
  } catch (e) { failed++; console.log(name, 'FAILED', e.message, msgs.filter(m => !/loaded successfully/.test(m)).join(' | ')); }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
