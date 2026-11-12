# -*- coding: utf-8 -*-
"""Mirror the Broken Oath public API into the site.

The public API asks sites to cache on their side and serve readers from that
copy instead of fetching once per visitor, so this script is the only place
that talks to https://api.playbrokenoath.com/.  It writes:

    site/assets/api/**            raw JSON snapshots used by the site
    site/assets/api/manifest.json what was synced, and when
    site/assets/data/api_seed.js  a small synchronous seed for file:// use

A scheduled GitHub Action runs it right before deploying the site, so the
published copy is at most one refresh interval old without committing megabytes
of ladder data every fifteen minutes.

Usage:
    python tools/sync_api.py                 # normal sync
    python tools/sync_api.py --quick         # current league only
    python tools/sync_api.py --force         # ignore "nothing changed"
    python tools/sync_api.py --depth 5       # seed fewer full builds
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import os
import re
import ssl
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
API_DIR = os.path.join(SITE, "assets", "api")
SEED = os.path.join(SITE, "assets", "data", "api_seed.js")
BASE = "https://api.playbrokenoath.com/v1/"
UA = "BrokenOathDB/2.0 (+https://github.com/; static fan database)"

CTX = ssl.create_default_context()
CTX_UNVERIFIED = ssl.create_default_context()
CTX_UNVERIFIED.check_hostname = False
CTX_UNVERIFIED.verify_mode = ssl.CERT_NONE


def log(*a):
    print(*a, flush=True)


def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch(path, etag=None, tries=5):
    """GET an API path, returning (status, bytes, headers)."""
    url = BASE + path.lstrip("/")
    last = None
    for i in range(tries):
        for ctx in (CTX, CTX_UNVERIFIED):
            try:
                headers = {"User-Agent": UA, "Accept": "application/json", "Accept-Encoding": "gzip"}
                if etag:
                    headers["If-None-Match"] = etag
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=45, context=ctx) as r:
                    raw = r.read()
                    enc = (r.headers.get("Content-Encoding") or "").lower()
                    if "gzip" in enc:
                        raw = gzip.decompress(raw)
                    return r.status, raw, dict(r.headers)
            except urllib.error.HTTPError as e:
                if e.code == 304:
                    return 304, b"", dict(e.headers or {})
                last = e
                break
            except Exception as e:  # flaky TLS on some networks
                last = e
        time.sleep(1.2 * (i + 1))
    raise RuntimeError("GET %s failed: %r" % (url, last))


def atomic_write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def read_json(path, default=None):
    try:
        with open(path, "rb") as f:
            return json.load(f)
    except Exception:
        return default


def dump_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def parse_time(value):
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def league_label(item):
    bits = []
    bits.append("HC" if item.get("hardcore") else "SC")
    bits.append("交易" if item.get("trade") else "SSF")
    return " · ".join(bits)


def select_current(leagues, when=None):
    when = when or dt.datetime.now(dt.timezone.utc)
    rows = leagues.get("leagues") or []
    live = []
    for row in rows:
        starts = parse_time(row.get("starts_at"))
        ends = parse_time(row.get("ends_at"))
        if starts and ends and starts <= when <= ends:
            live.append((starts, row))
    if live:
        live.sort(key=lambda p: (not p[1].get("trade"), bool(p[1].get("hardcore")), -p[0].timestamp()))
        return live[0][1]["id"]
    # fall back to the most recently started league
    rows = [r for r in rows if parse_time(r.get("starts_at"))]
    rows.sort(key=lambda r: parse_time(r["starts_at"]), reverse=True)
    return rows[0]["id"] if rows else None


def safe_rel(path):
    return path.replace("\\", "/")


class Sync:
    def __init__(self, args):
        self.args = args
        self.manifest_path = os.path.join(API_DIR, "manifest.json")
        self.manifest = read_json(self.manifest_path, {}) or {}
        self.old_files = self.manifest.get("files") or {}
        self.files = {}
        self.seed = {}
        self.requests = 0
        self.version = None
        self.leagues = None

    # -- fetching ---------------------------------------------------------
    def get_json(self, path, use_cache=True):
        old = self.old_files.get(path) or {}
        etag = old.get("etag") if use_cache else None
        dest = os.path.join(API_DIR, path)
        if etag and os.path.exists(dest):
            status, data, headers = fetch(path, etag)
            self.requests += 1
            if status == 304:
                with open(dest, "rb") as f:
                    raw = f.read()
                info = dict(old)
                info["bytes"] = len(raw)
                self.files[path] = info
                return json.loads(raw)
        else:
            status, data, headers = fetch(path)
            self.requests += 1
            atomic_write(dest, data)
        obj = json.loads(data)
        info = {
            "bytes": len(data),
            "etag": headers.get("ETag") or headers.get("etag"),
            "generated_at": obj.get("generated_at") if isinstance(obj, dict) else None,
        }
        self.files[path] = info
        return obj

    def want(self, path):
        return self.args.force or path not in self.files

    # -- sync -------------------------------------------------------------
    def run(self):
        log("API sync starting; output:", API_DIR)
        version = self.get_json("version.json", use_cache=False)
        self.version = version
        leagues = self.get_json("leagues.json", use_cache=False)
        self.leagues = leagues
        try:
            self.get_json("game-data/index.json")
        except Exception as e:
            log("  game-data index failed", e)
        current = select_current(leagues)
        log("patch", version.get("patch"), "build", version.get("game_build"),
            "leagues", len(leagues.get("leagues") or []), "current", current)

        ids = version.get("leagues") or []
        if self.args.quick and current in ids:
            ids = [current]
        ladder_paths = ["ladder/%s.json" % lid for lid in ids]
        ladder_cache = {}

        def get_ladder(p):
            dest = os.path.join(API_DIR, p)
            if not self.args.force and os.path.exists(dest):
                cached = read_json(dest)
                if cached and cached.get("generated_at") == version.get("ladder_updated_at"):
                    self.files[p] = self.old_files.get(p) or {"bytes": os.path.getsize(dest)}
                    return p, cached
            return p, self.get_json(p)

        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = [pool.submit(get_ladder, p) for p in ladder_paths]
            for fut in as_completed(futures):
                try:
                    p, data = fut.result()
                    ladder_cache[p] = data
                except Exception as e:
                    log("  ladder failed", e)
        log("ladders:", len(ladder_cache), "/", len(ladder_paths))

        # Build lists and meta only change hourly; skip the whole group when
        # builds_updated_at is unchanged and every expected file is present.
        build_groups = {}
        for p, ladder in ladder_cache.items():
            league = ladder.get("league") or p.split("/")[-1][:-5]
            heroes = ladder.get("heroes") or []
            classes = sorted({h.get("class") for h in heroes if h.get("class")})
            if classes:
                build_groups[league] = classes
        expected = []
        for league, classes in build_groups.items():
            for cls in classes:
                expected.append("builds/%s/%s.json" % (league, cls))
            expected.append("meta/%s.json" % league)
        have_all = all(os.path.exists(os.path.join(API_DIR, p)) for p in expected)
        skip_hourly = (not self.args.force and have_all and
                       self.manifest.get("builds_updated_at") == version.get("builds_updated_at"))
        if skip_hourly:
            for p in expected:
                self.files[p] = self.old_files.get(p) or {"bytes": os.path.getsize(os.path.join(API_DIR, p))}
            log("builds/meta unchanged; using cached files (%d)" % len(expected))
        else:
            def grab(p):
                return p, self.get_json(p)
            with ThreadPoolExecutor(max_workers=6) as pool:
                futures = [pool.submit(grab, p) for p in expected]
                for fut in as_completed(futures):
                    try:
                        fut.result()
                    except Exception as e:
                        log("  hourly file failed", e)
            log("builds/meta refreshed:", len(expected))

        # Full build files for the current league, a few per class.  The build
        # page falls back to the live API for the rest (on explicit navigation).
        depth = max(0, self.args.depth)
        if current and depth:
            for cls in build_groups.get(current, []):
                lst_path = "builds/%s/%s.json" % (current, cls)
                lst = read_json(os.path.join(API_DIR, lst_path)) or {}
                heroes = (lst.get("heroes") or [])[:depth]
                for row in heroes:
                    hero = row.get("hero")
                    if not hero:
                        continue
                    path = "builds/%s/%s/%s.json" % (current, cls, hero)
                    try:
                        self.get_json(path)
                    except Exception as e:
                        log("  build failed", path, e)
            log("full builds cached for", current)

        self.write_manifest(current)
        self.write_seed(current)
        log("done; requests:", self.requests, "files:", len(self.files))
        return 0

    # -- outputs ----------------------------------------------------------
    def write_manifest(self, current):
        manifest = {
            "synced_at": now_iso(),
            "source": "https://api.playbrokenoath.com/v1/",
            "schema": self.version.get("schema"),
            "patch": self.version.get("patch"),
            "game_build": self.version.get("game_build"),
            "ladder_updated_at": self.version.get("ladder_updated_at"),
            "builds_updated_at": self.version.get("builds_updated_at"),
            "current_league": current,
            "build_depth": self.args.depth,
            "leagues": list(self.version.get("leagues") or []),
            "files": dict(sorted(self.files.items())),
        }
        atomic_write(self.manifest_path, json.dumps(manifest, ensure_ascii=False, indent=1).encode("utf-8"))

    def write_seed(self, current):
        """A compact synchronous seed so the site also works from file://."""
        if not current:
            return
        out = {
            "synced_at": now_iso(),
            "current": current,
            "version": self.version,
            "leagues": self.leagues,
            "gameData": read_json(os.path.join(API_DIR, "game-data", "index.json")),
            "ladder": read_json(os.path.join(API_DIR, "ladder", current + ".json")),
            "meta": read_json(os.path.join(API_DIR, "meta", current + ".json")),
            "lists": {},
            "details": [],
        }
        cls_dir = os.path.join(API_DIR, "builds", current)
        if os.path.isdir(cls_dir):
            for fn in sorted(os.listdir(cls_dir)):
                if not fn.endswith(".json"):
                    continue
                lst = read_json(os.path.join(cls_dir, fn))
                if not lst:
                    continue
                key = lst.get("class") or fn[:-5]
                out["lists"][key] = lst
                for row in (lst.get("heroes") or []):
                    hp = os.path.join(cls_dir, key, str(row.get("hero")) + ".json")
                    detail = read_json(hp)
                    if detail:
                        out["details"].append(detail)
        data = dump_json(out).decode("utf-8")
        data = data.replace("</", "<\\/")
        js = "/* generated by tools/sync_api.py - do not edit */\nwindow.BO_API_SEED=%s;\n" % data
        atomic_write(SEED, js.encode("utf-8"))
        log("seed:", len(js.encode("utf-8")), "bytes,", len(out["details"]), "builds")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="current league only")
    ap.add_argument("--force", action="store_true", help="ignore cached timestamps")
    ap.add_argument("--depth", type=int, default=3, help="full builds cached per class")
    args = ap.parse_args(argv)
    if args.quick:
        args.depth = 1
    try:
        return Sync(args).run()
    except KeyboardInterrupt:
        return 130
    except Exception as e:
        log("sync failed:", repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
