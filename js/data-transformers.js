/**
 * data-transformers.js
 *
 * Data transformation and conversion functions
 * Handles CDA date format conversion, route/dose translations, display name mappings
 */

// Route translation function using FDA Route of Administration Terminology
function getRouteTranslation(routeCode) {
    const routeMap = {
        'PO': { fdaCode: 'C38288', snomedCode: '26643006', display: 'Oral route' },
        'IV': { fdaCode: 'C28161', snomedCode: '47625008', display: 'Intravenous route' },
        'IM': { fdaCode: 'C28161', snomedCode: '78421000', display: 'Intramuscular route' },
        'SC': { fdaCode: 'C38299', snomedCode: '34206005', display: 'Subcutaneous route' },
        'SL': { fdaCode: 'C38238', snomedCode: '37161004', display: 'Sublingual route' },
        'TOP': { fdaCode: 'C38675', snomedCode: '6064005', display: 'Topical route' },
        'INH': { fdaCode: 'C38284', snomedCode: '26643006', display: 'Inhalation route' }
    };
    return routeMap[routeCode] || routeMap['PO'];
}

// Simple dose unit fixer - converts "1" to "mg" for medications
function fixDoseUnit(unit) {
    if (unit === '1' || unit === 'each' || unit === 'tablet') return 'mg';
    if (unit === 'mcg') return 'ug';
    return unit;
}

// Simple unit fixer - converts "1" to "{tbl}" for tablets
function getValidDoseUnit(unit) {
    if (unit === '1' || unit === 'each' || unit === 'tablet') return '{tbl}';
    if (unit === 'mcg') return 'ug';
    return unit; // keep everything else the same
}

// Simple route fixer for immunizations
function getImmunizationRouteTranslation(routeCode) {
    if (routeCode === 'IM') return { code: 'C28161', display: 'Intramuscular route', snomed: '78421000' };
    if (routeCode === 'SC') return { code: 'C38299', display: 'Subcutaneous route', snomed: '34206005' };
    if (routeCode === 'PO') return { code: 'C38288', display: 'Oral route', snomed: '26643006' };
    if (routeCode === 'ID') return { code: 'C38238', display: 'Intradermal route', snomed: '72607000' };
    if (routeCode === 'IN') return { code: 'C38284', display: 'Intranasal route', snomed: '46713006' };
    // default to IM if unknown
    return { code: 'C28161', display: 'Intramuscular route', snomed: '78421000' };
}

// Get provider taxonomy code
function getProviderTaxonomyCode(providerType = 'physician') {
    const taxonomyCodes = {
        'physician': { code: '207Q00000X', display: 'Family Medicine Physician' },
        'nurse': { code: '163W00000X', display: 'Registered Nurse' },
        'pa': { code: '363A00000X', display: 'Physician Assistant' },
        'np': { code: '363L00000X', display: 'Nurse Practitioner' }
    };
    return taxonomyCodes[providerType] || taxonomyCodes['physician'];
}

// Simple test function to debug what's happening
function debugDateConversion() {
    console.log('=== DEBUGGING DATE CONVERSION ===');

    // Test cases from your actual data
    const testDates = [
        "202507100",    // 9 digits - malformed
        "20250710",     // 8 digits - valid date only
        "20250922",     // 8 digits - valid date only
        "20250822093000+000", // 14 digits + timezone - valid datetime
        ""              // empty string
    ];

    testDates.forEach(date => {
        console.log(`Input: "${date}"`);
        console.log(`Output: "${cdaToDatetimeLocal(date)}"`);
        console.log('---');
    });
}

// Very simple, clean version of the conversion function
function cdaToDatetimeLocal(cdaDateTime) {
    if (!cdaDateTime || typeof cdaDateTime !== 'string' || cdaDateTime.trim() === '') {
        return '';
    }

    // Remove timezone and non-digits, but be more flexible
    let cleaned = cdaDateTime.replace(/[+-]\d{3,4}$/, '').replace(/\D/g, '');

    // Handle various lengths more flexibly
    if (cleaned.length < 8) {
        console.warn(`Date too short: "${cdaDateTime}" (${cleaned.length} digits)`);
        return '';
    }

    // Truncate if too long, pad if exactly right
    if (cleaned.length >= 14) {
        cleaned = cleaned.substring(0, 14);
    } else if (cleaned.length >= 8) {
        // Pad with default time if we only have date
        const datePart = cleaned.substring(0, 8);
        cleaned = datePart + '000000'.substring(0, 14 - cleaned.length);
    }

    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    const hour = cleaned.length >= 10 ? cleaned.substring(8, 10) : '00';
    const minute = cleaned.length >= 12 ? cleaned.substring(10, 12) : '00';

    // Validate the components
    if (parseInt(month) > 12 || parseInt(month) < 1) {
        console.warn(`Invalid month in date: "${cdaDateTime}"`);
        return '';
    }
    if (parseInt(day) > 31 || parseInt(day) < 1) {
        console.warn(`Invalid day in date: "${cdaDateTime}"`);
        return '';
    }
    if (parseInt(hour) > 23) {
        console.warn(`Invalid hour in date: "${cdaDateTime}"`);
        return '';
    }
    if (parseInt(minute) > 59) {
        console.warn(`Invalid minute in date: "${cdaDateTime}"`);
        return '';
    }

    return `${year}-${month}-${day}T${hour}:${minute}`;
}

