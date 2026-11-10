import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
pt = json.load(open(os.path.join(ROOT, r'Gameplay\passive_tree.json'), encoding='utf-8'))
nodes = pt['nodes']
for k in ['Choice', 'Socket', 'Price', 'Orbit', 'ClassStart', 'Text']:
    ex = [n for n in nodes if n.get(k)]
    print('==', k, len(ex))
    print(json.dumps(ex[0].get(k), ensure_ascii=False)[:700] if ex else '')
print('\n== keystone example ==')
print(json.dumps([n for n in nodes if n['Kind']=='Keystone'][0], ensure_ascii=False, indent=1)[:1200])
print('\n== start nodes ==', [ (n['Id'], n['Name'], n['ClassStart'], n['X'], n['Y']) for n in nodes if n['Kind']=='Start'])
xs=[n['X'] for n in nodes]; ys=[n['Y'] for n in nodes]
print('bounds', min(xs), max(xs), min(ys), max(ys))
print('links count', sum(len(n.get('Links') or []) for n in nodes))
print('\n== Suggested ==', json.dumps(pt['Suggested'], ensure_ascii=False)[:500])
print('\n== baseline/moved ==', json.dumps({k:v for k,v in pt.items() if k in ('Version','FullReset','Baseline')}, ensure_ascii=False)[:400])
