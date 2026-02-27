/**
 * Core Logic Engine for Reportability
 */
export class ReportabilityEvaluator {

    constructor(conditionsMap) {
        this.conditions = conditionsMap;
        // Optimization: Could build a code index here
    }

    /**
     * Evaluates the full patient record against all rules
     * @param {Object} formData Standardized patient data object
     */
    evaluate(formData) {
        const results = {
            isReportable: false,
            triggeredConditions: [],  // { condition, matchedRules: [] }
            potentialConditions: []   // Conditions where some criteria met but not all
        };

        for (const condition of this.conditions.values()) {
            const condResult = this.evaluateCondition(condition, formData);

            if (condResult.isReportable) {
                results.isReportable = true;
                results.triggeredConditions.push(condResult);
            } else if (condResult.hasPartialMatch) {
                results.potentialConditions.push(condResult);
            }
        }

        return results;
    }

    evaluateCondition(condition, formData) {
        const result = {
            conditionId: condition.id,
            conditionName: condition.name,
            matchedRules: [],
            isReportable: false,
            hasPartialMatch: false
        };

        // Debug: Log ABI evaluation
        if (condition.id === 'ABI') {
            console.log('Evaluating ABI:', condition);
            console.log('ABI rules count:', condition.rules.length);
            console.log('Form diagnoses:', formData.diagnoses);
        }

        for (const rule of condition.rules) {
            const ruleResult = this.evaluateRule(rule, formData);

            // Debug: Log ABI rule results
            if (condition.id === 'ABI') {
                console.log('ABI Rule result:', ruleResult);
            }

            if (ruleResult.passed) {
                result.matchedRules.push(ruleResult);
            }
            if (ruleResult.partialMatch) {
                result.hasPartialMatch = true;
            }
        }

        result.isReportable = result.matchedRules.length > 0;
        return result;
    }

