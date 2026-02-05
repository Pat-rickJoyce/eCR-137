/**
 * form-handlers.js
 *
 * Form data management functions
 * Handles getting/setting form data, loading/saving JSON files, and document relationship handling
 */

function getFormData() {
    const fields = [
        // Patient Demographics
        'patientId', 'patientName', 'patientPhone', 'patientEmail', 'patientAddress',
        'patientCity', 'patientState', 'patientZip', 'patientCounty', 'patientCountry',
        'patientGender', 'patientBirthDate', 'patientRace', 'patientEthnicity',
        'patientBirthPlace', 'patientBirthSex', 'patientGenderIdentity', 'patientDetailedRace',
        'patientDetailedEthnicity', 'patientLanguage', 'patientDeathIndicator', 'patientDeathDate',
'patientBirthPlaceCity', 'patientBirthPlaceState', 'patientBirthPlaceCountry', 'patientBirthPlaceFacility',

        // Guardian Information
        'guardianName', 'guardianPhone', 'guardianEmail', 'guardianAddress', 'guardianCity',
        'guardianState', 'guardianZip', 'guardianCode',

        // Provider Information
        'providerId', 'providerName', 'providerPhone', 'providerEmail', 'providerFax',
        'facilityId', 'facilityName', 'facilityAddress', 'facilityTypeCode',
        'organizationName', 'organizationId', 'organizationPhone', 'organizationEmail',
        'organizationFax', 'organizationAddress',

        // Encounter Information
        'encounterId', 'encounterType', 'encounterDate', 'encounterEndDate', 'encounterDisposition',
        'chiefComplaint', 'presentIllness', 'reasonForVisit', 'pastMedicalHistory', 'reviewOfSystems',

        // Diagnoses
        'diagnosis1Code', 'diagnosis1Name', 'diagnosis2Code', 'diagnosis2Name', 'diagnosis3Code', 'diagnosis3Name',
        'diagnosis1Date', 'diagnosis1OnsetDate', 'diagnosis2Date', 'diagnosis2OnsetDate',
        'diagnosis3Date', 'diagnosis3OnsetDate', 'problemType', 'symptoms',

        // Laboratory Tests
        'labTest1Code', 'labTest1Name', 'labTest1Result', 'labTest2Code', 'labTest2Name', 'labTest2Result',
        'labOrder1Code', 'labOrder1Id', 'labOrder1Time', 'labTest1Status', 'labTest1Time',
        'labTest1Interpretation', 'labTest1ReferenceRange', 'labTest2Status', 'labTest2Time',
        'labTest2Interpretation', 'labTest2ReferenceRange',
        'resultLabCLIA', 'resultLabName',
        'resultPerformerNPI', 'resultPerformerGiven', 'resultPerformerFamily',
        'resultOrderingNPI', 'resultOrderingGiven', 'resultOrderingFamily',

        // Medications
'adminMed1Code', 'adminMed1Name', 'adminMed1Id', 'adminMed1Status', 'adminMed1Time',
'adminMed1Route',
'adminMed1DoseValue', 'adminMed1DoseUnit', 'adminMed1VolValue', 'adminMed1VolUnit', 'adminMed1Negated',

'adminMed2Code', 'adminMed2Name', 'adminMed2Id', 'adminMed2Status', 'adminMed2Time',
'adminMed2Route',
'adminMed2DoseValue', 'adminMed2DoseUnit', 'adminMed2VolValue', 'adminMed2VolUnit', 'adminMed2Negated',

// Medications
'adminMed1Code', 'adminMed1Name', 'adminMed1Id', 'adminMed1Status', 'adminMed1Time',
'adminMed1Route',
'adminMed1DoseValue', 'adminMed1DoseUnit', 'adminMed1VolValue', 'adminMed1VolUnit', 'adminMed1Negated',

'adminMed2Code', 'adminMed2Name', 'adminMed2Id', 'adminMed2Status', 'adminMed2Time',
'adminMed2Route',
'adminMed2DoseValue', 'adminMed2DoseUnit', 'adminMed2VolValue', 'adminMed2VolUnit', 'adminMed2Negated',

// Administering Provider (applies to ALL administered meds)
'administeringProviderNPI',
'administeringProviderGiven',
'administeringProviderMiddle',
'administeringProviderFamily',
'administeringProviderPhone',
'administeringProviderOrgName',
'administeringProviderOrgId',
'administeringProviderOrgIdRoot',

        // Immunizations
        'immunization1Status', 'immunization1Id', 'immunization1Date', 'vaccine1Code', 'vaccine1Name',
        'vaccine1Dose', 'vaccine1Route', 'vaccine1Manufacturer', 'vaccine1Lot','immunization2Status', 'immunization2Id',
        'immunization2Date', 'vaccine2Code', 'vaccine2Name', 'vaccine2Dose', 'vaccine2Route', 'vaccine2Manufacturer', 'vaccine2Lot',
        // Pregnancy Information
        'pregnancyStatus', 'pregnancyEffectiveTime', 'estimatedDeliveryDate', 'pregnancyDeterminationMethod',
        'gestationalAge', 'lastMenstrualPeriod', 'pregnancyOutcome', 'postpartumStatus',

        // Travel History
        'travelStartDate', 'travelEndDate', 'travelLocation', 'travelLocationCode', 'travelAddress',
        'purposeOfTravel', 'transportationType', 'transportationDetails',

        // Occupation Information
        'currentOccupation', 'usualOccupation', 'currentIndustry', 'usualIndustry', 'currentJobTitle',
        'currentEmployerName', 'currentEmployerPhone', 'currentEmployerAddress', 'occupationalExposure', 'employmentStatus',

        // Specimen Information
        'specimen1Source', 'specimen1Type', 'specimen1Id', 'collection1Date',
        'specimen2Source', 'specimen2Type', 'specimen2Id', 'collection2Date',

        // Additional Clinical Data
        'temperature', 'bloodPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation',
        'weight', 'height', 'bmi', 'therapeuticResponse', 'homelessStatus', 'congregateLiving', 'congregateLivingType',

        // Procedures
        'currentProc1Code', 'currentProc1Name', 'currentProc1Date', 'currentProc1Type',
        'currentProc2Code', 'currentProc2Name', 'currentProc2Date', 'currentProc2Type',
        'triggerProc1Code', 'triggerProc1Name', 'triggerProc1Date', 'triggerProc1Type',
        'plannedProc1Code', 'plannedProc1Name', 'plannedProc1Date', 'plannedProc1Type',

        // Results / Lab providers
'ordProvNPI','ordProvGiven','ordProvMiddle','ordProvFamily','ordProvPhone',
'ordProvOrgName','ordProvOrgId','ordProvOrgIdRoot','ordProvTime',

'resPerfNPI','resPerfGiven','resPerfMiddle','resPerfFamily','resPerfPhone',
'resPerfOrgName','resPerfOrgId','resPerfOrgIdRoot',

        // Special Populations and Demographics
        'disabilityStatus', 'disabilityType', 'tribalAffiliation', 'tribalEnrollment',
        'countryOfNationality', 'countryOfNationalityCode', 'countryOfResidence', 'countryOfResidenceCode',
        'immigrationStatus', 'preferredLanguage', 'interpreterNeeded', 'insuranceStatus',

        // Emergency and Public Health
        'emergencyOutbreakInfo', 'outbreakDetails', 'exposureContactInfo', 'exposureType',
        'exposureLocation', 'exposureDate', 'contactPersonName', 'contactPersonPhone',
        'vaccineCredentialAssertion', 'vaccineCardAvailable', 'quarantineStatus', 'isolationStatus',

        // Document Information
        'documentId', 'effectiveTime', 'documentRelationshipType', 'relatedDocumentId', 'setId', 'versionNumber'
    ];

    const data = {};
    fields.forEach(field => {
const element = document.getElementById(field);
if (element) {
    // Special handling for datetime fields
    if ((field === 'patientBirthDate' ||
         field === 'encounterDate' ||
         field === 'encounterEndDate' ||
         field === 'patientDeathDate' ||
         field === 'pregnancyEffectiveTime' ||
         field === 'estimatedDeliveryDate' ||
         field === 'lastMenstrualPeriod' ||
         field === 'travelStartDate' ||
         field === 'travelEndDate' ||
         field === 'currentProc1Date' ||
         field === 'currentProc2Date' ||
         field === 'triggerProc1Date' ||
         field === 'plannedProc1Date' ||
         field === 'immunization1Date' ||
         field === 'immunization2Date' ||
         field === 'collection1Date' ||
         field === 'collection2Date' ||
         field === 'adminMed1Time' ||
         field === 'adminMed2Time' ||
         field === 'effectiveTime') &&
        element.type === 'datetime-local') {
        data[field] = datetimeLocalToCda(element.value);
    } else {
        data[field] = element.value;
    }
}
});

    // ADD THIS: Collect lab evidence
    data.labEvidence = collectLabEvidence();

    // ADD THIS: Collect diagnosis evidence
    data.diagnosisEvidence = collectDiagnosisEvidence();
    console.log('getFormData diagnosis evidence:', data.diagnosisEvidence); // DEBUG

    // ADD THIS: Collect problem evidence
    data.problemEvidence = collectProblemEvidence();
    console.log('Form data problem evidence:', data.problemEvidence); // DEBUG LINE

    // Collect administered medications
    data.administeredMedications = collectAdministeredMedications();

    // Collect immunizations
    data.immunizations = collectImmunizations();

    // Collect procedures
    data.procedures = collectProcedures();

    return data;
}

