#!/usr/bin/env python3
"""Create a static-only release folder, without user records, tests or backups."""
from pathlib import Path
from shutil import copy2
import json
import re

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'publish'
ASSETS=(
    'index.html','styles.css','theme-v13.css','ios-picker-v14.css',
    'quick-shifts-v15.css','hourly-pay.css','app.mjs','core.mjs',
    'archive-db.mjs','ios-picker-v14.mjs','translations-extra.mjs',
    'hourly-translations.mjs','time-picker.mjs','service-worker.js',
    'manifest.webmanifest','icon.svg','favicon-v2.png',
    'apple-touch-icon-v2.png','icon-192-v2.png','icon-512-v2.png','vercel.json',
)

def main():
    # Validate first; never produce a release that references missing assets.
    for name in ASSETS:
        if not (ROOT/name).is_file():
            raise FileNotFoundError(name)
    references=re.findall(r'"\./([^\"]+)"',(ROOT/'service-worker.js').read_text())
    references+=re.findall(r'(?:href|src)="\./([^\"]+)"',(ROOT/'index.html').read_text())
    manifest=json.loads((ROOT/'manifest.webmanifest').read_text())
    references += [i['src'].removeprefix('./').removeprefix('/') for i in manifest['icons']]
    if set(references)-set(ASSETS):
        raise RuntimeError('Unlisted assets: '+repr(set(references)-set(ASSETS)))
    OUT.mkdir(exist_ok=True)
    # Do not remove unknown files: refuse rather than risk deleting user exports.
    unknown={p.name for p in OUT.iterdir()}-set(ASSETS)
    if unknown:
        raise RuntimeError('Publication folder has unlisted files; review first: '+repr(unknown))
    for name in ASSETS:
        copy2(ROOT/name,OUT/name)
    print('Prepared',len(ASSETS),'static assets in',OUT)
    print('No deployment performed; no employee data, backups or test artifacts included.')

if __name__=='__main__':
    main()
