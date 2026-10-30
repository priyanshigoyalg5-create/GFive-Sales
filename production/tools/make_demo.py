#!/usr/bin/env python3
"""Build the review demo (no login, no Firebase, in-memory sample data) from app/index.html.
Usage: python3 tools/make_demo.py app/index.html demo/gfive-demo.html
The demo is a single HTML file: open it directly in a browser or publish it as a Claude artifact."""
import re,sys,os
src,dst=sys.argv[1],sys.argv[2]
mock=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'demo_mock.html')).read()
s=open(src).read()
s=re.sub(r'<script src="https://www\.gstatic\.com[^\n]*</script>\n','',s)           # no Firebase SDK
s=s.replace('<link rel="manifest" href="manifest.json">\n','').replace('<link rel="icon" href="icon-192.png">\n','')
s=re.sub(r'<link rel="apple-touch-icon"[^\n]*\n','',s)
s=re.sub(r'if\("serviceWorker"in navigator\)[^\n]*\n','',s)                         # no service worker
x='<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>\n'
assert x in s; s=s.replace(x,x+mock)                                                  # fake firebase global
b='<div id="app"></div>'; assert b in s
s=s.replace(b,'<div id="demo" style="background:var(--card);border:1px dashed var(--ac);border-radius:10px;padding:10px;margin-bottom:10px;font-size:14px"><b>REVIEW DEMO.</b> Sample data, nothing is saved, no login or Firebase. View as: <select id="drole" style="width:auto;padding:4px;font-size:14px"><option value="super">Super admin</option><option value="sub">Sub admin</option><option value="subl">Sub admin + ledger tick</option><option value="admin">Admin (production)</option><option value="staff">Staff (entry)</option></select></div>\n'+b)
assert s.count('\nboot();\n</script>')==1
s=s.replace('\nboot();\n</script>','''
start({phone:"+919000000001",name:"Demo User",role:"super",perms:{}});
</script>
<script>
window.seed=async function(){toast("Demo already has sample masters loaded.")};
window.seedUsers=function(){toast("Demo users already loaded.")};
$("drole").onchange=function(){const v=this.value;ME.role=v==="subl"?"sub":v;ME.perms=Object.assign({},PRESET[v==="subl"?"sub":v]||{});if(v==="subl")ME.perms.ledger=1;ME.name="Demo "+v;TAB=can("add")?"issues":"bal";shell()};
</script>''')
s=s.replace('<title>GFive Job-Work</title>','<title>GFive Job-Work (Review Demo)</title>')
open(dst,'w').write(s);print('wrote',dst,len(s),'bytes')
