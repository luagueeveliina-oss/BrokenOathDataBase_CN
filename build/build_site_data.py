# -*- coding: utf-8 -*-
"""Assemble the remaining data (passive tree, bestiary, mechanics) and write every JS data file."""
import json, os, sys, math, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_data as B
import render as R
from terms_zh import TAGS, CLASSES, TREE_KIND, RARITY, SLOTS

DATA = B.DATA
OUT = B.OUT
bi = B.bi
zh_of = B.zh_of

# ---------------------------------------------------------------- passive tree
pt = B.load(r'Gameplay\passive_tree.json')
nodes_raw = pt['nodes']
node_ids = {n['Id'] for n in nodes_raw}
edges = []
seen = set()
for n in nodes_raw:
    for l in n.get('Links') or []:
        if l in node_ids:
            k = tuple(sorted((n['Id'], l)))
            if k not in seen:
                seen.add(k)
                edges.append([k[0], k[1]])

def node_mods(n):
    out = []
    for m in n.get('Mods') or []:
        r = R.render_mod(m)
        if r:
            out.append([r[0], r[1]])
    return out

nodes = []
for n in nodes_raw:
    price = n.get('Price') or ''
    nodes.append({
        'i': n['Id'],
        'n': bi('tn2:' + n['Id'], n['Name']),
        'k': n['Kind'], 'kZh': TREE_KIND.get(n['Kind'], n['Kind']),
        'x': n['X'], 'y': n['Y'],
        'g': n.get('Group') or '',
        'r': n.get('Region') or '',
        'c': n.get('ClassStart') or '',
        'icon': n.get('Icon') or '',
        'm': node_mods(n),
        'raw': B.raw_direct(n.get('Mods') or []),
        't': B.bi('modtext:' + n.get('Text'), n.get('Text') or '') if n.get('Text') else ['', ''],
        'f': bi('tf:' + n['Id'], n.get('Flavour') or ''),
        'p': ['', ''] if not price else [price, price],
        'sock': n.get('Socket') or '',
        'choice': n.get('Choice') or '',
        'orb': n.get('Orbit') or None,
    })

classes6 = ['Warrior', 'Mage', 'Ranger', 'Samurai', 'Paladin', 'Necromancer']
tree = {
    'nodes': nodes,
    'edges': edges,
    'classes': [[CLASSES.get(c, c), c] for c in classes6],
    'suggested': pt.get('Suggested') or {},
    'version': pt.get('Version'),
    'slots': (pt.get('Layout') or {}).get('Slots') or {},
}

# ---------------------------------------------------------------- dragonling (subclass) tree
def dragon_mods(n):
    asc = n.get('Ascend') or {}
    pos = n.get('Pos76') or {}
    src = asc.get('Mods') or pos.get('Mods') or n.get('Mods') or []
    out = []
    for m in src:
        r = R.render_mod(m)
        if r:
            out.append([r[0], r[1]])
    return out


DL = (B.load(r'Gameplay\dragonling.json') or {}).get('Tree') or {}
dragon_classes = []
for cls in ['Warrior', 'Mage', 'Ranger', 'Samurai', 'Paladin', 'Necromancer']:
    raw = (DL.get('Classes') or {}).get(cls) or []
    ids = {x['Id'] for x in raw}
    dn, de, seen = [], [], set()
    for n in raw:
        asc = n.get('Ascend') or {}
        pos = n.get('Pos76') or {}
        name = asc.get('Name') or n.get('Name') or ''
        icon = asc.get('Icon') or n.get('Icon') or ''
        text = asc.get('Text') or pos.get('Text') or n.get('Text') or ''
        dn.append({
            'i': n['Id'],
            'n': bi('dn:' + n['Id'], name),
            'k': n.get('Kind') or 'Small',
            'kZh': TREE_KIND.get(n.get('Kind'), n.get('Kind')),
            'p': n.get('Path') or '',
            'pZh': bi('dp:' + n['Path'], n['Path']) if n.get('Path') else ['', ''],
            'x': n.get('X') or 0, 'y': n.get('Y') or 0,
            'icon': icon,
            'm': dragon_mods(n),
            't': [B.ZH.get('dt:' + n['Id'], ''), ''],
            'asc': 1 if asc else 0,
            'only': 1 if n.get('AscendOnly') else 0,
        })
        for l in n.get('Links') or []:
            if l in ids:
                k = tuple(sorted((n['Id'], l)))
                if k not in seen:
                    seen.add(k)
                    de.append([k[0], k[1]])
    dragon_classes.append({'c': cls, 'n': [CLASSES.get(cls, cls), cls], 'nodes': dn, 'edges': de})

