/*
 * Reader-oriented layout for the FHIR eICR and RR Bundles (XML).
 *
 * - Entries in reading order: Composition, header resources (Patient, Encounter, document author and
 *   custodian), then the entries of each Composition section in section order (panel members, specimens,
 *   medications and orders right after the entry that uses them), then supporting participants
 *   (PractitionerRole, Practitioner, Organization, Location, Device) and Provenance.
 * - Banner comments for the document and each section; one comment per entry naming the resource, its
 *   profile and the CDA construct it comes from.
 * - Reference.display on every reference whose target has a name or a coded meaning.
 * - Two-space indentation; narrative XHTML kept as generated.
 *
 * Comments and order carry no meaning in FHIR: the Bundle content is the same, and the JSON
 * serializer ignores comments. Exposes window.ecr137AnnotateFhirBundle(xml, kind) -> xml string.
 */
(function (root) {
  'use strict';

  const FHIR = 'http://hl7.org/fhir';
  const RULE = '********************************************************';
  const CCDA = '2.16.840.1.113883.10.20.22';
  const ECR = '2.16.840.1.113883.10.20.15';

  // CDA section templates of the eICR sections (by section LOINC code)
  const EICR_SECTIONS = {
    '46240-8': `Encounters Section (entries required) ${CCDA}.2.22.1`,
    '30954-2': `Results Section (entries required) ${CCDA}.2.3.1 and Specimen Section ${CCDA}.2.3 (both LOINC 30954-2, one FHIR section)`,
    '29299-5': `Reason for Visit Section ${CCDA}.2.12`,
    '10164-2': 'History of Present Illness Section 1.3.6.1.4.1.19376.1.5.3.1.3.4',
    '29549-3': `Medications Administered Section ${CCDA}.2.38`,
    '11450-4': `Problem Section (entries required) ${CCDA}.2.5.1`,
    '29762-2': `Social History Section ${CCDA}.2.17 and the Occupational Data for Health Social History Section (both LOINC 29762-2, one FHIR section)`,
    '8716-3': `Vital Signs Section (entries required) ${CCDA}.2.4.1`,
    '10160-0': `Medications Section (entries required) ${CCDA}.2.1.1`,
    '11369-6': `Immunizations Section (entries required) ${CCDA}.2.2.1`,
    '47519-4': `Procedures Section (entries required) ${CCDA}.2.7.1`,
    '48765-2': `Allergies and Intolerances Section (entries required) ${CCDA}.2.6.1`,
    '42346-7': `Admission Medications Section ${CCDA}.2.44`,
    '46241-6': `Hospital Admission Diagnosis Section ${CCDA}.2.43`,
    '11535-2': `Hospital Discharge Diagnosis Section ${CCDA}.2.24`,
    '11348-0': `Past Medical History Section ${CCDA}.2.20`,
    '10187-3': 'Review of Systems Section 1.3.6.1.4.1.19376.1.5.3.1.3.18',
    '10154-3': 'Chief Complaint Section 1.3.6.1.4.1.19376.1.5.3.1.1.13.2.1',
    '83910-0': `Emergency Outbreak Information Section ${ECR}.2.2.4`
  };
  const RR_SECTIONS = {
    '88084-9': 'Reportability Response Subject: the subject line of the response',
    '88082-3': 'Electronic Initial Case Report: the eICR this response is about and its processing status',
    '55112-7': 'Reportability Response Summary: the determinations, one Relevant Reportable Condition per condition'
  };

  // Source of each resource, by profile (last URL segment)
  const BY_PROFILE = {
    'eicr-composition': `the CDA eICR header (US Realm Header ${CCDA}.1.1, eICR ${ECR}.2) and its structuredBody section list`,
    'us-ph-patient': 'CDA recordTarget/patientRole/patient; Birth Sex Observation and race/ethnicity become extensions',
    'eicr-encounter': 'CDA componentOf/encompassingEncounter',
    'us-ph-location': 'CDA encompassingEncounter/location/healthCareFacility',
    'us-ph-condition': `Problem Observation ${CCDA}.4.4 in a Problem Concern Act ${CCDA}.4.3; trigger code flag from Initial Case Report Trigger Code Problem Observation ${ECR}.2.3.3`,
    'us-core-observation-lab': `Result Organizer ${CCDA}.4.1 (panel) or Result Observation ${CCDA}.4.2; trigger code flag from Initial Case Report Trigger Code Result Observation ${ECR}.2.3.2`,
    'us-core-vital-signs': `Vital Sign Observation ${CCDA}.4.27`,
    'us-core-blood-pressure': `Vital Sign Observations ${CCDA}.4.27 for systolic and diastolic blood pressure, as one panel`,
    'us-core-smokingstatus': `Smoking Status - Meaningful Use ${CCDA}.4.78`,
    'us-ph-pregnancy-status-observation': `Pregnancy Observation ${ECR}.3.8`,
    'us-ph-travel-history': `Travel History ${ECR}.2.3.1`,
    'us-ph-emergency-outbreak-information': `Emergency Outbreak Information Observation ${ECR}.2.3.40`,
    'us-core-immunization': `Immunization Activity ${CCDA}.4.52`,
    'us-ph-medicationadministration': `Medication Activity ${CCDA}.4.16 in the Medications Administered Section`,
    'us-core-medication': `Medication Information ${CCDA}.4.23 or Immunization Medication Information ${CCDA}.4.54`,
    'eicr-procedure': `Procedure Activity Procedure ${CCDA}.4.14 or Specimen Collection Procedure ${CCDA}.4.415`,
    'eicr-servicerequest': `lab order (Planned Procedure ${CCDA}.4.41) in a Result Organizer`,
    'us-core-practitioner': 'the person in a CDA author, performer or assignedEntity participation',
    'us-ph-practitionerrole': 'a CDA author, performer or assignedEntity participation: the person in the role of the organization',
    'us-ph-organization': 'a CDA representedOrganization, custodian, serviceProviderOrganization or performing lab',
    'rr-composition': 'the reportability determination for the eICR; CDA counterpart: the RR document',
    'rr-eicr-processing-status-observation': 'eICR Processing Status; CDA counterpart: eICR Processing Status Observation',
    'rr-eicr-processing-status-reason-observation': 'eICR Processing Status Reason; CDA counterpart: eICR Processing Status Reason Observation',
    'rr-relevant-reportable-condition-observation': 'a condition the reportability engine evaluated, coded with its RCTC reportable condition code',
    'rr-reportability-information-observation': 'the determination for one condition and jurisdiction, with the rule that matched and the reporting timeframe',
    'rr-summary': 'the summary text of the response; CDA counterpart: the RR summary',
    'rr-rules-authoring-agency-organization': 'the public health agency that authored the reporting rules',
    'rr-routing-entity-organization': 'the public health agency the eICR is routed to',
    'rr-responsible-agency-organization': 'the public health agency responsible for the condition'
  };
  // Source of resources without a profile
  const BY_CODE = {
    '11778-8': `Estimated Date of Delivery ${ECR}.3.1 inside the Pregnancy Observation`,
    '18185-9': `Gestational age (Social History Observation ${CCDA}.4.38) inside the Pregnancy Observation`,
    '76691-5': `Gender Identity Observation (Social History Observation ${CCDA}.4.38)`,
    '87729-0': `Occupational Data for Health Observation (Social History Observation ${CCDA}.4.38)`,
    '21843-8': `Occupational Data for Health Industry Observation ${CCDA}.4.216`
  };
  const BY_TYPE = {
    Device: 'CDA assignedAuthoringDevice: the system that authored the document',
    Provenance: `CDA Author Participation ${CCDA}.4.119 on an entry: who recorded it and when`,
    Location: 'the address of a CDA representedOrganization'
  };

  const SUPPORTING = ['PractitionerRole', 'Practitioner', 'Organization', 'Location', 'Device', 'Provenance'];
  const HEADER = ['Patient', 'Encounter'];

  const kids = (el, name) => {
    const out = [];
    for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!name || c.localName === name)) out.push(c);
    return out;
  };
  const kid = (el, name) => kids(el, name)[0] || null;
  const val = (el, name) => { const k = el && kid(el, name); return k ? (k.getAttribute('value') || '') : ''; };
  const clean = s => String(s || '').replace(/\s+/g, ' ').replace(/-{2,}/g, '-').trim();

  function humanName(el) {
    const n = el && kid(el, 'name');
    if (!n) return '';
    if (val(n, 'text')) return val(n, 'text');
    return [...kids(n, 'prefix'), ...kids(n, 'given'), ...kids(n, 'family')].map(x => x.getAttribute('value')).filter(Boolean).join(' ');
  }
  function conceptText(cc) {
    if (!cc) return '';
    const c = kids(cc, 'coding').find(x => val(x, 'display'));
    return (c && val(c, 'display')) || val(cc, 'text') || (kid(cc, 'coding') && val(kid(cc, 'coding'), 'code')) || '';
  }

  function makeDescriber(byUrl) {
    const cache = new Map();
    const describe = url => {
      if (cache.has(url)) return cache.get(url);
      cache.set(url, '');
      const r = byUrl.get(url);
      let d = '';
      if (r) {
        switch (r.localName) {
          case 'Patient': case 'Practitioner': case 'RelatedPerson': d = humanName(r); break;
          case 'Organization': case 'Location': d = val(r, 'name'); break;
          case 'PractitionerRole': {
            const p = kid(r, 'practitioner'), o = kid(r, 'organization');
            const pn = p ? describe(val(p, 'reference')) : '', on = o ? describe(val(o, 'reference')) : '';
            d = pn && on ? `${pn}, ${on}` : (pn || on);
            break;
          }
          case 'Device': d = val(kid(r, 'deviceName'), 'name'); break;
          case 'Composition': d = val(r, 'title'); break;
          case 'Encounter': d = conceptText(kid(r, 'type')) || (kid(r, 'class') && (val(kid(r, 'class'), 'display') || val(kid(r, 'class'), 'code'))) || ''; break;
          case 'Immunization': d = conceptText(kid(r, 'vaccineCode')); break;
          case 'MedicationAdministration': {
            const m = kid(r, 'medicationReference');
            d = conceptText(kid(r, 'medicationCodeableConcept')) || (m ? describe(val(m, 'reference')) : '');
            break;
          }
          case 'Observation': {
            const det = kids(r, 'extension').find(x => /us-ph-determination-of-reportability-extension$/.test(x.getAttribute('url') || ''));
            if (det) { d = `${conceptText(kid(det, 'valueCodeableConcept'))} (${conceptText(kid(r, 'code'))})`; break; }
            const code = conceptText(kid(r, 'code'));
            const vq = kid(r, 'valueQuantity'), vc = kid(r, 'valueCodeableConcept'), vs = kid(r, 'valueString');
            const value = vq ? [val(vq, 'value'), val(vq, 'unit') || val(vq, 'code')].filter(Boolean).join(' ')
              : vc ? conceptText(vc) : (vs && val(vs, 'value').length <= 60) ? val(vs, 'value') : '';
            d = /rr-relevant-reportable-condition-observation$/.test(val(kid(r, 'meta'), 'profile')) ? (value || code)
              : (value ? `${code}: ${value}` : code);
            break;
          }
          default: d = conceptText(kid(r, 'code'));
        }
      }
      d = clean(d);
      cache.set(url, d);
      return d;
    };
    return describe;
  }

  function addDisplays(node, describe) {
    for (const c of kids(node)) {
      if (c.namespaceURI !== FHIR) continue;
      const ref = kid(c, 'reference');
      if (ref && !kid(c, 'display') && kids(c).every(k => ['reference', 'type', 'identifier', 'extension', 'id'].includes(k.localName))) {
        const d = describe(ref.getAttribute('value'));
        if (d) {
          const disp = c.ownerDocument.createElementNS(FHIR, 'display');
          disp.setAttribute('value', d);
          c.appendChild(disp);
        }
      }
      if (c.localName !== 'div') addDisplays(c, describe);
    }
  }

  function profileOf(r) {
    const m = kid(r, 'meta');
    const p = m && kid(m, 'profile');
    return p ? p.getAttribute('value').split('/').pop() : '';
  }
  function entryNote(r, describe, url, kind, seen) {
    const prof = profileOf(r);
    const code = (() => { const c = kid(r, 'code'); const cd = c && kid(c, 'coding'); return cd ? val(cd, 'code') : ''; })();
    const what = describe(url);
    let src = BY_PROFILE[prof] || BY_CODE[code] || BY_TYPE[r.localName] || '';
    if (kind === 'RR') {
      const aphl = kids(r, 'identifier').some(i => val(i, 'value') === 'urn:oid:2.16.840.1.114222.4.1.217446');
      if (r.localName === 'Device') src = 'AIMS, the APHL platform that evaluated the eICR: the RR author';
      else if (aphl) src = 'APHL, the RR custodian and the performer of the processing status and determinations';
      else if (!prof.startsWith('rr-')) src = `the eICR Bundle${src ? ` (there: ${src})` : ''}`;
    }
    const head = clean(`${r.localName}${prof ? ` (${prof})` : ''}${what ? `: ${what}` : ''}`);
    const lines = [head, ...fhirLines(r, prof, seen)];
    if (src) lines.push(`${kind === 'RR' ? 'Source' : 'CDA'}: ${clean(src)}`);
    return ' ' + lines.join('\n       ') + ' ';
  }

  // What the implementation guide says about the profile (js/fhir/ig-notes.js); the full notes on the
  // first entry with that profile, a pointer to them on the others
  const igNotes = () => root.ECR137_IG_NOTES || { profiles: {}, sections: {} };
  function fhirLines(r, prof, seen) {
    const n = prof && igNotes().profiles[prof];
    if (!n) return prof ? [] : [`FHIR: base FHIR R4 ${r.localName}, no profile: https://hl7.org/fhir/R4/${r.localName.toLowerCase()}.html`];
    if (seen.has(prof)) return [`FHIR: ${n.title} (${n.guide}); conformance notes on the first ${prof} entry`];
    seen.add(prof);
    const out = [`FHIR: ${n.title} (${n.guide}). ${n.summary}`];
    const keep = l => (l.startsWith('  ') ? '  ' : '') + clean(l);
    const res = [keep(out[0])];
    if (n.required.length) res.push(...wrapList('  Required: ', n.required));
    if (n.mustSupport.length) res.push(...wrapList('  Must Support: ', n.mustSupport));
    res.push(`  ${n.url}`);
    return res;
  }
  // "  Required: a, b, c" wrapped at about 110 characters, continuation lines aligned under the first item
  function wrapList(label, items) {
    const lines = []; let cur = label; const ind = ' '.repeat(label.length);
    items.forEach((it, i) => {
      const piece = it + (i < items.length - 1 ? ',' : '');
      if (cur.length + piece.length + 1 > 110 && cur.trim() !== label.trim()) { lines.push(cur.trimEnd()); cur = ind; }
      cur += (cur.endsWith(' ') ? '' : ' ') + piece;
    });
    lines.push(cur);
    return lines;
  }
  function sectionLines(kind, code) {
    const comp = kind === 'RR' ? 'rr-composition' : 'eicr-composition';
    const sec = (igNotes().sections[comp] || {})[code];
    if (!sec) return [`FHIR: not one of the ${comp} named section slices (section slicing is open)`];
    const out = [`FHIR: ${comp} section slice ${sec.slice} (${sec.card}). ${sec.summary}`];
    const res = [clean(out[0])];
    for (const e of sec.entries) res.push('  Entries: ' + clean([e.slice, e.card, e.targets.join(' or ')].filter(Boolean).join(' ')));
    return res;
  }

  // ---- serializer: two-space indentation, narrative XHTML as generated ----
  const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
  function serialize(node, depth, out, isRoot) {
    const pad = '  '.repeat(depth);
    if (node.nodeType === 8) {
      const text = node.data;
      if (text.includes('\n')) out.push(`${pad}<!--${text.replace(/\n(?!$)/g, '\n')}-->`);
      else out.push(`${pad}<!-- ${text.trim()} -->`);
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.namespaceURI !== FHIR) {
      out.push(pad + new root.XMLSerializer().serializeToString(node));
      return;
    }
    let attrs = isRoot ? ` xmlns="${FHIR}"` : '';
    for (const a of Array.from(node.attributes)) {
      if (a.name === 'xmlns' || a.name.startsWith('xmlns:')) continue;
      attrs += ` ${a.name}="${escAttr(a.value)}"`;
    }
    const children = [];
    for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 || c.nodeType === 8) children.push(c);
    if (!children.length) { out.push(`${pad}<${node.localName}${attrs}/>`); return; }
    out.push(`${pad}<${node.localName}${attrs}>`);
    for (const c of children) serialize(c, depth + 1, out, false);
    out.push(`${pad}</${node.localName}>`);
  }

  function banner(doc, lines, indent) {
    const pad = ' '.repeat(indent);
    return doc.createComment('\n' + [RULE, ...lines, RULE].map(l => pad + l).join('\n') + '\n' + ' '.repeat(Math.max(indent - 8, 0)));
  }

  function annotate(xml, kind) {
    const doc = new root.DOMParser().parseFromString(xml, 'application/xml');
    const bundle = doc.documentElement;
    if (!bundle || bundle.localName !== 'Bundle') return xml;
    const entries = kids(bundle, 'entry');
    const byUrl = new Map(), entryByUrl = new Map();
    for (const e of entries) {
      const u = val(e, 'fullUrl'); const res = kid(e, 'resource'); const r = res && kids(res)[0];
      if (u && r) { byUrl.set(u, r); entryByUrl.set(u, e); }
    }
    const describe = makeDescriber(byUrl);
    for (const r of byUrl.values()) addDisplays(r, describe);

    const compEntry = entries.find(e => { const res = kid(e, 'resource'); return res && kids(res)[0] && kids(res)[0].localName === 'Composition'; });
    const comp = compEntry && kids(kid(compEntry, 'resource'))[0];
    const refsIn = el => {
      const out = [];
      const walk = n => { for (const c of kids(n)) { if (c.localName === 'reference' && c.hasAttribute('value')) out.push(c.getAttribute('value')); else if (c.localName !== 'div') walk(c); } };
      walk(el);
      return out;
    };

    const placed = new Set();
    const groups = [];
    const place = (u, list) => {
      if (!u || placed.has(u) || !entryByUrl.has(u)) return;
      placed.add(u);
      list.push(u);
      const r = byUrl.get(u);
      for (const name of ['hasMember', 'derivedFrom', 'specimen', 'medicationReference', 'basedOn', 'partOf', 'focus']) {
        for (const k of kids(r, name)) {
          const t = val(k, 'reference');
          if (byUrl.has(t) && !SUPPORTING.includes(byUrl.get(t).localName) && !HEADER.includes(byUrl.get(t).localName)) place(t, list);
        }
      }
    };

    if (compEntry) placed.add(val(compEntry, 'fullUrl'));
    // header resources
    const header = [];
    for (const u of byUrl.keys()) if (byUrl.get(u).localName === 'Patient') place(u, header);
    for (const u of byUrl.keys()) if (byUrl.get(u).localName === 'Encounter') place(u, header);
    groups.push({ title: ['Header resources: the patient and the encounter', 'CDA: recordTarget and componentOf/encompassingEncounter'], urls: header });

    // sections
    const sectionMap = kind === 'RR' ? RR_SECTIONS : EICR_SECTIONS;
    if (comp) {
      for (const s of kids(comp, 'section')) {
        const code = (() => { const c = kid(s, 'code'); const cd = c && kid(c, 'coding'); return cd ? val(cd, 'code') : ''; })();
        const title = val(s, 'title') || code;
        const list = [];
        for (const en of kids(s, 'entry')) place(val(en, 'reference'), list);
        const n = kids(s, 'entry').length;
        const sl = sectionLines(kind, code);
        const cdaLine = kind === 'RR' ? (sectionMap[code] || '') : `CDA: ${sectionMap[code] || 'section with LOINC ' + code}`;
        s.parentNode.insertBefore(doc.createComment(' ' + [clean(`Section: ${title} (LOINC ${code}), ${n ? `${n} ${n === 1 ? 'entry' : 'entries'}` : 'narrative only'}`), ...sl, cdaLine].filter(Boolean).join('\n             ') + ' '), s);
        if (list.length) groups.push({ title: [`Section: ${title} (LOINC ${code})`, ...sl, cdaLine].filter(Boolean), urls: list });
      }
    }
    // anything else clinical, then supporting participants, then provenance
    const rest = [];
    for (const u of byUrl.keys()) if (!SUPPORTING.includes(byUrl.get(u).localName)) place(u, rest);
    if (rest.length) groups.push({ title: ['Other resources referenced by the entries above'], urls: rest });
    const support = [];
    for (const t of ['PractitionerRole', 'Practitioner', 'Organization', 'Location', 'Device']) for (const u of byUrl.keys()) if (byUrl.get(u).localName === t) place(u, support);
    if (support.length) groups.push({ title: ['Participants: practitioners, their roles, organizations, locations and devices',
      'CDA: author, performer, custodian and assignedEntity participations',
      'Each CDA participation becomes its own PractitionerRole, so one clinician appears once per participation'], urls: support });
    const prov = [];
    for (const u of byUrl.keys()) place(u, prov);
    if (prov.length) groups.push({ title: ['Provenance: who recorded each entry and when', `CDA: Author Participation ${CCDA}.4.119 on entries`], urls: prov });

    // rebuild the Bundle: non-entry children first, then entries with comments
    for (const e of entries) bundle.removeChild(e);
    for (let c = bundle.firstChild; c;) { const n = c.nextSibling; if (c.nodeType === 3 || c.nodeType === 8) bundle.removeChild(c); c = n; }
    const head = kind === 'RR'
      ? ['FHIR Reportability Response (RR) Document Bundle', 'HL7 eCR FHIR IG 2.1.2 (FHIR R4, US Core 3.1.1), profile rr-document-bundle',
        'Built by eCR-137 from the form data and the reportability engine result',
        'Bundle.entry order: Composition first, then the resources in the order the sections use them;',
        'every reference points to an entry fullUrl in this Bundle']
      : ['FHIR electronic Initial Case Report (eICR) Document Bundle', 'HL7 eCR FHIR IG 2.1.2 (FHIR R4, US Core 3.1.1), profile eicr-document-bundle',
        'Converted by eCR-137 from its CDA eICR with lantanagroup/eCRTransforms cda2fhir-r4',
        'Bundle.entry order: Composition first, then the resources in the order the sections use them;',
        'every reference points to an entry fullUrl in this Bundle'];
    bundle.insertBefore(banner(doc, head, 8), bundle.firstChild);
    const seen = new Set();
    const append = (urls, title) => {
      bundle.appendChild(banner(doc, title, 8));
      for (const u of urls) {
        const e = entryByUrl.get(u);
        bundle.appendChild(doc.createComment(entryNote(byUrl.get(u), describe, u, kind, seen)));
        bundle.appendChild(e);
      }
    };
    if (compEntry) {
      append([val(compEntry, 'fullUrl')], [kind === 'RR' ? 'Composition: the RR header and its sections' : 'Composition: the eICR header and its sections',
        kind === 'RR' ? 'Composition.section.entry references the determinations below' : 'CDA: ClinicalDocument header and structuredBody; Composition.section.entry references the entries below']);
      entryByUrl.set(val(compEntry, 'fullUrl'), compEntry);
    }
    for (const g of groups) if (g.urls.length) append(g.urls, g.title);

    const out = ['<?xml version="1.0" encoding="UTF-8"?>'];
    serialize(bundle, 0, out, true);
    return out.join('\n') + '\n';
  }

  root.ecr137AnnotateFhirBundle = annotate;
})(typeof window !== 'undefined' ? window : globalThis);
