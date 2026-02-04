/**
 * initialization.js
 *
 * Application Initialization and DOMContentLoaded Setup
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file handles application startup:
 * - Loads conditions and RCTC data
 * - Sets up UI event listeners
 * - Initializes default form values
 * - Creates default evidence entries
 * - Generates unique document IDs
 *
 * Dependencies:
 * - All other JS modules
 *
 * @medical-software CRITICAL - Proper initialization ensures app functionality
 */

/**
 * Generate UUID (v4)
 * Creates a random UUID for document identification
 * @returns {string} UUID in standard format
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Migrate Legacy Medication Fields to Repeater
 * DEPRECATED: Legacy adminMed1/adminMed2 fields have been removed from the UI
 * This function is kept for backward compatibility with old saved JSON files
 */
function migrateLegacyMedicationsToRepeater() {
    // Legacy fields removed from UI - migration no longer needed
    console.log('[Migration] Legacy medication fields removed from UI - skipping migration');
}

/**
 * Migrate Legacy Immunization Fields to Repeater
 * Converts old vaccine1/vaccine2 and immunization1/immunization2 fields to new repeater format
 * Run once during initialization to preserve backward compatibility with old JSON files
 */
function migrateLegacyImmunizationsToRepeater() {
    // Check if we have any immunization rows already (means user is working with the repeater)
    if (document.querySelector('.immunization-row')) {
        console.log('[Migration] Immunization repeater already in use - skipping migration');
        return;
    }

    // Migrate immunization 1
    const vac1Code = document.getElementById('vaccine1Code')?.value;
    const vac1Name = document.getElementById('vaccine1Name')?.value;

    if (vac1Code || vac1Name) {
        console.log('[Migration] Migrating legacy immunization 1 to repeater');
        addImmunization({
            vaccineCode: vac1Code || '',
            vaccineName: vac1Name || '',
            immunizationId: document.getElementById('immunization1Id')?.value || '',
            immunizationDate: document.getElementById('immunization1Date')?.value || '',
            status: document.getElementById('immunization1Status')?.value || 'completed',
            route: document.getElementById('vaccine1Route')?.value || 'IM',
            doseValue: (document.getElementById('vaccine1Dose')?.value || '').split(/\s+/)[0] || '',
            doseUnit: (document.getElementById('vaccine1Dose')?.value || '').split(/\s+/)[1] || 'mL',
            lotNumber: document.getElementById('vaccine1Lot')?.value || '',
            manufacturer: document.getElementById('vaccine1Manufacturer')?.value || '',
            negated: false
        });
    }

    // Migrate immunization 2
    const vac2Code = document.getElementById('vaccine2Code')?.value;
    const vac2Name = document.getElementById('vaccine2Name')?.value;

    if (vac2Code || vac2Name) {
        console.log('[Migration] Migrating legacy immunization 2 to repeater');
        addImmunization({
            vaccineCode: vac2Code || '',
            vaccineName: vac2Name || '',
            immunizationId: document.getElementById('immunization2Id')?.value || '',
            immunizationDate: document.getElementById('immunization2Date')?.value || '',
            status: document.getElementById('immunization2Status')?.value || 'completed',
            route: document.getElementById('vaccine2Route')?.value || 'IM',
            doseValue: (document.getElementById('vaccine2Dose')?.value || '').split(/\s+/)[0] || '',
            doseUnit: (document.getElementById('vaccine2Dose')?.value || '').split(/\s+/)[1] || 'mL',
            lotNumber: document.getElementById('vaccine2Lot')?.value || '',
            manufacturer: document.getElementById('vaccine2Manufacturer')?.value || '',
            negated: false
        });
    }
}

/**
 * DOMContentLoaded Event Handler
 * Runs when page is fully loaded and ready for initialization
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('eICR Generator loaded');
    console.log('RCTC Metadata:', rctcData.metadata);

    // Load conditions from Excel file
    loadConditionsFromExcel().then(() => {
        console.log('Conditions loaded successfully');
    });

    setupConditionalDisplays();

    // Initialize document relationship fields
    handleRelationshipTypeChange();

    // NEW: Initialize lab evidence
    if (!document.querySelector('.lab-evidence-row')) {
        addLabEvidence();
    }

    // Initialize diagnosis evidence with default entries
    if (!document.querySelector('.diagnosis-evidence-row')) {

        addDiagnosisEvidence({
            diagnosisCode: '67531005',
            diagnosisName: 'Spina bifida (disorder)',
            diagnosisDate: '2024-06-01T00:00',
            onsetDate: '20240602',
            status: 'completed'
        })
    }

    // Initialize problems evidence with default entry
    if (!document.querySelector('.problem-evidence-row')) {
        addProblemEvidence({
            problemCode: '204008003',
            problemName: 'Spina bifida without hydrocephalus - closed (disorder)',
            onsetDate: '2024-06-01T00:00',
            status: 'active',
            concernStatus: 'active'
        });
    }

    // Initialize immunizations with default entries
    if (!document.querySelector('.immunization-row')) {
        addImmunization({
            vaccineCode: '08',
            vaccineName: 'Hepatitis B vaccine, pediatric or pediatric/adolescent dosage',
            immunizationId: 'HepB-NB-001',
            immunizationDate: '2024-06-15T09:30',
            status: 'completed',
            route: 'IM',
            doseValue: '0.5',
            doseUnit: 'mL',
            lotNumber: 'ABC12345',
            manufacturer: 'Merck Co, Inc.',
            negated: false
        });

        addImmunization({
            vaccineCode: '87567',
            vaccineName: 'Vitamin K1 injection (phytonadione)',
            immunizationId: 'VitK-NB-001',
            immunizationDate: '2024-06-15T09:45',
            status: 'completed',
            route: 'IM',
            doseValue: '1',
            doseUnit: 'mg',
            lotNumber: 'XYZ98765',
            manufacturer: 'Hospira Inc.',
            negated: false
        });
    }

    // Migrate legacy adminMed1/adminMed2 fields to new repeater on page load
    migrateLegacyMedicationsToRepeater();

    // Migrate legacy vaccine1/vaccine2 immunization fields to new repeater on page load
    migrateLegacyImmunizationsToRepeater();

    // Set default birth date to datetime-local format
    const birthDateInput = document.getElementById('patientBirthDate');
    if (birthDateInput && birthDateInput.type === 'datetime-local') {
        // Set default to June 15, 2024 at midnight
        birthDateInput.value = '2024-06-15T00:00';
    }

    // Generate random Document ID
    document.getElementById('documentId').value = generateUUID();

});