# 节点图标图集：tools/icons.json 里的 tree 映射（T px 一格，cols 列）
try:
    import json as _json
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _ti = _json.load(open(os.path.join(ROOT, 'tools', 'icons.json'), encoding='utf-8'))['tree']
    used = {n.get('icon') for n in nodes if n.get('icon')}
    used |= {'portrait_Warrior', 'portrait_Mage', 'portrait_Ranger',
             'portrait_Samurai', 'portrait_Paladin', 'portrait_Necromancer'}
    for c in dragon_classes:
        used |= {n.get('icon') for n in c['nodes'] if n.get('icon')}
    _idx = _ti['idx']
    idx = {}
    for k in used:
        if k in _idx:
            idx[k] = _idx[k]
        elif ('@' + k) in _idx:      # game Icon names lack the atlas' '@' prefix
            idx[k] = _idx['@' + k]

    _keys = set(_idx.keys())

    def _atlas_key(n):
        """Map a passive node to an icon in the public atlas (keystones by id, rest by effect)."""
        kind = n['Kind']
        if kind == 'Keystone' and ('ks_' + n['Id']) in _keys:
            return 'ks_' + n['Id']
        stats = set()
        tags = set()
        for m in n.get('Mods') or []:
            stats.add(m.get('Stat'))
            tags |= set(m.get('Tags') or [])
        fam = ''
        for t, f in (('Fire', 'fire'), ('Cold', 'cold'), ('Lightning', 'lightning'), ('Poison', 'poison'),
                     ('Elemental', 'elemental'), ('Slam', 'slam'), ('Channelling', 'channel'),
                     ('Bow', 'bow'), ('Projectile', 'projectile'), ('Melee', 'melee'), ('Area', 'area'),
                     ('Trap', 'trap'), ('Chain', 'chain'), ('Spell', 'spell'), ('Attack', 'attack')):
            if t in tags:
                fam = f
                break
        if not fam:
            for s, f in (('Life', 'life'), ('LifeRegenPct', 'life'), ('LifeOnKill', 'life'),
                         ('LifeLeech', 'leech'), ('Leech', 'leech'),
                         ('Mana', 'mana'), ('ManaRegen', 'mana'), ('ManaCost', 'mana'),
                         ('Armour', 'armour'), ('Evasion', 'evasion'), ('EnergyShield', 'energy_shield'),
                         ('Resist', 'resist'), ('CritChance', 'crit'), ('CritMulti', 'crit'),
                         ('AttackSpeed', 'speed'), ('CastSpeed', 'spell'), ('MoveSpeed', 'swift'),
                         ('Block', 'bulwark'), ('Area', 'area'),
                         ('MinionDamage', 'grave'), ('MinionLife', 'grave'), ('MinionAttackSpeed', 'grave')):
                if s in stats:
                    fam = f
                    break
        if not fam:
            fam = {'Warrior': 'attack', 'Mage': 'spell', 'Ranger': 'bow', 'Samurai': 'edge',
                   'Paladin': 'faith', 'Necromancer': 'bone'}.get(n.get('Region') or '', 'sigil')
        suffix = '_N' if kind in ('Notable', 'Choice') else '_S'
        for cand in (fam + suffix, fam + '_N', fam + '_S', fam):
            if cand in _keys:
                return cand
        return ''

    raw_by_id = {n['Id']: n for n in nodes_raw}
    for n in nodes:
        n['ico'] = _atlas_key(raw_by_id[n['i']])
        if n['ico'] and n['ico'] in _idx:
            idx[n['ico']] = _idx[n['ico']]

    rows = max(list(_ti['idx'].values()) + [0]) // _ti['cols'] + 1
    tree['icons'] = {'T': _ti['T'], 'cols': _ti['cols'], 'w': _ti['cols'] * _ti['T'],
                     'h': rows * _ti['T'], 'idx': idx}
except Exception as exc:  # noqa: BLE001
    print('  ! icon atlas mapping failed:', exc)
    tree['icons'] = {'T': 64, 'cols': 22, 'w': 1408, 'h': 1344, 'idx': {}}

