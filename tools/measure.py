import json, re, collections, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

db = json.load(open('tools/db.json', encoding='utf-8'))

# fields carrying prose (need translation); categorical fields handled by a fixed glossary
PROSE = {
 'potions': ['name','lines','tiers','base','src'],
 'vows': ['name','desc','notes','tags','attr','kind','dmg'],
 'uniques': ['name','base','flavour','mods','fmods','flags'],
 'bases': ['name','stats','implicits','req'],
 'affixes': ['text','tiers','group'],
 'runewords': ['name','build','flavour','mods','power','bases'],
 'runes': ['name','lore','weapon','armour','next'],
 'supports': ['name','desc','mods','req','excl'],
 'crafting': ['name','text','cost','unlock','line','detail'],
 'other': ['name','text','notes'],
 'skills': ['name','desc','notes'],
}

def strings_of(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, list):
        for v in o:
            yield from strings_of(v)
    elif isinstance(o, dict):
        for v in o.values():
            yield from strings_of(v)

all_prose = collections.Counter()
for cat, fields in PROSE.items():
    for e in db[cat]:
        for f in fields:
            if f in e:
                for s in strings_of(e[f]):
                    all_prose[s] += 1

print('distinct prose strings:', len(all_prose))
print('total prose chars distinct:', sum(len(s) for s in all_prose))
print('total occurrences:', sum(all_prose.values()))

NUM = re.compile(r'[+-]?\d+(?:\.\d+)?(?:\s*-\s*[+-]?\d+(?:\.\d+)?)?')
def skel(s):
    return NUM.sub('\x00', s)

sk = collections.Counter()
for s, n in all_prose.items():
    sk[skel(s)] += n
print('\ndistinct skeletons:', len(sk))
print('skeleton chars:', sum(len(s) for s in sk))
print('\nsample skeletons:')
for s, n in list(sk.most_common(25)):
    print(' ', n, repr(s))

# distribution of skeleton lengths
lens = sorted(len(s) for s in sk)
print('\nmedian skel len', lens[len(lens)//2])
top = sum(n for s, n in sk.items() if n >= 3)
print('occurrences covered by skeletons used >=3 times:', top, 'of', sum(sk.values()))
