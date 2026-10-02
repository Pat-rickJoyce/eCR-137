/**
 * FHIR Reportability Response builder (eCR IG 2.1.2 RR profiles, FHIR R4 XML).
 *
 * Built from:
 *   - the eICR FHIR Bundle produced by js/fhir/ecr137-cda2fhir.xslt: Patient, Encounter, the eICR
 *     author PractitionerRole (information recipient) and every resource they reference are copied
 *     with their fullUrls, so eICR and RR identify the same patient, encounter and provider;
 *   - form data (getFormData): patient county and state for the jurisdiction, eICR identifiers;
 *   - the reportability engine result (window.ecr137Reportability): triggered conditions become
 *     RRVS1 Reportable, potential conditions RRVS2 May be reportable.
 * Processing status mirrors the CDA RR (js/rr-generator.js): RRVS20 processed with a warning,
 * reason RRVS29 outdated eRSD (RCTC) version.
 */
(function () {
  const FHIR = 'http://hl7.org/fhir';
  const ECR = 'http://hl7.org/fhir/us/ecr/StructureDefinition/';
  const PHIN_274 = 'urn:oid:2.16.840.1.114222.4.5.274';
  const PHIN_232 = 'urn:oid:2.16.840.1.114222.4.5.232';
  const DAR = 'http://hl7.org/fhir/StructureDefinition/data-absent-reason';
  // Reporting timeframe stated in every Reportability Information Observation (component RR4, required).
  const REPORTING_TIMEFRAME_HOURS = 24;

  const esc = s => String(s == null ? '' : s).trim()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const v = (name, value) => (value === undefined || value === null || value === '') ? '' : `<${name} value="${esc(value)}"/>`;
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  const urn = () => 'urn:uuid:' + uuid();
  const coding = (system, code, display) => `<coding>${v('system', system)}${v('code', code)}${v('display', display)}</coding>`;
  const ref = (url, display) => `<reference value="${esc(url)}"/>${display ? v('display', display) : ''}`;
  const narrative = html => `<text><status value="generated"/><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></text>`;
  const dataAbsentTelecom = `<telecom><system value="phone"/><value><extension url="${DAR}"><valueCode value="unknown"/></extension></value></telecom>`;

  function nowInstant() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`;
  }

  // Resources copied from the eICR Bundle: Patient, Encounter, information recipient, and their reference closure.
  function copyFromEicr(eicrXml) {
    const doc = new DOMParser().parseFromString(eicrXml, 'application/xml');
    const entries = [...doc.documentElement.children].filter(e => e.localName === 'entry');
    const byUrl = new Map();
    for (const e of entries) {
      const fu = [...e.children].find(c => c.localName === 'fullUrl');
      const res = [...e.children].find(c => c.localName === 'resource');
      if (fu && res && res.firstElementChild) byUrl.set(fu.getAttribute('value'), res.firstElementChild);
    }
    const find = type => [...byUrl.entries()].find(([, r]) => r.localName === type);
    const comp = find('Composition');
    const patient = find('Patient');
    const encounter = find('Encounter');
    const refValue = (el, name) => {
      const n = [...el.children].find(c => c.localName === name);
      const r = n && [...n.children].find(c => c.localName === 'reference');
      return r ? r.getAttribute('value') : null;
    };
    // Information recipient: the first eICR author that is a PractitionerRole, Practitioner or Organization,
    // else the first Encounter participant.
    const kids = (el, name) => [...el.children].filter(c => c.localName === name);
    const refsOf = (el, name) => kids(el, name).map(n => kids(n, 'reference')[0]).filter(Boolean).map(r => r.getAttribute('value'));
    const isRecipient = u => byUrl.has(u) && ['PractitionerRole', 'Practitioner', 'Organization'].includes(byUrl.get(u).localName);
    const encounterIndividuals = encounter ? kids(encounter[1], 'participant').flatMap(pt => refsOf(pt, 'individual')) : [];
    const recipientUrl = [...(comp ? refsOf(comp[1], 'author') : []), ...encounterIndividuals].find(isRecipient) || null;
    const keep = new Set(); const queue = [patient && patient[0], encounter && encounter[0], recipientUrl].filter(Boolean);
    while (queue.length) {
      const u = queue.shift();
      if (keep.has(u) || !byUrl.has(u)) continue;
      const r = byUrl.get(u);
      if (['Composition', 'Provenance', 'DocumentReference'].includes(r.localName)) continue;
      keep.add(u);
      r.querySelectorAll('reference').forEach(x => queue.push(x.getAttribute('value')));
    }
    const ser = new XMLSerializer();
    const bundleId = (() => {
      const idEl = [...doc.documentElement.children].find(c => c.localName === 'identifier');
      const val = idEl && [...idEl.children].find(c => c.localName === 'value');
      return val ? val.getAttribute('value') : null;
    })();
    return {
      entries: [...keep].map(u => ({ fullUrl: u, xml: ser.serializeToString(byUrl.get(u)).replace(/ xmlns="http:\/\/hl7\.org\/fhir"/g, '') })),
      patientUrl: patient && patient[0],
      encounterUrl: encounter && encounter[0],
      recipientUrl: keep.has(recipientUrl) ? recipientUrl : null,
      eicrBundleId: bundleId
    };
  }

  function jurisdictionOrg(profile, typeCode, typeDisplay, name, d) {
    const url = urn();
    const addr = `<address>${v('district', d.patientCounty)}${v('state', d.patientState)}${v('country', d.patientCountry || 'US')}</address>`;
    return { fullUrl: url, xml:
      `<Organization><meta><profile value="${ECR}${profile}"/></meta>${narrative(`<p>${esc(name)} (${esc(typeDisplay)})</p>`)}` +
      `<active value="true"/><type>${coding(PHIN_232, typeCode, typeDisplay)}</type>${v('name', name)}${dataAbsentTelecom}${addr}</Organization>` };
  }

  // SNOMED CT code for the condition: the RCTC reportable condition code of the condition pack
  // (js/fhir/rr-condition-codes.js); else the diagnosis or problem code that matched the condition's rules.
  function conditionCoding(cond) {
    const rctc = (window.ECR137_RR_CONDITION_CODES || {})[cond.conditionId];
    if (rctc) return coding('http://snomed.info/sct', rctc.code, rctc.display);
    const ev = ((cond.v2 && cond.v2.rules) || []).flatMap(r => r.matchedEvidence || [])
      .find(m => (m.type === 'diagnosis' || m.type === 'problem') && /^\d{6,18}$/.test(String(m.code || '')));
    return ev ? coding('http://snomed.info/sct', ev.code, null) : '';
  }

  function buildRRFhirBundle(eicrXml, d, result) {
    const src = copyFromEicr(eicrXml);
    const now = nowInstant();
    const jurisdiction = `${d.patientCounty || d.patientState || 'Local'} Health Department`;
    const out = [...src.entries];
    const add = (xml) => { const u = urn(); out.push({ fullUrl: u, xml }); return u; };
    const subj = src.patientUrl ? `<subject>${ref(src.patientUrl)}</subject>` : '';
    const eff = `<effectiveDateTime value="${now}"/>`;

    // Author and custodian, as in the CDA RR (AIMS / APHL)
    const deviceUrl = add(`<Device>${narrative('<p>AIMS</p>')}<deviceName><name value="AIMS"/><type value="manufacturer-name"/></deviceName></Device>`);
    const custodianUrl = add(`<Organization><meta><profile value="${ECR}us-ph-organization"/></meta>${narrative('<p>APHL | Association of Public Health Laboratories</p>')}` +
      `<identifier><system value="urn:ietf:rfc:3986"/><value value="urn:oid:2.16.840.1.114222.4.1.217446"/></identifier>` +
      `<active value="true"/><name value="APHL | Association of Public Health Laboratories"/>${dataAbsentTelecom}` +
      `<address><extension url="${DAR}"><valueCode value="unknown"/></extension></address></Organization>`);
    // APHL operates AIMS and the decision support that produced the processing status and determinations
    const aphl = `<performer>${ref(custodianUrl, 'APHL | Association of Public Health Laboratories')}</performer>`;

    // eICR processing status (mirrors the CDA RR)
    const reasonUrl = add(`<Observation><meta><profile value="${ECR}rr-eicr-processing-status-reason-observation"/></meta>` +
      narrative('<p>The eICR was processed with the warning of: outdated eRSD (RCTC) version.</p>') +
      `<status value="final"/><code>${coding(PHIN_232, 'RR6', 'eICR Processing Status Reason')}</code>${subj}${eff}${aphl}` +
      `<valueCodeableConcept>${coding(PHIN_274, 'RRVS29', 'eICR was processed with the warning of: outdated RCTC version')}</valueCodeableConcept>` +
      `<component><code>${coding(PHIN_274, 'RRVS31', 'Outdated RCTC version detail')}</code><valueString value="2.0.1"/></component>` +
      `<component><code>${coding(PHIN_274, 'RRVS33', 'Expected RCTC version detail')}</code><valueString value="The expected eRSD (RCTC) version should be one of the following: [&quot;2025-02-28&quot;,&quot;2.0.0&quot;,&quot;3.0.1&quot;]"/></component>` +
      `</Observation>`);
    const statusUrl = add(`<Observation><meta><profile value="${ECR}rr-eicr-processing-status-observation"/></meta>` +
      narrative('<p>eICR was processed - with a warning</p>') +
      `<status value="final"/><code>${coding(PHIN_274, 'RRVS20', 'eICR was processed - with a warning')}</code>${subj}${eff}${aphl}` +
      `<hasMember>${ref(reasonUrl)}</hasMember></Observation>`);

    // Conditions
    const triggered = (result && result.triggeredConditions) || [];
    // Potential conditions enter the RR only when condition-specific evidence (a diagnosis, problem, lab test,
    // lab result or medication in the condition's value sets) matched; a matched abnormal-flag or age gate alone
    // is not evidence of that condition.
    const SPECIFIC = new Set(['diagnosis', 'problem', 'lab_test', 'lab_result', 'medication']);
    const potential = ((result && result.potentialConditions) || []).filter(c =>
      ((c.v2 && c.v2.rules) || []).some(r => (r.matchedEvidence || []).some(m => SPECIFIC.has(m.type))));
    const conds = [
      ...triggered.map(c => ({ c, code: 'RRVS1', display: 'Reportable' })),
      ...potential.map(c => ({ c, code: 'RRVS2', display: 'May be reportable' }))
    ];
    const conditionUrls = [];
    if (conds.length) {
      const rules = jurisdictionOrg('rr-rules-authoring-agency-organization', 'RR12', 'Rules Authoring Agency', jurisdiction, d);
      const routing = jurisdictionOrg('rr-routing-entity-organization', 'RR7', 'Routing Entity', jurisdiction, d);
      const responsible = jurisdictionOrg('rr-responsible-agency-organization', 'RR8', 'Responsible Agency', jurisdiction, d);
      out.push(rules, routing, responsible);
      for (const { c, code, display } of conds) {
        const ruleText = (c.matchedRules || []).map(r => `${r.ruleId}: ${r.ruleDescription || ''}`.trim()).join('; ')
          || `${c.packId || c.conditionId || ''}`.trim();
        const reason = code === 'RRVS1' ? `${c.conditionName} is reportable to ${jurisdiction}`
          : `${c.conditionName} may be reportable to ${jurisdiction}` + ((c.unmet && c.unmet.length) ? `; additional criteria: ${c.unmet.join(', ')}` : '');
        const infoUrl = add(`<Observation><meta><profile value="${ECR}rr-reportability-information-observation"/></meta>` +
          narrative(`<p>${esc(display)}: ${esc(c.conditionName)} (${esc(jurisdiction)})</p>`) +
          `<extension url="${ECR}us-ph-determination-of-reportability-extension"><valueCodeableConcept>${coding(PHIN_274, code, display)}</valueCodeableConcept></extension>` +
          `<extension url="${ECR}us-ph-determination-of-reportability-reason-extension"><valueString value="${esc(reason)}"/></extension>` +
          (ruleText ? `<extension url="${ECR}us-ph-determination-of-reportability-rule-extension"><valueString value="${esc(ruleText)}"/></extension>` : '') +
          `<status value="final"/><code>${coding(PHIN_274, 'RRVS5', 'Patient home address')}</code>${subj}${eff}` +
          `<performer>${ref(rules.fullUrl, jurisdiction)}</performer><performer>${ref(routing.fullUrl, jurisdiction)}</performer><performer>${ref(responsible.fullUrl, jurisdiction)}</performer>` +
          `<component><code>${coding(PHIN_232, 'RR4', 'Timeframe to report (urgency)')}</code>` +
          `<valueQuantity><value value="${REPORTING_TIMEFRAME_HOURS}"/><unit value="h"/><system value="http://unitsofmeasure.org"/><code value="h"/></valueQuantity></component>` +
          `</Observation>`);
        conditionUrls.push({ url: add(`<Observation><meta><profile value="${ECR}rr-relevant-reportable-condition-observation"/></meta>` +
          narrative(`<p>${esc(c.conditionName)}: ${esc(display)}</p>`) +
          `<status value="final"/><code>${coding('http://snomed.info/sct', '64572001', 'Disease (disorder)')}${coding('http://loinc.org', '75323-6', 'Condition')}</code>` +
          subj + eff + aphl +
          `<valueCodeableConcept>${conditionCoding(c)}<text value="${esc(c.conditionName)}"/></valueCodeableConcept>` +
          `<hasMember>${ref(infoUrl)}</hasMember></Observation>`), name: c.conditionName, display });
      }
    }
    const summaryText = conds.length
      ? `Your organization electronically submitted an initial case report to determine if reporting to public health is needed for a patient. ` +
        conds.map(x => `'${x.c.conditionName}' is ${x.code === 'RRVS1' ? 'reportable' : 'possibly reportable'} to '${jurisdiction}'.`).join(' ')
      : '';
    const summaryUrl = conds.length ? add(`<Observation><meta><profile value="${ECR}rr-summary"/></meta>${narrative(`<p>${esc(summaryText)}</p>`)}` +
      `<status value="final"/><code>${coding('http://snomed.info/sct', '304561000', 'Informing health care professional')}</code>${subj}${eff}${aphl}` +
      `<valueString value="${esc(summaryText)}"/></Observation>`) : null;

    // Composition
    const compUrl = urn();
    const rows = conditionUrls.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.display)}</td><td>${esc(jurisdiction)}</td></tr>`).join('');
    const eicrRef = src.eicrBundleId
      ? `<entry><identifier><system value="urn:ietf:rfc:3986"/><value value="${esc(src.eicrBundleId)}"/></identifier><display value="Electronic Initial Case Report"/></entry>` : '';
    const priority = triggered.length ? coding(PHIN_274, 'RRVS14', 'Action required') : coding(PHIN_274, 'RRVS16', 'Action requested');
    const composition = `<Composition><meta><profile value="${ECR}rr-composition"/></meta>` +
      narrative(`<p>Reportability Response for ${esc(d.patientName)}</p>`) +
      `<extension url="http://hl7.org/fhir/StructureDefinition/composition-clinicaldocument-versionNumber"><valueString value="1"/></extension>` +
      (src.recipientUrl ? `<extension url="${ECR}us-ph-information-recipient-extension"><valueReference>${ref(src.recipientUrl, d.providerName)}</valueReference></extension>` : '') +
      `<identifier><system value="urn:ietf:rfc:3986"/><value value="${urn()}"/></identifier>` +
      `<status value="final"/><type>${coding('http://loinc.org', '88085-6', 'Reportability response report Document Public health')}</type>` +
      `<subject>${ref(src.patientUrl, d.patientName)}</subject>` +
      (src.encounterUrl ? `<encounter>${ref(src.encounterUrl)}</encounter>` : '') +
      `<date value="${now}"/><author>${ref(deviceUrl, 'AIMS')}</author><title value="Reportability Response"/>` +
      `<custodian>${ref(custodianUrl, 'APHL | Association of Public Health Laboratories')}</custodian>` +
      `<section><title value="Reportability Response Subject Section"/><code>${coding('http://loinc.org', '88084-9', 'Reportable condition response information and summary Document')}</code>` +
      narrative(`<p>${esc(conds.length ? summaryText : 'No reportable condition was identified for this eICR.')}</p>`) + `</section>` +
      `<section>` +
      `<extension url="${ECR}rr-eicr-processing-status-extension"><extension url="eICRProcessingStatus"><valueReference>${ref(statusUrl, 'eICR was processed - with a warning')}</valueReference></extension></extension>` +
      `<extension url="${ECR}rr-eicr-receipt-time-extension"><valueDateTime value="${now}"/></extension>` +
      `<title value="Electronic Initial Case Report Section"/><code>${coding('http://loinc.org', '88082-3', 'Initial case report processing information Document')}</code>` +
      narrative(`<p>eICR ${esc(d.documentId || '')} set ${esc(d.setId || '')} version ${esc(d.versionNumber || '1')}: eICR was processed - with a warning (outdated eRSD (RCTC) version).</p>`) +
      eicrRef + `</section>` +
      (conds.length ? `<section><extension url="${ECR}rr-priority-extension"><valueCodeableConcept>${priority}</valueCodeableConcept></extension>` +
        `<title value="Reportability Response Summary Section"/><code>${coding('http://loinc.org', '55112-7', 'Document summary')}</code>` +
        narrative(`<table><thead><tr><th>Condition</th><th>Determination</th><th>Jurisdiction</th></tr></thead><tbody>${rows}</tbody></table>`) +
        `<entry>${ref(summaryUrl, 'Reportability Response Summary')}</entry>` +
        conditionUrls.map(x => `<entry>${ref(x.url, x.name)}</entry>`).join('') + `</section>` : '') +
      `</Composition>`;

    const entries = [{ fullUrl: compUrl, xml: composition }, ...out];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Bundle xmlns="${FHIR}"><meta><profile value="${ECR}rr-document-bundle"/></meta>` +
      `<identifier><system value="urn:ietf:rfc:3986"/><value value="${urn()}"/></identifier><type value="document"/><timestamp value="${now}"/>` +
      entries.map(e => `<entry><fullUrl value="${esc(e.fullUrl)}"/><resource>${e.xml}</resource></entry>`).join('') + `</Bundle>\n`;
  }

  window.ecr137BuildRRFhirBundle = buildRRFhirBundle;
})();
