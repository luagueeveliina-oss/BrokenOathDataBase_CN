import json, os, io, sys, glob, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

P = 'i18n/parts'
files = sorted(glob.glob(os.path.join(P, '*.json')))
merged = {}
bad = []
for f in files:
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        bad.append((f, str(e)))
        continue
    dup = [k for k in d if k in merged]
    merged.update(d)
    print('%-22s %4d keys %s' % (os.path.basename(f), len(d), ('dup:' + str(len(dup))) if dup else ''))
print('total keys', len(merged), 'bad files', bad)

# rename the flavour chunk keys to their dedicated prefix
fl = json.load(open(os.path.join(P, 'flavour.json'), encoding='utf-8'))
ren = {}
for k, v in fl.items():
    if k.startswith('unique:'):
        ren['flav:' + k] = v
    elif k.startswith('rw:'):
        ren['flav:' + k] = v
    else:
        ren[k] = v
json.dump(ren, open(os.path.join(P, 'flavour.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('flavour re-keyed ->', len(ren), 'sample', list(ren.items())[:2])

# coverage against the english inventory
en = json.load(open('build/strings_en.json', encoding='utf-8'))
allkeys = {k: v for d in en.values() for k, v in d.items()}
mt = json.load(open('build/modtexts_en.json', encoding='utf-8'))
allkeys.update(mt)
missing = [k for k in allkeys if k not in ren and k not in merged]
print('\nenglish keys', len(allkeys), 'missing zh', len(missing))
byprefix = collections.Counter(k.split(':')[0] for k in missing)
print(dict(byprefix))
for k in missing[:15]:
    print('  ', k, '::', allkeys[k][:80])
