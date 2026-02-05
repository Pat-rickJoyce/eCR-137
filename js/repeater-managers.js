/**
 * repeater-managers.js
 *
 * Repeater Section Management Functions
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file manages dynamic repeating sections for:
 * - Lab Evidence (orders, tests, results)
 * - Diagnosis Evidence
 * - Problem Observations
 *
 * Dependencies:
 * - data-transformers.js (cdaToDatetimeLocal, datetimeLocalToCda)
 * - validation.js (isRCTCTriggerCode)
 *
 * @medical-software CRITICAL - Accurate evidence tracking is essential for case reporting
 */

/**
 * Add Lab Evidence Row
 * Adds a new lab evidence entry to the form with optional pre-filled data
 * @param {object} prefill - Optional data to pre-populate the row
 */
function addLabEvidence(prefill = {}) {
    const template = document.getElementById('labEvidenceTemplate');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.lab-evidence-row');

    // Populate with prefill data if provided - handle datetime fields specially
    if (prefill.orderCode) row.querySelector('.le-order-code').value = prefill.orderCode;
    if (prefill.orderName) row.querySelector('.le-order-name').value = prefill.orderName;
    if (prefill.orderId) row.querySelector('.le-order-id').value = prefill.orderId;

    // Handle datetime fields with conversion
    if (prefill.orderTime) {
        const orderTimeField = row.querySelector('.le-order-time');
        orderTimeField.value = prefill.orderTime.includes('T') ? prefill.orderTime : cdaToDatetimeLocal(prefill.orderTime);
    }

    if (prefill.testCode) row.querySelector('.le-test-code').value = prefill.testCode;
    if (prefill.testName) row.querySelector('.le-test-name').value = prefill.testName;
    if (prefill.valueKind) {
        row.querySelector('.le-value-kind').value = prefill.valueKind;
        toggleValueEditors(row.querySelector('.le-value-kind'));
    }
    if (prefill.valueCode) row.querySelector('.le-value-code').value = prefill.valueCode;
    if (prefill.valueName) row.querySelector('.le-value-name').value = prefill.valueName;
    if (prefill.qtyValue) row.querySelector('.le-qty-value').value = prefill.qtyValue;
    if (prefill.qtyUnit) row.querySelector('.le-qty-unit').value = prefill.qtyUnit;
    if (prefill.textValue) row.querySelector('.le-text-value').value = prefill.textValue;

    // Handle result time datetime field
    if (prefill.time) {
        const timeField = row.querySelector('.le-time');
        timeField.value = prefill.time.includes('T') ? prefill.time : cdaToDatetimeLocal(prefill.time);
    }

    if (prefill.status) row.querySelector('.le-status').value = prefill.status;
    if (prefill.interpretation) row.querySelector('.le-interpretation').value = prefill.interpretation;
    if (prefill.referenceRange) row.querySelector('.le-reference-range').value = prefill.referenceRange;

    document.getElementById('labEvidenceList').appendChild(clone);
}

/**
 * Remove Lab Evidence Row
 * Removes a lab evidence entry from the form
 * @param {HTMLElement} btn - The remove button element
 */
function removeLabEvidence(btn) {
    btn.closest('.lab-evidence-row')?.remove();
}

/**
 * Toggle Value Editors
 * Shows/hides appropriate value editors based on result type
 * @param {HTMLElement} sel - The value kind select element
 */
function toggleValueEditors(sel) {
    const row = sel.closest('.lab-evidence-row');
    row.querySelectorAll('.le-coded,.le-qty,.le-text').forEach(el => el.classList.add('hidden'));
    const kind = sel.value;
    if (kind === 'coded') row.querySelectorAll('.le-coded').forEach(el => el.classList.remove('hidden'));
    if (kind === 'quantity') row.querySelectorAll('.le-qty').forEach(el => el.classList.remove('hidden'));
    if (kind === 'text') row.querySelectorAll('.le-text').forEach(el => el.classList.remove('hidden'));
}

/**
 * Collect Lab Evidence
 * Extracts all lab evidence data from the form
 * @returns {object[]} Array of lab evidence objects
 */
