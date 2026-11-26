# Build, test and deliver

The practice exam is an exam-only study guide: the study-guide skill's page engine with no unit pages, opening on the exam (timer, Submit, automatic grading of exact answers, self-marking of written ones against their rubrics, a score breakdown by topic, Ask and Solve it for me). That skill sits beside this one in the same plugin; its folder is `../study-guide` from this skill's folder. Its build and test scripts are the ones used here.

## 1. The guide folder

One folder per exam, outside the skill folders:

```
<exam>/
  outline.json         "exam_only": true, "units": [], the exam files, the sources ("use": "exam" or "exam-intel")
  guide.config.json    title, course, exam name, practice_minutes (the timer), conditions, storage_key, style
  exam/exam.html       the page head: kicker, title, instructions (sections, points, time, materials, how marking works)
  exam/exam.questions.html
  exam/exam.solutions.html
  img/                 figures used in stems (crops from the course material, or drawn)
  work/                blueprint.md, bank.md (every drafted question), verification.md
```

Start from `../study-guide/assets/example-exam-only/` (copy the folder, then replace its content) and read `../study-guide/references/template-reference.md` sections 4, 7 and 9 for the markup. `assets/example/guide/` in this skill is a full twelve-question exam in the same form.

- **Ids**: `exam_q1`, `exam_q2`, ... in exam order. A second round gets its own folder and its own `storage_key` (`econ101-mt1-practice-r2`), so the two rounds keep separate progress.
- **Topics**: every question carries `data-topic` with a short name (2 to 5 words) from the blueprint's unit or topic column. Use the same names in every round; they label the score breakdown and feed `weak-spots.md`.
- **Points**: `data-points` from the blueprint. A written item's rubric marks add up to its points.
- **Instructions** in `exam.html` say what the real exam's cover would (sections, counts, points, time, materials) plus how this page works: Submit at the end, nothing graded before that, written answers marked by the student against the rubric. With weak-spot weighting, say so here.
- **Sections**: the page has one list of questions. Keep the real exam's order (Section A first) and name the sections and their question numbers in the instructions.
- **Figures** in stems: `<figure class="fig"><img src="img/q7.png" alt="..."></figure>` inside the stem `<div class="qt">`. A text passage, document excerpt or data table goes in the stem too, in full.

## 2. Build and check

From this skill's folder, with `<exam>` the guide folder and `<tmp>` a scratch folder:

```
python3 ../study-guide/scripts/build.py <exam>
python3 scripts/check_exam.py <exam> --blueprint <exam>/work/blueprint.md --minutes-per-point <pace>
bash ../study-guide/scripts/fetch_libs.sh                    # once; prints the library folder
node ../study-guide/scripts/test_guide.js <exam>/study_guide.html --libs <library folder>
```

- `build.py` validates every question's markup first and stops on errors. Its warnings about stems ("says 'above'") are usually right: the stem leans on something outside itself. When a flagged word is innocent ("below the equilibrium"), rephrase anyway; it costs nothing.
- `check_exam.py` checks the exam as a whole (`verification.md` section 3): counts and points against the blueprint, the spread of multiple-choice keys and runs of one letter, true-or-false balance, rubric totals, and the time at the real exam's pace (minutes per point = the real exam's minutes over its points). Fix every ERROR; look at every WARN.
- `test_guide.js` runs the page in a browser and checks the exam flow, written items, Light and Dark, phone width and saving. Fix every FAIL. Then look at the screenshots in `test-shots/`, especially `desktop-exam.png` (after Submit) and the phone one.

## 3. Paper

When the student will take it on paper (or asks for a printable copy):

```
node scripts/make_paper.js <exam> --out <folder> --libs <library folder> [--paper a4]
```

It writes "<title> - Questions.pdf" (a cover with name, date and score lines, the instructions, then each question with room to answer: a blank for numbers, ruled lines for written answers sized from `data-lines`, a lined box for code) and "<title> - Answer Key.pdf" (a quick key table, then every question with its key, worked solution, model answer and rubric). `--instructions "..."` replaces the default cover instructions (for example, to add the real exam's section rules). Questions never split across pages.

View every page of both PDFs (`pdftoppm -r 60 -png`) before sending: math typeset, figures present, enough room for each written answer. If a written answer needs more room on paper than on screen, raise its `data-lines`.

Tell the student to time themselves, keep the key closed until they finish, and send photos of their attempt for marking with the `grade-my-exam` skill if they want the patterns behind their misses.

## 4. Publish

Publish `<exam>/study_guide.html` as an artifact exactly as `../study-guide/references/build-and-publish.md` section 3 says: `files` for the images build.py lists, `capabilities` `{"sample": {}, "db": {}}` (Ask, Solve it for me and Get feedback; progress and self-marks saved across devices), `icon` `exam`, and a one-sentence description naming the course and exam. Without the Artifact tool, deliver the offline copy (`../study-guide/scripts/make_offline.py`, section 5 of that file) as the main file.

## 5. Deliver

1. The artifact card carries the link. In two or three sentences: what the exam copies from the evidence (sections, points, time, difficulty), how many questions, and how to take it (set aside the full time, Submit at the end, mark the written answers against their rubrics). Send the paper PDFs if made.
2. One line on anything assumed in the profile that the student never confirmed, and anything that did not work.
3. One offer, the most useful of: a second round (same blueprint, new questions), a round weighted toward the topics they miss, the `grade-my-exam` skill for a paper attempt, a cheat sheet in the exam's format.
4. **When they report back** (a score, the breakdown, or "I missed the elasticity ones"), record the weak topics in `course/weak-spots.md`; they drive the next round's weighting.
5. **Record** (`course-pack.md`, "After the skill finishes"): the confirmed profile stays in `course/exam-format.md`; every question used goes into `course/question-bank.md` with its exam, round and topic, so later rounds, guides and cheat sheets do not repeat it; unused verified questions from the bank go there too, marked unused.

Keep `<exam>` until the student is done: a second round, a fix to a key or a paper version is made there.
