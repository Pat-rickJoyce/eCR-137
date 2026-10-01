/**
 * eICR / RR FHIR export.
 * Generates the CDA exactly as Generate eICR / Generate RR do, converts it with
 * js/fhir/ecr137-cda2fhir.xslt (SaxonJS, compiled bundle in ecr137-fhir-bundle.js),
 * builds the RR Bundle with js/fhir/fhir-rr-builder.js from that eICR, the form and the reportability
 * engine result, and downloads eICR and RR FHIR Bundles (FHIR R4, eCR IG 2.1.2) as a ZIP, each in
 * XML and in JSON (js/fhir/fhir-json.js).
 * Dependencies: vendor/saxon-js/SaxonJS2.rt.js, js/fhir/ecr137-fhir-bundle.js, JSZip,
 * js/fhir/fhir-rr-builder.js, js/fhir/fhir-annotate.js (entry order, comments, reference displays), js/fhir/fhir-r4-json-types.js, js/fhir/fhir-json.js, validateFormData, generateCDA, getFormData, generateDynamicFilename.
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
      const eicrFhir = window.ecr137AnnotateFhirBundle(await cdaToFhir(generateCDA()), 'eICR');
      const rrFhir = window.ecr137AnnotateFhirBundle(window.ecr137BuildRRFhirBundle(eicrFhir, getFormData(), window.ecr137Reportability), 'RR');
      const zip = new JSZip();
      zip.file(generateDynamicFilename('eICR_FHIR', 'xml'), eicrFhir);
      zip.file(generateDynamicFilename('RR_FHIR', 'xml'), rrFhir);
      zip.file(generateDynamicFilename('eICR_FHIR', 'json'), window.ecr137FhirXmlToJson(eicrFhir));
      zip.file(generateDynamicFilename('RR_FHIR', 'json'), window.ecr137FhirXmlToJson(rrFhir));
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