// Test datetime inputs
function testDateTimeInputs() {
    console.log('\n=== TESTING DATETIME INPUT BEHAVIOR ===');

    // Create a test input
    const testInput = document.createElement('input');
    testInput.type = 'datetime-local';
    document.body.appendChild(testInput);

    const testValues = [
        '2025-07-10T00:00',  // Valid
        '2025-09-22T00:00',  // Valid
        '2025-13-01T00:00',  // Invalid month
        '2025-07-32T00:00',  // Invalid day
        '2025-07-10T25:00',  // Invalid hour
        '2025-07-10T23:70'   // Invalid minute
    ];

    testValues.forEach(value => {
        testInput.value = value;
        console.log(`Set: "${value}" -> Got: "${testInput.value}"`);
    });

    document.body.removeChild(testInput);
}

// Convert from datetime-local format to CDA format
function datetimeLocalToCda(datetimeLocal) {
    if (!datetimeLocal) return '';

    // Handle both with and without time
    const date = new Date(datetimeLocal);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');

    return `${year}${month}${day}${hour}${minute}${second}`;
}

// Normalize timestamp to CDA format
function normalizeTS(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 14) return digits.slice(0, 14); // YYYYMMDDHHMMSS
  if (digits.length >= 8)  return digits.slice(0, 8);  // YYYYMMDD
  // fall back to a safe date if empty/invalid; adjust if you prefer another default
  return '20240615';
}

// Race code display name mapping
function getRaceDisplayName(raceCode) {
    const raceCodes = {
        '1002-5': 'American Indian or Alaska Native',
        '2028-9': 'Asian',
        '2054-5': 'Black or African American',
        '2076-8': 'Native Hawaiian or Other Pacific Islander',
        '2106-3': 'White',
        '2131-1': 'Other Race',
        'UNK': 'Unknown',
        'ASKU': 'Asked but unknown'
    };
    return raceCodes[raceCode] || 'Race';
}

// Ethnicity code display name mapping
function getEthnicityDisplayName(ethnicityCode) {
    const ethnicityCodes = {
        '2135-2': 'Hispanic or Latino',
        '2186-5': 'Not Hispanic or Latino',
        'UNK': 'Unknown',
        'ASKU': 'Asked but unknown'
    };
    return ethnicityCodes[ethnicityCode] || 'Ethnicity';
}

// Pregnancy status display name
function getPregnancyStatusDisplay(code) {
    const displays = {
        '77386006': 'Pregnant',
        '60001007': 'Not pregnant',
        '102874004': 'Possible pregnancy',
        '261665006': 'Unknown'
    };
    return displays[code] || 'Unknown';
}

// Emergency outbreak display name
function getEmergencyOutbreakDisplay(code) {
    const displays = {
        '443684005': 'Disease outbreak',
        '410546004': 'Public health emergency',
        '261665006': 'Unknown',
        'N/A': 'Not applicable'
    };
    return displays[code] || 'Not specified';
}

// Employment status display
function getEmploymentStatusDisplay(status) {
    const displays = {
        '1': 'Employed',
        '2': 'Unemployed',
        '3': 'Not in labor force',
        '4': 'Retired',
        '5': 'Student',
        'UNK': 'Unknown'
    };
    return displays[status] || 'Unknown';
}

// Exposure contact display
function getExposureContactDisplay(code) {
    const displays = {
        '24932003': 'Exposed',
        '84100007': 'Contact',
        '373068000': 'No exposure',
        '261665006': 'Unknown'
    };
    return displays[code] || 'Unknown';
}

// Exposure type display
function getExposureTypeDisplay(code) {
    const displays = {
        '409822003': 'Direct contact',
        '417746004': 'Airborne',
        '418038007': 'Droplet',
        '447964005': 'Contact precaution',
        'OTH': 'Other'
    };
    return displays[code] || 'Other';
}

