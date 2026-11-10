import json, os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
P = 'i18n/parts'
for f, pairs in (('guardians.json', (('glore:g:', 'glore:'), ('bttext:bt:', 'bttext:'))),):
    p = os.path.join(P, f)
    d = json.load(open(p, encoding='utf-8'))
    out = {}
    for k, v in d.items():
        for a, b in pairs:
            if k.startswith(a):
                k = b + k[len(a):]
        out[k] = v
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f, len(out))
    for k in list(out)[:6]:
        print('  ', k)
