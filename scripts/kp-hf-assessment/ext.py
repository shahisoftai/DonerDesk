import os
import zipfile,re,sys
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
z=zipfile.ZipFile(os.environ.get('KPHF_TOOL', '/home/najeeb/Linux-Dev/GEC Business/AGRC/KPK HF 2026/EOI docs/HFA TOOL NOV 25.docx'))
root=ET.fromstring(z.read('word/document.xml'))
body=root.find(W+'body')
def ptext(p):
    s=''
    for n in p.iter():
        if n.tag==W+'t': s+=n.text or ''
        elif n.tag==W+'tab': s+=' '
        elif n.tag==W+'sym': s+='[]'
        elif n.tag in (W+'checkBox',): s+='[]'
        elif n.tag==W+'br': s+=' '
    return s.strip()
def cell(tc):
    return ' / '.join(t for t in (ptext(p) for p in tc.iter(W+'p')) if t)
out=[]
def walk(el,depth=0):
    for ch in el:
        if ch.tag==W+'p':
            t=ptext(ch)
            if t: out.append('P: '+t)
        elif ch.tag==W+'tbl':
            out.append('TABLE')
            for tr in ch.findall(W+'tr'):
                cells=[]
                for tc in tr.findall(W+'tc'):
                    c=cell(tc)
                    cells.append(c)
                out.append('R: '+' | '.join(cells))
            out.append('ENDTABLE')
        elif ch.tag in (W+'sdt',W+'sdtContent'): walk(ch,depth+1)
walk(body)
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)),'out'),exist_ok=True)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'out','doc.txt'),'w').write('\n'.join(out))
print(len(out))
