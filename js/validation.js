/**
 * validation.js
 *
 * Form Validation and Data Quality (DQ) Schematron Checking
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file contains comprehensive validation functions for ensuring:
 * - Required fields are populated
 * - Data conforms to HL7 CDA R2 specifications
 * - Trigger codes are present (RCTC requirements)
 * - DQ Schematron rules are satisfied
 *
 * Dependencies:
 * - form-handlers.js (getFormData)
 * - config.js (RCTC data, value sets)
 *
 * @medical-software CRITICAL - Validation ensures CDA compliance and prevents data quality issues
 */

console.log('✅ validation.js is loading...');

// Note: DQ_VALUESETS and NON_BLOCKING_DQ are defined in config.js which loads first

/**
 * Check if a code is a known RCTC trigger code
 * @param {string} code - The code to validate
 * @returns {boolean} True if the code is a recognized RCTC trigger code
 */
function isRCTCTriggerCode(code) {
    const triggerCodes = ['840539006', '719865001', '3928002', '94310-0', '34487-9', '168731009',
                         '41040004', '72951007', '67531005', '86299006', '414819007'];
    return triggerCodes.includes(code);
}

/**
 * Validate a trigger code and log warnings if not recognized
 * @param {string} fieldId - ID of the field containing the trigger code
 */
function validateTriggerCode(fieldId) {
    const code = document.getElementById(fieldId).value;

    if (code && !isRCTCTriggerCode(code)) {
        console.log('Warning: Code', code, 'may not be a valid RCTC trigger code');
    }
}

/**
 * Validate XML Comments
 * Checks for invalid double hyphens within XML comments
 * @param {string} xmlString - The XML document as string
 * @param {string} docType - Document type for logging (eICR/RR)
 * @returns {number} Number of comments found
 */
function validateXMLComments(xmlString, docType) {
  console.log(`Validating ${docType} XML comments...`);

  // Find all comments using a simple approach
  const comments = [];
  let startIndex = 0;
  while (true) {
    const start = xmlString.indexOf('<!--', startIndex);
    if (start === -1) break;
    const end = xmlString.indexOf('-->', start + 4);
    if (end === -1) break;
    comments.push(xmlString.substring(start, end + 3));
    startIndex = end + 3;
  }

  comments.forEach((comment, index) => {
    // Check for double hyphens in the middle of comments
    const innerContent = comment.slice(4, -3); // Remove <!-- and -->
    if (innerContent.includes('--')) {
      console.error(`Invalid comment #${index + 1} in ${docType}:`, comment);
      console.error('Contains double hyphens which violate XML specification');
    }
  });

  console.log(`Found ${comments.length} comments total in ${docType}`);
  return comments.length;
}

/**
 * Validate Related Document Fields
 * Ensures required relationship fields are populated when not creating a new document
 * @returns {boolean} True if validation passes
 */
function validateRelatedDocumentFields() {
    const relationshipType = document.getElementById('documentRelationshipType').value;
    const relatedDocIdField = document.getElementById('relatedDocumentId');

    if (relationshipType !== 'NEW' && !relatedDocIdField.value.trim()) {
        alert('Related Document ID is required when relationship type is not "New Document".');
        relatedDocIdField.focus();
        return false;
    }
    return true;
}

/**
 * Validate Date Format
 * Checks if a date string is in valid CDA format or convertible datetime-local format
 * @param {string} dateString - The date string to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {boolean} True if date format is valid
 */
function validateDateFormat(dateString, fieldName) {
    if (!dateString) return true; // Allow empty dates

    // Check if it's already in CDA format (YYYYMMDD or YYYYMMDDHHMMSS)
    const cdaDatePattern = /^\d{8}$/; // YYYYMMDD
    const cdaDateTimePattern = /^\d{14}$/; // YYYYMMDDHHMMSS

    if (cdaDatePattern.test(dateString) || cdaDateTimePattern.test(dateString)) {
        return true;
    }

    // Check if it's a valid datetime-local format that we can convert
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        return true;
    }

    alert(`${fieldName} must be a valid date/time format`);
    return false;
}

