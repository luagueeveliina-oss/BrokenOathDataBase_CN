# -*- coding: utf-8 -*-
"""Download item/skill icons listed in tools/icons.json into site/assets/icons/.

Sources are the .webp files served by the fan database the icon map was taken from.
Existing files are skipped, so this is safe to re-run.

Usage:  python tools\fetch_icons.py
"""
import json, io, os, sys, ssl, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site', 'assets', 'icons')
MAP = json.load(io.open(os.path.join(ROOT, 'tools', 'icons.json'), encoding='utf-8'))
BASE = 'https://broked-db.vercel.app/ic/'

FOLDERS = {
    'base': 'bases',
    'uniq': 'uniques',
    'rune': 'runes',
    'jewel': 'jewels',
    'skill': 'skills',
    'sup': 'supports',
}
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def safe(name):
    return name.replace('/', '_').replace('\\', '_')


def fetch(job):
    kind, key, path = job
    dest = os.path.join(OUT, FOLDERS[kind], safe(key) + '.webp')
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return 'skip'
    url = BASE + path
    err = ''
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
                blob = r.read()
            if not blob:
                raise ValueError('empty')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(blob)
            return 'ok'
        except Exception as e:  # noqa: BLE001
            err = f'{type(e).__name__}: {e}'
    return 'fail ' + kind + ' ' + key + ' ' + err


def main():
    jobs = []
    for kind, folder in FOLDERS.items():
        for key, path in (MAP.get(kind) or {}).items():
            jobs.append((kind, key, path))
    print('jobs:', len(jobs))
    counts = {}
    fails = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        for res in pool.map(fetch, jobs):
            tag = res.split(' ')[0]
            counts[tag] = counts.get(tag, 0) + 1
            if tag == 'fail':
                fails.append(res)
    print('result:', counts)
    for f in fails[:20]:
        print(' ', f)
    total = sum(len((MAP.get(k) or {})) for k in FOLDERS)
    print('mapped:', total, 'downloaded dirs:', OUT)


if __name__ == '__main__':
    main()