function setFormData(data) {
Object.keys(data).forEach(field => {
    const element = document.getElementById(field);
    if (element) {
        // Comprehensive list of datetime fields
        const datetimeFields = [
            'patientBirthDate', 'encounterDate', 'encounterEndDate', 'patientDeathDate',
            'pregnancyEffectiveTime', 'estimatedDeliveryDate', 'lastMenstrualPeriod',
            'travelStartDate', 'travelEndDate', 'currentProc1Date', 'currentProc2Date',
            'triggerProc1Date', 'plannedProc1Date', 'immunization1Date', 'immunization2Date',
            'collection1Date', 'collection2Date', 'adminMed1Time', 'adminMed2Time',
            'effectiveTime', 'diagnosis1Date', 'diagnosis2Date', 'diagnosis3Date',
            'diagnosis1OnsetDate', 'diagnosis2OnsetDate', 'diagnosis3OnsetDate'
        ];

        if (datetimeFields.includes(field) && element.type === 'datetime-local') {
            const convertedValue = cdaToDatetimeLocal(data[field]);
            element.value = convertedValue;
            console.log(`Setting ${field}: "${data[field]}" -> "${convertedValue}"`);
        } else {
            element.value = data[field];
        }
    }
});
}

// Make this function globally available for the Clean UI system
window.loadFormDataFromAssets = async function(filename) {
    try {
        console.log(`Attempting to load: ./assets/forms/${filename}`);

        const response = await fetch(`./assets/forms/${filename}`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Form template file not found: ${filename}`);
            }
            throw new Error(`Failed to load form data file: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.warn('File may not be JSON format, attempting to parse anyway');
        }

        const data = await response.json();

        // Validate that it's a form data object
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid form data format - expected JSON object');
        }

        setFormData(data);

        // Handle lab evidence if present
        if (data.labEvidence && Array.isArray(data.labEvidence)) {
            const labList = document.getElementById('labEvidenceList');
            if (labList) {
                labList.innerHTML = '';
                data.labEvidence.forEach(labEntry => {
                    addLabEvidence(labEntry);
                });
            }
        }

        // Handle diagnosis evidence if present
        if (data.diagnosisEvidence && Array.isArray(data.diagnosisEvidence)) {
            const diagnosisList = document.getElementById('diagnosisEvidenceList');
            if (diagnosisList) {
                diagnosisList.innerHTML = '';
                data.diagnosisEvidence.forEach(diagnosisEntry => {
                    addDiagnosisEvidence(diagnosisEntry);
                });
            }
        }

        // Handle problem evidence if present
        if (data.problemEvidence && Array.isArray(data.problemEvidence)) {
            const problemList = document.getElementById('problemEvidenceList');
            if (problemList) {
                problemList.innerHTML = '';
                data.problemEvidence.forEach(problemEntry => {
                    addProblemEvidence(problemEntry);
                });
            }
        }

        // Handle administered medications if present
        if (data.administeredMedications && Array.isArray(data.administeredMedications)) {
            const medicationList = document.getElementById('administeredMedicationList');
            if (medicationList) {
                medicationList.innerHTML = '';
                data.administeredMedications.forEach(medicationEntry => {
                    addAdministeredMedication(medicationEntry);
                });
            }
        }

        // Handle immunizations if present
        if (data.immunizations && Array.isArray(data.immunizations)) {
            const immunizationList = document.getElementById('immunizationList');
            if (immunizationList) {
                immunizationList.innerHTML = '';
                data.immunizations.forEach(immunizationEntry => {
                    addImmunization(immunizationEntry);
                });
            }
        }

        // Handle procedures if present
        if (data.procedures && Array.isArray(data.procedures)) {
            const procedureList = document.getElementById('procedureList');
            if (procedureList) {
                procedureList.innerHTML = '';
                data.procedures.forEach(procedureEntry => {
                    addProcedure(procedureEntry);
                });
            }
        }

        console.log(`Successfully loaded form template: ${filename}`);

        // Trigger reportability evaluation after form data is loaded
        if (typeof window.triggerReportabilityEvaluation === 'function') {
            console.log('[FormLoader] Triggering reportability evaluation...');
            setTimeout(() => window.triggerReportabilityEvaluation(), 100);
        } else {
            console.warn('[FormLoader] window.triggerReportabilityEvaluation not available');
        }

        // Show success message with Clean UI styling
        showCleanUINotification(`✅ ${filename.replace('.json', '')} template loaded successfully!`, 'success');
        return true;
    } catch (error) {
        console.error('Error loading form data from assets:', error);
        showCleanUINotification(`❌ Error loading ${filename}: ${error.message}`, 'error');
        return false;
    }
};

