# JavaScript Extraction Summary

## Files Created

### 

1. **js/config.js** - Global configuration and constants
   - XSLT URLs
   - Global data arrays (labObsData, diagnosisData, etc.)
   - RCTC metadata
   - DQ ValueSets
   - Non-blocking DQ validation errors

2. **js/data-transformers.js** - Data conversion and transformation
   - Route translation functions (FDA, SNOMED)
   - Dose unit fixers
   - Provider taxonomy codes
   - Date conversion functions (cdaToDatetimeLocal, datetimeLocalToCda, normalizeTS)
   - Display name mappers (race, ethnicity, pregnancy, emergency, etc.)
   - Interpretation code mapping
   - Condition-specific value set mapping
   - Filename generation (sanitizeConditionName, generateDynamicFilename)
   - All transformation helper functions

3. **js/data-loaders.js** - Async data loading from Excel files
   - loadLabObsFromRCTC()
   - loadDiagnosisFromRCTC()
   - loadLabOrderFromRCTC()
   - loadOrganismFromRCTC()
   - loadTestsFromRCTC()
   - loadConditionsFromExcel()
   - All fallback hardcoded data functions
   - Excel file parsing with XLSX library

4. **js/form-handlers.js** - Form data management
   - getFormData() - Extracts all form fields to object
   - setFormData() - Populates form from data object
   - loadFormDataFromAssets() - Load templates from assets folder
   - saveFormData() - Export form data to JSON
   - loadFormData() - Import form data from JSON file
   - handleRelationshipTypeChange() - Document relationship UI
   - populateConditionDropdowns() - Dynamic dropdowns
   - handleDiagnosisSelection() - Diagnosis code selection
   - getEffectiveSetId() - Document ID management
   - showCleanUINotification() - UI notification system
   - loadRCTCFile(), handleRCTCFile() - RCTC file handling

### 5. js/validation.js - Form validation functions
- validateXMLComments()
- validateRelatedDocumentFields()
- validateTriggerCode()
- validateDateFormat()
- validateRequiredFields()
- validateDQPatientName()
- validateDQPatientAddress()
- validateDQAdministrativeGender()
- validateDQRaceCode()
- validateDQEthnicityCode()
- validateDQDateFormats()
- validateDQSpecimen()
- validateDQTriggerCodes()
- validateDQDeathIndicator()
- validateDQLabObservations()
- validateDQMedicationAdministration()
- validateDQImmunizations()
- validateDQProblemObservations()
- validateFormData() - Main validation function

### 6. js/search-functions.js - RCTC search and filtering
- searchLabObs()
- searchDiagnosis()
- searchLabOrder()
- searchOrganism()
- searchTests()
- filterLabObsByCode()
- filterDiagnosisByCode()
- isRCTCTriggerCode()
- highlightTriggerCodes()


### 7. js/ui-interactions.js - UI toggles and interactions
- togglePregnancyFields()
- toggleGuardianFields()
- setupConditionalDisplays()
- handleRelationshipTypeChange()
- Show/hide sections based on form values
- Click handlers for search results
- Dynamic field visibility

### 8. js/repeater-managers.js - Add/Remove repeater functions
- addLabEvidence()
- removeLabEvidence()
- collectLabEvidence()
- addDiagnosisEvidence()
- removeDiagnosisEvidence()
- collectDiagnosisEvidence()
- addProblemEvidence()
- removeProblemEvidence()
- collectProblemEvidence()
- migrateLegacyLabsToNewSystem()

### 9. js/xml-builders.js - XML generation helper functions
- generateGUID()
- xmlEscape()
- buildDiagnosisTableRows()
- buildProblemsTableRows()
- generateDiagnosisEntries()
- generateProblemEntries()
- generateVitalSignsEntries()
- generateMedicationEntries()
- generateImmunizationEntries()
- generateProcedureEntries()
- generatePregnancyObservation()
- buildSpecimenSection()
- buildResultsSectionXML()
- generateRelatedDocumentXml()

### 10. js/rr-generator.js - RR (Reportability Response) XML generation
- buildRRXml()
- generateRRXml()
- RR-specific XML building functions

**Located at:** Lines 1900-2073 (approximately)

### 11. js/xslt-processor.js - XSLT transformation functions
- xmlToHtml()
- transformEICRToHTML()
- transformRRToHTML()
- loadXSLT()
- XSLT processor configuration


### 12. js/file-downloaders.js - File download and save functions
- generateAndDownloadCDA()
- generateAndDownloadRR()
- downloadHTML()
- downloadJSON()
- File System Access API implementation
- Blob creation and URL handling


### 13. js/initialization.js - DOMContentLoaded initialization
- DOMContentLoaded event listener
- loadConditionsFromExcel() call
- setupConditionalDisplays() call
- handleRelationshipTypeChange() call
- addLabEvidence() initialization
- addDiagnosisEvidence() initialization
- addProblemEvidence() initialization
- birthDate default value setting
- generateUUID() for documentId

## Key Functions by Category

### Date/Time Handling
- cdaToDatetimeLocal() - CDA format to datetime-local
- datetimeLocalToCda() - datetime-local to CDA format
- normalizeTS() - Timestamp normalization

### RCTC/Trigger Code Functions
- isRCTCTriggerCode()
- validateTriggerCode()
- getConditionSpecificValueSet()
- highlightTriggerCodes()

### XML Generation
- buildEICRXml() - Main eICR XML generator (MASSIVE function ~3500 lines)
- buildRRXml() - Reportability Response XML
- generateRelatedDocumentXml()
- Multiple section builders (specimen, results, vital signs, etc.)

### Form Data Management
- getFormData() - Extract all form data
- setFormData() - Populate form from data
- saveFormData() - Export to JSON
- loadFormData() - Import from JSON

### Validation
- validateFormData() - Master validation
- validateDQ* functions - Data Quality checks
- validateTriggerCode() - RCTC validation
- validateRequiredFields()