tree['dragon'] = {
    'version': DL.get('TreeVersion'),
    'milestones': DL.get('MilestoneLevels') or [],
    'pointsPerGate': DL.get('PointsPerGateKill'),
    'refundNodes': DL.get('RefundNodes'),
    'aspectChange': DL.get('AspectChangeNodes'),
    'maxKeystones': DL.get('MaxKeystones'),
    'classes': dragon_classes,
}

# ---------------------------------------------------------------- bestiary
scaling = B.load(r'Gameplay\scaling.json')
mon = B.load(r'Gameplay\monsters.json')['monsters']
monsters = []
for m in mon:
    attacks = []
    for a in (m.get('Attacks') or [])[:6]:
        attacks.append({'kind': a.get('Kind'), 'dmg': a.get('Damage'), 'cd': a.get('Cooldown'),
                        'range': a.get('Range'), 'angle': a.get('Angle')})
    monsters.append({
        'id': m['Id'], 'n': bi('mob:' + m['Id'], m['Name']),
        'life': m.get('Life'), 'dmin': m.get('DamageMin'), 'dmax': m.get('DamageMax'),
        'xp': m.get('XP'), 'armour': m.get('Armour') or 0,
        'walk': m.get('WalkSpeed'), 'run': m.get('RunSpeed'), 'aggro': m.get('AggroRadius'),
        'stagger': m.get('StaggerResist'), 'scale': m.get('Scale'),
        'role': m.get('Role') or '', 'family': m.get('Family') or '',
        'atk': attacks,
        'nAtk': len(m.get('Attacks') or []),
    })
monsters.sort(key=lambda x: (-(x['life'] or 0)))

bs = B.load(r'Rifts\bosses.json')
guardians = []
for g in bs['guardians']:
    guardians.append({
        'id': g['Id'], 'n': bi('gname:' + g['Id'], g['Name']),
        'lore': bi('glore:' + g['Id'], g.get('Lore') or ''),
        'monster': g.get('Monster'), 'life': g.get('LifeShare'), 'ship': g.get('Ship'),
        'variants': [{'id': v.get('Id'), 'n': bi('g:' + g['Id'] + ':' + str(v.get('Id')), v.get('Name') or ''),
                      'element': v.get('Element') or '', 'resist': v.get('Resist') or {}, 'scale': v.get('Scale')}
                     for v in (g.get('Variants') or [])],
        'phases': g.get('Phases') or [],
        'mods': g.get('Mods') or [],
    })
guardian_tiers = []
for t in bs.get('Tiers') or []:
    guardian_tiers.append({
        'id': t.get('Id'), 'n': bi('btname:' + str(t.get('Id')), t.get('Name') or ''),
        'fromRL': t.get('FromRL'), 'every': t.get('Every'), 'count': t.get('Count'),
        'damage': t.get('Damage'), 'pinnacle': bool(t.get('bPinnacle')),
        'text': bi('bttext:' + str(t.get('Id')), t.get('Text') or ''),
    })

mobs = {'monsters': monsters, 'guardians': guardians, 'tiers': guardian_tiers,
        'count': len(monsters), 'gcount': len(guardians)}

print('tree nodes', len(nodes), 'edges', len(edges), 'monsters', len(monsters), 'guardians', len(guardians))

# ---------------------------------------------------------------- mechanics
def pick(d, keys):
    return {k: d.get(k) for k in keys if k in d}

