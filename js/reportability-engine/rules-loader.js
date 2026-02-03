import { ReportableCondition, ReportabilityRule, RuleCriterion } from './models.js';
import { RULES_DATA } from './rules-data.js';

/**
 * Responsible for loading the rules data from embedded RULES_DATA
 * (Previously fetched CSVs, but that caused issues with file:// and caching)
 */
export class RulesLoader {
    constructor() {
        this.conditions = new Map(); // id -> ReportableCondition
    }

    async loadAll() {
        console.log("Loading Reportability Rules from embedded data...");

        try {
            this.loadConditions();
            this.loadRules();
            this.loadCriteria();
            console.log(`Loaded ${this.conditions.size} conditions.`);
            return this.conditions;
        } catch (e) {
            console.error("Failed to load rules:", e);
            throw e;
        }
    }

    loadConditions() {
        for (const row of RULES_DATA.conditions) {
            const cond = new ReportableCondition(
                row.condition_id,
                row.condition_name,
                row.condition_snomed
            );
            this.conditions.set(cond.id, cond);
        }
    }

    loadRules() {
        for (const row of RULES_DATA.rules) {
            const cond = this.conditions.get(row.condition_id);
            if (!cond) continue;

            const rule = new ReportabilityRule(
                row.rule_id,
                row.condition_id,
                row.rule_name,
                row.rule_description
            );
            cond.rules.push(rule);
        }
    }

    loadCriteria() {
        for (const row of RULES_DATA.criteria) {
            const cond = this.conditions.get(row.condition_id);
            if (!cond) continue;

            const rule = cond.rules.find(r => r.id === row.rule_id);
            if (!rule) continue;

            const criterion = new RuleCriterion(row);
            rule.addCriterion(criterion);
        }
    }
}
