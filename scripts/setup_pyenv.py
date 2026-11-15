#!/usr/bin/env python3
"""
FireLedger — Cross-Platform Python Virtual Environment Setup & Runner
=====================================================================
Creates an isolated `.venv` Python environment (even on minimal Debian/Ubuntu/WSL
systems where `python3-venv` / `ensurepip` is not installed), installs
`requirements.txt`, ensures `.env` exists, builds the frontend bundle if `npm`
is installed (or uses the prebuilt GitHub Pages root bundle if Node.js is not
installed), and starts the FireLedger server on http://localhost:3000.

Usage (works on Windows, macOS, and Linux):
  python3 scripts/setup_pyenv.py              # Setup .venv + start server on localhost:3000
  python3 scripts/setup_pyenv.py --setup-only # Only create .venv and install requirements.txt
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import venv
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_DIR = ROOT_DIR / ".venv"
REQ_FILE = ROOT_DIR / "requirements.txt"
ENV_FILE = ROOT_DIR / ".env"
ENV_EXAMPLE = ROOT_DIR / ".env.example"


def get_venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def has_working_pip(py_bin: Path) -> bool:
    if not py_bin.exists():
        return False
    res = subprocess.run(
        [str(py_bin), "-m", "pip", "--version"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return res.returncode == 0


def ensure_env_file() -> None:
    if not ENV_FILE.exists() and ENV_EXAMPLE.exists():
        shutil.copyfile(ENV_EXAMPLE, ENV_FILE)
        print("[pyenv] Created .env from .env.example (optional API keys can be edited in .env).")


def ensure_virtualenv() -> Path:
    venv_py = get_venv_python()
    if not has_working_pip(venv_py):
        if VENV_DIR.exists():
            shutil.rmtree(VENV_DIR, ignore_errors=True)
        print(f"[pyenv] Creating Python virtual environment at {VENV_DIR}...")
        res = subprocess.run(
            [sys.executable, "-m", "venv", str(VENV_DIR)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if res.returncode != 0 or not has_working_pip(venv_py):
            print("[pyenv] System `ensurepip` unavailable; creating bare .venv (--without-pip) and bootstrapping pip...")
            if VENV_DIR.exists():
                shutil.rmtree(VENV_DIR, ignore_errors=True)
            subprocess.check_call([sys.executable, "-m", "venv", "--without-pip", str(VENV_DIR)])
            with tempfile.NamedTemporaryFile(suffix="-get-pip.py", delete=False) as tf:
                get_pip_path = tf.name
            try:
                urllib.request.urlretrieve("https://bootstrap.pypa.io/get-pip.py", get_pip_path)
                subprocess.check_call([str(venv_py), get_pip_path, "--quiet"])
            finally:
                try:
                    os.remove(get_pip_path)
                except OSError:
                    pass
    else:
        print(f"[pyenv] Using existing virtual environment at {VENV_DIR}")

    print("[pyenv] Installing lightweight dependencies from requirements.txt...")
    subprocess.check_call([str(venv_py), "-m", "pip", "install", "--quiet", "--upgrade", "pip"])
    subprocess.check_call([str(venv_py), "-m", "pip", "install", "--quiet", "-r", str(REQ_FILE)])
    print("[pyenv] Python environment ready.")
    return venv_py


def ensure_frontend_bundle(rebuild: bool = False) -> None:
    dist_index = ROOT_DIR / "dist" / "index.html"
    root_loader = ROOT_DIR / "pages-loader.js"

    if dist_index.exists() and not rebuild:
        print("[pyenv] Compiled frontend found in ./dist.")
        return

    npm_bin = shutil.which("npm")
    if npm_bin:
        print("[pyenv] Building frontend bundle via npm...")
        if not (ROOT_DIR / "node_modules").exists():
            subprocess.call([npm_bin, "install", "--legacy-peer-deps", "--no-audit", "--no-fund"], cwd=str(ROOT_DIR))
        subprocess.call([npm_bin, "run", "build"], cwd=str(ROOT_DIR))

    if dist_index.exists():
        print("[pyenv] Frontend built in ./dist.")
    elif root_loader.exists():
        print("[pyenv] Using prebuilt GitHub Pages bundle from ./assets + ./pages-loader.js (zero Node.js build required).")
    else:
        print("[pyenv] Warning: Neither ./dist nor ./pages-loader.js found. Run `npm run build` if UI assets are missing.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Setup FireLedger Python .venv and optionally run the server.")
    parser.add_argument("--setup-only", action="store_true", help="Create .venv and install requirements without starting the server.")
    parser.add_argument("--rebuild", action="store_true", help="Force rebuild of the frontend bundle if npm is available.")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")), help="Port to listen on (default: 3000).")
    args = parser.parse_args()

    ensure_env_file()
    venv_py = ensure_virtualenv()
    ensure_frontend_bundle(rebuild=args.rebuild)

    if args.setup_only:
        act_cmd = r".venv\Scripts\activate" if os.name == "nt" else "source .venv/bin/activate"
        print(f"\n[pyenv] Setup complete! Activate with: {act_cmd}")
        print("[pyenv] Then start the server with:    python app.py")
        return

    env = os.environ.copy()
    env["PORT"] = str(args.port)
    print(f"\n[pyenv] Starting FireLedger at http://localhost:{args.port} (Press Ctrl+C to stop)...")
    os.execve(str(venv_py), [str(venv_py), str(ROOT_DIR / "app.py")], env)


if __name__ == "__main__":
    main()
