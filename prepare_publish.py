#!/usr/bin/env python3
"""Prepare a source-only PWA folder. This NEVER exports employee data from the browser."""
from pathlib import Path
from shutil import copy2
import json

ROOT=Path(__file__).resolve().parent
OUT=ROOT/"publish"
OUT.mkdir(exist_ok=True)
STATIC=(
 "index.html","styles.css","app.mjs","core.mjs","storage.mjs",
 "translations.mjs","service-worker.js","manifest.webmanifest",
 "favicon-v15.png","icon-192-v15.png","icon-512-v15.png","apple-touch-icon-v15.png"
)
for item in OUT.iterdir():
 if item.is_file():item.unlink()
for name in STATIC:
 copy2(ROOT/name,OUT/name)
(OUT/"vercel.json").write_text(json.dumps({"version":2,"headers":[
 {"source":"/service-worker.js","headers":[{"key":"Cache-Control","value":"public,max-age=0,must-revalidate"}]},
 {"source":"/manifest.webmanifest","headers":[{"key":"Content-Type","value":"application/manifest+json"}]}
]},indent=2),encoding="utf-8")
assert all(x.name in STATIC or x.name=="vercel.json" for x in OUT.iterdir())
print("Static publication folder ready:",OUT)
print("No employee data, photos, test files or backups are included.")
