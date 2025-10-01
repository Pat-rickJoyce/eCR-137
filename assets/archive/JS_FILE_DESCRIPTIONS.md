# JavaScript File Descriptions - eCR-137 eICR Generator

## Purpose & Architecture Overview

This document describes the purpose and functionality of each JavaScript module in the eCR-137 Electronic Initial Case Report (eICR) Generator application. The application generates HL7 CDA R2 compliant electronic case reports and reportability responses for public health reporting.

---

## 📁 Module Descriptions (Load Order)

### 1. **config.js** 
**Purpose:** Global configuration, constants, and shared state management

**Contains:**
- XSLT stylesheet URLs for eICR and RR transformations
- Global data storage arrays (labObsData, diagnosisData, organismData, etc.)
- RCTC (Reportable Condition Trigger Codes) metadata structure
- DQ (Data Quality) Schematron ValueSets for validation
- NON_BLOCKING_DQ error configuration
- Shared state flags (loaded status trackers)

**Dependencies:** None (loads first)

**Used By:** All other modules reference these global constants and state

---

### 2. **data-transformers.js** (19 KB)
**Purpose:** Data conversion and transformation utilities

**Key Functions:**
- **Date/Time Conversions:** `cdaToDatetimeLocal()`, `datetimeLocalToCda()`, `normalizeTS()`
- **Code Mappings:** `getRouteTranslation()`, `getImmunizationRouteTranslation()`, `getProviderTaxonomyCode()`
- **Display Names:** `getRaceDisplayName()`, `getEthnicityDisplayName()`, `getPregnancyStatusDisplay()`
- **XML Safety:** `xmlEscape()` - Ensures proper XML encoding
- **Filename Generation:** `generateDynamicFilename()`, `sanitizeConditionName()`
- **Validation Helpers:** `isRCTCTriggerCode()`, `getConditionSpecificValueSet()`

**Dependencies:** config.js (for RCTC data)

**Critical For:** Converting between UI datetime formats and HL7 CDA timestamps, ensuring XML safety

---

### 3. **data-loaders.js** (16 KB)
**Purpose:** Asynchronous loading of external data from RCTC Excel files

**Key Functions:**
- **RCTC Loaders:**
  - `loadLabObsFromRCTC()` - Lab observation test codes (LOINC)
  - `loadDiagnosisFromRCTC()` - Diagnosis problem codes (SNOMED CT)
  - `loadLabOrderFromRCTC()` - Lab order test codes (LOINC)
  - `loadOrganismFromRCTC()` - Organism/substance codes (SNOMED CT)
  - `loadTestsFromRCTC()` - Test result codes (LOINC)
- **Conditions:** `loadConditionsFromExcel()` - Load reportable conditions
- **Fallbacks:** Hardcoded data sets if Excel files unavailable

**Dependencies:** config.js, data-transformers.js, XLSX.js library

**Critical For:** Populating RCTC trigger code dropdowns and search functionality

---

### 4. **form-handlers.js** (21 KB)
**Purpose:** Form data collection, persistence, and document relationship management

**Key Functions:**
- **Data Management:**
  - `getFormData()` - Collects all form field values including evidence arrays
  - `setFormData()` - Populates form from saved data object
- **Persistence:**
  - `saveFormData()` - Export form to JSON file
  - `loadFormData()` - Import form from JSON file
  - `loadFormDataDialog()` - Trigger file input for loading
  - `loadFormDataFromAssets()` - Load pre-made templates from assets folder
- **Document Versioning:**
  - `handleRelationshipTypeChange()` - Toggle related document fields
  - `getEffectiveSetId()` - Calculate document set ID for versioning
- **Utilities:** `generateUUID()`, `generateGUID()`, `showCleanUINotification()`

**Dependencies:** config.js, data-transformers.js, repeater-managers.js

**Critical For:** Save/load form functionality, document versioning (Replace/Update documents)

---

### 5. **validation.js** (26 KB)
**Purpose:** Comprehensive form validation and DQ Schematron rule checking

**Key Functions:**
- **Master Validator:** `validateFormData()` - Runs all validation checks
- **DQ Schematron Checks:**
  - `validateDQPatientName()` - Patient name format rules (dq-001/002/003/004)
  - `validateDQPatientAddress()` - Address completeness (dq-005/006/007)
  - `validateDQAdministrativeGender()` - Gender code validation (dq-008)
  - `validateDQRaceCode()` - Race category validation (dq-009/010/011)
  - `validateDQEthnicityCode()` - Ethnicity validation (dq-012/013/014)
  - `validateDQDateFormats()` - Date/time precision rules (dq-015)
  - `validateDQSpecimen()` - Specimen type and body site (dq-016/017)
  - `validateDQTriggerCodes()` - RCTC trigger code presence (dq-018)
  - `validateDQDeathIndicator()` - Death date logic (dq-019/020)
  - `validateDQLabObservations()` - Lab result structure (dq-021/022/023)
  - `validateDQMedicationAdministration()` - Medication rules (dq-024/025)
  - `validateDQImmunizations()` - Immunization completeness (dq-026/027)
  - `validateDQProblemObservations()` - Problem observation rules (dq-028/029)
