import json, os, io, sys, collections, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
OUT = 'build'
os.makedirs(OUT, exist_ok=True)
def load(rel): return json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))

groups = collections.OrderedDict()   # domain -> ordered dict key->en
def add(domain, key, en):
    if not en or not str(en).strip():
        return
    groups.setdefault(domain, collections.OrderedDict()).setdefault(key, str(en))

# --- items ---
bases = load(r'Items\item_bases.json')['bases']
for b in bases: add('base', 'base:'+b['Id'], b['Name'])
uniques = load(r'Items\uniques.json')['uniques']
for u in uniques:
    add('unique', 'unique:'+u['Id'], u['Name'])
    add('flavour', 'flav:unique:'+u['Id'], u.get('Flavour'))
runes = load(r'Items\runes.json')
for r in runes['runes']:
    add('rune', 'rune:'+r['Id'], r['Name']); add('lore', 'lore:rune:'+r['Id'], r.get('Lore'))
for r in runes['jewels']:
    add('jewel', 'jewel:'+r['Id'], r['Name']); add('lore', 'lore:jewel:'+r['Id'], r.get('Lore'))
rws = load(r'Items\runewords.json')['runewords']
for w in rws:
    add('runeword', 'rw:'+w['Id'], w['Name'])
    add('flavour', 'flav:rw:'+w['Id'], w.get('Flavour'))
    add('archetype', 'arch:rw:'+w['Id'], (w.get('Build') or '').replace('_',' '))
aff = load(r'Items\affixes.json')['affixes']
for a in aff:
    add('affixgroup', 'ag:'+a['Group'], a['Group'])
    for t in a.get('Tiers') or []:
        if t.get('Name'): add('tiername', 'tn:'+t['Name'], t['Name'])
myth = load(r'Items\mythic_lines.json')['lines']
for m in myth:
    add('affixgroup', 'ag:'+m['Group'], m['Group'])
    for t in m.get('Tiers') or []:
        if t.get('Name'): add('tiername', 'tn:'+t['Name'], t['Name'])
cube = load(r'Items\cube_recipes.json')['recipes']
for c in cube:
    for f in ('Name','Recipe','Result','Makes','UsesUp','Keeps'):
        add('cuberec', c['Id']+':'+f, c.get(f))
forge = load(r'Gameplay\forge.json')
for m in forge['Materials']: add('material', 'mat:'+m['Id'], m['Name']); add('material', 'mattext:'+m['Id'], m.get('Text'))
for r in forge['Recipes']:
    for f in ('Name','Text','Line','FoundIn'):
        add('forgerec', r['Id']+':'+f, r.get(f))
for k, v in forge['Lands'].items(): add('land', 'land:'+k, v)
pot = load(r'Gameplay\potions.json')
for v in pot['Vessels']: add('vessel', 'ves:'+v['Id'], v['Name'])
for t in pot['Types']: add('potion', 'pot:'+t['Id'], t['Name']); add('potiontext', 'pot:'+t['Id'], t.get('Text'))
for m in pot['Mods']: add('potionmod', 'pm:'+m['Id'], m['Name'])
for u in pot['Uniques']: add('potionunique', 'pu:'+u['Id'], u['Name'])
# --- skills ---
sk = json.load(open('tools/skills_all.json', encoding='utf-8'))
for s in sk:
    add('skill', 'sk:'+s['Id'], s['Name'])
    add('skilldesc', 'sk:'+s['Id'], s.get('Description'))
sup = load(r'Gameplay\supports.json')['supports']
for s in sup:
    add('support', 'sup:'+s['Id'], s['Name'])
    add('supportdesc', 'sup:'+s['Id'], s.get('Description'))
bl = load(r'Gameplay\blessings.json')['blessings']
for b in bl:
    add('blessing', 'bl:'+b['Id'], b['Name'])
    add('blessingtext', 'bl:'+b['Id']+':text', b.get('Text'))
    vb = b.get('Vowbreak') or {}
    add('blessingtext', 'bl:'+b['Id']+':burst', vb.get('BurstText'))
cu = load(r'Gameplay\curses.json')['curses']
for c in cu:
    add('curse', 'cu:'+c['Id'], c['Name'])
    add('blessingtext', 'cu:'+c['Id']+':text', c.get('Text'))
# --- monsters / guardians ---
mon = load(r'Gameplay\monsters.json')['monsters']
for m in mon: add('monster', 'mob:'+m['Id'], m['Name'])
bs = load(r'Rifts\bosses.json')
for g in bs['guardians']:
    add('guardian', 'g:'+g['Id'], g['Name'])
    add('guardianlore', 'g:'+g['Id'], g.get('Lore'))
    for v in g.get('Variants') or []:
        add('variant', 'g:'+g['Id']+':'+v['Id'], v.get('Name'))
for t in bs['Tiers']:
    add('bosstier', 'bt:'+t['Id'], t.get('Name')); add('bosstiertext', 'bt:'+t['Id'], t.get('Text'))
# --- tree ---
pt = load(r'Gameplay\passive_tree.json')
for n in pt['nodes']:
    add('treenode', 'tn2:'+n['Id'], n.get('Name'))
    add('treeflavour', 'tf:'+n['Id'], n.get('Flavour'))
    if n.get('Choice'):
        for ch in n['Choice']:
            nm = ch.get('Name') if isinstance(ch, dict) else None
            if nm: add('choice', 'ch:'+n['Id']+':'+str(ch.get('Id') or nm), nm)
# --- guides ---
gd = load(r'Gameplay\guides.json')['Guides']
for g in gd:
    add('guide', 'gd:'+g['Id']+':title', g.get('Title'))
    add('guidedesc', 'gd:'+g['Id']+':why', g.get('Why'))
# --- classes ---
for c in load(r'Gameplay\classes.json')['classes']: add('class', 'cls:'+c['Id'], c['Id'])

tot = 0
lines = []
for dom, d in groups.items():
    chars = sum(len(v) for v in d.values())
    tot += chars
    lines.append(f'{dom:14s} {len(d):5d} strings {chars:7d} chars')
print('\n'.join(lines))
print('TOTAL', sum(len(d) for d in groups.values()), 'strings', tot, 'chars')

# global dedupe stats
allv = [v for d in groups.values() for v in d.values()]
print('globally unique strings:', len(set(allv)))
json.dump(groups, open(os.path.join(OUT,'strings_en.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=0)
print('written build/strings_en.json')
