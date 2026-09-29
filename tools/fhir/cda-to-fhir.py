from saxonche import PySaxonProcessor
import glob,os,sys,time
x=os.path.abspath('js/fhir/ecr137-cda2fhir.xslt')
src,dst=sys.argv[1],sys.argv[2]; os.makedirs(dst,exist_ok=True)
t=time.time(); fails=[]
with PySaxonProcessor(license=False) as p:
    ex=p.new_xslt30_processor().compile_stylesheet(stylesheet_file=x)
    for f in sorted(glob.glob(src+'/*.xml')):
        try: ex.transform_to_file(source_file=os.path.abspath(f), output_file=os.path.abspath(dst+'/'+os.path.basename(f)))
        except Exception as e: fails.append((f,str(e)[:200]))
print('done',round(time.time()-t),'s fails',len(fails)); [print(x) for x in fails[:10]]
