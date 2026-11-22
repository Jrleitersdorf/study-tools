# Study Tools

Skills that help you learn course material and prepare for exams.

In claude.ai, add the marketplace `Jrleitersdorf/study-tools` under **Customize > Plugins > Add > Add marketplace**. In Claude Code, run:

```
/plugin marketplace add Jrleitersdorf/study-tools
/plugin install study-tools@study-tools
```

Updates and the full instructions are in the [repository README](https://github.com/Jrleitersdorf/study-tools).

## study-guide

Run it with `/study-guide`, or ask Claude for a study guide for your class.

You upload everything you have for the class: lecture slides, recordings or transcripts, notes, readings, homework, practice exams and anything your instructor said about the exam. Claude turns it into one interactive study guide, published as a Claude artifact, with a PDF and an offline copy.

### What the guide has

**One page per unit.** A unit is a lecture, a topic or a chapter, whichever you and Claude agree on. Each page is one continuous explanation in teaching order, with equations explained, figures from your slides placed where the idea is taught, and common mistakes pointed out where they happen. Tags mark what your instructor signaled will or will not be on the exam.

**Practice questions after each unit.** Multiple choice, select all, true or false, numeric questions that accept exact answers such as 3/4 or e^-1 typed in a live math box, and written questions (short answers, essays, proofs, code) that you mark yourself against a model answer and rubric, with optional feedback from Claude. Check only tells you whether you are right. Show answer gives the key and a pen-and-paper worked solution. Solve it for me has Claude work the question through step by step, and counts it as wrong.

**A practice exam** in the format and length of the real one, graded only when you submit. You get a score in points broken down by unit, weakest first, then Show answer and Solve it for me on every question, plus a timer and a retake.

**An Ask button** that follows the section you are reading. It saves your questions, answers them in place and takes follow-ups. On a wide screen each question becomes its own card beside the text, at the spot you asked it, and you can drag it up or down.

**Everything else:** progress, questions and walkthroughs saved across devices, a Light and Dark mode, and a layout that works on a phone.

### How it is built

1. Intake: you upload your material and say if anything should count more or less.
2. A short integrity check of the files.
3. Every source is read and summarized.
4. You and Claude agree the units and their sections before anything is written.
5. Exam intelligence: what the exam covers, its format, and every hint from the instructor.
6. Each unit in turn: the text, its questions and worked solutions, then an audit. You see a draft after the first unit.
7. The practice exam.
8. An audit of the whole guide for repetition, order and consistent notation.
9. Build, browser tests and publishing.

The writing and audit standards, the page template and every tag are documented in `skills/study-guide/references/`.

### Requirements

Claude needs Python 3 with Pillow and pypdf (and pdfplumber for the full integrity check), poppler-utils, LibreOffice to convert pptx and docx files, Node with Playwright for the browser tests and the PDF, and npm access once to fetch MathJax and MathLive. Claude's own environment usually has these. Recordings without transcripts cannot be used.

## cheat-sheet

Run it with `/cheat-sheet`, or ask Claude for a cheat sheet, formula sheet or reference sheet.

Claude asks what your exam lets you bring in (one page, both sides of a sheet, an open-book printed reference) and plans the sheet around it: sections with side tabs, numbered topics that never split across pages, a takeaway at the top of every topic, boxes with every symbol or term defined, "if you change it" tables, worked examples, diagrams drawn for the sheet, and true-or-false checks. It is weighted toward what your exam actually asks, from your practice exams, and every fact is audited against your material before you get the PDF. It works for equations, definitions, works of art, events, cases, passages and code.

Requires pdflatex (TeX Live with the usual packages), rsvg-convert, poppler-utils and Python with pypdf and pdfplumber.

## make-practice-exam

Run it with `/make-practice-exam`, or ask Claude for a practice exam, mock exam or practice test.

The most important thing to share is a practice exam, a past exam, sample questions or your instructor's description of the exam. Claude reads it into a profile (sections, question types, points, time, how hard the questions are, what the answers look like, what it covers, the instructor's wording habits), turns that into a blueprint of question slots, and shows you both to confirm before writing anything. It then writes more questions than it needs from your course material, has every one re-solved by a separate helper that never saw the answers, drops anything ambiguous, and checks the final exam against the blueprint.

You take it as an interactive page with a timer, automatic grading, self-marking of written answers against a rubric and a score broken down by topic. If you will take it on paper, you also get a questions PDF with room to write and a separate answer key. A second round uses the same blueprint with new questions, and it can lean toward the topics you missed.

## grade-my-exam

Run it with `/grade-my-exam`, or send Claude your attempt and ask it to grade or check your answers.

Send photos or scans of your paper attempt, screenshots or a typed list of answers, and the key if you have one. Claude transcribes your answers and asks you to confirm anything it cannot read, solves every question itself before trusting any key, grades exact answers exactly and written answers as an honest estimated range against a rubric, and works out the patterns behind the misses. The review page has every question with its correct reasoning, a walkthrough for each miss, short lessons aimed at those patterns, and an Ask button. A graded exam your instructor returned works too, with the instructor's marks as the truth.

## How the tools work together

All four tools read your material into one course pack (`course/` next to your work) and reuse it, so a class is only read once. The exam profile, the questions you have already seen and the topics you keep missing live there too, so a practice exam avoids repeating questions and can target your weak spots, and grading a practice exam updates what the next one focuses on.

## Layout

```
.claude-plugin/plugin.json
skills/study-guide/
  SKILL.md                 the steps Claude follows
  references/              one file per step, plus the template reference
  assets/template/         the page template and engine
  assets/example/          a finished two-unit example guide
  assets/example-exam-only/ a guide that is only a practice exam
  scripts/                 extract, validate, build, test, PDF and offline copy
skills/cheat-sheet/
  assets/template/         the LaTeX design (cheatsheet.sty) and one example of every component
  assets/example/          a finished four-section example sheet
  scripts/build.py         checks, builds and paginates the sheet
skills/make-practice-exam/
  assets/example/          a finished practice midterm with its profile, blueprint and verification notes
  scripts/                 whole-exam checks and the paper version
skills/grade-my-exam/
  assets/template/         the review page and engine
  assets/example/          a finished example review
  scripts/                 build and test the review page
```

Every skill also has `references/exam-format.md` and `references/course-pack.md`, copied from `shared/references/` in the repository.