mech = {
    'scaling': {
        'monsterLife': pick(scaling.get('MonsterLife') or {}, ['Base', 'K', 'P']),
        'monsterDamage': pick(scaling.get('MonsterDamage') or {}, ['Base', 'K', 'P']),
        'monsterXp': pick(scaling.get('MonsterXp') or {}, ['Base', 'K', 'P']),
        'resistPerLevel': scaling.get('MonsterResistPerLevel'),
        'resistMax': scaling.get('MonsterResistMax'),
        'armourPerLevel': scaling.get('MonsterArmourPerLevel'),
        'rarity': scaling.get('Rarity') or {},
        'dropWeights': scaling.get('DropRarityWeights') or {},
        'bossDrop': pick(scaling.get('BossDrop') or {}, ['UniqueChance', 'SupportGemChance', 'bGuaranteedRare']),
        'affixItemLevels': scaling.get('AffixTierItemLevels') or [],
        'gem': pick(scaling.get('Gem') or {}, ['MaxLevel', 'DamageGrowth', 'AttackEffectivenessPerLevel',
                                               'BonusLevelAttackMore', 'BonusLevelGrowth']),
        'hero': pick(scaling.get('Hero') or {}, ['LifeBase', 'LifePerLevel', 'LifePerStr', 'ManaBase', 'ManaPerLevel']),
        'xpPenalty': scaling.get('XpLevelPenalty') or {},
        'rift': pick(scaling.get('Rift') or {}, ['MapMaxLevel', 'LadderMaxLevel', 'LadderLifePerLevel',
                                                 'LadderDamagePerLevel', 'LadderXpPctPerLevel']),
        'economy': scaling.get('Economy') or {},
        'ailments': {k: v for k, v in (scaling.get('Ailments') or {}).items() if not str(k).startswith('_')} if isinstance(scaling.get('Ailments'), dict) else {},
    },
    'runeRules': B.load(r'Items\runes.json')['Rules'],
    'cubeRules': B.load(r'Items\cube_recipes.json')['Rules'],
    'forge': {'rules': B.load(r'Gameplay\forge.json')['Rules'],
              'drops': {k: v for k, v in (B.load(r'Gameplay\forge.json')['Drops'] or {}).items() if not str(k).startswith('_')}},
    'quality': B.load(r'Items\quality_stones.json'),
    'classes': [{k: v for k, v in c.items() if k in ('Id', 'Str', 'Dex', 'Int', 'StrPerLevel', 'DexPerLevel',
                                                     'IntPerLevel', 'MoveSpeed', 'WeaponClasses', 'Gem1', 'Gem2', 'Gem3',
                                                     'StartWeapon', 'UpgradeWeapon')}
                for c in B.load(r'Gameplay\classes.json')['classes']],
    'zones': [{'id': z['Id'], 'n': bi('zone', z['Name']), 'objective': z.get('StartObjective') or '',
               'act': z.get('Act'), 'kicker': z.get('Kicker') or ''} for z in B.load(r'Zones\zones.json')['zones']],
    'achievements': len(B.load(r'Gameplay\achievements.json').get('achievements') or []),
}

# extra classes from parts files (class definitions are split per class)
parts_cls = []
for f in ['warrior', 'mage', 'ranger', 'samurai', 'paladin', 'necromancer']:
    p = os.path.join(DATA, 'Gameplay', 'Parts', f, 'classes.json')
    if os.path.exists(p):
        j = json.load(open(p, encoding='utf-8'))
        for c in j.get('classes') or []:
            parts_cls.append({k: v for k, v in c.items() if k in ('Id', 'Str', 'Dex', 'Int', 'StrPerLevel',
                                                                   'DexPerLevel', 'IntPerLevel', 'MoveSpeed',
                                                                   'WeaponClasses', 'Gem1', 'Gem2', 'Gem3',
                                                                   'StartWeapon', 'UpgradeWeapon')})
byid = {}
for c in mech['classes'] + parts_cls:
    byid[c['Id']] = c
mech['classes'] = [{'Id': k, 'n': [CLASSES.get(k, k), k], **v} for k, v in byid.items()
                   if k in ('Warrior', 'Mage', 'Ranger', 'Samurai', 'Paladin', 'Necromancer')]

# level curve for monster life / damage / xp
def curve(c, lv):
    base, K, P = c.get('Base') or 0, c.get('K') or 0, c.get('P') or 0
    return base * (1 + K * (lv ** P))
mech['curves'] = {
    'life': [[L, round(curve(mech['scaling']['monsterLife'], L), 1)] for L in range(1, 101)],
    'damage': [[L, round(curve(mech['scaling']['monsterDamage'], L), 1)] for L in range(1, 101)],
    'xp': [[L, round(curve(mech['scaling']['monsterXp'], L), 2)] for L in range(1, 101)],
}

# ---------------------------------------------------------------- write files
def write(name, var, obj):
    p = os.path.join(OUT, name + '.js')
    with open(p, 'w', encoding='utf-8') as f:
        f.write('window.BO_%s=%s;\n' % (var, json.dumps(obj, ensure_ascii=False, separators=(',', ':'))))
    print('  %-12s %8.1f KB' % (name + '.js', os.path.getsize(p) / 1024))

write('items', 'ITEMS', B.items)
write('skills', 'SKILLS', B.skilldata)
write('tree', 'TREE', tree)
write('bestiary', 'MOBS', mobs)
write('mechanics', 'MECH', mech)
print('done')
