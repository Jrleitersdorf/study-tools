# Phase 3: parse everything

Goal: turn every upload into material you can write from without reopening the originals, and lose nothing. Output lives in `<guide>/work/`: `inventory.json`, one `sources/<short-name>.md` per source, `figures/` with candidate crops, and `practice.md` with every supplied practice question.

## Order of work

1. `python3 scripts/extract.py inventory <uploads> --json <guide>/work/inventory.json` lists every file with a kind guess. Correct the guesses as you read.
2. Convert what is not PDF or text: `extract.py convert` for pptx, docx, key, odp (keeps the layout for figures); `extract.py notes` for pptx speaker notes; `extract.py notebook` for ipynb.
3. For each slide deck:
   - `extract.py builds <deck.pdf> --out work/<name>-clean.pdf`. Slide software often exports every animation step as a page (a 22-slide deck can be 135 pages). It also writes `work/<name>-clean.pages.json`, mapping each clean page to the original page. Read from the clean PDF.
   - **Citing slides (one rule for the whole guide).** Cite the page numbers of the file the student actually has, the original deck, because that is what they scroll to: translate clean pages with the map. Use the printed slide numbers instead only when every slide in that deck prints one (check the contact sheets). Never mix the two within a deck. Write citations only in the unit-scope line and the section-sources labels, e.g. "Slides 12 to 30" or "Pages 12 to 30 of the slides".
   - `extract.py text work/<name>-clean.pdf work/<name>.txt` for the text layer. Math in the text layer is usually garbled: transcribe equations from the rendered page, not from the text.
   - `extract.py sheet work/<name>-clean.pdf work/sheets/<name>` and look at every contact sheet (6 pages per image). This is the cheapest way to see diagrams, plots and equations. Render a single page larger (`extract.py render ... --pages N --dpi 150`) only when you need to read a detail.
   - Note in the source file every symbol the deck uses for two different things (writing.md says how to handle it).
4. Run `extract.py dups` across all decks. Lectures often re-show the end of the previous lecture; note the repeated pages so each idea is taught once, in the unit where it belongs.
5. Read every transcript, notes file, reading and homework in full. Transcripts carry what the instructor stressed, said will or will not be tested, and explained beyond the slides. Fix speech-to-text slips (record the fixes you used in the source file).
6. Practice and past exams: transcribe every question, with its answer when available, into `work/practice.md` with its source and number. If the user will take a practice exam themselves, still read it (it shows style and weight) but never copy or discuss its questions, numbers or worked examples in the guide. The lecture facts it tests still belong in the guide.

## The source file: `work/sources/<short-name>.md`

One per source, written while reading it. This is the safety net for "never reach the exam and not know something", so be complete rather than elegant.

```
# <source name> (<kind>, <pages or length>)
Repeats: pages 2 to 9 repeat <other deck> pages 14 to 21 (teach once, in unit <id>).
Speech-to-text fixes: "psi" = xi, ...

## Page 3 (or timestamp / section)
- Content: every definition, claim, equation (transcribed in LaTeX), example and number on the page.
- Figure: what it shows and whether it teaches something (candidate: yes/no).
- Instructor: what was said about it, folded in plainly; exam signals verbatim in quotes here only
  ("this will be on the quiz", "I won't ask you to derive it").
```

## Figures

Figures come from the sources whenever the source has one; draw a new figure only when none exists and a picture teaches something the text cannot.

1. Choose figures that carry a concept or that a question could ask about: plots of an effect, geometric pictures, diagrams of an algorithm, comparison charts. Skip decorative images, logos and photos of people. Typically 2 to 6 per unit.
2. Render the page at 150 to 200 dpi (`extract.py render ... --dpi 150`), look at it, and crop with `extract.py crop <page.png> x0 y0 x1 y1 <guide>/img/<unit>-<name>.png`, where the coordinates are fractions of the page. The script trims white margins. Leave out the slide title bar, footer, page number and unrelated text.
3. View the crop: it must be legible at 600 to 900 px wide. First crops usually catch fragments of neighbouring text or cut off a label. Do not shrink the crop until it cuts the figure: crop generously, then paint the stray fragments white with `extract.py blank <img> x0 y0 x1 y1` (fractions of the crop; it re-trims the margins). View it again after every change.
4. Keep files small: `crop` and `blank` already save at most 900 px wide as an optimized 128-color palette PNG. If a photo or a dense plot looks banded, redo it with `--colors 0` (full color); `--max-width 0` keeps the original size.
5. Embedded raster images (photos, scanned plots) can be pulled directly with `extract.py images`.

## Context budget

Large uploads can exceed what one pass can hold. Work source by source and write the source file before moving on, so the knowledge is on disk rather than in context. Read contact sheets instead of individual pages. When subagents are available and the user chose the parallel build, one agent per source (or per unit's sources) can write the source files; give each this file and the source-file format.
