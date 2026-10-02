"""Gate for FHIR validator output (zero errors, warnings, and information messages).

Usage: python3 tools/fhir/check-validation.py build/validation.xml [tools/fhir/validation-suppressions.json] [--unused]

Every issue in the validator's OperationOutcome output fails the gate unless it matches an entry in the
suppression file. Each suppression names the validator message id, optional regular expressions for the
message text and FHIRPath expression, and the reason it is accepted. Suppressions that match nothing are
listed with --unused (run it on the full corpus) so the file only shrinks. Exit code 0 when clean, 1 otherwise.
"""
import collections, json, re, sys
from lxml import etree
NS = '{http://hl7.org/fhir}'
MSGID = 'http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id'
args = [a for a in sys.argv[1:] if a != '--unused']
show_unused = '--unused' in sys.argv[1:]
src = args[0]
sup_path = args[1] if len(args) > 1 else 'tools/fhir/validation-suppressions.json'
sups = json.load(open(sup_path, encoding='utf-8'))
for s in sups:
    s['_text'] = re.compile(s['text']) if s.get('text') else None
    s['_expr'] = re.compile(s['expression']) if s.get('expression') else None
    s['_hits'] = 0
open_issues = collections.Counter(); totals = collections.Counter(); files = 0
for _, oo in etree.iterparse(src, tag=NS + 'OperationOutcome'):
    files += 1
    for i in oo.findall(NS + 'issue'):
        sev = i.find(NS + 'severity').get('value')
        mid = next((e.find(NS + 'valueCode').get('value') for e in i.findall(NS + 'extension') if e.get('url') == MSGID), '')
        text = i.find(NS + 'details/' + NS + 'text').get('value')
        ex = i.find(NS + 'expression'); expr = ex.get('value') if ex is not None else ''
        totals[sev] += 1
        hit = next((s for s in sups if s['messageId'] == mid and s.get('severity', sev) == sev
                    and (not s['_text'] or s['_text'].search(text)) and (not s['_expr'] or s['_expr'].search(expr))), None)
        if hit: hit['_hits'] += 1
        else:
            key = re.sub(r'urn:uuid:[0-9a-f-]+', '<uuid>', text)
            open_issues[(sev, mid, key[:200], re.sub(r'\[\d+\]', '[n]', expr)[:90])] += 1
    oo.clear()
print(f'{files} files validated; {sum(open_issues.values())} open issues')
print(f'  validator issues {dict(totals)}; suppressed {sum(s["_hits"] for s in sups)}')
for (sev, mid, text, expr), n in sorted(open_issues.items(), key=lambda x: (-x[1], x[0])):
    print(f'  OPEN {sev} x{n} [{mid}] {expr} :: {text}')
for s in sups if show_unused else []:
    if not s['_hits']: print(f'  UNUSED suppression {s["messageId"]}: {s.get("reason", "")}')
sys.exit(1 if open_issues else 0)
