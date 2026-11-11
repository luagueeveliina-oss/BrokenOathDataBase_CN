# -*- coding: utf-8 -*-
"""Build the planner data files (site/assets/data/planner_*.js) from the game data (read-only).

Three payloads:
  planner_core.js   BO_PCORE  constants, classes, skills, supports, blessings, curses, stat texts
  planner_items.js  BO_PITEMS bases, affixes, uniques, runes, jewels, runewords
  planner_tree.js   BO_PTREE  passive tree, dragonling tree

The raw mods (Stat / Mode / Tags / Value) are exported so the browser can run the
same aggregation the game does: every 'increased' line of one kind adds up, each
'more' line multiplies on its own (see the game's own rules text, Mech.IncMore).
"""
import json, os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import render as R  # noqa: F401  (kept so the module set mirrors the other builders)
import build_data as B
from terms_zh import (TAGS, SLOTS, CLASSES, ITEM_CLASSES, DELIVERY, SKILL_KIND,
                      ATTRIBUTE, AFFIX_TYPE, TREE_KIND, RARITY, POTION_ROLE)

DATA = B.DATA
OUT = os.path.join(ROOT, 'site', 'assets', 'data')
os.makedirs(OUT, exist_ok=True)
bi = B.bi
load = B.load

VERSION = '0.56.5'


# ---------------------------------------------------------------- helpers
def raw(mod, lo=None, hi=None, local=None, extra=None):
    """Compact raw mod for the calculator: {s,m,t,v,v2?,l?,g?,x?}."""
    if not isinstance(mod, dict):
        return None
    stat = mod.get('Stat')
    if not stat:
        return None
    mode = mod.get('Mode') or 'Flat'
    tags = [t for t in (mod.get('Tags') or []) if isinstance(t, str)]
    gem = 'GemScaled' in tags
    tags = [t for t in tags if t != 'GemScaled']
    v = mod.get('Value')
    if v is None:
        v = lo if lo is not None else 0
    if lo is None and hi is not None:
        v = (v + hi) / 2.0
    out = {'s': stat, 'm': mode}
    try:
        out['v'] = round(float(v), 3)
    except (TypeError, ValueError):
        out['v'] = 0
    v2 = mod.get('Value2')
    if v2 is not None:
        try:
            out['v2'] = round(float(v2), 3)
        except (TypeError, ValueError):
            pass
    if tags:
        out['t'] = tags
    is_local = mod.get('bLocal') if local is None else local
    if is_local:
        out['l'] = 1
    if gem:
        out['g'] = 1
    if extra:
        out['x'] = extra
    return out


def raws(mods, **kw):
    out = []
    for m in mods or []:
        r = raw(m, **kw)
        if r:
            out.append(r)
    return out


def tag_zh(t):
    return TAGS.get(t, t)


def write(name, var, obj):
    p = os.path.join(OUT, name + '.js')
    txt = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    with open(p, 'w', encoding='utf-8') as f:
        f.write('window.%s=%s;\n' % (var, txt))
    print('  %-18s %8.1f KB' % (name + '.js', os.path.getsize(p) / 1024))


# ---------------------------------------------------------------- constants
scaling = load(r'Gameplay\scaling.json')
hero = scaling.get('Hero') or {}
gem = scaling.get('Gem') or {}
ail = {k: v for k, v in (scaling.get('Ailments') or {}).items() if not str(k).startswith('_')}
meta59 = {k: v for k, v in (scaling.get('Meta59') or {}).items() if not str(k).startswith('_')}
rune_rules = load(r'Items\runes.json')['Rules']

# 动画速度（每职业/技能）：由游戏动画片段测得的 Rate，社区构筑器校准，按游戏规则乘在攻速/施法速度上。
anim_rate = {}
_anim_path = os.path.join(HERE, 'anim_rate.json')
if os.path.exists(_anim_path):
    try:
        anim_rate = (json.load(open(_anim_path, encoding='utf-8')) or {}).get('rates') or {}
    except Exception as exc:
        print('  anim_rate.json ignored:', exc)

