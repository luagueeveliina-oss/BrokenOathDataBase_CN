# -*- coding: utf-8 -*-
"""Build the website data files from the Broken Oath playtest data files (read-only)."""
import json, os, re, glob, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
from terms_zh import (TAGS, SLOTS, CLASSES, ITEM_CLASSES, DELIVERY, SKILL_KIND,
                      ATTRIBUTE, AFFIX_TYPE, POTION_ROLE, TREE_KIND, RARITY, FORGE_KIND,
                      FORGE_GROUP, CUBE_FAMILY)
from text_zh import EXTRA_ZH

DATA = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'site', 'assets', 'data')
os.makedirs(OUT, exist_ok=True)


def load(rel):
    return json.load(open(os.path.join(DATA, rel), encoding='utf-8'))


# ---------------------------------------------------------------- i18n
ZH = {}
for f in glob.glob(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'i18n', 'parts', '*.json')):
    try:
        ZH.update({k: v for k, v in json.load(open(f, encoding='utf-8')).items() if isinstance(v, str)})
    except Exception as e:
        print('  ! bad i18n file', os.path.basename(f), e)
ZH.update(EXTRA_ZH)
MODTEXTS = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'build', 'modtexts_en.json'), encoding='utf-8'))


def zh_of(key, en):
    v = ZH.get(key)
    if v and v.strip():
        return v.strip()
    return en


def bi(key, en):
    if not en:
        return ['', '']
    return [zh_of(key, en), en]


def tag_label(x):
    """Slots, item classes and tags can all appear in BaseTags/ExcludeTags."""
    return SLOTS.get(x) or ITEM_CLASSES.get(x) or TAGS.get(x) or zh_of('ag:' + x, x)


# 构筑器只用得到进攻向词条；原样保留 Stat/Mode/Tags/数值供前端聚合
DMG_STATS = {'Damage', 'AddedDamage', 'AttackSpeed', 'CastSpeed', 'CritChance', 'CritMulti',
             'Penetration', 'DamageAsExtra', 'Convert', 'Phys70', 'Projectiles', 'Area',
             'Repeats', 'Chains', 'ChainJumpMore', 'SkillLevel', 'MeleeSplash',
             'DamageVsFullLife', 'LowLifeMore', 'SelfLowLifeMore', 'ChilledLightningMore',
             'Pierce', 'Fork', 'TotemSpeed', 'MinionDamage'}


def _raw_mod(stat, mode, tags, value, local=False):
    if stat not in DMG_STATS:
        return None
    gem = 'GemScaled' in (tags or [])
    tags = [t for t in (tags or []) if t not in ('GemScaled',)]
    try:
        v = float(value)
    except (TypeError, ValueError):
        v = 0.0
    out = {'s': stat, 'm': mode or 'Flat', 't': tags, 'v': round(v, 2)}
    if local:
        out['l'] = 1
    if gem:
        out['g'] = 1
    return out


def raw_direct(mods):
    out = []
    for m in mods or []:
        if not isinstance(m, dict):
            continue
        v = m.get('Value') or 0
        if m.get('Value2') is not None:
            v = ((v or 0) + (m.get('Value2') or 0)) / 2
        r = _raw_mod(m.get('Stat'), m.get('Mode'), m.get('Tags'), v, bool(m.get('bLocal')))
        if r:
            out.append(r)
    return out


def raw_uniques(mods):
    out = []
    for m in mods or []:
        if not isinstance(m, dict):
            continue
        mm = m.get('Mod') or {}
        v = mm.get('Value') or 0
        mn, mx = m.get('Min'), m.get('Max')
        if isinstance(mn, (int, float)) and isinstance(mx, (int, float)):
            v = (mn + mx) / 2
        r = _raw_mod(mm.get('Stat'), mm.get('Mode'), mm.get('Tags'), v)
        if r:
            out.append(r)
    return out


def tag_list(tags):
    out = []
    for t in tags or []:
        if t.startswith('Element=') or '=' in t:
            continue
        if t in TAGS:
            out.append([TAGS[t], t])
    return out


def num(v, nd=0):
    if v is None:
        return None
    if nd == 0:
        return int(round(v))
    return round(v, nd)


