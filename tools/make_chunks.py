import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

G = json.load(open('build/strings_en.json', encoding='utf-8'))
os.makedirs('i18n/chunks', exist_ok=True)
for f in os.listdir('i18n/chunks'):
    os.remove(os.path.join('i18n/chunks', f))

# jobs: (name, [(domain, key)...]) -- a chunk is a dict key->en using the global key
def take(domain, n=None, start=0):
    items = list(G.get(domain, {}).items())
    return items[start:] if n is None else items[start:start+n]

chunks = collections.OrderedDict()

def mk(name, items):
    d = collections.OrderedDict()
    for k, v in items:
        d[k] = v
    chunks[name] = d

# bases in 5
for i in range(5):
    mk(f'base_{i+1}', take('base', 95, i*95))
mk('unique_names', take('unique'))
mk('runewords', take('runeword') + take('archetype'))
mk('runejewel', take('rune') + take('jewel') + take('lore'))
mk('flavour', take('flavour'))
for i in range(4):
    mk(f'tiername_{i+1}', take('tiername', 140, i*140))
mk('misc_terms', take('affixgroup') + take('material') + take('land') + take('vessel') + take('potion')
   + take('potionmod') + take('potionunique') + take('class'))
for i in range(2):
    mk(f'cuberec_{i+1}', take('cuberec', 125, i*125))
for i in range(2):
    mk(f'forgerec_{i+1}', take('forgerec', 120, i*120))
mk('skill_names', take('skill'))
mk('skill_desc', take('skilldesc'))
mk('support_names', take('support'))
mk('support_desc', take('supportdesc'))
for i in range(2):
    mk(f'monster_{i+1}', take('monster', 190, i*190))
for i in range(5):
    mk(f'treenode_{i+1}', take('treenode', 250, i*250))
for i in range(2):
    mk(f'treeflavour_{i+1}', take('treeflavour', 100, i*100))
mk('guides', take('guide') + take('guidedesc'))
mk('guardians', take('guardian') + take('guardianlore') + take('variant') + take('bosstier'))
mk('blessnames', take('blessing') + take('curse'))

total = 0
for name, d in chunks.items():
    p = f'i18n/chunks/{name}.json'
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    total += len(d)
    print(f'{name:16s} {len(d):4d} strings {sum(len(v) for v in d.values()):6d} chars')
print('chunks', len(chunks), 'strings', total)
