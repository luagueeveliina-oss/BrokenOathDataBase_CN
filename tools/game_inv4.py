import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
def load(rel): return json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))
b = load(r'Items\item_bases.json')['bases']
print('base keys', collections.Counter(k for x in b for k in x).most_common())
chest = [x for x in b if x['Slot']=='Chest'][:2]
print(json.dumps(chest, ensure_ascii=False, indent=1)[:1500])
ring = [x for x in b if x['Slot']=='Ring'][:1]
print(json.dumps(ring, ensure_ascii=False, indent=1)[:800])
idol = [x for x in b if x['Slot']=='Idol'][:1]
print(json.dumps(idol, ensure_ascii=False, indent=1)[:900])
u = load(r'Items\uniques.json')['uniques']
print('\nunique keys', collections.Counter(k for x in u for k in x).most_common())
print(json.dumps([x for x in u if x.get('Forged')][0], ensure_ascii=False)[:600])
print('\nunique bases missing?', [x['BaseId'] for x in u if x['BaseId'] not in {y['Id'] for y in b}][:10])
rw = load(r'Items\runewords.json')['runewords']
print('\nrw keys', collections.Counter(k for x in rw for k in x).most_common())
print('\nrunes rules', json.dumps(load(r'Items\runes.json')['Rules'], ensure_ascii=False)[:800])
print('\nforge materials', json.dumps(load(r'Gameplay\forge.json')['Materials'], ensure_ascii=False)[:600])
cube = load(r'Items\cube_recipes.json')
print('\ncube keys', list(cube.keys()), 'rules', json.dumps(cube['Rules'], ensure_ascii=False)[:500])
print('\nmythic', json.dumps(load(r'Items\mythic_lines.json')['lines'][:2], ensure_ascii=False)[:900])