/**
 * Validate Required Fields
 * Ensures all critical fields are populated before CDA generation
 * @returns {boolean} True if all required fields are present
 */
function validateRequiredFields() {
    const requiredFields = [
        { id: 'patientId', name: 'Patient ID' },
        { id: 'patientName', name: 'Patient Name' },
        { id: 'patientBirthDate', name: 'Patient Birth Date' },
        { id: 'providerId', name: 'Provider ID' },
        { id: 'providerName', name: 'Provider Name' },
        { id: 'encounterId', name: 'Encounter ID' },
        { id: 'encounterDate', name: 'Encounter Date' },
        { id: 'documentId', name: 'Document ID' },
        { id: 'effectiveTime', name: 'Effective Time' }
    ];

    for (let field of requiredFields) {
        const element = document.getElementById(field.id);
        if (!element || !element.value.trim()) {
            alert(`${field.name} is required`);
            element?.focus();
            return false;
        }
    }
    return true;
}

/**
 * DQ Validation: Patient Name
 * @returns {string[]} Array of validation errors
 */
function validateDQPatientName() {
    const errors = [];
    const nameField = document.getElementById('patientName');

    if (!nameField || !nameField.value || nameField.value.trim() === '') {
        errors.push('dq-patientName-001: Patient name cannot be nullFlavor or empty');
    } else {
        const nameParts = nameField.value.trim().split(' ');
        if (nameParts.length < 2) {
            errors.push('dq-patientName-002/004: Patient must have both family and given name');
        }
    }

    return errors;
}

/**
 * DQ Validation: Patient Address
 * @returns {string[]} Array of validation errors
 */
function validateDQPatientAddress() {
    const errors = [];
    const addressField = document.getElementById('patientAddress');
    const cityField = document.getElementById('patientCity');
    const stateField = document.getElementById('patientState');
    const zipField = document.getElementById('patientZip');

    if (!addressField?.value?.trim()) {
        errors.push('dq-patientAddress-002/003/004: Street address line cannot be nullFlavor or blank');
    }
    if (!cityField?.value?.trim()) {
        errors.push('dq-patientAddress-005/006: City cannot be nullFlavor or blank');
    }
    if (!stateField?.value?.trim()) {
        errors.push('dq-patientAddress-007/008: State cannot be nullFlavor or blank');
    }
    if (!zipField?.value?.trim()) {
        errors.push('dq-patientAddress-009/010: Postal code cannot be nullFlavor or blank');
    }

    return errors;
}

/**
 * DQ Validation: Administrative Gender
 * @returns {string[]} Array of validation errors
 */
function validateDQAdministrativeGender() {
    const errors = [];
    const genderField = document.getElementById('patientGender');

    if (!genderField?.value) {
        errors.push('dq-administrativeGenderCode-001: Administrative gender code cannot be nullFlavor');
    } else if (!DQ_VALUESETS.administrativeGender.values.includes(genderField.value)) {
        errors.push('dq-administrativeGenderCode-002: Administrative gender code must be M, F, or UN');
    }

    return errors;
}

/**
 * DQ Validation: Race Code
 * @returns {string[]} Array of validation errors
 */
function validateDQRaceCode() {
    const errors = [];
    const raceField = document.getElementById('patientRace');

    if (!raceField?.value) {
        errors.push('dq-raceCode-001: Race code cannot be nullFlavor');
    } else if (!DQ_VALUESETS.raceCategory.values.includes(raceField.value) && raceField.value !== 'UNK') {
        errors.push('dq-raceCode-002: Race code must be from Race Category Excluding Nulls ValueSet');
    }

    return errors;
}

/**
 * DQ Validation: Ethnicity Code
 * @returns {string[]} Array of validation errors
 */