# ---------------------------------------------------------------- bases
bases_raw = load(r'Items\item_bases.json')['bases']
by_id = {b['Id']: b for b in bases_raw}
bases = []
for b in bases_raw:
    dmg = None
    dps = None
    if b.get('DamageMin') is not None and b.get('AttacksPerSecond'):
        dmg = [b['DamageMin'], b['DamageMax']]
        dps = round(((b['DamageMin'] + b['DamageMax']) / 2.0) * b['AttacksPerSecond'], 1)
    defs = 0
    for k in ('Armour', 'Evasion', 'EnergyShield'):
        defs += b.get(k) or 0
    bases.append({
        'id': b['Id'],
        'n': bi('base:' + b['Id'], b['Name']),
        'slot': b['Slot'], 'slotZh': SLOTS.get(b['Slot'], b['Slot']),
        'cls': b.get('Class', ''), 'clsZh': ITEM_CLASSES.get(b.get('Class', ''), b.get('Class', '')),
        'type': b.get('TypeName') or ITEM_CLASSES.get(b.get('Class', ''), b.get('Class', '')),
        'lvl': b.get('Level') or 0,
        'twoh': bool(b.get('bTwoHanded')),
        'size': '%dx%d' % (b.get('Width') or 1, b.get('Height') or 1),
        'dmg': dmg, 'aps': b.get('AttacksPerSecond'), 'crit': b.get('Crit'),
        'dps': dps,
        'ar': b.get('Armour') or 0, 'ev': b.get('Evasion') or 0, 'es': b.get('EnergyShield') or 0,
        'def': defs,
        'block': b.get('Block') or 0,
        'req': {'str': b.get('ReqStr') or 0, 'dex': b.get('ReqDex') or 0, 'int': b.get('ReqInt') or 0},
        'impl': R.render_lines(b.get('Implicits') or []),
        'impRaw': raw_direct(b.get('Implicits') or []),
        'tagRaw': [t for t in (b.get('Tags') or []) if isinstance(t, str)],
        'tags': tag_list(b.get('Tags')),
        'nw': bool(b.get('Jewel')),
        'drop': b.get('DropWeight'),
    })

# ---------------------------------------------------------------- uniques
uni_raw = load(r'Items\uniques.json')['uniques']
RED_TIER = load(r'Items\cube_recipes.json')['Rules'].get('RedTierLevels') or [1, 20, 40, 60]
def red_tier(lvl):
    t = 1
    for i, th in enumerate(RED_TIER):
        if lvl >= th:
            t = i + 1
    return t

uniques = []
for u in uni_raw:
    base = by_id.get(u['BaseId'], {})
    mods_en = [m.get('Mod') for m in u.get('Mods') or []]
    texts = [m.get('Text') for m in u.get('Mods') or []]
    texts_zh = [zh_of('modtext:' + t, t) if t else None for t in texts]
    lines = []
    for i, mm in enumerate(u.get('Mods') or []):
        mod = mm.get('Mod') or {}
        lo, hi = mm.get('Min'), mm.get('Max')
        te = mm.get('Text')
        tz = zh_of('modtext:' + te, te) if te else None
        r = R.render_mod(mod, lo, hi, text_zh=tz, text_en=te)
        if r and r[1]:
            lines.append([r[0], r[1]])
    dps = None
    if base.get('DamageMin') is not None:
        lo_d, hi_d = base['DamageMin'], base['DamageMax']
        aps = base.get('AttacksPerSecond') or 1
        inc, added = 0.0, 0.0
        for ln in lines:
            m = re.match(r'\(?([\d.]+)(?:-([\d.]+))?\)?% increased Physical Damage', ln[1])
            if m:
                inc += float(m.group(2) or m.group(1))
            m = re.match(r'Adds ([\d.]+) to ([\d.]+) Physical Damage', ln[1])
            if m:
                added += (float(m.group(1)) + float(m.group(2))) / 2
        dps = round((((lo_d + hi_d) / 2.0) * (1 + inc / 100.0) + added) * aps, 1)
    forged = u.get('Forged') or []
    uniques.append({
        'id': u['Id'],
        'n': bi('unique:' + u['Id'], u['Name']),
        'baseId': u['BaseId'],
        'base': bi('base:' + u['BaseId'], base.get('Name', u['BaseId'])),
        'lvl': u.get('Level') or 0,
        'tier': red_tier(u.get('Level') or 0),
        'drop': u.get('DropWeight'),
        'cls': base.get('Class', ''), 'clsZh': ITEM_CLASSES.get(base.get('Class', ''), ''),
        'slot': base.get('Slot', ''), 'slotZh': SLOTS.get(base.get('Slot', ''), ''),
        'flav': bi('flav:unique:' + u['Id'], u.get('Flavour') or ''),
        'mods': lines,
        'raw': raw_uniques(u.get('Mods') or []),
        'forged': forged,
        'dps': dps,
        'def': base.get('Armour', 0) + base.get('Evasion', 0) + base.get('EnergyShield', 0),
        'jewel': bool(u.get('Jewel')),
    })

