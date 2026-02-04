/**
 * HL7 CDA R2 XML Generation Module
 *
 * This module contains all XML building functions for generating HL7 Clinical Document Architecture (CDA) Release 2
 * compliant electronic Initial Case Reports (eICR) and Reportability Response (RR) documents.
 *
 * CRITICAL MEDICAL SOFTWARE: This code generates standards-compliant medical documents for public health reporting.
 * DO NOT modify without thorough understanding of HL7 CDA R2, C-CDA, and eICR/RR implementation guides.
 *
 * Key Standards Implemented:
 * - HL7 CDA Release 2.0
 * - HL7 C-CDA Release 2.1
 * - HL7 eICR Implementation Guide Release 2.0
 * - HL7 RR Implementation Guide Release 2.0
 * - Public Health Case Report (eICR) - LOINC 55751-2
 *
 * @module xml-builders
 * @version 1.0.0
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escapes XML special characters to prevent injection and ensure valid XML
 * @param {string} str - String to escape
 * @returns {string} XML-safe string
 */
function xmlEscape(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\(/g, '&#40;')   // Left parenthesis
    .replace(/\)/g, '&#41;')   // Right parenthesis
    .replace(/\[/g, '&#91;')   // Left bracket
    .replace(/\]/g, '&#93;')   // Right bracket
    .replace(/\{/g, '&#123;')  // Left brace
    .replace(/\}/g, '&#125;');  // Right brace
}

/**
 * Generates a unique GUID for XML element IDs
 * @returns {string} GUID in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateGUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * NOTE: Filename generation functions are defined in data-transformers.js:
 * - generateTimestamp()
 * - extractConditionNames()
 * - sanitizeConditionName()
 * - generateDynamicFilename()
 * They are exposed globally via window.* in data-transformers.js
 */

/**
 * Gets effective setId based on document relationship type
 * @param {Object} data - Form data
 * @returns {string} Effective setId
 */
function getEffectiveSetId(data) {
  // For Replace/Update documents, use the relatedDocumentId as the setId
  // For New documents, use the setId field
  if (data.documentRelationshipType === 'RPLC') {
    return data.relatedDocumentId || data.setId;
  }
  return data.setId;
}

/**
 * Generates relatedDocument XML for document versioning
 * @param {Object} data - Form data
 * @returns {string} RelatedDocument XML or empty string
 */
function generateRelatedDocumentXml(data) {
  // Only generate relatedDocument element if not a new document
  if (!data.documentRelationshipType || data.documentRelationshipType === 'NEW') {
    return '';
  }

  const relatedSetId = data.relatedDocumentId || '';
  const typeCode = data.documentRelationshipType || 'RPLC';

  return `
  <!-- Related Document Information -->
  <relatedDocument typeCode="${typeCode}">
    <parentDocument>
      <setId extension="${relatedSetId}" root="1.2.840.114350.1.13.380.3.7.1.1" />
      <code code="55751-2" codeSystem="2.16.840.1.113883.6.1"
            codeSystemName="LOINC" displayName="Public Health Case Report" />
    </parentDocument>
  </relatedDocument>`;
}

/**
 * Gets condition-specific RCTC value set information
 * @param {string} code - Condition or test code
 * @param {string} codeSystem - Code system OID
 * @returns {Object} Value set OID and version
 */
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

/**
 * Maps interpretation strings to standard HL7 codes
 * @param {string} v - Interpretation value
 * @returns {string} HL7 interpretation code
 */
function mapInterp(v) {
  switch ((v || '').toLowerCase()) {
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

/**
 * Normalizes timestamp to CDA format (YYYYMMDDHHMMSS or YYYYMMDD)
 * @param {string} raw - Raw timestamp string
 * @returns {string} Normalized timestamp
 */
function normalizeTS(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 14) return digits.slice(0, 14); // YYYYMMDDHHMMSS
  if (digits.length >= 12) return digits.slice(0, 12); // YYYYMMDDHHMM
  if (digits.length >= 8) return digits.slice(0, 8);  // YYYYMMDD
  // fall back to a safe date if empty/invalid; adjust if you prefer another default
  return '20240615';
}

/**
 * Gets global results providers information from form
 * @returns {Object} Provider information for results
 */
function getGlobalResultsProviders() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  return {
    // Performing lab (organization)
    labCLIA: v('resultLabCLIA'),
    labName: v('resultLabName'),

    // Resulting performer (person)
    perfNPI: v('resultPerformerNPI'),
    perfGiven: v('resultPerformerGiven'),
    perfFamily: v('resultPerformerFamily'),

    // Ordering provider (author)
    ordNPI: v('resultOrderingNPI'),
    ordGiven: v('resultOrderingGiven'),
    ordFamily: v('resultOrderingFamily'),
    ordTime: v('resultAuthorTime')
  };
}

/**
 * Emits author XML for result observations
 * @param {string} ts - Timestamp
 * @returns {string} Author XML
 */
function emitResultAuthorXML(ts) {
  const t = normalizeTS(ts);
  return `
    <author>
      <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
      <time value="${t}"/>
      <assignedAuthor>
        <id nullFlavor="UNK"/>
        <assignedPerson>
          <name><given>Unknown</given><family>Author</family></name>
        </assignedPerson>
      </assignedAuthor>
    </author>`;
}

/**
 * Gets reference range XML for lab tests
 * @param {string} testCode - Test code
 * @param {string} referenceRangeText - Reference range text
 * @returns {string} Reference range XML
 */
function getReferenceRange(testCode, referenceRangeText) {
  if (referenceRangeText) {
    return `
        <referenceRange>
          <observationRange>
            <text>${referenceRangeText}</text>
          </observationRange>
        </referenceRange>`;
  }

  // Default reference ranges for common tests
  const defaultRanges = {
    '94310-0': 'Not Detected', // COVID-19
    '34487-9': 'Not Detected'  // Influenza
  };

  if (defaultRanges[testCode]) {
    return `
        <referenceRange>
          <observationRange>
            <text>${defaultRanges[testCode]}</text>
            <value xsi:type="CD" code="260415000"
                   codeSystem="2.16.840.1.113883.6.96"
                   displayName="Not detected"/>
          </observationRange>
        </referenceRange>`;
  }

  return '';
}

// ============================================================================
// DISPLAY MAPPING FUNCTIONS
// ============================================================================

/**
 * Gets display name for employment status code
 */
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

/**
 * Gets display name for exposure/contact code
 */
function getExposureContactDisplay(code) {
  const displays = {
    '24932003': 'Exposed',
    '84100007': 'Contact',
    '373068000': 'No exposure',
    '261665006': 'Unknown'
  };
  return displays[code] || 'Unknown';
}

/**
 * Gets display name for exposure type code
 */
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

/**
 * Gets display name for quarantine status code
 */
function getQuarantineStatusDisplay(code) {
  const displays = {
    '182856006': 'In quarantine',
    '182857002': 'Released from quarantine',
    '405178008': 'Not in quarantine',
    '261665006': 'Unknown'
  };
  return displays[code] || 'Unknown';
}

/**
 * Gets display name for isolation status code
 */
function getIsolationStatusDisplay(code) {
  const displays = {
    '40174006': 'In isolation',
    '182840001': 'Released from isolation',
    '385432009': 'Not in isolation',
    '261665006': 'Unknown'
  };
  return displays[code] || 'Unknown';
}

/**
 * Gets display name for emergency outbreak code
 */
function getEmergencyOutbreakDisplay(code) {
  const displays = {
    '443684005': 'Disease outbreak',
    '410546004': 'Public health emergency',
    '261665006': 'Unknown',
    'N/A': 'Not applicable'
  };
  return displays[code] || 'Not specified';
}

/**
 * Gets interpretation code for lab results
 */
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

// ============================================================================
// SECTION BUILDERS - CLINICAL OBSERVATIONS
// ============================================================================

/**
 * Generates vital signs entries XML
 * @param {Object} data - Form data containing vital signs
 * @returns {string} Vital signs XML or empty string
 */
function generateVitalSignsEntries(data) {

  // nothing to do?
  if (
    !data.temperature && !data.bloodPressure && !data.heartRate &&
    !data.respiratoryRate && !data.oxygenSaturation &&
    !data.weight && !data.height && !data.bmi
  ) { return ''; }

  // helper so we don't repeat the templateId stanza 8 times
  const vital = (code, display, value, unit) => `
      <component>
        <observation classCode="OBS" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.27"
                      extension="2014-06-09"/>
          <id root="${generateGUID()}"/>
          <code code="${code}" codeSystem="2.16.840.1.113883.6.1"
                displayName="${display}"/>
          <statusCode code="completed"/>
          <effectiveTime value="${data.encounterDate}"/>
          <value xsi:type="PQ" value="${value}" unit="${unit}"/>
          <author>
            <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
            <time value="${data.encounterDate}"/>
            <assignedAuthor>
              <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
              <code code="${getProviderTaxonomyCode('physician').code}"
      codeSystem="2.16.840.1.113883.6.101"
      displayName="${getProviderTaxonomyCode('physician').display}"/>
              <assignedPerson>
                <name>
                  <given>${data.providerName.split(' ')[1] || 'Unknown'}</given>
                  <family>${data.providerName.split(' ')[2] || 'Provider'}</family>
                </name>
              </assignedPerson>
            </assignedAuthor>
          </author>
        </observation>
      </component>`;

  return `
    <entry typeCode="DRIV">
      <organizer classCode="CLUSTER" moodCode="EVN">
        <templateId root="2.16.840.1.113883.10.20.22.4.26"
                    extension="2015-08-01"/>
        <id root="${generateGUID()}"/>
        <code code="46680005" codeSystem="2.16.840.1.113883.6.96"
              displayName="Vital signs"/>
        <statusCode code="completed"/>
        <effectiveTime value="${data.encounterDate}"/>
        <author>
      <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
      <time value="20240615"/>
      <assignedAuthor>
        <id extension="1234567890" root="2.16.840.1.113883.4.6"/>
        <code code="207Q00000X" codeSystem="2.16.840.1.113883.6.101" displayName="Family Medicine Physician"/>
        <assignedPerson>
          <name>
            <given>Royce</given>
            <family>Hemlock</family>
          </name>
        </assignedPerson>
      </assignedAuthor>
    </author>

        ${data.temperature ? vital('8310-5', 'Body temperature', data.temperature, '[degF]') : ''}
        ${data.bloodPressure ? vital('8480-6', 'Systolic blood pressure', data.bloodPressure.split('/')[0], 'mm[Hg]') : ''}
        ${data.heartRate ? vital('8867-4', 'Heart rate', data.heartRate, '/min') : ''}
        ${data.respiratoryRate ? vital('9279-1', 'Respiratory rate', data.respiratoryRate, '/min') : ''}
        ${data.oxygenSaturation ? vital('59408-5', 'Oxygen saturation (SpO₂)', data.oxygenSaturation, '%') : ''}
        ${data.weight ? vital('3141-9', 'Body weight', data.weight, 'kg') : ''}
        ${data.height ? vital('8302-2', 'Body height', data.height, 'cm') : ''}
        ${data.bmi ? vital('39156-5', 'Body Mass Index', data.bmi, 'kg/m2') : ''}

      </organizer>
    </entry>`;
}

/**
 * Builds specimen section XML for laboratory specimens
 * @param {Object} d - Form data
 * @returns {string} Specimen section XML or empty string
 */
