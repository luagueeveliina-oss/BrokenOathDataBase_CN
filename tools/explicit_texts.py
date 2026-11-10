import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
def load(rel): return json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))

texts = collections.Counter()
where = collections.defaultdict(set)
def scan(o, src, path=''):
    if isinstance(o, dict):
        if 'Mod' in o and isinstance(o['Mod'], dict):
            if o.get('Text'): texts[o['Text']] += 1; where[o['Text']].add(src)
            scan(o['Mod'], src, path)
        for k, v in o.items():
            if k == 'Text' and isinstance(v, str) and v.strip() and 'Mod' not in o:
                texts[v] += 1; where[v].add(src)
            else:
                scan(v, src, path + '/' + str(k))
    elif isinstance(o, list):
        for v in o: scan(v, src, path)

for rel in [r'Items\item_bases.json', r'Items\uniques.json', r'Items\affixes.json', r'Items\runes.json',
            r'Items\runewords.json', r'Gameplay\supports.json', r'Gameplay\blessings.json', r'Gameplay\curses.json',
            r'Gameplay\forge.json', r'Items\mythic_lines.json', r'Gameplay\passive_tree.json']:
    scan(load(rel), rel)
for f in ['warrior','mage','ranger','samurai','paladin','necromancer','_blessings']:
    p = os.path.join(ROOT,'Gameplay','Parts',f,'skills.json')
    scan(load(os.path.join('Gameplay','Parts',f,'skills.json')), 'skills/'+f)

print('distinct explicit mod texts:', len(texts))
print('total chars', sum(len(t) for t in texts))
for t, n in texts.most_common(40):
    print(f'  {n:3d} {t[:130]}')
json.dump({('modtext:'+t): t for t in texts}, open('build/modtexts_en.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)