# ---------------------------------------------------------------- affixes
def render_tier(mod, lo, hi):
    r = R.render_mod(mod, lo, hi)
    return [r[0], r[1]] if r else None

affixes = []
for a in load(r'Items\affixes.json')['affixes']:
    tiers = []
    for i, t in enumerate(a.get('Tiers') or []):
        line = render_tier(a.get('Mod') or {}, t.get('Min'), t.get('Max'))
        tiers.append({
            't': 'T%d' % (i + 1),
            'ilvl': t.get('ILvl'),
            'w': t.get('Weight'),
            'name': bi('tn:' + (t.get('Name') or ''), t.get('Name') or ''),
            'min': t.get('Min'), 'max': t.get('Max'),
            'line': line,
        })
    top = tiers[0]['line'] if tiers else None
    if not top:
        continue
    affixes.append({
        'id': a['Id'],
        'type': a.get('Type'), 'typeZh': AFFIX_TYPE.get(a.get('Type'), a.get('Type')),
        'group': a.get('Group'), 'groupZh': zh_of('ag:' + a.get('Group'), a.get('Group')),
        'weight': a.get('Weight'),
        'on': a.get('BaseTags') or [],
        'onZh': [tag_label(x) for x in (a.get('BaseTags') or [])],
        'notOn': a.get('ExcludeTags') or [],
        'notOnZh': [tag_label(x) for x in (a.get('ExcludeTags') or [])],
        'tiers': tiers,
        'top': top,
        'stat': (a.get('Mod') or {}).get('Stat'),
        'mode': (a.get('Mod') or {}).get('Mode'),
        'mtags': (a.get('Mod') or {}).get('Tags') or [],
        'local': bool((a.get('Mod') or {}).get('bLocal')),
        'minIlvl': min((t.get('ILvl') or 1) for t in tiers) if tiers else 1,
        'maxIlvl': max((t.get('ILvl') or 1) for t in tiers) if tiers else 1,
        'kinds': sorted({SLOTS.get(x, x) for x in (a.get('BaseTags') or [])}),
    })

# ---------------------------------------------------------------- runes & jewels
rune_data = load(r'Items\runes.json')
def col(c):
    if not isinstance(c, dict):
        return '#888'
    return '#%02x%02x%02x' % (int((c.get('R') or 0) * 255), int((c.get('G') or 0) * 255), int((c.get('B') or 0) * 255))
def rune_rec(r, cat):
    return {
        'id': r['Id'],
        'n': bi(('%s:%s' % (cat, r['Id'])), r['Name']),
        'tier': r.get('Tier'), 'idx': r.get('Index'), 'lvl': r.get('Level'),
        'weight': r.get('Weight'),
        'lore': bi('lore:%s:%s' % (cat, r['Id']), (r.get('Lore') or '')),
        'w': R.render_lines(r.get('Weapon') or []),
        'a': R.render_lines(r.get('Armour') or []),
        'next': r.get('Next'),
        'color': col(r.get('Color')),
        'kind': 'rune' if cat == 'rune' else 'jewel',
        'order': r.get('Index') or 0,
    }
