/**
 * eICR / RR FHIR output and the dock's output format (CDA, FHIR, or CDA + FHIR).
 *
 * The FHIR eICR is converted from the CDA eICR the form generates (js/fhir/ecr137-cda2fhir.xslt, run by
 * SaxonJS from the compiled bundle in ecr137-fhir-bundle.js). The FHIR RR is built by
 * js/fhir/fhir-rr-builder.js from that FHIR eICR, the form and the reportability engine result. Both
 * Bundles get the reader layout of js/fhir/fhir-annotate.js; js/fhir/fhir-json.js serializes them to JSON.
 *
 * Dock behaviour by format:
 *   Generate eICR   CDA: the CDA eICR | FHIR: the FHIR eICR (XML) | CDA + FHIR: both, from the same CDA
 *   Generate RR     CDA: the CDA RR   | FHIR: the FHIR RR (XML)   | CDA + FHIR: both
 *   Package ZIP     CDA: eICR and RR CDA, HTML renderings, metadata.xml
 *                   FHIR: eICR and RR FHIR in XML and JSON, metadata.xml
 *                   CDA + FHIR: all of the above; the FHIR eICR is converted from the CDA eICR in the package
 * The CDA functions themselves are unchanged; Package ZIP calls window.ecr137ExtendPackage before it zips.
 *
 * Dependencies: vendor/saxon-js/SaxonJS2.rt.js, js/fhir/ecr137-fhir-bundle.js, js/fhir/fhir-rr-builder.js,
 * js/fhir/ig-notes.js, js/fhir/fhir-annotate.js, js/fhir/fhir-r4-json-types.js, js/fhir/fhir-json.js;
 * validateFormData, generateCDA, generateRR, getFormData, generateDynamicFilename.
 */
(function () {
  'use strict';

  const FORMATS = ['cda', 'fhir', 'both'];
  const STORE_KEY = 'ecr137.outputFormat';
  let current = 'cda';
  try { const s = localStorage.getItem(STORE_KEY); if (FORMATS.includes(s)) current = s; } catch (e) { /* storage unavailable */ }

  function outputFormat(value) {
    if (value !== undefined && FORMATS.includes(value)) {
      current = value;
      try { localStorage.setItem(STORE_KEY, value); } catch (e) { /* storage unavailable */ }
    }
    return current;
  }

  // ---- conversion ----
  let poolPromise = null;
  const baseUri = () => new URL('./', document.baseURI).href;

  // Parse every bundled XML document once and key it by the absolute URI the stylesheet resolves.
  function documentPool() {
    if (!poolPromise) {
      const b = window.ECR137_FHIR_BUNDLE;
      poolPromise = Promise.all(Object.entries(b.docs).map(async ([rel, text]) => {
        const doc = await SaxonJS.getResource({ text, type: 'xml' });
        return [new URL(rel, baseUri()).href, doc];
      })).then(entries => Object.fromEntries(entries));
    }
    return poolPromise;
  }

  async function cdaToFhir(cdaXml) {
    if (!window.SaxonJS || !window.ECR137_FHIR_BUNDLE) throw new Error('FHIR conversion components did not load.');
    const b = window.ECR137_FHIR_BUNDLE;
    const pool = await documentPool();
    const result = SaxonJS.transform({
      stylesheetInternal: b.sef,
      stylesheetBaseURI: new URL(b.stylesheet, baseUri()).href,
      sourceText: cdaXml,
      documentPool: pool,
      destination: 'serialized'
    }, 'sync');
    return result.principalResult;
  }

  // FHIR eICR and RR Bundles (XML) for a CDA eICR generated from the current form
  async function fhirBundles(cdaXml) {
    const eicr = window.ecr137AnnotateFhirBundle(await cdaToFhir(cdaXml), 'eICR');
    const rr = window.ecr137AnnotateFhirBundle(window.ecr137BuildRRFhirBundle(eicr, getFormData(), window.ecr137Reportability), 'RR');
    return { eicr, rr };
  }

  // ---- downloads ----
  function save(text, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/xml' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function busy(btn, fn) {
    const label = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Converting…'; }
    try {
      await new Promise(r => setTimeout(r, 30));
      await fn();
    } catch (e) {
      console.error('FHIR output failed', e);
      alert('FHIR output failed: ' + (e && e.message ? e.message : e));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = label; }
    }
  }

  // Generate eICR / Generate RR for the FHIR and CDA + FHIR formats
  async function generateDocument(kind, btn) {
    if (!window.validateFormData()) return;
    await busy(btn, async () => {
      const cda = generateCDA();
      const { eicr, rr } = await fhirBundles(cda);
      if (kind === 'eICR') {
        if (current === 'both') save(cda, generateDynamicFilename('eICR', 'xml'));
        save(eicr, generateDynamicFilename('eICR_FHIR', 'xml'));
      } else {
        if (current === 'both') save(generateRR(), generateDynamicFilename('RR', 'xml'));
        save(rr, generateDynamicFilename('RR_FHIR', 'xml'));
      }
    });
  }

  // Called by downloadZipOfEICRandRR before it zips: adds the FHIR files, and in the FHIR format removes the CDA files
  async function extendPackage(zip, ctx) {
    if (current === 'cda') return;
    const { eicr, rr } = await fhirBundles(ctx.eicrXml);
    zip.file(`eICR_FHIR_${ctx.base}.xml`, eicr);
    zip.file(`eICR_FHIR_${ctx.base}.json`, window.ecr137FhirXmlToJson(eicr));
    zip.file(`RR_FHIR_${ctx.base}.xml`, rr);
    zip.file(`RR_FHIR_${ctx.base}.json`, window.ecr137FhirXmlToJson(rr));
    if (current === 'fhir') {
      for (const n of [`eICR_${ctx.base}.xml`, `RR_${ctx.base}.xml`, `eICR_${ctx.base}.html`, `RR_${ctx.base}.html`]) zip.remove(n);
    }
  }

  window.ecr137OutputFormat = outputFormat;
  window.ecr137FhirBundles = fhirBundles;
  window.ecr137GenerateDocument = generateDocument;
  window.ecr137Busy = busy;
  window.ecr137ExtendPackage = extendPackage;
})();
