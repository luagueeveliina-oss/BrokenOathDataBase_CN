import json, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

db = json.load(open('tools/db.json', encoding='utf-8'))

out = []
def w(x):
    out.append(str(x))

for cat in ['runewords','runes','supports','skills','vows','potions','crafting','other','affixes']:
    w('\n===== ' + cat + ' =====')
    for e in db[cat][:3]:
        w(json.dumps(e, ensure_ascii=False, indent=1)[:2000])
        w('-' * 40)

open('tools/samples.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('written')
