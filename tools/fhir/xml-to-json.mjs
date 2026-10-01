// Convert FHIR XML Bundles to FHIR JSON with the browser serializer (js/fhir/fhir-json.js).
// Usage: node tools/fhir/xml-to-json.mjs <in dir> <out dir>   (needs @xmldom/xmldom)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [inDir, outDir] = process.argv.slice(2);
const ctx = { DOMParser, XMLSerializer };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/fhir/fhir-r4-json-types.js', 'js/fhir/fhir-json.js']) {
  vm.runInContext(fs.readFileSync(path.join(repo, f), 'utf8'), ctx, { filename: f });
}
fs.mkdirSync(outDir, { recursive: true });
let n = 0, failed = 0;
for (const f of fs.readdirSync(inDir).filter(f => f.endsWith('.xml')).sort()) {
  try {
    const json = ctx.ecr137FhirXmlToJson(fs.readFileSync(path.join(inDir, f), 'utf8'));
    fs.writeFileSync(path.join(outDir, f.replace(/\.xml$/, '.json')), json);
    n++;
  } catch (e) {
    failed++;
    console.error(`${f}: ${e.message}`);
  }
}
console.log(`${n} converted, ${failed} failed`);
process.exit(failed ? 1 : 0);