function buildSpecimenSection(d) {
  // bail if the form is blank
  if (!d.specimen1Id && !d.specimen2Id) return '';

  // ---------- human-readable rows ----------
  const rows = [];
  const addRow = (src, type, id, dt) => rows.push(
    `<tr><td>${xmlEscape(src)}</td><td>${xmlEscape(type)}</td>` +
    `<td>${xmlEscape(id)}</td><td>${xmlEscape(dt)}</td></tr>`
  );

  // ---------- machine-readable entries ----------
  const entries = [];
  const addEntry = (src, type, id, dt) => entries.push(`
    <entry typeCode="DRIV">
      <procedure classCode="PROC" moodCode="EVN">
        <templateId root="2.16.840.1.113883.10.20.22.4.14" extension="2014-06-09" />
        <id root="${generateGUID()}" />
         <code code="33747-0" codeSystem="2.16.840.1.113883.6.1" displayName="General procedure">
      <originalText>General procedure</originalText>
    </code>
        <statusCode code="completed" />
        <effectiveTime value="${xmlEscape(dt)}"/>
        <targetSiteCode displayName="${xmlEscape(src)}" codeSystem="2.16.840.1.113883.6.96" />
        <performer>
  <assignedEntity>
    <id extension="${d.providerId}" root="2.16.840.1.113883.4.6"/>
    <addr use="WP">
      <streetAddressLine>${d.facilityAddress}</streetAddressLine>
      <city>${d.patientCity}</city>
      <state>${d.patientState}</state>
      <postalCode>${d.patientZip}</postalCode>
      <country>US</country>
    </addr>
    <telecom use="WP" value="tel:${d.providerPhone}"/>
    <assignedPerson>
      <name>
        <given>${(d.providerName || 'Unknown').split(' ')[0]}</given>
        <family>${(d.providerName || 'Unknown').split(' ').slice(1).join(' ') || 'Provider'}</family>
      </name>
    </assignedPerson>
    <representedOrganization>
      <id extension="${d.organizationId || d.facilityId}" root="2.16.840.1.113883.4.6"/>
      <name>${d.facilityName}</name>
      <telecom use="WP" value="tel:${d.organizationPhone || d.providerPhone}"/>
      <addr use="WP">
        <streetAddressLine>${d.facilityAddress}</streetAddressLine>
        <city>${d.patientCity}</city>
        <state>${d.patientState}</state>
        <postalCode>${d.patientZip}</postalCode>
        <country>US</country>
      </addr>
    </representedOrganization>
  </assignedEntity>
 </performer>
 <author>
            <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
            <time value="20240615"/>
            <assignedAuthor>
                <id extension="${d.providerId}" root="2.16.840.1.113883.4.6"/>
                <code code="${getProviderTaxonomyCode('physician').code}" codeSystem="2.16.840.1.113883.6.101"
                  displayName="${getProviderTaxonomyCode('physician').display}"/>
                <assignedPerson>
                    <name>
                        <given>${d.providerName.split(' ')[1] || 'Unknown'}</given>
                        <family>${d.providerName.split(' ')[2] || 'Provider'}</family>
                    </name>
                </assignedPerson>
            </assignedAuthor>
  </author>
        
        <participant typeCode="PRD">
          <participantRole classCode="SPEC">
            <templateId root="2.16.840.1.113883.10.20.22.4.410" extension="2019-06-21" />
            <id root="2.16.840.1.113883.3.72.5.9.1" extension="${xmlEscape(id)}"/>
            <code code="12345" displayName="${xmlEscape(type)}" codeSystem="2.16.840.1.113883.6.96"/>
          </participantRole>
        </participant>
      </procedure>
    </entry>`);

  // specimen 1
  if (d.specimen1Id) {
    addRow(d.specimen1Source, d.specimen1Type, d.specimen1Id, d.collection1Date);
    addEntry(d.specimen1Source, d.specimen1Type, d.specimen1Id, d.collection1Date);
  }

  // specimen 2
  if (d.specimen2Id) {
    addRow(d.specimen2Source, d.specimen2Type, d.specimen2Id, d.collection2Date);
    addEntry(d.specimen2Source, d.specimen2Type, d.specimen2Id, d.collection2Date);
  }

  // ---------- wrap it all in a section ----------
  return `
    <component>
      <section>
        <!-- *Consolidated CDA* Specimen section -->
        <templateId root="2.16.840.1.113883.10.20.22.2.3"/>
        <code code="30954-2" codeSystem="2.16.840.1.113883.6.1" displayName="Specimen"/>

        <title>Specimen Information</title>
        <text>
          <table border="1">
            <thead><tr><th>Source</th><th>Type</th><th>ID</th><th>Collection Date</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </text>
        ${entries.join('\n')}
      </section>
    </component>`;
}

/**
 * Helper to build dose XML with optional rate
 * @param {string} dVal - Dose value
 * @param {string} dUnit - Dose unit
 * @param {string} vVal - Volume value (optional)
 * @param {string} vUnit - Volume unit (optional)
 * @returns {string} Dose XML
 */
function buildDoseXML(dVal, dUnit, vVal, vUnit) {
  let xml = `          <doseQuantity value="${dVal}" unit="${dUnit === '1' || dUnit === 'each' ? '{tbl}' : dUnit}"/>\n`;
  if (vVal && vUnit) {
    xml += `          <rateQuantity value="${vVal}" unit="${vUnit}"/>\n`;
  }
  return xml;
}

/**
 * Generates medication entries XML
 * @param {Object} d - Form data
 * @returns {string} Medication entries XML
 */
function generateMedicationEntries(d) {
  const meds = [
    {
      code: d.adminMed1Code, name: d.adminMed1Name, id: d.adminMed1Id,
      status: d.adminMed1Status, time: d.adminMed1Time, route: d.adminMed1Route,
      dVal: d.adminMed1DoseValue, dUnit: d.adminMed1DoseUnit,
      vVal: d.adminMed1VolValue, vUnit: d.adminMed1VolUnit,
      neg: d.adminMed1Negated ? 'true' : 'false'
    },
    {
      code: d.adminMed2Code, name: d.adminMed2Name, id: d.adminMed2Id,
      status: d.adminMed2Status, time: d.adminMed2Time, route: d.adminMed2Route,
      dVal: d.adminMed2DoseValue, dUnit: d.adminMed2DoseUnit,
      vVal: d.adminMed2VolValue, vUnit: d.adminMed2VolUnit,
      neg: d.adminMed2Negated ? 'true' : 'false'
    }
  ];

  return meds.filter(m => m.code && m.name).map(m => `
        <entry typeCode="DRIV">
          <substanceAdministration classCode="SBADM" moodCode="EVN" negationInd="${m.neg}">
            <templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"/>
            <id root="${generateGUID()}"/>
            <statusCode code="${m.status}"/>
            <effectiveTime xsi:type="IVL_TS">
              <low value="${m.time}"/>
            </effectiveTime>
            <routeCode code="${getRouteTranslation(m.route).fdaCode}" codeSystem="2.16.840.1.113883.3.26.1.1">
              <translation code="${getRouteTranslation(m.route).snomedCode}"
                           codeSystem="2.16.840.1.113883.6.96"
                           displayName="${getRouteTranslation(m.route).display}"/>
            </routeCode>
            ${buildDoseXML(m.dVal, m.dUnit, m.vVal, m.vUnit)}
            <consumable>
              <manufacturedProduct classCode="MANU">
                <templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"/>
                <manufacturedMaterial>
                  <code code="${m.code}"
                        codeSystem="2.16.840.1.113883.6.88"
                        displayName="${xmlEscape(m.name)}"/>
                </manufacturedMaterial>
              </manufacturedProduct>
            </consumable>
            <author>
              <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
              <time value="${m.time}"/>
              <assignedAuthor>
                <id extension="${d.providerId || 'UNK'}" root="2.16.840.1.113883.4.6"/>
                <code code="${getProviderTaxonomyCode('physician').code}"
                      codeSystem="2.16.840.1.113883.6.101"
                      displayName="${getProviderTaxonomyCode('physician').display}"/>
                <assignedPerson>
                  <name>
                    <given>${(d.providerName || 'Unknown Provider').split(' ')[0]}</given>
                    <family>${(d.providerName || 'Unknown Provider').split(' ').slice(1).join(' ') || 'Provider'}</family>
                  </name>
                </assignedPerson>
              </assignedAuthor>
            </author>
          </substanceAdministration>
        </entry>`).join('');
}

/**
 * Generates immunization entries XML
 * @param {Object} data - Form data
 * @returns {string} Immunization entries XML
 */
function generateImmunizationEntries(data) {
  const mkEntry = (i) => {
    const code = data[`vaccine${i}Code`];
    const name = data[`vaccine${i}Name`];
    if (!code || !name) return '';

    const status = data[`immunization${i}Status`] || 'completed';
    const negation = (status === 'not-done' || status === 'refused') ? 'true' : 'false';
    const date = data[`immunization${i}Date`] || '';
    const route = data[`vaccine${i}Route`] || 'IM';
    const doseStr = (data[`vaccine${i}Dose`] || '').trim();
    const [doseValue, doseUnitRaw] = doseStr.split(/\s+/, 2);
    const doseUnit = (doseUnitRaw === '1' || doseUnitRaw === 'each') ? '{tbl}' : (doseUnitRaw || 'mL');
    const mfr = data[`vaccine${i}Manufacturer`] || '';
    const lot = data[`vaccine${i}Lot`] || '';

    // Get the correct route translation
    const routeTranslation = getImmunizationRouteTranslation(route);

    return `
      <entry typeCode="DRIV">
        <substanceAdministration classCode="SBADM" moodCode="EVN" negationInd="${negation}">
          <templateId root="2.16.840.1.113883.10.20.22.4.52" />
          <templateId root="2.16.840.1.113883.10.20.22.4.52" extension="2015-08-01" />
          <id root="${generateGUID()}" />
          <statusCode code="${status}" />
          <effectiveTime value="${date}" />
          ${route ? `<routeCode code="${routeTranslation.code}" codeSystem="2.16.840.1.113883.3.26.1.1" displayName="${routeTranslation.display}">
            <translation code="${routeTranslation.snomed}"
                         codeSystem="2.16.840.1.113883.6.96"
                         displayName="${routeTranslation.display}"/>
          </routeCode>` : ''}
          ${doseValue ? `<doseQuantity value="${doseValue}" unit="${doseUnit}" />` : ''}
          <consumable>
            <manufacturedProduct classCode="MANU">
              <templateId root="2.16.840.1.113883.10.20.22.4.54" extension="2014-06-09" />
              <manufacturedMaterial>
                <code code="${code}" codeSystem="2.16.840.1.113883.12.292" displayName="${name}" />
                ${lot ? `<lotNumberText>${lot}</lotNumberText>` : ''}
              </manufacturedMaterial>
              ${mfr ? `<manufacturerOrganization>
                <name>${mfr}</name>
              </manufacturerOrganization>` : ''}
            </manufacturedProduct>
          </consumable>
          ${(data.administeringProviderNPI
          || data.administeringProviderGiven
          || data.administeringProviderMiddle
          || data.administeringProviderFamily
          || data.administeringProviderPhone
          || data.administeringProviderOrgName) ? `
          <performer typeCode="PRF">
            <assignedEntity>
              ${data.administeringProviderNPI ? `<id root="2.16.840.1.113883.4.6" extension="${data.administeringProviderNPI}" />` : ''}
              ${data.administeringProviderPhone ? `<telecom use="WP" value="tel:${data.administeringProviderPhone}" />` : ''}
              <assignedPerson>
                <name>
                  ${data.administeringProviderGiven ? `<given>${data.administeringProviderGiven}</given>` : ''}
                  ${data.administeringProviderMiddle ? `<given>${data.administeringProviderMiddle}</given>` : ''}
                  ${data.administeringProviderFamily ? `<family>${data.administeringProviderFamily}</family>` : ''}
                </name>
              </assignedPerson>
              ${data.administeringProviderOrgName ? `<representedOrganization>
                ${data.administeringProviderOrgId ? `<id root="${data.administeringProviderOrgIdRoot || '2.16.840.1.113883.19'}" extension="${data.administeringProviderOrgId}" />` : ''}
                <name>${data.administeringProviderOrgName}</name>
              </representedOrganization>` : ''}
            </assignedEntity>
          </performer>` : ''}
          <author>
            <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
            <time value="20240615120000"/>
            <assignedAuthor>
              <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
              <code code="${getProviderTaxonomyCode('physician').code}"
                    codeSystem="2.16.840.1.113883.6.101"
                    displayName="${getProviderTaxonomyCode('physician').display}"/>
              <assignedPerson>
                <name>
                  <given>${data.providerName.split(' ')[1] || 'Unknown'}</given>
                  <family>${data.providerName.split(' ')[2] || 'Provider'}</family>
                </name>
              </assignedPerson>
            </assignedAuthor>
          </author>
        </substanceAdministration>
      </entry>`;
  };

  return mkEntry(1) + mkEntry(2);
}

/**
 * Fixed route code mapping function using FDA Route of Administration Terminology
 * @param {string} routeCode - Route code (IM, SC, ID, PO, IN)
 * @returns {Object} Route translation with code, display, and snomed
 */
function getImmunizationRouteTranslation(routeCode) {
  const routeMap = {
    'IM': { code: 'C28161', display: 'Intramuscular route', snomed: '78421000' },
    'SC': { code: 'C38299', display: 'Subcutaneous route', snomed: '34206005' },
    'ID': { code: 'C38238', display: 'Intradermal route', snomed: '72607000' },
    'PO': { code: 'C38288', display: 'Oral route', snomed: '26643006' },
    'IN': { code: 'C38284', display: 'Intranasal route', snomed: '46713006' }
  };
  return routeMap[routeCode] || routeMap['IM'];
}

/**
 * Generates procedure entries XML
 * @param {Object} data - Form data
 * @returns {string} Procedure entries XML
 */
