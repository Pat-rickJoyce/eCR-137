/**
 * patient-overview.js
 * 
 * Dynamic Patient Overview Card Management
 * Updates the top demographics card as user fills in form data
 */

/**
 * Update Patient Overview Card
 * Syncs the overview card with current form values
 */
function updatePatientOverview() {
    // 1. Basic Demographics
    const patientName = document.getElementById('patientName')?.value || 'Patient Name';
    const dobValue = document.getElementById('patientBirthDate')?.value;
    const genderSelect = document.getElementById('patientGender');
    const raceSelect = document.getElementById('patientRace');
    const ethnicitySelect = document.getElementById('patientEthnicity');

    // Format DOB
    let formattedDOB = 'Not Specified';
    if (dobValue) {
        const date = new Date(dobValue);
        formattedDOB = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    // Get Select Labels
    const getSelectLabel = (sel) => sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : 'Not Specified';
    const gender = getSelectLabel(genderSelect);
    const race = getSelectLabel(raceSelect);
    const ethnicity = getSelectLabel(ethnicitySelect);

    // 2. Clinical Item Counts
    const diagCount = document.querySelectorAll('#diagnosisEvidenceList .diagnosis-evidence-row').length;
    const probCount = document.querySelectorAll('#problemEvidenceList .problem-evidence-row').length;
    const labCount = document.querySelectorAll('#labEvidenceList .lab-evidence-row').length;

    // 3. Update UI Elements
    const safeUpdate = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    safeUpdate('patientNameText', patientName);
    safeUpdate('patientOverviewDOB', `DOB: ${formattedDOB}`);
    safeUpdate('patientOverviewGender', gender);
    safeUpdate('patientOverviewRace', race);
    safeUpdate('patientOverviewEthnicity', ethnicity === 'Not Hispanic or Latino' ? 'Non-Hispanic' : ethnicity);

    safeUpdate('patientOverviewDiagCount', `${diagCount} Diagnoses`);
    safeUpdate('patientOverviewProbCount', `${probCount} Problems`);
    safeUpdate('patientOverviewLabCount', `${labCount} Labs`);

    // 4. Update Avatar Initials
    const avatarEl = document.getElementById('patientAvatarInitials');
    if (avatarEl && patientName && patientName !== 'Patient Name') {
        const nameParts = patientName.trim().split(/\s+/);
        const initials = nameParts.length >= 2
            ? nameParts[0][0] + nameParts[nameParts.length - 1][0]
            : nameParts[0][0];
        avatarEl.textContent = initials.toUpperCase();
    }
}

/**
 * Setup Patient Overview Listeners
 * Attaches event listeners to relevant form fields and sets up polling for dynamic lists
 */
function setupPatientOverviewListeners() {
    const fieldsToWatch = [
        'patientName',
        'patientBirthDate',
        'patientGender',
        'patientRace',
        'patientEthnicity'
    ];

    fieldsToWatch.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', updatePatientOverview);
            field.addEventListener('change', updatePatientOverview);
        }
    });

    // Since clinical lists are updated via other scripts, we'll use a MutationObserver 
    // or a simple interval to keep the counts in sync. Interval is safer and low-impact.
    setInterval(updatePatientOverview, 1000);

    // Initial update
    updatePatientOverview();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPatientOverviewListeners);
} else {
    setupPatientOverviewListeners();
}

// Expose globally
window.updatePatientOverview = updatePatientOverview;
window.setupPatientOverviewListeners = setupPatientOverviewListeners;