runes = [rune_rec(r, 'rune') for r in rune_data['runes']]
jewels = [rune_rec(r, 'jewel') for r in rune_data['jewels']]
rune_by_id = {r['id']: r for r in runes + jewels}

# ---------------------------------------------------------------- runewords
def bandify(w):
    counts = w.get('PowerBandCount') or []
    mods = w.get('PowerBandMods') or []
    bands, i = [], 0
    for k, c in enumerate(counts):
        chunk = mods[i:i + c]
        i += c
        lines = []
        for m in chunk:
            r = R.render_mod(m.get('Mod') or {})
            if r:
                lines.append([r[0], r[1]])
        bands.append({'ilvl': (w.get('PowerBandILvl') or [])[k] if k < len(w.get('PowerBandILvl') or []) else None, 'lines': lines})
    return bands

runewords = []
for w in load(r'Items\runewords.json')['runewords']:
    mods = []
    for m in w.get('Mods') or []:
        te = m.get('Text')
        r = R.render_mod(m.get('Mod') or {}, text_zh=zh_of('modtext:' + te, te) if te else None, text_en=te)
        if r:
            mods.append([r[0], r[1]])
    power = []
    for m in w.get('PowerMods') or []:
        r = R.render_mod(m.get('Mod') or {})
        if r:
            power.append([r[0], r[1]])
    runewords.append({
        'id': w['Id'],
        'n': bi('rw:' + w['Id'], w['Name']),
        'cls': w.get('Class') or '', 'clsZh': CLASSES.get(w.get('Class'), w.get('Class') or ''),
        'build': (w.get('Build') or '').replace('_', ' '),
        'buildZh': zh_of('arch:rw:' + w['Id'], (w.get('Build') or '').replace('_', ' ')),
        'runes': [[zh_of('rune:' + x, (rune_by_id.get(x) or {}).get('Name', x)), (rune_by_id.get(x) or {}).get('Name', x)] for x in (w.get('Runes') or [])],
        'runesRaw': [rune_by_id.get(x, {}).get('Name', x) for x in (w.get('Runes') or [])],
        'bases': [[TAGS.get(x, x), x] for x in (w.get('Bases') or [])],
        'lvl': w.get('Level'), 'sockets': w.get('Sockets'),
        'mods': mods, 'power': power,
        'bands': bandify(w),
        'flav': bi('flav:rw:' + w['Id'], w.get('Flavour') or ''),
    })

# ---------------------------------------------------------------- potions
pot = load(r'Gameplay\potions.json')
POT_SOURCE = {'Guardian': '守护者', 'Core': '核心', 'Catacombs': '墓穴'}
pot_type_by_id = {t['Id']: t for t in pot['Types']}
potion_types = []
for t in pot['Types']:
    mods = []
    for m in t.get('Mods') or []:
        r = R.render_mod(m)
        if r:
            mods.append([r[0], r[1]])
    potion_types.append({
        'id': t['Id'], 'n': bi('pot:' + t['Id'], t['Name']),
        'role': t.get('Role'), 'roleZh': POTION_ROLE.get(t.get('Role'), t.get('Role')),
        'text': bi('ptext:' + t['Id'], t.get('Text') or ''),
        'rec': t.get('RecoverPct'), 'sec': t.get('Seconds'), 'ward': t.get('Ward'),
        'mods': mods, 'weight': t.get('Weight'),
        'bless': t.get('Blessing'), 'onDrink': t.get('OnDrinkCharge'),
    })
potion_mods = []
for m in pot['Mods']:
    tiers = []
    tpl = ZH.get('pmtext:' + m['Id']) or m.get('Text', '')
    for tt in m.get('Tiers') or []:
        line = R.fill(R.pluralize(tpl, tt.get('Value')), {
            'v': R.fmt(tt.get('Value')), 'v2': R.fmt(tt.get('Value2')), 'abs': R.fmt(abs(tt.get('Value') or 0))})
        tiers.append({'tier': tt.get('Tier'), 'minrl': tt.get('MinRL'), 'v': tt.get('Value'), 'v2': tt.get('Value2'), 'line': line})
    potion_mods.append({
        'id': m['Id'], 'n': bi('pm:' + m['Id'], m['Name']),
        'kind': m.get('Kind'), 'kindZh': AFFIX_TYPE.get(m.get('Kind'), m.get('Kind')),
        'roles': m.get('Roles') or [], 'rolesZh': [POTION_ROLE.get(x, x) for x in (m.get('Roles') or [])],
        'effect': m.get('Effect'), 'weight': m.get('Weight'), 'tiers': tiers,
        'text': bi('pmtext:' + m['Id'], m.get('Text') or ''),
    })
