import json, os, io, sys, collections, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'

def load(rel):
    return json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))

# ---- skills across Parts ----
print('== skills files ==')
allsk = []
for p in glob.glob(os.path.join(ROOT, 'Gameplay', 'Parts', '*', 'skills.json')):
    j = load(os.path.relpath(p, ROOT))
    arr = j.get('skills', j if isinstance(j, list) else [])
    print(os.path.basename(os.path.dirname(p)), '->', len(arr), 'keys', list(j.keys())[:5] if isinstance(j, dict) else 'list')
    for s in arr:
        s['_file'] = os.path.basename(os.path.dirname(p))
        allsk.append(s)
print('total skills', len(allsk))
ids = [s.get('Id') for s in allsk]
print('dup ids', [k for k, v in collections.Counter(ids).items() if v > 1])
kinds = collections.Counter(s.get('Kind') for s in allsk)
print('kinds', kinds)
print('sample keys', list(allsk[0].keys()))

# save merged
json.dump(allsk, open('tools/skills_all.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ---- passive tree ----
pt = load(r'Gameplay\passive_tree.json')
print('\n== passive_tree top keys ==', list(pt.keys()))
for k, v in pt.items():
    if isinstance(v, list):
        print(' ', k, 'list', len(v), 'first:', json.dumps(v[0], ensure_ascii=False)[:300] if v else '')
    elif isinstance(v, dict):
        print(' ', k, 'dict', len(v), 'sample keys', list(v.keys())[:8])
    else:
        print(' ', k, repr(v)[:200])

# ---- monsters ----
mon = load(r'Gameplay\monsters.json')
print('\n== monsters keys ==', list(mon.keys()))
for k, v in mon.items():
    if isinstance(v, list):
        print(' ', k, 'list', len(v))
    elif isinstance(v, dict):
        print(' ', k, 'dict', len(v), list(v.keys())[:6])

# ---- bosses ----
bs = load(r'Rifts\bosses.json')
print('\n== bosses keys ==', list(bs.keys()) if isinstance(bs, dict) else type(bs))
if isinstance(bs, dict):
    for k, v in bs.items():
        if isinstance(v, list):
            print(' ', k, 'list', len(v), json.dumps(v[0], ensure_ascii=False)[:400] if v else '')
        elif isinstance(v, dict):
            print(' ', k, 'dict', len(v), list(v.keys())[:8])
        else:
            print(' ', k, repr(v)[:150])

# ---- zones ----
z = load(r'Zones\zones.json')
print('\n== zones keys ==', list(z.keys())[:20] if isinstance(z, dict) else len(z))
if isinstance(z, dict):
    for k, v in list(z.items())[:6]:
        print(' ', k, type(v).__name__, (len(v) if hasattr(v, '__len__') else ''), json.dumps(v, ensure_ascii=False)[:300])