- **Display:** `displayValidationErrors()`, `displayValidationSuccess()`
- **Trigger Validation:** `validateTriggerCode()`, `isRCTCTriggerCode()`
- **XML Validation:** `validateXMLComments()` - Check for invalid XML comment syntax

**Dependencies:** config.js (DQ_VALUESETS, NON_BLOCKING_DQ), form-handlers.js

**Critical For:** Ensuring HL7 CDA R2 compliance before document generation

---

### 6. **search-functions.js** (33 KB)
**Purpose:** RCTC code search and dropdown population

**Key Functions:**
- **Generic Search:** `searchRCTCCodes()` - Search any RCTC dataset
- **Diagnosis Search:**
  - `searchRCTCForDiagnosis()` - Search by diagnosis code
  - `searchRCTCForDiagnosisByName()` - Search by diagnosis name
- **Problem Search:**
  - `searchSNOMEDForProblem()` - Search SNOMED problem codes
  - `searchSNOMEDForProblemByName()` - Search SNOMED by name
- **Lab Test Search:**
  - `searchRCTCForTest()` - Search LOINC test codes
  - `searchRCTCForTestByName()` - Search tests by name
- **Organism Search:**
  - `searchRCTCForOrganism()` - Search SNOMED organism codes
  - `searchRCTCForOrganismByName()` - Search organisms by name
- **Lab Order Search:**
  - `searchRCTCForLabOrder()` - Search LOINC order codes
  - `searchRCTCForLabOrderByName()` - Search orders by name
- **Dropdown Management:** `populateConditionDropdowns()`, `handleDiagnosisSelection()`

**Dependencies:** config.js (RCTC data arrays), data-loaders.js

**Critical For:** User-friendly code lookup with autocomplete search

---

### 7. **repeater-managers.js** (12 KB)
**Purpose:** Dynamic evidence section management (add/remove repeatable entries)

**Key Functions:**
- **Lab Evidence:**
  - `addLabEvidence()` - Add lab order/result entry
  - `removeLabEvidence()` - Remove lab entry
  - `collectLabEvidence()` - Gather all lab data for form save
- **Diagnosis Evidence:**
  - `addDiagnosisEvidence()` - Add diagnosis entry with RCTC codes
  - `removeDiagnosisEvidence()` - Remove diagnosis entry
  - `collectDiagnosisEvidence()` - Gather diagnosis data
- **Problem Evidence:**
  - `addProblemEvidence()` - Add problem observation entry
  - `removeProblemEvidence()` - Remove problem entry
  - `collectProblemEvidence()` - Gather problem data
- **UI Helpers:**
  - `toggleValueEditors()` - Switch between coded/quantity/text result types
  - `migrateLegacyLabsToNewSystem()` - Convert old lab format to new

**Dependencies:** config.js, data-transformers.js, form-handlers.js

**Critical For:** Managing repeatable sections (multiple labs, diagnoses, problems per eICR)

---

### 8. **xml-builders.js** (92 KB - Largest Module)
**Purpose:** HL7 CDA R2 eICR XML document generation

**Key Functions:**
- **Main Builder:** `buildEICRXml()` - 3500+ line master function that builds complete eICR
- **Section Builders:**
  - `buildSpecimenSection()` - Specimen collection details
  - `buildResultsSectionXML()` - Lab results with observations
  - `generateVitalSignsEntries()` - Vital signs observations
  - `generateSocialHistorySection()` - Social history (occupation, pregnancy, travel)
  - `generateEncountersSection()` - Encounter details
- **Entry Generators:**
  - `generateMedicationEntries()` - Medication administration entries
  - `generateImmunizationEntries()` - Immunization entries
  - `generateProcedureEntries()` - Procedure entries
  - `generateDiagnosisEntries()` - Diagnosis/problem entries with RCTC triggers
- **Observation Builders:**
  - `generatePregnancyObservation()` - Pregnancy status
  - `generateEstimatedDeliveryDate()` - EDD observation
  - `generateOccupationObservation()` - Occupation details
  - `generateTravelHistoryObservation()` - Travel history
- **Table Builders:**
  - `buildDiagnosisTableRows()` - Human-readable diagnosis table
  - `buildProblemsTableRows()` - Human-readable problems table
