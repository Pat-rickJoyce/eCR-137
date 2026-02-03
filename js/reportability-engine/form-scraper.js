/**
 * Scrapes the eCeleRate form to produce a standardized data object
 * for the Reportability Engine.
 */
export class FormScraper {

    getFormData() {
        return {
            demographics: this.getDemographics(),
            pregnancy: this.getPregnancy(),
            diagnoses: this.getDiagnoses(),
            problems: this.getProblems(),
            labs: this.getLabs(),
            immunizations: this.getImmunizations(),
            medications: this.getMedications()
        };
    }

    getDemographics() {
        const dobStr = document.getElementById('patientBirthDate')?.value;
        let age = null;
        if (dobStr) {
            const dob = new Date(dobStr);
            const now = new Date();
            const ageYear = now.getFullYear() - dob.getFullYear();
            // Simple age calc (not handling month/day precision perfectly for infants yet, 
            // but engine checks year primarily)
            age = ageYear;
        }

        return {
            id: document.getElementById('patientId')?.value,
            gender: document.getElementById('patientGender')?.value,
            dob: dobStr,
            age: age,
            state: document.getElementById('patientState')?.value,
            zip: document.getElementById('patientZip')?.value,
        };
    }

    getPregnancy() {
        const status = document.getElementById('pregnancyStatus')?.value;
        // In eCeleRate, 77386006 = Pregnant
        return {
            isPregnant: status === '77386006',
            status: status,
            estimatedDeliveryDate: document.getElementById('estimatedDeliveryDate')?.value
        };
    }

    getDiagnoses() {
        const list = [];
        const rows = document.querySelectorAll('#diagnosisEvidenceList .diagnosis-evidence-row');
        rows.forEach(row => {
            const code = row.querySelector('.de-diagnosis-code')?.value;
            const name = row.querySelector('.de-diagnosis-name')?.value;
            if (code) {
                list.push({
                    code: code,
                    name: name,
                    oids: []
                });
            }
        });
        return list;
    }

    getProblems() {
        const list = [];
        const rows = document.querySelectorAll('#problemEvidenceList .problem-evidence-row');
        rows.forEach(row => {
            const code = row.querySelector('.pe-problem-code')?.value;
            const status = row.querySelector('.pe-concern-status')?.value;
            if (code) {
                list.push({
                    code: code,
                    status: status, // active, completed
                    oids: []
                });
            }
        });
        return list;
    }

    getLabs() {
        const list = [];
        const rows = document.querySelectorAll('#labEvidenceList .lab-evidence-row');
        rows.forEach(row => {
            const testCode = row.querySelector('.le-test-code')?.value;
            const valueKind = row.querySelector('.le-value-kind')?.value;

            // Extract the result based on kind
            let value = null;
            let resultOids = []; // For coded results

            if (valueKind === 'coded') {
                value = row.querySelector('.le-value-code')?.value;
            } else if (valueKind === 'quantity') {
                value = row.querySelector('.le-qty-value')?.value;
            } else {
                value = row.querySelector('.le-text-value')?.value;
            }

            const interpretation = row.querySelector('.le-interpretation')?.value;

            if (testCode) {
                list.push({
                    testCode: testCode,
                    resultValue: value, // The code or number
                    resultKind: valueKind,
                    interpretation: interpretation,
                    oids: [], // Test code OIDs
                    resultOids: [] // Result code OIDs (crucial for "Positive Lab Result" value set)
                });
            }
        });
        return list;
    }

    getImmunizations() {
        // Placeholder for future expansion
        return [];
    }

    getMedications() {
        const list = [];

        // Get all medication code inputs with the me-medication-code class
        const medicationInputs = document.querySelectorAll('.me-medication-code');
        console.log(`[FormScraper] Found ${medicationInputs.length} medication input fields`);

        medicationInputs.forEach(input => {
            const code = input.value?.trim();
            if (code) {
                // Try to find associated name field (look for sibling with similar ID pattern)
                const inputId = input.id;
                let name = '';

                if (inputId) {
                    // Try to find name field (e.g., adminMed1Code -> adminMed1Name)
                    const nameId = inputId.replace('Code', 'Name');
                    const nameField = document.getElementById(nameId);
                    if (nameField) {
                        name = nameField.value?.trim() || '';
                    }
                }

                console.log(`[FormScraper] Scraped medication: code=${code}, name=${name}`);
                list.push({
                    code: code,
                    name: name,
                    oids: [] // Will be enriched with OIDs in main.js
                });
            }
        });

        console.log(`[FormScraper] Total medications scraped: ${list.length}`);
        return list;
    }
}
