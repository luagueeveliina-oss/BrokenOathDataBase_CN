import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
def load(rel): return json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))

st = load(r'Items\stat_text.json')['texts']
print('stat_text count', len(st))
lines = []
for t in st:
    lines.append(f"{t['Key']}\t{t['Text']}\t{t.get('Negative','')}")
open('tools/stat_text.tsv', 'w', encoding='utf-8').write('\n'.join(lines))
print('unique keys', len(set(t['Key'] for t in st)))
print('with {v2}', sum(1 for t in st if '{v2}' in t['Text'] or '{v2}' in str(t.get('Negative'))))

# which Stat.Mode combos appear in data but have no template?
have = set(t['Key'] for t in st)
used = collections.Counter()
def scan_mods(o):
    if isinstance(o, dict):
        if 'Stat' in o and 'Mode' in o:
            used[f"{o['Stat']}.{o['Mode']}"] += 1
        for v in o.values():
            scan_mods(v)
    elif isinstance(o, list):
        for v in o:
            scan_mods(v)
for rel in [r'Items\item_bases.json', r'Items\uniques.json', r'Items\affixes.json', r'Items\runes.json',
            r'Items\runewords.json', r'Gameplay\supports.json', r'Gameplay\blessings.json', r'Gameplay\curses.json',
            r'Gameplay\forge.json', r'Items\mythic_lines.json', r'Gameplay\passive_tree.json', r'Gameplay\scaling.json']:
    scan_mods(load(rel))
for rel in os.listdir(os.path.join(ROOT,'Gameplay','Parts')):
    p = os.path.join(ROOT,'Gameplay','Parts',rel,'skills.json')
    if os.path.exists(p):
        scan_mods(json.load(open(p, encoding='utf-8')))
print('\nmod keys used:', len(used))
missing = [k for k in used if k not in have]
print('missing templates:', len(missing))
print(sorted(missing)[:80])
extra = [k for k in have if k not in used]
print('\nunused templates:', len(extra), sorted(extra)[:60])