    evaluateRule(rule, formData) {
        // A Rule passes if ALL Groups pass (AND logic)
        const groups = Object.values(rule.criteriaGroups);
        if (groups.length === 0) return { passed: false, partialMatch: false };

        // SAFETY: Ignore rules that are PURELY demographic (Parsing artifact)
        const allCriteria = groups.flat();
        const hasClinical = allCriteria.some(c =>
            ['diagnosis', 'problem', 'lab_test', 'lab_result', 'medication'].includes(c.type)
        );
        if (!hasClinical) {
            return { passed: false, partialMatch: false };
        }

        let passedGroups = 0;
        let passedClinicalGroups = 0;
        const groupDetails = [];

        for (const groupCriteria of groups) {
            // A Group passes if ANY Criterion passes (OR logic)
            const groupResult = this.evaluateGroup(groupCriteria, formData);
            groupDetails.push(groupResult);

            if (rule.conditionId === 'CAM') {
                console.log(`CAM Group Result (Rule ${rule.id}):`, groupResult);
            }

            if (groupResult.passed) {
                passedGroups++;
                // Check if this group has any clinical criteria
                const groupHasClinical = groupCriteria.some(c =>
                    ['diagnosis', 'problem', 'lab_test', 'lab_result'].includes(c.type)
                );
                if (groupHasClinical) {
                    passedClinicalGroups++;
                }
            }
        }

        const allPassed = passedGroups === groups.length;
        // Partial match ONLY if at least one CLINICAL group passed (not just demographic)
        // This prevents showing partial matches when only age/demographic criteria match
        const partial = passedClinicalGroups > 0 && !allPassed;

        return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleDescription: rule.description,
            passed: allPassed,
            partialMatch: partial,
            groups: groupDetails
        };
    }

    evaluateGroup(criteriaList, formData) {
        // Only need one to pass
        for (const criterion of criteriaList) {
            const matchResult = this.checkCriterionWithDetails(criterion, formData);
            if (matchResult.matched) {
                return {
                    passed: true,
                    matchedCriterion: criterion,
                    matchedData: matchResult.matchedData  // The actual patient data that triggered the match
                };
            }
        }
        return { passed: false };
    }

    /**
     * Check criterion and return details about what matched
     */
    checkCriterionWithDetails(criterion, formData) {
        try {
            switch (criterion.type) {
                case 'diagnosis':
                    return this.checkDiagnosisWithDetails(criterion, formData.diagnoses);
                case 'problem':
                    return this.checkProblemWithDetails(criterion, formData.problems);
                case 'demographic_age':
                case 'demographic':
                    return this.checkAgeWithDetails(criterion, formData.demographics);
                case 'lab_test':
                case 'lab_order':
                    return this.checkLabTestWithDetails(criterion, formData.labs);
                case 'lab_result':
                    return this.checkLabResultWithDetails(criterion, formData.labs);
                case 'medication':
                    return this.checkMedicationWithDetails(criterion, formData.medications);
                default:
                    console.warn(`Unknown criteria type: ${criterion.type}`);
                    return { matched: false };
            }
        } catch (e) {
            console.error("Error checking criterion", e);
            return { matched: false };
        }
    }

    checkCriterion(criterion, formData) {
        return this.checkCriterionWithDetails(criterion, formData).matched;
    }

    // --- Specific Checkers with Details ---

    checkDiagnosisWithDetails(criterion, diagnoses) {
        if (!diagnoses || !criterion.valueSetOid) return { matched: false };
        const match = diagnoses.find(d => d.oids && d.oids.includes(criterion.valueSetOid));
        if (match) {
            return {
                matched: true,
                matchedData: {
                    type: 'diagnosis',
                    code: match.code,
                    display: match.name || match.code,
                    codeSystem: match.codeSystem,
                    valueSetName: criterion.valueSetName
                }
            };
        }
        return { matched: false };
    }

    checkProblemWithDetails(criterion, problems) {
        if (!problems) return { matched: false };

        if (criterion.conditionId === 'CAM') {
            console.log(`Checking CAM Problem: OID=${criterion.valueSetOid}, Value=${criterion.value}`, problems);
        }

        const match = problems.find(p => {
            const oidMatch = p.oids && p.oids.includes(criterion.valueSetOid);
            const statusMatch = (!criterion.value || p.status === criterion.value);

            if (criterion.conditionId === 'CAM' && oidMatch) {
                console.log(`  - Potential CAM Match: Code=${p.code}, OIDs=${p.oids}, Status=${p.status}, statusMatch=${statusMatch}`);
            }

            return oidMatch && statusMatch;
        });

        if (match) {
            return {
                matched: true,
                matchedData: {
                    type: 'problem',
                    code: match.code,
                    display: match.name || match.code,
                    status: match.status,
                    valueSetName: criterion.valueSetName
                }
            };
        }
        return { matched: false };
    }

    checkAgeWithDetails(criterion, demographics) {
        if (!demographics || demographics.age === null) return { matched: false };
        const ageYears = demographics.age;
        let limit = parseFloat(criterion.value);
        if (isNaN(limit)) return { matched: false };

        const text = (criterion.valueSetName || '').toLowerCase();
        let unit = 'years';
        if (text.includes('days') || text.includes('day')) {
            limit = limit / 365.25;
            unit = 'days';
        } else if (text.includes('months') || text.includes('month')) {
            limit = limit / 12.0;
            unit = 'months';
        } else if (text.includes('weeks') || text.includes('week')) {
            limit = limit / 52.14;
            unit = 'weeks';
        }

        let matched = false;
        if (criterion.operator === '<') matched = ageYears < limit;
        else if (criterion.operator === '<=') matched = ageYears <= limit;
        else if (criterion.operator === '>') matched = ageYears > limit;
        else if (criterion.operator === '>=') matched = ageYears >= limit;

        if (matched) {
            return {
                matched: true,
                matchedData: {
                    type: 'age',
                    patientAge: ageYears,
                    operator: criterion.operator,
                    limit: criterion.value,
                    unit: unit
                }
            };
        }
        return { matched: false };
    }

    checkLabTestWithDetails(criterion, labs) {
        if (!labs) return { matched: false };
        const match = labs.find(l => l.oids && l.oids.includes(criterion.valueSetOid));
        if (match) {
            console.log(`[Evaluator] LAB TEST MATCHED for OID ${criterion.valueSetOid}:`, match);
            console.log(`[Evaluator] Lab Test fields - display: "${match.display}", testName: "${match.testName}", code: "${match.code}", testCode: "${match.testCode}"`);
            const displayValue = match.display || match.testName || match.code;
            console.log(`[Evaluator] *** FINAL DISPLAY VALUE: "${displayValue}" ***`);
            return {
                matched: true,
                matchedData: {
                    type: 'lab_test',
                    code: match.code,
                    display: displayValue,
                    valueSetName: criterion.valueSetName
                }
            };
        }
        return { matched: false };
    }

    checkLabResultWithDetails(criterion, labs) {
        if (!labs) return { matched: false };
        const match = labs.find(l => l.resultOids && l.resultOids.includes(criterion.valueSetOid));
        if (match) {
            return {
                matched: true,
                matchedData: {
                    type: 'lab_result',
                    testCode: match.code,
                    testDisplay: match.display || match.testName,
                    resultCode: match.resultCode,
                    resultDisplay: match.resultDisplay,
                    valueSetName: criterion.valueSetName
                }
            };
        }
        return { matched: false };
    }

    checkMedicationWithDetails(criterion, medications) {
        if (!medications) return { matched: false };
        console.log(`[Evaluator] Checking medication criterion: OID=${criterion.valueSetOid}, medications count=${medications.length}`);
        const match = medications.find(m => {
            console.log(`[Evaluator] Checking medication code=${m.code}, oids=${m.oids?.join(', ')}`);
            return m.oids && m.oids.includes(criterion.valueSetOid);
        });
        if (match) {
            console.log(`[Evaluator] ✓ Medication matched! code=${match.code}, OID=${criterion.valueSetOid}`);
            return {
                matched: true,
                matchedData: {
                    type: 'medication',
                    code: match.code,
                    display: match.display || match.name || match.code,
                    valueSetName: criterion.valueSetName
                }
            };
        }
        console.log(`[Evaluator] ✗ No medication match for OID=${criterion.valueSetOid}`);
        return { matched: false };
    }

    // --- Legacy checkers (for backwards compatibility) ---

    checkDiagnosis(criterion, diagnoses) {
        return this.checkDiagnosisWithDetails(criterion, diagnoses).matched;
    }

    checkProblem(criterion, problems) {
        return this.checkProblemWithDetails(criterion, problems).matched;
    }

    checkAge(criterion, demographics) {
        return this.checkAgeWithDetails(criterion, demographics).matched;
    }

    checkLabTest(criterion, labs) {
        return this.checkLabTestWithDetails(criterion, labs).matched;
    }

    checkLabResult(criterion, labs) {
        return this.checkLabResultWithDetails(criterion, labs).matched;
    }
}
