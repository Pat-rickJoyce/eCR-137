/**
 * Manages the UI components for Reportability Feedback
 */
export class UIController {
    constructor() {
        this.badgeElement = null;
        this.panelElement = null;
        this.sidenavItem = null;
        this.initBadge();
        this.initPanel();
        this.initSidenavItem();
    }

    initBadge() {
        // Insert Badge into the Patient Overview Card (after the Name/Verified badge)
        const nameContainer = document.querySelector('.patient-name');
        if (!nameContainer) return;

        this.badgeElement = document.createElement('span');
        this.badgeElement.className = 'reportability-badge';
        this.badgeElement.style.cssText = `
            font-size: 10px;
            padding: 4px 10px;
            border-radius: 8px;
            letter-spacing: 0.08em;
            font-weight: 800;
            text-transform: uppercase;
            margin-left: 10px;
            cursor: pointer;
            transition: all 0.2s;
            display: none; /* Hidden by default */
        `;
        // this.badgeElement.textContent = "Engine Active";

        nameContainer.appendChild(this.badgeElement);
        this.badgeElement.onclick = () => this.togglePanel();
    }

    initPanel() {
        // Create a sliding panel or modal for details
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'reportability-panel';
        this.panelElement.style.cssText = `
            position: fixed;
            top: 0;
            right: -400px; /* Hidden off-screen */
            width: 380px;
            height: 100vh;
            background: white;
            box-shadow: -5px 0 25px rgba(0,0,0,0.1);
            z-index: 1000;
            padding: 25px;
            transition: right 0.3s ease;
            overflow-y: auto;
            border-left: 1px solid #e2e8f0;
        `;

        this.panelElement.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 id="panel-title" style="font-size:1.2rem; margin:0;">Reportability Details</h2>
                <button id="close-panel-btn" style="background:none; border:none; font-size:1.2rem; cursor:pointer;">&times;</button>
            </div>
            <div id="reportability-content"></div>
        `;

        document.body.appendChild(this.panelElement);

        const closeBtn = this.panelElement.querySelector('#close-panel-btn');
        closeBtn.onclick = () => this.togglePanel(false);
    }

    initSidenavItem() {
        const addSidenavItem = () => {
            const sidenavContainer = document.querySelector('.ui81-sidenav');
            const navList = sidenavContainer?.querySelector('.nav-list');

            // Make sure the nav list has been populated with other items first
            if (navList && navList.children.length > 0) {
                // Check if we've already added it
                if (document.querySelector('.reportability-status-nav-item')) {
                    return true;
                }

                // Create the sidenav item
                const li = document.createElement('li');
                li.className = 'reportability-status-nav-item';
                li.style.cssText = 'margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;';

                const a = document.createElement('a');
                a.href = '#reportability-status';
                a.textContent = 'Reportability Status';
                a.style.cssText = `
                    transition: all 0.2s;
                    display: block;
                    padding: 8px 12px;
                    text-decoration: none;
                    border-radius: 4px;
                `;

                // Default styling (not yet evaluated)
                a.style.color = '#64748b';
                a.style.background = '#f1f5f9';

                a.onclick = (e) => {
                    e.preventDefault();
                    this.togglePanel();
                };

                li.appendChild(a);

                // Insert at the very beginning of the nav list (before first child)
                navList.insertBefore(li, navList.firstChild);

                this.sidenavItem = a;
                console.log('Reportability Status added to sidenav at position 0');
                return true;
            }
            return false;
        };

        // ui-enhancements.js runs on window 'load' event, not DOMContentLoaded
        // So we need to wait for that event
        if (document.readyState === 'complete') {
            // Page already loaded, try now and use polling as fallback
            setTimeout(() => {
                if (!addSidenavItem()) {
                    const checkSidenav = setInterval(() => {
                        if (addSidenavItem()) {
                            clearInterval(checkSidenav);
                        }
                    }, 100);
                    setTimeout(() => clearInterval(checkSidenav), 5000);
                }
            }, 100);
        } else {
            // Wait for window load event (when ui-enhancements.js creates the sidenav)
            window.addEventListener('load', () => {
                // Give ui-enhancements.js time to build the nav
                setTimeout(() => {
                    if (!addSidenavItem()) {
                        // Fallback: poll for it
                        const checkSidenav = setInterval(() => {
                            if (addSidenavItem()) {
                                clearInterval(checkSidenav);
                            }
                        }, 100);
                        setTimeout(() => clearInterval(checkSidenav), 5000);
                    }
                }, 50);
            });
        }
    }

    togglePanel(show) {
        if (show === undefined) {
            // Toggle
            const isVisible = this.panelElement.style.right === '0px';
            this.panelElement.style.right = isVisible ? '-400px' : '0px';
        } else {
            this.panelElement.style.right = show ? '0px' : '-400px';
        }
    }

    updateUI(evaluationResult) {
        if (!this.badgeElement) return;

        // 1. Update Badge
        this.badgeElement.style.display = 'inline-block';

        if (evaluationResult.isReportable) {
            // Show condition names in badge if multiple, otherwise just "REPORTABLE"
            const condNames = evaluationResult.triggeredConditions.map(c => c.conditionName);
            if (condNames.length === 1) {
                this.badgeElement.textContent = `REPORTABLE: ${condNames[0]}`;
            } else if (condNames.length <= 3) {
                this.badgeElement.textContent = `REPORTABLE: ${condNames.join(', ')}`;
            } else {
                this.badgeElement.textContent = `REPORTABLE: ${condNames.length} conditions`;
            }
            this.badgeElement.style.background = '#fef2f2';
            this.badgeElement.style.color = '#dc2626';
            this.badgeElement.style.border = '1px solid #fecaca';
            this.badgeElement.title = "Click for details";
        } else if (evaluationResult.potentialConditions.length > 0) {
            this.badgeElement.textContent = "POTENTIALLY REPORTABLE";
            this.badgeElement.style.background = '#fffbeb';
            this.badgeElement.style.color = '#d97706';
            this.badgeElement.style.border = '1px solid #fde68a';
        } else {
            this.badgeElement.textContent = "NOT REPORTABLE";
            this.badgeElement.style.background = '#f1f5f9';
            this.badgeElement.style.color = '#64748b';
            this.badgeElement.style.border = '1px solid #e2e8f0';
        }

        // 1a. Update Sidenav Item
        if (this.sidenavItem) {
            if (evaluationResult.isReportable) {
                this.sidenavItem.style.background = '#fef2f2';
                this.sidenavItem.style.color = '#dc2626';
                this.sidenavItem.style.borderLeft = '4px solid #dc2626';
                this.sidenavItem.style.fontWeight = '600';
            } else if (evaluationResult.potentialConditions.length > 0) {
                this.sidenavItem.style.background = '#fffbeb';
                this.sidenavItem.style.color = '#d97706';
                this.sidenavItem.style.borderLeft = '4px solid #d97706';
                this.sidenavItem.style.fontWeight = '600';
            } else {
                this.sidenavItem.style.background = '#f1f5f9';
                this.sidenavItem.style.color = '#64748b';
                this.sidenavItem.style.borderLeft = '4px solid #cbd5e1';
                this.sidenavItem.style.fontWeight = '400';
            }
        }

        // 2. Update Panel Title based on status
        const panelTitle = this.panelElement.querySelector('#panel-title');
        if (evaluationResult.isReportable) {
            const condNames = evaluationResult.triggeredConditions.map(c => c.conditionName);
            panelTitle.textContent = condNames.length === 1
                ? condNames[0]
                : `${condNames.length} Reportable Conditions`;
        } else if (evaluationResult.potentialConditions.length > 0) {
            panelTitle.textContent = 'Potential Matches';
        } else {
            panelTitle.textContent = 'Reportability Status';
        }

        // 3. Update Panel Content
        const contentDiv = this.panelElement.querySelector('#reportability-content');
        contentDiv.innerHTML = '';

        if (evaluationResult.isReportable) {
            this.renderSection(contentDiv, 'Triggered Conditions', evaluationResult.triggeredConditions, '#dc2626');
        }

        if (evaluationResult.potentialConditions.length > 0) {
            this.renderSection(contentDiv, 'Partial Matches', evaluationResult.potentialConditions, '#d97706');
        } else if (!evaluationResult.isReportable) {
            contentDiv.innerHTML += `<p style="color:#64748b; font-style:italic;">No reportable conditions detected based on current patient data.</p>`;
        }
    }

    renderSection(container, title, conditions, color) {
        const header = document.createElement('h3');
        header.textContent = title;
        header.style.cssText = `font-size:0.9rem; text-transform:uppercase; color:${color}; margin-top:20px; border-bottom:2px solid ${color}; padding-bottom:5px;`;
        container.appendChild(header);

        conditions.forEach(c => {
            const card = document.createElement('div');
            card.style.cssText = 'background:#f8fafc; padding:12px; margin-bottom:10px; border-radius:8px; border:1px solid #e2e8f0;';

            const condTitle = document.createElement('div');
            condTitle.textContent = c.conditionName;
            condTitle.style.cssText = 'font-weight:bold; font-size:1rem; color:#1e293b; margin-bottom:8px;';
            card.appendChild(condTitle);

            // Matched Rules with criteria details
            if (c.matchedRules && c.matchedRules.length > 0) {
                c.matchedRules.forEach(r => {
                    const ruleDiv = document.createElement('div');
                    ruleDiv.style.cssText = 'margin-top:8px; padding:10px; background:#e8f5e9; border-radius:4px; font-size:0.85rem;';

                    // Show rule description if available, otherwise just "Rule X Met"
                    const ruleTitle = r.ruleDescription || r.ruleName || `Rule ${r.ruleId}`;
                    let ruleContent = `<div style="font-weight:600; color:#2e7d32; margin-bottom:6px;">${this.escapeHtml(ruleTitle)}</div>`;

                    // Show matched criteria details with actual patient data
                    if (r.groups && r.groups.length > 0) {
                        const matchDetails = r.groups
                            .filter(g => g.passed && g.matchedCriterion)
                            .map(g => this.formatMatchDescription(g.matchedCriterion, g.matchedData));

                        if (matchDetails.length > 0) {
                            ruleContent += `<div style="margin-top:4px; color:#1b5e20; font-size:0.8rem;">`;
                            matchDetails.forEach(detail => {
                                ruleContent += `<div style="margin:4px 0; padding:4px 8px; background:rgba(255,255,255,0.7); border-radius:3px; border-left:3px solid #4caf50;">`;
                                ruleContent += detail;
                                ruleContent += `</div>`;
                            });
                            ruleContent += `</div>`;
                        }
                    }

                    ruleDiv.innerHTML = ruleContent;
                    card.appendChild(ruleDiv);
                });
            } else {
                // For partial matches, show what's missing
                const partialDiv = document.createElement('div');
                partialDiv.style.cssText = 'margin-top:4px; font-size:0.8rem; color:#64748b;';
                partialDiv.textContent = 'Some criteria met but not all required for full reportability.';
                card.appendChild(partialDiv);
            }

            container.appendChild(card);
        });
    }

    /**
     * Create a human-readable description of what matched
     */
    formatMatchDescription(criterion, matchedData) {
        if (!matchedData) {
            // Fallback to just showing value set name
            if (criterion.valueSetName) {
                return this.cleanValueSetName(criterion.valueSetName);
            }
            return criterion.type;
        }

        switch (matchedData.type) {
            case 'diagnosis':
                return `<strong>Diagnosis:</strong> ${matchedData.display}` +
                    (matchedData.code ? ` <span style="color:#666;">(${matchedData.code})</span>` : '');

            case 'problem':
                return `<strong>Problem:</strong> ${matchedData.display}` +
                    (matchedData.status ? ` [${matchedData.status}]` : '') +
                    (matchedData.code ? ` <span style="color:#666;">(${matchedData.code})</span>` : '');

            case 'lab_test':
                return `<strong>Lab Test:</strong> ${matchedData.display || 'Lab test'}` +
                    (matchedData.code ? ` <span style="color:#666;">(${matchedData.code})</span>` : '');

            case 'lab_result':
                let resultText = `<strong>Lab Result:</strong> ${matchedData.testDisplay || 'Lab test'}`;
                if (matchedData.resultDisplay) {
                    resultText += ` - ${matchedData.resultDisplay}`;
                }
                return resultText;

            case 'medication':
                return `<strong>Medication:</strong> ${matchedData.display}` +
                    (matchedData.code ? ` <span style="color:#666;">(${matchedData.code})</span>` : '');

            case 'age':
                return `<strong>Age:</strong> Patient is ${matchedData.patientAge} years old ` +
                    `(criterion: ${matchedData.operator} ${matchedData.limit} ${matchedData.unit})`;

            default:
                return this.cleanValueSetName(criterion.valueSetName || criterion.type);
        }
    }

    /**
     * Clean up value set name for display
     */
    cleanValueSetName(vsName) {
        if (!vsName) return '';
        // Remove code system suffixes like "(SNOMED)", "(ICD10CM)"
        let clean = vsName.replace(/\s*\((SNOMED|ICD10CM|ICD10PCS|LOINC|RXNORM|HL7|CPT)\)$/i, '');
        // Remove "Disorders" suffix if present
        clean = clean.replace(/\s*\(Disorders\)$/i, '');
        return clean;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
