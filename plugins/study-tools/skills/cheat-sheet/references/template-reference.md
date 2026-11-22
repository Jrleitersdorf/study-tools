# Template reference

Every command the sheet uses, from `assets/template/cheatsheet.sty`. `assets/template/sections/s1.tex` shows one made-up example of each; `assets/example/` is a finished sheet. Write content only with these commands.

## Hierarchy

```
sheet (sheet.json)
  cover: title, course line, scope, intro, contents        built from sheet.json
  section n (sheet.json: num, title, tab, summary)          heading, side tab, contents entry, new page
    topic n.m (\cstopic)                                    never split across pages if it fits on one
      \takeaway
      lead-in prose, then boxes in teaching order
      changetable / tablebox
      tfbox
```

## sheet.json

| Key | Meaning |
|---|---|
| `title` | cover title and PDF name, e.g. "PHYS 110 Midterm Cheat Sheet" |
| `course` | the line under the title: course, exam, date and time |
| `scope` | grey line: what the exam covers |
| `header` | the small text at the top left of every page |
| `intro` | one or two sentences under the title (LaTeX allowed) |
| `paper` | `letter` or `a4` |
| `layout` | `standard` (tabs, contents, one column) or `dense` (columns, small type) |
| `dense_columns`, `landscape` | dense layout only: 2 or 3 columns; landscape paper |
| `kind` | `cheat sheet` or `wiki` (informational) |
| `page_budget` | the agreed maximum; build.py warns above it |
| `style.no_em_dashes` | default true; build.py rejects em dashes |
| `sections` | list of `{id, num, title, tab, summary}`; `tab` is the side-tab label (12 characters at most), `summary` the grey line under the section heading |

## Commands

| Command | Arguments | Where | Notes |
|---|---|---|---|
| `\cstopic{n.m}{title}{pointers}` | number, title (3 to 8 words), source pointers | section file | starts a topic; sets the page header and the contents entry |
| `\allowsplit` | | right after `\cstopic` | lets this topic break across pages (agreed long topics only) |
| `\takeaway{text}` | | first in every topic | what it covers, then the implications |
| `keybox` | `{title}` | topic | titled box, listed in the contents; `keybox*` is not listed |
| `\keyeq[note]{math}` | optional note, display math with `\\` between lines | keybox | note on the left in italic, math on the right; without a note the math is centered |
| `symbols` | rows `symbol & meaning \\` | keybox, after `\keyeq` | every symbol in the box |
| `\means{text}`, `\nuance{text}` | | keybox | one sentence each |
| `\defn{term}{definition}` | | keybox | definitions |
| `factcard` | `{title}[image][image width as fraction]`, body of `\fact{label}{text}` | topic | works, events, people, cases, specimens; image optional |
| `changetable` | `[title][col 1][col 2][col 3]`, rows `a & b & c \\` | topic | defaults: "If you change it", Change, Effect, Why |
| `tablebox` | `{title}{tabularx column spec}`, rows with `\toprule`, `\midrule`, `\bottomrule` | topic | comparisons, timelines, lookups; `tablebox*` is not listed |
| `tfbox` | `[title]`, body of `\tf{T or F}{statement}{why}` | end of topic | 2 to 5 checks |
| `trap` | `{title}` | topic | common mistake or question pattern |
| `\example{text}` | | after a box | a one-line worked use |
| `worked` | `{title}` | topic | longer worked example; breaks across pages if it must |
| `\sidebyside[left width]{left}{right}` | fraction of the line (default 0.48) | worked, or anywhere | diagram and computation side by side |
| `\sheetfig[width]{file}{caption}` | fraction of the line (default 0.6), path from the sheet folder, caption | topic | PDF, PNG or JPG; never SVG |
| `codeblock` | `[listings options]`, e.g. `[language=Python]` | topic | monospace, wraps long lines |

Starred forms (`keybox*`, `factcard*`, `changetable*`, `tablebox*`, `worked*`) are left out of the contents' grey sublines. Use them for small boxes that are not worth listing.

## Numbering and pointers

- Sections are numbered 1, 2, 3 in `sheet.json`. Topics are `<section>.<n>`, in order, and build.py checks they belong to their section.
- Cross-references in text: "(see 2.4)". Keep them few and only to the topic that teaches the idea.
- Pointers name the student's material: "L4 pp.2--9", "Reading ch.3 pp.41--44", "Lab 2", "Lecture of Oct 6". Use `--` for ranges.

## Course notation

Put course macros in `<sheet>/macros.tex` (`\newcommand{\E}{\mathbb{E}}`, `\DeclareMathOperator*{\argmax}{arg\,max}`). The template already loads amsmath, amssymb, mathtools and bm.

## Text rules the build checks

- No em dashes (unless `style.no_em_dashes` is false).
- Fractions in math stacked, not slashed (`\frac{a}{b}`, not `a/b`); `t_{1/2}`-style subscripts are fine.
- Every topic starts with a takeaway; every key box with an equation has a symbols table; every topic has pointers.
- Figures exist; no SVG.