potion_uniques = []
for u in pot['Uniques']:
    lines = []
    for ln in u.get('Lines') or []:
        if ln.get('Effect') == 'Stat' and ln.get('Stat'):
            r = R.render_mod(ln['Stat'])
            if r:
                lines.append([r[0], r[1]])
    t_ = pot_type_by_id.get(u.get('Type') or '')
    potion_uniques.append({
        'id': u['Id'], 'n': bi('pu:' + u['Id'], u['Name']),
        'type': u.get('Type'), 'typeN': bi('pot:' + u['Type'], t_['Name']) if t_ else ['', ''],
        'source': u.get('Source'), 'sourceZh': POT_SOURCE.get(u.get('Source'), u.get('Source')),
        'text': bi('putext:' + u['Id'], u.get('Text') or ''), 'lines': lines,
        'later': bool(u.get('Later')),
    })
potions = {
    'types': potion_types,
    'mods': potion_mods,
    'uniques': potion_uniques,
    'vessels': [{'id': v['Id'], 'n': bi('ves:' + v['Id'], v['Name']), 'minrl': v.get('MinRL'),
                 'pre': v.get('Prefixes'), 'suf': v.get('Suffixes'), 'oath': v.get('Oath'),
                 'core': v.get('Core'), 'up': v.get('Upgraded')} for v in pot['Vessels']],
    'slots': [{'slot': s.get('Slot'), 'role': s.get('Role'),
               'roleZh': POTION_ROLE.get(s.get('Role'), s.get('Role')),
               'open': s.get('OpenAt'), 'key': s.get('Key')} for s in pot.get('Slots') or []],
    'charges': [{'role': r, 'roleZh': POTION_ROLE.get(r, r), 'max': v.get('Max'),
                 'use': v.get('PerUse'), 'kill': v.get('PerKill'), 'dur': v.get('Duration')}
                for r, v in (pot.get('Charges') or {}).items()],
    'pour': [{'id': p['Id'], 'n': bi('pour:' + p['Id'], p.get('Name') or '')} for p in pot.get('Pour') or []],
    'costs': [{'id': k, 'items': v} for k, v in (pot.get('Costs') or {}).items()],
    'drops': pot.get('Drops') or {},
    'unlock': pot.get('Unlock') or {},
}

# ---------------------------------------------------------------- mythic / cube / forge
def render_tiers_agnostic(m):
    out = []
    for i, t in enumerate(m.get('Tiers') or []):
        r = R.render_mod(m.get('Mod') or {}, t.get('Min'), t.get('Max'))
        out.append({'t': 'T%d' % (i + 1), 'ilvl': t.get('ILvl'), 'w': t.get('Weight'),
                    'name': bi('tn:' + (t.get('Name') or ''), t.get('Name') or ''),
                    'line': [r[0], r[1]] if r else None})
    return out

mythic = []
for m in load(r'Items\mythic_lines.json')['lines']:
    tiers = m.get('Tiers') or []
    line_name = (tiers[0].get('Name') if tiers else '') or m['Id']
    mythic.append({
        'id': m['Id'], 'n': bi('tn:' + line_name, line_name),
        'type': m.get('Type'), 'typeZh': AFFIX_TYPE.get(m.get('Type'), m.get('Type')),
        'group': m.get('Group'), 'groupZh': zh_of('ag:' + m.get('Group'), m.get('Group')),
        'weight': m.get('Weight'), 'on': m.get('BaseTags') or [],
        'tiers': render_tiers_agnostic(m),
    })