function collectLabEvidence() {
    return Array.from(document.querySelectorAll('.lab-evidence-row')).map(r => {
        const kind = r.querySelector('.le-value-kind').value;
        return {
            // Order Information
            orderCode: r.querySelector('.le-order-code')?.value.trim() || '',
            orderName: r.querySelector('.le-order-name')?.value.trim() || '',
            orderId: r.querySelector('.le-order-id')?.value.trim() || '',
            orderTime: r.querySelector('.le-order-time')?.value.trim() || '',

            // Test/Result Information
            testCode: r.querySelector('.le-test-code')?.value.trim() || '',
            testName: r.querySelector('.le-test-name')?.value.trim() || '',
            valueKind: kind,
            valueCode: r.querySelector('.le-value-code')?.value.trim() || '',
            valueName: r.querySelector('.le-value-name')?.value.trim() || '',
            qtyValue: r.querySelector('.le-qty-value')?.value.trim() || '',
            qtyUnit: r.querySelector('.le-qty-unit')?.value.trim() || '',
            textValue: r.querySelector('.le-text-value')?.value.trim() || '',
            time: r.querySelector('.le-time')?.value.trim() || '',
            status: r.querySelector('.le-status')?.value || '',
            interpretation: r.querySelector('.le-interpretation')?.value || '',
            referenceRange: r.querySelector('.le-reference-range')?.value.trim() || '',
            isRCTC: isRCTCTriggerCode(r.querySelector('.le-test-code')?.value) ||
                    isRCTCTriggerCode(r.querySelector('.le-value-code')?.value) ||
                    isRCTCTriggerCode(r.querySelector('.le-order-code')?.value)
        };
    }).filter(x => x.testCode || x.testName || x.orderCode || x.orderName);
}

/**
 * Add Diagnosis Evidence Row
 * Adds a new diagnosis evidence entry to the form with optional pre-filled data
 * @param {object} prefill - Optional data to pre-populate the row
 */
function addDiagnosisEvidence(prefill = {}) {
    const template = document.getElementById('diagnosisEvidenceTemplate');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.diagnosis-evidence-row');

    // Populate with prefill data if provided
    if (prefill.diagnosisCode) row.querySelector('.de-diagnosis-code').value = prefill.diagnosisCode;
    if (prefill.diagnosisName) row.querySelector('.de-diagnosis-name').value = prefill.diagnosisName;

    // Handle datetime fields with conversion
    if (prefill.diagnosisDate) {
        const dateField = row.querySelector('.de-diagnosis-date');
        dateField.value = prefill.diagnosisDate.includes('T') ? prefill.diagnosisDate : cdaToDatetimeLocal(prefill.diagnosisDate);
    }
    if (prefill.onsetDate) {
        const onsetField = row.querySelector('.de-onset-date');
        onsetField.value = prefill.onsetDate.includes('T') ? prefill.onsetDate : cdaToDatetimeLocal(prefill.onsetDate);
    }

    if (prefill.status) row.querySelector('.de-status').value = prefill.status;

    document.getElementById('diagnosisEvidenceList').appendChild(clone);
}

/**
 * Remove Diagnosis Evidence Row
 * Removes a diagnosis evidence entry from the form
 * @param {HTMLElement} btn - The remove button element
 */
function removeDiagnosisEvidence(btn) {
    btn.closest('.diagnosis-evidence-row')?.remove();
}

/**
 * Collect Diagnosis Evidence
 * Extracts all diagnosis evidence data from the form
 * @returns {object[]} Array of diagnosis evidence objects
 */
function collectDiagnosisEvidence() {
    const rows = Array.from(document.querySelectorAll('.diagnosis-evidence-row'));
    console.log('Found diagnosis rows:', rows.length);

    const result = rows.map(r => {
        const data = {
            diagnosisCode: r.querySelector('.de-diagnosis-code')?.value.trim() || '',
            diagnosisName: r.querySelector('.de-diagnosis-name')?.value.trim() || '',
            diagnosisDate: r.querySelector('.de-diagnosis-date')?.value.trim() || '',
            onsetDate: r.querySelector('.de-onset-date')?.value.trim() || '',
            status: r.querySelector('.de-status')?.value || 'completed',
            isRCTC: isRCTCTriggerCode(r.querySelector('.de-diagnosis-code')?.value)
        };
        console.log('Collected diagnosis:', data);
        return data;
    }).filter(x => x.diagnosisCode || x.diagnosisName);

    console.log('Final diagnosis evidence:', result);
    return result;
}