consts = {
    'gemMax': gem.get('MaxLevel', 20),
    'gemGrowth': gem.get('DamageGrowth', 1.19),
    'effPerLvl': gem.get('AttackEffectivenessPerLevel', 0.08),
    'bonusLvlMore': gem.get('BonusLevelAttackMore', 1.06),
    'socketsAtLevel': gem.get('SocketsAtLevel') or [1, 2, 5, 9, 15, 20],
    'manaAtLevel': gem.get('ManaCostAtGemLevel') or [],
    'charLvlForGem': gem.get('CharLevelForGemLevel') or [],
    'reqBase': gem.get('ReqBase', 5),
    'reqPerCharLvl': gem.get('ReqPerCharLevel', 2.25),
    'reqOffset': gem.get('ReqLevelOffset', 3),
    'reqMin': gem.get('ReqMinimum', 8),
    'critBase': hero.get('CritBase', 5),
    'spellCritBase': hero.get('SpellCritBase', 6),
    'critMultiBase': hero.get('CritMultiBase', 150),
    'critCap': 95,
    'lifeBase': hero.get('LifeBase', 130),
    'lifePerLevel': hero.get('LifePerLevel', 11.5),
    'lifePerStr': hero.get('LifePerStr', 0.5),
    'manaBase': hero.get('ManaBase', 80),
    'manaPerLevel': hero.get('ManaPerLevel', 6),
    'manaPerInt': hero.get('ManaPerInt', 0.5),
    'manaRegenPct': hero.get('ManaRegenPct', 2.5),
    'lifeRegenPct': hero.get('LifeRegenPct', 0.8),
    'esPerInt': hero.get('EsPerInt79', 0.5),
    'evaPerDex': hero.get('EvasionPerDex79', 2),
    'strMeleePhys': hero.get('StrMeleePhysPer10', 2),
    'strArmour': hero.get('StrArmourPctPer10', 4),
    'strStun': hero.get('StrStunKnockPer10', 1),
    'strArea': hero.get('StrMeleeAreaPer10', 1),
    'dexEvasion': hero.get('DexEvasionPctPer10', 4),
    'dexAtkSpeed': hero.get('DexAttackSpeedPer10', 1),
    'dexMove': hero.get('DexMoveRechargePer10', 1),
    'dexProjSpeed': hero.get('DexProjSpeedPer10', 1),
    'intSpell': hero.get('IntSpellDamagePer10', 2),
    'intMinion': hero.get('IntMinionDamagePer10', 1),
    'intEs': hero.get('IntEsPctPer10', 4),
    'intAilment': hero.get('IntAilmentDurPer10', 1),
    'intCurse': hero.get('IntCurseEffectPer10', 1),
    'armourFactor': hero.get('ArmourFactor', 5),
    'armourMax': hero.get('ArmourMaxReduction', 80),
    'armourBigRef': hero.get('ArmourBigHitRef', 1000),
    'armourBigSlope': hero.get('ArmourBigHitSlope', 0.02),
    'evasionGlance': hero.get('EvasionGlance', 0.7),
    'evasionBase': hero.get('EvasionBase', 400),
    'evasionScale': hero.get('EvasionScale', 0.35),
    'evasionMlvl': hero.get('EvasionMlvlFactor', 0.04),
    'evasionMax': hero.get('EvasionMax', 75),
    'blockMax': hero.get('BlockMax', 75),
    'blockReduction': hero.get('BlockReduction', 85),
    'resCap': hero.get('ResistCap', 75),
    'resHardCap': hero.get('ResistHardCap', 85),
    'resPenaltyPerAct': hero.get('ResistPenaltyPerAct', 10),
    'resPenaltyMax': hero.get('ResistPenaltyMax', 50),
    'leechRate': hero.get('LeechRatePct', 20),
    'passivePerLevel': hero.get('PassivePointsPerLevel', 1),
    'actionMin': hero.get('ActionRateMin', 0.75),
    'actionMax': hero.get('ActionRateMax', 4.0),
    'ail': ail,
    'meta59': meta59,
    # affix budget by rarity (the game rolls prefixes and suffixes into separate pools)
    'affixCap': {'Normal': [0, 0], 'Magic': [1, 1], 'Rare': [3, 3], 'Unique': [0, 0]},
    # the biggest socket count a base can hold, per item slot / grip (runes.json MaxSockets)
    'maxSockets': rune_rules.get('MaxSockets') or {},
    'socketCap': (load(r'Items\cube_recipes.json')['Rules'].get('SocketCap') or {}),
    'monsterResistPerLevel': scaling.get('MonsterResistPerLevel', 0.36),
    'monsterResistMax': scaling.get('MonsterResistMax', 25),
    'monsterArmourPerLevel': scaling.get('MonsterArmourPerLevel', 1.5),
    'monsterLife': scaling.get('MonsterLife') or {'Base': 20.0, 'K': 0.4577, 'P': 0.55},
    'monsterDamage': scaling.get('MonsterDamage') or {'Base': 4.5, 'K': 0.2959, 'P': 0.6},
    'qualityMax': 20,
    'minionNear': 60,
    'minionPace': 0.72,
    'rarityScale': scaling.get('Rarity') or {},
    'maps': {'MapMaxLevel': (scaling.get('Rift') or {}).get('MapMaxLevel', 80)},
}

