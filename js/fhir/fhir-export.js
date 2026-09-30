/**
 * eICR / RR FHIR export.
 * Generates the CDA exactly as Generate eICR / Generate RR do, converts it with
 * js/fhir/ecr137-cda2fhir.xslt (SaxonJS, compiled bundle in ecr137-fhir-bundle.js),
 * and downloads eICR and RR FHIR Bundles (FHIR R4, eCR IG 2.1.2) as a ZIP.
 * Dependencies: vendor/saxon-js/SaxonJS2.rt.js, js/fhir/ecr137-fhir-bundle.js, JSZip,
 * validateFormData, generateCDA, generateRR, generateDynamicFilename.
 */
(function () {
  let poolPromise = null;

  function baseUri() {
    return new URL('./', document.baseURI).href;
  }

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

  async function generateAndDownloadFHIR() {
    if (!window.SaxonJS || !window.ECR137_FHIR_BUNDLE) {
      alert('FHIR conversion components did not load.');
      return;
    }
    if (!window.validateFormData()) return;
    const btns = document.querySelectorAll('[data-ecr137-fhir]');
    btns.forEach(b => { b.disabled = true; b.dataset.label = b.innerHTML; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Converting…'; });
    try {
      await new Promise(r => setTimeout(r, 30));
      const eicrFhir = await cdaToFhir(generateCDA());
      const rrFhir = await cdaToFhir(generateRR());
      const zip = new JSZip();
      zip.file(generateDynamicFilename('eICR_FHIR', 'xml'), eicrFhir);
      zip.file(generateDynamicFilename('RR_FHIR', 'xml'), rrFhir);
      const blob = await zip.generateAsync({ type: 'blob' });
      const name = generateDynamicFilename('FHIR', 'zip');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      console.error('FHIR conversion failed', e);
      alert('FHIR conversion failed: ' + (e && e.message ? e.message : e));
    } finally {
      btns.forEach(b => { b.disabled = false; b.innerHTML = b.dataset.label; });
    }
  }

  window.ecr137CdaToFhir = cdaToFhir;
  window.generateAndDownloadFHIR = generateAndDownloadFHIR;
})();