// Optional: Add a notification system that matches your Clean UI
window.showCleanUINotification = function(message, type = 'info') {
    // Remove any existing notifications
    const existing = document.querySelector('.ui81-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'ui81-notification';
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: ${type === 'error' ? '#fee2e2' : '#f0fdf4'};
        border: 1px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'};
        color: ${type === 'error' ? '#dc2626' : '#16a34a'};
        border-radius: 12px; padding: 16px 20px;
        box-shadow: var(--shadow-2); max-width: 400px;
        font-size: 14px; font-weight: 500;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
};

function loadRCTCFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = handleRCTCFile;
    input.click();
}

function handleRCTCFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    alert('RCTC file processing would require additional libraries in a real implementation. For now, the generator uses hardcoded RCTC OID and version information.');

    console.log('RCTC file selected:', file.name);
}

function handleRelationshipTypeChange() {
    const relationshipTypeEl = document.getElementById('documentRelationshipType');
    if (!relationshipTypeEl) return; // Element doesn't exist yet

    const relationshipType = relationshipTypeEl.value;
    const relatedDocIdGroup = document.getElementById('relatedDocIdGroup');
    const setIdGroup = document.getElementById('setIdGroup');
    const versionGroup = document.getElementById('versionGroup');

    // Check if all elements exist before manipulating
    if (!relatedDocIdGroup || !setIdGroup || !versionGroup) return;

    if (relationshipType === 'RPLC' || relationshipType === 'APND') {
        relatedDocIdGroup.style.display = 'block';
        setIdGroup.style.display = 'block';
        versionGroup.style.display = 'block';
    } else {
        relatedDocIdGroup.style.display = 'none';
        setIdGroup.style.display = 'none';
        versionGroup.style.display = 'none';
    }
}

