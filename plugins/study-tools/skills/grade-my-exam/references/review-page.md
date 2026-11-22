# Phase 5: build, test and publish the review page

Paths are relative to this skill's folder; `<review>` is the working folder.

## 1. Write the data

Copy `assets/template/review.data.json` to `<review>/review.json` and replace everything (keys starting with `_` are ignored). Every field is documented in the header comment of `assets/template/review.html`; `assets/example/review.json` is a finished example. The page engine, the design and the Ask feature are finished and tested: future runs only write data. Do not edit `review.css` or `review.js` for one review.

Images go in `<review>/img/` and are referenced as `img/<name>.png`: figures from the exam (an identification image, a graph), crops of the student's handwritten work, diagrams drawn for a lesson. build_review.py embeds them, so the page is one file.

## 2. Build

```
python3 scripts/build_review.py <review>/review.json
```

It validates first and prints every problem in plain language: ERROR lines stop the build (fix them), WARN lines do not (read each one and fix it unless there is a reason). Typical errors: a verdict that does not match the key, rubric marks that do not add up, a miss without a walkthrough, an em dash, unbalanced math delimiters, an image that is not there. It then writes `<review>/exam_review.html` and prints the score line ("about 50%, likely 46 to 57%, 17 of 34 points, 3 right, ..."). Use that line in the delivery message. `--check` validates without writing.

## 3. Test in a browser

```
bash scripts/fetch_libs.sh          # once, only if the review has math; prints the --libs folder
node scripts/test_review.js <review>/exam_review.html [--libs <folder>]
```

Playwright with Chromium is found as `playwright`, `/opt/npm-tools/node_modules/playwright` or `$PLAYWRIGHT_PATH`; never run `playwright install`. The suite mocks Claude and checks: no script errors; the score and counts; one card per question; every filter; the Wrong-first sort; the Lessons view; links between the views; walkthroughs on misses; images; monospace code; math typeset with no raw TeX; Ask (follows the item on screen, typed targets like "7" or "L3", follow-ups with alternating roles ending on a user turn, saving across a reload); Light and Dark; no sideways scrolling at 390 px; Ask save-only without the sample capability. Fix every FAIL. WARN lines name a box that scrolls sideways on a phone; fix them when cheap (shorter inline formulas, narrower code).

Then look at the screenshots it saves in `test-shots/`: desktop light and dark, the lessons, an answered Ask, and the phone views. Open one long written card and one lesson yourself. If Playwright is missing, say so in the delivery and rely on the build's validation.

## 4. Publish (when the Artifact tool exists)

The page already meets the artifact contract (a `<title>`, light and dark tokens, cdnjs for MathJax only when needed, Google Fonts, everything else inline). If the environment requires the artifact-design or artifact-capabilities skill before publishing, load it for the contract only; do not restyle the page.

Publish with:
- `file_path`: `<review>/exam_review.html` (no `files`: images are embedded);
- `capabilities`: `{"sample": {}, "db": {}}`. `sample` lets Ask answer; `db` keeps the student's questions across devices. Without them Ask still saves questions in the browser;
- `icon`: `check`; `description`: one sentence naming the course, the exam and the score range.

To update later (a corrected mark, a new lesson), edit `review.json`, rebuild and publish the same file path again (same conversation) or pass the artifact's `url` (later conversation). Keep question ids and lesson ids stable: saved questions are keyed by them.

Without the Artifact tool, send `exam_review.html` as a file. It works in any browser; Ask saves questions but cannot answer them there.

## 5. Deliver

In two or three sentences: the score range and what it rests on (the instructor's key, or Claude's), the two or three costliest patterns, and where to start (Lesson 1). Mention anything unverified (a disputed key item, a mark that depends on a reading the student did not confirm, tests skipped). Then the course-pack update and the one-line offer of the next step (`references/records.md`).
