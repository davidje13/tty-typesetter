# Terminal summary

Different terminals have different levels of support for special characters.
This page compares how terminals perform relative to the rules from
[Unicode Technical Report 11](https://www.unicode.org/reports/tr11/), applied
to Unicode 16.0.0's character set data (following the convention
from `wcwidth` of assigning character widths of 1 for Ambiguous and Neutral
characters, and 0 to format characters, non-spacing combining marks, and
enclosing marks).

Note that terminals which score low here are not necessarily "bad"; zero-width
and joining characters may be intentionally displayed to aid visibility.

| Terminal | Zero Width / Combiner Support | Narrow Character Support | Wide Character Support | Emoji Sequence Support |
| -------- | ----------------------------: | -----------------------: | ---------------------: | ---------------------: |
| emacs 30.1 ansi-term | 85.6% | 99.8% | 99.8% | 10.7% |
| JetBrains IDE Terminal 2023.3.8 | 0.8% | 12.4% | 44.0% | 2.7% |
| kitty | 92.8% | 99.7% | 100.0% | 100.0% |
| Linux TTY | 0.3% | 100.0% | 92.2% | 45.9% |
| LXTerminal 0.4.0 | 98.5% | 100.0% | 99.8% | 10.7% |
| rxvt-unicode 9.26 | 91.5% | 100.0% | 96.4% | 10.7% |
| Warp 0.2025.06 | 97.2% | 99.9% | 99.8% | 10.7% |
| xfce4-terminal 0.8.10 | 92.0% | 100.0% | 99.8% | 10.7% |
| X.Org xterm 7.7.0 | 91.2% | 100.0% | 96.4% | 10.7% |
| Apple Terminal.app 455.1 | 92.5% | 99.9% | 100.0% | 10.6%<sup>1</sup> |
| VSCode Terminal 1.100.3 | 91.4% | 100.0% | 99.3% | 10.7% |

<sup>1</sup> Emoji sequences are supported when displaying text, but the cursor
moves as if they were not supported. In practice this causes a reduction in the
available column width when using emoji sequences.

<sup>2</sup> [Mode 2027](https://github.com/contour-terminal/terminal-unicode-core)
must be enabled to support emoji sequences: `\x1b[?2027h`.

[Full analysis](./index.html)
