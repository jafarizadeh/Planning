#!/usr/bin/env python3
"""Open the private shift calendar in a phone-sized browser window."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
import shutil
import subprocess
import sys

PROJECT = Path(__file__).resolve().parent
PORT = 48627
URL = "http://127.0.0.1:" + str(PORT) + "/"

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def open_browser():
    browser = shutil.which("google-chrome") or shutil.which("chromium")
    if not browser:
        raise RuntimeError("Google Chrome or Chromium is required")
    profile = Path.home() / ".local" / "share" / "shift-planner-browser"
    profile.mkdir(parents=True, exist_ok=True)
    return subprocess.Popen([
        browser, "--user-data-dir=" + str(profile),
        "--app=" + URL, "--window-size=410,880", "--no-first-run"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def main():
    server = None
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT),
            partial(QuietHandler, directory=str(PROJECT)))
    except OSError:
        try:
            with urlopen(URL, timeout=1) as response:
                if "Shift Planner" not in response.read(2000).decode("utf-8"):
                    raise RuntimeError("Local port is used by a different application")
        except Exception as error:
            raise RuntimeError("Port " + str(PORT) + " is not available") from error
    if server:
        Thread(target=server.serve_forever, daemon=True).start()
    try:
        process = open_browser()
        process.wait()
    finally:
        if server:
            server.shutdown()
            server.server_close()

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Shift Planner: " + str(error), file=sys.stderr)
        sys.exit(1)