# 参考怪物：用于「对某个裂隙等级的怪物的实际 DPS」（抗性/护甲/感电强度都依赖它）
import math
_mon = load(r'Gameplay\monsters.json')['monsters']
_lives = sorted([m.get('Life') or 0 for m in _mon])
_med = _lives[len(_lives) // 2] if _lives else 100
_ml = scaling.get('MonsterLife') or {'Base': 20.0, 'K': 0.4577, 'P': 0.55}
ref_monster = {
    'medianLifeBase': _med,
    'life': [[L, round(_med * _ml.get('Base', 20) * math.exp(_ml.get('K', 0.4577) * (L ** _ml.get('P', 0.55))), 1)]
             for L in range(1, 101)],
    'resistPerLevel': scaling.get('MonsterResistPerLevel', 0.36),
    'resistMax': scaling.get('MonsterResistMax', 25),
    'armourPerLevel': scaling.get('MonsterArmourPerLevel', 1.5),
    'modelDps': (load(r'Rifts\bosses.json').get('Flow') or {}).get('ModelDpsByRL') or [],
}

# 召唤物的属性块（monsters.json）：召唤技能只给出怪物的 Id 与召唤倍率，实际命中值来自这里。

# ---------------------------------------------------------------- classes
parts_cls = []
for f in ['warrior', 'mage', 'ranger', 'samurai', 'paladin', 'necromancer']:
    p = os.path.join(DATA, 'Gameplay', 'Parts', f, 'classes.json')
    if os.path.exists(p):
        j = json.load(open(p, encoding='utf-8'))
        parts_cls += j.get('classes') or []
cls_by_id = {}
for c in (load(r'Gameplay\classes.json')['classes'] + parts_cls):
    cls_by_id[c['Id']] = c
classes = []
for cid in ['Warrior', 'Mage', 'Ranger', 'Samurai', 'Paladin', 'Necromancer']:
    c = cls_by_id.get(cid)
    if not c:
        continue
    classes.append({
        'id': cid, 'n': CLASSES.get(cid, cid),
        'str': c.get('Str'), 'dex': c.get('Dex'), 'int': c.get('Int'),
        'sL': c.get('StrPerLevel'), 'dL': c.get('DexPerLevel'), 'iL': c.get('IntPerLevel'),
        'move': c.get('MoveSpeed'),
        'weapons': c.get('WeaponClasses') or [],
        'gems': [c.get('Gem1'), c.get('Gem2'), c.get('Gem3')],
        'start': c.get('StartWeapon'), 'up': c.get('UpgradeWeapon'),
        'early': {'pct': c.get('EarlyDamagePct') or 0,
                  'full': c.get('EarlyDamageFullToLevel') or 0,
                  'end': c.get('EarlyDamageEndLevel') or 0},
    })

# ---------------------------------------------------------------- skills
files = [os.path.join(DATA, 'Gameplay', 'skills.json')]
files += sorted(glob.glob(os.path.join(DATA, 'Gameplay', 'Parts', '*', 'skills.json')))
FILE_CLASS = {'warrior': 'Warrior', 'mage': 'Mage', 'ranger': 'Ranger', 'samurai': 'Samurai',
              'paladin': 'Paladin', 'necromancer': 'Necromancer', '_blessings': '', 'core': ''}
skills_raw = []
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    key = os.path.basename(os.path.dirname(f)).lower()
    for s in d.get('skills') or []:
        s = dict(s)
        s['_cls'] = FILE_CLASS.get(key, '')
        skills_raw.append(s)
skill_by_id = {s['Id']: s for s in skills_raw}

# 召唤物的属性块（monsters.json）：召唤技能只给出怪物的 Id 与召唤倍率，实际命中值来自这里。
_monster_by_id = {m['Id']: m for m in _mon}
minion_stats = {}
for _s in skills_raw:
    _mi = _s.get('Minion') or {}
    _mid = _mi.get('MonsterId')
    if not _mid or _mid in minion_stats:
        continue
    _m = _monster_by_id.get(_mid)
    if not _m:
        continue
    minion_stats[_mid] = {
        'id': _mid,
        'n': bi('min:' + _mid, _m.get('Name') or _mid),
        'life': _m.get('Life') or 0,
        'dmg': [_m.get('DamageMin') or 0, _m.get('DamageMax') or 0],
        'armour': _m.get('Armour') or 0,
        'attacks': [{'kind': a.get('Kind'), 'cd': a.get('Cooldown'), 'dmg': a.get('Damage'),
                     'element': a.get('Element') or 'Physical'}
                    for a in (_m.get('Attacks') or [])],
    }


def skill_rec(s):
    sid = s['Id']
    rec = {
        'id': sid,
        'n': bi('sk:' + sid, s['Name']),
        'cls': s.get('_cls') or '',
        'kind': s.get('Kind'),
        'kindZh': SKILL_KIND.get(s.get('Kind'), s.get('Kind')),
        'attr': s.get('Attribute'),
        'tags': [t for t in (s.get('Tags') or []) if isinstance(t, str)],
        'deliv': s.get('Delivery'),
        'delivZh': DELIVERY.get(s.get('Delivery'), s.get('Delivery')),
        'dmg': s.get('DamageType'),
        'desc': bi('skdesc:' + sid, s.get('Description') or ''),
        'eff': s.get('Effectiveness'),
        'effLate': s.get('EffectivenessLate'),
        'lateFrom': s.get('EffectivenessLateFrom'),
        'lateAt': s.get('EffectivenessLateAt'),
        'effEarly': s.get('EffectivenessEarly'),
        'eHold': s.get('EffectivenessEarlyHold'),
        'eFull': s.get('EffectivenessEarlyFull'),
        'cast': s.get('CastTime'),
        'cd': s.get('Cooldown'),
        'cdLate': s.get('CooldownLate'),
        'cdLateAt': s.get('CooldownLateAt'),
        'act': s.get('ActionSpeed'),
        'mana': s.get('ManaCost'),
        'proj': s.get('Projectiles'),
        'projLv': s.get('ProjectilesAtLevels'),
        'chains': s.get('Chains'),
        'pierce': s.get('Pierce'),
        'strikes': s.get('Strikes'),
        'wk': [w for w in (s.get('WeaponKinds') or []) if isinstance(w, str)],
        'both': 1 if s.get('bBothHands') else 0,
        'minion': s.get('Minion'),
        'totem': s.get('Totem'),
        'channel': s.get('Channel'),
        'orbit': s.get('Orbit'),
        'brand': s.get('Brand'),
        'rain': s.get('Rain'),
        'convert': s.get('ConvertShare'),
        'lifeBase': s.get('LifeAsBase'),
        'smin': s.get('SpellMin'), 'smax': s.get('SpellMax'), 'growth': s.get('SpellGrowth'),
        'req': [r for r in (s.get('Requires') or []) if isinstance(r, str)],
        'accepts': s.get('AcceptsSupports') or [],
    }
    return rec


skills = [skill_rec(s) for s in skills_raw]

# weapon -> granted skills（同时给底材补一个技能用的武器类别 Kind）
weapons_raw = load(r'Gameplay\weapons.json')['weapons']
weapon_skills = {}
weapon_kind = {}
for w in weapons_raw:
    weapon_skills[w['Id']] = {'basic': w.get('BasicSkill'), 'granted': w.get('GrantedSkill')}
    weapon_kind[w['Id']] = w.get('Kind') or ''

supports = []
for s in load(r'Gameplay\supports.json')['supports']:
    mods = []
    for m in s.get('Mods') or []:
        r = raw(m)
        if r:
            mods.append(r)
    supports.append({
        'id': s['Id'], 'n': bi('sup:' + s['Id'], s['Name']),
        'attr': s.get('Attribute'), 'lvl': s.get('Level'),
        'req': [t for t in (s.get('RequiresAnyTag') or []) if isinstance(t, str)],
        'excl': [t for t in (s.get('ExcludeTags') or []) if isinstance(t, str)],
        'mods': mods,
        'mana': s.get('ManaMultiplier'),
        'drop': s.get('DropWeight'),
        'desc': bi('supdesc:' + s['Id'], s.get('Description') or ''),
    })

blessings = []
for b in load(r'Gameplay\blessings.json')['blessings']:
    mods = []
    for m in b.get('Mods') or []:
        r = raw(m)
        if r:
            if m.get('PerLevel'):
                r['pl'] = m.get('PerLevel')
            mods.append(r)
    vb = b.get('Vowbreak') or {}
    blessings.append({
        'id': b['Id'], 'n': bi('bl:' + b['Id'], b['Name']),
        'kind': b.get('Kind'),
        'kindZh': {'Vow': '誓约', 'Herald': '先驱', 'Woe': '灾祸', 'Mark': '印记'}.get(b.get('Kind'), b.get('Kind')),
        'skill': b.get('Skill'),
        'resFlat': b.get('ReserveFlat'), 'resFlatPer': b.get('ReserveFlatPerLevel'),
        'resPct': b.get('ReservePct'),
        'mods': mods,
        'text': bi('bl:' + b['Id'] + ':text', b.get('Text') or ''),
        'vb': {'sec': vb.get('Seconds'), 'mult': vb.get('Mult'), 'heal': vb.get('HealPct')},
    })

curses = []
for c in load(r'Gameplay\curses.json')['curses']:
    curses.append({
        'id': c['Id'], 'n': bi('cu:' + c['Id'], c['Name']),
        'kind': c.get('Kind'),
        'kindZh': {'Woe': '灾祸', 'Sentence': '判决', 'Ailment': '异常状态', 'Mark': '印记',
                   'Banner': '战旗'}.get(c.get('Kind'), c.get('Kind')),
        'dur': c.get('Duration'),
        'taken': c.get('TakenPct'), 'elem': c.get('ElementTakenPct') or {},
        'slow': c.get('Slow'), 'rdown': c.get('ResistDown') or {},
        'dealt': c.get('DealtLessPct'),
        'text': bi('cu:' + c['Id'] + ':text', c.get('Text') or ''),
        'dread': c.get('Dread'),
    })

# ---------------------------------------------------------------- stat text tables
texts_en = {}
for t in load(r'Items\stat_text.json')['texts']:
    texts_en[t['Key']] = [t.get('Text') or '', t.get('Negative') or '']
from stat_zh import TEXT_ZH  # noqa: E402
texts_zh = {k: [v[0], v[1]] for k, v in TEXT_ZH.items()}

tags_zh = {t: z for t, z in TAGS.items()}
slots_zh = {s: z for s, z in SLOTS.items()}
item_classes_zh = {s: z for s, z in ITEM_CLASSES.items()}

core = {
    'meta': {'ver': VERSION, 'game': 'r92', 'built': 'planner-2'},
    'consts': consts,
    'classes': classes,
    'skills': skills,
    'supports': supports,
    'blessings': blessings,
    'curses': curses,
    'weaponSkills': weapon_skills,
    'minions': minion_stats,
    'animRate': anim_rate,
    'texts': texts_en,
    'textsZh': texts_zh,
    'tags': tags_zh,
    'slots': slots_zh,
    'itemClasses': item_classes_zh,
    'treeKinds': TREE_KIND,
    'delivery': DELIVERY,
    'skillKind': SKILL_KIND,
    'affixType': AFFIX_TYPE,
    'rarity': RARITY,
    'potionRole': POTION_ROLE,
    'ref': ref_monster,
}

# ---------------------------------------------------------------- items
bases_raw = load(r'Items\item_bases.json')['bases']
base_by_id = {b['Id']: b for b in bases_raw}


def max_sockets(b):
    slot = b.get('Slot')
    cls = b.get('Class')
    twoh = bool(b.get('bTwoHanded'))
    ms = consts['maxSockets']
    if slot == 'MainHand':
        return ms.get('TwoHand' if twoh else 'OneHand', 3)
    if slot == 'OffHand':
        if cls == 'Shield':
            return ms.get('Shield', 3)
        if cls == 'Tome':
            return ms.get('Tome', 3)
        return 0
    if slot in ('Chest',):
        return ms.get('Chest', 4)
    if slot in ('Helm',):
        return ms.get('Helm', 3)
    return 0


bases = []
for b in bases_raw:
    rec = {
        'id': b['Id'], 'n': bi('base:' + b['Id'], b['Name']),
        'slot': b['Slot'], 'slotZh': SLOTS.get(b['Slot'], b['Slot']),
        'cls': b.get('Class') or '', 'clsZh': ITEM_CLASSES.get(b.get('Class') or '', b.get('Class') or ''),
        'type': b.get('TypeName') or ITEM_CLASSES.get(b.get('Class') or '', b.get('Class') or ''),
        'lvl': b.get('Level') or 0,
        'twoh': 1 if b.get('bTwoHanded') else 0,
        'dmg': [b['DamageMin'], b['DamageMax']] if b.get('DamageMin') is not None else None,
        'aps': b.get('AttacksPerSecond'), 'crit': b.get('Crit'),
        'ar': b.get('Armour') or 0, 'ev': b.get('Evasion') or 0, 'es': b.get('EnergyShield') or 0,
        'block': b.get('Block') or 0,
        'req': [b.get('ReqStr') or 0, b.get('ReqDex') or 0, b.get('ReqInt') or 0],
        'imp': raws(b.get('Implicits') or []),
        'tags': [t for t in (b.get('Tags') or []) if isinstance(t, str)],
        'sock': max_sockets(b),
        'wpn': b.get('Weapon') or '',
        'wk': weapon_kind.get(b.get('Weapon') or '', ''),
        'w': b.get('Width') or 1, 'h': b.get('Height') or 1,
        'nw': 1 if b.get('Jewel') else 0,
    }
    bases.append(rec)

affixes = []
for a in load(r'Items\affixes.json')['affixes']:
    mod = a.get('Mod') or {}
    tiers = []
    for t in a.get('Tiers') or []:
        tiers.append({'i': t.get('ILvl'), 'lo': t.get('Min'), 'hi': t.get('Max'),
                      'lo2': t.get('Min2'), 'hi2': t.get('Max2'),
                      'w': t.get('Weight'), 'n': t.get('Name') or ''})
    tiers.sort(key=lambda x: -(x['i'] or 0))
    affixes.append({
        'id': a['Id'], 'type': a.get('Type'), 'grp': a.get('Group'),
        'grpZh': B.zh_of('ag:' + (a.get('Group') or ''), a.get('Group') or ''),
        'w': a.get('Weight'),
        'on': [t for t in (a.get('BaseTags') or []) if isinstance(t, str)],
        'not': [t for t in (a.get('ExcludeTags') or []) if isinstance(t, str)],
        's': mod.get('Stat'), 'm': mod.get('Mode'),
        't': [t for t in (mod.get('Tags') or []) if isinstance(t, str)],
        'l': 1 if mod.get('bLocal') else 0,
        'v2': mod.get('Value2'),
        'tiers': tiers,
        'maxi': max([x['i'] or 0 for x in tiers] or [1]),
        'mini': min([x['i'] or 1 for x in tiers] or [1]),
    })

uniques = []
for u in load(r'Items\uniques.json')['uniques']:
    base = base_by_id.get(u['BaseId'], {})
    mods = []
    for m in u.get('Mods') or []:
        mm = m.get('Mod') or {}
        lo, hi = m.get('Min'), m.get('Max')
        lo2, hi2 = m.get('Min2'), m.get('Max2')
        if not isinstance(lo, (int, float)):
            lo = mm.get('Value') or 0
        if not isinstance(hi, (int, float)):
            hi = lo
        # 传奇词条以区间给出；构筑代码不携带 roll，这里取区间中点（与游戏内指南代码的默认口径一致）。
        mid = (lo + hi) / 2.0
        r = raw(mm, mid)
        if not r:
            continue
        r['v'] = round(mid, 3)
        r['lo'] = lo
        r['hi'] = hi
        if isinstance(lo2, (int, float)) or isinstance(hi2, (int, float)):
            a = lo2 if isinstance(lo2, (int, float)) else lo
            b = hi2 if isinstance(hi2, (int, float)) else hi
            r['lo2'] = a
            r['hi2'] = b
            r['v2'] = round((a + b) / 2.0, 3)
        if m.get('Text'):
            r['x'] = m['Text']
        mods.append(r)
    forged = u.get('Forged') or []
    uniques.append({
        'id': u['Id'], 'n': bi('unique:' + u['Id'], u['Name']),
        'base': u['BaseId'],
        'lvl': u.get('Level') or 0,
        'slot': base.get('Slot') or '', 'cls': base.get('Class') or '',
        'mods': mods, 'forged': forged,
        'flav': bi('flav:unique:' + u['Id'], u.get('Flavour') or ''),
        'sock': u.get('DwarvenSockets'),
        'jewel': 1 if u.get('Jewel') else 0,
    })
uni_by_id = {u['id']: u for u in uniques}

runes_raw = load(r'Items\runes.json')
runes = []
for cat, arr in (('rune', runes_raw['runes']), ('jewel', runes_raw['jewels'])):
    for r in arr:
        runes.append({
            'id': r['Id'], 'cat': cat, 'n': bi(cat + ':' + r['Id'], r['Name']),
            'tier': r.get('Tier'), 'lvl': r.get('Level'),
            'w': raws(r.get('Weapon') or []), 'a': raws(r.get('Armour') or []),
            'col': '#%02x%02x%02x' % (int((r.get('Color') or {}).get('R') * 255 or 0),
                                       int((r.get('Color') or {}).get('G') * 255 or 0),
                                       int((r.get('Color') or {}).get('B') * 255 or 0)),
        })
rune_by_id = {r['id']: r for r in runes}

runewords = []
for w in load(r'Items\runewords.json')['runewords']:
    mods = []
    for m in w.get('Mods') or []:
        r = raw(m.get('Mod') or {})
        if r:
            if m.get('Text'):
                r['x'] = m['Text']
            mods.append(r)
    runewords.append({
        'id': w['Id'], 'n': bi('rw:' + w['Id'], w['Name']),
        'cls': w.get('Class') or '',
        'runes': w.get('Runes') or [],
        'bases': [t for t in (w.get('Bases') or []) if isinstance(t, str)],
        'lvl': w.get('Level'), 'sockets': w.get('Sockets'),
        'mods': mods,
    })

# mythic lines are extra rare affixes (Mythic85) - include them so rare items can carry one
mythic = []
for m in load(r'Items\mythic_lines.json')['lines']:
    tiers = []
    for t in m.get('Tiers') or []:
        tiers.append({'i': t.get('ILvl'), 'lo': t.get('Min'), 'hi': t.get('Max'),
                      'lo2': t.get('Min2'), 'hi2': t.get('Max2'),
                      'w': t.get('Weight'), 'n': t.get('Name') or ''})
    tiers.sort(key=lambda x: -(x['i'] or 0))
    mod = m.get('Mod') or {}
    mythic.append({
        'id': m['Id'], 'type': m.get('Type'), 'grp': m.get('Group'),
        'w': m.get('Weight'),
        'on': [t for t in (m.get('BaseTags') or []) if isinstance(t, str)],
        'not': [t for t in (m.get('ExcludeTags') or []) if isinstance(t, str)],
        's': mod.get('Stat'), 'm': mod.get('Mode'),
        't': [t for t in (mod.get('Tags') or []) if isinstance(t, str)],
        'l': 1 if mod.get('bLocal') else 0,
        'tiers': tiers,
        'maxi': max([x['i'] or 0 for x in tiers] or [1]),
        'mini': min([x['i'] or 1 for x in tiers] or [1]),
    })

items_payload = {
    'bases': bases,
    'affixes': affixes,
    'uniques': uniques,
    'runes': runes,
    'runewords': runewords,
    'mythic': mythic,
}

# ---------------------------------------------------------------- passive tree
pt = load(r'Gameplay\passive_tree.json')
tnodes = []
for n in pt['nodes']:
    rec = {
        'i': n['Id'],
        'n': bi('tn2:' + n['Id'], n['Name']),
        'k': n['Kind'],
        'x': n['X'], 'y': n['Y'],
        'l': [x for x in (n.get('Links') or []) if isinstance(x, str)],
        'm': raws(n.get('Mods') or []),
        'r': n.get('Region') or '',
        'g': n.get('Group') or '',
        'cs': n.get('ClassStart') or '',
        'ch': n.get('Choice') or '',
        'so': n.get('Socket') or '',
        'pr': n.get('Price') or '',
        'tx': n.get('Text') or '',
    }
    tnodes.append(rec)
node_ids = {n['i'] for n in tnodes}
for n in tnodes:
    n['l'] = [x for x in n['l'] if x in node_ids]

# dragonling
dl = (load(r'Gameplay\dragonling.json') or {})
dt = dl.get('Tree') or {}
dragon_nodes = {}
for cls, arr in (dt.get('Classes') or {}).items():
    out = []
    for n in arr:
        asc = n.get('Ascend') or {}
        pos = n.get('Pos76') or {}
        mods = raws(asc.get('Mods') or pos.get('Mods') or n.get('Mods') or [])
        out.append({
            'i': n['Id'],
            'n': bi('dn:' + n['Id'], asc.get('Name') or n.get('Name') or ''),
            'k': n.get('Kind') or 'Small',
            'p': n.get('Path') or '',
            'x': n.get('X') or 0, 'y': n.get('Y') or 0,
            'l': [x for x in (n.get('Links') or []) if isinstance(x, str)],
            'm': mods,
            'tx': asc.get('Text') or pos.get('Text') or n.get('Text') or '',
            'ao': 1 if n.get('AscendOnly') else 0,
        })
    ids = {x['i'] for x in out}
    for x in out:
        x['l'] = [y for y in x['l'] if y in ids]
    dragon_nodes[cls] = out

dragon_aspects = []
for a in dl.get('Aspects') or []:
    dragon_aspects.append({
        'id': a.get('Id'), 'n': [{'Arcane': '奥术'}.get(a.get('Id'), a.get('Name')), a.get('Name')],
        'mods': raws(a.get('Mods') or []),
        'text': a.get('Text') or '',
    })

tree_payload = {
    'nodes': tnodes,
    'classes': [[CLASSES.get(c, c), c] for c in
                ['Warrior', 'Mage', 'Ranger', 'Samurai', 'Paladin', 'Necromancer']],
    'suggested': pt.get('Suggested') or {},
    'layout': pt.get('Layout') or {},
    'version': pt.get('Version'),
    'dragon': {
        'milestones': dt.get('MilestoneLevels') or [],
        'perGate': dt.get('PointsPerGateKill'),
        'maxKeystones': dt.get('MaxKeystones', 1),
        'crownKinds': dt.get('CrownKinds') or [],
        'minGate': dt.get('MinGateBand'),
        'pinnacle': dt.get('PinnaclePoint'),
        'classes': dragon_nodes,
        'aspects': dragon_aspects,
        'classAspect': dl.get('ClassAspect') or {},
    },
    'kinds': TREE_KIND,
}

print('bases %d affixes %d uniques %d runes %d runewords %d mythic %d' % (
    len(bases), len(affixes), len(uniques), len(runes), len(runewords), len(mythic)))
print('skills %d supports %d blessings %d curses %d' % (
    len(skills), len(supports), len(blessings), len(curses)))
print('tree nodes %d dragon classes %d' % (len(tnodes), len(dragon_nodes)))

write('planner_core', 'BO_PCORE', core)
write('planner_items', 'BO_PITEMS', items_payload)
write('planner_tree', 'BO_PTREE', tree_payload)
print('done')
