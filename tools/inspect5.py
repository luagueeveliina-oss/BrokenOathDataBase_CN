import re, io, sys, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

s = open('index_orig.html', encoding='utf-8').read()

print('== asset refs in html (src/href with file ext) ==')
refs = set(re.findall(r'(?:src|href)="([^"#:]+\.(?:svg|png|jpg|jpeg|webp|ico|json|css|js|woff2?))"', s))
for r in sorted(refs):
    print(' ', r)

print('\n== url() in css ==')
for u in sorted(set(re.findall(r'url\(([^)]+)\)', s))):
    print(' ', u[:120])

print('\n== db text volume ==')
db = json.load(open('tools/db.json', encoding='utf-8'))
strings = collections.Counter()
def walk(o, path=''):
    if isinstance(o, dict):
        for k, v in o.items():
            walk(v, path + '/' + str(k))
    elif isinstance(o, list):
        for v in o:
            walk(v, path + '[]')
    elif isinstance(o, str):
        strings[path] += len(o)
for cat, arr in db.items():
    strings.clear()
    walk(arr)
    tot = sum(strings.values())
    print(f'{cat}: chars={tot}')
    for p, n in strings.most_common(30):
        print('   ', p, n)
