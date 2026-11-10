# -*- coding: utf-8 -*-
"""Render game stat mods into Chinese + English text."""
import json, re, os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stat_zh import TEXT_ZH
from terms_zh import TAGS

DATA = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'

ELEMENTS = ['Physical', 'Fire', 'Cold', 'Lightning', 'Poison', 'Holy', 'Elemental', 'Chaos']
VECTORS = ['Melee', 'Projectile', 'Attack', 'Spell', 'Minion', 'TwoHand', 'OneHand',
           'DualWielding', 'Unarmed', 'Martial', 'Shield', 'Bow', 'Ranged', 'Weapon']


def load_texts():
    j = json.load(open(os.path.join(DATA, r'Items\stat_text.json'), encoding='utf-8'))
    texts = {}
    for t in j['texts']:
        texts[t['Key']] = {'Text': t.get('Text') or '', 'Negative': t.get('Negative') or ''}
    return texts


TEXTS = load_texts()


def is_param_tag(t):
    return ('=' in t) or t.lower() == t


def fmt(v):
    if v is None:
        return ''
    if isinstance(v, bool):
        return ''
    if isinstance(v, float):
        if abs(v - round(v)) < 1e-9:
            return str(int(round(v)))
        return ('%.2f' % v).rstrip('0').rstrip('.')
    return str(v)


def display_tags(tags):
    out = []
    for t in tags or []:
        if is_param_tag(t):
            continue
        if t in TAGS:
            out.append(t)
    return out


def pair(lo, hi):
    """value rendering: single value or (lo-hi) range"""
    if lo is None:
        return ''
    if hi is None or lo == hi:
        return fmt(lo)
    return '(%s-%s)' % (fmt(lo), fmt(hi))


def abs_pair(lo, hi):
    if lo is None:
        return ''
    if hi is None or lo == hi:
        return fmt(abs(lo))
    a, b = abs(lo), abs(hi)
    if a > b:
        a, b = b, a
    if a == b:
        return fmt(a)
    return '(%s-%s)' % (fmt(a), fmt(b))


def pluralize(tpl, n):
    def rep(m):
        one, other = m.group(1), m.group(2)
        return other if (n is None or n != 1) else one
    return re.sub(r'\{n\}\|plural\(one=([^,)]*),\s*other=([^)]*)\)', rep, tpl)


def fill(tpl, vals):
    s = re.sub(r'\{(\w+)\}', lambda m: str(vals.get(m.group(1), '')), tpl)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    s = re.sub(r'\s+([,.;:）)])', r'\1', s)
    s = re.sub(r'（\s+', '（', s)
    return s.strip()


def pick_key(stat, mode, tags):
    tags = display_tags(tags)
    cands = []
    for t in tags:
        cands.append('%s.%s+%s' % (stat, mode, t))
    if tags:
        cands.append('%s.%s+' % (stat, mode))
    cands.append('%s.%s' % (stat, mode))
    for c in cands:
        if c in TEXTS and (TEXTS[c]['Text'] or TEXTS[c]['Negative']):
            return c, tags
    return None, tags


def render(stat, mode, tags, lo, hi=None, value2=None):
    """Return (key, en_text, zh_text) or None."""
    key, tags = pick_key(stat, mode, tags)
    if key is None:
        return None
    tpl_en = TEXTS[key]['Text']
    tpl_en_neg = TEXTS[key]['Negative']
    zh = TEXT_ZH.get(key)
    tpl_zh, tpl_zh_neg = (zh if zh else (None, None))
    neg = (hi if hi is not None else lo) is not None and (hi if hi is not None else lo) < 0
    consumed = key.split('+')[1] if '+' in key else None

    rest = [t for t in tags if t != consumed]
    elem = [t for t in rest if t in ELEMENTS]
    skills = [t for t in rest if t not in ELEMENTS]

    joiner_zh = '、'
    joiner_en = ' and '
    two_vals = '{v2}' in tpl_en
    v_main = fmt(lo) if two_vals else pair(lo, hi)
    vals = {
        'v': v_main,
        'v2': fmt(hi if hi is not None and two_vals else (value2 if value2 is not None else hi)),
        'abs': abs_pair(lo, hi),
        'tags': joiner_zh.join(TAGS.get(t, t) for t in elem),
        'tag0': TAGS.get(elem[0], elem[0]) if elem else '',
        'tag1': TAGS.get(elem[1], elem[1]) if len(elem) > 1 else '',
        'skills': joiner_zh.join(TAGS.get(t, t) for t in skills),
    }
    vals_en = {
        'v': v_main,
        'v2': fmt(hi if hi is not None and two_vals else (value2 if value2 is not None else hi)),
        'abs': abs_pair(lo, hi),
        'tags': joiner_en.join(elem),
        'tag0': elem[0] if elem else '',
        'tag1': elem[1] if len(elem) > 1 else '',
        'skills': (' and '.join(skills) + ' Skills') if skills else '',
    }
    n = lo if hi is None else hi
    en_t = tpl_en_neg if (neg and tpl_en_neg) else tpl_en
    en = fill(pluralize(en_t, n), vals_en)
    if tpl_zh and tpl_zh.strip():
        zh_t = tpl_zh_neg if (neg and tpl_zh_neg) else tpl_zh
        zh_s = fill(pluralize(zh_t, n), vals)
    else:
        zh_s = en
    return key, en, zh_s


def render_mod(mod, lo=None, hi=None, text_zh=None, text_en=None):
    """mod: dict with Stat/Mode/Tags/Value/Value2. lo/hi override (roll ranges)."""
    if not isinstance(mod, dict):
        return None
    stat = mod.get('Stat')
    mode = mod.get('Mode')
    tags = mod.get('Tags') or []
    if lo is None:
        lo = mod.get('Value')
    if hi is None:
        hi = mod.get('Value2') if mod.get('Value2') not in (None, 0) else lo
    if stat in ('Keystone', 'Trigger', 'GrantSupport'):
        if text_en:
            return (text_zh or text_en, text_en)
        return None
    if (lo in (0, None)) and (hi in (0, None)) and not text_en:
        return None
    r = render(stat, mode, tags, lo, hi, mod.get('Value2'))
    if r is None:
        if text_en:
            return (text_zh or text_en, text_en)
        return None
    key, en, zh = r
    if not en and not zh:
        return None
    return (zh, en)


def render_lines(mods, texts=None, zh_texts=None):
    out = []
    for i, m in enumerate(mods or []):
        te = (texts or [None] * 999)[i] if texts else None
        tz = (zh_texts or [None] * 999)[i] if zh_texts else None
        r = render_mod(m, text_en=te, text_zh=tz)
        if r:
            out.append([r[0], r[1]])
    return out


if __name__ == '__main__':
    # quick self-check on a few known records
    samples = [
        dict(Stat='Life', Mode='Flat', Value=45),
        dict(Stat='Damage', Mode='Inc', Tags=['Lightning'], Value=20),
        dict(Stat='Area', Mode='Inc', Tags=['Slam'], Value=20),
        dict(Stat='Projectiles', Mode='Flat', Tags=['Projectile', 'Bow'], Value=2),
        dict(Stat='Resist', Mode='Flat', Tags=['Fire'], Value=25),
        dict(Stat='AddedDamage', Mode='Flat', Tags=['Fire'], Value=29, Value2=53),
        dict(Stat='Chains', Mode='Flat', Tags=['Chain'], Value=2),
        dict(Stat='CritChance', Mode='Inc', Tags=[], Value=-20),
        dict(Stat='Damage', Mode='Inc', Tags=['Physical'], Value=0),
    ]
    for s in samples:
        print(s, '->', render_mod(s))
