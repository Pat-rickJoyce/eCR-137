/**
 * file-downloaders.js
 *
 * File Download and Save Functions
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file handles downloading/saving generated CDA documents:
 * - eICR XML files
 * - RR XML files
 * - Form data JSON files
 * - Uses modern File System Access API when available
 *
 * Dependencies:
 * - validation.js (validateFormData)
 * - xml-builders.js (generateCDA/buildEICRXml, generateDynamicFilename)
 * - form-handlers.js (getFormData)
 *
 * @medical-software CRITICAL - Proper file saving ensures document delivery
 */

/**
 * Generate CDA
 * Wrapper function for building eICR XML
 * @returns {string} Complete eICR XML document
 */
function generateCDA() {
    return buildEICRXml();
}

/**
 * Generate and Download CDA (eICR) File
 * Creates eICR XML and prompts user to save it
 * Uses File System Access API for save dialog or falls back to traditional download
 */
async function generateAndDownloadCDA() {
    console.log('generateAndDownloadCDA called');
    console.log('window.validateFormData exists?', typeof window.validateFormData);

    // Use window.validateFormData to ensure we're calling the global function
    if (!window.validateFormData) {
        console.error('validateFormData function not found!');
        alert('Error: Validation function not loaded. Please refresh the page.');
        return;
    }

    const validationResult = window.validateFormData();
    console.log('Validation result:', validationResult);

    if (!validationResult) {
        console.log('Validation failed, stopping CDA generation');
        return;
    }

    try {
        console.log('Starting CDA generation...');
        const cdaContent = generateCDA();
        const data = getFormData();

        // Additional CDA-specific validation
        if (!cdaContent.includes('<ClinicalDocument')) {
            throw new Error('Invalid CDA document structure generated');
        }

        const blob = new Blob([cdaContent], { type: 'application/xml' });
        const filename = generateDynamicFilename('eICR', 'xml');

        // Try to use File System Access API (Chrome/Edge) to prompt for save location
        if ('showSaveFilePicker' in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: 'XML files',
                            accept: { 'application/xml': ['.xml'] }
                        }
                    ]
                });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log('CDA file saved with user-selected location');
                return;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('File System Access API failed for CDA, falling back to download:', err);
                } else {
                    console.log('User cancelled CDA save dialog');
                    return;
                }
            }
        }

        // Fallback to traditional download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);


    } catch (error) {
        console.error('CDA Generation Error:', error);
        alert(`Error generating CDA document: ${error.message}\n\nPlease check that all required fields are completed correctly.`);
    }
}

// Expose functions globally for onclick attributes
window.generateAndDownloadCDA = generateAndDownloadCDA;