/**
 * Add Problem Evidence Row
 * Adds a new problem observation entry to the form with optional pre-filled data
 * @param {object} prefill - Optional data to pre-populate the row
 */
function addProblemEvidence(prefill = {}) {
    const template = document.getElementById('problemEvidenceTemplate');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.problem-evidence-row');

    // Populate with prefill data if provided
    if (prefill.problemCode) row.querySelector('.pe-problem-code').value = prefill.problemCode;
    if (prefill.problemName) row.querySelector('.pe-problem-name').value = prefill.problemName;
    if (prefill.onsetDate) row.querySelector('.pe-onset-date').value = prefill.onsetDate;
    // Note: .pe-status doesn't exist in the problem evidence template, only .pe-concern-status
    if (prefill.concernStatus) row.querySelector('.pe-concern-status').value = prefill.concernStatus;

    document.getElementById('problemEvidenceList').appendChild(clone);
}

/**
 * Remove Problem Evidence Row
 * Removes a problem observation entry from the form
 * @param {HTMLElement} btn - The remove button element
 */
function removeProblemEvidence(btn) {
    btn.closest('.problem-evidence-row')?.remove();
}

/**
 * Collect Problem Evidence
 * Extracts all problem observation data from the form
 * @returns {object[]} Array of problem evidence objects
 */
function collectProblemEvidence() {
    return Array.from(document.querySelectorAll('.problem-evidence-row')).map(r => {
        const onsetDateElement = r.querySelector('.pe-onset-date');

        return {
            problemCode: r.querySelector('.pe-problem-code')?.value.trim() || '',
            problemName: r.querySelector('.pe-problem-name')?.value.trim() || '',
            onsetDate: onsetDateElement?.type === 'datetime-local' ?
                      datetimeLocalToCda(onsetDateElement.value) :
                      onsetDateElement?.value.trim() || '',
            status: r.querySelector('.pe-status')?.value || 'active',
            concernStatus: r.querySelector('.pe-concern-status')?.value || 'active'
        };
    }).filter(x => x.problemCode || x.problemName);
}

/**
 * Add Medication Evidence Row
 * Adds a new medication evidence entry to the form with optional pre-filled data
 * @param {object} prefill - Optional data to pre-populate the row
 */
function addMedicationEvidence(prefill = {}) {
    const template = document.getElementById('medicationEvidenceTemplate');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.medication-evidence-row');

    // Populate with prefill data if provided
    if (prefill.medicationCode) row.querySelector('.me-medication-code').value = prefill.medicationCode;
    if (prefill.medicationName) row.querySelector('.me-medication-name').value = prefill.medicationName;
    if (prefill.administrationTime) row.querySelector('.me-administration-time').value = prefill.administrationTime;
    if (prefill.status) row.querySelector('.me-status').value = prefill.status;
    if (prefill.route) row.querySelector('.me-route').value = prefill.route;
    if (prefill.doseValue) row.querySelector('.me-dose-value').value = prefill.doseValue;
    if (prefill.doseUnit) row.querySelector('.me-dose-unit').value = prefill.doseUnit;

    document.getElementById('medicationEvidenceList').appendChild(row);

    // Trigger reportability evaluation if available
    if (typeof window.triggerReportabilityEvaluation === 'function') {
        window.triggerReportabilityEvaluation();
    }
}

/**
 * Remove Medication Evidence Row
 * Removes a medication evidence entry from the form
 * @param {HTMLElement} btn - The remove button element
 */
