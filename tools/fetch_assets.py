import json, os, sys, io, time
import requests
from concurrent.futures import ThreadPoolExecutor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = 'https://broked-db.vercel.app/'
ROOT = os.path.abspath('.')
S = requests.Session()
S.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return ('skip', path)
    for attempt in range(4):
        try:
            r = S.get(url, timeout=40)
            if r.status_code == 200:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, 'wb') as f:
                    f.write(r.content)
                return ('ok', path, len(r.content))
            elif r.status_code == 404:
                return ('404', url)
            time.sleep(0.5 * (attempt + 1))
        except Exception as e:
            time.sleep(0.6 * (attempt + 1))
    return ('fail', url)

jobs = []
for p in ['brand/seal.svg', 'brand/seal-32.png', 'brand/seal-180.png', 'brand/wordmark.svg', 'ic/icons.json']:
    jobs.append((BASE + p, os.path.join(ROOT, p.replace('/', os.sep))))

r = S.get(BASE + 'ic/icons.json', timeout=40)
r.raise_for_status()
j = r.json()
open(os.path.join(ROOT, 'ic', 'icons.json'), 'w', encoding='utf-8').write(json.dumps(j, ensure_ascii=False))
print('icons.json saved', len(r.content))

count = 0
for grp in ['base', 'uniq', 'rune', 'sup', 'skill', 'pot', 'jewel', 'forge']:
    for k, f in (j.get(grp) or {}).items():
        jobs.append((BASE + 'ic/' + f, os.path.join(ROOT, 'ic', f.replace('/', os.sep))))
        count += 1
print('icon files:', count, 'total jobs', len(jobs))

stats = {}
def work(job):
    res = get(*job)
    return res[0]

t0 = time.time()
with ThreadPoolExecutor(max_workers=16) as ex:
    for st in ex.map(work, jobs):
        stats[st] = stats.get(st, 0) + 1
print('done in %.1fs' % (time.time() - t0), stats)
