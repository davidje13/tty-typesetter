#!/bin/sh
set -e

GEN_DIR="$(dirname "$0")";
DATA_DIR="$GEN_DIR/../data"

mkdir -p "$DATA_DIR";

[ -f "$DATA_DIR/strings.mjs" ] || "$GEN_DIR/strings.mjs" "17.0.0" > "$DATA_DIR/strings.mjs";

#"$GEN_DIR/cam-kuhn.mjs" | "$GEN_DIR/tools/compress.mjs" > "$DATA_DIR/cam-kuhn.dat";
#[ -f "$DATA_DIR/cam-05.0.dat" ] || "$GEN_DIR/cam.mjs" "5.0.0" > "$DATA_DIR/cam-05.0.dat";

for VER in "12.1" "13.0" "14.0" "15.1" "16.0" "17.0"; do
	[ -f "$DATA_DIR/cam-$VER.dat" ] || "$GEN_DIR/cam.mjs" "$VER.0" > "$DATA_DIR/cam-$VER.dat";
done;

ORIGINAL_LANG="$LANG";
for LANG in $(locale -a | grep 'en_GB\|en_US\|ja_JP\|zh_CN' | grep -i utf | grep -v @); do
	WCW_FILE="wcwidth-$(uname -s)-$(uname -r)-$LANG";
	[ -f "$DATA_DIR/$WCW_FILE.dat" ] || "$GEN_DIR/c.sh" | "$GEN_DIR/tools/compress.mjs" > "$DATA_DIR/$WCW_FILE.dat";
done;
LANG="$ORIGINAL_LANG";

TTY_FILE="tty-$TERM-$TERM_PROGRAM-$TERM_PROGRAM_VERSION";
[ -f "$DATA_DIR/$TTY_FILE.dat" ] || "$GEN_DIR/tty.mjs" > "$DATA_DIR/$TTY_FILE.dat";

"$GEN_DIR/tools/optimise.mjs";
"$GEN_DIR/tools/analyse.mjs";
