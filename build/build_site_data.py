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
        'm': node_mods(n),
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
