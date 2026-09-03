/**
 * Evaluator v2 — condition rule-pack evaluation (ADR-002 result contract).
 * A pack is the per-condition source of truth: provenance, coverage,
 * declared gaps, and a list of rules whose logic is a nested tree.
 * See docs/schemas/rule-pack.schema.json.
 */
import { STATES } from './predicates.js';
import { evaluateNode } from './logic-evaluator.js';
import { PREDICATES } from './predicates.js';

const MNEMONIC_RE = /^(.*?)_V(\d+)$/;

// Predicates not implemented platform-wide (no evidence-model support yet).
// A skipped one of these does NOT reduce a condition's coverage — it's the
// same missing capability for every condition, tracked in the backlog, not a
// per-condition data gap.
const PLATFORM_UNIMPLEMENTED = new Set(['withinTimebox']);

// Administrative/gate predicate types that should not trigger "partial match" signals.
// These are demographic eligibility checks, not clinical evidence.
const GATE_TYPES = new Set(['age', 'pregnancy', 'deceased', 'discharge_disposition', 'encounter']);

/**
 * Validate a pack. Returns { ok, issues[] }. Unknown predicates and
 * missing OIDs are issues (they degrade coverage) but not fatal —
 * PIQI's declared-but-unimplemented pattern, failing visible not silent.
 */
export function validatePack(pack, opts = {}) {
    const issues = [];
    if (!pack || typeof pack !== 'object') return { ok: false, issues: ['pack is not an object'] };
    if (!MNEMONIC_RE.test(pack.mnemonic || '')) issues.push(`mnemonic "${pack.mnemonic}" must match NAME_V<digits>`);
    if (!pack.conditionId) issues.push('missing conditionId');
    if (!pack.evidenceModel) issues.push('missing evidenceModel');
    if (opts.evidenceModel && pack.evidenceModel !== opts.evidenceModel) {
        issues.push(`evidence model mismatch: pack expects ${pack.evidenceModel}, session is ${opts.evidenceModel}`);
        return { ok: false, issues }; // version guard is fatal (PIQI model check)
    }
    if (!Array.isArray(pack.rules) || pack.rules.length === 0) issues.push('pack has no rules');
    (pack.rules || []).forEach(rule => walkNode(rule.logic, `rule ${rule.id}`, issues));
    return { ok: issues.length === 0, issues };
}

function walkNode(node, path, issues) {
    if (!node || typeof node !== 'object') { issues.push(`${path}: malformed node`); return; }
    if (node.predicate) {
        if (!PREDICATES[node.predicate]) issues.push(`${path}: unknown predicate "${node.predicate}"`);
        return;
    }
    if (node.all) return node.all.forEach((n, i) => walkNode(n, `${path}.all[${i}]`, issues));
    if (node.any) return node.any.forEach((n, i) => walkNode(n, `${path}.any[${i}]`, issues));
    if (node.atLeast) return (node.atLeast.of || []).forEach((n, i) => walkNode(n, `${path}.atLeast[${i}]`, issues));
    if (node.not) return walkNode(node.not, `${path}.not`, issues);
    issues.push(`${path}: unknown node kind ${Object.keys(node).join(',')}`);
}

/**
 * Evaluate one pack against session evidence.
 * ctx: { evaluatedAt?: ISO string, evidenceModel?: string }
 */
export function evaluatePack(pack, evidence, ctx = {}) {
    const guard = validatePack(pack, { evidenceModel: ctx.evidenceModel });
    if (!guard.ok && guard.issues.some(i => i.startsWith('evidence model mismatch'))) {
        throw new Error(guard.issues.join('; '));
    }

    const ruleResults = [];
    let anyReportable = false;
    let anySkipped = false;

    for (const rule of pack.rules || []) {
        const trace = [];
        const ruleCtx = { ...ctx, trace };

        // `when` gate: PIQI conditional-SAM semantics — not applicable => SKIPPED.
        if (rule.when) {
            const gate = evaluateNode(rule.when, evidence, { ...ctx, trace: [] });
            if (gate.state !== STATES.SUCCEEDED) {
                ruleResults.push({ id: rule.id, description: rule.description, state: STATES.SKIPPED, reason: 'when-gate not satisfied', trace: [] });
                continue;
            }
        }

        const outcome = evaluateNode(rule.logic, evidence, ruleCtx);
        if (outcome.state === STATES.SUCCEEDED) anyReportable = true;
        // Platform-wide unimplemented predicates (e.g. timebox — we don't even
        // have event dates yet) are NOT per-condition coverage gaps; ignore
        // them when judging coverage so a condition isn't marked "partial"
        // for something that affects every condition equally.
        if (trace.some(t => (t.state === STATES.SKIPPED || t.state === STATES.ERRORED) && !PLATFORM_UNIMPLEMENTED.has(t.predicate))) anySkipped = true;

        // Extract skipped gates (unimplemented checks like timebox that don't affect reportability)
        const skippedGates = trace.filter(t => t.state === STATES.SKIPPED && PLATFORM_UNIMPLEMENTED.has(t.predicate))
            .map(t => ({ predicate: t.predicate, reason: t.reason }));

        ruleResults.push({
            id: rule.id,
            description: rule.description,
            state: outcome.state,
            matchedEvidence: trace.filter(t =>
                t.state === STATES.SUCCEEDED && t.matchedData && !GATE_TYPES.has(t.matchedData.type)
            ).map(t => t.matchedData),
            skipped: trace.filter(t => t.state === STATES.SKIPPED).map(t => ({ predicate: t.predicate, reason: t.reason })),
            errors: trace.filter(t => t.state === STATES.ERRORED).map(t => ({ predicate: t.predicate, reason: t.reason })),
            skippedGates,  // Unimplemented gates that don't affect verdict but note incomplete evaluation
            trace
        });
    }

    const declaredGaps = pack.gaps || [];
    const coverageStatus =
        pack.coverage === 'draft' ? 'draft'
        : pack.coverage === 'mechanical' ? 'mechanical' // auto-converted, matches legacy, not yet curated
        : (declaredGaps.length > 0 || anySkipped || pack.coverage === 'partial') ? 'partial'
        : 'complete';

    return {
        evaluatedAt: ctx.evaluatedAt || new Date().toISOString(),
        ruleSet: {
            id: pack.mnemonic,
            version: pack.source ? `${pack.source.rckmsVersion || ''} ${pack.source.rckmsDate || ''}`.trim() : 'unversioned',
            source: pack.source || null,
            evidenceModel: pack.evidenceModel
        },
        conditionId: pack.conditionId,
        conditionName: pack.name,
        status: anyReportable ? 'reportable' : 'not-reportable',
        coverageStatus,
        rules: ruleResults,
        matchedEvidence: ruleResults.flatMap(r => r.matchedEvidence || []),
        gaps: declaredGaps,
        validation: guard.issues
    };
}