function removeMedicationEvidence(btn) {
    btn.closest('.medication-evidence-row')?.remove();

    // Trigger reportability evaluation if available
    if (typeof window.triggerReportabilityEvaluation === 'function') {
        window.triggerReportabilityEvaluation();
    }
}

/**
 * Collect Medication Evidence
 * Extracts all medication evidence data from the form
 * @returns {object[]} Array of medication evidence objects
 */
function collectMedicationEvidence() {
    return Array.from(document.querySelectorAll('.medication-evidence-row')).map(r => {
        return {
            medicationCode: r.querySelector('.me-medication-code')?.value.trim() || '',
            medicationName: r.querySelector('.me-medication-name')?.value.trim() || '',
            administrationTime: r.querySelector('.me-administration-time')?.value.trim() || '',
            status: r.querySelector('.me-status')?.value || 'completed',
            route: r.querySelector('.me-route')?.value || '',
            doseValue: r.querySelector('.me-dose-value')?.value || '',
            doseUnit: r.querySelector('.me-dose-unit')?.value || ''
        };
    }).filter(x => x.medicationCode || x.medicationName);
}

/**
 * Migrate Legacy Labs to New System
 * Converts old single-field lab data to new evidence-based system
 * Run once during initialization to preserve backward compatibility
 */
function migrateLegacyLabsToNewSystem() {
    const legacyLabTest1Code = document.getElementById('labTest1Code')?.value;
    const legacyLabTest1Name = document.getElementById('labTest1Name')?.value;

    if (legacyLabTest1Code || legacyLabTest1Name) {
        console.log('Migrating legacy lab test 1 to new evidence system');
        addLabEvidence({
            testCode: legacyLabTest1Code || '',
            testName: legacyLabTest1Name || '',
            valueKind: 'text',
            textValue: document.getElementById('labTest1Result')?.value || '',
            time: document.getElementById('labTest1Time')?.value || '',
            status: document.getElementById('labTest1Status')?.value || 'completed',
            interpretation: document.getElementById('labTest1Interpretation')?.value || '',
            referenceRange: document.getElementById('labTest1ReferenceRange')?.value || ''
        });
    }
}

/**
 * Add Administered Medication Evidence Row
 * Adds a new administered medication entry to the form with optional pre-filled data
 * @param {object} prefill - Optional data to pre-populate the row
 */
function addAdministeredMedication(prefill = {}) {
    const template = document.getElementById('administeredMedicationTemplate');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.medication-administered-evidence-row');

    // Populate with prefill data if provided
    if (prefill.medicationCode) row.querySelector('.ame-medication-code').value = prefill.medicationCode;
    if (prefill.medicationName) row.querySelector('.ame-medication-name').value = prefill.medicationName;
    if (prefill.administrationId) row.querySelector('.ame-administration-id').value = prefill.administrationId;
    if (prefill.administrationTime) row.querySelector('.ame-administration-time').value = prefill.administrationTime;
    if (prefill.status) row.querySelector('.ame-status').value = prefill.status;
    if (prefill.route) row.querySelector('.ame-route').value = prefill.route;
    if (prefill.doseValue) row.querySelector('.ame-dose-value').value = prefill.doseValue;
    if (prefill.doseUnit) row.querySelector('.ame-dose-unit').value = prefill.doseUnit;
    if (prefill.volumeValue) row.querySelector('.ame-volume-value').value = prefill.volumeValue;
    if (prefill.volumeUnit) row.querySelector('.ame-volume-unit').value = prefill.volumeUnit;
    if (prefill.negated) row.querySelector('.ame-negated').checked = prefill.negated;

    // Performer fields (optional override)
    if (prefill.performerNPI) row.querySelector('.ame-performer-npi').value = prefill.performerNPI;
    if (prefill.performerGivenName) row.querySelector('.ame-performer-given').value = prefill.performerGivenName;
    if (prefill.performerMiddleName) row.querySelector('.ame-performer-middle').value = prefill.performerMiddleName;
    if (prefill.performerFamilyName) row.querySelector('.ame-performer-family').value = prefill.performerFamilyName;
    if (prefill.performerPhone) row.querySelector('.ame-performer-phone').value = prefill.performerPhone;

    document.getElementById('administeredMedicationList').appendChild(clone);
}