function validateDQEthnicityCode() {
    const errors = [];
    const ethnicityField = document.getElementById('patientEthnicity');

    if (!ethnicityField?.value) {
        errors.push('dq-ethnicGroupCode-001: Ethnicity code cannot be nullFlavor');
    } else if (!DQ_VALUESETS.ethnicity.values.includes(ethnicityField.value) && ethnicityField.value !== 'UNK') {
        errors.push('dq-ethnicGroupCode-002: Ethnicity code must be from Ethnicity ValueSet');
    }

    return errors;
}

/**
 * DQ Validation: Date Formats
 * @returns {string[]} Array of validation errors
 */
function validateDQDateFormats() {
    const errors = [];
    const dateFields = [
        { id: 'patientBirthDate', name: 'Patient Birth Date' },
        { id: 'encounterDate', name: 'Encounter Date' },
        { id: 'patientDeathDate', name: 'Patient Death Date' },
        { id: 'diagnosis1Date', name: 'Diagnosis 1 Date' },
        { id: 'diagnosis1OnsetDate', name: 'Diagnosis 1 Onset Date' },
        { id: 'labTest1Time', name: 'Lab Test 1 Time' },
        { id: 'immunization1Date', name: 'Immunization 1 Date' },
        { id: 'specimenCollectionDate', name: 'Specimen Collection Date' }
    ];

    dateFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element?.value) {
            if (!validateDateFormat(element.value, field.name)) {
                errors.push(`dq-dateFormat: ${field.name} must be at least 8 characters (YYYYMMDD)`);
            }
        }
    });

    return errors;
}

/**
 * DQ Validation: Specimen Information
 * @returns {string[]} Array of validation errors
 */
function validateDQSpecimen() {
    const errors = [];

    // Check specimen 1
    const spec1Source = document.getElementById('specimen1Source');
    const spec1Type = document.getElementById('specimen1Type');
    const spec1Id = document.getElementById('specimen1Id');
    const collect1Date = document.getElementById('collection1Date');

    if (spec1Source?.value && !DQ_VALUESETS.specimenType.values.includes(spec1Source.value)) {
        errors.push('dq-specimenType-002: Specimen 1 source must be from HL7 Specimen Type ValueSet');
    }

    if (collect1Date?.value && collect1Date.value.length < 8) {
        errors.push('dq-specimenCollectionDate-002: Specimen 1 collection date must be at least 8 characters');
    }

    if (spec1Id?.value && !spec1Id.value.trim()) {
        errors.push('dq-specimenId-001: Specimen 1 ID cannot be nullFlavor or empty');
    }

    // Check specimen 2
    const spec2Source = document.getElementById('specimen2Source');
    const spec2Type = document.getElementById('specimen2Type');
    const spec2Id = document.getElementById('specimen2Id');
    const collect2Date = document.getElementById('collection2Date');

    if (spec2Source?.value && !DQ_VALUESETS.specimenType.values.includes(spec2Source.value)) {
        errors.push('dq-specimenType-002: Specimen 2 source must be from HL7 Specimen Type ValueSet');
    }

    if (collect2Date?.value && collect2Date.value.length < 8) {
        errors.push('dq-specimenCollectionDate-002: Specimen 2 collection date must be at least 8 characters');
    }

    if (spec2Id?.value && !spec2Id.value.trim()) {
        errors.push('dq-specimenId-001: Specimen 2 ID cannot be nullFlavor or empty');
    }

    return errors;
}

/**
 * DQ Validation: Trigger Codes (CRITICAL)
 * Ensures at least one RCTC trigger code is present in the document
 * @returns {string[]} Array of validation errors
 */
