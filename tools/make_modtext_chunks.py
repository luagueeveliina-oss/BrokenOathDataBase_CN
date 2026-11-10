import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
d = json.load(open('build/modtexts_en.json', encoding='utf-8'))
items = list(d.items())
half = (len(items) + 1) // 2
for i in range(2):
    part = dict(items[i*half:(i+1)*half])
    json.dump(part, open(f'i18n/chunks/modtext_{i+1}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'modtext_{i+1}', len(part), sum(len(v) for v in part.values()), 'chars')