cube_raw = load(r'Items\cube_recipes.json')
cube = []
for c in cube_raw['recipes']:
    fam = c.get('Family')
    cube.append({
        'id': c['Id'], 'family': CUBE_FAMILY.get(fam, fam), 'op': c.get('Op'),
        'n': bi(c['Id'] + ':Name', c.get('Name') or ''),
        'recipe': bi(c['Id'] + ':Recipe', c.get('Recipe') or ''),
        'result': bi(c['Id'] + ':Result', c.get('Result') or ''),
        'makes': bi(c['Id'] + ':Makes', c.get('Makes') or ''),
        'uses': bi(c['Id'] + ':UsesUp', c.get('UsesUp') or ''),
        'keeps': bi(c['Id'] + ':Keeps', c.get('Keeps') or ''),
        'hint': [ZH.get('ch:' + c['Id'], ''), c.get('Hint') or ''],
        'count': c.get('Count'), 'minTier': c.get('MinTier'), 'maxTier': c.get('MaxTier'),
        'hidden': bool(c.get('bHidden')),
    })

forge_raw = load(r'Gameplay\forge.json')
LAND_MAP = {k: bi('land:' + k, v) for k, v in (forge_raw.get('Lands') or {}).items()}
forge = []
for r in forge_raw['Recipes']:
    forge.append({
        'id': r['Id'], 'kind': r.get('Kind'), 'kindZh': FORGE_KIND.get(r.get('Kind'), r.get('Kind')),
        'group': FORGE_GROUP.get(r.get('Group'), r.get('Group')),
        'n': bi(r['Id'] + ':Name', r.get('Name') or ''),
        'text': bi(r['Id'] + ':Text', r.get('Text') or ''),
        'line': bi(r['Id'] + ':Line', r.get('Line') or ''),
        'found': bi(r['Id'] + ':FoundIn', r.get('FoundIn') or ''),
        'mat': r.get('Mat'), 'cost': r.get('MatCost'),
        'mat2': r.get('Mat2'), 'cost2': r.get('Mat2Cost'),
        'tier': r.get('Tier'), 'lvl': r.get('ForgeLevel'),
        'lands': r.get('Lands') or [],
        'landNames': [LAND_MAP.get(x, [x, x]) for x in (r.get('Lands') or [])],
        'guardian': bool(r.get('Guardian')),
        'potential': r.get('Potential'),
    })
materials = []
for m in forge_raw['Materials']:
    materials.append({
        'id': m['Id'], 'n': bi('mat:' + m['Id'], m['Name']),
        'text': bi('mattext:' + m['Id'], m.get('Text') or ''),
        'color': m.get('Color'),
    })
lands = [[zh_of('land:' + k, v), v] for k, v in (forge_raw.get('Lands') or {}).items()]

items = {
    'meta': {
        'version': 'r92', 'build': '65',
        'counts': {'bases': len(bases), 'uniques': len(uniques), 'affixes': len(affixes),
                   'runes': len(runes), 'jewels': len(jewels), 'runewords': len(runewords),
                   'potions': len(potion_types)},
    },
    'bases': bases, 'uniques': uniques, 'affixes': affixes,
    'runes': runes, 'jewels': jewels, 'runewords': runewords,
    'potions': potions, 'mythic': mythic, 'cube': cube, 'forge': forge,
    'materials': materials, 'lands': lands,
}

print('bases', len(bases), 'uniques', len(uniques), 'affixes', len(affixes),
      'runes', len(runes), 'jewels', len(jewels), 'runewords', len(runewords))

# ---------------------------------------------------------------- skills & supports
skills_all = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools', 'skills_all.json'), encoding='utf-8'))
FILE_CLASS = {'warrior': 'Warrior', 'mage': 'Mage', 'ranger': 'Ranger', 'samurai': 'Samurai',
              'paladin': 'Paladin', 'necromancer': 'Necromancer', '_blessings': ''}
GEM_GROWTH = load(r'Gameplay\scaling.json').get('Gem', {}).get('DamageGrowth', 1.19)
GEM_MAX = load(r'Gameplay\scaling.json').get('Gem', {}).get('MaxLevel', 20)

