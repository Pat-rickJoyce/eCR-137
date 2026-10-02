"""Lists (system, code) pairs in FHIR output that js/fhir/display-table.xml does not cover.
Usage: python3 tools/fhir/collect-codes.py build/fhir > build/codes.json   (then lookup-displays.ps1, build-display-table.py)"""
import glob, json, sys
from lxml import etree
ns = {'f': 'http://hl7.org/fhir'}
have = {(e.get('system'), e.get('code')) for e in etree.parse('js/fhir/display-table.xml').getroot()}
validated = ('http://snomed.info/sct', 'http://loinc.org', 'http://www.nlm.nih.gov/research/umls/rxnorm', 'http://hl7.org/fhir/sid/cvx',
             'http://hl7.org/fhir/sid/icd-10-cm', 'http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl', 'http://nucc.org/provider-taxonomy',
             'http://www.ama-assn.org/go/cpt', 'urn:iso:std:iso:3166')
out = set()
for f in glob.glob(sys.argv[1] + '/*.xml'):
    for c in etree.parse(f).xpath('//f:coding', namespaces=ns):
        s = c.xpath('string(f:system/@value)', namespaces=ns); k = c.xpath('string(f:code/@value)', namespaces=ns)
        if k and (s in validated or s.startswith('http://terminology.hl7.org/CodeSystem/')) and (s, k) not in have:
            out.add((s, k))
json.dump([{'system': s, 'code': k} for s, k in sorted(out)], sys.stdout, indent=1)