function validateDQTriggerCodes() {
    const errors = [];
    const data = getFormData();

    let hasTriggerCode = false;

    // Check diagnosis evidence
    if (Array.isArray(data.diagnosisEvidence)) {
        hasTriggerCode = data.diagnosisEvidence.some(d =>
            isRCTCTriggerCode(d.diagnosisCode) || d.isRCTC
        );
    }

    // Check lab evidence
    if (!hasTriggerCode && Array.isArray(data.labEvidence)) {
        hasTriggerCode = data.labEvidence.some(ev =>
            ev.isRCTC ||
            isRCTCTriggerCode(ev.testCode) ||
            isRCTCTriggerCode(ev.valueCode)
        );
    }

    // Check remaining legacy fields (remove these checks once you've fully migrated)
    const legacyTriggerFields = [
        'labTest1Code', 'labTest2Code', 'labOrder1Code',
        'adminMed1Code', 'adminMed2Code', 'vaccine1Code', 'vaccine2Code'
    ];

    if (!hasTriggerCode) {
        legacyTriggerFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element?.value?.trim()) {
                hasTriggerCode = true;
            }
        });
    }

    if (!hasTriggerCode) {
        errors.push('FATAL: At least one trigger code template must be present (eICR requirement)');
    }

    return errors;
}

/**
 * DQ Validation: Death Indicator
 * @returns {string[]} Array of validation errors
 */
function validateDQDeathIndicator() {
    const errors = [];
    const deathIndicator = document.getElementById('patientDeathIndicator');
    const deathDate = document.getElementById('patientDeathDate');

    if (deathIndicator?.value === 'true' && !deathDate?.value) {
        errors.push('dq-deceasedTime: Death date cannot be nullFlavor when death indicator is true');
    }

    return errors;
}

/**
 * DQ Validation: Lab Observations
 * @returns {string[]} Array of validation errors
 */
function validateDQLabObservations() {
    const errors = [];

    // Lab Test 1 validation
    const lab1Code = document.getElementById('labTest1Code');
    const lab1Status = document.getElementById('labTest1Status');
    const lab1Result = document.getElementById('labTest1Result');

    if (lab1Code?.value && (!lab1Code.value.trim() || lab1Code.value === 'nullFlavor')) {
        errors.push('dq-resultObservation-002: Lab test 1 code cannot be nullFlavor');
    }

    if (lab1Status?.value && (!lab1Status.value.trim() || lab1Status.value === 'nullFlavor')) {
        errors.push('dq_lab_result_statusCode_001: Lab test 1 status code cannot be nullFlavor');
    }

    if (lab1Result?.value && (!lab1Result.value.trim() || lab1Result.value === 'nullFlavor')) {
        errors.push('dq-resultObservation-001: Lab test 1 result value cannot be nullFlavor');
    }

    // Lab Test 2 validation
    const lab2Code = document.getElementById('labTest2Code');
    const lab2Status = document.getElementById('labTest2Status');
    const lab2Result = document.getElementById('labTest2Result');

    if (lab2Code?.value && (!lab2Code.value.trim() || lab2Code.value === 'nullFlavor')) {
        errors.push('dq-resultObservation-002: Lab test 2 code cannot be nullFlavor');
    }

    if (lab2Status?.value && (!lab2Status.value.trim() || lab2Status.value === 'nullFlavor')) {
        errors.push('dq_lab_result_statusCode_001: Lab test 2 status code cannot be nullFlavor');
    }

    if (lab2Result?.value && (!lab2Result.value.trim() || lab2Result.value === 'nullFlavor')) {
        errors.push('dq-resultObservation-001: Lab test 2 result value cannot be nullFlavor');
    }

    return errors;
}

/**
 * DQ Validation: Medication Administration
 * @returns {string[]} Array of validation errors
 */
function validateDQMedicationAdministration() {
    const errors = [];

    // Medication 1 validation
    const med1Id = document.getElementById('adminMed1Id');
    const med1Code = document.getElementById('adminMed1Code');

    if (med1Id?.value && (!med1Id.value.trim() || med1Id.value === 'nullFlavor')) {
        errors.push('dq-medicationAdministration-id-001: Medication 1 ID cannot be nullFlavor');
    }

    if (med1Code?.value && (!med1Code.value.trim() || med1Code.value === 'nullFlavor')) {
        errors.push('dq_medicationsAdministered-001: Medication 1 code cannot be nullFlavor');
    }

    // Medication 2 validation
    const med2Id = document.getElementById('adminMed2Id');
    const med2Code = document.getElementById('adminMed2Code');

    if (med2Id?.value && (!med2Id.value.trim() || med2Id.value === 'nullFlavor')) {
        errors.push('dq-medicationAdministration-id-001: Medication 2 ID cannot be nullFlavor');
    }

    if (med2Code?.value && (!med2Code.value.trim() || med2Code.value === 'nullFlavor')) {
        errors.push('dq_medicationsAdministered-001: Medication 2 code cannot be nullFlavor');
    }

    return errors;
}

