# FHIR conversion tooling

Run from the repository root. The app itself makes no terminology or network calls; tx.fhir.org is used here only to build the checked-in display table and to validate test output.

## Validate the app's FHIR output

```bash
npm i playwright jszip
# condition form corpus (tests/fhir/forms/*.json) from rules/conditions and the RCTC code lookup
python3 tools/fhir/make-condition-forms.py .
# Load Form Data + Generate FHIR in headless Chromium for the default case, saved templates and the corpus (XML and JSON)
OUT=build/fhir node tools/fhir/generate-fhir.mjs __default__ assets/forms/*.json tests/fhir/forms/*.json
# eCR FHIR IG 2.1.2 validation with terminology, SNOMED CT US Edition
java -jar validator_cli.jar build/fhir -version 4.0.1 -ig hl7.fhir.us.ecr#2.1.2 -sct us -txCache build/txcache -output build/validation.xml
# gate: exits 1 on any error, warning, or information message not in tools/fhir/validation-suppressions.json
python3 tools/fhir/check-validation.py build/validation.xml   # add --unused on the full corpus to list suppressions that matched nothing
```

## Display table

`js/fhir/display-table.xml` holds verified coding displays. Regenerate it when new codes appear in the output:

```bash
python3 tools/fhir/collect-codes.py build/fhir > build/codes.json
pwsh tools/fhir/lookup-displays.ps1 -In build/codes.json -Out build/tx-new.json   # merge into tools/fhir/terminology/tx-lookup.json
python3 tools/fhir/build-display-table.py .
```

Sources: `tx-lookup.json` (tx.fhir.org `CodeSystem/$lookup`), `profile-pattern-displays.json` (displays fixed by eCR 2.1.2 and US Core 3.1.1 patterns), `manual-displays.json` (displays from validator valid-display lists).

## Browser bundle

After changing `js/fhir/ecr137-cda2fhir.xslt`, `js/fhir/display-table.xml`, or anything under `vendor/ecr-transforms/`:

```bash
npx xslt3 -xsl:js/fhir/ecr137-cda2fhir.xslt -export:build/ecr137-cda2fhir.sef.json -nogo -relocate:on
node tools/fhir/build-browser-bundle.mjs
```

This regenerates `js/fhir/ecr137-fhir-bundle.js`, which `index.html` loads with SaxonJS (`vendor/saxon-js/SaxonJS2.rt.js`, Saxonica license in that folder). Generate FHIR in the action dock converts the form's eICR with `js/fhir/ecr137-cda2fhir.xslt`, builds the RR with `js/fhir/fhir-rr-builder.js` from that eICR, the form and the reportability engine result, and downloads both Bundles as a ZIP in XML and JSON.

## JSON serializer

`js/fhir/fhir-json.js` converts each FHIR XML Bundle to FHIR JSON in the browser, driven by `js/fhir/fhir-r4-json-types.js` (element names, types and cardinality for every R4 resource, data type and backbone element). Regenerate the type map from the `hl7.fhir.r4.core#4.0.1` package:

```bash
python3 tools/fhir/build-json-typemap.py ~/.fhir/packages/hl7.fhir.r4.core#4.0.1/package
```

`node tools/fhir/xml-to-json.mjs <xml dir> <json dir>` (needs `@xmldom/xmldom`) runs the same serializer over saved XML.

## RR condition codes

`js/fhir/rr-condition-codes.js` holds the SNOMED CT reportable condition code for each condition pack, from the RCTC release in `assets/data`. The RR builder uses it as the Relevant Reportable Condition Observation value. Regenerate after a new RCTC release or new condition packs:

```bash
python3 tools/fhir/build-rr-condition-codes.py
```

## Reader layout

`js/fhir/fhir-annotate.js` runs on both Bundles before download. It orders the entries the way the Composition sections use them (header resources, then each section's entries, then participants and Provenance), adds banner comments for the document and each section, one comment per entry naming the resource, its profile and the CDA construct it comes from, and a `display` on every reference whose target has a name or a coded meaning. Comments and entry order carry no meaning in FHIR; the JSON files have the same content without the comments.

## CDA-only tools

`generate-cda.mjs` (Generate eICR / Generate RR downloads) and `cda-to-fhir.py` (Saxon-HE conversion of CDA files) run the eICR conversion outside the browser for debugging.
