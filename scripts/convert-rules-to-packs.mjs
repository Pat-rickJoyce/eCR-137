#!/usr/bin/env node
/**
 * Mechanical conversion of the legacy rules-data.js into coverage:"draft"
 * rule packs — one per condition (rules-process-proposal.md, "Step 3").
 *
 * This is a STRICTLY BETTER draft than parsing the docx flat: the legacy
 * data already has OIDs resolved and criteria grouped per rule (the engine's
 * AND-across-groups / OR-within-group model), so a draft here reflects the
 * app's CURRENT shipped behavior, structured. Curation = compare each pack
 * against its Word doc "Rules: detailed logic" and fix, not rebuild.
 *
 * Output: rules/conditions/<ID>_V1.draft.json (inert — never embedded/run
 * until a human promotes it to <ID>_V1.json with fixtures).
 *
 * Run: node scripts/convert-rules-to-packs.mjs
 */
import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RulesLoader } from '../js/reportability-engine/rules-loader.js';
import { RULES_PROVENANCE } from '../js/reportability-engine/rules-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = join(root, 'rules', 'conditions');

// legacy criteria_type -> v2 predicate builder
function criterionToNode(c, gaps) {
    const oidRaw = (c.valueSetOid || '').trim();
    const oid = /^[\d.]+$/.test(oidRaw) ? oidRaw : null;
    if (!oid && c.valueSetName) gaps.add(`${c.valueSetName} — ${oidRaw || 'no OID'}`);
    const name = c.valueSetName || undefined;

    switch (c.type) {
        case 'diagnosis':
            return { predicate: 'diagnosisInValueSet', params: { oid, name } };
        case 'problem':
            return { predicate: 'problemInValueSet', params: { oid, name, ...(c.value ? { status: c.value } : {}) } };
        case 'lab_test':
        case 'lab_order':
            return { predicate: 'labTestInValueSet', params: { oid, name } };
        case 'lab_result':
            return { predicate: 'labResultInValueSet', params: { oid, name } };
        case 'lab_interpretation':
            return { predicate: 'labInterpretationIn', params: { name, codes: ['A', 'AA', 'HH', 'LL', 'H', 'L'] } };
        case 'medication':
            return { predicate: 'medicationInValueSet', params: { oid, name } };
        case 'demographic_age':
        case 'demographic': {
            // Only a real numeric threshold is a genuine age gate. Empty/0
            // values are parsing artifacts (legacy data is full of them) —
            // emit nothing rather than a bogus "age >= 0 years".
            const val = Number(c.value);
            if (!c.value || Number.isNaN(val) || val === 0 || !c.operator) return null;
            const txt = (name || '').toLowerCase();
            const unit = txt.includes('day') ? 'days' : txt.includes('week') ? 'weeks'
                : txt.includes('month') ? 'months' : 'years';
            return { gate: true, predicate: 'ageComparison', params: { op: c.operator, value: val, unit } };
        }
        case 'pregnancy':
            return { predicate: 'pregnancyStatus', params: { value: c.value || 'pregnant' } };
        default:
            gaps.add(`unmapped criteria type: ${c.type}`);
            return null;
    }
}

const CLINICAL = new Set(['diagnosis', 'problem', 'lab_test', 'lab_order', 'lab_result', 'lab_interpretation', 'medication']);

function dedupeNodes(nodes) {
    const seen = new Set();
    return nodes.filter(n => {
        const k = JSON.stringify(n);
        if (seen.has(k)) return false;
        seen.add(k); return true;
    });
}

function ruleToLogic(rule, gaps) {
    // AND across criteria groups, OR within a group (legacy engine semantics).
    const groups = Object.values(rule.criteriaGroups);
    const groupNodes = groups.map(members => {
        const nodes = dedupeNodes(members.map(c => criterionToNode(c, gaps)).filter(Boolean));
        if (nodes.length === 0) return null;
        return nodes.length === 1 ? nodes[0] : { any: nodes };
    }).filter(Boolean);
    if (groupNodes.length === 0) return null;
    return groupNodes.length === 1 ? groupNodes[0] : { all: groupNodes };
}

// Replicate the legacy evaluator's safeguard: a rule with no clinical
// criterion (diagnosis/problem/lab/medication) is a parsing artifact and is
// ignored. Prevents junk all-demographic rules from becoming packs.
function ruleHasClinical(rule) {
    return Object.values(rule.criteriaGroups).flat()
        .some(c => CLINICAL.has(c.type));
}

/**
 * Pure conversion of one legacy condition (from RulesLoader) into a draft
 * pack object. Exported so the legacy-parity test can convert in-memory
 * without writing files. Returns null if nothing survives the artifact filter.
 */
export function conditionToPack(cond) {
    const gaps = new Set();
    const rules = cond.rules
        .filter(r => Object.keys(r.criteriaGroups).length > 0)
        .filter(ruleHasClinical)
        .map(r => ({
            id: `${cond.id}-${r.id || 'R'}`,
            description: `DRAFT (mechanical conversion of legacy rule ${r.id}${r.description ? ': ' + r.description : ''}) — VERIFY against Word doc detailed logic: group nesting, gate flags, timebox, active-status.`,
            logic: ruleToLogic(r, gaps)
        }))
        .filter(r => r.logic);
    if (rules.length === 0) return null;

    return {
        mnemonic: `${cond.id}_V1`,
        conditionId: cond.id,
        name: cond.name,
        evidenceModel: 'SEM_V1',
        coverage: 'draft',
        source: {
            document: 'TBD — attach RCKMS docx during curation',
            rckmsVersion: '', rckmsDate: '',
            rctcRelease: RULES_PROVENANCE.rctcRelease,
            curatedFrom: `mechanical conversion of rules-data.js (${RULES_PROVENANCE.version}) by scripts/convert-rules-to-packs.mjs — REQUIRES human curation vs Word doc`
        },
        created: new Date().toISOString().slice(0, 10),
        modified: new Date().toISOString().slice(0, 10),
        rules,
        gaps: [...gaps].map(g => ({ valueSet: g, reason: 'flagged during mechanical conversion; verify vs source' }))
    };
}

async function main() {
    const conditions = await new RulesLoader().loadAll();
    const curated = new Set(readdirSync(packDir)
        .filter(f => f.endsWith('.json') && !f.endsWith('.draft.json'))
        .map(f => f.split('_V')[0]));

    let written = 0, skipped = 0;
    for (const cond of conditions.values()) {
        if (curated.has(cond.id)) { skipped++; continue; }
        const pack = conditionToPack(cond);
        if (!pack) { skipped++; continue; }
        writeFileSync(join(packDir, `${cond.id}_V1.draft.json`), JSON.stringify(pack, null, 2));
        written++;
    }
    console.log(`Wrote ${written} draft packs; skipped ${skipped} (already curated or no rules).`);
    console.log('Drafts are inert until promoted: rename <ID>_V1.draft.json -> <ID>_V1.json, curate vs docx, add fixtures.');
}

// Run as CLI only (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) main();
