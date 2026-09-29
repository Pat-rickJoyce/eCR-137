# FHIRTransform: eICR and RR FHIR Output

Branch: `FHIRTransform`.

## Goal

Add FHIR output next to the CDA output. The user picks CDA, FHIR, or both. The CDA generator is the input and does not change. FHIR output conforms to `hl7.fhir.us.ecr#2.1.2` (FHIR R4, US Core 3.1.1) with zero errors, warnings, and information messages from the HL7 FHIR Validator, across every reportable condition the app supports.

## Architecture

| Layer | Location | Content |
|---|---|---|
| Upstream transform | `vendor/ecr-transforms/` | `lantanagroup/eCRTransforms` `transforms/cda2fhir-r4` and its mapping XML, unmodified, pinned in `UPSTREAM` |
| eCR-137 conversion rules | `js/fhir/ecr137-cda2fhir.xslt` | Entry point. Imports the upstream transform; `ecr137-pre` (in-memory CDA normalization), `ecr137-post` (FHIR rules), `ecr137-narrative` (resource narrative); fast UUID function |
| RR builder | `js/fhir/` | FHIR RR built from form data and engine v2 results |
| Runtime | browser | SaxonJS 2.7 in a Web Worker running the compiled SEF; mapping XML served beside it |
| Test tooling | `tools/fhir/`, `tests/fhir/` | Condition form corpus, UI-driven CDA generation, conversion, validation summary |

## Conversion rules (implemented)

| Rule | Mode | CDA construct | FHIR result |
|---|---|---|---|
| Specimen collection procedure | pre | `22.4.415` procedure as a direct section entry | Converted as eicr-procedure (upstream converts 22.4.415 only inside a Result Organizer) |
| Section merge | post | Two sections with the same LOINC (30954-2 Specimen Information and Lab Orders and Results; 29762-2 Social History and Occupational Data for Health) | One Composition section per code, entries and narrative combined |
| Birth time | post | `birthTime` with time | `patient-birthTime` extension on `Patient.birthDate` |
| Blood pressure | post | Vital sign organizer with systolic 8480-6 only | BP panel 85354-9 with diastolic component carrying data-absent-reason `unknown` |
| Oxygen saturation | post | 59408-5 | 2708-6 coding added |
| Instants | post | Date-precision author time mapped to `issued` and other instants | Padded to `T00:00:00Z` |
| Identifier duplicate | post | One CDA id emitted twice (urn:oid system plus RFC 3986 form) | RFC 3986 duplicate removed |
| Profile duplicate | post | Repeated `meta.profile` | Deduplicated |
| Vital-sign profile URL | post | Upstream map value `ehttp://...us-core-vital-signs` | `http://...us-core-vital-signs` |
| CVX system | post | `urn:oid:2.16.840.1.113883.12.292` | `http://hl7.org/fhir/sid/cvx` |
| RoleCode display | post | Facility type OF, HOSP, COMM, PROFF | THO displays |
| Narrative emphasis | convert | `strong`, `em` in narrative | XHTML `strong`, `em` |
| Race and ethnicity | post | Absent (RR patient) | us-core-race with ombCategory `UNK` and text; us-core-ethnicity with text |
| Encounter type and location | post | Absent (RR encounter) | data-absent-reason `unknown` |
| Empty values | post | Empty attribute values, scheme-only telecom (`mailto:`), elements left without content | Removed |
| Travel history effective | post | Empty travel period | `effectiveDateTime` with data-absent-reason `unknown` |
| Resource narrative | narrative | Resources without `text` | Generated table of element summaries |

## Test corpus

- `tests/fhir/default-form.json`: the app's default case, saved through Save Form Data.
- `tests/fhir/forms/<conditionId>.json`: 227 forms, one per condition pack with resolvable trigger codes. Each takes a SNOMED diagnosis and problem, LOINC lab test and coded result, and RxNorm medication from the condition's value sets (RCTC 2025-03-18), and one of six structural variants: baseline; systolic-only BP without immunizations; no pregnancy, travel, or procedures; male patient without pregnancy; no temperature, heart rate, or oxygen saturation; two lab results.
- `tools/fhir/make-condition-forms.py` regenerates the corpus from `rules/conditions/` and `code-oid-lookup.js`.
- `tools/fhir/generate-cda.mjs` loads each form through the Load Form Data control in Chromium and downloads the eICR and RR through Generate eICR and Generate RR.
- `tools/fhir/cda-to-fhir.py` runs the conversion (Saxon-HE).
- `tools/fhir/summarize-validation.py` summarizes validator output by message.

## Results

Validator 6.5.20, `-ig hl7.fhir.us.ecr#2.1.2`, `-tx n/a`, 227 eICR and 227 RR Bundles:

| Severity | Upstream transform alone (default case) | With eCR-137 rules (corpus) |
|---|---|---|
| Errors | 40 per eICR, 10 per RR | 0 |
| Warnings | 358 per eICR | 88,603 total, of which 26,824 `dom-6` (cleared by the narrative mode) and about 50,000 terminology checks not run under `-tx n/a` |
| Information | 247 per eICR | 44,369 total, of which 36,827 open-slice matches |

Browser runtime: SaxonJS 2.7 produces the same content as Saxon-HE; 1.5 s per eICR and 0.2 s per RR with the fast UUID function (50 s with the upstream native UUID module).

## Remaining work

| Step | Work | Exit criteria |
|---|---|---|
| 1 | Terminology run against tx.fhir.org with a cached `.txcache` over the corpus | Real terminology warnings listed |
| 2 | Best-practice warnings: Observation performer from CDA performer/author where present; Observation effective[x] | Warnings resolved or suppressed with a reason per message |
| 3 | Open-slice information messages for Provenance, PractitionerRole, Organization, Location, Device entries | Suppressed with a reason per message |
| 4 | RR builder from form data and engine v2 results | RR Bundles clean |
| 5 | App integration: SEF compile script with CI freshness check; Web Worker; CDA / FHIR / Both selector; FHIR downloads; ZIP; JSON serializer handling primitive extensions | FHIR downloads in Chrome and Edge; CDA output byte-identical to `main` |
| 6 | CI: corpus generation, conversion, validation with terminology; fail on any message | CI green |
| 7 | Upstream PRs to eCRTransforms for the vital-sign profile URL, CVX mapping, birthTime placement, duplicate identifiers, standalone 22.4.415, and Encounters section; retire the matching local rules when merged | Local rules reduced to eCR-137-specific handling |

## Version target

`hl7.fhir.us.ecr#2.1.2`. The STU 3 ballot (`3.0.0-ballot`, `hl7.org/fhir/us/ecr/2026Jan`, US Core 6.1.0) is the current `HL7/case-reporting` master; moving to it follows the upstream transform.

## Sources

- lantanagroup/eCRTransforms: https://github.com/lantanagroup/eCRTransforms
- HL7/case-reporting: https://github.com/HL7/case-reporting
- eCR FHIR IG 2.1.2: https://hl7.org/fhir/us/ecr/2.1.2/
