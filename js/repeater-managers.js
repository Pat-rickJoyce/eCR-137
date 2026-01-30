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

// Expose functions globally for onclick attributes
window.addDiagnosisEvidence = addDiagnosisEvidence;
window.removeDiagnosisEvidence = removeDiagnosisEvidence;
window.addProblemEvidence = addProblemEvidence;
window.removeProblemEvidence = removeProblemEvidence;
window.addLabEvidence = addLabEvidence;
window.removeLabEvidence = removeLabEvidence;
window.toggleValueEditors = toggleValueEditors;