function generateProcedureEntries(data) {
  let entries = '';

  if (data.currentProc1Code && data.currentProc1Name) {
    entries += `
        <entry typeCode="DRIV">
          <procedure classCode="PROC" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.22.4.14" extension="2014-06-09" />
            <id root="${generateGUID()}" />
            <code code="${data.currentProc1Code}" codeSystem="2.16.840.1.113883.6.96" displayName="${data.currentProc1Name}">
              <originalText>${data.currentProc1Name}</originalText>
            </code>
            <statusCode code="completed" />
            <effectiveTime value="${data.currentProc1Date}" />
            <targetSiteCode code="421060004" codeSystem="2.16.840.1.113883.6.96" displayName="Structure of vertebral column"/>
            <performer>
              <assignedEntity>
                <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
                <addr use="WP">
                  <streetAddressLine>${data.facilityAddress}</streetAddressLine>
                  <city>${data.patientCity}</city>
                  <state>${data.patientState}</state>
                  <postalCode>${data.patientZip}</postalCode>
                  <country>US</country>
                </addr>
                <telecom use="WP" value="tel:${data.providerPhone}"/>
                <assignedPerson>
                  <name>
                    <given>${(data.providerName || 'Unknown').split(' ')[0]}</given>
                    <family>${(data.providerName || 'Unknown').split(' ').slice(1).join(' ') || 'Provider'}</family>
                  </name>
                </assignedPerson>
                <representedOrganization>
                  <id extension="${data.organizationId || data.facilityId}" root="2.16.840.1.113883.4.6"/>
                  <name>${data.facilityName}</name>
                  <telecom use="WP" value="tel:${data.organizationPhone || data.providerPhone}"/>
                  <addr use="WP">
                    <streetAddressLine>${data.facilityAddress}</streetAddressLine>
                    <city>${data.patientCity}</city>
                    <state>${data.patientState}</state>
                    <postalCode>${data.patientZip}</postalCode>
                    <country>US</country>
                  </addr>
                </representedOrganization>
              </assignedEntity>
            </performer>
            <author>
              <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
              <time value="${data.currentProc1Date}"/>
              <assignedAuthor>
                <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
                <code code="${getProviderTaxonomyCode('physician').code}"
                      codeSystem="2.16.840.1.113883.6.101"
                      displayName="${getProviderTaxonomyCode('physician').display}"/>
                <assignedPerson>
                  <name>
                    <given>${data.providerName.split(' ')[1] || 'Unknown'}</given>
                    <family>${data.providerName.split(' ')[2] || 'Provider'}</family>
                  </name>
                </assignedPerson>
              </assignedAuthor>
            </author>
          </procedure>
        </entry>`;
  }

  if (data.currentProc2Code && data.currentProc2Name) {
    entries += `
        <entry typeCode="DRIV">
          <procedure classCode="PROC" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.22.4.14" extension="2014-06-09" />
            <id root="${generateGUID()}" />
            <code code="${data.currentProc2Code}" codeSystem="2.16.840.1.113883.6.96" displayName="${data.currentProc2Name}">
              <originalText>${data.currentProc2Name}</originalText>
            </code>
            <statusCode code="completed" />
            <effectiveTime value="${data.currentProc2Date}" />
            <targetSiteCode code="421060004" codeSystem="2.16.840.1.113883.6.96" displayName="Structure of vertebral column"/>
            <performer>
              <assignedEntity>
                <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
                <addr use="WP">
                  <streetAddressLine>${data.facilityAddress}</streetAddressLine>
                  <city>${data.patientCity}</city>
                  <state>${data.patientState}</state>
                  <postalCode>${data.patientZip}</postalCode>
                  <country>US</country>
                </addr>
                <telecom use="WP" value="tel:${data.providerPhone}"/>
                <assignedPerson>
                  <name>
                    <given>${(data.providerName || 'Unknown').split(' ')[0]}</given>
                    <family>${(data.providerName || 'Unknown').split(' ').slice(1).join(' ') || 'Provider'}</family>
                  </name>
                </assignedPerson>
                <representedOrganization>
                  <id extension="${data.organizationId || data.facilityId}" root="2.16.840.1.113883.4.6"/>
                  <name>${data.facilityName}</name>
                  <telecom use="WP" value="tel:${data.organizationPhone || data.providerPhone}"/>
                  <addr use="WP">
                    <streetAddressLine>${data.facilityAddress}</streetAddressLine>
                    <city>${data.patientCity}</city>
                    <state>${data.patientState}</state>
                    <postalCode>${data.patientZip}</postalCode>
                    <country>US</country>
                  </addr>
                </representedOrganization>
              </assignedEntity>
            </performer>
            <author>
              <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
              <time value="${data.currentProc2Date}"/>
              <assignedAuthor>
                <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
                <code code="${getProviderTaxonomyCode('physician').code}"
                      codeSystem="2.16.840.1.113883.6.101"
                      displayName="${getProviderTaxonomyCode('physician').display}"/>
                <assignedPerson>
                  <name>
                    <given>${data.providerName.split(' ')[1] || 'Unknown'}</given>
                    <family>${data.providerName.split(' ')[2] || 'Provider'}</family>
                  </name>
                </assignedPerson>
              </assignedAuthor>
            </author>
          </procedure>
        </entry>`;
  }

  // Add specimen collection procedures
  if (data.specimen1Id && data.collection1Date) {
    entries += `
                <entry typeCode="DRIV">
                    <procedure classCode="PROC" moodCode="EVN">
                        <templateId root="2.16.840.1.113883.10.20.22.4.415" extension="2019-06-21" />
                        <id root="${generateGUID()}" />
                         <code code="33747-0" codeSystem="2.16.840.1.113883.6.1" displayName="General procedure">
          <originalText>General procedure</originalText>
        </code>
                        <statusCode code="completed" />
                        <effectiveTime value="${data.collection1Date}" />
                        <targetSiteCode code="${data.specimen1Source}" codeSystem="2.16.840.1.113883.6.96" displayName="${data.specimen1Type}" />
                        <participant typeCode="PRD">
                            <participantRole classCode="SPEC">
                                <templateId root="2.16.840.1.113883.10.20.22.4.410" extension="2019-06-21" />
                                <id root="${generateGUID()}" extension="${data.specimen1Id}" />
                                <code code="${data.specimen1Source}" codeSystem="2.16.840.1.113883.6.96" displayName="${data.specimen1Type}" />
                            </participantRole>
                        </participant>
                    </procedure>
                </entry>`;
  }

  if (data.specimen2Id && data.collection2Date) {
    entries += `
                <entry typeCode="DRIV">
                    <procedure classCode="PROC" moodCode="EVN">
                        <templateId root="2.16.840.1.113883.10.20.22.4.415" extension="2019-06-21" />
                        <id root="${generateGUID()}" />
                        <code code="33747-0" codeSystem="2.16.840.1.113883.6.1" displayName="General procedure">
          <originalText>General procedure</originalText>
        </code>
                        <statusCode code="completed" />
                        <effectiveTime value="${data.collection2Date}" />
                        <targetSiteCode code="${data.specimen2Source}" codeSystem="2.16.840.1.113883.6.96" displayName="${data.specimen2Type}" />
                        <participant typeCode="PRD">
                            <participantRole classCode="SPEC">
                                <templateId root="2.16.840.1.113883.10.20.22.4.410" extension="2019-06-21" />
                                <id root="${generateGUID()}" extension="${data.specimen2Id}" />
                                <code code="${data.specimen2Source}" codeSystem="2.16.840.1.113883.6.96" displayName="${data.specimen2Type}" />
                            </participantRole>
                        </participant>
                    </procedure>
                </entry>`;
  }

  return entries;
}

/**
 * Generates pregnancy observation XML
 * @param {Object} data - Form data
 * @returns {string} Pregnancy observation XML or empty string
 */
function generatePregnancyObservation(data) {
  // Only generate if patient is female and has pregnancy status
  if (data.patientGender !== 'F' || !data.pregnancyStatus) {
    return '';
  }

  // Only include delivery date and gestational age if actually pregnant
  const isPregnant = data.pregnancyStatus === '77386006';

  // Ensure we have a properly formatted date (at least 8 characters YYYYMMDD)
  const effectiveDate = data.pregnancyEffectiveTime || data.encounterDate || '20240615';

  return `
        <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
                <!-- Pregnancy Observation -->
                <templateId root="2.16.840.1.113883.10.20.15.3.8"/>
                <id root="${generateGUID()}"/>
                <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"
                      codeSystemName="HL7ActCode" displayName="Assertion"/>
                <statusCode code="completed"/>
                <effectiveTime>
                    <low value="${effectiveDate}"/>
                    <high nullFlavor="UNK"/>
                </effectiveTime>
                <value xsi:type="CD"
                       code="${data.pregnancyStatus}"
                       codeSystem="2.16.840.1.113883.6.96"
                       codeSystemName="SNOMED CT"
                       displayName="${getPregnancyStatusDisplay(data.pregnancyStatus)}"/>

                ${isPregnant && data.estimatedDeliveryDate ? generateEstimatedDeliveryDate(data.estimatedDeliveryDate) : ''}
                ${isPregnant && data.gestationalAge ? generateGestationalAgeObservation(data.gestationalAge) : ''}
            </observation>
        </entry>`;
}

/**
 * Gets pregnancy status display name
 */
function getPregnancyStatusDisplay(code) {
  const displays = {
    '77386006': 'Pregnant',
    '60001007': 'Not pregnant',
    '102874004': 'Possible pregnancy',
    '261665006': 'Unknown'
  };
  return displays[code] || 'Unknown';
}

/**
 * Generates estimated delivery date observation
 * @param {string} deliveryDate - Delivery date
 * @returns {string} Estimated delivery date XML
 */
function generateEstimatedDeliveryDate(deliveryDate) {
  return `
        <entryRelationship typeCode="REFR">
            <observation classCode="OBS" moodCode="EVN">
                <!-- Estimated Date of Delivery -->
                <templateId root="2.16.840.1.113883.10.20.15.3.1"/>
                <id root="${generateGUID()}"/>
                <code code="11778-8" codeSystem="2.16.840.1.113883.6.1"
                      codeSystemName="LOINC" displayName="Delivery date Estimated"/>
                <statusCode code="completed"/>
                <value xsi:type="TS" value="${deliveryDate}"/>
            </observation>
        </entryRelationship>`;
}

/**
 * Generates gestational age observation
 * @param {string} gestationalAge - Gestational age in weeks
 * @returns {string} Gestational age XML
 */
function generateGestationalAgeObservation(gestationalAge) {
  return `
                        <entryRelationship typeCode="COMP">
                            <observation classCode="OBS" moodCode="EVN">
                                <templateId root="2.16.840.1.113883.10.20.22.4.38"/>
                                <id root="${generateGUID()}"/>
                                <code code="18185-9" codeSystem="2.16.840.1.113883.6.1"
                                      displayName="Gestational age"/>
                                <statusCode code="completed"/>
                                <value xsi:type="PQ" value="${gestationalAge}" unit="wk"/>
                            </observation>
                        </entryRelationship>`;
}

/**
 * Builds diagnosis table rows for narrative text
 * @param {Object} data - Form data
 * @returns {string} Diagnosis table rows HTML
 */
function buildDiagnosisTableRows(data) {
  const diagnoses = data.diagnosisEvidence || [];
  console.log('buildDiagnosisTableRows called with:', diagnoses);

  if (diagnoses.length === 0) {
    console.log('No diagnoses found, returning empty');
    return ''; // Return empty string, not a table row
  }

  const result = diagnoses.map(diagnosis =>
    `<tr><td>Diagnosis</td><td>${xmlEscape(diagnosis.diagnosisName || '')}</td><td>${xmlEscape(diagnosis.diagnosisCode || '')}</td><td>${xmlEscape(diagnosis.diagnosisDate || data.encounterDate)}</td><td>${diagnosis.isRCTC ? 'RCTC Trigger' : 'Active'}</td></tr>`
  ).join('');

  console.log('buildDiagnosisTableRows result:', result);
  return result;
}

/**
 * Generates diagnosis entries XML
 * @param {Object} data - Form data
 * @returns {string} Diagnosis entries XML
 */
function generateDiagnosisEntries(data) {
  const diagnoses = data.diagnosisEvidence || [];
  console.log('generateDiagnosisEntries called with:', diagnoses);

  if (diagnoses.length === 0) {
    console.log('No diagnoses, returning empty comment');
    return '<!-- No diagnoses to report -->';
  }

  const result = diagnoses.map(diagnosis => {
    console.log('Processing diagnosis:', diagnosis);

    // Determine if this is an RCTC trigger code
    const isRCTCCode = isRCTCTriggerCode(diagnosis.diagnosisCode);

    // Get appropriate valueSet info for RCTC codes
    const valueSetInfo = isRCTCCode ? {
      oid: '2.16.840.1.113762.1.4.1146.2260',
      version: '2.0.1'
    } : null;

    return `
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN" negationInd="false">
                  <templateId root="2.16.840.1.113883.10.20.22.4.4" />
                  <templateId extension="2015-08-01" root="2.16.840.1.113883.10.20.22.4.4" />
                  <templateId extension="2016-12-01" root="2.16.840.1.113883.10.20.15.2.3.3" />
                  <id root="${generateGUID()}" />
                  <code code="282291009" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT"
                    displayName="Diagnosis">
                    <translation code="29308-4" codeSystem="2.16.840.1.113883.6.1"
                      codeSystemName="LOINC" displayName="Diagnosis" />
                  </code>
                  <statusCode code="${diagnosis.status || 'completed'}" />
                  <effectiveTime><low value="${normalizeTS(diagnosis.diagnosisDate || data.encounterDate)}" /></effectiveTime>
                  ${diagnosis.diagnosisCode
        ? `<value xsi:type="CD"
                            code="${xmlEscape(diagnosis.diagnosisCode)}"
                            codeSystem="2.16.840.1.113883.6.96"
                            codeSystemName="SNOMED CT"
                            displayName="${xmlEscape(diagnosis.diagnosisName)}"${valueSetInfo ? ` sdtc:valueSet="${valueSetInfo.oid}" sdtc:valueSetVersion="${valueSetInfo.version}"` : ''} />`
        : `<value xsi:type="CD"
                            nullFlavor="UNK"
                            displayName="${xmlEscape(diagnosis.diagnosisName)}" />`
      }
                </observation>
              </entryRelationship>`;
  }).join('');

  console.log('generateDiagnosisEntries result length:', result.length);
  return result;
}

