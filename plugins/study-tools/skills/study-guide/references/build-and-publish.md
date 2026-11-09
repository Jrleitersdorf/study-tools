# Phase 9: build, test, publish, deliver

The same build and publish steps make the early one-unit draft in phase 6 (`--only <unit-id>`).

Paths below are relative to the skill folder (`${CLAUDE_SKILL_DIR}`); `<guide>` is the guide folder.

## 1. Build

```
python3 scripts/build.py <guide>
```

It validates first (re-checking the source map against `sources_dir` from `outline.json`) and stops on any error (fix them; `--force` builds anyway for a quick look). For the early draft with only the first unit written, use `python3 scripts/build.py <guide> --only <unit-id>`: it builds just that unit and accepts links to units not written yet. It writes `<guide>/study_guide.html` and lists the image files that must be published next to it. Pillow adds image dimensions; install it if build says it is missing.

## 2. Test in a browser

```
bash scripts/fetch_libs.sh                      # once; prints the library folder
node scripts/test_guide.js <guide>/study_guide.html --libs <that folder>
```

The suite serves MathJax and MathLive from the local copies (the sandbox usually cannot reach the CDNs), mocks Claude for Ask and Solve it for me, and checks: no script errors; math typeset with no errors or raw TeX; contents and cards; wrong answers do not reveal the key; Show answer reveals key and worked solution; exact math answers; progress survives a reload; Solve it for me; Ask; the practice exam flow; Light and Dark; no sideways scrolling of the page at phone width; graceful behavior without Claude. Fix every FAIL.

At phone width (390 px) it also prints a WARN line for every display equation or table that overflows its own box (the reader would have to scroll it sideways). These do not fail the run; fix them when the fix is cheap (split the equation with `aligned`, take the table to 2 columns), since some readers study on a phone.

Then look at the screenshots it saves (`test-shots/` next to the page): desktop light and dark, the exam after submitting, Ask, and a phone page. Also open two or three unit pages yourself at desktop and phone width and look at every figure and equation card. If Playwright is not available, say so in the final message and rely on validate.py.

## 3. Publish as an artifact (when the Artifact tool exists)

The template already meets the artifact page contract (title, light and dark tokens, only allowed hosts: cdnjs for MathJax, jsdelivr for MathLive, Google Fonts; MathLive's fonts are inlined) and its design is finished. If the environment requires the artifact-design or artifact-capabilities skill before publishing, load it only for the page contract and the capability declaration below; do not restyle or restructure the page.

Publish with:
- `file_path`: `<guide>/study_guide.html`
- `files`: one entry per image, `{"img/<name>.png": "<guide>/img/<name>.png", ...}` (the list build.py printed)
- `capabilities`: `{"sample": {}, "db": {}}`. `sample` powers Ask and Solve it for me; `db` saves progress, questions and walkthroughs across the reader's devices.
- `icon`: `book`; a one-sentence `description` naming the course and exam.

To update later, edit the content files, rebuild, and publish the same file path again (same conversation) or pass the artifact's `url` (later conversation). Keep question ids stable: saved progress is keyed by them.

Without the Artifact tool, deliver the offline copy (step 5) as the main file. Ask and Solve it for me hide themselves there, and progress saves in the reader's browser.

## 4. PDF

```
node scripts/make_pdf.js <guide>/study_guide.html <out>/<Guide Title>.pdf --libs <library folder>
```

The print stylesheet replaces the interactive start page with a compact cover (title, scope and the contents of every unit), keeps the reading text and figures (each capped at about a third of a page), and drops the interactive parts (questions, Ask, the exam, buttons). Look at the first three pages (`pdftoppm -r 50 -png -f 1 -l 3`) before sending.

## 5. Offline copy

```
python3 scripts/make_offline.py <guide>/study_guide.html <out>/<Guide Title>.html --libs <library folder>
node scripts/test_guide.js <out>/<Guide Title>.html --offline
```

One file with the images, MathJax and MathLive embedded (about 3 MB more than the page) and a full document skeleton. It works in any browser with no internet connection: equations, the math answer box and progress saving all work; Ask and Solve it for me hide themselves. The `--offline` test loads it with all network access blocked and must pass.

The libraries come from `fetch_libs.sh` (npm). If they cannot be fetched, make_offline.py prints a WARNING block and exits with code 3: that file still loads MathJax and MathLive from the internet and shows raw TeX without a connection. Then do not call it an offline copy; tell the user it needs an internet connection.

## 6. Deliver

The artifact card carries the link; say in one or two sentences what the guide contains (units, number of questions, the practice exam) and send the PDF and the offline copy as files. If the user's computer is linked and they named a folder, also save the files there. Mention anything that did not work (for example, browser tests skipped) in one line. Keep `<guide>` and `work/` until the user is done studying: later edits and updates are made there.
