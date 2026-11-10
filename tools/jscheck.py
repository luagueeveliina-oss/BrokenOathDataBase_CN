import re, os, io, sys, subprocess
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
NODE = r'C:\Users\HCJ0119\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
site = 'site'
os.makedirs('tools/jscheck', exist_ok=True)
ok = True
for f in sorted(os.listdir(site)):
    if not f.endswith('.html'): continue
    html = open(os.path.join(site, f), encoding='utf-8').read()
    scripts = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S)
    for i, s in enumerate(scripts):
        p = f'tools/jscheck/{f}.{i}.js'
        open(p, 'w', encoding='utf-8').write(s)
        r = subprocess.run([NODE, '--check', p], capture_output=True, text=True)
        if r.returncode != 0:
            ok = False
            print('SYNTAX FAIL', f, 'script', i)
            print(r.stderr[:1500])
        else:
            print('ok', f, 'script', i, len(s), 'bytes')
# also check data files and site.js
for p in ['site/assets/site.js'] + ['site/assets/data/'+x for x in os.listdir('site/assets/data')]:
    r = subprocess.run([NODE, '--check', p], capture_output=True, text=True)
    print(('ok ' if r.returncode==0 else 'FAIL '), p, r.stderr[:600])
    if r.returncode: ok = False
print('ALL OK' if ok else 'PROBLEMS FOUND')