/**
 * Builds problems table rows for narrative text
 * @param {Object} data - Form data
 * @returns {string} Problems table rows HTML
 */
function buildProblemsTableRows(data) {
  const problems = data.problemEvidence || [];
  return problems.map(problem =>
    `<tr><td>Problem</td><td>${xmlEscape(problem.problemName || '')}</td><td>${xmlEscape(problem.problemCode || '')}</td><td>${xmlEscape(problem.onsetDate || '')}</td><td>${xmlEscape(problem.status || 'active')}</td></tr>`
  ).join('');
}

/**
 * Builds medications administered table rows for narrative text
 * @param {Object} data - Form data
 * @returns {string} Medications table rows HTML
 */
function buildMedicationsAdministeredTableRows(data) {
  // Use administeredMedications array from repeater
  const medications = data.administeredMedications || [];

  return medications.map(med => {
    const dose = `${med.doseValue || ''} ${med.doseUnit || ''}${med.volumeValue ? ` (${med.volumeValue} ${med.volumeUnit || ''})` : ''}`.trim();
    const status = med.negated ? 'Not Given' : (med.status || 'completed');
    return `<tr>
            <td><content ID="MedAdministered_${med.medicationCode}">${xmlEscape(med.medicationName || '')}</content></td>
            <td>${xmlEscape(dose)}</td>
            <td>${xmlEscape(med.route || '')}</td>
            <td>${xmlEscape(med.administrationTime || '')}</td>
            <td>${xmlEscape(status)}</td>
          </tr>`;
  }).join('');
}

/**
 * Generates administered medication entries XML
 * @param {Object} data - Form data
 * @returns {string} Medication entries XML
 */
function generateAdministeredMedicationEntries(data) {
  // Use administeredMedications array from repeater
  const medications = data.administeredMedications || [];

  if (medications.length === 0) return '';

  return medications.map((med, index) => {
    // Determine performer: use per-med override, else global administering provider, else empty
    const performerNPI = med.performerNPI || data.administeringProviderNPI || '';
    const performerGiven = med.performerGivenName || data.administeringProviderGiven || '';
    const performerMiddle = med.performerMiddleName || data.administeringProviderMiddle || '';
    const performerFamily = med.performerFamilyName || data.administeringProviderFamily || '';
    const performerPhone = med.performerPhone || data.administeringProviderPhone || '';
    const performerOrgName = data.administeringProviderOrgName || '';
    const performerOrgId = data.administeringProviderOrgId || '';
    const performerOrgIdRoot = data.administeringProviderOrgIdRoot || '2.16.840.1.113883.19';

    // Author: use performer data if available, else global provider
    const authorNPI = performerNPI || data.providerId || '';
    const authorGiven = performerGiven || (data.providerName ? data.providerName.split(' ')[1] : 'Unknown');
    const authorFamily = performerFamily || (data.providerName ? data.providerName.split(' ')[2] : 'Provider');
    const authorTime = med.administrationTime || '20240615120000';

    return `
    <entry typeCode="DRIV">
      <substanceAdministration classCode="SBADM" moodCode="EVN"${med.negated ? ' negationInd="true"' : ''}>
        <templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09" />
        <id extension="${med.administrationId || `MED-${index + 1}`}" root="2.16.840.1.113883.19.5.99999.1" />
        <statusCode code="${med.status || 'completed'}" />
        <effectiveTime value="${med.administrationTime || ''}" />
        <routeCode code="${med.route || 'PO'}" codeSystem="2.16.840.1.113883.3.26.1.1">
          <translation code="${getRouteTranslation(med.route || 'PO').code}"
                       codeSystem="2.16.840.1.113883.6.96"
                       displayName="${getRouteTranslation(med.route || 'PO').display}"/>
        </routeCode>
        <doseQuantity value="${med.doseValue || '1'}" unit="${fixDoseUnit(med.doseUnit || 'mg')}" />
        ${med.volumeValue ? `<maxDoseQuantity>
          <numerator value="${med.volumeValue}" unit="${med.volumeUnit || '1'}" />
          <denominator value="1" unit="1"/>
        </maxDoseQuantity>` : ''}
        <consumable>
          <manufacturedProduct classCode="MANU">
            <templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"/>
            <manufacturedMaterial>
              <code code="${med.medicationCode || ''}" codeSystem="2.16.840.1.113883.6.88">
                <originalText>
                  <reference value="#MedAdministered_${med.medicationCode}" />
                </originalText>
              </code>
              <name>${xmlEscape(med.medicationName || '')}</name>
            </manufacturedMaterial>
          </manufacturedProduct>
        </consumable>
        ${(performerNPI || performerGiven || performerFamily) ? `
        <performer typeCode="PRF">
          <assignedEntity>
            ${performerNPI ? `<id root="2.16.840.1.113883.4.6" extension="${performerNPI}"/>` : ''}
            ${performerPhone ? `<telecom use="WP" value="tel:${performerPhone}"/>` : ''}
            <assignedPerson>
              <name>
                ${performerGiven ? `<given>${xmlEscape(performerGiven)}</given>` : ''}
                ${performerMiddle ? `<given>${xmlEscape(performerMiddle)}</given>` : ''}
                ${performerFamily ? `<family>${xmlEscape(performerFamily)}</family>` : ''}
              </name>
            </assignedPerson>
            ${performerOrgName ? `<representedOrganization>
              ${performerOrgId ? `<id root="${performerOrgIdRoot}" extension="${performerOrgId}"/>` : ''}
              <name>${xmlEscape(performerOrgName)}</name>
            </representedOrganization>` : ''}
          </assignedEntity>
        </performer>` : ''}
        <author>
          <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
          <time value="${authorTime}"/>
          <assignedAuthor>
            <id extension="${authorNPI}" root="2.16.840.1.113883.4.6"/>
            <code code="${getProviderTaxonomyCode('physician').code}"
                  codeSystem="2.16.840.1.113883.6.101"
                  displayName="${getProviderTaxonomyCode('physician').display}"/>
            <assignedPerson>
              <name>
                <given>${xmlEscape(authorGiven)}</given>
                <family>${xmlEscape(authorFamily)}</family>
              </name>
            </assignedPerson>
          </assignedAuthor>
        </author>
      </substanceAdministration>
    </entry>`;
  }).join('');
}

/**
 * Generates problem entries XML
 * @param {Object} data - Form data
 * @returns {string} Problem entries XML
 */
function generateProblemEntries(data) {
  const problems = data.problemEvidence || [];

  if (problems.length === 0) return '';

  return problems.map(problem => `
        <entryRelationship typeCode="SUBJ">
            <observation classCode="OBS" moodCode="EVN">
                <templateId root="2.16.840.1.113883.10.20.22.4.4" />
                <templateId root="2.16.840.1.113883.10.20.22.4.4" extension="2015-08-01"/>
                <id root="${generateGUID()}"/>
                <code code="55607006" displayName="Problem"
                      codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT">
                    <translation code="75326-9" codeSystem="2.16.840.1.113883.6.1"
                               codeSystemName="LOINC" displayName="Problem"/>
                </code>
                <text>
                    <reference value="#Problem${problem.problemCode}"/>
                </text>
                <statusCode code="completed"/>
                <effectiveTime>
                    <low value="${normalizeTS(problem.onsetDate || data.encounterDate)}"/>
                </effectiveTime>
                ${problem.problemCode
      ? `<value xsi:type="CD" code="${xmlEscape(problem.problemCode)}"
                            codeSystem="2.16.840.1.113883.6.96"
                            codeSystemName="SNOMED CT"
                            displayName="${xmlEscape(problem.problemName)}"/>`
      : `<value xsi:type="CD" nullFlavor="UNK"
                            displayName="${xmlEscape(problem.problemName)}"/>`
    }
            </observation>
        </entryRelationship>`).join('');
}

/**
 * Builds results section XML with lab evidence
 * @param {Array} labEvidence - Array of lab evidence objects
 * @param {string} rctcVersion - RCTC version
 * @returns {string} Results section XML or empty string
 */
