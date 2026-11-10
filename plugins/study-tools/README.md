# Study Tools

Skills that help you learn course material and prepare for exams.

In claude.ai, add the marketplace `Jrleitersdorf/study-tools` under **Customize > Plugins > Add > Add marketplace**. In Claude Code, run:

```
/plugin install study-tools --marketplace Jrleitersdorf/study-tools
```

Updates and the full instructions are in the [repository README](https://github.com/Jrleitersdorf/study-tools).

## study-guide

Run it with `/study-guide`, or ask Claude for a study guide for your class.

You upload everything you have for the class: lecture slides, recordings or transcripts, notes, readings, homework, practice exams and anything your instructor said about the exam. Claude turns it into one interactive study guide, published as a Claude artifact, with a PDF and an offline copy.

### What the guide has

**One page per unit.** A unit is a lecture, a topic or a chapter, whichever you and Claude agree on. Each page is one continuous explanation in teaching order, with equations explained, figures from your slides placed where the idea is taught, and common mistakes pointed out where they happen. Tags mark what your instructor signaled will or will not be on the exam.

**Practice questions after each unit.** Multiple choice, select all, true or false, and numeric questions that accept exact answers such as 3/4 or e^-1, typed in a live math box. Check only tells you whether you are right. Show answer gives the key and a pen-and-paper worked solution. Solve it for me has Claude work the question through step by step, and counts it as wrong.

**A practice exam** in the format and length of the real one, graded only when you submit. You get a score broken down by unit, then Show answer and Solve it for me on every question, plus a timer and a retake.

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

## Layout

```
.claude-plugin/plugin.json
skills/study-guide/
  SKILL.md         the steps Claude follows
  references/      one file per step, plus the template reference
  assets/template/ the page template and engine
  assets/example/  a finished two-unit example guide
  scripts/         extract, validate, build, test, PDF and offline copy
```
