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
java -jar validator_cli.jar build/fhir -version 4.0.1 -ig hl7.fhir.us.ecr#2.1.2 -output build/validation.xml
python3 tools/fhir/summarize-validation.py build/validation.xml
```
