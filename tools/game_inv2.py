import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'

sk = json.load(open('tools/skills_all.json', encoding='utf-8'))
print('== skill record sample (gem) ==')
gems = [s for s in sk if s.get('Kind')=='Gem']
print(json.dumps(gems[0], ensure_ascii=False, indent=1)[:2600])
print('\n== keys frequency across skills ==')
c = collections.Counter()
for s in sk:
    for k in s: c[k]+=1
print(dict(c.most_common()))
print('\n== by file/class ==')
for f in ['warrior','mage','ranger','samurai','paladin','necromancer','_blessings']:
    print(f, [(s['Id'], s['Name'], s.get('Kind'), s.get('Delivery'), s.get('DamageType')) for s in sk if s.get('_file')==f])

# passive tree nodes
pt = json.load(open(os.path.join(ROOT, r'Gameplay\passive_tree.json'), encoding='utf-8'))
nodes = pt['nodes']
print('\n== tree nodes', len(nodes), 'kinds', collections.Counter(n['Kind'] for n in nodes))
print(json.dumps(nodes[0], ensure_ascii=False, indent=1)[:1200])
print('keys', collections.Counter(k for n in nodes for k in n).most_common())
print('Layout keys', list(pt['Layout'].keys()))
print(json.dumps(pt['Layout'], ensure_ascii=False)[:1500])

# monsters
mon = json.load(open(os.path.join(ROOT, r'Gameplay\monsters.json'), encoding='utf-8'))['monsters']
print('\n== monster sample ==')
print(json.dumps(mon[0], ensure_ascii=False, indent=1)[:1800])
print('keys', collections.Counter(k for m in mon for k in m).most_common())
print('count', len(mon))

# guardians
bs = json.load(open(os.path.join(ROOT, r'Rifts\bosses.json'), encoding='utf-8'))
print('\n== guardian sample ==')
print(json.dumps(bs['guardians'][0], ensure_ascii=False, indent=1)[:2000])
print('\n== guardian tiers ==')
print(json.dumps(bs['Tiers'][:3], ensure_ascii=False, indent=1))
