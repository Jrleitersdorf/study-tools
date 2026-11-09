# Phase 6: write the units

Each unit goes through three steps before the next one starts: write it (this file), write its questions and worked solutions (`questions.md`), and audit it (`audits.md`).

The promise of the guide: **shorter and clearer than the sources, but the reader never reaches the exam and finds something they did not know.** Protect both halves.

## Before writing a unit

Read, in this order: `work/exam_intel.md` (phase 5), the unit's entries in `outline.json`, the source files of every source mapped to the unit (`work/sources/*.md`), and, when writing one unit at a time, the units already written (at least their takeaways and section titles). Then write `work/notes/<unit>.md`: the complete raw material for this unit, organized by the planned sections, with every definition, result, equation, direction-of-effect fact, example, pitfall and exam signal from all mapped sources, each with its source location. The notes are the checklist the unit is written against and audited against; they may be long.

## Writing the unit file

Copy `assets/template/unit.html` whole to `units/<unit>.html` (never cut a template by searching for a tag: its header comment contains tag names), read `references/template-reference.md` once, and replace the example content. Link only to units and sections in `outline.json`.

**Shape.** A unit is one continuous explanation. The takeaway states the whole unit in 3 to 6 sentences. Sections go in teaching order: motivation, then the core idea, then the math, then what it means and what follows. Each section opens by connecting to what came before. Introduce each equation where it is needed, in an equation card, with what each symbol means. Derive only when the steps build understanding; otherwise state the result and the one idea behind it.

**Keep.**
- Every concept, definition and result a question could use, including direction-of-effect facts ("what happens to X when Y goes up"); state them crisply where they arise, often in a small table.
- **Consequences the sources leave implicit.** Exams test them even when no slide states them, so state them in a sentence each: what happens when a key element is removed, added or moved (for example, deleting one of the points that define a solution can only loosen it), bounds that follow from a definition (a sum of penalties bounding the number of errors), and how each hyperparameter maps onto the course's recurring concepts from earlier units (regularization strength, bias and variance, overfitting), with a link to where those were taught. Only standard, verifiable consequences; recompute each one.
- Every equation the reader needs, written correctly, with its symbols explained.
- Intuition first, then the math, then the meaning. Small concrete examples when they make an idea click (invented by you; never taken from a practice exam the user will take).
- Pitfalls: sign and label conventions, notation clashes, traps a true/false question could exploit.
- **When a source is wrong or incomplete**, teach the correct version in the text (a missing condition, a "minimize" that should be "maximize", an implication stated both ways). Add a short pitfall naming the source's version only when the student could be tested on it or would be confused when rereading the source; otherwise just teach it right.
- **One symbol, one meaning.** When the sources use one symbol for two things (for example a scalar distance and the Lagrange multipliers, or a sign function and a score), rename one of them everywhere in the guide, and add one short pitfall where the student would otherwise be confused going back to the slides ("the slides also call this \(\alpha\); here it is \(t\)").
- Exam tags, used sparingly and only with evidence from `exam_intel.md`: the exam-hint tag when the instructor said or signaled it will be tested; the skip tag when they said it will not be (keep that material to a sentence or two).

**Cut.**
- Quotes and "in lecture they said" framing: fold the substance into the explanation.
- Descriptions of figures and any pointer to where something is in the sources ("see slide 7", "as the reading shows on page 12"). If a picture matters, include the picture. The unit-scope line and the section-sources label under each heading are the only places sources are named (cited as `parsing.md` says).
- Provenance and noise: recording dates, which class covered what, "not on the slides" labels, duplicated-slide notes, trivial typos, speech-to-text slips.
- Repetition, filler, motivational padding, history with no exam value, and depth beyond what the exam could need.

**Figures.** Include the figure where the idea is explained (phase 3 produced the crops). The alt text says what the image shows; the caption says what to notice.

**Recall, do not re-teach.** If an earlier unit taught an idea, recall it in a clause and link to it (`<a href="#L6-2">6.2</a>`). A brief re-explanation of a hard idea is fine when the next idea depends on it. Overlaps were assigned to one unit in phase 4; respect that.

## Style (defaults from `guide.config.json`; follow the user's changes)

- Formal, concise, direct. Explain like a good tutor to a smart student seeing the idea for the first time; simplify technical language without losing precision.
- Prose over bullets. Paragraphs of 2 to 3 sentences. Lists only for parallel facts; numbered steps only for procedures.
- No em dashes (validate.py enforces it while `style.no_em_dashes` is true). Use commas, colons, semicolons or parentheses.
- Length: about 15 to 20 minutes of reading per unit, roughly 2,000 to 3,000 words of prose. validate.py counts prose the same way: tables, display math and inline math are removed before counting; equation names, symbol definitions, captions, pitfalls and examples count. A larger source may justify more; never pad. validate.py warns below about 1,500 words (often a sign that something exam-relevant is missing) and above about 3,600.
- Math: inline `\( \)`, display `\[ \]`; in HTML write `&amp;` for `&` and `\lt`, `\gt` for `<`, `>`.
- Width: a display line longer than about 45 characters of math does not fit a phone screen; split it with `aligned`. A table whose cells hold long math gets at most 2 columns (move long math into its own column or an equation card). test_guide.js lists any equation or table that still overflows.
- Double-check every equation, sign, transpose, constant and direction-of-effect statement against the sources.

## Finish each unit

1. Write the unit's questions and worked solutions (`questions.md`). Every one must be answerable from the unit text alone; if one is not, add the missing fact (not the answer) to the unit.
2. Run `python3 scripts/validate.py guide <guide> --only <unit-id>` (all units so far, comma-separated) and fix every error in your files. Warnings about long paragraphs, missing data-short labels, rounded numeric keys or source pointers are real quality problems; fix them too.
3. Record in `work/notes/<unit>.md`, at the end: the prose word count, what from the sources you deliberately left out and why (one line each), symbols you renamed, and for each question the section that answers it.
4. Run the unit audit (`audits.md`). Then start the next unit.

## One at a time or in parallel

One at a time (default): write unit 1, its questions and solutions, validate, audit it, then unit 2, reading what unit 1 already taught. In parallel (only if the user chose it and subagents exist): give each agent this file, `template-reference.md`, `questions.md`, the unit's notes and sources, `exam_intel.md`, the outline, and the list of which unit teaches each shared idea. The whole-guide coherence audit (phase 8) then matters even more.