// Handle related document ID change
function handleRelatedDocumentIdChange() {
    // This function is called when the related document ID field changes
    // Currently a stub for future validation or processing
    const relatedDocId = document.getElementById('relatedDocumentId')?.value.trim();
    // Future: Add validation or processing logic here
}

// Save form data to JSON file
function saveFormData() {
    const data = getFormData();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RCTC_eICR_form_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Load form data from JSON file
function loadFormData(event) {
const file = event.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = function(e) {
    try {
        const data = JSON.parse(e.target.result);
        setFormData(data);

        // Handle lab evidence if present
        if (data.labEvidence && Array.isArray(data.labEvidence)) {
            const labList = document.getElementById('labEvidenceList');
            if (labList) {
                labList.innerHTML = '';
                data.labEvidence.forEach(labEntry => {
                    // Convert dates back to datetime-local format before adding
                    const convertedLabEntry = { ...labEntry };
                    if (convertedLabEntry.orderTime) {
                        convertedLabEntry.orderTime = cdaToDatetimeLocal(convertedLabEntry.orderTime);
                    }
                    if (convertedLabEntry.time) {
                        convertedLabEntry.time = cdaToDatetimeLocal(convertedLabEntry.time);
                    }
                    addLabEvidence(convertedLabEntry);
                });
            }
        }

        // Handle diagnosis evidence if present - FIX THE DATE CONVERSION HERE
        if (data.diagnosisEvidence && Array.isArray(data.diagnosisEvidence)) {
            const diagnosisList = document.getElementById('diagnosisEvidenceList');
            if (diagnosisList) {
                diagnosisList.innerHTML = '';
                data.diagnosisEvidence.forEach(diagnosisEntry => {
                    // Convert dates back to datetime-local format before adding
                    const convertedDiagnosisEntry = { ...diagnosisEntry };
                    if (convertedDiagnosisEntry.diagnosisDate) {
                        convertedDiagnosisEntry.diagnosisDate = cdaToDatetimeLocal(convertedDiagnosisEntry.diagnosisDate);
                    }
                    if (convertedDiagnosisEntry.onsetDate) {
                        convertedDiagnosisEntry.onsetDate = cdaToDatetimeLocal(convertedDiagnosisEntry.onsetDate);
                    }
                    addDiagnosisEvidence(convertedDiagnosisEntry);
                });
            }
        }

        // Handle problem evidence if present - FIX THE DATE CONVERSION HERE
        if (data.problemEvidence && Array.isArray(data.problemEvidence)) {
            const problemList = document.getElementById('problemEvidenceList');
            if (problemList) {
                problemList.innerHTML = '';
                data.problemEvidence.forEach(problemEntry => {
                    // Convert dates back to datetime-local format before adding
                    const convertedProblemEntry = { ...problemEntry };
                    if (convertedProblemEntry.onsetDate) {
                        convertedProblemEntry.onsetDate = cdaToDatetimeLocal(convertedProblemEntry.onsetDate);
                    }
                    addProblemEvidence(convertedProblemEntry);
                });
            }
        }

        alert('Form data loaded successfully!');

        // Trigger reportability evaluation after form loads
        if (window.triggerReportabilityEvaluation) {
            setTimeout(() => {
                window.triggerReportabilityEvaluation();
            }, 500);
        }
    } catch (error) {
        alert('Error loading file: ' + error.message);
        console.error('Load error:', error);
    } finally {
        event.target.value = '';
    }
};
reader.readAsText(file);
}

// Populate condition dropdowns
function populateConditionDropdowns(conditions) {
    const diagnosisFields = ['diagnosis1Code', 'diagnosis2Code', 'diagnosis3Code'];
    const defaultValues = ['67531005', '414819007', '86299006']; // Original hardcoded values

    diagnosisFields.forEach((fieldId, index) => {
        const select = document.getElementById(fieldId);
        if (select && select.tagName === 'SELECT') {
            // Clear existing options except the first placeholder
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }

            // Add conditions as options
            conditions.forEach(condition => {
                const option = document.createElement('option');
                option.value = condition.code;
                option.textContent = `${condition.code} - ${condition.description} (${condition.condition})`;

                // Mark RCTC trigger codes
                if (isRCTCTriggerCode(condition.code)) {
                    option.textContent += ' [RCTC]';
                    option.style.fontWeight = 'bold';
                }

                select.appendChild(option);
            });

            // Set default value and trigger auto-population
            if (defaultValues[index]) {
                select.value = defaultValues[index];
                handleDiagnosisSelection(fieldId, defaultValues[index], conditions);
            }
        }
    });
}

// Handle diagnosis code selection
function handleDiagnosisSelection(fieldId, selectedCode, conditions) {
    const nameFieldId = fieldId.replace('Code', 'Name');
    const nameField = document.getElementById(nameFieldId);

    if (nameField && selectedCode) {
        const selectedCondition = conditions.find(c => c.code === selectedCode);
        if (selectedCondition) {
            nameField.value = selectedCondition.condition;
        }
    }

    // Validate trigger code
    validateTriggerCode(fieldId);
}

// Get effective set ID based on document relationship type
function getEffectiveSetId(data) {
    if (data.documentRelationshipType === 'RPLC' || data.documentRelationshipType === 'APND') {
        return data.setId || data.documentId;
    }
    return data.documentId;
}

// Trigger file input dialog
function loadFormDataDialog() {
    const fileInput = document.getElementById('loadFormDataInput');
    if (fileInput) {
        fileInput.click();
    }
}

// Expose functions globally for onclick attributes
window.saveFormData = saveFormData;
window.loadFormDataDialog = loadFormDataDialog;
window.loadFormDataFromAssets = loadFormDataFromAssets;
window.handleRelationshipTypeChange = handleRelationshipTypeChange;
window.handleRelatedDocumentIdChange = handleRelatedDocumentIdChange;
