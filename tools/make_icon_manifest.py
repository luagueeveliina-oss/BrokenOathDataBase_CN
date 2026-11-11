# -*- coding: utf-8 -*-
r"""Scan site/assets/icons/<kind>/ and write the icon manifest used by the site.

Real item icons can be dropped in as <kind>/<id>.png|.webp; the site then shows
the image instead of the built-in vector glyph. Folders map to id prefixes:

    uniques/  -> u:      bases/   -> b:
    runes/    -> r:      jewels/  -> j:
    skills/   -> sk:     supports/-> sp:

Usage:  python tools\make_icon_manifest.py
"""
import os, json, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, 'site', 'assets', 'icons')
OUT = os.path.join(ICONS, 'manifest.js')

FOLDERS = {
    'uniques': 'u',
    'bases': 'b',
    'runes': 'r',
    'jewels': 'j',
    'skills': 'sk',
    'supports': 'sp',
}
EXTS = ('.png', '.webp', '.jpg', '.jpeg')


def main():
    entries = {}
    for folder, prefix in FOLDERS.items():
        d = os.path.join(ICONS, folder)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            stem, ext = os.path.splitext(f)
            if ext.lower() not in EXTS:
                continue
            rel = f'assets/icons/{folder}/{f}'
            entries[f'{prefix}:{stem}'] = rel
    body = json.dumps(entries, ensure_ascii=False, indent=0, sort_keys=True)
    js = (
        '/* 由 tools/make_icon_manifest.py 生成：assets/icons/<kind>/<id>.* -> 站内图标 */\n'
        f'window.BO_ICONS = {body};\n'
    )
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f'icons: {len(entries)} -> {OUT}')


if __name__ == '__main__':
    main()
