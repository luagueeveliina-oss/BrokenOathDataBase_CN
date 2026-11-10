import re, json, os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

s = open('index_orig.html', encoding='utf-8').read()

print('== db json structure ==')
k = s.find('<script id="db" type="application/json">')
start = s.find('>', k) + 1
end = s.find('</script>', start)
raw = s[start:end]
db = json.loads(raw)
json.dump(db, open('tools/db.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('json len', len(raw), 'type', type(db))
if isinstance(db, dict):
    for kk, vv in db.items():
        if isinstance(vv, list):
            print(' key', kk, 'list', len(vv))
        elif isinstance(vv, dict):
            print(' key', kk, 'dict', list(vv.keys())[:12])
        else:
            print(' key', kk, repr(vv)[:200])
