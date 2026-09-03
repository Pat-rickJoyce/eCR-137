/**
 * Evaluator v2 — predicate registry (the SAM analogue).
 * Contract: every predicate is (evidence, params, ctx) =>
 *   { state: SUCCEEDED|FAILED|SKIPPED|ERRORED, matchedData?, reason? }
 * Predicates are pure booleans over the session evidence; scoring,
 * labeling and coverage live in the pack/result layer, never here.
 * See docs/architecture/rules-process-proposal.md §3.2.
 */

export const STATES = Object.freeze({
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED',
    ERRORED: 'ERRORED'
});

const succeeded = (matchedData) => ({ state: STATES.SUCCEEDED, matchedData });
const failed = () => ({ state: STATES.FAILED });
const skipped = (reason) => ({ state: STATES.SKIPPED, reason });
const errored = (reason) => ({ state: STATES.ERRORED, reason });

/** Value-set gap guard: packs may declare criteria whose OID is not yet
 *  extracted from the source release. Those SKIP (visibly), never FAIL. */
function withOid(params, fn) {
    if (!params || !params.oid) return skipped('value-set-gap: no OID available');
    return fn(params.oid);
}

const DAYS_PER = { days: 1, weeks: 7, months: 30.4375, years: 365.25 };

function ageInDays(evidence, ctx) {
    const demo = evidence.demographics || {};
    if (typeof demo.ageDays === 'number') return demo.ageDays;
    if (demo.birthDate) {
        const at = ctx && ctx.evaluatedAt ? new Date(ctx.evaluatedAt) : new Date();
        const dob = new Date(demo.birthDate);
        if (!isNaN(dob)) return (at - dob) / 86400000;
    }
    return null;
}

