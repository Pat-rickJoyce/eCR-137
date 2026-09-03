/**
 * Session Evidence Adapter (ADR-001): converts the scraped+OID-enriched
 * form data shape into the canonical SEM_V1 session evidence model.
 * Consumers of the evidence (pack evaluator, future doc generation)
 * never see the form shape.
 */
export const EVIDENCE_MODEL = 'SEM_V1';

/**
 * Interim encounter-type → value-set-OID lookup. The RCTC-derived
 * code-oid-lookup does not carry encounter value sets, so the
 * "Hospitalized [Inpatient]" memberships live here until the
 * TerminologyProvider service (ADR-003) owns them.
 * Sources: HL7 ActEncounterCode inpatient members -> VS ...1146.1320;
 * SNOMED inpatient encounter concepts -> VS ...1146.1335.
 * CPT members (VS ...1146.1323) are not mapped yet - declared gap.
 */
const ENCOUNTER_CODE_TO_OIDS = {
    // HL7 ActEncounterCode (inpatient family)
    'IMP': ['2.16.840.1.113762.1.4.1146.1320'],
    'ACUTE': ['2.16.840.1.113762.1.4.1146.1320'],
    'NONAC': ['2.16.840.1.113762.1.4.1146.1320'],
    // SNOMED hospital admission / inpatient stay
    '32485007': ['2.16.840.1.113762.1.4.1146.1335'],
    '183452005': ['2.16.840.1.113762.1.4.1146.1335']
};

const DISCHARGE_DISPOSITION_CODE_TO_OIDS = {
    // HL7 table 0112: Expired
    '20': ['2.16.840.1.113762.1.4.1146.1108']
};

export function encounterOidsForCode(code) {
    return ENCOUNTER_CODE_TO_OIDS[(code || '').toUpperCase()] ||
        ENCOUNTER_CODE_TO_OIDS[code] || [];
}

export function dischargeDispositionOidsForCode(code) {
    return DISCHARGE_DISPOSITION_CODE_TO_OIDS[(code || '').toUpperCase()] ||
        DISCHARGE_DISPOSITION_CODE_TO_OIDS[code] || [];
}

export function toSessionEvidence(scraped) {
    const demo = scraped.demographics || {};
    return {
        evidenceModel: EVIDENCE_MODEL,
        demographics: {
            birthDate: demo.dob || null,
            // legacy scraper provides whole years only; keep as fallback
            ageDays: typeof demo.age === 'number' ? Math.round(demo.age * 365.25) : undefined,
            gender: demo.gender,
            isDeceased: demo.isDeceased === true,
            deathDate: demo.deathDate,
            state: demo.state,
            zip: demo.zip
        },
        pregnancy: {
            isPregnant: !!(scraped.pregnancy && scraped.pregnancy.isPregnant),
            status: scraped.pregnancy && scraped.pregnancy.status
        },
        diagnoses: (scraped.diagnoses || []).map(d => ({ code: d.code, name: d.name, oids: d.oids || [] })),
        problems: (scraped.problems || []).map(p => ({ code: p.code, name: p.name, status: p.status, oids: p.oids || [] })),
        labs: (scraped.labs || []).map(l => ({
            code: l.code || l.testCode,
            testName: l.testName,
            resultCode: l.resultKind === 'coded' ? l.resultValue : undefined,
            resultDisplay: l.resultDisplay,
            interpretation: l.interpretation,
            oids: l.oids || [],
            resultOids: l.resultOids || []
        })),
        medications: (scraped.medications || []).map(m => ({ code: m.code, name: m.name, oids: m.oids || [] })),
        encounters: (scraped.encounters || []).map(e => ({
            typeCode: e.typeCode,
            name: e.name,
            oids: (e.oids && e.oids.length) ? e.oids : encounterOidsForCode(e.typeCode),
            dischargeDispositionCode: e.dischargeDispositionCode,
            dischargeDispositionOids: (e.dischargeDispositionOids && e.dischargeDispositionOids.length)
                ? e.dischargeDispositionOids
                : dischargeDispositionOidsForCode(e.dischargeDispositionCode)
        })),
        immunizations: scraped.immunizations || []
    };
}

/** birthDate (if present) beats the year-precision ageDays fallback. */
export function normalizeAge(evidence) {
    if (evidence.demographics.birthDate) delete evidence.demographics.ageDays;
    return evidence;
}