/**
 * DQ Validation: Immunizations
 * @returns {string[]} Array of validation errors
 */
function validateDQImmunizations() {
    const errors = [];

    // Immunization 1 validation
    const imm1Id = document.getElementById('immunization1Id');
    const imm1Date = document.getElementById('immunization1Date');
    const vac1Code = document.getElementById('vaccine1Code');

    if (imm1Id?.value && (!imm1Id.value.trim() || imm1Id.value === 'nullFlavor')) {
        errors.push('dq-immunizationActivity-id-001: Immunization 1 ID cannot be nullFlavor');
    }

    if (imm1Date?.value && (!imm1Date.value.trim() || imm1Date.value === 'nullFlavor')) {
        errors.push('dq-immunization-effectiveTime-001: Immunization 1 effective time cannot be nullFlavor');
    }

    if (imm1Date?.value && imm1Date.value.length < 8) {
        errors.push('dq-immunization-effectiveTime-003: Immunization 1 effective time must be at least 8 characters (YYYYMMDD)');
    }

    if (vac1Code?.value && (!vac1Code.value.trim() || vac1Code.value === 'nullFlavor')) {
        errors.push('dq-immunization-vaccineCode-001/002: Vaccine 1 code cannot be blank or nullFlavor');
    }

    // Immunization 2 validation
    const imm2Id = document.getElementById('immunization2Id');
    const imm2Date = document.getElementById('immunization2Date');
    const vac2Code = document.getElementById('vaccine2Code');

    if (imm2Id?.value && (!imm2Id.value.trim() || imm2Id.value === 'nullFlavor')) {
        errors.push('dq-immunizationActivity-id-001: Immunization 2 ID cannot be nullFlavor');
    }

    if (imm2Date?.value && (!imm2Date.value.trim() || imm2Date.value === 'nullFlavor')) {
        errors.push('dq-immunization-effectiveTime-001: Immunization 2 effective time cannot be nullFlavor');
    }

    if (imm2Date?.value && imm2Date.value.length < 8) {
        errors.push('dq-immunization-effectiveTime-003: Immunization 2 effective time must be at least 8 characters (YYYYMMDD)');
    }

    if (vac2Code?.value && (!vac2Code.value.trim() || vac2Code.value === 'nullFlavor')) {
        errors.push('dq-immunization-vaccineCode-001/002: Vaccine 2 code cannot be blank or nullFlavor');
    }

    return errors;
}

/**
 * DQ Validation: Problem Observations
 * @returns {string[]} Array of validation errors
 */
function validateDQProblemObservations() {
    const errors = [];

    // Diagnosis validation
    const diag1Code = document.getElementById('diagnosis1Code');
    const diag1Date = document.getElementById('diagnosis1Date');
    const diag1OnsetDate = document.getElementById('diagnosis1OnsetDate');

    if (diag1Code?.value && (!diag1Code.value.trim() || diag1Code.value === 'nullFlavor')) {
        errors.push('dq-problemObservation-002: Diagnosis 1 code cannot be nullFlavor');
    }

    if (diag1Date?.value && (!diag1Date.value.trim() || diag1Date.value === 'nullFlavor')) {
        errors.push('dq-validate_problem_DateofDiagnosis-001: Diagnosis 1 effective time cannot be nullFlavor');
    }

    if (diag1OnsetDate?.value && diag1OnsetDate.value.length < 8) {
        errors.push('dq-validate_problem_DateofDiagnosis-003: Diagnosis 1 onset date must be at least 8 characters (YYYYMMDD)');
    }

    return errors;
}

