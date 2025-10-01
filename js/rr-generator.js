/**
 * rr-generator.js
 *
 * Reportability Response (RR) XML Generation Functions
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file contains functions for generating HL7 CDA R2 compliant
 * Reportability Response documents that accompany eICR submissions.
 *
 * Dependencies:
 * - form-handlers.js (getFormData)
 * - xml-builders.js (xmlEscape, generateGUID, mapInterp)
 * - file-downloaders.js (generateDynamicFilename)
 * - validation.js (validateFormData)
 * - xslt-processor.js (fetchXslt, xmlToHtml, debugXmlStructure, validateXMLComments)
 *
 * @medical-software CRITICAL - Preserve all XML structure and validation logic
 */

/**
 * Build Reportability Response XML
 *
 * Generates a complete HL7 CDA R2 RR document based on form data.
 * The RR indicates whether conditions in the eICR are reportable
 * to public health authorities.
 *
 * @returns {string} Complete RR XML document
 */
function buildRRXml () {
  const d = getFormData();
  const labEvidence = (d.labEvidence || []);
  const x = s => xmlEscape(s || '');       // one-letter alias = escape **everything**
  const guid = () => generateGUID();

  /* =============== STATIC RR CONSTANTS =============== */
  const authorOrgOID    = '2.16.840.1.114222.4.1.217446';  // AIMS
  const custodianOrgOID = '2.16.840.1.114222.4.1.217446';  // APHL
  const rrDocOID        = guid();                          // doc ID for THIS RR
  const rrCreateTS      = new Date().toISOString()
                               .replace(/[-:T]/g,'')
                               .substring(0,14) + '-0000';

  /* =============== REPORTABLE CONDITIONS =============== */
  // Grab every diagnosis that has a code + name – you can refine this
  // to only pull RCTC matches if desired.
  const conditions = [
    { code: d.diagnosis1Code, name: d.diagnosis1Name },
    { code: d.diagnosis2Code, name: d.diagnosis2Name },
    { code: d.diagnosis3Code, name: d.diagnosis3Name }
  ].filter(c => c.code && c.name);

  // Very simple classification: everything marked R1 (reportable)
  // Swap this for your own logic if you also emit R3 / R5 etc.
  const classify = () => 'R1';                      // R1 = "reportable"
  const jurisdiction = () => `${x(d.patientCounty)} Health Department`;

  /* ---------- Build <text> table & machine-readable entries ---------- */
  let condRows   = '';
  let condEntries = '';

  conditions.forEach((c, idx) => {
    const resultCode = classify(c);      // e.g. R1, R3 …
    const entryId    = guid();

    /* human-readable table row */
    condRows += `
      <tr>
        <td>${x(c.name)}</td>
        <td>${x(c.code)}</td>
        <td>${resultCode}</td>
        <td>${jurisdiction()}</td>
      </tr>`;

    /* machine-readable observation (Reportability Result Observation) */
    condEntries += `
      <entry>
        <observation classCode="OBS" moodCode="EVN">
          <!-- Reportability Result Observation (RR-O) -->
          <templateId root="2.16.840.1.113883.10.20.15.2.3.8" extension="2017-04-01"/>
          <id root="${entryId}"/>
          <code code="RR" codeSystem="2.16.840.1.114222.4.5.274"
                displayName="Reportability Result"/>
          <statusCode code="completed"/>
          <effectiveTime value="${rrCreateTS}"/>
          <value xsi:type="CD"
                 code="${resultCode}"
                 codeSystem="2.16.840.1.114222.4.5.232"
                 displayName="${resultCode === 'R1' ? 'Reportable' : 'Not Reportable'}"/>
          <entryRelationship typeCode="SUBJ">
            <observation classCode="OBS" moodCode="EVN">
              <!-- Condition that triggered the rule -->
              <templateId root="2.16.840.1.113883.10.20.15.2.3.3"/>
              <id root="${guid()}"/>
              <code code="75323-6" codeSystem="2.16.840.1.113883.6.1"
                    displayName="Condition"/>
              <statusCode code="completed"/>
              <value xsi:type="CD"
                     code="${x(c.code)}"
                     codeSystem="2.16.840.1.113883.6.96"
                     displayName="${x(c.name)}"/>
            </observation>
          </entryRelationship>
          ${labEvidence.map(ev => `
          <entryRelationship typeCode="SPRT">
            <observation classCode="OBS" moodCode="EVN">
              <id root="${guid()}"/>
              <statusCode code="completed"/>
              ${ev.time ? `<effectiveTime value="${x(ev.time)}"/>` : ''}
              ${(ev.testCode || ev.testName) ? `
                <code code="${x(ev.testCode||'')}" codeSystem="2.16.840.1.113883.6.1" displayName="${x(ev.testName||'Laboratory test')}"/>` : `
                <code nullFlavor="UNK"/>`}
              ${(ev.valueKind==='coded' && (ev.valueCode || ev.valueName)) ? `
                <value xsi:type="CD" code="${x(ev.valueCode||'')}" codeSystem="2.16.840.1.113883.6.96" displayName="${x(ev.valueName||'')}"/>` : ''}
              ${(ev.valueKind==='quantity' && ev.qtyValue) ? `
                <value xsi:type="PQ" value="${x(ev.qtyValue)}"${ev.qtyUnit?` unit="${x(ev.qtyUnit)}"`:''}/>` : ''}
              ${(ev.valueKind==='text' && ev.textValue) ? `
                <value xsi:type="ST">${x(ev.textValue)}</value>` : ''}
              ${mapInterp(ev.interpretation) ? `
                <interpretationCode code="${mapInterp(ev.interpretation)}" codeSystem="2.16.840.1.113883.5.83"/>` : ''}
            </observation>
          </entryRelationship>`).join('')}
          <participant typeCode="DST">
            <participantRole classCode="AGNT">
              <addr><state>${x(d.patientState)}</state></addr>
              <playingEntity classCode="PLC">
                <name>${jurisdiction()}</name>
              </playingEntity>
            </participantRole>
          </participant>
        </observation>
      </entry>`;
  });

  /* =============== THE RR XML =============== */
  return `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <!-- HEADER -->
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="2.16.840.1.113883.10.20.15.2.1.2" extension="2017-04-01"/>
  <id root="${rrDocOID}"/>
  <code code="88085-6" codeSystem="2.16.840.1.113883.6.1"
        displayName="Reportability response report Document Public health"/>
  <title>Reportability Response</title>
  <effectiveTime value="${rrCreateTS}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>

  <!-- PATIENT -->
  <recordTarget>
    <patientRole>
      <id extension="${x(d.patientId)}" root="2.16.840.1.113883.19.5"/>
      <addr use="H">
        <streetAddressLine>${x(d.patientAddress)}</streetAddressLine>
        <city>${x(d.patientCity)}</city><state>${x(d.patientState)}</state>
        <postalCode>${x(d.patientZip)}</postalCode>
        <country>${x(d.patientCountry) || 'US'}</country>
      </addr>
      <telecom value="tel:${x(d.patientPhone)}" use="MC"/>
      <patient>
        <name use="L">
          <given>${x((d.patientName||' ').split(' ')[0])}</given>
          <family>${x((d.patientName||' ').split(' ').slice(1).join(' '))}</family>
        </name>
        <administrativeGenderCode code="${x(d.patientGender)}"
                                  codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${x(d.patientBirthDate)}"/>
      </patient>
    </patientRole>
  </recordTarget>

  <!-- AUTHOR (AIMS) -->
  <author>
    <time value="${rrCreateTS}"/>
    <assignedAuthor>
      <id root="${authorOrgOID}"/>
      <assignedAuthoringDevice>
        <manufacturerModelName>AIMS</manufacturerModelName>
        <softwareName>AIMS</softwareName>
      </assignedAuthoringDevice>
    </assignedAuthor>
  </author>

  <!-- CUSTODIAN (APHL) -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="${custodianOrgOID}"/>
        <name>APHL | Association of Public Health Laboratories</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>

  <!-- INFO RECIPIENT (Provider) -->
  <informationRecipient typeCode="PRCP">
    <intendedRecipient>
      <id extension="${x(d.providerId)}" root="2.16.840.1.113883.4.6"/>
      <informationRecipient>
        <name>
          <given>${x((d.providerName||' ').split(' ')[0])}</given>
          <family>${x((d.providerName||' ').split(' ').slice(1).join(' '))}</family>
        </name>
      </informationRecipient>
      <receivedOrganization><name>${x(d.facilityName)}</name></receivedOrganization>
    </intendedRecipient>
  </informationRecipient>

  <!-- ENCOMPASSING ENCOUNTER -->
  <componentOf>
    <encompassingEncounter>
      <id extension="${x(d.encounterId)}" root="2.16.840.1.113883.19"/>
      <effectiveTime><low value="${x(d.encounterDate)}"/></effectiveTime>
    </encompassingEncounter>
  </componentOf>

  <!-- BODY -->
  <component><structuredBody>

    <!-- SUBJECT section (88084-9) -->
    <component><section>
      <templateId root="2.16.840.1.113883.10.20.15.2.2.1" extension="2017-04-01"/>
      <code code="88084-9" codeSystem="2.16.840.1.113883.6.1"/>
      <text>
        <paragraph>This response indicates that public-health has processed the
        incoming eICR. <strong>${x(conditions[0]?.name || 'A condition')}</strong>
        is reportable for <em>${jurisdiction()}</em>.</paragraph>
      </text>
    </section></component>

    <!-- PROCESSING-INFO section (88082-3) -->
    <component><section>
      <templateId root="2.16.840.1.113883.10.20.15.2.2.3" extension="2017-04-01"/>
      <code code="88082-3" codeSystem="2.16.840.1.113883.6.1"/>
      <entry>
        <act classCode="ACT" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.15.2.3.9" extension="2017-04-01"/>
          <code code="RR5" codeSystem="2.16.840.1.114222.4.5.232"
                 displayName="Received eICR Information"/>
          <statusCode code="completed"/>
          <reference typeCode="REFR">
            <externalDocument classCode="DOCCLIN" moodCode="EVN">
              <id root="${x(d.documentId)}"/>
              <code code="55751-2" codeSystem="2.16.840.1.113883.6.1"
                     displayName="Public Health Case Report (eICR)"/>
              <setId extension="${x(d.setId)}"
                     root="1.2.840.114350.1.13.380.3.7.1.1"/>
              <versionNumber value="${x(d.versionNumber)}"/>
            </externalDocument>
          </reference>
        </act>
      </entry>
      <entry>
        <act classCode="ACT" moodCode="EVN">
          <templateId extension="2017-04-01" root="2.16.840.1.113883.10.20.15.2.3.29"/>
          <id root="${guid()}"/>
          <code code="RRVS20" codeSystem="2.16.840.1.114222.4.5.274"
                codeSystemName="PHIN VS (CDC Local Coding System)"
                displayName="eICR was processed - with a warning"/>
          <entryRelationship typeCode="RSON">
            <observation classCode="OBS" moodCode="EVN">
              <templateId extension="2017-04-01" root="2.16.840.1.113883.10.20.15.2.3.21"/>
              <id root="${guid()}"/>
              <code code="RR6" codeSystem="2.16.840.1.114222.4.5.232"
                    displayName="eICR processing status reason"/>
              <value code="RRVS29" codeSystem="2.16.840.1.114222.4.5.274"
                     displayName="The eICR was processed with the warning of: outdated eRSD (RCTC) version."
                     xsi:type="CD"/>
              <entryRelationship typeCode="RSON">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId extension="2017-04-01" root="2.16.840.1.113883.10.20.15.2.3.32"/>
                  <id root="${guid()}"/>
                  <code code="RRVS31" codeSystem="2.16.840.1.114222.4.5.274"
                        displayName="Outdated eRSD (RCTC) Version Detail"/>
                  <value xsi:type="ST">2.0.1</value>
                </observation>
              </entryRelationship>
              <entryRelationship typeCode="RSON">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId extension="2017-04-01" root="2.16.840.1.113883.10.20.15.2.3.32"/>
                  <id root="${guid()}"/>
                  <code code="RRVS33" codeSystem="2.16.840.1.114222.4.5.274"
                        displayName="Expected eRSD (RCTC) Version Detail"/>
                  <value xsi:type="ST">The expected eRSD (RCTC) version should be one of the following: ["2025-02-28","2.0.0","3.0.1"]</value>
                </observation>
              </entryRelationship>
            </observation>
          </entryRelationship>
        </act>
      </entry>
    </section></component>

    <!-- REPORTABILITY RESULTS section (88083-1)  ← NEW -->
    <component><section>
      <templateId root="2.16.840.1.113883.10.20.15.2.2.2" extension="2017-04-01"/>
      <code code="88083-1" codeSystem="2.16.840.1.113883.6.1"/>
      <title>Reportability Results</title>
      <text>
        <table border="1">
          <thead><tr><th>Condition</th><th>Code</th><th>Classification</th><th>Jurisdiction</th></tr></thead>
          <tbody>${condRows}</tbody>
        </table>
      </text>
      ${condEntries}
    </section></component>

  </structuredBody></component>
</ClinicalDocument>`;
}

