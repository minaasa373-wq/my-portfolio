#!/usr/bin/env bash
# 制作に使う外部素材（フォント・音声モデル）を取得して、中身が同じかチェックサムで確かめる。
# ライセンス表記は assets/fonts/OFL.txt と assets/voice/mei_COPYRIGHT.txt（SOURCES.md も参照）。
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets/fonts assets/voice

check() { [ -f "$2" ] && echo "$1  $2" | sha256sum -c --status; }

font() {
  local name=$1 sum=$2 out="assets/fonts/$1"
  if check "$sum" "$out"; then echo "OK  $out"; return; fi
  curl -fsSL -o "$out" "https://raw.githubusercontent.com/google/fonts/main/ofl/mplusrounded1c/$name"
  echo "$sum  $out" | sha256sum -c
}
font MPLUSRounded1c-ExtraBold.ttf 8e7c15901dca87f1451b356dda594f7d092ba252a5dcc47da74523a242493c36
font MPLUSRounded1c-Black.ttf     d5981a59ccc5f00da1bd3ae46750fa95cd165b0e6b3a5fc7a1945f94c59449e3

MEI_SUM=b19e8e5ddef4d9d9559d654f395818e2bb3c0bbdbbca533f96086de21ac5db2b
MEI=assets/voice/mei_normal.htsvoice
if check "$MEI_SUM" "$MEI"; then
  echo "OK  $MEI"
else
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/mmd.zip" "https://sourceforge.net/projects/mmdagent/files/MMDAgent_Example/MMDAgent_Example-1.8/MMDAgent_Example-1.8.zip/download"
  python3 -I -c "import sys, zipfile; open(sys.argv[2], 'wb').write(zipfile.ZipFile(sys.argv[1]).read('MMDAgent_Example-1.8/Voice/mei/mei_normal.htsvoice'))" "$tmp/mmd.zip" "$MEI"
  rm -rf "$tmp"
  echo "$MEI_SUM  $MEI" | sha256sum -c
fi
