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

| Terminal | Control Code Support | Zero Width / Combiner Support | Narrow Character Support | Wide Character Support | Emoji Sequence Support |
| -------- | -------------------: | ----------------------------: | -----------------------: | ---------------------: | ---------------------: |
| emacs 30.1 ansi-term | 100.0% | 85.6% | 99.8% | 99.8% | 0.0% |
| JetBrains IDE Terminal 2023.3.8 | 100.0% | 0.8% | 12.4% | 44.0% | 0.0% |
| kitty | 100.0% | 92.8% | 99.7% | 100.0% | 99.6% |
| Linux TTY | 100.0% | 0.3% | 100.0% | 92.2% | 0.0% |
| LXTerminal | 100.0% | 98.5% | 100.0% | 99.8% | 0.0% |
| rxvt-unicode 9.26 | 100.0% | 91.5% | 100.0% | 96.4% | 0.0% |
| Warp 0.2025.06 | 100.0% | 97.2% | 99.9% | 99.8% | 0.0% |
| xfce4-terminal 0.8.10 | 100.0% | 92.0% | 100.0% | 99.8% | 0.0% |
| X.Org xterm 7.7.0 | 100.0% | 91.2% | 100.0% | 96.4% | 0.0% |
| Apple Terminal.app 455.1 | 100.0% | 92.5% | 99.9% | 100.0% | 0.0%<sup>1</sup> |
| VSCode Terminal 1.100.3 | 100.0% | 91.4% | 100.0% | 99.3% | 0.0% |

<sup>1</sup> Emoji sequences are supported when displaying text, but the cursor
moves as if they were not supported. In practice this causes a reduction in the
available column width when using emoji sequences.

<sup>2</sup> [Mode 2027](https://github.com/contour-terminal/terminal-unicode-core)
must be enabled to support emoji sequences: `\x1b[?2027h`.

[Full analysis](./index.html)
