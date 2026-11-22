# The course pack: parse a course once, reuse it in every skill

Shared by every study-tools skill. Parsing slides, recordings and readings is the most expensive step and the one that decides quality, so it is done once per course and exam and saved as a folder that the other skills read. A study guide, a cheat sheet, a practice exam and a grade report built from the same pack agree with each other, use the same notation and respect the same off-limits rules.

## Layout

```
course/
  course.md          course, exam name and date, scope (units in the exam), allowed materials, the student's priorities and style changes
  sources.md         every uploaded file: what it is, which unit it belongs to, its mode (section 4 of exam-format.md), pages
  notes/<unit>.md    per-unit notes: every testable fact, definition, equation, figure, example and instructor signal, with source pages
  exam-format.md     the confirmed exam profile (exam-format.md, section 2), including the evidence it rests on
  off-limits.md      blind and off-limits files and the do-not-mirror list; read by every helper before it starts
  question-bank.md   questions the student practiced or will face, each with its unit and source (never items from blind files)
  weak-spots.md      what the student got wrong or asked about, by unit, with dates (written by grade-my-exam and the guide)
  figures/           figures cropped from the sources, named <unit>-<what>.png
```

## Before parsing anything

Look for an existing pack, in this order: a `course/` folder from earlier in this conversation; a pack the student uploads or attaches (a zip, or the files); a pack saved in the student's project or a folder on their computer; the working files of a study guide built for the same exam (`work/` in a guide folder maps onto this layout: `work/notes/` to `notes/`, `work/exam_intel.md` to `exam-format.md` and `off-limits.md`). If one exists:
1. Say which pack you are using and what it covers.
2. Ask only what it lacks or what may have changed (new lectures, a changed scope, a new practice exam).
3. Parse only the new files, then update the pack.

If none exists, build it with the skill's own parsing step, which writes this layout.

## After the skill finishes

Keep the pack up to date (new weak spots, a corrected scope), then tell the student in one line that it exists and where. Offer to save it where the next skill can find it: their project, or a `Course pack` folder next to their course files if their computer is linked. Never include off-limits material in a pack that is saved or shared.

## Rules for helpers

When work is split across helper agents, every helper gets the paths of `course.md`, `exam-format.md`, `off-limits.md` and the notes it needs, and the instruction: do not open any file listed as off-limits, and do not mirror any file listed as blind.
