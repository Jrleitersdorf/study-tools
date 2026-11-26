# Changelog

All notable changes to Study Tools are listed here. Versions follow [semantic versioning](https://semver.org).

## 0.2.0 (2026-11-22)

New skills:

- `cheat-sheet` builds a printable cheat sheet as a PDF, modeled on the best one I made this semester: side tabs, a takeaway at the top of every topic, boxes with every symbol or term defined, change tables, worked examples, diagrams and true-or-false checks, with topics that never split across pages.
- `make-practice-exam` writes a practice exam that copies the structure of the real one (question types, difficulty, answer forms, points, time and coverage) from a practice or past exam, sample questions or your instructor's description, and re-solves every question before using it. You take it on screen with a timer and automatic grading, or on paper with a separate answer key.
- `grade-my-exam` grades a practice exam you took on your own (photos, scans or a typed list of answers), finds the patterns behind what you missed, and builds a review page with walkthroughs and short lessons aimed at those patterns.

The study guide:

- Written questions: short answers, essays, proofs and code, answered in your own words and marked by you against a model answer and rubric, with optional feedback from Claude.
- The practice exam is scored in points, shows how many written answers you still have to mark, and breaks your score down by unit or topic, weakest first.
- A study guide can now be just a practice exam, with no unit pages.
- Code blocks in questions and teaching text.
- On wide screens, asked questions show up as separate cards in a column to the right of the text, next to where you asked them. Cards can be dragged up or down (the position is saved), collapsed, followed up on or deleted.
- The Ask panel now actually closes, and while it is open it follows the section you scroll to until you start typing.

Shared by all the skills:

- One set of rules for reading an exam's format, covering question types across subjects. A practice exam you want to take blind later is used for its structure only, and files you mark off-limits are never opened.
- A course pack: the course is read once and reused by every skill, along with your weak spots and the questions you have already seen.

## 0.1.2 (2026-11-09)

- First public release through this repository.
- Added a display name, homepage, repository and license to the plugin manifest.

## 0.1.1 (2026-10-18)

- The offline copy now works without an internet connection.
- Long equations wrap at phone width instead of overflowing.
- The writing rules now ask for one consistent notation across the guide, even when the slides mix several.
- The writing guide and unit audit now ask for important consequences that the course material implies but never states.
- Removed several contradictions between instructions.

## 0.1.0 (2026-10-18)

- First version, with the `study-guide` skill.