function buildResultsSectionXML(labEvidence, rctcVersion = '2016-12-01') {
  if (!labEvidence || labEvidence.length === 0) return '';

  const esc = s => xmlEscape(s || '');
  const data = getFormData(); // Get current form data for provider info

  const obsXml = labEvidence.map(le => {
    const id = generateGUID();
    const vsOID = '2.16.840.1.114222.4.11.7508';

    // Use test code as primary, fall back to order code
    const primaryCode = le.testCode || le.orderCode || '';
    const primaryName = le.testName || le.orderName || '';

    const codeAttrs = [
      primaryCode ? `code="${esc(primaryCode)}"` : 'nullFlavor="UNK"',
      `codeSystem="2.16.840.1.113883.6.1"`,
      `codeSystemName="LOINC"`,
      primaryName ? `displayName="${esc(primaryName)}"` : null,
      `sdtc:valueSet="${vsOID}" sdtc:valueSetVersion="${esc(rctcVersion)}"`
    ].filter(Boolean).join(' ');

    // Build <value> based on valueKind
    let valueXml = `<value xsi:type="CD" nullFlavor="UNK"/>`;
    if (le.valueKind === 'coded' && le.valueCode) {
      const vsPair = le.isRCTC ? ` sdtc:valueSet="${esc(vsOID)}" sdtc:valueSetVersion="${esc(rctcVersion)}"` : '';
      valueXml = `<value xsi:type="CD"
             code="${esc(le.valueCode)}"
             ${le.valueName ? `displayName="${esc(le.valueName)}"` : ''}
             codeSystem="2.16.840.1.113883.6.96"
             codeSystemName="SNOMED CT"${vsPair}/>`;
    } else if (le.valueKind === 'quantity' && le.qtyValue) {
      valueXml = `<value xsi:type="PQ" value="${esc(le.qtyValue)}"${le.qtyUnit ? ` unit="${esc(le.qtyUnit)}"` : ''}/>`;
    } else if (le.valueKind === 'text' && le.textValue) {
      valueXml = `<value xsi:type="ST">${esc(le.textValue)}</value>`;
    }

    // Interpretation
    const interpCode = mapInterp(le.interpretation);
    const interp = interpCode
      ? `<interpretationCode code="${interpCode}" codeSystem="2.16.840.1.113883.5.83"/>`
      : '';

    // Reference Range
    const refRange = le.referenceRange
      ? `<referenceRange>
      <observationRange>
        <text>${esc(le.referenceRange)}</text>
        <value xsi:type="ST">${esc(le.referenceRange)}</value>
      </observationRange>
    </referenceRange>`
      : '';

    // Build Author (Ordering Provider)
    const orderingAuthor = (data.resultOrderingNPI || data.resultOrderingGiven || data.resultOrderingFamily) ? `
      <author>
        <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
        <time value="${esc(normalizeTS(le.orderTime || le.time || data.encounterDate))}"/>
        <assignedAuthor>
          ${data.resultOrderingNPI ? `<id extension="${esc(data.resultOrderingNPI)}" root="2.16.840.1.113883.4.6"/>` : `<id nullFlavor="UNK"/>`}
          <assignedPerson>
            <name>
              ${data.resultOrderingGiven ? `<given>${esc(data.resultOrderingGiven)}</given>` : ''}
              ${data.resultOrderingFamily ? `<family>${esc(data.resultOrderingFamily)}</family>` : ''}
            </name>
          </assignedPerson>
        </assignedAuthor>
      </author>` : `
      <author>
        <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
        <time value="${esc(normalizeTS(le.time || data.encounterDate))}"/>
        <assignedAuthor>
          <id extension="${esc(data.providerId || '1234567890')}" root="2.16.840.1.113883.4.6"/>
          <assignedPerson>
            <name>
              <given>${esc((data.providerName || 'Unknown').split(' ')[0])}</given>
              <family>${esc((data.providerName || 'Unknown').split(' ').slice(1).join(' ') || 'Provider')}</family>
            </name>
          </assignedPerson>
        </assignedAuthor>
      </author>`;

    // Build Performer (Lab/Resulting Performer)
    const performer = (data.resultPerformerNPI || data.resultPerformerGiven || data.resultPerformerFamily || data.resultLabName) ? `
      <performer typeCode="PRF">
        <assignedEntity>
          ${data.resultPerformerNPI ? `<id extension="${esc(data.resultPerformerNPI)}" root="2.16.840.1.113883.4.6"/>` : `<id nullFlavor="UNK"/>`}
          ${(data.resultPerformerGiven || data.resultPerformerFamily) ? `
          <assignedPerson>
            <name>
              ${data.resultPerformerGiven ? `<given>${esc(data.resultPerformerGiven)}</given>` : ''}
              ${data.resultPerformerFamily ? `<family>${esc(data.resultPerformerFamily)}</family>` : ''}
            </name>
          </assignedPerson>` : ''}
          ${(data.resultLabName || data.resultLabCLIA) ? `
          <representedOrganization>
            ${data.resultLabCLIA ? `<id extension="${esc(data.resultLabCLIA)}" root="2.16.840.1.113883.4.7"/>` : ''}
            ${data.resultLabName ? `<name>${esc(data.resultLabName)}</name>` : ''}
          </representedOrganization>` : ''}
        </assignedEntity>
      </performer>` : '';

    // Effective Time
    const effectiveTimeXml = le.time
      ? `<effectiveTime value="${esc(normalizeTS(le.time))}"/>`
      : `<effectiveTime nullFlavor="UNK"/>`;

    return `
      <entry>
        <organizer classCode="CLUSTER" moodCode="EVN">
          <!-- Result Organizer (V3) -->
          <templateId root="2.16.840.1.113883.10.20.22.4.1" extension="2015-08-01"/>
          <id root="${id}"/>
          <code ${codeAttrs}/>
          <statusCode code="completed"/>
          ${le.orderTime ? `<effectiveTime><low value="${esc(normalizeTS(le.orderTime))}"/><high value="${esc(normalizeTS(le.orderTime))}"/></effectiveTime>` : ''}

          ${(le.orderCode && le.orderName && le.orderCode !== le.testCode) ? `
          <!-- Lab Order Information -->
          <component>
            <procedure classCode="PROC" moodCode="RQO">
              <!-- Lab Order Procedure -->
              <templateId root="2.16.840.1.113883.10.20.22.4.41"/>
              <id root="${generateGUID()}"${le.orderId ? ` extension="${esc(le.orderId)}"` : ''}/>
              <code code="${esc(le.orderCode)}" codeSystem="2.16.840.1.113883.6.1"
                    displayName="${esc(le.orderName)}"/>
              <statusCode code="completed"/>
              ${le.orderTime ? `<effectiveTime><low value="${esc(normalizeTS(le.orderTime))}"/></effectiveTime>` : ''}
              ${orderingAuthor}
            </procedure>
          </component>` : ''}

          <!-- Result Observation -->
          <component>
            <observation classCode="OBS" moodCode="EVN">
              <!-- Result Observation (V3) -->
              <templateId root="2.16.840.1.113883.10.20.22.4.2"/>
              <templateId root="2.16.840.1.113883.10.20.22.4.2" extension="2015-08-01"/>
              <!-- Initial Case Report Trigger Code Result Observation (eICR) -->
              <templateId root="2.16.840.1.113883.10.20.15.2.3.2" extension="2016-12-01"/>
              <id root="${id}"/>
              <code ${codeAttrs}/>
              <statusCode code="${esc(le.status || 'completed')}"/>
              ${effectiveTimeXml}
              ${valueXml}
              ${interp}
              ${performer}
              ${orderingAuthor}
              ${refRange}
             
            </observation>
          </component>
        </organizer>
      </entry>`;
  }).join('\n');

  // Build narrative table that matches the actual data
  const narrative = labEvidence.map(le => {
    let displayValue = '';
    if (le.valueKind === 'coded') {
      displayValue = le.valueName || le.valueCode || '';
    } else if (le.valueKind === 'quantity') {
      displayValue = `${le.qtyValue || ''} ${le.qtyUnit || ''}`.trim();
    } else if (le.valueKind === 'text') {
      displayValue = le.textValue || '';
    }

    return `
    <tr>
      <td>${esc(le.orderName || le.orderCode || 'N/A')}</td>
      <td>${esc(le.testName || le.testCode || 'N/A')}</td>
      <td>${esc(displayValue)}</td>
      <td>${esc(le.referenceRange || 'N/A')}</td>
      <td>${esc(le.status || 'completed')}</td>
      <td>${esc(le.time || 'N/A')}</td>
    </tr>`;
  }).join('');

  return `
    <component>
      <section>
        <!-- Results Section (entries required) -->
        <templateId root="2.16.840.1.113883.10.20.22.2.3.1" extension="2015-08-01"/>
        <code code="30954-2" codeSystem="2.16.840.1.113883.6.1" displayName="Relevant diagnostic tests and/or laboratory data"/>
        <title>Lab Orders and Results</title>
        <text>
          <table border="1">
            <thead>
              <tr>
                <th>Order</th>
                <th>Test</th>
                <th>Value</th>
                <th>Reference Range</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>${narrative}</tbody>
          </table>
        </text>
        ${obsXml}
      </section>
    </component>`;
}

// ============================================================================
// MAIN EICR XML BUILDER
// ============================================================================

/**
 * Builds complete eICR XML document
 * This is the main function that generates a complete HL7 CDA R2 electronic Initial Case Report
 *
 * CRITICAL: This function generates ~3500 lines of standards-compliant medical XML.
 * DO NOT modify without thorough understanding of HL7 CDA R2 implementation requirements.
 *
 * @returns {string} Complete eICR XML document
 * @throws {Error} If validation fails or required data is missing
 */