// Quarantine status display
function getQuarantineStatusDisplay(code) {
    const displays = {
        '182856006': 'In quarantine',
        '182857002': 'Released from quarantine',
        '405178008': 'Not in quarantine',
        '261665006': 'Unknown'
    };
    return displays[code] || 'Unknown';
}

// Isolation status display
function getIsolationStatusDisplay(code) {
    const displays = {
        '40174006': 'In isolation',
        '182840001': 'Released from isolation',
        '385432009': 'Not in isolation',
        '261665006': 'Unknown'
    };
    return displays[code] || 'Unknown';
}

// Interpretation mapping
function mapInterp(v) {
    switch ((v||'').toLowerCase()) {
        case 'positive': return 'POS';
        case 'negative': return 'NEG';
        case 'detected': return 'DET';
        case 'not detected': return 'NDET';
        case 'a': return 'A';
        case 'n': return 'N';
        case 'h': return 'H';
        case 'l': return 'L';
        default: return '';
    }
}

// Get interpretation code for lab results
function getInterpretationCode(result, interpretation) {
    // Use the interpretation field if available
    if (interpretation) {
        const interpMap = {
            'A': 'A',     // Abnormal
            'N': 'N',     // Normal
            'H': 'H',     // High
            'L': 'L',     // Low
            'HH': 'HH',   // Critical high
            'LL': 'LL'    // Critical low
        };
        if (interpMap[interpretation]) return interpMap[interpretation];
    }

    // Fallback based on result text
    if (result) {
        const resultLower = result.toLowerCase();
        if (resultLower.includes('detected') || resultLower.includes('positive')) return 'A';
        if (resultLower.includes('not detected') || resultLower.includes('negative')) return 'N';
        if (resultLower.includes('high')) return 'H';
        if (resultLower.includes('low')) return 'L';
    }

    // Default fallback
    return 'A'; // Abnormal as default for lab results
}

// Condition-specific value set mapping function
function getConditionSpecificValueSet(code, codeSystem = '2.16.840.1.113883.6.96') {
    const valueSetMap = {
        // COVID-19 Trigger Codes
        '840539006': { // Disease caused by 2019-nCoV
            oid: '2.16.840.1.114222.4.11.7508',
            version: '1.2.0.0',
            name: 'COVID-19 (Diagnosis, Symptom, Condition, or Healthcare Encounter)'
        },
        '840544004': { // Suspected disease caused by 2019-nCoV
            oid: '2.16.840.1.114222.4.11.7508',
            version: '1.2.0.0',
            name: 'COVID-19 (Diagnosis, Symptom, Condition, or Healthcare Encounter)'
        },
        '94500-6': { // SARS-CoV-2 RNA [Presence] in Respiratory specimen by NAA with probe detection
            oid: '2.16.840.1.114222.4.11.7508',
            version: '1.2.0.0',
            name: 'COVID-19 (Laboratory Test)'
        },
        '94310-0': { // SARS-like Coronavirus N gene [Presence] in Unspecified specimen by NAA with probe detection
            oid: '2.16.840.1.114222.4.11.7508',
            version: '1.2.0.0',
            name: 'COVID-19 (Laboratory Test)'
        },

        // Influenza Trigger Codes
        '719865001': { // Influenza A virus infection
            oid: '2.16.840.1.114222.4.11.1009',
            version: '2.0.0',
            name: 'Influenza (Diagnosis, Symptom, Condition, or Healthcare Encounter)'
        },
        '34487-9': { // Influenza virus A RNA [Presence] in Respiratory specimen by NAA with probe detection
            oid: '2.16.840.1.114222.4.11.1009',
            version: '2.0.0',
            name: 'Influenza (Laboratory Test)'
        },

        // Birth Defects (current focus)
        '67531005': { // Spina bifida
            oid: '2.16.840.1.113762.1.4.1146.2260',
            version: '2.0.1',
            name: 'Birth Defects Trigger Codes'
        },
        '86299006': { // Tetralogy of Fallot
            oid: '2.16.840.1.113762.1.4.1146.2260',
            version: '2.0.1',
            name: 'Birth Defects Trigger Codes'
        },
        '414819007': { // Neonatal abstinence syndrome
            oid: '2.16.840.1.113762.1.4.1146.2260',
            version: '2.0.1',
            name: 'Birth Defects Trigger Codes'
        },

        // Default fallback
        'default': {
            oid: '2.16.840.1.113762.1.4.1146.2260',
            version: '2.0.1',
            name: 'RCTC Master List'
        }
    };

    return valueSetMap[code] || valueSetMap['default'];
}

