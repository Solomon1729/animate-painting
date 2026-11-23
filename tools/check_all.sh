#!/bin/sh
# 全検査を回す（台帳Z-203②）。使い方は tools/check_all.py の先頭を見る。
cd "$(dirname "$0")/.." && exec python3 tools/check_all.py "$@"
