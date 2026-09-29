import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const repo = process.env.REPO || process.cwd();
const outDir = process.env.OUT || 'ui-out';
const forms = process.argv.slice(2);
fs.mkdirSync(outDir,{recursive:true});
const browser = await chromium.launch({
  args:['--allow-file-access-from-files'], proxy: process.env.HTTPS_PROXY ? {server: process.env.HTTPS_PROXY} : undefined});
const ctx = await browser.newContext({acceptDownloads:true, ignoreHTTPSErrors:true});
await ctx.addInitScript(() => { delete window.showSaveFilePicker; window.showSaveFilePicker = undefined; });
const log = [];
async function run(name, formPath){
  const page = await ctx.newPage();
  const msgs=[];
  page.on('dialog', d => { msgs.push(d.message().slice(0,300)); d.accept(); });
  page.on('pageerror', e => msgs.push('PAGEERR '+e.message.slice(0,200)));
  await page.goto('file://'+repo+'/index.html'); await page.waitForTimeout(1500);
  if (formPath){ await page.setInputFiles('#loadFormDataInput', formPath); await page.waitForTimeout(1500); }
  const res={name, msgs};
  for (const [fn,kind] of [['generateAndDownloadCDA','eICR'],['generateAndDownloadRR','RR']]){
    try{
      const [dl] = await Promise.all([page.waitForEvent('download',{timeout:15000}), page.evaluate(f=>window[f](), fn)]);
      const p = path.join(outDir, `${name}-${kind}.xml`); await dl.saveAs(p); res[kind]=fs.statSync(p).size;
    }catch(e){ res[kind]='FAIL '+e.message.slice(0,120); }
  }
  log.push(res); console.log(JSON.stringify(res)); await page.close();
}
if (!forms.length) forms.push('__default__');
for (const f of forms) await run(f==='__default__'?'default':path.basename(f,'.json').replace(/[^A-Za-z0-9_-]/g,'_'), f==='__default__'?null:f);
await browser.close();
