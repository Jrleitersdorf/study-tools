---
name: grade-my-exam
description: Grades a practice exam, quiz, test or past exam the student took on their own (photos or scans of paper, screenshots, a typed list of answers, or a graded exam the instructor returned), finds the patterns behind the misses, and builds a review page with every question's correct reasoning, walkthroughs for each miss, short lessons aimed at the patterns, and an Ask button powered by Claude. Works for any subject. Records the weak spots in the course pack for the other study skills. Use whenever the user types /grade-my-exam or asks to grade, mark or check their practice exam, quiz, test or answers ("I took the practice test, here are my answers", "here are photos of my exam", "check my answers"), or to review a graded exam they got back.
---

# Grade my exam

The student took an exam on their own and hands over their attempt. Grade it accurately, find out why points were lost, and give them a review page that teaches exactly those gaps. Then record the gaps so the next study skill aims at them.

The page engine, its design, the Ask feature and the tests are finished. This skill's real work is reading the attempt correctly, grading without error, diagnosing the misses honestly, and writing the explanations and lessons.

## Where things are

Paths are relative to this skill's folder (`${CLAUDE_SKILL_DIR}`; in chat, the folder next to this file). Create one working folder per attempt, outside the skill folder:

```
<review>/
  intake.md        exam, attempt files, key, credit rules, modes
  transcript.md    the confirmed reading of the attempt
  solutions.md     Claude's independent solutions, the helper's, the reconciliation
  review.json      the page data (format: assets/template/review.html)
  img/             exam figures, crops of handwritten work
  exam_review.html built page
```

## Workflow

If a task-list tool is available, create these phases and tick them off. Read each reference when its phase starts, not before.

1. **Collect** (`references/intake.md`): the exam, the attempt, the key if any, the student's notes, the course material or an existing course pack (`references/course-pack.md`). Read the exam's structure and credit rules with `references/exam-format.md`.
2. **Transcribe, then confirm** (`references/intake.md`): every answer into `transcript.md`; list every unclear mark and ask the student to confirm it, together with any credit rule you had to assume. Meanwhile, solve the exam (phase 3, step 1).
3. **Grade** (`references/grading.md`): solve every question independently before reading the key; reconcile with the key and with an independent helper; grade exact types exactly and written answers as estimated ranges against a rubric.
4. **Diagnose and write** (`references/diagnosis.md`): habits and units behind the misses, guessed versus solid, an explanation for every card, a walkthrough for every miss, 5 to 16 lessons, the closing habits list.
5. **Build, test, publish** (`references/review-page.md`): `scripts/build_review.py`, `scripts/test_review.js`, look at the screenshots, publish with the `sample` and `db` capabilities.
6. **Record and deliver** (`references/records.md`): weak spots and the question bank into the course pack (the exam profile too, for a real graded exam); deliver; offer the next step in one line.

**A graded real exam** follows the same phases with the instructor's marks as the truth (`references/grading.md`), and phase 6 also writes the calibration into the course's `exam-format.md`.

## When to ask and when to proceed

Talk to the student only:
- at intake (one message: what to share);
- to confirm the transcript, every unclear mark, and any assumed credit rule or exam profile field (one message);
- when the key looks wrong after a re-solve: grade by the key, flag it on the card, mention it at delivery;
- at delivery.

Everything else proceeds on the defaults. If the student is away and nothing is unclear, proceed and state the assumptions in one line at delivery.

## Defaults

- **Key**: the instructor's key or rubric wins; with none, Claude's own solution, said on the page.
- **Credit rules**: select-all all-or-nothing; a requested true/false justification is required; written answers earn partial credit by rubric; no penalty for wrong answers; equal points when none are printed. Each is shown on the page.
- **Written marks**: an estimated range (low, likely, high), the lower mark when torn; the total shown as "about 74%, likely 71 to 80%".
- **Lessons**: 5 to 16, costliest habit first; worked examples are new questions.
- **Style**: formal, concise and direct; paragraphs of 2 to 3 sentences; no em dashes; math with `\frac`, every symbol defined. The student can change this.
- **No study guide or course pack needed**: explanations then come from standard knowledge of the subject, said once on the page.