export const PREDICATES = {

    diagnosisInValueSet(evidence, params) {
        return withOid(params, (oid) => {
            const match = (evidence.diagnoses || []).find(d => d.oids && d.oids.includes(oid));
            return match
                ? succeeded({ type: 'diagnosis', code: match.code, display: match.name || match.code, valueSetName: params.name })
                : failed();
        });
    },

    problemInValueSet(evidence, params) {
        return withOid(params, (oid) => {
            const match = (evidence.problems || []).find(p =>
                p.oids && p.oids.includes(oid) && (!params.status || p.status === params.status));
            return match
                ? succeeded({ type: 'problem', code: match.code, display: match.name || match.code, status: match.status, valueSetName: params.name })
                : failed();
        });
    },

    labTestInValueSet(evidence, params) {
        return withOid(params, (oid) => {
            const match = (evidence.labs || []).find(l => l.oids && l.oids.includes(oid));
            return match
                ? succeeded({ type: 'lab_test', code: match.code, display: match.display || match.testName || match.code, valueSetName: params.name })
                : failed();
        });
    },

    labResultInValueSet(evidence, params) {
        return withOid(params, (oid) => {
            const match = (evidence.labs || []).find(l => l.resultOids && l.resultOids.includes(oid));
            return match
                ? succeeded({ type: 'lab_result', testCode: match.code, resultCode: match.resultCode, resultDisplay: match.resultDisplay, valueSetName: params.name })
                : failed();
        });
    },

    /** A named test and coded result must occur on the same lab observation. */
    labTestWithResultInValueSet(evidence, params) {
        return withOid(params, (oid) => {
            if (!params.resultOid) return skipped('value-set-gap: no result OID available');
            const match = (evidence.labs || []).find(l =>
                l.oids && l.oids.includes(oid) &&
                l.resultOids && l.resultOids.includes(params.resultOid));
            return match
                ? succeeded({
                    type: 'lab_result',
                    testCode: match.code,
                    resultCode: match.resultCode,
                    resultDisplay: match.resultDisplay,
                    valueSetName: params.name,
                    resultValueSetName: params.resultName
                })
                : failed();
        });
    },

    labInterpretationIn(evidence, params) {
        const codes = params && params.codes ? params.codes : ['A', 'AA', 'HH', 'LL', 'H', 'L'];
        const match = (evidence.labs || []).find(l => l.interpretation && codes.includes(l.interpretation));
        return match
            ? succeeded({ type: 'lab_interpretation', testCode: match.code, interpretation: match.interpretation, valueSetName: params && params.name })
            : failed();
    },

    /** A named test and its interpretation must occur on the same lab observation. */
    labTestWithInterpretationIn(evidence, params) {
        return withOid(params, (oid) => {
            const codes = params.codes || ['A', 'AA', 'HH', 'LL', 'H', 'L'];
            const match = (evidence.labs || []).find(l =>
                l.oids && l.oids.includes(oid) && l.interpretation && codes.includes(l.interpretation));
            return match
                ? succeeded({
                    type: 'lab_interpretation',
                    testCode: match.code,
                    interpretation: match.interpretation,
                    valueSetName: params.name
                })
                : failed();
        });
    },

    medicationInValueSet(evidence, params) {
        return withOid(params, (oid) => {
            const match = (evidence.medications || []).find(m => m.oids && m.oids.includes(oid));
            return match
                ? succeeded({ type: 'medication', code: match.code, display: match.name || match.code, valueSetName: params.name })
                : failed();
        });
    },

    /** Day-precision age comparison; unit: days|weeks|months|years. */
    ageComparison(evidence, params, ctx) {
        const age = ageInDays(evidence, ctx);
        if (age === null) return skipped('no birthDate/ageDays in evidence');
        const limit = parseFloat(params.value) * (DAYS_PER[params.unit || 'years'] || DAYS_PER.years);
        if (isNaN(limit)) return errored(`ageComparison: bad value "${params.value}"`);
        const ops = {
            '<': age < limit, '<=': age <= limit,
            '>': age > limit, '>=': age >= limit
        };
        if (!(params.op in ops)) return errored(`ageComparison: unknown op "${params.op}"`);
        return ops[params.op]
            ? succeeded({ type: 'age', ageDays: Math.floor(age), op: params.op, limit: params.value, unit: params.unit })
            : failed();
    },

    pregnancyStatus(evidence, params) {
        const p = evidence.pregnancy || {};
        const want = !params || params.value !== 'not-pregnant';
        return p.isPregnant === want ? succeeded({ type: 'pregnancy', status: p.status }) : failed();
    },

    patientDeceased(evidence) {
        return evidence.demographics && evidence.demographics.isDeceased === true
            ? succeeded({ type: 'deceased', deathDate: evidence.demographics.deathDate })
            : failed();
    },

    encounterDischargeDispositionInValueSet(evidence, params) {
        return withOid(params, (oid) => {
            const match = (evidence.encounters || []).find(e =>
                e.dischargeDispositionOids && e.dischargeDispositionOids.includes(oid));
            return match
                ? succeeded({
                    type: 'discharge_disposition',
                    code: match.dischargeDispositionCode,
                    valueSetName: params.name
                })
                : failed();
        });
    },

    /** Fixes the NAS "Hospitalized" mis-modeling: encounter type, not lab/dx. */
    encounterType(evidence, params) {
        return withOid(params, (oid) => {
            const match = (evidence.encounters || []).find(e => e.oids && e.oids.includes(oid));
            return match
                ? succeeded({ type: 'encounter', code: match.typeCode, display: match.name || match.typeCode, valueSetName: params.name })
                : failed();
        });
    },

    /** Applicability gate helper for `when` clauses. */
    evidencePresent(evidence, params) {
        const arr = evidence[(params && params.kind) || ''];
        return Array.isArray(arr) && arr.length > 0 ? succeeded() : failed();
    },

    /* --- Declared-but-not-yet-implementable predicates. These SKIP with a
       reason so coverage degrades visibly instead of silently failing. --- */

    chiefComplaintMatches() {
        return skipped('not-implemented: chief complaint criteria');
    },

    epidemiologicalFact() {
        return skipped('not-implemented: epidemiological criteria');
    },

    withinTimebox() {
        return skipped('not-implemented: evidence model carries no event dates yet');
    }
};

/** PIQI SAM_Default analogue: unknown predicates ERROR loudly, never pass. */
export function runPredicate(name, evidence, params, ctx) {
    const fn = PREDICATES[name];
    if (!fn) return errored(`unknown predicate "${name}"`);
    try {
        return fn(evidence, params, ctx);
    } catch (e) {
        return errored(`${name}: ${e.message}`);
    }
}
