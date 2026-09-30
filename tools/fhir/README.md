# FHIR conversion tooling

Run from the repository root.

```bash
# 1. condition form corpus (tests/fhir/forms/*.json)
python3 tools/fhir/make-condition-forms.py .

# 2. eICR and RR CDA through the UI (Load Form Data, Generate eICR, Generate RR)
npm i playwright
OUT=build/cda node tools/fhir/generate-cda.mjs __default__ tests/fhir/forms/*.json

# 3. CDA to FHIR (pip install saxonche)
python3 tools/fhir/cda-to-fhir.py build/cda build/fhir

# 4. validate and summarize
java -jar validator_cli.jar build/fhir -version 4.0.1 -ig hl7.fhir.us.ecr#2.1.2 -sct us -txCache build/txcache -output build/validation.xml
python3 tools/fhir/check-validation.py build/validation.xml   # exits 1 on any unsuppressed error, warning, or information message
```

## Browser bundle

After changing `js/fhir/ecr137-cda2fhir.xslt`, `js/fhir/display-table.xml`, or anything under `vendor/ecr-transforms/`:

```bash
npx xslt3 -xsl:js/fhir/ecr137-cda2fhir.xslt -export:build/ecr137-cda2fhir.sef.json -nogo -relocate:on
node tools/fhir/build-browser-bundle.mjs
```

This regenerates `js/fhir/ecr137-fhir-bundle.js`, which `index.html` loads with SaxonJS (`vendor/saxon-js/SaxonJS2.rt.js`, Saxonica license in that folder). Generate FHIR in the action dock converts the eICR and RR the form produces and downloads both Bundles as a ZIP.
