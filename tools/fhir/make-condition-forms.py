import json,re,glob,os,copy,openpyxl
import sys; R=sys.argv[1] if len(sys.argv)>1 else '.'
# code -> OIDs from the app's lookup
src=open(f'{R}/js/reportability-engine/code-oid-lookup.js').read()
s0=src.index('CODE_TO_OIDS'); s1=src.index('{',s0); obj=src[s1:src.index('\n};',s1)+2]
c2o=json.loads(re.sub(r',\s*}', '}', obj))
o2c={}
for c,oids in c2o.items():
    for o in oids: o2c.setdefault(o,[]).append(c)
# code -> display from RCTC workbook
names={}
wb=openpyxl.load_workbook(f'{R}/assets/data/RCTC_Release (2025-03-18).xlsx',read_only=True)
cre=re.compile(r'^([0-9]{3,}(-[0-9])?|[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?)$')
for ws in wb.worksheets:
    for r in ws.iter_rows(values_only=True):
        r=[str(x).strip() if x is not None else '' for x in r]
        for i in range(len(r)-1):
            if cre.match(r[i]) and len(r[i+1])>3 and not cre.match(r[i+1]) and r[i] not in names:
                names[r[i]]=r[i+1]
base=json.load(open(R+'/tests/fhir/default-form.json'))
def walk(n,acc):
    if isinstance(n,dict):
        if 'predicate' in n: acc.append(n)
        for v in n.values(): walk(v,acc)
    elif isinstance(n,list):
        for v in n: walk(v,acc)
def pick(oid, want=None):
    cs=sorted(o2c.get(oid,[]))
    if want=='snomed': cs=[c for c in cs if re.match(r'^\d{6,}$',c)]
    if want=='loinc': cs=[c for c in cs if re.match(r'^\d+-\d$',c)]
    cs=[c for c in cs if c in names]
    return (cs[0], names[cs[0]]) if cs else None
OUTD=R+'/tests/fhir/forms'; os.makedirs(OUTD,exist_ok=True); n=0; stats={}
for i,f in enumerate(sorted(glob.glob(f'{R}/rules/conditions/*.json'))):
    p=json.load(open(f)); preds=[]; walk(p['rules'],preds)
    by={}
    for q in preds: by.setdefault(q['predicate'],[]).append(q['params'].get('oid'))
    d=copy.deepcopy(base); used=[]
    dx=next((x for o in by.get('diagnosisInValueSet',[]) if o for x in [pick(o,'snomed')] if x),None)
    if dx:
        d['diagnosisEvidence']=[dict(base['diagnosisEvidence'][0],diagnosisCode=dx[0],diagnosisName=dx[1])]; used.append('dx')
    pr=next((x for o in by.get('problemInValueSet',[]) if o for x in [pick(o,'snomed')] if x),None)
    if pr:
        d['problemEvidence']=[dict(base['problemEvidence'][0],problemCode=pr[0],problemName=pr[1])]; used.append('problem')
    lt=next((x for o in by.get('labTestInValueSet',[]) if o for x in [pick(o,'loinc')] if x),None)
    lr=next((x for o in by.get('labResultInValueSet',[]) if o for x in [pick(o,'snomed')] if x),None)
    if lt:
        le=dict(base['labEvidence'][0],orderCode=lt[0],orderName=lt[1],testCode=lt[0],testName=lt[1])
        if lr: le.update(valueKind='coded',valueCode=lr[0],valueName=lr[1]); used.append('lab+result')
        else:
            if i%2: le.update(valueKind='quantity',qtyValue='12.5',qtyUnit='mg/L')
            else: le.update(valueKind='text',textValue='Detected')
            used.append('lab')
        d['labEvidence']=[le]
    md=next((x for o in by.get('medicationInValueSet',[]) if o for x in [pick(o)] if x),None)
    if md:
        d['administeredMedications']=[dict(base['administeredMedications'][0],medicationCode=md[0],medicationName=md[1])]; used.append('med')
    if not used: continue
    # structural variation so fixtures differ beyond codes
    v=i%6
    if v==1: d['bloodPressure']='120'; d['immunizations']=[]
    if v==2: d['pregnancyStatus']=''; d['travelLocation']=''; d['procedures']=[]
    if v==3: d['patientGender']='M'; d['pregnancyStatus']=''; d['administeredMedications']=d['administeredMedications'] if md else []
    if v==4: d['oxygenSaturation']=''; d['heartRate']=''; d['temperature']=''
    if v==5: d['labEvidence']=d['labEvidence']+[dict(d['labEvidence'][0],orderId='ORD-2024-002')]
    json.dump(d,open(f"{OUTD}/{p['conditionId']}.json",'w'),indent=1); n+=1
    stats['+'.join(used)]=stats.get('+'.join(used),0)+1
print(n,'forms'); print(stats)