/**
 * Remove Administered Medication Evidence Row
 * Removes an administered medication entry from the form
 * @param {HTMLElement} btn - The remove button element
 */
function removeAdministeredMedication(btn) {
    btn.closest('.medication-administered-evidence-row')?.remove();
}

/**
 * Collect Administered Medication Evidence
 * Extracts all administered medication data from the form
 * @returns {object[]} Array of administered medication evidence objects
 */
function collectAdministeredMedications() {
    return Array.from(document.querySelectorAll('.medication-administered-evidence-row')).map(r => {
        // Get administration time element and convert if datetime-local
        const administrationTimeElement = r.querySelector('.ame-administration-time');
        const administrationTime = administrationTimeElement?.type === 'datetime-local' ?
                      datetimeLocalToCda(administrationTimeElement.value) :
                      administrationTimeElement?.value.trim() || '';

        return {
            // Core medication fields
            medicationCode: r.querySelector('.ame-medication-code')?.value.trim() || '',
            medicationName: r.querySelector('.ame-medication-name')?.value.trim() || '',
            administrationId: r.querySelector('.ame-administration-id')?.value.trim() || '',
            administrationTime: administrationTime,
            status: r.querySelector('.ame-status')?.value || 'completed',
            route: r.querySelector('.ame-route')?.value || '',
            doseValue: r.querySelector('.ame-dose-value')?.value.trim() || '',
            doseUnit: r.querySelector('.ame-dose-unit')?.value || '',
            volumeValue: r.querySelector('.ame-volume-value')?.value.trim() || '',
            volumeUnit: r.querySelector('.ame-volume-unit')?.value || '',
            negated: r.querySelector('.ame-negated')?.checked || false,

            // Performer (administering provider) fields - optional override
            performerNPI: r.querySelector('.ame-performer-npi')?.value.trim() || '',
            performerGivenName: r.querySelector('.ame-performer-given')?.value.trim() || '',
            performerMiddleName: r.querySelector('.ame-performer-middle')?.value.trim() || '',
            performerFamilyName: r.querySelector('.ame-performer-family')?.value.trim() || '',
            performerPhone: r.querySelector('.ame-performer-phone')?.value.trim() || ''
        };
    }).filter(x => x.medicationCode || x.medicationName);
}

/**
 * Add Immunization Row
 * Adds a new immunization entry to the form with optional pre-filled data
 * @param {object} prefill - Optional data to pre-populate the row
 */
function addImmunization(prefill = {}) {
    const template = document.getElementById('immunizationTemplate');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.immunization-row');

    // Populate with prefill data if provided
    if (prefill.vaccineCode) row.querySelector('.imm-vaccine-code').value = prefill.vaccineCode;
    if (prefill.vaccineName) row.querySelector('.imm-vaccine-name').value = prefill.vaccineName;
    if (prefill.immunizationId) row.querySelector('.imm-immunization-id').value = prefill.immunizationId;
    if (prefill.immunizationDate) row.querySelector('.imm-immunization-date').value = prefill.immunizationDate;
    if (prefill.status) row.querySelector('.imm-status').value = prefill.status;
    if (prefill.route) row.querySelector('.imm-route').value = prefill.route;
    if (prefill.doseValue) row.querySelector('.imm-dose-value').value = prefill.doseValue;
    if (prefill.doseUnit) row.querySelector('.imm-dose-unit').value = prefill.doseUnit;
    if (prefill.lotNumber) row.querySelector('.imm-lot-number').value = prefill.lotNumber;
    if (prefill.manufacturer) row.querySelector('.imm-manufacturer').value = prefill.manufacturer;
    if (prefill.negated) row.querySelector('.imm-negated').checked = prefill.negated;

    // Performer fields (optional override)
    if (prefill.performerNPI) row.querySelector('.imm-performer-npi').value = prefill.performerNPI;
    if (prefill.performerGivenName) row.querySelector('.imm-performer-given').value = prefill.performerGivenName;
    if (prefill.performerMiddleName) row.querySelector('.imm-performer-middle').value = prefill.performerMiddleName;
    if (prefill.performerFamilyName) row.querySelector('.imm-performer-family').value = prefill.performerFamilyName;
    if (prefill.performerPhone) row.querySelector('.imm-performer-phone').value = prefill.performerPhone;

    document.getElementById('immunizationList').appendChild(clone);
}

