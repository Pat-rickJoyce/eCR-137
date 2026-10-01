// Drives index.html in headless Chromium the way a user does: Load Form Data, then Generate FHIR,
// and writes <name>-eICR.xml and <name>-RR.xml from each downloaded ZIP.
// Usage (repo root): npm i playwright jszip && OUT=build/fhir node tools/fhir/generate-fhir.mjs __default__ tests/fhir/forms/*.json
// CDN scripts (JSZip, SheetJS) are served from node_modules when CDN=local is set.
import { chromium } from 'playwright';
import JSZip from 'jszip';
import fs from 'fs'; import path from 'path';
const repo = process.env.REPO || process.cwd();
const out = process.env.OUT || 'build/fhir';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true });
if (process.env.CDN === 'local') {
  await ctx.route(/jszip(\.min)?\.js/, r => r.fulfill({ path: 'node_modules/jszip/dist/jszip.min.js', contentType: 'application/javascript' }));
  await ctx.route(/xlsx\.full\.min\.js/, r => r.fulfill({ path: 'node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
}
await ctx.addInitScript(() => { window.showSaveFilePicker = undefined; delete window.showSaveFilePicker; });
let failed = 0;
for (const form of process.argv.slice(2)) {
  const name = form === '__default__' ? 'default' : path.basename(form, '.json').replace(/[^A-Za-z0-9_-]/g, '_');
  const page = await ctx.newPage(); const msgs = [];
  page.on('dialog', d => { msgs.push(d.message()); d.accept(); });
  page.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(repo, 'index.html')); await page.waitForTimeout(1500);
  if (form !== '__default__') { await page.setInputFiles('#loadFormDataInput', path.resolve(form)); await page.waitForTimeout(1500); }
  await page.evaluate(() => window.triggerReportabilityEvaluation && window.triggerReportabilityEvaluation());
  await page.waitForTimeout(300);
  try {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => generateAndDownloadFHIR())]);
    const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
    for (const [fn, f] of Object.entries(zip.files)) {
      const kind = fn.startsWith('RR_') ? 'RR' : 'eICR';
      fs.writeFileSync(path.join(out, `${name}-${kind}.xml`), await f.async('string'));
    }
    console.log(name, 'ok');
  } catch (e) { failed++; console.log(name, 'FAILED', msgs.filter(m => !/loaded successfully/.test(m)).join(' | ')); }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
