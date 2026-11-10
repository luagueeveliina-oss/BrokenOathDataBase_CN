import json, os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
P = 'i18n/parts'
DATA = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'

def load(f):
    return json.load(open(os.path.join(P, f), encoding='utf-8'))

def save(f, d):
    json.dump(d, open(os.path.join(P, f), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# --- skill / support descriptions: strip the doubled original prefix
for f, pre in (('skill_desc.json', 'skdesc:'), ('support_desc.json', 'supdesc:')):
    d = load(f)
    out = {}
    for k, v in d.items():
        kk = k[len(pre):] if k.startswith(pre) else k
        if kk.startswith('sk:') or kk.startswith('sup:'):
            kk = kk.split(':', 1)[1]
        out[pre + kk] = v
    save(f, out)
    print(f, len(out), list(out.items())[0][0])

# --- guardians: the 'g:<id>' entries hold the lore (the name was overwritten before translation)
d = load('guardians.json')
out, lore, other = {}, 0, 0
for k, v in d.items():
    if k.startswith('g:') and k.count(':') == 1:
        out['glore:' + k[2:]] = v
        lore += 1
    elif k.startswith('bt:') and k.count(':') == 1:
        out['bttext:' + k[3:]] = v
        other += 1
    else:
        out[k] = v
save('guardians.json', out)
print('guardian lore', lore, 'boss tier text', other, 'total', len(out))
for k, v in list(out.items())[:4]:
    print('   ', k, '::', v[:60])

# --- chunk with the names that were lost to the key collisions
rws = json.load(open(os.path.join(DATA, r'Items\runewords.json'), encoding='utf-8'))['runewords']
g = json.load(open(os.path.join(DATA, r'Rifts\bosses.json'), encoding='utf-8'))
chunk = {}
for w in rws:
    chunk['rw:' + w['Id']] = w['Name']
for w in rws:
    b = (w.get('Build') or '').replace('_', ' ')
    if b:
        chunk['arch:rw:' + w['Id']] = b
for gd in g['guardians']:
    chunk['gname:' + gd['Id']] = gd['Name']
for t in g.get('Tiers') or []:
    chunk['btname:' + str(t['Id'])] = t.get('Name') or ''
json.dump(chunk, open('i18n/chunks/runewords2.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('runewords2 chunk entries', len(chunk))
