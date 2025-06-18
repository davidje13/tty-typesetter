#!/bin/sh
set -e

GEN_DIR="$(dirname "$0")";
if [ -z "$LANG" ]; then
	echo "Must set a LANG (e.g. C / en_GB)" >&2;
fi;

gcc -o "$GEN_DIR/c.o" -x c -Wall -Wextra - <<EOF >&2 ;
#define _XOPEN_SOURCE
#include <wchar.h>
#include <locale.h>
#include <stdio.h>

int main() {
	if (setlocale(LC_ALL, "$LANG") == NULL) {
		fprintf(stderr, "Failed to set locale to $LANG\n");
		return 1;
	}

	for (wchar_t c = 0x000000; c <= 0x10ffff; ++c) {
		putc('2' + wcwidth(c), stdout);
	}
	putc('2' + -1, stdout); // TODO: use wcswidth to see if it can support emoji sequences
	putc('\n', stdout);
	return 0;
}
EOF

"$GEN_DIR/c.o";
rm "$GEN_DIR/c.o" >/dev/null;
