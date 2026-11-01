#!/usr/bin/env python3
"""Create a deterministic, privacy-safe release using the shared Node build."""
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parent

def main():
    subprocess.run(["node",str(ROOT/"prepare_publish.mjs")],cwd=ROOT,check=True)

if __name__=="__main__":
    main()