## Non-negotiables

- **Transcribe, confirm, then grade.** Never guess an illegible or ambiguous mark; ask.
- **Accuracy over speed.** Solve every question from scratch before trusting any key; judge every option on its own; re-solve every disagreement; use an independent helper agent when available. A wrong key on the page is the worst failure of this skill.
- **Honest about uncertainty.** Exact types are graded exactly. Written marks are labeled as estimates, because language-model grading of written work is unreliable at fine grain and leans lenient (`references/exam-format.md` section 7). Never present an estimate as the grade.
- **The instructor's word wins** over Claude's: the key, the rubric, and on a graded exam, the marks. Disagreements are flagged, never silently changed.
- **Respect blind and off-limits files** (`references/exam-format.md` section 4). Never open an off-limits file; never reveal or discuss answers of an exam the student has not taken; pass the list to every helper.
- **Content goes only through review.json.** Do not edit `review.css` or `review.js` for one review.

## Gotchas

- **Backslashes in JSON.** Math in review.json needs doubled backslashes: `"\\(\\frac{1}{2}\\)"`. A single `\(` is a JSON error; build_review.py names the line.
- **Long inline math.** Inline formulas cannot wrap; on a phone a long one scrolls inside itself. Split chains into two formulas.
- **True/false with justification.** The choice can be right while the item is partial; say why in `verdict_reason` or in the credit rules, and give the model justification in `correct.text`.
- **Select-all keys are lists** (`["A","C"]`), single-answer keys are strings. The build checks both against the options.
- **Verdict and marks must agree**: right means full marks, wrong or blank means zero, partial is strictly between. The build refuses mismatches unless `verdict_reason` explains a credit rule.
- **Ids are stable.** Question ids are the numbers on the exam ("4b"); lessons are "L1", "L2", ... Saved Ask threads are keyed by them, so keep them when updating the page.
- **Photos.** Rotate and zoom before reading; read every page, including the back of a sheet. Crop handwritten work for the card at about 1600 px wide at most.
- **Guessed right answers** are weak spots: walkthrough, unsure filter, weak-spots.md.
- **Ask without capabilities.** Published without `sample`, or opened as a plain file, the Ask button only saves questions; it never errors.
- **Unicode escapes.** When writing JavaScript or Python with the Write tool, `\u2014`-style escapes can turn into the literal characters; check what you meant survived.

## Files in this skill

| File | Use |
|---|---|
| `references/intake.md` | Phases 1 and 2: the opening message, intake record, course pack, transcription and confirmation |
| `references/grading.md` | Phase 3: independent solving, the key, the helper re-grade, exact and written grading, graded real exams |
| `references/diagnosis.md` | Phase 4: habits and units, explanations, walkthroughs by question type, lessons, style |
| `references/review-page.md` | Phase 5: data file, build, browser tests, publish, delivery |
| `references/records.md` | Phase 6: weak-spots.md, question-bank.md, exam calibration, the next-step offer |
| `references/exam-format.md`, `references/course-pack.md` | Shared rules: the exam profile, question types, credit, blind and off-limits files; the course pack layout |
| `assets/template/review.html` | Page skeleton; its header comment documents every field of review.json |
| `assets/template/review.css`, `review.js` | The page engine (do not edit per review) |
| `assets/template/review.data.json` | A kitchen-sink data file with one made-up example of every component (math, code, an image) |
| `assets/example/` | A finished made-up art history quiz review: `review.json`, its figure, `make_figure.py` and the built `exam_review.html` |
| `scripts/build_review.py` | Validates review.json in plain language, computes the score, embeds images, builds the page |
| `scripts/test_review.js`, `scripts/fetch_libs.sh` | Browser tests (Playwright) and the local MathJax copy they need when the page has math |