/**
 * Generate RR XML (convenience wrapper)
 * @returns {string} RR XML document
 */
function generateRR() {
    return buildRRXml();
}

/**
 * Build metadata XML from form data
 * Used in ZIP packages to describe the contents
 *
 * @param {object} data - Form data object
 * @param {string} zipFilename - Name of the ZIP file
 * @returns {string} Metadata XML document
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
 * Download ZIP package containing eICR and RR (XML + HTML)
 * Transforms both documents to HTML using XSLT and packages everything
 * into a single ZIP file with metadata.
 *
 * Requires JSZip library
 */
async function downloadZipOfEICRandRR() {
  try {
    if (!validateFormData()) return;

    console.log('Starting ZIP generation with debugging...');

    // Generate XML
    const eicrXml = generateEICRXml();
    const rrXml = generateRRXml();

    // Debug XML structure
    debugXmlStructure(eicrXml, 'eICR');
    debugXmlStructure(rrXml, 'RR');

    // Validate XML comments
    validateXMLComments(eicrXml, 'eICR');
    validateXMLComments(rrXml, 'RR');

    // Load XSLT files
    console.log('Loading XSLT files...');
    const eicrXsl = await fetchXslt(EICR_XSL_URL);
    const rrXsl = await fetchXslt(RR_XSL_URL);

    // Verify XSLT files
    if (eicrXsl.length < 1000 || !eicrXsl.includes('xsl:stylesheet')) {
      throw new Error('eICR XSLT appears to be invalid or incomplete');
    }
    if (rrXsl.length < 1000 || !rrXsl.includes('xsl:stylesheet')) {
      throw new Error('RR XSLT appears to be invalid or incomplete');
    }

    // Transform to HTML
    console.log('Transforming eICR...');
    const eicrHtml = xmlToHtml(eicrXml, eicrXsl);

    console.log('Transforming RR...');
    const rrHtml = xmlToHtml(rrXml, rrXsl);

    // Generate filenames
    const data = getFormData();
    const stamp = new Date().toISOString().split('T')[0];
    const base = (data.patientName || 'Patient').replace(/[^A-Za-z0-9]/g,'_') + '_' + (data.setId || 'Unknown') + '_' + stamp;

    // Create ZIP with all files
    console.log('Creating ZIP package...');
    const zip = new JSZip();
    zip.file(`eICR_${base}.xml`, eicrXml);
    zip.file(`RR_${base}.xml`, rrXml);
    zip.file(`eICR_${base}.html`, eicrHtml);
    zip.file(`RR_${base}.html`, rrHtml);

    // Add metadata file with form data
    const metadata = buildMetadataXml(data, `${base}.zip`);
    zip.file('metadata.xml', metadata);

    console.log('Generating ZIP file...');
    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = generateDynamicFilename('eCR', 'zip');

    // Try to use File System Access API (Chrome/Edge) to prompt for save location
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'ZIP files',
              accept: { 'application/zip': ['.zip'] }
            }
          ]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log('File saved with user-selected location');
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('File System Access API failed, falling back to download:', err);
        } else {
          console.log('User cancelled save dialog');
          return;
        }
      }
    }

    // Fallback: traditional download (goes to Downloads folder)
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: filename
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    console.log('ZIP download completed successfully with 5 files (XML + HTML + metadata)');

  } catch (error) {
    console.error('Detailed error:', error);
    if (error.message.includes('XSLT file') || error.message.includes('XSLT transformation')) {
      alert(`Transformation failed: ${error.message}\n\nCheck the console for detailed debugging information.`);
    } else {
      alert(`Failed to build ZIP package: ${error.message}\n\nSee console for detailed error information.`);
    }
  }
}

/**
 * Generate and download RR XML file
 * Prompts user for save location using File System Access API (if available)
 * or falls back to traditional download
 */
async function generateAndDownloadRR() {
    try {
        const rrXml = generateRR();          // build the RR XML
        const blob = new Blob([rrXml], { type: 'application/xml' });
        const filename = generateDynamicFilename('RR', 'xml');

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
                console.log('RR file saved with user-selected location');
                return;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('File System Access API failed for RR, falling back to download:', err);
                } else {
                    console.log('User cancelled RR save dialog');
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
    } catch (e) {
        alert(`RR build failed: ${e.message}`);
        console.error(e);
    }
}

// Expose functions globally for onclick attributes and cross-module access
window.buildRRXml = buildRRXml;
window.generateAndDownloadRR = generateAndDownloadRR;
window.downloadZipOfEICRandRR = downloadZipOfEICRandRR;
