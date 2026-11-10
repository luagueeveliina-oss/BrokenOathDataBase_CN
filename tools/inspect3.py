import json, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

db = json.load(open('tools/db.json', encoding='utf-8'))

def sample(cat, n=3):
    print('\n===== ' + cat + ' =====')
    for e in db[cat][:n]:
        print(json.dumps(e, ensure_ascii=False, indent=1)[:1400])
        print('-' * 40)

for cat in ['potions','vows','uniques','bases','affixes','runewords','runes','supports','crafting','other','skills']:
    keys = collections.Counter()
    for e in db[cat]:
        for k in e:
            keys[k] += 1
    print(cat, 'n=', len(db[cat]), 'keys:', dict(keys))

print('\n\n######## SAMPLES ########')
for cat in ['uniques','bases','affixes','runewords','runes','supports','skills','vows','potions','crafting','other']:
    sample(cat, 2)
