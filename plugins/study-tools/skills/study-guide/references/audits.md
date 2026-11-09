# Audits (phase 6 for each unit, phase 8 for the whole guide)

Two kinds: an audit of each unit right after its questions and solutions are written (phase 6), and one audit of the whole guide after the practice exam exists (phase 8). When subagents are available, give each audit to an independent agent that did not write the unit, with this file and the paths it needs; a writer grading their own work misses the same things twice. Without subagents, do a fresh self-review: re-read the unit's sources first, then read the unit as if seeing it for the first time, and answer every question before looking at its key.

Every audit edits the files directly, then runs `python3 scripts/validate.py guide <guide>` (with `--only` for the units written so far) until it passes, and writes a short report to `work/audits/<name>.md`.

## Unit audit (one per unit)

Inputs: the unit file, its questions and solutions, `work/notes/<unit>.md`, the source files in `work/sources/` for the unit, and `work/exam_intel.md`.

1. **Nothing exam-relevant lost.** Go through the notes and the sources section by section and list every exam-relevant item: concepts, definitions, equations, direction-of-effect facts, pitfalls, conventions, exam signals. Confirm each is in the unit or was reasonably left out under the writing rules (the writer lists deliberate omissions; judge them, do not trust them). If something needed is missing, add it concisely where it belongs. Then list the consequences a question could ask that the sources leave implicit (removing, adding or moving an element; bounds; each hyperparameter's effect on the course's recurring concepts such as bias, variance and overfitting) and check each is stated (`writing.md`, "Consequences the sources leave implicit").
2. **Every question is answerable from the unit text.** Answer each one using only the unit. If you cannot, add the missing fact (not the answer) to the right section.
3. **Accuracy.** Verify every equation (signs, transposes, squares, constants), every number, every direction-of-effect statement and every worked example by recomputing it. Check the direction of every implication (an "if" that the text turns into an "if and only if" is a classic true/false trap) and every convention that differs between sources (a factor of 1/2, a sign, an index), and make sure the unit warns about it where a question could exploit it. Re-solve every practice question independently and confirm the key; for multiple choice and select-all, confirm each wrong option is wrong and each right one is right, against the unit text and against standard knowledge of the subject. Check each worked solution reaches the key, and that every numeric key is exact or has at least 5 significant digits. A wrong statement is worse than a missing one.
4. **Self-contained.** No quotes, no provenance, no pointers to slides or pages outside the unit-scope line and the section-sources labels (and those follow the citation rule in `parsing.md`); every question stem stands on its own. If the user will take a supplied practice exam, no question mirrors one of its items and nothing discusses it; lecture facts stay.
5. **Notation within the unit.** List every symbol the unit uses and what it means. A symbol that means two things (often inherited from the slides: a scalar and the multipliers, a function and a score, a point and a new input) gets renamed in one of its meanings throughout the unit, its questions and its solutions, with one short note where the student would otherwise be confused by the slides. Check that the unit's notation matches the units before it.
6. **Length and style.** About 15 to 20 minutes of reading. If the unit is clearly over, trim the lowest-value material, never an exam-relevant fact. Paragraphs of 2 to 3 sentences, no em dashes (unless the user changed the style).
7. **Figures.** View every image the unit uses. It must be legible, tightly cropped, relevant, with alt text and a caption saying what to notice. Remove a figure that adds nothing; add one from the sources if a key idea needs a picture.

Report: **Added** (each fact and where), **Fixed** (old versus new), **Renamed symbols**, **Trimmed**, **Question by question** (id, answerable before your edits yes or no, the section that answers it, key confirmed), **Doubts**.

## Whole-guide coherence audit (once, phase 8, after the practice exam)

The unit audits check each unit in isolation; this audit reads the guide as the student will, start to finish, and checks that it builds knowledge step by step instead of repeating itself. Some overlap is good (a one-clause recall, a short reminder of a hard idea right before it is used); the same explanation given twice is not.

Inputs: all unit files in outline order with their questions and solutions, the practice exam files, `outline.json`, `work/exam_intel.md`.

1. **Repetition across units.** List every concept explained in more than one unit. For each, decide where it belongs (usually where it is first needed or where the sources teach it), keep the full explanation there, and reduce the others to a one-clause recall with a link. Watch especially for decks that repeat each other's slides.
2. **Order.** Find every concept used before it is taught (a later unit's term appearing earlier without explanation). Fix by moving a short explanation earlier, or by adding a brief forward note only when moving is impossible.
3. **Notation.** Build a short table of symbols used in more than one unit. Every symbol means the same thing everywhere, or the change is stated where it happens (a pitfall when it could cause a wrong answer).
4. **Progression.** Each unit's opening connects to what came before; takeaways read in sequence tell the story of the course; cross-unit links point the right way and resolve.
5. **Balance.** Compare unit lengths and question counts with the weighting in `exam_intel.md`; flag a heavily weighted topic that got little space or few questions, and a lightly weighted one that got too much.
6. **Practice exam.** Covers every unit, weighted like the real exam, sized and timed as `questions.md` says (with the share stated when the guide covers part of the exam), no duplicates of unit questions, no mirrored items from a practice exam the user will take, every key re-solved and every option checked.

**A guide with one unit.** Steps 1 and 5 have nothing to compare, so skip them and say so in the report. Do steps 2, 3 and 4 within the unit: no term used before the section that teaches it, one meaning per symbol across the unit, its questions, its solutions and the exam, and sections that each build on the one before. Do step 6 in full.

Report: **Repetition removed** (concept, kept in, reduced in), **Order fixes**, **Notation table**, **Balance notes**, **Other edits**, **Doubts**. After this audit, run the final build and the tests (phase 9).
