/**
 * data-loaders.js
 *
 * Async data loading functions from RCTC Excel files
 * Loads lab observations, diagnosis, lab orders, organisms, and test data
 */

// Load lab observations from RCTC Excel file
async function loadLabObsFromRCTC() {
    try {
        const response = await fetch('./assets/data/RCTC_Release (2025-03-18).xlsx');
        if (!response.ok) {
            throw new Error(`Failed to load RCTC Excel file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const allLabObs = [];

        // Look for "Lab Obs Test Name S4" sheet
        const targetSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase().includes('lab obs test name s4') ||
            name.toLowerCase().includes('lab_obs_test_name_s4')
        );

        if (targetSheetName) {
            const worksheet = workbook.Sheets[targetSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Skip empty sheets
            if (jsonData.length > 1) {
                // Debug: log the first few rows to see the actual structure
                console.log('Sheet name:', targetSheetName);
                console.log('First 3 data rows:', jsonData.slice(0, 4));

                // Process data rows - let's try different column combinations
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (row && row.length > 2) {
                        // Try to find which column has the actual test names (longest text usually)
                        let codeCol = row[1] || '';
                        let nameCol = row[2] || '';

                        // If Column C is just "LOINC", try a different column for the name
                        if (nameCol === 'LOINC' && row[3]) {
                            nameCol = row[3]; // Try Column D
                        } else if (nameCol === 'LOINC' && row[4]) {
                            nameCol = row[4]; // Try Column E
                        }

                        allLabObs.push({
                            code: codeCol,
                            name: nameCol,
                            description: row[0] || ''
                        });
                    }
                }
            }
        }

        labObsData = allLabObs;
        labObsLoaded = true;

        console.log(`Loaded ${labObsData.length} lab observations from RCTC file`);
        console.log('Sample data:', labObsData.slice(0, 3));
        return labObsData;

    } catch (error) {
        console.warn('Failed to load lab observations from RCTC file:', error);
        // Fallback to hardcoded values if RCTC file can't be loaded
        labObsData = getHardcodedLabObs();
        labObsLoaded = true;
        return labObsData;
    }
}

// Fallback hardcoded lab observations
function getHardcodedLabObs() {
    return [
        { code: "94310-0", name: "SARS-like Coronavirus N gene [Presence] in Unspecified specimen by NAA with probe detection", description: "LOINC" },
        { code: "34487-9", name: "Influenza virus A RNA [Presence] in Respiratory specimen by NAA with probe detection", description: "LOINC" },
        { code: "19080-1", name: "Choriogonadotropin.beta subunit [Units/volume] in Serum or Plasma", description: "LOINC" }
    ];
}

// STRICT loader: uses ONLY "diagnosis_problem s1" (B=code, C=name)
async function loadDiagnosisFromRCTC() {
  try {
    const res = await fetch('./assets/data/RCTC_Release (2025-03-18).xlsx');
    if (!res.ok) throw new Error(`Failed to load RCTC Excel file: ${res.status}`);

    const ab = await res.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });

    const SHEET_NAME = 'Diagnosis_Problem S1';
    const ws = wb.Sheets[SHEET_NAME];
    if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found in RCTC release.`);

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // normalize helper: trims & removes NBSPs
    const norm = v => String(v ?? '').replace(/\u00A0/g, ' ').trim();

    const allDiagnosis = [];
    // Row 0 = header; start from 1. B (idx 1) = code, C (idx 2) = name. A (idx 0) optional description.
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 3) continue;
      const code = norm(r[1]);
      const name = norm(r[2]);
      const description = norm(r[0]);
      if (code && name) allDiagnosis.push({ code, name, description });
    }

    diagnosisData = allDiagnosis;
    diagnosisLoaded = true;
    console.log(`Loaded ${diagnosisData.length} diagnoses from "${SHEET_NAME}"`);
    return diagnosisData;
  } catch (error) {
    console.warn('Failed to load diagnoses from RCTC file:', error);
    diagnosisData = getHardcodedDiagnosis(); // keep your existing fallback
    diagnosisLoaded = true;
    return diagnosisData;
  }
}

// Fallback hardcoded diagnosis data
function getHardcodedDiagnosis() {
    return [
        { code: "67531005", name: "Down syndrome (disorder)", description: "SNOMEDCT" },
        { code: "414819007", name: "Disease caused by Bordetella pertussis (disorder)", description: "SNOMEDCT" },
        { code: "86299006", name: "Gonorrhea (disorder)", description: "SNOMEDCT" }
    ];
}

