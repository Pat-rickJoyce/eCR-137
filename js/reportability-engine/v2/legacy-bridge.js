/**
 * Bridges evaluator-v2 pack results into the result shape the existing
 * UIController consumes ({isReportable, triggeredConditions,
 * potentialConditions}), so the panel needs no changes while both
 * engines coexist. Conditions covered by a pack are removed from the
 * legacy result and replaced by their v2 verdicts.
 */
import { STATES } from './predicates.js';

export function mergeV2IntoLegacyResult(legacyResult, packResults) {
    const packedIds = new Set(packResults.map(r => r.conditionId));
    const merged = {
        isReportable: false,
        triggeredConditions: legacyResult.triggeredConditions.filter(c => !packedIds.has(c.conditionId)),
        potentialConditions: legacyResult.potentialConditions.filter(c => !packedIds.has(c.conditionId)),
        v2: packResults // full contract available for future UI
    };

    for (const r of packResults) {
        const shaped = toLegacyCondition(r);
        if (r.status === 'reportable') merged.triggeredConditions.push(shaped);
        else if (shaped.matchedRules.length > 0 || hasPartialSignal(r)) merged.potentialConditions.push(shaped);
    }
    merged.isReportable = merged.triggeredConditions.length > 0;
    return merged;
}

function hasPartialSignal(packResult) {
    return packResult.rules.some(rule =>
        rule.state === STATES.FAILED && (rule.matchedEvidence || []).length > 0);
}

/** Human summary of unmet criteria for partial matches, deduped
 *  (e.g. three Hospitalized VS variants collapse to one label). */
export function describeUnmet(packResult) {
    const labels = new Set();
    for (const rule of packResult.rules) {
        if (rule.state === STATES.SUCCEEDED || (rule.matchedEvidence || []).length === 0) continue;
        for (const t of rule.trace || []) {
            if (t.state !== STATES.FAILED || !t.predicate) continue;
            if (t.predicate === 'ageComparison') {
                labels.add(`age ${t.params.op} ${t.params.value} ${t.params.unit}`);
            } else if (t.params && t.params.name) {
                labels.add(t.params.name.replace(/\s*\((SNOMED|ICD10CM|EncounterTypeCode|ActEncounterCode)\)\s*$/, ''));
            }
        }
    }
    return [...labels];
}

function toLegacyCondition(packResult) {
    const rules = packResult.rules
        .filter(rule => rule.state === STATES.SUCCEEDED ||
            (rule.state === STATES.FAILED && (rule.matchedEvidence || []).length > 0))
        .map(rule => ({
            ruleId: rule.id,
            ruleName: `${rule.id}${rule.state === STATES.SUCCEEDED ? '' : ' (partial)'}`,
            ruleDescription: rule.description,
            passed: rule.state === STATES.SUCCEEDED,
            partialMatch: rule.state !== STATES.SUCCEEDED,
            skippedGates: rule.skippedGates || [],  // Unimplemented gates like timebox
            groups: (rule.matchedEvidence || []).map(m => ({
                passed: true,
                matchedCriterion: { valueSetName: m.valueSetName },
                matchedData: m
            }))
        }));

    const unmet = packResult.status === 'reportable' ? [] : describeUnmet(packResult);

    return {
        conditionId: packResult.conditionId,
        conditionName: packResult.conditionName,       // clean name — no smuggled metadata
        packId: packResult.ruleSet.id,                 // rendered as a subtle badge
        coverage: packResult.coverageStatus,
        unmet,                                          // array, rendered as its own line
        isReportable: packResult.status === 'reportable',
        hasPartialMatch: rules.some(r => r.partialMatch),
        matchedRules: rules.filter(r => r.passed),
        v2: packResult
    };
}