/**
 * Master Form Data Validation
 * Runs all validation checks and displays results
 * @returns {boolean} True if validation passes (or only non-blocking errors exist)
 */
function validateFormData() {
    const allErrors = [];

    // Run all DQ validation functions
    allErrors.push(...validateDQPatientName());
    allErrors.push(...validateDQPatientAddress());
    allErrors.push(...validateDQAdministrativeGender());
    allErrors.push(...validateDQRaceCode());
    allErrors.push(...validateDQEthnicityCode());
    allErrors.push(...validateDQDateFormats());
    allErrors.push(...validateDQSpecimen());
    allErrors.push(...validateDQTriggerCodes());
    allErrors.push(...validateDQDeathIndicator());
    allErrors.push(...validateDQLabObservations());
    allErrors.push(...validateDQMedicationAdministration());
    allErrors.push(...validateDQImmunizations());
    allErrors.push(...validateDQProblemObservations());

    // Legacy required fields validation
    if (!validateRequiredFields()) {
        allErrors.push('Required field validation failed');
    }

    // Related document validation
    if (!validateRelatedDocumentFields()) {
        allErrors.push('Related document field validation failed');
    }

    if (allErrors.length > 0) {
        displayValidationErrors(allErrors);

        // Check if any errors are blocking (not in NON_BLOCKING_DQ set)
        const blockingErrors = allErrors.filter(error => {
            const errorCode = error.split(':')[0];
            return !NON_BLOCKING_DQ.has(errorCode);
        });

        // Only return false if there are blocking errors
        return blockingErrors.length === 0;
    }

    // Clear any existing errors and show success message
    const existingErrors = document.getElementById('validation-errors');
    if (existingErrors) {
        existingErrors.style.display = 'none';
    }

    displayValidationSuccess();
    return true;
}

/**
 * Display Validation Errors
 * Shows validation errors in a formatted container
 * @param {string[]} errors - Array of error messages
 */
function displayValidationErrors(errors) {
    const errorContainer = document.getElementById('validation-errors') || createErrorContainer();
    errorContainer.innerHTML = '<h3>DQ Schematron Validation Errors:</h3>';

    const errorList = document.createElement('ul');
    errors.forEach(error => {
        const errorItem = document.createElement('li');
        errorItem.textContent = error;
        errorItem.style.color = 'red';
        errorItem.style.marginBottom = '5px';
        errorList.appendChild(errorItem);
    });

    errorContainer.appendChild(errorList);
    errorContainer.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Create Error Container
 * Creates a DOM element for displaying validation errors
 * @returns {HTMLElement} The created error container
 */
function createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'validation-errors';
    container.style.cssText = 'background: #fee; border: 2px solid #f00; padding: 20px; margin: 20px 0; border-radius: 5px;';
    document.querySelector('.container').insertBefore(container, document.querySelector('.footer-buttons'));
    return container;
}

/**
 * Display Validation Success
 * Shows a success message when validation passes
 */
function displayValidationSuccess() {
    let successContainer = document.getElementById('validation-success');
    if (!successContainer) {
        successContainer = document.createElement('div');
        successContainer.id = 'validation-success';
        successContainer.style.cssText = 'background: #efe; border: 2px solid #0a0; padding: 20px; margin: 20px 0; border-radius: 5px; color: #060;';
        document.querySelector('.container').insertBefore(successContainer, document.querySelector('.footer-buttons'));
    }

    successContainer.innerHTML = `
        <h3>✅ Validation Passed!</h3>
        <p>The form is ready for CDA generation.</p>
    `;
    successContainer.style.display = 'block';
    successContainer.scrollIntoView({ behavior: 'smooth' });

    // Hide success message after 5 seconds
    setTimeout(() => {
        successContainer.style.display = 'none';
    }, 5000);
}

// Expose functions globally for onclick attributes and other modules
window.validateFormData = validateFormData;
window.validateTriggerCode = validateTriggerCode;
window.validateXMLComments = validateXMLComments;

console.log('✅ validation.js loaded successfully. validateFormData:', typeof window.validateFormData);
