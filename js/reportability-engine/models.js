/**
 * Data models for the Reportability Engine
 */

export class ReportableCondition {
    constructor(id, name, snomedCode) {
        this.id = id;
        this.name = name;
        this.snomedCode = snomedCode;
        this.rules = []; // List of ReportabilityRule
    }
}

export class ReportabilityRule {
    constructor(id, conditionId, name, description) {
        this.id = id;
        this.conditionId = conditionId;
        this.name = name;
        this.description = description;
        this.criteriaGroups = {}; // Map<groupId, List<RuleCriterion>>
    }

    /**
     * Adds a criterion to the appropriate group (OR group)
     * Groups are AND scenarios (All groups must pass)
     * Criteria within a group are OR scenarios (Any criteria in group passes)
     */
    addCriterion(criterion) {
        if (!this.criteriaGroups[criterion.groupId]) {
            this.criteriaGroups[criterion.groupId] = [];
        }
        this.criteriaGroups[criterion.groupId].push(criterion);
    }
}

export class RuleCriterion {
    constructor(data) {
        this.conditionId = data.condition_id;
        this.ruleId = data.rule_id;
        this.groupId = data.criteria_group;
        this.sequence = data.criteria_sequence;
        this.type = data.criteria_type; // diagnosis, problem, lab_test, etc.

        // Value Set Info
        this.valueSetOid = (data.value_set_oid || "").trim();
        this.valueSetName = (data.value_set_name || "").trim();
        this.codeSystem = (data.code_system || "").trim();

        // Evaluation Logic
        this.field = (data.ecelerate_field || "").trim();
        this.operator = (data.operator || "").trim(); // in_valueset, equals, <, >, etc.
        this.value = (data.value || "").trim().toLowerCase(); // Convert to lowercase for consistent status matching
    }
}
