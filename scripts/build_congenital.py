#!/usr/bin/env python3
"""
Builder for the standard RCKMS congenital-anomaly template (birth defects):
  R1: <condition> diagnosis or active problem, age < 1 year (timeboxed)
  R2: Fetal <condition> diagnosis/active problem (usually no codes -> gap)
Writes rules/conditions/<ID>_V1.json + tests/fixtures/<id>/{reportable,adult,empty}.
Usage:
  python3 scripts/build_congenital.py <ID> "<Name>" <docx> <ver> <date> <snomedOID> <icd10OID|-> "<Fetal VS base name>"
OID args are the numeric tail only (e.g. 2322). Use - for a missing (no-codes) OID.
"""
import json, os, sys
P='2.16.840.1.113762.1.4.1146.'
cid,name,doc,ver,date,snO,icO,fetal = sys.argv[1:9]
def oid(x): return None if x=='-' else P+x
def dx(o,n): return {"predicate":"diagnosisInValueSet","params":{"oid":o,"name":n}}
def pr(o,n): return {"predicate":"problemInValueSet","params":{"oid":o,"name":n,"status":"active"}}
TB={"gate":True,"predicate":"withinTimebox","params":{}}
AGE={"gate":True,"predicate":"ageComparison","params":{"op":"<","value":1,"unit":"years"}}
sn,ic=oid(snO),oid(icO)
rules=[
 {"id":cid+"-R1","description":name+" diagnosis or active problem, age < 1 year (timeboxed)","logic":{"all":[
   {"any":[dx(sn,name+" (Disorders) (SNOMED)"),dx(ic,name+" (Disorders) (ICD10CM)"),pr(sn,name+" (Disorders) (SNOMED)"),pr(ic,name+" (Disorders) (ICD10CM)")]},AGE,TB]}},
 {"id":cid+"-R2","description":"Fetal "+name+" diagnosis or active problem (no codes available - not implemented)","logic":{"all":[
   {"any":[dx(None,fetal+" (SNOMED)"),dx(None,fetal+" (ICD10CM)"),pr(None,fetal+" (SNOMED)"),pr(None,fetal+" (ICD10CM)")]},TB]}},
]
pack={"mnemonic":cid+"_V1","conditionId":cid,"name":name,"evidenceModel":"SEM_V1","coverage":"partial",
 "source":{"document":doc,"rckmsVersion":ver,"rckmsDate":date,"rctcRelease":"2025-03-18","curatedFrom":"rule-curation-agent vs live RCKMS Release 16 docx (2026-07-17)"},
 "created":"2026-07-17","modified":"2026-07-17","rules":rules,
 "gaps":[{"valueSet":"Fetal "+name,"reason":"no codes available; R2 skips"},{"valueSet":"Timebox windows","reason":"platform-unimplemented; does not reduce coverage"}]}
json.dump(pack,open("rules/conditions/"+cid+"_V1.json","w"),indent=2)
d="tests/fixtures/"+cid.lower(); os.makedirs(d,exist_ok=True)
def w(f,desc,exp,ev):
  b={"demographics":{},"pregnancy":{},"diagnoses":[],"problems":[],"labs":[],"medications":[],"encounters":[],"immunizations":[]};b.update(ev)
  json.dump({"evidenceModel":"SEM_V1","description":desc,"expected":exp,"evidence":b},open(d+"/"+f,"w"),indent=2)
w("reportable-r1-dx.json","dx infant",{"conditionId":cid,"status":"reportable","rules":{cid+"-R1":"SUCCEEDED"}},{"demographics":{"ageDays":30},"diagnoses":[{"code":"X","oids":[sn]}]})
w("control-adult.json","dx but adult -> age gate fails",{"conditionId":cid,"status":"not-reportable"},{"demographics":{"ageDays":12000},"diagnoses":[{"code":"X","oids":[sn]}]})
w("control-empty.json","none",{"conditionId":cid,"status":"not-reportable"},{})
print("built",cid,"rules",len(rules))
