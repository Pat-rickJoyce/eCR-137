/**
 * Evaluator v2 — logic-tree evaluation.
 * Node kinds: { predicate, params }, { all: [...] }, { any: [...] },
 *             { atLeast: { n, of: [...] } }, { not: node }.
 * Semantics (PIQI-derived):
 *   - SKIPPED never fails a conjunction; it is excluded and recorded,
 *     degrading coverage instead of the verdict ("skip-not-fail").
 *   - ERRORED is treated like SKIPPED for the verdict but recorded as an
 *     error; nothing errored can ever satisfy a requirement.
 *   - A node whose children are all SKIPPED/ERRORED is itself SKIPPED.
 *   - In an `all` conjunction, every NON-gate (substantive) child is
 *     required: if any is SKIPPED/ERRORED the rule is indeterminate
 *     (SKIPPED), never reportable. This stops over-triggering when an
 *     unimplementable-but-required arm (e.g. an epidemiologic criterion,
 *     CAM R5-R7) is AND-ed with clinical evidence.
 *   - Nodes marked "gate": true (age, encounter type, timebox) constrain
 *     but never carry a rule. A failed gate fails the rule; a skipped gate
 *     (unimplemented timebox, or a value-set-gap encounter OID) is ignored;
 *     a gates-only conjunction SKIPs (can't report on gates alone).
 *   - Optional/alternative criteria belong in `any`, where a SKIPPED arm
 *     is simply one dead alternative (a sibling success still wins).
 */
import { STATES, runPredicate } from './predicates.js';

export function evaluateNode(node, evidence, ctx) {
    if (!node || typeof node !== 'object') {
        return record(ctx, node, { state: STATES.ERRORED, reason: 'malformed node' });
    }

    if (node.predicate) {
        const result = runPredicate(node.predicate, evidence, node.params, ctx);
        return record(ctx, node, result);
    }

    if (node.all) {
        const results = node.all.map(n => ({ ...evaluateNode(n, evidence, ctx), gate: !!n.gate }));
        return combineAll(results, ctx, node);
    }
    if (node.any) return combineAny(node.any.map(n => evaluateNode(n, evidence, ctx)), ctx, node);

    if (node.atLeast) {
        const { n, of } = node.atLeast;
        const results = (of || []).map(x => evaluateNode(x, evidence, ctx));
        const wins = results.filter(r => r.state === STATES.SUCCEEDED);
        const skips = results.filter(r => r.state === STATES.SKIPPED || r.state === STATES.ERRORED);
        let state;
        if (wins.length >= n) state = STATES.SUCCEEDED;
        else if (skips.length === results.length && results.length > 0) state = STATES.SKIPPED;
        else state = STATES.FAILED;
        return record(ctx, node, {
            state,
            detail: { required: n, succeeded: wins.length, skipped: skips.length, of: results.length }
        });
    }

    if (node.not) {
        const inner = evaluateNode(node.not, evidence, ctx);
        const state = inner.state === STATES.SUCCEEDED ? STATES.FAILED
            : inner.state === STATES.FAILED ? STATES.SUCCEEDED
            : inner.state;
        return record(ctx, node, { state });
    }

    return record(ctx, node, { state: STATES.ERRORED, reason: `unknown node kind: ${Object.keys(node).join(',')}` });
}

function combineAll(results, ctx, node) {
    // Any hard failure (including a failed gate, e.g. wrong age) fails the rule.
    if (results.some(r => r.state === STATES.FAILED)) return record(ctx, node, { state: STATES.FAILED });

    // Gates constrain but cannot carry a rule; a skipped gate (e.g. an
    // unimplemented timebox, or a value-set-gap encounter OID) is ignored.
    const substantive = results.filter(r => !r.gate);

    // Gates-only conjunction can't make a condition reportable on its own.
    if (substantive.length === 0) return record(ctx, node, { state: STATES.SKIPPED, reason: 'only gate criteria present' });

    // A required substantive conjunct that is SKIPPED/ERRORED makes the whole
    // rule indeterminate — NOT reportable. This prevents over-triggering when
    // an unimplementable-but-required arm (e.g. an epidemiologic criterion)
    // is AND-ed with clinical evidence.
    if (substantive.some(r => r.state !== STATES.SUCCEEDED)) {
        return record(ctx, node, { state: STATES.SKIPPED, reason: 'a required substantive criterion was skipped/indeterminate' });
    }
    return record(ctx, node, { state: STATES.SUCCEEDED });
}

function combineAny(results, ctx, node) {
    if (results.some(r => r.state === STATES.SUCCEEDED)) return record(ctx, node, { state: STATES.SUCCEEDED });
    if (results.some(r => r.state === STATES.FAILED)) return record(ctx, node, { state: STATES.FAILED });
    return record(ctx, node, { state: STATES.SKIPPED, reason: 'all children skipped/errored' });
}

/** Trace collector: ctx.trace accumulates every node outcome for
 *  explanation UIs and the ADR-002 result contract. */
function record(ctx, node, result) {
    if (ctx && ctx.trace) {
        ctx.trace.push({
            predicate: node && node.predicate,
            params: node && node.params,
            state: result.state,
            reason: result.reason,
            matchedData: result.matchedData,
            detail: result.detail
        });
    }
    return result;
}