def level_rows(s):
    """Return 20 rows of [level, value] where value is the damage figure."""
    mins, maxs = s.get('SpellMin'), s.get('SpellMax')
    eff = s.get('Effectiveness')
    rows = []
    if mins is not None and maxs is not None:
        for L in range(1, GEM_MAX + 1):
            k = GEM_GROWTH ** (L - 1)
            rows.append([L, round(mins * k, 1), round(maxs * k, 1)])
    elif eff is not None:
        late = s.get('EffectivenessLate')
        lateFrom = s.get('EffectivenessLateFrom')
        lateAt = s.get('EffectivenessLateAt')
        per = 0.08
        for L in range(1, GEM_MAX + 1):
            v = eff + per * (L - 1)
            if late and lateFrom and lateAt and L >= lateFrom:
                frac = (L - lateFrom) / max(1, (lateAt - lateFrom))
                v = v + (late - (eff + per * (lateFrom - 1))) * min(1.0, frac)
            rows.append([L, round(v * 100, 1), None])
    return rows

skills = []
for s in skills_all:
    k = FILE_CLASS.get(s.get('_file'), '')
    kind = s.get('Kind')
    skills.append({
        'id': s['Id'],
        'n': bi('sk:' + s['Id'], s['Name']),
        'cls': k, 'clsZh': CLASSES.get(k, '通用') if k else '通用',
        'kind': kind, 'kindZh': SKILL_KIND.get(kind, kind),
        'attr': s.get('Attribute'), 'attrZh': ATTRIBUTE.get(s.get('Attribute'), s.get('Attribute')),
        'tags': tag_list(s.get('Tags')),
        'rawTags': [x for x in (s.get('Tags') or []) if '=' not in x],
        'weaponKinds': s.get('WeaponKinds') or [],
        'delivery': s.get('Delivery'), 'deliveryZh': DELIVERY.get(s.get('Delivery'), s.get('Delivery')),
        'dmgType': s.get('DamageType'), 'dmgTypeZh': TAGS.get(s.get('DamageType'), s.get('DamageType')),
        'desc': bi('skdesc:' + s['Id'], s.get('Description') or ''),
        'mana': s.get('ManaCost'), 'cast': s.get('CastTime'), 'cd': s.get('Cooldown'),
        'rng': s.get('Range'), 'radius': s.get('Radius'),
        'eff': s.get('Effectiveness'), 'effLate': s.get('EffectivenessLate'),
        'lateFrom': s.get('EffectivenessLateFrom'), 'lateAt': s.get('EffectivenessLateAt'),
        'spell': [s.get('SpellMin'), s.get('SpellMax'), s.get('SpellGrowth')] if s.get('SpellMin') is not None else None,
        'rows': level_rows(s),
        'proj': s.get('Projectiles'), 'chains': s.get('Chains'), 'pierce': s.get('Pierce'),
        'both': bool(s.get('bBothHands')),
        'family': s.get('Family') or '',
        'group': 'blessing' if s.get('_file') == '_blessings' else 'class',
    })

supports = []
for s in load(r'Gameplay\supports.json')['supports']:
    mods = []
    for m in s.get('Mods') or []:
        r = R.render_mod(m)
        if r:
            mods.append([r[0], r[1]])
    supports.append({
        'id': s['Id'],
        'n': bi('sup:' + s['Id'], s['Name']),
        'desc': bi('supdesc:' + s['Id'], s.get('Description') or ''),
        'attr': s.get('Attribute'), 'attrZh': ATTRIBUTE.get(s.get('Attribute'), s.get('Attribute')),
        'lvl': s.get('Level'), 'mana': s.get('ManaMultiplier'),
        'req': [[TAGS.get(x, x), x] for x in (s.get('RequiresAnyTag') or [])],
        'excl': [[TAGS.get(x, x), x] for x in (s.get('ExcludeTags') or [])],
        'mods': mods,
        'raw': raw_direct(s.get('Mods') or []),
        'weight': s.get('DropWeight'),
        'color': col(s.get('Color')),
    })