// Extract condition names from form data
function extractConditionNames() {
    const data = getFormData();
    const conditions = [];

    console.log('[extractConditionNames] Form data:', data);
    console.log('[extractConditionNames] diagnosisEvidence:', data.diagnosisEvidence);

    // Extract from new dynamic diagnosis evidence array
    if (data.diagnosisEvidence && Array.isArray(data.diagnosisEvidence)) {
        data.diagnosisEvidence.forEach(diagnosis => {
            console.log('[extractConditionNames] Checking diagnosis:', diagnosis);
            if (diagnosis.diagnosisCode && diagnosis.diagnosisName) {
                console.log('[extractConditionNames] Adding condition:', diagnosis.diagnosisName);
                conditions.push(diagnosis.diagnosisName);
            }
        });
    }

    // Fallback: check legacy fields if they still exist
    if (conditions.length === 0) {
        console.log('[extractConditionNames] No evidence found, checking legacy fields...');
        if (data.diagnosis1Code && data.diagnosis1Name) {
            console.log('[extractConditionNames] Found diagnosis1:', data.diagnosis1Name);
            conditions.push(data.diagnosis1Name);
        }
        if (data.diagnosis2Code && data.diagnosis2Name) {
            console.log('[extractConditionNames] Found diagnosis2:', data.diagnosis2Name);
            conditions.push(data.diagnosis2Name);
        }
        if (data.diagnosis3Code && data.diagnosis3Name) {
            console.log('[extractConditionNames] Found diagnosis3:', data.diagnosis3Name);
            conditions.push(data.diagnosis3Name);
        }
    }

    console.log('[extractConditionNames] Final conditions:', conditions);
    return conditions;
}

// Sanitize and format condition name for filename
function sanitizeConditionName(conditionNames) {
    if (!conditionNames || conditionNames.length === 0) {
        return 'Unknown';
    }

    let result;
    if (conditionNames.length === 1) {
        result = conditionNames[0];
    } else {
        // Multiple conditions - use first + "Multi"
        result = conditionNames[0] + '_Multi';
    }

    // Apply common abbreviations
    const abbreviations = {
        'COVID-19': 'COVID19',
        'Coronavirus Disease 2019': 'COVID19',
        'Severe Acute Respiratory Syndrome Coronavirus 2': 'SARS_CoV2',
        'Tuberculosis': 'TB',
        'Human Immunodeficiency Virus': 'HIV',
        'Acquired Immunodeficiency Syndrome': 'AIDS',
        'Hepatitis A': 'HepA',
        'Hepatitis B': 'HepB',
        'Hepatitis C': 'HepC',
        'Influenza': 'Flu',
        'Pertussis': 'Whooping_Cough',
        'Salmonella': 'Salmonella',
        'Escherichia coli': 'E_coli',
        'Streptococcus': 'Strep',
        'Meningitis': 'Meningitis',
        'Down syndrome': 'Down_Syndrome',
        'Spina bifida': 'Spina_Bifida',
        'Tetralogy of Fallot': 'TOF'
    };

    // Check for exact matches first
    for (const [full, abbrev] of Object.entries(abbreviations)) {
        if (result.toLowerCase().includes(full.toLowerCase())) {
            result = result.replace(new RegExp(full, 'gi'), abbrev);
            break;
        }
    }

    // Remove disorder/disease/syndrome suffixes
    result = result.replace(/\s*\(disorder\)$/i, '')
                  .replace(/\s*\(disease\)$/i, '')
                  .replace(/\s*syndrome$/i, '')
                  .replace(/\s*disease$/i, '');

    // Sanitize for filename: remove invalid characters and spaces
    result = result.replace(/[\/\\:*?"<>|]/g, '')  // Remove invalid filename chars
                  .replace(/\s+/g, '_')             // Replace spaces with underscores
                  .replace(/[^\w\-_]/g, '')         // Keep only alphanumeric, dash, underscore
                  .replace(/_+/g, '_')              // Collapse multiple underscores
                  .replace(/^_|_$/g, '');           // Trim leading/trailing underscores

    // Limit length to ~20 characters
    if (result.length > 20) {
        result = result.substring(0, 20).replace(/_$/, '');
    }

    return result || 'Unknown';
}

// Generate timestamp in YYYYMMDD_HHMMSS format
function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Generate dynamic filename
function generateDynamicFilename(fileType, extension) {
    const conditionNames = extractConditionNames();
    const conditionName = sanitizeConditionName(conditionNames);
    const timestamp = generateTimestamp();

    return `${fileType}_${conditionName}_${timestamp}.${extension}`;
}

// Expose filename generation functions globally for cross-module access
window.generateTimestamp = generateTimestamp;
window.extractConditionNames = extractConditionNames;
window.sanitizeConditionName = sanitizeConditionName;
window.generateDynamicFilename = generateDynamicFilename;
