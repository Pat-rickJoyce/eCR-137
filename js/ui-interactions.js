/**
 * ui-interactions.js
 *
 * UI Toggle and Interaction Functions
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file handles dynamic UI behaviors:
 * - Conditional field visibility (pregnancy, guardian)
 * - Condition dropdown population
 * - Diagnosis selection handling
 * - Search result hiding
 *
 * Dependencies:
 * - validation.js (isRCTCTriggerCode, validateTriggerCode)
 *
 * @medical-software UI interactions affect data collection completeness
 */

/**
 * Toggle Pregnancy Fields
 * Shows/hides pregnancy information section based on patient gender
 */
function togglePregnancyFields() {
    const genderSelect = document.getElementById('patientGender');
    const pregnancySections = document.querySelectorAll('.section');

    let pregnancyDiv = null;
    pregnancySections.forEach(section => {
        const title = section.querySelector('.section-title');
        if (title && title.textContent.includes('Pregnancy Information')) {
            pregnancyDiv = section;
        }
    });

    if (genderSelect && pregnancyDiv) {
        if (genderSelect.value === 'F') {
            pregnancyDiv.style.display = 'block';
        } else {
            pregnancyDiv.style.display = 'none';
        }
    }
}

/**
 * Toggle Guardian Fields
 * Shows/hides guardian information section based on patient age
 * Automatically displays for patients under 18 years old
 */
function toggleGuardianFields() {
    const birthDate = document.getElementById('patientBirthDate');
    const guardianSections = document.querySelectorAll('.section');

    let guardianDiv = null;
    guardianSections.forEach(section => {
        const title = section.querySelector('.section-title');
        if (title && title.textContent.includes('Guardian/Parent Information')) {
            guardianDiv = section;
        }
    });

    if (birthDate && guardianDiv && birthDate.value.length === 8) {
        const today = new Date();
        const birth = new Date(
            birthDate.value.substring(0, 4),
            birthDate.value.substring(4, 6) - 1,
            birthDate.value.substring(6, 8)
        );

        const age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (age < 18 || (age === 18 && monthDiff < 0)) {
            guardianDiv.style.display = 'block';
        } else {
            guardianDiv.style.display = 'none';
        }
    }
}

/**
 * Setup Conditional Displays
 * Initializes event listeners for conditional field visibility
 * Call this on page load to set up UI behaviors
 */
function setupConditionalDisplays() {
    // Gender-based pregnancy field display
    const genderSelect = document.getElementById('patientGender');
    if (genderSelect) {
        genderSelect.addEventListener('change', togglePregnancyFields);
        togglePregnancyFields(); // Initial check
    }

    // Age-based guardian field display
    const birthDateInput = document.getElementById('patientBirthDate');
    if (birthDateInput) {
        birthDateInput.addEventListener('change', toggleGuardianFields);
        birthDateInput.addEventListener('blur', toggleGuardianFields);
    }
}

// Note: conditionsData and conditionsLoaded are defined in config.js which loads first

/**
 * Load Conditions from Excel File
 * Reads condition codes from the conditions.xlsx file
 * Falls back to hardcoded values if file cannot be loaded
 * @returns {Promise<Array<object>>} Array of condition objects
 */
async function loadConditionsFromExcel() {
    try {
        const response = await fetch('./assets/data/conditions.xlsx');
        if (!response.ok) {
            throw new Error(`Failed to load Excel file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const allConditions = [];

        // Process all sheets
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Skip empty sheets or sheets with no data rows
            if (jsonData.length <= 1) return;

            const headers = jsonData[0];
            const conditionIndex = headers.findIndex(h => h && h.toLowerCase().includes('condition'));
            const codeTypeIndex = headers.findIndex(h => h && h.toLowerCase().includes('code_type'));
            const codeIndex = headers.findIndex(h => h && (h.toLowerCase().includes('code') && !h.toLowerCase().includes('code_type')));
            const descriptionIndex = headers.findIndex(h => h && h.toLowerCase().includes('description'));

            // Process data rows
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row && row[codeIndex]) {
                    allConditions.push({
                        condition: row[conditionIndex] || '',
                        codeType: row[codeTypeIndex] || '',
                        code: row[codeIndex] || '',
                        description: row[descriptionIndex] || ''
                    });
                }
            }
        });

        conditionsData = allConditions;
        conditionsLoaded = true;

        // Populate dropdowns after loading
        populateConditionDropdowns(conditionsData);

        console.log(`Loaded ${conditionsData.length} conditions from Excel file`);
        return conditionsData;

    } catch (error) {
        console.warn('Failed to load conditions from Excel file:', error);
        // Fallback to hardcoded values if Excel file can't be loaded
        conditionsData = getHardcodedConditions();
        conditionsLoaded = true;
        populateConditionDropdowns(conditionsData);
        return conditionsData;
    }
}

/**
 * Get Hardcoded Conditions
 * Fallback condition list if Excel file cannot be loaded
 * @returns {Array<object>} Array of hardcoded condition objects
 */
function getHardcodedConditions() {
    return [
        { condition: "Down Syndrome", code: "67531005", codeType: "SNOMEDCT", description: "Down syndrome (disorder)" },
        { condition: "Pertussis", code: "414819007", codeType: "SNOMEDCT", description: "Disease caused by Bordetella pertussis (disorder)" },
        { condition: "Gonorrhea", code: "86299006", codeType: "SNOMEDCT", description: "Gonorrhea (disorder)" }
    ];
}

/**
 * Populate Condition Dropdowns
 * Fills diagnosis code dropdowns with available conditions
 * Marks RCTC trigger codes with special formatting
 * @param {Array<object>} conditions - Array of condition objects to populate
 */
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

/**
 * Handle Diagnosis Selection
 * Auto-populates diagnosis name when code is selected
 * Validates if code is a trigger code
 * @param {string} fieldId - ID of the diagnosis code field
 * @param {string} selectedCode - The selected diagnosis code
 * @param {Array<object>} conditions - Array of available conditions
 */
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

/**
 * Hide Search Results on Outside Click
 * Event listener to hide search dropdowns when user clicks elsewhere
 */
document.addEventListener('click', function(e) {
    const searchResults = document.querySelectorAll('.search-results');
    searchResults.forEach(result => {
        if (!result.parentElement.contains(e.target)) {
            result.style.display = 'none';
        }
    });
});

// Expose functions globally for cross-module access
window.setupConditionalDisplays = setupConditionalDisplays;
window.loadConditionsFromExcel = loadConditionsFromExcel;