blessings = []
for b in load(r'Gameplay\blessings.json')['blessings']:
    mods = []
    for m in b.get('Mods') or []:
        v = m.get('Value')
        per = m.get('PerLevel') or 0
        top = (v or 0) + per * (GEM_MAX - 1)
        r = R.render_mod(m, v, v)
        if r:
            mods.append({'line': [r[0], r[1]], 'per': per, 'top': round(top, 2)})
    vb = b.get('Vowbreak') or {}
    vals = {}
    for i, m in enumerate(b.get('Mods') or []):
        vals[str(i)] = R.fmt(m.get('Value'))
    tpl = b.get('Text') or ''
    vtpl = vb.get('BurstText') or ''
    zt = EXTRA_ZH.get('bl:' + b['Id'] + ':text') or tpl
    zv = EXTRA_ZH.get('bl:' + b['Id'] + ':burst') or vtpl
    blessings.append({
        'id': b['Id'], 'n': bi('bl:' + b['Id'], b['Name']),
        'kind': b.get('Kind'), 'kindZh': {'Vow': '誓约', 'Herald': '先驱', 'Woe': '灾祸'}.get(b.get('Kind'), b.get('Kind')),
        'skill': b.get('Skill'), 'order': b.get('Order'),
        'resFlat': b.get('ReserveFlat'), 'resFlatPer': b.get('ReserveFlatPerLevel'), 'resPct': b.get('ReservePct'),
        'mods': mods,
        'text': [R.fill(zt, vals), R.fill(tpl, vals)],
        'vb': {'sec': vb.get('Seconds'), 'mult': vb.get('Mult'), 'lock': vb.get('Lockout'),
               'heal': vb.get('HealPct'), 'text': [R.fill(zv, vals), R.fill(vtpl, vals)]},
        'color': col(b.get('Color')),
    })

curses = []
for c in load(r'Gameplay\curses.json')['curses']:
    taken = c.get('TakenPct') or 0
    elem = c.get('ElementTakenPct') or {}
    slow = c.get('Slow') or 0
    rdown = c.get('ResistDown') or {}
    dealt = c.get('DealtLessPct') or 0
    vals = {'0': R.fmt(taken), '1': R.fmt(list(elem.values())[0] if elem else 0),
            '2': R.fmt(round(slow * 100)), '3': R.fmt(list(rdown.values())[0] if rdown else 0),
            '4': R.fmt(dealt)}
    tpl = c.get('Text') or ''
    zt = EXTRA_ZH.get('cu:' + c['Id'] + ':text') or tpl
    curses.append({
        'id': c['Id'], 'n': bi('cu:' + c['Id'], c['Name']),
        'kind': c.get('Kind'), 'kindZh': {'Woe': '灾祸', 'Sentence': '判决', 'Ailment': '异常状态',
                                          'Mark': '印记', 'Banner': '战旗'}.get(c.get('Kind'), c.get('Kind')),
        'dur': c.get('Duration'), 'taken': taken, 'elem': elem, 'slow': slow,
        'boss': c.get('BossEffect'), 'text': [R.fill(zt, vals), R.fill(tpl, vals)],
        'color': col(c.get('Color')), 'dread': c.get('Dread'), 'onDeath': c.get('OnDeath'),
    })

guides = []
for g in load(r'Gameplay\guides.json')['Guides']:
    guides.append({
        'id': g['Id'], 'cls': g.get('Class'), 'clsZh': CLASSES.get(g.get('Class'), g.get('Class')),
        'role': g.get('Role'),
        'title': bi('gd:' + g['Id'] + ':title', g.get('Title') or ''),
        'why': bi('gd:' + g['Id'] + ':why', g.get('Why') or ''),
        'skill': g.get('Skill'), 'wish': g.get('Wishlist') or [], 'keys': g.get('Keystones') or [],
        'code': g.get('Code'), 'gems': g.get('Gems') or [],
    })

skilldata = {'skills': skills, 'supports': supports, 'blessings': blessings, 'curses': curses,
             'guides': guides, 'gemMax': GEM_MAX, 'gemGrowth': GEM_GROWTH}

print('skills', len(skills), 'supports', len(supports), 'blessings', len(blessings), 'curses', len(curses), 'guides', len(guides))
print('zh coverage items:', len(ZH))
