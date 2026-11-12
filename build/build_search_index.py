# -*- coding: utf-8 -*-
"""Build site/assets/data/search.js from the existing content data files.

The global search in the top bar loads this compact index lazily, so pages do
not need to pull the full 900 KB item database just to answer a query.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "site", "assets", "data")
OUT = os.path.join(DATA, "search.js")


def load(name, var):
    path = os.path.join(DATA, name)
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    text = text.strip()
    m = re.match(r"(?:window\.)?%s\s*=\s*([\s\S]*?);?\s*$" % re.escape(var), text)
    if not m:
        raise SystemExit("cannot parse %s (%s)" % (name, var))
    return json.loads(m.group(1))


def pair(p, i=0):
    if isinstance(p, str):
        return p
    if isinstance(p, list):
        return p[i] if i < len(p) and p[i] else ""
    return ""


def entry(kind, rid, zh, en, sub="", url="", icon="", color="", group=""):
    return {
        "t": kind,
        "i": rid,
        "z": zh,
        "e": en,
        "s": sub,
        "u": url,
        "k": icon,
        "c": color,
        "g": group,
    }


def main():
    items = load("items.js", "BO_ITEMS")
    skills = load("skills.js", "BO_SKILLS")
    mobs = load("bestiary.js", "BO_MOBS")

    rows = []
    bases = {b.get("id"): b for b in items.get("bases", [])}

    for u in items.get("uniques", []):
        base = pair(u.get("base", ""))
        rows.append(entry("unique", u.get("id"), pair(u.get("n")), pair(u.get("n"), 1),
                          " · ".join(x for x in [base, pair(u.get("clsZh", ""))] if x),
                          "items.html#uniques/%s" % u.get("id"), "u:" + str(u.get("id")),
                          "#af6025", "传奇"))

    for b in items.get("bases", []):
        slot = pair(b.get("slotZh", "")) or str(b.get("slot") or "")
        rows.append(entry("base", b.get("id"), pair(b.get("n")), pair(b.get("n"), 1),
                          " · ".join(x for x in [slot, pair(b.get("clsZh", ""))] if x),
                          "items.html#bases/%s" % b.get("id"), "b:" + str(b.get("id")),
                          "#c8c8c8", "底材"))

    for r in items.get("runes", []):
        rows.append(entry("rune", r.get("id"), pair(r.get("n")), pair(r.get("n"), 1),
                          "符文 · 阶级 %s" % r.get("tier"),
                          "items.html#runes/%s" % r.get("id"), "r:" + str(r.get("id")),
                          r.get("color") or "#aa9e82", "符文"))

    for r in items.get("jewels", []):
        rows.append(entry("jewel", r.get("id"), pair(r.get("n")), pair(r.get("n"), 1),
                          "珠宝 · 阶级 %s" % r.get("tier"),
                          "items.html#jewels/%s" % r.get("id"), "j:" + str(r.get("id")),
                          r.get("color") or "#aa9e82", "珠宝"))

    for w in items.get("runewords", []):
        rows.append(entry("rw", w.get("id"), pair(w.get("n")), pair(w.get("n"), 1),
                          " · ".join(x for x in ["符文之语", pair(w.get("clsZh", ""))] if x),
                          "items.html#runewords/%s" % w.get("id"), "", "#d4913f", "符文之语"))

    potions = items.get("potions") or {}
    for p in potions.get("types", []):
        rows.append(entry("potion", p.get("id"), pair(p.get("n")), pair(p.get("n"), 1),
                          "药剂 · " + pair(p.get("roleZh", "")),
                          "items.html#potions/%s" % p.get("id"), "", "#9ecb8a", "药剂"))
    for p in potions.get("uniques", []):
        rows.append(entry("potion", p.get("id"), pair(p.get("n")), pair(p.get("n"), 1),
                          "传奇药剂", "items.html#potuniques/%s" % p.get("id"), "", "#af6025", "药剂"))

    for a in items.get("affixes", []):
        rows.append(entry("affix", a.get("id"), pair(a.get("top")), pair(a.get("top"), 1),
                          " · ".join(x for x in [pair(a.get("typeZh", "")), a.get("groupZh") or ""] if x),
                          "items.html#affixes/%s" % a.get("id"), "", "#8888ff", "词缀"))

    for s in skills.get("skills", []):
        rows.append(entry("skill", s.get("id"), pair(s.get("n")), pair(s.get("n"), 1),
                          " · ".join(x for x in [pair(s.get("clsZh", "")), pair(s.get("kindZh", ""))] if x),
                          "skills.html#skills/%s" % s.get("id"), "sk:" + str(s.get("id")),
                          "#1ba29b", "技能"))

    for s in skills.get("supports", []):
        rows.append(entry("support", s.get("id"), pair(s.get("n")), pair(s.get("n"), 1),
                          "辅助宝石 · " + pair(s.get("attrZh", "")),
                          "skills.html#supports/%s" % s.get("id"), "sp:" + str(s.get("id")),
                          "#8fb0e8", "辅助"))

    for s in skills.get("blessings", []):
        rows.append(entry("blessing", s.get("id"), pair(s.get("n")), pair(s.get("n"), 1),
                          pair(s.get("kindZh", "")) or "誓约",
                          "skills.html#blessings/%s" % s.get("id"), "sk:" + str(s.get("skill") or s.get("id")),
                          "#e7b478", "誓约"))

    for s in skills.get("curses", []):
        rows.append(entry("curse", s.get("id"), pair(s.get("n")), pair(s.get("n"), 1),
                          "诅咒 / 判决",
                          "skills.html#curses/%s" % s.get("id"), "", "#b54bff", "诅咒"))

    for m in mobs.get("monsters", []):
        if str(m.get("id", "")).startswith("g_"):
            continue
        rows.append(entry("monster", m.get("id"), pair(m.get("n")), pair(m.get("n"), 1),
                          "怪物 · 生命 %s" % m.get("life", "—"),
                          "bestiary.html#mobs/%s" % m.get("id"), "", "#9aa0a6", "图鉴"))

    for m in mobs.get("guardians", []):
        rows.append(entry("guardian", m.get("id"), pair(m.get("n")), pair(m.get("n"), 1),
                          "守护者", "bestiary.html#bosses/%s" % m.get("id"), "", "#d9a441", "图鉴"))

    rows.sort(key=lambda r: (r["g"], r["z"] or r["e"] or r["i"]))
    data = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    js = "/* generated by build/build_search_index.py - do not edit */\nwindow.BO_SEARCH=%s;\n" % data
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    print("wrote", OUT, len(rows), "entries", len(js.encode("utf-8")), "bytes")


if __name__ == "__main__":
    sys.exit(main())
