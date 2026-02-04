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

    // Migrate legacy adminMed1/adminMed2 fields to new repeater on page load
    migrateLegacyMedicationsToRepeater();

    // Set default birth date to datetime-local format
    const birthDateInput = document.getElementById('patientBirthDate');
    if (birthDateInput && birthDateInput.type === 'datetime-local') {
        // Set default to June 15, 2024 at midnight
        birthDateInput.value = '2024-06-15T00:00';
    }

    // Generate random Document ID
    document.getElementById('documentId').value = generateUUID();

});
