#!/usr/bin/env python3
"""Open Planning Équipe in its own narrow Chrome window and isolated storage profile."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
PORT=48931
URL="http://127.0.0.1:"+str(PORT)+"/"
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    server=None
    try:
        server=ThreadingHTTPServer(("127.0.0.1",PORT),
            partial(QuietHandler,directory=str(ROOT)))
    except OSError:
        try:
            with urlopen(URL,timeout=2) as response:
                if b"Planning" not in response.read(2000):
                    raise RuntimeError("A different app is using this local port")
        except Exception as error:
            raise RuntimeError("Local port is unavailable") from error
    if server:
        Thread(target=server.serve_forever,daemon=True).start()
    browser=shutil.which("google-chrome") or shutil.which("chromium")
    if not browser:raise RuntimeError("Google Chrome or Chromium is required")
    profile=Path.home()/".local"/"share"/"planning-equipe-profile"
    profile.mkdir(parents=True,exist_ok=True)
    try:
        process=subprocess.Popen([browser,"--user-data-dir="+str(profile),
            "--app="+URL,"--window-size=430,900","--no-first-run"],
            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        process.wait()
    finally:
        if server:
            server.shutdown();server.server_close()

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("Planning Équipe:",exc,file=sys.stderr);sys.exit(1)