/**
 * Remove Immunization Row
 * Removes an immunization entry from the form
 * @param {HTMLElement} btn - The remove button element
 */
function removeImmunization(btn) {
    btn.closest('.immunization-row')?.remove();
}

/**
 * Collect Immunizations
 * Extracts all immunization data from the form
 * @returns {object[]} Array of immunization objects
 */
function collectImmunizations() {
    return Array.from(document.querySelectorAll('.immunization-row')).map(r => {
        // Get immunization date element and convert if datetime-local
        const immunizationDateElement = r.querySelector('.imm-immunization-date');
        const immunizationDate = immunizationDateElement?.type === 'datetime-local' ?
                      datetimeLocalToCda(immunizationDateElement.value) :
                      immunizationDateElement?.value.trim() || '';

        return {
            // Core immunization fields
            vaccineCode: r.querySelector('.imm-vaccine-code')?.value.trim() || '',
            vaccineName: r.querySelector('.imm-vaccine-name')?.value.trim() || '',
            immunizationId: r.querySelector('.imm-immunization-id')?.value.trim() || '',
            immunizationDate: immunizationDate,
            status: r.querySelector('.imm-status')?.value || 'completed',
            route: r.querySelector('.imm-route')?.value || '',
            doseValue: r.querySelector('.imm-dose-value')?.value.trim() || '',
            doseUnit: r.querySelector('.imm-dose-unit')?.value || '',
            lotNumber: r.querySelector('.imm-lot-number')?.value.trim() || '',
            manufacturer: r.querySelector('.imm-manufacturer')?.value.trim() || '',
            negated: r.querySelector('.imm-negated')?.checked || false,

            // Performer (administering provider) fields - optional override
            performerNPI: r.querySelector('.imm-performer-npi')?.value.trim() || '',
            performerGivenName: r.querySelector('.imm-performer-given')?.value.trim() || '',
            performerMiddleName: r.querySelector('.imm-performer-middle')?.value.trim() || '',
            performerFamilyName: r.querySelector('.imm-performer-family')?.value.trim() || '',
            performerPhone: r.querySelector('.imm-performer-phone')?.value.trim() || ''
        };
    }).filter(x => x.vaccineCode || x.vaccineName);
}

// Expose functions globally for onclick attributes
window.addDiagnosisEvidence = addDiagnosisEvidence;
window.removeDiagnosisEvidence = removeDiagnosisEvidence;
window.addProblemEvidence = addProblemEvidence;
window.removeProblemEvidence = removeProblemEvidence;
window.addLabEvidence = addLabEvidence;
window.removeLabEvidence = removeLabEvidence;
window.toggleValueEditors = toggleValueEditors;
window.addAdministeredMedication = addAdministeredMedication;
window.removeAdministeredMedication = removeAdministeredMedication;
window.collectAdministeredMedications = collectAdministeredMedications;
window.addImmunization = addImmunization;
window.removeImmunization = removeImmunization;
window.collectImmunizations = collectImmunizations;

// ============================================================================
// PROCEDURE REPEATER FUNCTIONS
// ============================================================================

/**
 * Adds a new procedure entry to the procedure list
 * @param {Object} prefill - Optional object with procedure data to prefill
 */
