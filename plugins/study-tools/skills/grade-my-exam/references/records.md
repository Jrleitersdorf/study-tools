# Phase 6: write the results into the course pack, and offer the next step

The sibling skills (study-guide, cheat-sheet, make-practice-exam) read the course pack to aim at the student's weak spots. Writing them down is what makes this grade useful beyond today. Layout and rules: `references/course-pack.md`.

If there is no pack yet, create `course/` with at least `course.md` (course, exam, scope), `weak-spots.md`, `question-bank.md` and, for a real graded exam, `exam-format.md`. Never put off-limits material in it.

## weak-spots.md

Append one dated block per graded attempt; never rewrite earlier blocks (the history shows progress). Newest first.

```
## 2026-11-20 · Quiz 3 practice (Claude-graded, about 50%, likely 46 to 57%)

By habit (points lost, questions):
- Claims without visual evidence: 6 pts (Q7, Q9). Names works but no visible features.
- Two works of one artist or place mixed up: 5 pts (Q2, Q4). Holy Trinity vs Brancacci; Ghiberti north vs east doors.
- Dates a decade or two late: 2 pts (Q10).

By unit (likely points / possible):
- Perspective and Alberti: 9 / 14.3
- Sculpture and architecture: 4 / 10.3 (weakest)

Guessed or unsure but right (treat as weak): Q6 contrapposto.
Solid: Q1 Brunelleschi's demonstration, Q5 Alberti's window.
```

When an earlier block lists the same habit, add "(again, also on <date>)" so the next skill weights it higher; when a habit from an earlier block did not recur, add one line saying so.

## question-bank.md

Add every question of this exam unless it is blind or off-limits for a future attempt, each with its unit, source and status, so make-practice-exam can vary the missed ones and skip the mastered ones:

```
- [Q3, Quiz 3 practice, u1, multi] Features of one-point linear perspective (select all). Status: missed (incomplete select-all). Key: A, B, D.
- [Q6, Quiz 3 practice, u2, mc] Meaning of contrapposto. Status: right but guessed.
```

If `exam_mode` is blind (the student will retake it), record only the type, unit and habit, never the question text or key, and mark the line `blind`.

## exam-format.md, for a graded real exam

When the attempt is a real exam marked by the instructor, it is the strongest evidence of what the next exam looks like (`references/exam-format.md` section 1, item 3). Update the course's exam profile with a dated **Calibration** section:
- **Logistics and format as it really was**: length, points, sections, question types and counts, allowed materials.
- **Real credit rules**, read from the marks: partial credit on select-all or not, how much a justification was worth, whether units or rounding cost points, how written answers were marked (which rubric points the instructor rewarded).
- **How it differed from the practice material**: harder or easier, more computation, different units weighted, finer details, longer essays, new question types.
- **The student's habit-level misses** on the real exam, pointing to `weak-spots.md`.
- Keep earlier profile fields; mark any that this exam contradicted.

## sources.md

Add the attempt, the key and the review page, each with its mode (open, blind, off-limits).

## Tell the student, then offer the next step

One line on the pack: "I added today's weak spots to your course pack (`course/weak-spots.md`); the other study skills will aim at them." Offer to save the pack where the next skill can find it (their project, or a `Course pack` folder next to their course files).

Then exactly one line offering the next step, for example:

> Want a cheat sheet aimed at these weak spots, or a fresh practice exam in the same format to check they are fixed?

The first runs the `cheat-sheet` skill, the second `make-practice-exam`; both read the updated pack. Do not start either unasked.