- **Helpers:**
  - `emitResultAuthorXML()` - Result author (ordering provider)
  - `getReferenceRange()` - Lab reference range formatter
  - `mapInterp()` - Interpretation code mapper
- **Wrappers:** `generateEICRXml()`, `generateCDA()` - Convenience aliases

**Dependencies:** config.js, data-transformers.js, form-handlers.js, repeater-managers.js

**Critical For:** Generating valid HL7 CDA R2 eICR documents (LOINC 55751-2)

**Standards Implemented:**
- HL7 CDA Release 2.0
- HL7 Consolidated CDA (C-CDA) Release 2.1
- HL7 eICR R2 (2.1.0)
- DQ Schematron rules
- APHL RCTC trigger code integration

---

### 9. **rr-generator.js** (21 KB)
**Purpose:** Reportability Response (RR) XML generation

**Key Functions:**
- **Main Builder:** `buildRRXml()` - Generates complete HL7 RR document
- **Metadata:** `buildMetadataXml()` - Package metadata for ZIP files
- **Download Functions:**
  - `generateAndDownloadRR()` - Generate and download standalone RR
  - `downloadZipOfEICRandRR()` - Generate ZIP with eICR XML, RR XML, eICR HTML, RR HTML, metadata
- **Wrappers:** `generateRR()`, `generateRRXml()` - Convenience aliases

**Dependencies:** config.js, data-transformers.js, form-handlers.js, xml-builders.js, xslt-processor.js, validation.js

**Critical For:** Generating reportability responses that accompany eICR submissions

**Standards Implemented:**
- HL7 Reportability Response (RR) R2
- APHL AIMS integration
- Jurisdiction-specific reportability rules

---

### 10. **xslt-processor.js** (6.2 KB)
**Purpose:** XML to HTML transformation using XSLT stylesheets

**Key Functions:**
- **Transformation:**
  - `xmlToHtml()` - Transform CDA XML to HTML using XSLT
  - `transformEICRToHTML()` - Transform eICR specifically
  - `transformRRToHTML()` - Transform RR specifically
- **Loading:** `fetchXslt()` - Async load XSLT files from local paths
- **Debugging:**
  - `debugXmlStructure()` - Analyze XML document structure
  - `debugXsltFiles()` - Verify XSLT file integrity

**Dependencies:** config.js (XSLT URLs), Browser XSLTProcessor API

**Critical For:** Generating human-readable HTML views of CDA documents

---

### 11. **file-downloaders.js** (7.5 KB)
**Purpose:** File generation and download operations

**Key Functions:**
- **CDA Generation:** `generateAndDownloadCDA()` - Validate, generate, and download eICR XML
- **File System API:** Uses modern `showSaveFilePicker()` API with fallback to traditional download
- **Utilities:** Blob creation, dynamic filename generation, error handling

**Dependencies:** validation.js, xml-builders.js, form-handlers.js, data-transformers.js

**Critical For:** Downloading generated eICR files with proper naming and user-selected save locations

---

### 12. **ui-interactions.js** (9.5 KB)
**Purpose:** UI behavior management and conditional field displays

**Key Functions:**
- **Conditional Displays:**
  - `setupConditionalDisplays()` - Initialize all conditional field logic
  - `togglePregnancyFields()` - Show/hide pregnancy-related fields
  - `toggleGuardianFields()` - Show/hide guardian fields based on patient age
- **Excel Loading:** `loadConditionsFromExcel()` - Load conditions from Excel file (originally in data-loaders, may be duplicate)
- **Event Handlers:**
  - Outside click detection for search dropdowns
  - Birth date change listeners
- **Notifications:** `showCleanUINotification()` - Display success/error notifications

**Dependencies:** config.js, form-handlers.js

**Critical For:** Dynamic form behavior and user experience

---

### 13. **initialization.js** (2.8 KB)
**Purpose:** Application startup and initialization logic

**Key Functions:**
- **DOMContentLoaded Handler:** Main application bootstrap
- **Startup Tasks:**
  - Load conditions from Excel
  - Setup conditional field displays
  - Initialize document relationship fields
  - Add default evidence entries (lab, diagnosis, problem)
  - Generate random document ID
  - Set default birth date
- **Utilities:** `generateUUID()` - Create unique document identifiers

**Dependencies:** All modules (runs last after all other modules load)

**Critical For:** Initial application state setup and default data population

---

## 🔄 Dependency Chain

```
config.js
    ↓
data-transformers.js
    ↓
data-loaders.js
    ↓
form-handlers.js
    ↓
validation.js
    ↓
search-functions.js
    ↓
repeater-managers.js
    ↓
xml-builders.js
    ↓
rr-generator.js
    ↓
xslt-processor.js
    ↓
file-downloaders.js
    ↓
ui-interactions.js
    ↓
initialization.js (startup)
```

