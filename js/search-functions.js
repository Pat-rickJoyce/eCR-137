/**
 * search-functions.js
 *
 * RCTC Search and Filtering Functions
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file contains all search functionality for RCTC (Reportable Conditions
 * Trigger Codes) including:
 * - Lab observations search
 * - Diagnosis code search
 * - Organism/substance search
 * - Lab order search
 * - Test name search
 *
 * Dependencies:
 * - data-loaders.js (loadDiagnosisFromRCTC, loadTestsFromRCTC, loadOrganismFromRCTC, loadLabOrderFromRCTC)
 * - config.js (diagnosisData, testData, organismData, labOrderData, diagnosisLoaded, etc.)
 * - validation.js (validateTriggerCode, isRCTCTriggerCode)
 *
 * @medical-software CRITICAL - Accurate code search is essential for compliance
 */

/**
 * Universal RCTC Code Search
 * Searches across diagnosis or lab observation datasets based on field ID
 * Supports both code and name searches with prioritized matching
 *
 * @param {string} fieldId - ID of the input field triggering the search
 */
async function searchRCTCCodes(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;

  // Decide dataset
  let data;
  if (fieldId.toLowerCase().includes('diagnosis')) {
    if (!diagnosisLoaded) await loadDiagnosisFromRCTC();
    data = diagnosisData || [];
  } else {
    if (!labObsLoaded) await loadLabObsFromRCTC(); // keep your existing lab behavior
    data = labObsData || [];
  }

  // results container
  const resultsDiv = document.getElementById(fieldId + '_results');
  if (!resultsDiv) return;
  resultsDiv.innerHTML = '';
  resultsDiv.style.display = 'none';

  const q = String(el.value ?? '').replace(/\u00A0/g, ' ').trim().toLowerCase();
  if (!q || data.length === 0) return;

  const asCode = r => String(r.code ?? '').toLowerCase();
  const asName = r => String((r.name ?? r.description ?? '')).toLowerCase();

  const searchingName = /Name$/i.test(fieldId);
  const digitsOnly = /^[0-9]+$/.test(q);

  let matches = [];
  if (!searchingName && digitsOnly) {
    // Code box, numeric: try exact match first
    const exact = data.filter(r => asCode(r) === q);
    const fuzzy = data.filter(r => asCode(r).includes(q) || asName(r).includes(q));
    const seen = new Set();
    matches = [...exact, ...fuzzy].filter(r => {
      const k = r.code + '|' + r.name;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } else {
    // General contains; prioritize the field's primary dimension
    const primary   = data.filter(r => (searchingName ? asName(r) : asCode(r)).includes(q));
    const secondary = data.filter(r => (searchingName ? asCode(r) : asName(r)).includes(q));
    const seen = new Set();
    matches = [...primary, ...secondary].filter(r => {
      const k = r.code + '|' + r.name;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  if (matches.length === 0) {
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div class="no-results">No matching codes found</div>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'search-results-list';

  matches.slice(0, 10).forEach(row => {
    const item = document.createElement('div');
    item.className = 'search-result-item';

    // Show code + name; keep your light description if present
    item.innerHTML = searchingName
      ? `<strong>${row.name}</strong><br><small>Code: ${row.code}</small>${row.description ? `<br><small>${row.description}</small>` : ''}`
      : `<strong>${row.code}</strong>: ${row.name}${row.description ? `<br><small>${row.description}</small>` : ''}`;

    item.onclick = () => {
      if (searchingName) {
        // Fill Name + its paired Code
        el.value = row.name;
        const codeField = document.getElementById(fieldId.replace('Name', 'Code'));
        if (codeField) {
          codeField.value = row.code;
          // keep your trigger validation semantics on the code field
          if (typeof validateTriggerCode === 'function') validateTriggerCode(codeField.id);
        }
      } else {
        // Fill Code + its paired Name
        el.value = row.code;
        const nameField = document.getElementById(fieldId.replace('Code', 'Name'));
        if (nameField) nameField.value = row.name;
        if (typeof validateTriggerCode === 'function') validateTriggerCode(el.id);
      }
      resultsDiv.style.display = 'none';
      // Trigger reportability re-evaluation after selection
      if (typeof window.triggerReportabilityEvaluation === 'function') {
        window.triggerReportabilityEvaluation();
      }
    };

    list.appendChild(item);
  });

  resultsDiv.appendChild(list);
  resultsDiv.style.display = 'block';
}

/**
 * Search RCTC for Diagnosis Code
 * Searches the diagnosis evidence rows for matching SNOMED CT codes
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForDiagnosis(btn) {
    const row = btn.closest('.diagnosis-evidence-row');
    const codeInput = row.querySelector('.de-diagnosis-code');
    const nameInput = row.querySelector('.de-diagnosis-name');
    const resultsDiv = row.querySelector('.de-diagnosis-code-results');

    btn.textContent = '⏳';
    btn.disabled = true;
    if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

    try {
        if (!diagnosisLoaded) await loadDiagnosisFromRCTC();
        if (!Array.isArray(diagnosisData) || diagnosisData.length === 0) {
            alert('Diagnosis list is empty. The RCTC file may not have loaded.');
            return;
        }

        const q = String(codeInput.value || '').trim().toLowerCase();
        if (!q) { alert('Enter a diagnosis code to search'); return; }

        const exact = diagnosisData.filter(d => String(d.code || '').toLowerCase() === q);
        const starts = diagnosisData.filter(d => String(d.code || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === d.code));
        const contains = diagnosisData.filter(d => String(d.code || '').toLowerCase().includes(q)
            && !exact.some(e => e.code === d.code)
            && !starts.some(s => s.code === d.code));

        const matches = [...exact, ...starts, ...contains];

        if (!matches.length) {
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<div class="no-results">No matching diagnosis codes found</div>';
            }
            return;
        }

        if (resultsDiv) {
            const list = document.createElement('div');
            list.className = 'search-results-list';

            matches.slice(0, 10).forEach(d => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `<strong>${d.code}</strong> – ${d.name}${d.description ? `<br><small>${d.description}</small>` : ''}`;
                item.onclick = () => {
                    codeInput.value = d.code;
                    nameInput.value = d.name;
                    resultsDiv.style.display = 'none';
                    // Trigger reportability re-evaluation after selection
                    if (typeof window.triggerReportabilityEvaluation === 'function') {
                        window.triggerReportabilityEvaluation();
                    }
                };
                list.appendChild(item);
            });

            resultsDiv.appendChild(list);
            resultsDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Diagnosis code search error:', err);
        alert('Error searching diagnosis codes. See console for details.');
    } finally {
        btn.textContent = '🔍';
        btn.disabled = false;
    }
}

/**
 * Search RCTC for Diagnosis Name
 * Searches the diagnosis evidence rows for matching condition names
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForDiagnosisByName(btn) {
    const row = btn.closest('.diagnosis-evidence-row');
    const codeInput = row.querySelector('.de-diagnosis-code');
    const nameInput = row.querySelector('.de-diagnosis-name');
    const resultsDiv = row.querySelector('.de-diagnosis-name-results');

    btn.textContent = '⏳';
    btn.disabled = true;
    if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

    try {
        if (!diagnosisLoaded) await loadDiagnosisFromRCTC();
        if (!Array.isArray(diagnosisData) || diagnosisData.length === 0) {
            alert('Diagnosis list is empty. The RCTC file may not have loaded.');
            return;
        }

        const q = String(nameInput.value || '').trim().toLowerCase();
        if (!q) { alert('Enter a diagnosis name to search'); return; }

        const exact = diagnosisData.filter(d => String(d.name || '').toLowerCase() === q);
        const starts = diagnosisData.filter(d => String(d.name || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === d.code));
        const contains = diagnosisData.filter(d => String(d.name || '').toLowerCase().includes(q)
            && !exact.some(e => e.code === d.code)
            && !starts.some(s => s.code === d.code));

        const matches = [...exact, ...starts, ...contains];

        if (!matches.length) {
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<div class="no-results">No matching diagnosis names found</div>';
            }
            return;
        }

        if (resultsDiv) {
            const list = document.createElement('div');
            list.className = 'search-results-list';

            matches.slice(0, 10).forEach(d => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `<strong>${d.name}</strong> – ${d.code}${d.description ? `<br><small>${d.description}</small>` : ''}`;
                item.onclick = () => {
                    codeInput.value = d.code;
                    nameInput.value = d.name;
                    resultsDiv.style.display = 'none';
                    // Trigger reportability re-evaluation after selection
                    if (typeof window.triggerReportabilityEvaluation === 'function') {
                        window.triggerReportabilityEvaluation();
                    }
                };
                list.appendChild(item);
            });

            resultsDiv.appendChild(list);
            resultsDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Diagnosis name search error:', err);
        alert('Error searching diagnosis names. See console for details.');
    } finally {
        btn.textContent = '🔍';
        btn.disabled = false;
    }
}

/**
 * Search SNOMED for Problem Code
 * Searches problem observation codes (uses diagnosis data as fallback)
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchSNOMEDForProblem(btn) {
    const row = btn.closest('.problem-evidence-row');
    const codeInput = row.querySelector('.pe-problem-code');
    const nameInput = row.querySelector('.pe-problem-name');
    const resultsDiv = row.querySelector('.pe-problem-code-results');

    btn.textContent = '⏳';
    btn.disabled = true;
    if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

    try {
        // Use existing diagnosis search as fallback for now
        if (!diagnosisLoaded) await loadDiagnosisFromRCTC();
        if (!Array.isArray(diagnosisData) || diagnosisData.length === 0) {
            alert('Problem list is empty. Using diagnosis data as fallback.');
            return;
        }

        const q = String(codeInput.value || '').trim().toLowerCase();
        if (!q) { alert('Enter a problem code to search'); return; }

        const exact = diagnosisData.filter(d => String(d.code || '').toLowerCase() === q);
        const starts = diagnosisData.filter(d => String(d.code || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === d.code));
        const contains = diagnosisData.filter(d => String(d.code || '').toLowerCase().includes(q)
            && !exact.some(e => e.code === d.code)
            && !starts.some(s => s.code === d.code));

        const matches = [...exact, ...starts, ...contains];

        if (!matches.length) {
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<div class="no-results">No matching problem codes found</div>';
            }
            return;
        }

        if (resultsDiv) {
            const list = document.createElement('div');
            list.className = 'search-results-list';

            matches.slice(0, 10).forEach(d => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `<strong>${d.code}</strong> — ${d.name}${d.description ? `<br><small>${d.description}</small>` : ''}`;
                item.onclick = () => {
                    codeInput.value = d.code;
                    nameInput.value = d.name;
                    resultsDiv.style.display = 'none';
                    // Trigger reportability re-evaluation after selection
                    if (typeof window.triggerReportabilityEvaluation === 'function') {
                        window.triggerReportabilityEvaluation();
                    }
                };
                list.appendChild(item);
            });

            resultsDiv.appendChild(list);
            resultsDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Problem code search error:', err);
        alert('Error searching problem codes. See console for details.');
    } finally {
        btn.textContent = '🔍';
        btn.disabled = false;
    }
}

/**
 * Search SNOMED for Problem Name
 * Searches problem observation names (uses diagnosis data as fallback)
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchSNOMEDForProblemByName(btn) {
    const row = btn.closest('.problem-evidence-row');
    const codeInput = row.querySelector('.pe-problem-code');
    const nameInput = row.querySelector('.pe-problem-name');
    const resultsDiv = row.querySelector('.pe-problem-name-results');

    btn.textContent = '⏳';
    btn.disabled = true;
    if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

    try {
        // Use existing diagnosis search as fallback for now
        if (!diagnosisLoaded) await loadDiagnosisFromRCTC();
        if (!Array.isArray(diagnosisData) || diagnosisData.length === 0) {
            alert('Problem list is empty. Using diagnosis data as fallback.');
            return;
        }

        const q = String(nameInput.value || '').trim().toLowerCase();
        if (!q) { alert('Enter a problem name to search'); return; }

        const exact = diagnosisData.filter(d => String(d.name || '').toLowerCase() === q);
        const starts = diagnosisData.filter(d => String(d.name || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === d.code));
        const contains = diagnosisData.filter(d => String(d.name || '').toLowerCase().includes(q)
            && !exact.some(e => e.code === d.code)
            && !starts.some(s => s.code === d.code));

        const matches = [...exact, ...starts, ...contains];

        if (!matches.length) {
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<div class="no-results">No matching problem names found</div>';
            }
            return;
        }

        if (resultsDiv) {
            const list = document.createElement('div');
            list.className = 'search-results-list';

            matches.slice(0, 10).forEach(d => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `<strong>${d.name}</strong> — ${d.code}${d.description ? `<br><small>${d.description}</small>` : ''}`;
                item.onclick = () => {
                    codeInput.value = d.code;
                    nameInput.value = d.name;
                    resultsDiv.style.display = 'none';
                    // Trigger reportability re-evaluation after selection
                    if (typeof window.triggerReportabilityEvaluation === 'function') {
                        window.triggerReportabilityEvaluation();
                    }
                };
                list.appendChild(item);
            });

            resultsDiv.appendChild(list);
            resultsDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Problem name search error:', err);
        alert('Error searching problem names. See console for details.');
    } finally {
        btn.textContent = '🔍';
        btn.disabled = false;
    }
}

/**
 * Search RCTC for Test Code (LOINC)
 * Searches lab test codes from RCTC Lab Obs Test Name S4 sheet
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForTest(btn) {
  const row = btn.closest('.lab-evidence-row');
  const codeInput  = row.querySelector('.le-test-code');
  const nameInput  = row.querySelector('.le-test-name');
  const resultsDiv = row.querySelector('.le-test-code-results');

  // UI: loading state
  btn.textContent = '⏳';
  btn.disabled = true;
  if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

  try {
    if (!testLoaded) await loadTestsFromRCTC();
    if (!Array.isArray(testData) || testData.length === 0) {
      alert('Test list is empty. The RCTC file may not have loaded.');
      return;
    }

    const q = String(codeInput.value || '').trim().toLowerCase();
    if (!q) { alert('Enter a LOINC code to search'); return; }

    const exact = testData.filter(t => String(t.code || '').toLowerCase() === q);
    const starts = testData.filter(t => String(t.code || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === t.code));
    const contains = testData.filter(t => String(t.code || '').toLowerCase().includes(q)
      && !exact.some(e => e.code === t.code)
      && !starts.some(s => s.code === t.code));

    const matches = [...exact, ...starts, ...contains];

    if (!matches.length) {
      if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div class="no-results">No matching test codes found</div>';
      }
      return;
    }

    if (resultsDiv) {
      const list = document.createElement('div');
      list.className = 'search-results-list';

      matches.slice(0, 10).forEach(t => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<strong>${t.code}</strong> — ${t.name}${t.description ? `<br><small>${t.description}</small>` : ''}`;
        item.onclick = () => {
          codeInput.value = t.code;
          nameInput.value = t.name;
          resultsDiv.style.display = 'none';
          // Trigger reportability re-evaluation after selection
          if (typeof window.triggerReportabilityEvaluation === 'function') {
            window.triggerReportabilityEvaluation();
          }
        };
        list.appendChild(item);
      });

      resultsDiv.appendChild(list);
      resultsDiv.style.display = 'block';
    } else {
      codeInput.value = matches[0].code;
      nameInput.value = matches[0].name;
      // Trigger reportability re-evaluation after selection
      if (typeof window.triggerReportabilityEvaluation === 'function') {
        window.triggerReportabilityEvaluation();
      }
    }
  } catch (err) {
    console.error('Test code search error:', err);
    alert('Error searching tests (code). See console for details.');
  } finally {
    btn.textContent = '🔍';
    btn.disabled = false;
  }
}

/**
 * Search RCTC for Test Name
 * Searches lab test names from RCTC Lab Obs Test Name S4 sheet
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForTestByName(btn) {
  const row = btn.closest('.lab-evidence-row');
  const codeInput  = row.querySelector('.le-test-code');
  const nameInput  = row.querySelector('.le-test-name');
  const resultsDiv = row.querySelector('.le-test-name-results');

  btn.textContent = '⏳';
  btn.disabled = true;
  if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

  try {
    if (!testLoaded) await loadTestsFromRCTC();
    if (!Array.isArray(testData) || testData.length === 0) {
      alert('Test list is empty. The RCTC file may not have loaded.');
      return;
    }

    const q = String(nameInput.value || '').trim().toLowerCase();
    if (!q) { alert('Enter a test name to search'); return; }

    const exact = testData.filter(t => String(t.name || '').toLowerCase() === q);
    const starts = testData.filter(t => String(t.name || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === t.code));
    const contains = testData.filter(t => String(t.name || '').toLowerCase().includes(q)
      && !exact.some(e => e.code === t.code)
      && !starts.some(s => s.code === t.code));

    const matches = [...exact, ...starts, ...contains];

    if (!matches.length) {
      if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div class="no-results">No matching test names found</div>';
      } else {
        alert(`No tests found for "${q}".`);
      }
      return;
    }

    if (resultsDiv) {
      const list = document.createElement('div');
      list.className = 'search-results-list';

      matches.slice(0, 10).forEach(t => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<strong>${t.name}</strong> — ${t.code}${t.description ? `<br><small>${t.description}</small>` : ''}`;
        item.onclick = () => {
          codeInput.value = t.code;
          nameInput.value = t.name;
          resultsDiv.style.display = 'none';
          // Trigger reportability re-evaluation after selection
          if (typeof window.triggerReportabilityEvaluation === 'function') {
            window.triggerReportabilityEvaluation();
          }
        };
        list.appendChild(item);
      });

      resultsDiv.appendChild(list);
      resultsDiv.style.display = 'block';
    } else {
      codeInput.value = matches[0].code;
      nameInput.value = matches[0].name;
      // Trigger reportability re-evaluation after selection
      if (typeof window.triggerReportabilityEvaluation === 'function') {
        window.triggerReportabilityEvaluation();
      }
    }
  } catch (err) {
    console.error('Test name search error:', err);
    alert('Error searching tests (name). See console for details.');
  } finally {
    btn.textContent = '🔍';
    btn.disabled = false;
  }
}

/**
 * Search RCTC for Organism Code (SNOMED CT)
 * Searches organism/substance codes from RCTC Organism_Substance S2 sheet
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForOrganism(btn) {
  const row = btn.closest('.lab-evidence-row');
  const codeInput   = row.querySelector('.le-value-code');
  const nameInput   = row.querySelector('.le-value-name');
  const resultsDiv  = row.querySelector('.le-value-code-results');

  // UI: loading state
  btn.textContent = '⏳';
  btn.disabled = true;
  if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

  try {
    if (!organismLoaded) await loadOrganismFromRCTC();
    if (!Array.isArray(organismData) || organismData.length === 0) {
      alert('Organism list is empty. The RCTC file may not have loaded.');
      return;
    }

    const q = String(codeInput.value || '').trim().toLowerCase();
    if (!q) { alert('Enter a code to search'); return; }

    const exact = organismData.filter(o => String(o.code || '').toLowerCase() === q);
    const starts = organismData.filter(o => String(o.code || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === o.code));
    const contains = organismData.filter(o => String(o.code || '').toLowerCase().includes(q)
      && !exact.some(e => e.code === o.code)
      && !starts.some(s => s.code === o.code));

    const matches = [...exact, ...starts, ...contains];

    if (!matches.length) {
      if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div class="no-results">No matching organisms found</div>';
      }
      return;
    }

    if (resultsDiv) {
      const list = document.createElement('div');
      list.className = 'search-results-list';

      matches.slice(0, 10).forEach(o => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<strong>${o.code}</strong> — ${o.name}${o.description ? `<br><small>${o.description}</small>` : ''}`;
        item.onclick = () => {
          codeInput.value = o.code;
          nameInput.value = o.name;
          resultsDiv.style.display = 'none';
          // Trigger reportability re-evaluation after selection
          if (typeof window.triggerReportabilityEvaluation === 'function') {
            window.triggerReportabilityEvaluation();
          }
        };
        list.appendChild(item);
      });

      resultsDiv.appendChild(list);
      resultsDiv.style.display = 'block';
    } else {
      // Fallback
      codeInput.value = matches[0].code;
      nameInput.value = matches[0].name;
      // Trigger reportability re-evaluation after selection
      if (typeof window.triggerReportabilityEvaluation === 'function') {
        window.triggerReportabilityEvaluation();
      }
    }
  } catch (err) {
    console.error('Organism code search error:', err);
    alert('Error searching organisms. See console for details.');
  } finally {
    btn.textContent = '🔍';
    btn.disabled = false;
  }
}

/**
 * Search RCTC for Organism Name
 * Searches organism/substance names from RCTC Organism_Substance S2 sheet
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForOrganismByName(btn) {
  const row = btn.closest('.lab-evidence-row');
  const codeInput   = row.querySelector('.le-value-code');
  const nameInput   = row.querySelector('.le-value-name');
  const resultsDiv  = row.querySelector('.le-value-name-results');

  btn.textContent = '⏳';
  btn.disabled = true;
  if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

  try {
    if (!organismLoaded) await loadOrganismFromRCTC();
    if (!Array.isArray(organismData) || organismData.length === 0) {
      alert('Organism list is empty. The RCTC file may not have loaded.');
      return;
    }

    const q = String(nameInput.value || '').trim().toLowerCase();
    if (!q) { alert('Enter a name to search'); return; }

    const exact = organismData.filter(o => String(o.name || '').toLowerCase() === q);
    const starts = organismData.filter(o => String(o.name || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === o.code));
    const contains = organismData.filter(o => String(o.name || '').toLowerCase().includes(q)
      && !exact.some(e => e.code === o.code)
      && !starts.some(s => s.code === o.code));

    const matches = [...exact, ...starts, ...contains];

    if (!matches.length) {
      if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div class="no-results">No matching organisms found</div>';
      } else {
        alert(`No organisms found for "${q}".`);
      }
      return;
    }

    if (resultsDiv) {
      const list = document.createElement('div');
      list.className = 'search-results-list';

      matches.slice(0, 10).forEach(o => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<strong>${o.name}</strong> — ${o.code}${o.description ? `<br><small>${o.description}</small>` : ''}`;
        item.onclick = () => {
          codeInput.value = o.code;
          nameInput.value = o.name;
          resultsDiv.style.display = 'none';
          // Trigger reportability re-evaluation after selection
          if (typeof window.triggerReportabilityEvaluation === 'function') {
            window.triggerReportabilityEvaluation();
          }
        };
        list.appendChild(item);
      });

      resultsDiv.appendChild(list);
      resultsDiv.style.display = 'block';
    } else {
      codeInput.value = matches[0].code;
      nameInput.value = matches[0].name;
      // Trigger reportability re-evaluation after selection
      if (typeof window.triggerReportabilityEvaluation === 'function') {
        window.triggerReportabilityEvaluation();
      }
    }
  } catch (err) {
    console.error('Organism name search error:', err);
    alert('Error searching organisms. See console for details.');
  } finally {
    btn.textContent = '🔍';
    btn.disabled = false;
  }
}

/**
 * Search RCTC for Lab Order Code (LOINC)
 * Searches lab order codes from RCTC Lab Order Test Name S3 sheet
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForLabOrder(btn) {
    const row = btn.closest('.lab-evidence-row');
    const codeInput = row.querySelector('.le-order-code');
    const nameInput = row.querySelector('.le-order-name');
    const resultsDiv = row.querySelector('.le-order-code-results');

    btn.textContent = '⏳';
    btn.disabled = true;
    if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

    try {
        if (!labOrderLoaded) await loadLabOrderFromRCTC();
        if (!Array.isArray(labOrderData) || labOrderData.length === 0) {
            alert('Lab order list is empty. The RCTC file may not have loaded.');
            return;
        }

        const q = String(codeInput.value || '').trim().toLowerCase();
        if (!q) { alert('Enter a LOINC code to search'); return; }

        const exact = labOrderData.filter(o => String(o.code || '').toLowerCase() === q);
        const starts = labOrderData.filter(o => String(o.code || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === o.code));
        const contains = labOrderData.filter(o => String(o.code || '').toLowerCase().includes(q)
            && !exact.some(e => e.code === o.code)
            && !starts.some(s => s.code === o.code));

        const matches = [...exact, ...starts, ...contains];

        if (!matches.length) {
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<div class="no-results">No matching lab order codes found</div>';
            }
            return;
        }

        if (resultsDiv) {
            const list = document.createElement('div');
            list.className = 'search-results-list';

            matches.slice(0, 10).forEach(o => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `<strong>${o.code}</strong> — ${o.name}${o.description ? `<br><small>${o.description}</small>` : ''}`;
                item.onclick = () => {
                    codeInput.value = o.code;
                    nameInput.value = o.name;
                    resultsDiv.style.display = 'none';
                    // Trigger reportability re-evaluation after selection
                    if (typeof window.triggerReportabilityEvaluation === 'function') {
                        window.triggerReportabilityEvaluation();
                    }
                };
                list.appendChild(item);
            });

            resultsDiv.appendChild(list);
            resultsDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Lab order code search error:', err);
        alert('Error searching lab orders. See console for details.');
    } finally {
        btn.textContent = '🔍';
        btn.disabled = false;
    }
}

/**
 * Search RCTC for Lab Order Name
 * Searches lab order names from RCTC Lab Order Test Name S3 sheet
 *
 * @param {HTMLElement} btn - The search button element
 */
async function searchRCTCForLabOrderByName(btn) {
    const row = btn.closest('.lab-evidence-row');
    const codeInput = row.querySelector('.le-order-code');
    const nameInput = row.querySelector('.le-order-name');
    const resultsDiv = row.querySelector('.le-order-name-results');

    btn.textContent = '⏳';
    btn.disabled = true;
    if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.style.display = 'none'; }

    try {
        if (!labOrderLoaded) await loadLabOrderFromRCTC();
        if (!Array.isArray(labOrderData) || labOrderData.length === 0) {
            alert('Lab order list is empty. The RCTC file may not have loaded.');
            return;
        }

        const q = String(nameInput.value || '').trim().toLowerCase();
        if (!q) { alert('Enter a lab order name to search'); return; }

        const exact = labOrderData.filter(o => String(o.name || '').toLowerCase() === q);
        const starts = labOrderData.filter(o => String(o.name || '').toLowerCase().startsWith(q) && !exact.some(e => e.code === o.code));
        const contains = labOrderData.filter(o => String(o.name || '').toLowerCase().includes(q)
            && !exact.some(e => e.code === o.code)
            && !starts.some(s => s.code === o.code));

        const matches = [...exact, ...starts, ...contains];

        if (!matches.length) {
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<div class="no-results">No matching lab order names found</div>';
            }
            return;
        }

        if (resultsDiv) {
            const list = document.createElement('div');
            list.className = 'search-results-list';

            matches.slice(0, 10).forEach(o => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `<strong>${o.name}</strong> — ${o.code}${o.description ? `<br><small>${o.description}</small>` : ''}`;
                item.onclick = () => {
                    codeInput.value = o.code;
                    nameInput.value = o.name;
                    resultsDiv.style.display = 'none';
                    // Trigger reportability re-evaluation after selection
                    if (typeof window.triggerReportabilityEvaluation === 'function') {
                        window.triggerReportabilityEvaluation();
                    }
                };
                list.appendChild(item);
            });

            resultsDiv.appendChild(list);
            resultsDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Lab order name search error:', err);
        alert('Error searching lab order names. See console for details.');
    } finally {
        btn.textContent = '🔍';
        btn.disabled = false;
    }
}

// Expose functions globally for onclick attributes
window.searchRCTCCodes = searchRCTCCodes;
window.searchRCTCForDiagnosis = searchRCTCForDiagnosis;
window.searchRCTCForDiagnosisByName = searchRCTCForDiagnosisByName;
window.searchSNOMEDForProblem = searchSNOMEDForProblem;
window.searchSNOMEDForProblemByName = searchSNOMEDForProblemByName;
window.searchRCTCForLabOrder = searchRCTCForLabOrder;
window.searchRCTCForLabOrderByName = searchRCTCForLabOrderByName;
window.searchRCTCForTest = searchRCTCForTest;
window.searchRCTCForTestByName = searchRCTCForTestByName;
window.searchRCTCForOrganism = searchRCTCForOrganism;
window.searchRCTCForOrganismByName = searchRCTCForOrganismByName;
