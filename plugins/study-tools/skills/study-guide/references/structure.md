# Phase 4: settle the structure with the user (plan, validate, then execute)

## Propose an outline

From the source files, propose units, sections and optional subsections. Choose the basis that fits the course, not a fixed rule:

- **By lecture**: the default when the exam follows the lecture sequence and the decks are self-contained.
- **By topic**: when several lectures share one topic, when a lecture covers unrelated topics, or when a textbook drives the course.
- **By chapter or week**: when the course is organized that way.
- **Hybrid**: lectures as units, with a topic moved to the unit where it is taught best (for example, a deck's last slides that open the next topic).

Within a unit, order sections in teaching order: the order that builds understanding, which is often but not always the slide order. Aim for units of 15 to 20 minutes of reading (about 2,000 to 3,000 words of prose, tables and math not counted) and 3 to 8 sections each. A very large lecture may become two units; two small ones may merge.

Decide every overlap once: repeated slides and ideas taught in two lectures go to one unit, and the other unit recalls them in a clause with a link.

## Show it to the user

Present it compactly and ask for confirmation in one message. Example:

```
Units (one page each), in reading order:
1. Lecture 6 · Overfitting and Validation: overfitting; regularization; validation; cross-validation; bias and variance
2. Lecture 7 · Logistic Regression: ... (slides 33 to 40 on Bayes move to unit 3)
...
Practice exam: 20 questions in the quiz format, 75 minutes (the guide covers the whole quiz).
  (When the guide covers only part of the exam, size it to that share, e.g. one lecture of six:
   about 10 questions in 15 minutes, and say so.)
Sources: all 31 files are mapped; the syllabus is used only for exam logistics.
```

In the same message, tell the user how the build will run: "I'll write the units one at a time, which keeps each unit consistent with what earlier ones already taught. If you prefer speed, I can write them in parallel with separate agents; it costs more and needs a stronger consistency pass at the end." (Offer the parallel option only when subagents exist.) Default to one at a time if the user does not choose.

If the user is not around to answer, take the most reasonable outline, say which you chose at the top of your next update, and continue.

## Write `outline.json` and validate it

Copy `assets/template/outline.json` into the guide folder and fill it. Every unit lists its sections and its sources; `sources` lists EVERY uploaded file exactly once with the units it feeds, or with `"use": "exam-intel"` or `"use": "excluded"` and a note. Set `"sources_dir"` to the uploads folder (absolute, or relative to the guide folder) so every later validation and build re-checks the map. Then run:

```
python3 scripts/validate.py outline <guide> --sources-dir <uploads folder>
```

It fails when an uploaded file is missing from the source map, when a source feeds no unit without a reason, when ids collide or break the id rules, or when a unit has no source. Fix and rerun until it passes. Only then start writing.

Also copy `assets/template/guide.config.json` into the guide folder and fill every value: title, course, exam, `exam_minutes` (the real exam) and `practice_minutes` (the practice exam page: the real length, or the guide's share of it), the unit word, a unique `storage_key`, the optional `student_name` from intake, and style. Keys that start with `_` are notes; leave or delete them.