function addProcedure(prefill = {}) {
  const template = document.getElementById('procedureTemplate');
  if (!template) {
    console.error('Procedure template not found');
    return;
  }

  const clone = template.content.cloneNode(true);
  const row = clone.querySelector('.procedure-row');

  // Populate fields if prefill data provided
  if (prefill.procedureCode) row.querySelector('.proc-procedure-code').value = prefill.procedureCode;
  if (prefill.procedureName) row.querySelector('.proc-procedure-name').value = prefill.procedureName;
  if (prefill.codeSystem) row.querySelector('.proc-code-system').value = prefill.codeSystem;
  if (prefill.procedureId) row.querySelector('.proc-procedure-id').value = prefill.procedureId;
  if (prefill.procedureDate) row.querySelector('.proc-procedure-date').value = prefill.procedureDate;
  if (prefill.statusCode) row.querySelector('.proc-status').value = prefill.statusCode;
  if (prefill.targetSiteCode) row.querySelector('.proc-target-site-code').value = prefill.targetSiteCode;
  if (prefill.targetSiteName) row.querySelector('.proc-target-site-name').value = prefill.targetSiteName;
  if (prefill.methodCode) row.querySelector('.proc-method-code').value = prefill.methodCode;
  if (prefill.methodName) row.querySelector('.proc-method-name').value = prefill.methodName;
  if (prefill.procedureType) row.querySelector('.proc-procedure-type').value = prefill.procedureType;
  if (prefill.negated) row.querySelector('.proc-negated').checked = prefill.negated;

  // Performer override fields
  if (prefill.performerNPI) row.querySelector('.proc-performer-npi').value = prefill.performerNPI;
  if (prefill.performerGiven) row.querySelector('.proc-performer-given').value = prefill.performerGiven;
  if (prefill.performerMiddle) row.querySelector('.proc-performer-middle').value = prefill.performerMiddle;
  if (prefill.performerFamily) row.querySelector('.proc-performer-family').value = prefill.performerFamily;
  if (prefill.performerPhone) row.querySelector('.proc-performer-phone').value = prefill.performerPhone;

  document.getElementById('procedureList').appendChild(clone);
}

/**
 * Removes a procedure entry from the procedure list
 * @param {HTMLElement} btn - The remove button that was clicked
 */
function removeProcedure(btn) {
  const row = btn.closest('.procedure-row');
  if (row) {
    row.remove();
  }
}

/**
 * Collects all procedure data from the procedure list
 * @returns {Array} Array of procedure objects
 */
function collectProcedures() {
  const procedureRows = document.querySelectorAll('.procedure-row');
  return Array.from(procedureRows).map(row => {
    const procedureDateElement = row.querySelector('.proc-procedure-date');
    const procedureDate = procedureDateElement?.type === 'datetime-local' ?
                      datetimeLocalToCda(procedureDateElement.value) :
                      procedureDateElement?.value.trim() || '';

    return {
      procedureCode: row.querySelector('.proc-procedure-code')?.value.trim() || '',
      procedureName: row.querySelector('.proc-procedure-name')?.value.trim() || '',
      codeSystem: row.querySelector('.proc-code-system')?.value.trim() || '2.16.840.1.113883.6.96',
      procedureId: row.querySelector('.proc-procedure-id')?.value.trim() || '',
      procedureDate: procedureDate,
      statusCode: row.querySelector('.proc-status')?.value.trim() || 'completed',
      targetSiteCode: row.querySelector('.proc-target-site-code')?.value.trim() || '',
      targetSiteName: row.querySelector('.proc-target-site-name')?.value.trim() || '',
      methodCode: row.querySelector('.proc-method-code')?.value.trim() || '',
      methodName: row.querySelector('.proc-method-name')?.value.trim() || '',
      procedureType: row.querySelector('.proc-procedure-type')?.value.trim() || 'procedure',
      negated: row.querySelector('.proc-negated')?.checked || false,
      performerNPI: row.querySelector('.proc-performer-npi')?.value.trim() || '',
      performerGiven: row.querySelector('.proc-performer-given')?.value.trim() || '',
      performerMiddle: row.querySelector('.proc-performer-middle')?.value.trim() || '',
      performerFamily: row.querySelector('.proc-performer-family')?.value.trim() || '',
      performerPhone: row.querySelector('.proc-performer-phone')?.value.trim() || ''
    };
  }).filter(proc => proc.procedureCode || proc.procedureName);
}

// Expose functions globally
window.addProcedure = addProcedure;
window.removeProcedure = removeProcedure;
window.collectProcedures = collectProcedures;
