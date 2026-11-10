import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
def load(rel): return json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))

sc = load(r'Gameplay\scaling.json')
print('== scaling ==')
for k, v in sc.items():
    s = json.dumps(v, ensure_ascii=False)
    print(f'  {k}: {s[:220]}')

print('\n== monsters keys ==')
mon = load(r'Gameplay\monsters.json')['monsters']
print(collections.Counter(k for m in mon for k in m).most_common(30))
print('families', collections.Counter(m.get('Family') for m in mon).most_common(20))
print('has Life/Damage?', [ (m['Id'], m.get('Life'), m.get('Damage'), m.get('Level')) for m in mon[:5]])

print('\n== potions sub ==')
po = load(r'Gameplay\potions.json')
print('Types', json.dumps(po['Types'], ensure_ascii=False)[:1500])
print('\nMods keys', list(po['Mods'].keys()) if isinstance(po['Mods'], dict) else type(po['Mods']))
print(json.dumps(po['Mods'], ensure_ascii=False)[:1200])
print('\nUniques', json.dumps(po['Uniques'], ensure_ascii=False)[:800])
print('\nCosts/Drops', json.dumps(po.get('Costs'), ensure_ascii=False)[:300], json.dumps(po.get('Drops'), ensure_ascii=False)[:300])

print('\n== classes ==')
cl = load(r'Gameplay\classes.json')['classes']
print([(c['Id'], c.get('Str'), c.get('Dex'), c.get('Int'), c.get('WeaponClasses')) for c in cl])
print('second class keys', list(cl[0].keys()))

print('\n== zones ==')
z = load(r'Zones\zones.json')['zones']
print('zone count', len(z), [zz['Id'] for zz in z][:10])
print('keys', list(z[0].keys()))
print(json.dumps({k: v for k, v in z[0].items() if k not in ('Objects','Spawns','Items')}, ensure_ascii=False)[:1200])

print('\n== guides ==')
g = load(r'Gameplay\guides.json')
print(type(g), list(g.keys()) if isinstance(g, dict) else len(g))
print(json.dumps(g, ensure_ascii=False)[:800])