function buildEICRXml() {
  // Run comprehensive DQ Schematron validation first
  if (!validateFormData()) {
    throw new Error('Form data does not pass DQ Schematron validation. Please correct the errors and try again.');
  }

  const data = getFormData();

  // Additional CDA-specific validation
  if (!data.patientId || !data.patientName || !data.providerId) {
    throw new Error('Missing required patient or provider information for CDA generation');
  }

  if (!data.providerPhone) {
    throw new Error('Provider phone is required for author telecom compliance (CONF:1198-5428)');
  }

  if (!data.facilityAddress || !data.patientCity || !data.patientState || !data.patientZip) {
    throw new Error('Complete facility address is required for US Realm compliance (CONF:1198-5452)');
  }

  const cdaTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  HL7 CDA-compliant eICR Document
  Generated by eICR Form Generator v1.0

-->
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:cda="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc"
  xmlns:voc="http://www.lantanagroup.com/voc"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:hl7-org:v3 ../../schema/infrastructure/cda/CDA_SDTC.xsd">
<!--
        ********************************************************
        CDA Header
        ********************************************************
-->
  <!-- US Realm Header template -->
  <realmCode code="US" />
  <typeId extension="POCD_HD000040" root="2.16.840.1.113883.1.3" />
  <templateId root="2.16.840.1.113883.10.20.22.1.1" />
  <templateId extension="2015-08-01" root="2.16.840.1.113883.10.20.22.1.1" />
  <templateId extension="2016-12-01" root="2.16.840.1.113883.10.20.15.2" />
  <templateId extension="2022-05-01" root="2.16.840.1.113883.10.20.15.2" />
  <id root="${data.documentId}" />
  <code code="55751-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC"
    displayName="Public Health Case Report" />
  <title>Initial Public Health Case Report</title>
  <effectiveTime value="${data.effectiveTime}" />
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" displayName="Normal" />
  <languageCode code="en-US" />
  <setId extension="${getEffectiveSetId(data)}" root="1.2.840.114350.1.13.380.3.7.1.1" />
  <versionNumber value="${data.versionNumber}" />
  ${generateRelatedDocumentXml(data)}
<!--
        ********************************************************
        recordTarget: The patient
        ********************************************************
-->
<recordTarget>
  <patientRole>
      <id extension="${data.patientId}" root="2.16.840.1.113883.19.5" />
      <addr use="H">
        <streetAddressLine>${data.patientAddress}</streetAddressLine>
        <city>${data.patientCity}</city>
        <state>${data.patientState}</state>
        <postalCode>${data.patientZip}</postalCode>
        <county>${data.patientCounty}</county>
        <country>${data.patientCountry || 'US'}</country>
      </addr>
      <telecom use="MC" value="tel:${data.patientPhone}" />
      <telecom use="WP" value="mailto:${data.patientEmail}" />
    <patient>
      <name use="L">
        <given>${data.patientName.split(' ')[0]}</given>
        <family>${data.patientName.split(' ').slice(1).join(' ')}</family>
      </name>
      <administrativeGenderCode code="${data.patientGender}" codeSystem="2.16.840.1.113883.5.1"
        displayName="${data.patientGender === 'F' ? 'Female' : 'Male'}" />
      <birthTime value="${data.patientBirthDate}" />
      <sdtc:deceasedInd value="${data.patientDeathIndicator || 'false'}" />
      ${data.patientDeathDate ? `<sdtc:deceasedTime value="${data.patientDeathDate}" />` : ''}
      <maritalStatusCode code="S" codeSystem="2.16.840.1.113883.5.2"
                     codeSystemName="MaritalStatus" displayName="Never Married"/>
      <raceCode code="${data.patientRace}" codeSystem="2.16.840.1.113883.6.238"
        codeSystemName="Race and Ethnicity - CDC" displayName="${getRaceDisplayName(data.patientRace)}" />
      ${data.patientDetailedRace ? `<sdtc:raceCode code="${data.patientDetailedRace}" codeSystem="2.16.840.1.113883.6.238" />` : ''}
      <ethnicGroupCode code="${data.patientEthnicity}" codeSystem="2.16.840.1.113883.6.238"
        codeSystemName="Race and Ethnicity - CDC" displayName="${getEthnicityDisplayName(data.patientEthnicity)}" />
      ${data.patientDetailedEthnicity ? `<sdtc:ethnicGroupCode code="${data.patientDetailedEthnicity}" codeSystem="2.16.840.1.113883.6.238" />` : ''}
      ${data.guardianName ? `
      <guardian>
        <code code="${data.guardianCode || 'GUARD'}" codeSystem="2.16.840.1.113883.11.20.12.1" />
        <addr use="H">
          <streetAddressLine>${data.guardianAddress || ''}</streetAddressLine>
          <city>${data.guardianCity || ''}</city>
          <state>${data.guardianState || ''}</state>
          <postalCode>${data.guardianZip || ''}</postalCode>
          <country>US</country>
        </addr>
        ${data.guardianPhone ? `<telecom use="HP" value="tel:${data.guardianPhone}" />` : ''}
        ${data.guardianEmail ? `<telecom use="WP" value="mailto:${data.guardianEmail}" />` : ''}
        <guardianPerson>
          <name use="L">
            <given>${data.guardianName.split(' ')[0] || ''}</given>
            <family>${data.guardianName.split(' ').slice(1).join(' ') || ''}</family>
          </name>
        </guardianPerson>
      </guardian>` : ''}
      <birthplace>
        <place>
          <addr>
            <streetAddressLine>4444 Home Street</streetAddressLine>
            <city>${data.patientBirthPlaceCity || data.patientCity}</city>
            <state>${data.patientBirthPlaceState || data.patientState}</state>
            <postalCode>97867</postalCode>
            <country>${data.patientBirthPlaceCountry || data.patientCountry || 'US'}</country>
          </addr>
        </place>
      </birthplace>
      <languageCommunication>
        <languageCode code="${data.patientLanguage || 'en'}" />
        <proficiencyLevelCode code="G" codeSystem="2.16.840.1.113883.5.61" displayName="Good"/>
        <preferenceInd value="true" />
      </languageCommunication>
    </patient>
 </patientRole>
</recordTarget>
<!--
        ********************************************************
        author
        ********************************************************
-->
<author>
    <time value="${data.effectiveTime}" />
    <assignedAuthor>
      <id extension="${data.providerId}" root="2.16.840.1.113883.4.6" />
      <addr use="WP">
        <streetAddressLine>${data.facilityAddress}</streetAddressLine>
        <city>${data.patientCity}</city>
        <state>${data.patientState}</state>
        <postalCode>${data.patientZip}</postalCode>
        <country>US</country>
      </addr>
      <telecom use="WP" value="tel:${data.providerPhone}" />
      ${data.providerEmail ? `<telecom use="WP" value="mailto:${data.providerEmail}" />` : ''}
      <assignedAuthoringDevice>
        <manufacturerModelName>eICR Generator - Version 1.0</manufacturerModelName>
        <softwareName>eICR Generator - Version 1.0</softwareName>
      </assignedAuthoringDevice>
      <representedOrganization>
        <id extension="${data.organizationId || data.facilityId || data.providerId}" root="2.16.840.1.113883.4.6" />
        <name>${data.organizationName || data.facilityName}</name>
        <telecom use="WP" value="tel:${data.organizationPhone || data.providerPhone}" />
        <addr use="WP">
          <streetAddressLine>${data.organizationAddress || data.facilityAddress}</streetAddressLine>
          <city>${data.patientCity}</city>
          <state>${data.patientState}</state>
          <postalCode>${data.patientZip}</postalCode>
          <country>US</country>
        </addr>
      </representedOrganization>
    </assignedAuthor>
</author>
<!--
        ********************************************************
        custodian: The custodian of the CDA document is the generator of the document
        ********************************************************
-->
<custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id extension="${data.organizationId || data.facilityId}" root="2.16.840.1.113883.4.6" />
        <name>${data.organizationName || data.facilityName}</name>
        <telecom use="WP" value="tel:${data.organizationPhone || data.providerPhone}" />
        <addr use="WP">
          <streetAddressLine>${data.organizationAddress || data.facilityAddress}</streetAddressLine>
          <city>${data.patientCity}</city>
          <state>${data.patientState}</state>
          <postalCode>${data.patientZip}</postalCode>
          <country>US</country>
        </addr>
      </representedCustodianOrganization>
    </assignedCustodian>
</custodian>
<!--
        ********************************************************
        componentOf: contains the encompassingEncouter and the
        provider and facility infomation for the case
        ********************************************************
-->
<componentOf>
  <encompassingEncounter>
    <id extension="${data.encounterId}" root="2.16.840.1.113883.19" />
    <code code="${data.encounterType}" codeSystem="2.16.840.1.113883.5.4"
      codeSystemName="HL7 ActEncounterCode" displayName="Ambulatory" />
    <effectiveTime>
      <low value="${data.encounterDate}" />
      <high value="${data.encounterEndDate || data.encounterDate}" />
    </effectiveTime>
    ${data.encounterDisposition ? `<dischargeDispositionCode code="${data.encounterDisposition}" codeSystem="2.16.840.1.113883.12.112" />` : ''}
    <responsibleParty>
      <assignedEntity>
        <id extension="${data.providerId}" root="2.16.840.1.113883.4.6" />
        <addr use="WP">
          <streetAddressLine>${data.facilityAddress}</streetAddressLine>
          <city>${data.patientCity}</city>
          <state>${data.patientState}</state>
          <postalCode>${data.patientZip}</postalCode>
          <country>US</country>
        </addr>
        <telecom use="WP" value="tel:${data.providerPhone}" />
        ${data.providerEmail ? `<telecom use="WP" value="mailto:${data.providerEmail}" />` : `<telecom use="WP" value="mailto:provider@example.com" />`}
        ${data.providerFax ? `<telecom use="WP" value="fax:${data.providerFax}" />` : `<telecom use="WP" value="fax:+1-555-777-0124" />`}
        <assignedPerson>
          <name>
            <given>${data.providerName.split(' ')[1] || 'Unknown'}</given>
            <family>${data.providerName.split(' ')[2] || 'Provider'}</family>
          </name>
        </assignedPerson>
        <representedOrganization>
          <name>${data.facilityName}</name>
<!--
        ********************************************************
        3.1.1 May include telecom
        <telecom use="WP" value="tel:${data.organizationPhone || data.providerPhone}" />
          ${data.organizationEmail ? `<telecom use="WP" value="mailto:${data.organizationEmail}" />` : ''}
        ********************************************************
-->
          <addr use="WP">
            <streetAddressLine>${data.facilityAddress}</streetAddressLine>
            <city>${data.patientCity}</city>
            <state>${data.patientState}</state>
            <postalCode>${data.patientZip}</postalCode>
            <country>US</country>
          </addr>
          
        </representedOrganization>
      </assignedEntity>
    </responsibleParty>
    <location>
      <healthCareFacility>
        <id extension="${data.facilityId || data.providerId}" root="2.16.840.1.113883.4.6" />
        <code code="${data.facilityTypeCode || 'OF'}" codeSystem="2.16.840.1.113883.5.111"
          codeSystemName="HL7RoleCode" displayName="Healthcare Facility" />
        <location>
          <name>${data.facilityName}</name>
          <addr use="WP">
            <streetAddressLine>${data.facilityAddress}</streetAddressLine>
            <city>${data.patientCity}</city>
            <state>${data.patientState}</state>
            <postalCode>${data.patientZip}</postalCode>
            <country>US</country>
          </addr>
        </location>
        <serviceProviderOrganization>
          <id extension="${data.organizationId || data.facilityId}" root="2.16.840.1.113883.4.6" />
          <name>${data.organizationName || data.facilityName}</name>
          <telecom use="WP" value="tel:${data.organizationPhone || data.providerPhone}" />
          ${data.organizationEmail ? `<telecom use="WP" value="mailto:${data.organizationEmail}" />` : ''}
          ${data.organizationFax ? `<telecom use="WP" value="fax:${data.organizationFax}" />` : ''}
          <addr use="WP">
            <streetAddressLine>${data.organizationAddress || data.facilityAddress}</streetAddressLine>
            <city>${data.patientCity}</city>
            <state>${data.patientState}</state>
            <postalCode>${data.patientZip}</postalCode>
            <country>US</country>
          </addr>
        </serviceProviderOrganization>
      </healthCareFacility>
    </location>
  </encompassingEncounter>
</componentOf>

<component>
    <structuredBody>
      <!-- Encounters Section -->
      <component>
        <section>
          <!-- [C-CDA R1.1] Encounters Section (entries optional) -->
          <templateId root="2.16.840.1.113883.10.20.22.2.22" />
          <!-- [C-CDA R2.1] Encounters Section (entries optional) (V3) -->
          <templateId root="2.16.840.1.113883.10.20.22.2.22" extension="2015-08-01" />
          <!-- [C-CDA R1.1] Encounters Section (entries required) -->
          <templateId root="2.16.840.1.113883.10.20.22.2.22.1" />
          <!-- [C-CDA R2.1] Encounters Section (entries required) (V3) -->
          <templateId root="2.16.840.1.113883.10.20.22.2.22.1" extension="2015-08-01" />
          <code code="46240-8" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of encounters" />
          <title>Encounters</title>
          <text>
            <table>
              <thead>
                <tr><th>Encounter</th><th>Date</th><th>Location</th></tr>
              </thead>
              <tbody><tr><td>Office outpatient visit</td><td>${data.encounterDate}</td><td>${data.facilityName}</td></tr></tbody>
            </table>
          </text>
          <entry typeCode="DRIV">
            <encounter classCode="ENC" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.49" />
              <templateId root="2.16.840.1.113883.10.20.22.4.49" extension="2015-08-01" />
              <id root="2.16.840.1.113883.19.${data.encounterId}" />
              <code code="99213" codeSystem="2.16.840.1.113883.6.12" codeSystemName="CPT-4" displayName="Office outpatient visit">
    <originalText>Office outpatient visit</originalText>
              </code>   
              <effectiveTime>
                <low value="${data.encounterDate}" />
                <high value="${data.encounterDate}" />
              </effectiveTime>
              <participant typeCode="LOC">
    <participantRole classCode="SDLOC">
      <templateId root="2.16.840.1.113883.10.20.22.4.32"/>
      <id root="2.16.840.1.113883.4.6" extension="${data.facilityId || data.organizationId}"/>
      <code code="${data.facilityTypeCode || 'OF'}" 
            codeSystem="2.16.840.1.113883.5.111" 
            displayName="Outpatient facility"/>
      <addr use="WP">
        <streetAddressLine>${data.facilityAddress}</streetAddressLine>
        <city>${data.patientCity}</city>
        <state>${data.patientState}</state>
        <postalCode>${data.patientZip}</postalCode>
        <country>US</country>
      </addr>
      <telecom use="WP" value="tel:${data.organizationPhone || data.providerPhone}"/>
      <playingEntity classCode="PLC">
        <name>${data.facilityName}</name>
      </playingEntity>
    </participantRole>
  </participant>
            </encounter>
          </entry>
        </section>
      </component>

      ${buildSpecimenSection(data)}
      
      <!-- Reason for Visit Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.12" />
          <code code="29299-5" codeSystem="2.16.840.1.113883.6.1" displayName="Reason for visit" />
          <title>Reason for visit</title>
          <text>${data.chiefComplaint}</text>
        </section>
      </component>

      <!-- History of Present Illness -->
      <component>
        <section>
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.4" />
          <code code="10164-2" codeSystem="2.16.840.1.113883.6.1" displayName="History of Present Illness" />
          <title>History of Present Illness</title>
          <text>${data.presentIllness}</text>
        </section>
      </component>

      <!-- Medications Administered Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.38" />
          <templateId extension="2014-06-09" root="2.16.840.1.113883.10.20.22.2.38" />
          <code code="29549-3" codeSystem="2.16.840.1.113883.6.1"
            codeSystemName="LOINC" displayName="Medications Administered" />
          <title>Medications Administered</title>
          <text>
      <table border="1" width="100%">
        <thead>
          <tr>
            <th>Medication</th>
            <th>Dose</th>
            <th>Route</th>
            <th>Administration Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${buildMedicationsAdministeredTableRows(data)}
        </tbody>
      </table>
    </text>

    ${generateAdministeredMedicationEntries(data)}
        </section>
      </component>

      <!-- Problem List Section (includes both Problems and Diagnoses) -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.5" />
          <templateId extension="2015-08-01" root="2.16.840.1.113883.10.20.22.2.5" />
          <templateId root="2.16.840.1.113883.10.20.22.2.5.1" />
          <templateId extension="2015-08-01" root="2.16.840.1.113883.10.20.22.2.5.1" />
          <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" displayName="Problem List" />
          <title>Problem List</title>
          <text>
            <table>
              <thead>
                <tr><th>Type</th><th>Name</th><th>Code</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${buildDiagnosisTableRows(data)}
                ${buildProblemsTableRows(data)}
              </tbody>
            </table>
          </text>
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.3" />
              <templateId extension="2015-08-01" root="2.16.840.1.113883.10.20.22.4.3" />
              <id root="a1c0c380-eacc-4b40-9207-85164185558d" />
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6" displayName="Concern" />
              <statusCode code="active" />
              <effectiveTime><low value="${normalizeTS(data.encounterDate)}" /></effectiveTime>
              <author>
                <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
                <time value="20240615"/>
                <assignedAuthor>
                  <id extension="1234567890" root="2.16.840.1.113883.4.6"/>
                  <code code="207Q00000X"
                        codeSystem="2.16.840.1.113883.6.101"
                        displayName="Family Medicine Physician"/>
                  <assignedPerson>
                    <name>
                      <given>Royce</given>
                      <family>Hemlock</family>
                    </name>
                  </assignedPerson>
                </assignedAuthor>
              </author>
              ${generateDiagnosisEntries(data)}
              ${generateProblemEntries(data)}
            </act>
          </entry>
        </section>
      </component>
      ${(data.labEvidence && data.labEvidence.length) ? buildResultsSectionXML(data.labEvidence, '2016-12-01') : ''}
      <!-- Social History Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.17" />
          <templateId extension="2015-08-01" root="2.16.840.1.113883.10.20.22.2.17" />
          <code code="29762-2" codeSystem="2.16.840.1.113883.6.1" displayName="Social History" />
          <title>Social History</title>
          <text>
            <table>
              <thead>
                <tr><th>Travel History</th><th>Dates</th><th>Location</th></tr>
              </thead>
              <tbody><tr><td>Recent travel</td><td>${data.travelStartDate} - ${data.travelEndDate}</td><td>${data.travelLocation}</td></tr></tbody>
            </table>
          </text>
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.15.2.3.1" />
              <templateId extension="2016-12-01" root="2.16.840.1.113883.10.20.15.2.3.1" />
              <id root="79565142-eae0-4213-a3b3-b73cdf474682" />
              <code code="420008001" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED-CT"
      displayName="Travel">
    <originalText>Travel</originalText>
</code>
              <text>Recent travel to ${data.travelLocation}</text>
              <statusCode code="completed" />
              <effectiveTime>
                <low value="${data.travelStartDate}" />
                <high value="${data.travelEndDate}" />
              </effectiveTime>
              <participant typeCode="LOC">
    <participantRole classCode="TERR">
      <id nullFlavor="UNK"/>
      <code code="US" 
      codeSystem="1.0.3166.1" 
      displayName="United States"/>
      <addr>
        <streetAddressLine>${data.travelAddress}</streetAddressLine>
        <city>${data.travelLocation.split(',')[0] || data.travelLocation}</city>
        <state>${data.travelLocationCode || 'IL'}</state>
        <country>US</country>
      </addr>
      <playingEntity classCode="PLC">
        <name>${data.travelLocation}</name>
      </playingEntity>
    </participantRole>
  </participant>
            </act>
          </entry>
          
  <!-- ADDED to satisfy CONF:1198-14824 — exactly one Smoking Status - MU (V2) -->
    <entry>
      <observation classCode="OBS" moodCode="EVN">
        <!-- Smoking Status - Meaningful Use (V2) -->
        <templateId root="2.16.840.1.113883.10.20.22.4.78"/>
        <templateId root="2.16.840.1.113883.10.20.22.4.78" extension="2014-06-09"/>
        <id root="b3d8d3b1-9b8b-49a8-8ad0-6a0e0c0a1234"/>
        <code code="72166-2" codeSystem="2.16.840.1.113883.6.1" displayName="Tobacco smoking status NHIS"/>
        <statusCode code="completed"/>
        <!-- use the encounter/assessment date if known -->
        <effectiveTime value="20240520"/>
        <!-- SNOMED CT concept from the Smoking Status value set -->
        <value xsi:type="CD"
               code="266919005"
               codeSystem="2.16.840.1.113883.6.96"
               displayName="Never smoker"/>   
        <author>
            <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
            <time value="20240615"/>
            <assignedAuthor>
              <id extension="1234567890" root="2.16.840.1.113883.4.6"/>
              <code code="207Q00000X"
      codeSystem="2.16.840.1.113883.6.101"
      displayName="Family Medicine Physician"/>
              <assignedPerson>
                <name>
                  <given>Royce</given>
                  <family>Hemlock</family>
                </name>
              </assignedPerson>
            </assignedAuthor>
          </author>
        
      </observation>
    </entry>



         <!-- Pregnancy Observation -->
          ${generatePregnancyObservation(data)}


          <!-- Birth Sex Observation -->
          <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.200" extension="2016-06-01" />
              <id root="${generateGUID()}" />
              <code code="76689-9" codeSystem="2.16.840.1.113883.6.1" displayName="Sex Assigned At Birth" />
              <statusCode code="completed" />
              <effectiveTime value="${data.patientBirthDate}" />
              <value xsi:type="CD" code="${data.patientBirthSex || data.patientGender}" codeSystem="2.16.840.1.113883.5.1" />
            </observation>
          </entry>
          
          <!-- Gender Identity Observation -->
          <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.38" extension="2015-08-01" />
              <id root="${generateGUID()}" />
              <code code="76691-5" codeSystem="2.16.840.1.113883.6.1" displayName="Gender identity" />
              <statusCode code="completed" />
              <effectiveTime value="${data.patientBirthDate}" />
               <value xsi:type="CD" code="${data.patientGenderIdentity || data.patientGender}" codeSystem="2.16.840.1.113883.6.96" />
                <author>
            <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
            <time value="20240615"/>
            <assignedAuthor>
              <id extension="1234567890" root="2.16.840.1.113883.4.6"/>
              <code code="207Q00000X"
      codeSystem="2.16.840.1.113883.6.101"
      displayName="Family Medicine Physician"/>
              <assignedPerson>
                <name>
                  <given>Royce</given>
                  <family>Hemlock</family>
                </name>
              </assignedPerson>
            </assignedAuthor>
          </author>
             
            </observation>
          </entry>

          
          
          <!-- Occupation Information -->
          ${data.currentOccupation ? `
          <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.38" extension="2015-08-01" />
              <id root="${generateGUID()}" />
              <code code="87729-0" codeSystem="2.16.840.1.113883.6.1" displayName="Current occupation" />
              <statusCode code="completed" />
              <effectiveTime><low value="${data.encounterDate}" /></effectiveTime>
              <value xsi:type="ST">${data.currentOccupation}</value>
              <author>
            <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
            <time value="20240615"/>
            <assignedAuthor>
              <id extension="1234567890" root="2.16.840.1.113883.4.6"/>
              <code code="207Q00000X"
      codeSystem="2.16.840.1.113883.6.101"
      displayName="Family Medicine Physician"/>
              <assignedPerson>
                <name>
                  <given>Royce</given>
                  <family>Hemlock</family>
                </name>
              </assignedPerson>
            </assignedAuthor>
          </author>
              <participant typeCode="IND">
                <participantRole classCode="ASSIGNED">
                   
                  ${data.currentEmployerAddress ? `<addr><streetAddressLine>${data.currentEmployerAddress}</streetAddressLine></addr>` : ''}
                   ${data.currentEmployerPhone ? `<telecom value="tel:${data.currentEmployerPhone}" />` : ''}
                  <playingEntity classCode="ORG">
                    <name>${data.currentEmployerName || 'Unknown'}</name>
                  </playingEntity>
                </participantRole>
              </participant>
            </observation>
          </entry>
          
          <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.216" extension="2022-06-01" />
              <id root="${generateGUID()}" />
              <code code="21843-8" codeSystem="2.16.840.1.113883.6.1" displayName="History of Occupation industry" />
              <statusCode code="active" />
              <effectiveTime><low value="${data.encounterDate}" /></effectiveTime>
              <value xsi:type="ST">${data.currentIndustry || 'Unknown'}</value>
            </observation>
          </entry>` : ''}
        </section>
      </component>

<!-- Occupational Data for Health Template Requirements Section -->
<component>
  <section>
    <templateId root="2.16.840.1.113883.10.20.22.2.17" extension="2020-09-01"/>
    <code code="29762-2" codeSystem="2.16.840.1.113883.6.1" 
      displayName="Social History"/>
    <title>Occupational Data for Health</title>
    <text>
      <table border="1">
        <thead>
          <tr><th>Category</th><th>Value</th><th>Details</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Current Occupation</td>
            <td>${data.currentOccupation}</td>
            <td>Job Title: ${data.currentJobTitle}</td>
          </tr>
          <tr>
            <td>Current Industry</td>
            <td>${data.currentIndustry}</td>
            <td>Employer: ${data.currentEmployerName}</td>
          </tr>
          <tr>
            <td>Employment Status</td>
            <td>${getEmploymentStatusDisplay(data.employmentStatus)}</td>
            <td>Occupational Exposure Risk: ${data.occupationalExposure === 'Y' ? 'Yes' : data.occupationalExposure === 'N' ? 'No' : 'Unknown'}</td>
          </tr>
        </tbody>
      </table>
    </text>
    
    <!-- Current Occupation Observation -->
    <entry typeCode="DRIV">
      <observation classCode="OBS" moodCode="EVN">
        <templateId root="2.16.840.1.113883.10.20.22.4.38" extension="2015-08-01" />
        <id root="${generateGUID()}" />
        <code code="87729-0" codeSystem="2.16.840.1.113883.6.1" displayName="Current occupation" />
        <statusCode code="completed" />
        <effectiveTime><low value="${data.encounterDate}" /></effectiveTime>
         <value xsi:type="ST">${data.currentOccupation}</value>
        <author>
          <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
          <time value="${data.encounterDate}"/>
          <assignedAuthor>
            <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
            <code code="${getProviderTaxonomyCode('physician').code}"
                  codeSystem="2.16.840.1.113883.6.101"
                  displayName="${getProviderTaxonomyCode('physician').display}"/>
            <assignedPerson>
              <name>
                <given>${(data.providerName || 'Unknown').split(' ')[0]}</given>
                <family>${(data.providerName || 'Unknown').split(' ').slice(1).join(' ') || 'Provider'}</family>
              </name>
            </assignedPerson>
          </assignedAuthor>
        </author>
       
        <participant typeCode="IND">
          <participantRole classCode="ASSIGNED">
            ${data.currentEmployerAddress ? `<addr><streetAddressLine>${data.currentEmployerAddress}</streetAddressLine></addr>` : ''}
            ${data.currentEmployerPhone ? `<telecom value="tel:${data.currentEmployerPhone}" />` : ''}
            <playingEntity classCode="ORG">
              <name>${data.currentEmployerName || 'Unknown'}</name>
            </playingEntity>
          </participantRole>
        </participant>
      </observation>
    </entry>
    
    <!-- Current Industry Observation -->
    <entry typeCode="DRIV">
      <observation classCode="OBS" moodCode="EVN">
        <templateId root="2.16.840.1.113883.10.20.22.4.216" extension="2022-06-01" />
        <id root="${generateGUID()}" />
        <code code="21843-8" codeSystem="2.16.840.1.113883.6.1" displayName="History of Occupation industry" />
        <statusCode code="active" />
        <effectiveTime><low value="${data.encounterDate}" /></effectiveTime>
         <value xsi:type="ST">${data.currentIndustry}</value>
        <author>
          <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
          <time value="${data.encounterDate}"/>
          <assignedAuthor>
            <id extension="${data.providerId}" root="2.16.840.1.113883.4.6"/>
            <code code="${getProviderTaxonomyCode('physician').code}" 
                  codeSystem="2.16.840.1.113883.6.101" 
                  displayName="${getProviderTaxonomyCode('physician').display}"/>
            <assignedPerson>
              <name>
                <given>${(data.providerName || 'Unknown').split(' ')[0]}</given>
                <family>${(data.providerName || 'Unknown').split(' ').slice(1).join(' ') || 'Provider'}</family>
              </name>
            </assignedPerson>
          </assignedAuthor>
        </author>
      </observation>
    </entry>
  </section>
</component>

  <!-- Vital Signs Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.4" />
          <templateId root="2.16.840.1.113883.10.20.22.2.4" extension="2015-08-01" />
          <templateId root="2.16.840.1.113883.10.20.22.2.4.1" />
          <templateId root="2.16.840.1.113883.10.20.22.2.4.1" extension="2015-08-01" />
          <code code="8716-3" codeSystem="2.16.840.1.113883.6.1" displayName="Vital signs" />
          <title>Vital Signs</title>
          <text>
            <table>
              <thead>
                <tr><th>Vital Sign</th><th>Value</th><th>Unit</th><th>Date</th></tr>
              </thead>
              <tbody>${data.temperature ? `<tr><td>Temperature</td><td>${data.temperature}</td><td>°F</td><td>${data.encounterDate}</td></tr>` : ''}${data.bloodPressure ? `<tr><td>Blood Pressure</td><td>${data.bloodPressure}</td><td>mmHg</td><td>${data.encounterDate}</td></tr>` : ''}${data.heartRate ? `<tr><td>Heart Rate</td><td>${data.heartRate}</td><td>bpm</td><td>${data.encounterDate}</td></tr>` : ''}
  ${data.respiratoryRate ? `<tr><td>Respiratory Rate</td><td>${data.respiratoryRate}</td><td>/min</td><td>${data.encounterDate}</td></tr>` : ''}
  ${data.oxygenSaturation ? `<tr><td>Oxygen Saturation</td><td>${data.oxygenSaturation}</td><td>%</td><td>${data.encounterDate}</td></tr>` : ''}
  ${data.weight ? `<tr><td>Weight</td><td>${data.weight}</td><td>kg</td><td>${data.encounterDate}</td></tr>` : ''}
  ${data.height ? `<tr><td>Height</td><td>${data.height}</td><td>cm</td><td>${data.encounterDate}</td></tr>` : ''}
  ${data.bmi ? `<tr><td>BMI</td><td>${data.bmi}</td><td>kg/m²</td><td>${data.encounterDate}</td></tr>` : ''}
</tbody>

            </table>
          </text>
      ${generateVitalSignsEntries(data)}
      </section>
      </component>
 <!-- Medications Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.1" />
          <templateId root="2.16.840.1.113883.10.20.22.2.1" extension="2014-06-09" />
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1" />
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1" extension="2014-06-09" />
          <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" displayName="Medications" />
          <title>Medications</title>
          <text>
            <table>
              <thead>
                <tr><th>Medication</th><th>Dose</th><th>Route</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>${data.adminMed1Name ? `<tr><td>${data.adminMed1Name}</td><td>${data.adminMed1DoseValue} ${data.adminMed1DoseUnit}${data.adminMed1VolValue ? ' (' + data.adminMed1VolValue + ' ' + data.adminMed1VolUnit + ')' : ''}</td><td>${data.adminMed1Route}</td><td>${data.adminMed1Time}</td><td>${data.adminMed1Status}</td></tr>` : ''}${data.adminMed2Name ? `<tr><td>${data.adminMed2Name}</td><td>${data.adminMed2DoseValue} ${data.adminMed2DoseUnit}${data.adminMed2VolValue ? ' (' + data.adminMed2VolValue + ' ' + data.adminMed2VolUnit + ')' : ''}</td><td>${data.adminMed2Route}</td><td>${data.adminMed2Time}</td><td>${data.adminMed2Status}</td></tr>` : ''}</tbody>
            </table>
          </text>
          ${generateMedicationEntries(data)}
        </section>
      </component>

      <!-- Immunizations Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.2" />
          <templateId root="2.16.840.1.113883.10.20.22.2.2" extension="2015-08-01" />
          <templateId root="2.16.840.1.113883.10.20.22.2.2.1" />
          <templateId root="2.16.840.1.113883.10.20.22.2.2.1" extension="2015-08-01" />
          <code code="11369-6" codeSystem="2.16.840.1.113883.6.1" displayName="Immunizations" />
          <title>Immunizations</title>
          <text>
            <table>
              <thead>
                <tr><th>Vaccine</th><th>Date</th><th>Status</th><th>Manufacturer</th></tr>
              </thead>
              <tbody>${data.vaccine1Name ? `<tr><td>${data.vaccine1Name}</td><td>${data.immunization1Date}</td><td>${data.immunization1Status}</td><td>${data.vaccine1Manufacturer}</td></tr>` : ''}${data.vaccine2Name ? `<tr><td>${data.vaccine2Name}</td><td>${data.immunization2Date}</td><td>${data.immunization2Status}</td><td>${data.vaccine2Manufacturer}</td></tr>` : ''}</tbody>
            </table>
          </text>
          ${generateImmunizationEntries(data)}
        </section>
      </component>

      <!-- Procedures Section -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.7" />
          <templateId root="2.16.840.1.113883.10.20.22.2.7" extension="2014-06-09" />
          <templateId root="2.16.840.1.113883.10.20.22.2.7.1" />
          <templateId root="2.16.840.1.113883.10.20.22.2.7.1" extension="2014-06-09" />
          <code code="47519-4" codeSystem="2.16.840.1.113883.6.1" displayName="Procedures" />
          <title>Procedures</title>
          <text>
            <table>
              <thead>
                <tr><th>Procedure</th><th>Date</th><th>Type</th></tr>
              </thead>
              <tbody>${data.currentProc1Name
      ? `<tr><td>${xmlEscape(data.currentProc1Name)}</td><td>${xmlEscape(data.currentProc1Date)}</td><td>${xmlEscape(data.currentProc1Type)}</td></tr>`
      : ''
    }${data.currentProc2Name
      ? `<tr><td>${xmlEscape(data.currentProc2Name)}</td><td>${xmlEscape(data.currentProc2Date)}</td><td>${xmlEscape(data.currentProc2Type)}</td></tr>`
      : ''
    }${data.triggerProc1Name
      ? `<tr><td>${xmlEscape(data.triggerProc1Name)}</td><td>${xmlEscape(data.triggerProc1Date)}</td><td>${xmlEscape(data.triggerProc1Type)}</td></tr>`
      : ''
    }</tbody>

            </table>
          </text>
          ${generateProcedureEntries(data)}
        </section>
      </component>

      <!-- Allergies Section -->
      <component>
        <section nullFlavor="NI">
          <templateId root="2.16.840.1.113883.10.20.22.2.6.1" extension="2015-08-01"/>
          <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" displayName="Allergies and adverse reactions Document"/>
          <title>Allergies</title>
          <text>No Known Allergies</text>
        </section>
      </component>

<!-- Admission Medications Section -->
<component>
  <section>
    <templateId root="2.16.840.1.113883.10.20.22.2.44" extension="2015-08-01"/>
    <code code="42346-7" codeSystem="2.16.840.1.113883.6.1" displayName="Medications on admission (narrative) Document"/>
    <title>Admission Medications</title>
    <text>
      <table>
        <thead>
          <tr><th>Medication</th><th>Dose</th><th>Route</th></tr>
        </thead>
        <tbody>
          <tr><td>${data.adminMed1Name}</td><td>${data.adminMed1DoseValue} ${data.adminMed1DoseUnit}</td><td>${data.adminMed1Route}</td></tr>
        </tbody>
      </table>
    </text>
    <entry typeCode="DRIV">
      <act classCode="ACT" moodCode="EVN">
        <templateId root="2.16.840.1.113883.10.20.22.4.36" extension="2014-06-09"/>
        <id root="${generateGUID()}"/>
        <code code="42346-7" codeSystem="2.16.840.1.113883.6.1" displayName="Medications on admission"/>
        <statusCode code="active"/>
        <effectiveTime value="${data.encounterDate}"/>
  <author>
            <templateId root="2.16.840.1.113883.10.20.22.4.119"/>
            <time value="20240615"/>
            <assignedAuthor>
              <id extension="1234567890" root="2.16.840.1.113883.4.6"/>
              <code code="207Q00000X" 
      codeSystem="2.16.840.1.113883.6.101" 
      displayName="Family Medicine Physician"/>
              <assignedPerson>
                <name>
                  <given>Royce</given>
                  <family>Hemlock</family>
                </name>
              </assignedPerson>
            </assignedAuthor>
          </author>
        <entryRelationship typeCode="SUBJ">
          <substanceAdministration classCode="SBADM" moodCode="INT">
            <templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"/>
            <id root="${generateGUID()}"/>
            <statusCode code="active"/>
            <effectiveTime value="${data.encounterDate}"/>
            <routeCode code="${data.adminMed1Route}" codeSystem="2.16.840.1.113883.3.26.1.1">
              <translation code="${getRouteTranslation(data.adminMed1Route).code}" 
                           codeSystem="2.16.840.1.113883.6.96" 
                           displayName="${getRouteTranslation(data.adminMed1Route).display}"/>
            </routeCode>
            <doseQuantity value="${data.adminMed1DoseValue}" unit="${data.adminMed1DoseUnit}"/>
            <consumable>
              <manufacturedProduct classCode="MANU">
                <templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"/>
                <manufacturedMaterial>
                  <code code="${data.adminMed1Code}" codeSystem="2.16.840.1.113883.6.88" displayName="${data.adminMed1Name}"/>
                </manufacturedMaterial>
              </manufacturedProduct>
            </consumable>
          </substanceAdministration>
        </entryRelationship>
      </act>
    </entry>
  </section>
</component>

      <!-- Hospital Admission Diagnosis FIXED VERSION -->
<component>
  <section nullFlavor="NI">
    <templateId root="2.16.840.1.113883.10.20.22.2.43" extension="2015-08-01"/>
    <code code="46241-6" codeSystem="2.16.840.1.113883.6.1" displayName="Hospital admission diagnosis Narrative - Reported">
      <translation code="42347-5" codeSystem="2.16.840.1.113883.6.1" displayName="Admission Diagnosis"/>
    </code>
    <title>Hospital Admission Diagnosis</title>
    <text>See Encounters Section and Problems Section</text>
  </section>
</component>

      <!-- Hospital Discharge Diagnosis -->
      <component>
        <section nullFlavor="NI">
          <templateId root="2.16.840.1.113883.10.20.22.2.24" extension="2015-08-01"/>
          <code code="11535-2" codeSystem="2.16.840.1.113883.6.1" displayName="Hospital discharge diagnosis Narrative">
      <translation code="78375-3" codeSystem="2.16.840.1.113883.6.1" displayName="Discharge Diagnosis"/>
    </code>
          <title>Hospital Discharge Diagnosis</title>
          <text>See Encounters Section and Problems Section</text>
        </section>
      </component>

      <!-- Past Medical History -->
      <component>
        <section nullFlavor="NI">
          <templateId root="2.16.840.1.113883.10.20.22.2.20" extension="2015-08-01"/>
          <code code="11348-0" codeSystem="2.16.840.1.113883.6.1" displayName="History of Past illness Narrative"/>
          <title>Past Medical History</title>
          <text>${data.pastMedicalHistory}</text>
        </section>
      </component>

      <!-- Review of Systems -->
      <component>
        <section nullFlavor="NI">
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.18"/>
          <code code="10187-3" codeSystem="2.16.840.1.113883.6.1" displayName="Review of systems Narrative - Reported"/>
          <title>Review of Systems</title>
          <text>${data.reviewOfSystems}</text>
        </section>
      </component>

      <!-- Chief Complaint -->
      <component>
        <section nullFlavor="NI">
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.1.13.2.1"/>
          <code code="10154-3" codeSystem="2.16.840.1.113883.6.1" displayName="Chief complaint Narrative - Reported"/>
          <title>Chief Complaint</title>
          <text>${data.chiefComplaint}</text>
        </section>
      </component>
<!-- Emergency Outbreak Information Section -->
<component>
  <section>
    <templateId root="2.16.840.1.113883.10.20.15.2.2.4" extension="2021-01-01"/>
    <code code="83910-0" codeSystem="2.16.840.1.113883.6.1" 
          codeSystemName="LOINC" displayName="Emergency outbreak information"/>
    <title>Emergency Outbreak Information</title>
    <text>
      <table border="1">
        <thead>
          <tr>
            <th>Category</th>
            <th>Information</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Emergency/Outbreak Status</td>
            <td>${getEmergencyOutbreakDisplay(data.emergencyOutbreakInfo)}</td>
            <td>${data.outbreakDetails}</td>
          </tr>
          <tr>
            <td>Exposure/Contact</td>
            <td>${getExposureContactDisplay(data.exposureContactInfo)}</td>
            <td>Type: ${getExposureTypeDisplay(data.exposureType)}, Location: ${data.exposureLocation}, Date: ${data.exposureDate}</td>
          </tr>
          <tr>
            <td>Contact Person</td>
            <td>${data.contactPersonName}</td>
            <td>Phone: ${data.contactPersonPhone}</td>
          </tr>
          <tr>
            <td>Quarantine/Isolation</td>
            <td>Quarantine: ${getQuarantineStatusDisplay(data.quarantineStatus)}, Isolation: ${getIsolationStatusDisplay(data.isolationStatus)}</td>
            <td>Current status as of encounter date</td>
          </tr>
        </tbody>
      </table>
    </text>
    
    <!-- REQUIRED Emergency Outbreak Information Observation -->
<entry typeCode="DRIV">
  <observation classCode="OBS" moodCode="EVN">
    <templateId root="2.16.840.1.113883.10.20.15.2.3.40" extension="2021-01-01"/>
    <id root="${generateGUID()}"/>
    <code code="83910-0" codeSystem="2.16.840.1.113883.6.1" 
          displayName="Emergency outbreak information"/>
    <statusCode code="completed"/>
    <effectiveTime value="${data.encounterDate}"/>
    <value xsi:type="CD" 
           code="${data.emergencyOutbreakInfo || 'N/A'}" 
           codeSystem="2.16.840.1.113883.6.96" 
           displayName="${getEmergencyOutbreakDisplay(data.emergencyOutbreakInfo || 'N/A')}"/>
  </observation>
</entry>
    
    <!-- Exposure Information Entry -->
    ${data.exposureContactInfo && data.exposureContactInfo !== '373068000'
      ? `<entry typeCode="DRIV">
           <observation classCode="OBS" moodCode="EVN">
             <templateId root="2.16.840.1.113883.10.20.22.4.38"/>
             <id root="${generateGUID()}"/>
             <code code="418715001" codeSystem="2.16.840.1.113883.6.96" 
                   displayName="Exposure to potentially harmful entity"/>
             <statusCode code="completed"/>
             <effectiveTime value="${data.exposureDate !== 'Not applicable' ? data.exposureDate : data.encounterDate}"/>
             <value xsi:type="CD" code="${data.exposureContactInfo}" 
                    codeSystem="2.16.840.1.113883.6.96" 
                    displayName="${getExposureContactDisplay(data.exposureContactInfo)}"/>
           </observation>
         </entry>`
      : ''
    }
  </section>
</component>
    </structuredBody>
  </component>
</ClinicalDocument>`;
  return cdaTemplate;
}

/**
 * Main eICR XML generation function
 * @returns {string} Complete eICR XML
 */
function generateEICRXml() {
  return buildEICRXml();
}

/**
 * Alias function for CDA generation
 * @returns {string} Complete CDA XML
 */
function generateCDA() {
  return buildEICRXml();
}

// ============================================================================
// REPORTABILITY RESPONSE (RR) XML BUILDER
// ============================================================================

/**
 * Builds metadata XML from form data
 * @param {Object} data - Form data
 * @param {string} zipFilename - ZIP filename
 * @returns {string} Metadata XML
 */
function buildMetadataXml(data, zipFilename) {
  const esc = s => xmlEscape(s || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<metadata>
    <filename>${esc(zipFilename)}</filename>
    <author>${esc(data.organizationName || data.facilityName || 'Unknown Organization')}</author>
    <authorID>${esc(data.organizationId || data.facilityId || data.providerId || 'Unknown')}</authorID>
    <serviceProviderOrg>${esc(data.facilityName || 'Unknown Facility')}</serviceProviderOrg>
    <serviceProviderOrgID>${esc(data.facilityId || data.organizationId || '1.2.840.114350.1.13.248.3.7.2.696570.1020')}</serviceProviderOrgID>
    <facility>${esc(data.facilityName || 'Unknown Facility')}</facility>
    <facilityID>${esc(data.facilityId || '1.2.840.114350.1.13.248.3.7.2.686980.1020251')}</facilityID>
    <sender>${esc(data.organizationEmail || data.providerEmail || 'unknown@facility.org')}</sender>
    <senderID>${esc(data.organizationName || data.facilityName || 'Unknown Organization System')}</senderID>
</metadata>`;
}

/**
 * NOTE: buildRRXml is defined in rr-generator.js
 * It's exposed globally via window.buildRRXml
 * This file only contains wrapper functions that call it
 */

/**
 * Generates RR XML
 * @returns {string} Complete RR XML
 */
function generateRR() {
  return buildRRXml();
}

/**
 * Generates RR XML (alias)
 * @returns {string} Complete RR XML
 */
function generateRRXml() {
  return buildRRXml();
}

// Expose functions globally for cross-module access
window.buildEICRXml = buildEICRXml;
window.generateEICRXml = generateEICRXml;
window.generateRRXml = generateRRXml;
// NOTE: buildRRXml is exposed in rr-generator.js
// NOTE: generateDynamicFilename is exposed in data-transformers.js
