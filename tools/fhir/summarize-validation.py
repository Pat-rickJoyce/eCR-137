import sys,collections,re
from lxml import etree
ns='{http://hl7.org/fhir}'
tot=collections.Counter(); files_err=collections.Counter(); msgs={'error':collections.Counter(),'warning':collections.Counter(),'information':collections.Counter()}
ex_by={}
nfiles=0
for ev,oo in etree.iterparse(sys.argv[1], tag=ns+'OperationOutcome'):
    nfiles+=1
    src=oo.find(ns+'extension/'+ns+'valueString'); src=src.get('value').split('\\')[-1] if src is not None else '?'
    ec=0
    for i in oo.findall(ns+'issue'):
        sev=i.find(ns+'severity').get('value'); tot[sev]+=1
        t=i.find(ns+'details/'+ns+'text').get('value')
        t=re.sub(r'urn:uuid:[0-9a-f-]+','<uuid>',t); t=re.sub(r'Bundle\.entry\[\d+\]','Bundle.entry[n]',t); t=re.sub(r"'[^']{0,60}'","'…'",t) if sev!='error' else t
        e=i.find(ns+'expression'); e=re.sub(r'\[\d+\]','[n]',e.get('value')) if e is not None else ''
        if sev in ('error','fatal'): ec+=1; k=(t[:200],e[:80])
        else: k=(t[:120],'')
        msgs.setdefault(sev,collections.Counter())[k]+=1
        if sev=='error': ex_by.setdefault(k,[]).append(src)
    if ec: files_err[src]=ec
    oo.clear()
print('files',nfiles,dict(tot),'files with errors',len(files_err))
for (t,e),n in msgs['error'].most_common(40): print(f'  E x{n} [{len(set(ex_by[(t,e)]))} files] {e} :: {t}  e.g. {ex_by[(t,e)][0]}')
