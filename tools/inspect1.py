import re, json, sys

s = open('index_orig.html', encoding='utf-8').read()
i = s.find('<body')
j = s.find('<script id="db"')
seg = s[i:j]
print('== anchors ==')
for m in re.finditer(r'<a([^>]*)>(.*?)</a>', seg, re.S):
    print(repr(m.group(2))[:100], '->', m.group(1)[:140])

print('\n== db json structure ==')
k = s.find('<script id="db" type="application/json">')
start = s.find('>', k) + 1
end = s.find('</script>', start)
raw = s[start:end]
print('json len', len(raw))
db = json.loads(raw)
def walk(o, depth=0, key='root'):
    pad = '  ' * depth
    if isinstance(o, dict):
        print(pad + key + ' {dict ' + str(len(o)) + ' keys}: ' + ', '.join(list(o.keys())[:15]))
        if depth < 2:
            for kk, vv in list(o.items())[:8]:
                walk(vv, depth+1, kk)
    elif isinstance(o, list):
        print(pad + key + f' [list {len(o)}]')
        if o and depth < 3:
            walk(o[0], depth+1, key+'[0]')
    else:
        print(pad + key + ' = ' + repr(o)[:120])
walk(db)
