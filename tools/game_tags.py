import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
def load(rel): return json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))
tags = collections.Counter()
def sc(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ('Tags','BaseTags','ExcludeTags','RequiresAnyTag','WeaponKinds') and isinstance(v, list):
                for t in v: tags[str(t)] += 1
            else: sc(v)
    elif isinstance(o, list):
        for v in o: sc(v)
for rel in [r'Items\item_bases.json', r'Items\uniques.json', r'Items\affixes.json', r'Items\runes.json',
            r'Items\runewords.json', r'Gameplay\supports.json', r'Gameplay\blessings.json', r'Gameplay\curses.json',
            r'Gameplay\forge.json', r'Items\mythic_lines.json', r'Gameplay\passive_tree.json']:
    sc(load(rel))
for f in os.listdir(os.path.join(ROOT,'Gameplay','Parts')):
    p = os.path.join(ROOT,'Gameplay','Parts',f,'skills.json')
    if os.path.exists(p): sc(json.load(open(p,encoding='utf-8')))
print('distinct tags:', len(tags))
print(sorted(tags.items(), key=lambda x:-x[1]))

print('\n== slots / classes ==')
slots = collections.Counter(); cls = collections.Counter()
for b in load(r'Items\item_bases.json')['bases']:
    slots[b.get('Slot')] += 1; cls[b.get('Class')] += 1
print('slots', dict(slots)); print('classes', dict(cls))
print('\n== deliveries / dmg types ==')
d = collections.Counter(); dt = collections.Counter(); attrs = collections.Counter(); kinds = collections.Counter()
for f in os.listdir(os.path.join(ROOT,'Gameplay','Parts')):
    p = os.path.join(ROOT,'Gameplay','Parts',f,'skills.json')
    if not os.path.exists(p): continue
    for s in json.load(open(p,encoding='utf-8'))['skills']:
        d[s.get('Delivery')] += 1; dt[s.get('DamageType')] += 1; attrs[s.get('Attribute')] += 1; kinds[s.get('Kind')] += 1
print('delivery', dict(d)); print('dmg', dict(dt)); print('attr', dict(attrs)); print('kind', dict(kinds))

print('\n== tree node groups/regions ==')
pt = load(r'Gameplay\passive_tree.json')
print(collections.Counter(n['Group'] for n in pt['nodes']).most_common(40))
print(collections.Counter(n['Region'] for n in pt['nodes']).most_common(30))
print('keystones:', [n['Name'] for n in pt['nodes'] if n['Kind']=='Keystone'][:60])