// Load lab order data from RCTC Excel file - Lab Order Test Name S3 tab
async function loadLabOrderFromRCTC() {
    try {
        const response = await fetch('./assets/data/RCTC_Release (2025-03-18).xlsx');
        if (!response.ok) {
            throw new Error(`Failed to load RCTC Excel file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const allLabOrders = [];

        // Look for "Lab Order Test Name S3" sheet
        const targetSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase().includes('lab order test name s3') ||
            name.toLowerCase().includes('lab_order_test_name_s3') ||
            name.toLowerCase().includes('lab order test name s3')
        );

        if (targetSheetName) {
            const worksheet = workbook.Sheets[targetSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            console.log('Lab Order sheet name:', targetSheetName);
            console.log('First 3 lab order rows:', jsonData.slice(0, 4));

            if (jsonData.length > 1) {
                // Process data rows - Column B for code, Column C for name
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (row && row.length > 2 && row[1] && row[2]) {
                        allLabOrders.push({
                            code: row[1] || '', // Column B for code
                            name: row[2] || '', // Column C for name
                            description: row[0] || '' // Column A for description (if available)
                        });
                    }
                }
            }
        }

        labOrderData = allLabOrders;
        labOrderLoaded = true;

        console.log(`Loaded ${labOrderData.length} lab orders from RCTC file`);
        return labOrderData;

    } catch (error) {
        console.warn('Failed to load lab orders from RCTC file:', error);
        labOrderData = getHardcodedLabOrders();
        labOrderLoaded = true;
        return labOrderData;
    }
}

// Fallback hardcoded lab orders
function getHardcodedLabOrders() {
    return [
        { code: "94310-0", name: "SARS-like Coronavirus N gene [Presence] in Unspecified specimen by NAA with probe detection", description: "LOINC" },
        { code: "34487-9", name: "Influenza virus A RNA [Presence] in Respiratory specimen by NAA with probe detection", description: "LOINC" },
        { code: "19080-1", name: "Choriogonadotropin.beta subunit [Units/volume] in Serum or Plasma", description: "LOINC" }
    ];
}

// Load organism data from RCTC Excel file - Organism_Substance S2 tab
async function loadOrganismFromRCTC() {
  try {
    const url = './assets/data/RCTC_Release (2025-03-18).xlsx';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed (${resp.status}) for ${url}`);

    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Normalize names to avoid subtle spacing/underscore/case mismatches
    const normalize = s => String(s || '')
      .toLowerCase()
      .replace(/[\s_]+/g, '');

    // Prefer exact normalized match first, then relaxed "includes"
    const wanted = 'organismsubstances2';
    let targetSheetName =
      workbook.SheetNames.find(n => normalize(n) === wanted) ||
      workbook.SheetNames.find(n => normalize(n).includes(wanted));

    if (!targetSheetName) {
      throw new Error('Sheet "Organism_Substance S2" not found in workbook');
    }

    const ws = workbook.Sheets[targetSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

    // Expect header row at index 0, then data; B=code (idx 1), C=name (idx 2)
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const code = String(r[1] || '').trim();
      const name = String(r[2] || '').trim();
      if (!code || !name) continue;
      out.push({
        code,
        name,
        description: String(r[0] || '').trim() // A if present
      });
    }

    if (!out.length) {
      throw new Error(`Sheet "${targetSheetName}" parsed but 0 usable rows (check B/C columns).`);
    }

    organismData = out;
    organismLoaded = true;
    console.log(`Loaded ${organismData.length} organisms from "${targetSheetName}"`);
    return organismData;
  } catch (err) {
    organismData = getHardcodedOrganisms(); // your existing tiny fallback
    organismLoaded = true;

    // Surface the real reason to the user so it's obvious when the fallback is in play
    alert(`Could not load Organism_Substance S2 from RCTC file.\nReason: ${err.message}\nUsing a small fallback list.`);
    console.warn('Organism load error:', err);
    return organismData;
  }
}

// Load test data from RCTC Excel file - LAB_OBS Test Name S4 tab
async function loadTestsFromRCTC() {
  try {
    const url = './assets/data/RCTC_Release (2025-03-18).xlsx';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed (${resp.status}) for ${url}`);

    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Normalize names to handle spaces/underscores/case
    const normalize = s => String(s || '')
      .toLowerCase()
      .replace(/[\s_]+/g, '');

    // Target "LAB_OBS Test Name S4" and common variants
    const wanted = 'labobstestnames4';
    let targetSheetName =
      workbook.SheetNames.find(n => normalize(n) === wanted) ||
      workbook.SheetNames.find(n => normalize(n).includes(wanted));

    if (!targetSheetName) {
      throw new Error('Sheet "LAB_OBS Test Name S4" not found in workbook');
    }

    const ws = workbook.Sheets[targetSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

    // Expect header at row 0; B=code(idx1), C=name(idx2)
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const code = String(r[1] || '').trim();   // Column B
      const name = String(r[2] || '').trim();   // Column C
      if (!code || !name) continue;
      out.push({
        code,                      // LOINC code
        name,                      // Test name
        description: String(r[0] || '').trim() // Optional: Column A if present
      });
    }

    if (!out.length) {
      throw new Error(`Sheet "${targetSheetName}" parsed but 0 usable rows (check B/C columns).`);
    }

    testData = out;
    testLoaded = true;
    console.log(`Loaded ${testData.length} tests from "${targetSheetName}"`);
    return testData;
  } catch (err) {
    testData = [];
    testLoaded = true;
    alert(`Could not load "LAB_OBS Test Name S4". Reason: ${err.message}`);
    console.warn('Test load error:', err);
    return testData;
  }
}

// Fallback hardcoded organisms
function getHardcodedOrganisms() {
    return [
        { code: "840539006", name: "Disease caused by 2019-nCoV", description: "SNOMEDCT" },
        { code: "409822003", name: "Domain Bacteria", description: "SNOMEDCT" },
        { code: "84676004", name: "Severe acute respiratory syndrome coronavirus", description: "SNOMEDCT" }
    ];
}

// Load conditions from Excel file
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

// Fallback hardcoded conditions
function getHardcodedConditions() {
    return [
        { condition: "Down Syndrome", code: "67531005", codeType: "SNOMEDCT", description: "Down syndrome (disorder)" },
        { condition: "Pertussis", code: "414819007", codeType: "SNOMEDCT", description: "Disease caused by Bordetella pertussis (disorder)" },
        { condition: "Gonorrhea", code: "86299006", codeType: "SNOMEDCT", description: "Gonorrhea (disorder)" }
    ];
}
