import { RulesLoader } from './rules-loader.js';
import { ReportabilityEvaluator } from './evaluator.js';
import { FormScraper } from './form-scraper.js';
import { UIController } from './ui-controller.js';
import { getOidsForCode } from './code-oid-lookup.js';

class ReportabilityEngineApp {
    constructor() {
        this.loader = new RulesLoader();
        this.scraper = new FormScraper();
        this.ui = new UIController();
        this.evaluator = null;
        this.conditions = null;
    }

    async init() {
        console.log("Reportability Engine: Initializing...");
        try {
            this.conditions = await this.loader.loadAll();
            this.evaluator = new ReportabilityEvaluator(this.conditions);
            console.log("Reportability Engine: Ready.");

            this.attachListeners();
            this.runEvaluation(); // Initial run
        } catch (e) {
            console.error("Reportability Engine setup failed:", e);
        }
    }

    attachListeners() {
        // Debounce helper
        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        const runEval = debounce(() => this.runEvaluation(), 500);

        // Attach to known static inputs
        const staticInputs = document.querySelectorAll(
            '#patientBirthDate, #patientGender, #patientState, #pregnancyStatus'
        );
        staticInputs.forEach(input => {
            input.addEventListener('change', runEval);
            input.addEventListener('input', runEval);
        });

        // Attach to medication fields
        const medicationInputs = document.querySelectorAll('.me-medication-code');
        medicationInputs.forEach(input => {
            input.addEventListener('change', runEval);
            input.addEventListener('input', runEval);
        });

        // Attach to parent containers for dynamic inputs (delegation)
        const dynamicContainers = [
            'diagnosisEvidenceList',
            'problemEvidenceList',
            'labEvidenceList'
        ];

        dynamicContainers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.addEventListener('change', runEval);
                container.addEventListener('input', runEval);
                // Also capture clicks on "Remove" buttons
                container.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON') runEval();
                });
            }
        });

        // Robust approach: MutationObserver on the lists
        dynamicContainers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                const observer = new MutationObserver(runEval);
                observer.observe(container, { childList: true, subtree: true });
            }
        });
    }

    runEvaluation() {
        try {
            const data = this.scraper.getFormData();
            // Enrich diagnosis/problem codes with their OIDs from RCTC lookup
            this.enrichDataWithOids(data);

            const result = this.evaluator.evaluate(data);
            this.ui.updateUI(result);
            console.log("Evaluation Result:", result);
        } catch (e) {
            console.error("Evaluation Error:", e);
        }
    }

    enrichDataWithOids(data) {
        // Use the RCTC-generated code-to-OID lookup table
        // This maps diagnosis/problem/lab test/lab result codes to their value set OIDs

        data.diagnoses.forEach(d => {
            if (d.code) {
                const oids = getOidsForCode(d.code);
                if (oids.length > 0) {
                    d.oids.push(...oids);
                    console.log(`Diagnosis ${d.code} -> OIDs: ${oids.join(', ')}`);
                }
            }
        });

        data.problems.forEach(p => {
            if (p.code) {
                const oids = getOidsForCode(p.code);
                if (oids.length > 0) {
                    p.oids.push(...oids);
                    console.log(`Problem ${p.code} -> OIDs: ${oids.join(', ')}`);
                }
            }
        });

        // PRIORITY 1 FIX: Enrich lab test codes and result codes with OIDs
        data.labs.forEach(lab => {
            // Enrich test code (LOINC)
            if (lab.testCode) {
                const testOids = getOidsForCode(lab.testCode);
                if (testOids.length > 0) {
                    lab.oids.push(...testOids);
                    console.log(`Lab test ${lab.testCode} -> OIDs: ${testOids.join(', ')}`);
                }
            }

            // Enrich result code (for coded results - SNOMED organism/substance codes)
            if (lab.resultKind === 'coded' && lab.resultValue) {
                const resultOids = getOidsForCode(lab.resultValue);
                if (resultOids.length > 0) {
                    lab.resultOids.push(...resultOids);
                    console.log(`Lab result ${lab.resultValue} -> OIDs: ${resultOids.join(', ')}`);
                }
            }
        });

        // PRIORITY 2 FIX: Enrich medication codes with OIDs
        console.log(`[Enrichment] Processing ${data.medications.length} medications`);
        data.medications.forEach(med => {
            if (med.code) {
                const oids = getOidsForCode(med.code);
                if (oids.length > 0) {
                    med.oids.push(...oids);
                    console.log(`[Enrichment] Medication ${med.code} -> OIDs: ${oids.join(', ')}`);
                } else {
                    console.log(`[Enrichment] Medication ${med.code} -> No OIDs found`);
                }
            }
        });
    }
}

// Start the app
const app = new ReportabilityEngineApp();
// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Expose evaluation function globally so search functions can trigger re-evaluation
// when they programmatically set field values (which doesn't fire DOM events)
window.triggerReportabilityEvaluation = () => {
    if (app.evaluator) {
        console.log("Reportability Engine: Manual evaluation triggered");
        app.runEvaluation();
    }
};