---

## 🎯 Module Interaction Flow

### User Fills Form → Generate eICR:
1. **User Input** → form fields populated
2. **Search** (search-functions.js) → RCTC code lookup
3. **Evidence** (repeater-managers.js) → Add multiple labs/diagnoses
4. **Click "Generate CDA"** → file-downloaders.js
5. **Validate** (validation.js) → Check DQ Schematron rules
6. **Collect Data** (form-handlers.js) → getFormData()
7. **Transform** (data-transformers.js) → Convert dates, escape XML
8. **Build XML** (xml-builders.js) → Generate HL7 CDA eICR
9. **Download** (file-downloaders.js) → Save to user's chosen location

### User Saves Form Data:
1. **Click "Save Form Data"** → form-handlers.js
2. **Collect** (form-handlers.js) → getFormData()
3. **Collect Evidence** (repeater-managers.js) → collectLabEvidence(), etc.
4. **Transform Dates** (data-transformers.js) → datetimeLocalToCda()
5. **Export JSON** (form-handlers.js) → saveFormData()

### User Loads Form Data:
1. **Click "Load Form Data"** → form-handlers.js triggers file input
2. **Parse JSON** (form-handlers.js) → loadFormData()
3. **Populate Form** (form-handlers.js) → setFormData()
4. **Convert Dates** (data-transformers.js) → cdaToDatetimeLocal()
5. **Restore Evidence** (repeater-managers.js) → addLabEvidence(), etc.

---

## 📊 Module Size & Complexity

| Module | Lines | Complexity | Primary Responsibility |
|--------|-------|------------|----------------------|
| xml-builders.js | ~3800 | Very High | HL7 CDA XML generation |
| search-functions.js | ~1400 | High | RCTC code search |
| validation.js | ~700 | High | DQ Schematron validation |
| form-handlers.js | ~500 | Medium | Form data management |
| data-transformers.js | ~800 | Medium | Data conversion |
| rr-generator.js | ~500 | Medium | RR XML generation |
| data-loaders.js | ~400 | Medium | External data loading |
| repeater-managers.js | ~500 | Medium | Evidence sections |
| ui-interactions.js | ~260 | Low | UI behaviors |
| file-downloaders.js | ~200 | Low | File operations |
| xslt-processor.js | ~180 | Low | XSLT transformation |
| config.js | ~80 | Low | Configuration |
| initialization.js | ~90 | Low | Startup |

---

## 🏥 Medical Software Standards

Each module contributes to maintaining compliance with:

- **HL7 CDA Release 2.0** - Clinical Document Architecture
- **C-CDA Release 2.1** - Consolidated CDA Implementation Guide
- **eICR R2 (2.1.0)** - Electronic Initial Case Report
- **RR R2** - Reportability Response
- **DQ Schematron Rules** - Data Quality validation
- **LOINC Codes** - Lab observations and orders
- **SNOMED CT Codes** - Diagnoses, problems, organisms
- **APHL RCTC** - Reportable Condition Trigger Codes

---

## 🔒 Global Exports

Each module exposes functions to `window` object for cross-module access:

**config.js:**
- Global variables (no window exports, direct global scope)

**data-transformers.js:**
- (Functions used internally, not explicitly exposed)

**form-handlers.js:**
- `window.saveFormData`
- `window.loadFormDataDialog`
- `window.loadFormDataFromAssets`
- `window.handleRelationshipTypeChange`
- `window.handleRelatedDocumentIdChange`

**validation.js:**
- `window.validateFormData`
- `window.validateTriggerCode`
- `window.validateXMLComments`

**xml-builders.js:**
- `window.buildEICRXml`
- `window.generateEICRXml`
- `window.generateRRXml`
- `window.generateDynamicFilename`

**rr-generator.js:**
- `window.buildRRXml`
- `window.generateAndDownloadRR`
- `window.downloadZipOfEICRandRR`

**xslt-processor.js:**
- `window.fetchXslt`
- `window.xmlToHtml`
- `window.debugXmlStructure`
- `window.transformEICRToHTML`
- `window.transformRRToHTML`

**file-downloaders.js:**
- `window.generateAndDownloadCDA`

**ui-interactions.js:**
- `window.setupConditionalDisplays`
- `window.loadConditionsFromExcel`

---

## 📝 Notes

- All code preserved exactly from original implementation
- No logic modifications during modularization
- Medical software integrity maintained
- HL7 standards compliance verified
- APHL RCTC integration preserved
- Each module is independently testable
- Clear separation of concerns
- Load order is critical for proper initialization

---

**Last Updated:** October 1, 2025
**Total Modules:** 13 JavaScript files
**Total Code:** 6,335 lines
**Architecture:** Modular, dependency-ordered, medical-grade software
