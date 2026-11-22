# Template reference: every tag, where it sits, what goes in it

Read this before writing the first unit. The template files in `assets/template/` show each component in place with a made-up example; this file defines them precisely.

## Contents
1. How a guide is assembled
2. The hierarchy
3. Tag dictionary (`data-sg` values)
4. Ids and numbering
5. Settings (`guide.config.json`)
6. Engine files (never edited per guide)
7. Copy-paste snippets
8. Markup rules that prevent rendering bugs
9. Exam-only guide

## 1. How a guide is assembled

A guide is a folder. `scripts/build.py <guide>` joins the pieces into one HTML page:

```
head.html            title, saved-theme script, fonts            (template, filled from config)
tokens.css + components.css + layout.css (+ <guide>/extra.css)    (template)
top.html             header, contents sidebar, start page          (template, filled from config)
units/<id>.html      one per unit, in outline order; build.py puts
  units/<id>.questions.html and units/<id>.solutions.html at the <!--QUESTIONS--> marker
exam/exam.html       the practice exam page, same way (optional; the only page of an exam-only guide, section 9)
bottom.html          the summary page                              (template, filled from config)
window.SG.config     the settings, for the scripts
js/eval.js, core.js, pages.js, theme.js, ask.js, mathfield-fonts.html, mathfield.js, mathjax-config.js, MathJax
```

Template comments are stripped from the output. `{{key}}` placeholders in head, top and bottom are replaced from `guide.config.json`. To change the start-page wording for one guide, copy `top.html` (or `bottom.html`, `head.html`) into the guide folder and edit the copy: build.py prefers the guide's own file. Never edit the template folder for one guide.

## 2. The hierarchy

```
guide
├── header                         title, progress meter, Light/Dark switch, save status
├── contents                       sidebar, built by the engine
├── start-page   (#intro)          scope line, unit cards, how the guide works (+ print-cover, PDF only)
├── unit         (one per page)    section[data-sg="unit"]
│   ├── unit-head                  unit-kicker, unit-title, unit-scope
│   ├── takeaway                   the unit in 3 to 6 sentences
│   ├── section  (numbered, h3)    section-title, section-sources, then components
│   │   ├── subsection (optional, h4)   subsection-title, then components
│   │   └── components             text, equation, figure, table, pitfall, worked-example, list, steps, code-block
│   ├── questions                  the unit's practice questions (inserted by build.py)
│   │   └── question               question-stem, options/option or the written box, explanation (+ its solution:
│   │                                  steps and answer line, or model-answer and rubric for a written item)
│   └── confidence                 Shaky / OK / Solid
├── exam         (#exam, optional) exam-head, exam-instructions, exam-bar, exam-body, exam-submit
└── summary-page (#summary)        progress table, exam score line
```

A "unit" is whatever the agreed outline says one page should be: a lecture, a topic, a chapter, a week. A "section" is one numbered teaching step inside it. A "subsection" splits a long section into two or three named parts. Components carry the content.

## 3. Tag dictionary

Every content element carries `data-sg="<tag>"`. The tag is the contract between the content, `validate.py` and the engine. CSS classes are listed because the engine and stylesheet need them too; keep both.

| Tag | Element and class | Sits in | What it is and what goes in it | Length |
|---|---|---|---|---|
| `unit` | `<section class="unit" id data-num data-title [data-label]>` | `<main>` | "One page of the guide." id = unit id; data-num = the number the reader sees; data-title = the title; data-label overrides the unit word for this unit. | 3 to 8 sections, 15 to 20 minutes of reading |
| `unit-head` | `<div class="unit-head">` | unit | "The title block of the page." Holds the next three. | |
| `unit-kicker` | `<span class="kicker">` | unit-head | "The small uppercase line above the title": the unit word and number only, e.g. "Lecture 6" or "Chapter 3". Sources go in unit-scope. | 2 words |
| `unit-title` | `<h2>` | unit-head | "The page title", same text as data-title. | 2 to 8 words |
| `unit-scope` | `<p class="src">` | unit-head | "One sentence naming the source material this unit covers", plus anything moved to or from another unit. With section-sources, the only place sources are named; cite as `parsing.md` says (pages of the file the student has, or printed slide numbers when every slide prints one). | 1 sentence |
| `takeaway` | `<div class="takeaway">` with `<span class="lbl">Takeaway</span>` and one `<p data-sg="text">` | unit | "The whole unit in one paragraph": the core results with their key equations inline. A reader who reads only this knows the main facts. | 3 to 6 sentences |
| `section` | `<div class="sect" id>` | unit | "One numbered teaching step." Sections follow teaching order, which may differ from the slide order. | 3 to 10 paragraphs plus components |
| `section-title` | `<h3 data-short>` starting with `<span class="n">6.2</span>` | section | "The section heading." data-short is the label in the contents and on the Ask button. | title 3 to 9 words, data-short 1 to 4 |
| `section-sources` | `<p class="pp">` | section, right after the title | "Which source material this section covers", e.g. "Slides 7 to 12" or "Reading, pages 41 to 44; lecture of Oct 6". With unit-scope, the only place sources are named; same citation rule. | a short label |
| `subsection` | `<div class="subsec">` | section | "A named part of a long section." Use sparingly. | |
| `subsection-title` | `<h4>` | subsection | "The part's heading." Not numbered. | 2 to 7 words |
| `text` | `<p>` | section, subsection, takeaway, worked-example | "A paragraph of teaching prose." Inline math `\( \)`. Bold only for a term being defined. | 2 to 3 sentences (default style) |
| `equation` | `<div class="eq">` | section, subsection | "A named equation card": one display equation and, optionally, what each symbol means. A derivation is an equation card with an aligned block. | |
| `equation-name` | `<span class="eq-name">` | equation | "The equation's name", shown small and uppercase. | 1 to 5 words |
| `equation-math` | `<div class="eq-math">` | equation | "The display math", exactly one `\[ ... \]`. | each line under about 45 characters of math; split longer ones with aligned |
| `where` | `<dl class="where">` with `<dt>`symbol`<dd>`meaning | equation | "What each symbol means." Only symbols that need it. | a phrase per symbol |
| `figure` | `<figure class="fig">` with `<img src="img/..." alt loading="lazy">` | section, subsection | "A picture that teaches": a figure cropped from the source slides or readings. Never point to a figure; include it. | 2 to 6 per unit |
| `figure-caption` | `<figcaption>` | figure | "What to notice in the picture", not where it came from. | 1 to 2 sentences |
| `table` | `<div class="tbl">` wrapping a `<table>` | section, subsection | "A comparison, lookup or direction-of-effect summary." Numbers in `<td class="num">`. | at most 2 columns when cells hold long math; 3 or more only for short entries |
| `pitfall` | `<div class="pit">` starting `<b>Watch out.</b>` | section, subsection | "A trap, sign convention or common confusion", placed exactly where the idea is taught. | 1 to 3 sentences |
| `worked-example` | `<div class="wex">` with `<span class="lbl">Example</span>` | section, subsection | "A short solved example inside the teaching", not a practice question. | 2 to 5 sentences |
| `list` | `<ul>` | section, subsection | "Parallel short facts." Prefer prose. | 2 to 5 items |
| `steps` | `<ol class="steps">` | section, subsection | "An algorithm or procedure in order." | 3 to 6 items |
| `code-block` | `<pre class="code"><code>...</code></pre>` | section, subsection, question stem (in a `<div class="qt">`), model answer, solution | "Code the reader reads or traces": monospace, scrolls sideways inside the block only, prints wrapped. Never inside a `<p>`. Write `&lt;` for `<` and `&amp;` for `&` inside it (validate.py warns on a raw `<`). | lines under about 80 characters |
| `exam-tag` | `<span class="tag exam">` + config exam_hint_label | first thing inside a text paragraph | "The instructor said or signaled this will be tested." Needs evidence. | label only |
| `skip-tag` | `<span class="tag skip">` + config skip_label | first thing inside a text paragraph | "The instructor said this will not be tested." Keep that material to a sentence or two. | label only |
| `questions` | `<details class="questions" id="<unit>-q" open>` with `<summary>Questions <span class="questions-meta"></span></summary>` and `<div class="questions-body"><!--QUESTIONS--></div>` | unit, after the last section | "The unit's practice questions." The engine adds the "Questions" entry to the contents. Copy it verbatim and change only the id. | |
| `question` | `<div class="check" data-id data-type [data-ans] [data-tol] [data-suffix] [data-points] [data-from] [data-topic] [data-format] [data-lines]>` | questions file | "One practice question." See the attribute table below, section 4 for ids and section 7 for each type. | |
| `question-stem` | `<p class="qt">`, or `<div class="qt">` holding a `<p>` and a code-block when the stem shows code | question | "The question as it would appear on the exam", fully self-contained: every number, definition, passage, document or piece of code restated. | 1 to 4 sentences, plus any passage or code |
| `options` / `option` | `<ol class="opts">` / `<li data-k="a">` | question (mc, multi) | "The choices", keys a, b, c... in order. The reader sees A, B, C. | 3 to 5 options |
| `explanation` | `<div class="expl"><p>...</p></div>` | question | "Why the key is right", shown after a correct answer or Show answer. | 1 to 3 sentences |
| `solution` | `<div class="sol" data-for="<question id>">` | solutions file | "The pen-and-paper worked solution", hidden until Show answer. | under a minute to read |
| `solution-heading` | `<p class="sol-h">Worked solution</p>` | solution, first | "The heading of the worked solution." Keep the text as is. | fixed text |
| `solution-steps` | `<ol class="ws">` | solution | "The steps", each starting with a bold 1 to 4 word label. | 2 to 6 steps |
| `solution-answer` | `<p class="sol-a"><b>Answer:</b> ...</p>` | solution | "The final answer", exactly matching the key. | |
| `solution-why` | `<p class="sol-why">` | solution | "The transferable pattern or trap." Optional. | 1 sentence |
| `model-answer` | `<div class="model">` with `<p>`s (and code-blocks) | solution of a written item | "The answer a top student would write on the exam", at the real length and in the real form: paragraphs for an essay, the derivation for a proof, the code for a code question. It is the key. | the real answer's length |
| `rubric` | `<ul class="rubric">` with `<li data-marks="1">` | solution of a written item, after the model answer | "What a grader looks for": 2 to 5 points, each one thing (the claim, the key idea, a piece of evidence, the correct value), with what it is worth. The marks add up to the question's `data-points`. The engine shows "1 mark" before each point. | 2 to 5 points, a line each |
| `confidence` | `<div class="conf" data-sec="<unit id>">` with one `<p>` | unit, last | "The Shaky / OK / Solid rating." The engine draws the buttons. | 1 sentence |
| `exam` | `<section class="exam-page" id="exam" data-title>` | `<main>`, after the units | "The practice exam page." Its time target is `practice_minutes` in the settings, not an attribute. In an exam-only guide it is the only content page. | |
| `exam-head` | `<div class="exam-head">` | exam | "Kicker, title and instructions." | |
| `exam-instructions` | `<p>` | exam-head | "Format, number of questions, conditions, what share of the real exam it covers when that is not all of it, and that nothing is graded until Submit." | 2 to 4 sentences |
| `exam-bar` | `<div class="exam-bar">` (empty) | exam | "Timer and answered count", drawn by the engine. | |
| `exam-body` | `<div class="exam-body" id="exam-q">` | exam | "Where the exam questions go." Holds the marker, then exam-submit. | |
| `exam-submit` | `<div class="exam-submit">` (empty) | exam-body, last | "Submit, score and Retake", drawn by the engine. | |

Question attributes:

| Attribute | On | Values | What it does |
|---|---|---|---|
| `data-type` | every question | `mc`, `multi`, `tf`, `num`, `written` | The kind of question. `written` is answered in the reader's own words or code and self-marked (section 7). |
| `data-ans` | mc, multi, tf, num | the key | Never on `written` (its key is the model answer and rubric). |
| `data-tol`, `data-suffix` | num | a tolerance; a unit word | As before. |
| `data-format` | written, optional | `code` | A monospace code box that does not wrap. No other value; leave it out for prose. |
| `data-lines` | written, optional | 1 to 40 | Height of the box in lines (default 4, code 6); it grows as the reader types. |
| `data-points` | any, optional | a positive number (default 1) | What the question is worth. The exam score is in points; copy the real exam's values. |
| `data-from` | exam questions | a unit id | The unit it tests: "From Lecture 2" after Submit and the row of the score breakdown. |
| `data-topic` | exam questions, optional | a short topic name, 2 to 5 words | The breakdown row when there is no `data-from` (required in practice in an exam-only guide). |

Saved state of a written item: `rec.last` (the text), `rec.mark` (`full`, `part` or `none`, credit 1, 0.5 and 0), `rec.firstMark`, and `rec.firstCorrect`, true only when the first attempt is marked Full marks (the mark can be corrected until Try again). Unsent practice text stays in the browser (`<storage_key>-wdraft`). Claude's feedback is saved like walkthroughs: db collection `feedback`, else `<storage_key>-feedback`.

Tags on the shared pages (in `top.html` and `bottom.html`, filled by build.py): `header`, `header-kicker`, `guide-title`, `meter`, `theme-switch`, `save-status`, `contents`, `start-page`, `scope-line`, `unit-cards`, `print-cover` (the PDF cover with the contents, generated by build.py), `summary-page`.

Classes inside tagged elements that have no tag of their own (keep them exactly as in the template):

| Class or element | Inside | What it is |
|---|---|---|
| `<span class="n">` | section-title | the section number, e.g. 6.2 |
| `<span class="lbl">` | takeaway, worked-example | the fixed label ("Takeaway", "Example") |
| `<td class="num">` | table | a numeric or math cell, right-aligned |
| `<dt>`, `<dd>` | where | a symbol and its meaning |
| `<summary>`, `.questions-meta`, `.questions-body` | questions | the "Questions" heading, the count the engine writes, and the body that receives the questions file |
| `<span class="kicker">` | exam-head | the small line above the exam title |

## 4. Ids and numbering

| Thing | Id pattern | Example |
|---|---|---|
| Unit | letters, digits, hyphens; starts with a letter; no dots or underscores | `L6`, `u3`, `ch2` |
| Section | `<unit>-<n>`, n = 1, 2, 3 in order | `L6-2` |
| Questions block | `<unit>-q` | `L6-q` |
| Unit question | `<unit>_q<n>` | `L6_q4` |
| Exam page / body | `exam` / `exam-q` | |
| Exam question | `exam_q<n>`, plus `data-from="<unit>"` and/or `data-topic="<topic>"` | `exam_q7` |
| Solution | `data-for` = the question id | `data-for="L6_q4"` |

Numbers the reader sees: section `<span class="n">` = `<data-num>.<n>` (for example 6.2). Questions are numbered by the engine as `<data-num>.<n>` in their order (6.1, 6.2...), exam questions 1, 2, 3. Links: `<a href="#L6-2">6.2</a>` for a section, `<a href="#L9">Lecture 9</a>` for a unit.

## 5. Settings (`guide.config.json`)

| Key | Used for |
|---|---|
| `guide_title` | page title, artifact name, header (2 to 6 words) |
| `header_kicker` | small line above the title: course, exam, date |
| `course`, `course_full`, `subject` | header and the tutor prompts for Ask and Solve it for me |
| `exam_name`, `exam_format`, `exam_conditions`, `calculator` | tutor prompts and the start page |
| `exam_minutes` | the real exam's length, for reference and for sizing the practice exam |
| `practice_minutes` | the practice exam's time target (the only place it is set): the real length, or the guide's share of it |
| `unit_label`, `unit_label_plural` | the word for a unit everywhere (Lecture, Chapter, Topic) |
| `scope_line` | start-page kicker |
| `student_name` | optional name the tutor uses (asked at intake); prompts say "the student" when empty |
| `storage_key` | unique per guide; prefix of every browser storage key |
| `exam_hint_label`, `skip_label` | tag labels |
| `style.no_em_dashes`, `style.tone`, `style.paragraph_sentences`, `style.simplify_technical`, `style.prompt_extra` | writing defaults; `no_em_dashes` is enforced by validate.py and passed to the tutor prompts |

## 6. Engine files: never edit them per guide

`js/core.js` (questions, grading, exam, progress, saving), `js/pages.js` (one page at a time, contents, cards, pager, lazy math), `js/ask.js` (Ask and Solve it for me), `js/theme.js`, `js/eval.js` (exact-answer evaluator), `js/mathfield.js` and `mathfield-fonts.html` (math answer box), `js/mathjax-config.js`, and the three CSS files. They read everything guide-specific from the tags and the settings. If a guide needs a visual tweak, put it in `<guide>/extra.css`.

What the engine does by itself: numbers questions; draws options, True/False, the math answer box, and the text or code box of written items (with "Compare with the model answer", the model answer and rubric, the Full marks / Partly / Missed it self-mark, and Get feedback when Claude is available); Check tells only right or wrong; Show answer reveals the key, the explanation and the worked solution; Solve it for me asks Claude for a walkthrough (counts as wrong); saves progress (Claude storage when published with the `db` capability, otherwise the browser); builds the contents with one Questions entry per unit; shows one unit per page with Previous and Next; the Ask button; the practice exam flow (score in points, written answers marked after Submit, breakdown by unit or topic, weakest first); the summary; Light and Dark.

## 7. Copy-paste snippets

Unit questions, one per type (the full commented versions are in `assets/template/questions.html`):

```html
<div class="check" data-sg="question" data-id="L6_q1" data-type="mc" data-ans="b">
  <p class="qt" data-sg="question-stem">Self-contained question?</p>
  <ol class="opts" data-sg="options">
    <li data-sg="option" data-k="a">Plausible mistake</li>
    <li data-sg="option" data-k="b">Right answer</li>
    <li data-sg="option" data-k="c">Plausible mistake</li>
  </ol>
  <div class="expl" data-sg="explanation"><p>Why b is right.</p></div>
</div>
<div class="check" data-sg="question" data-id="L6_q2" data-type="multi" data-ans="a,c"> ...options... </div>
<div class="check" data-sg="question" data-id="L6_q3" data-type="tf" data-ans="F">
  <p class="qt" data-sg="question-stem">A statement to judge.</p>
  <div class="expl" data-sg="explanation"><p>False, because ...</p></div>
</div>
<div class="check" data-sg="question" data-id="L6_q4" data-type="num" data-ans="0.36788" data-tol="0.002" data-suffix="hours">
  <p class="qt" data-sg="question-stem">Question with a numeric answer. An exact answer is fine.</p>
  <div class="expl" data-sg="explanation"><p>Short reason.</p></div>
</div>
```

A written short answer, a written code question in the exam, and their solutions:

```html
<div class="check" data-sg="question" data-id="L6_q5" data-type="written" data-lines="4">
  <p class="qt" data-sg="question-stem">In two or three sentences, explain why ... ?</p>
</div>
<div class="check" data-sg="question" data-id="exam_q9" data-type="written" data-format="code" data-lines="8" data-from="L6" data-topic="Recursion" data-points="4">
  <div class="qt" data-sg="question-stem">
    <p>Complete this function so that it returns ...</p>
    <pre class="code" data-sg="code-block"><code>def f(n):
    ...</code></pre>
  </div>
</div>

<div class="sol" data-sg="solution" data-for="L6_q5">
  <div class="model" data-sg="model-answer"><p>The answer a top student would write.</p></div>
  <ul class="rubric" data-sg="rubric">
    <li data-marks="1">The main claim.</li>
    <li data-marks="1">The reason or evidence that supports it.</li>
  </ul>
</div>
```

A written item's solution needs a model answer and at least 2 rubric points; the "Worked solution" heading (the engine shows "Model answer" when there is none), steps, answer line and explanation are optional. A code block in teaching text sits between paragraphs:

```html
<pre class="code" data-sg="code-block"><code>if 0 &lt; x &lt;= 1:
    return math.log(1 / x)</code></pre>
```

Numeric keys (`data-ans` on `num` questions): exact when the value terminates (0.125, 24), otherwise at least 5 significant digits (0.36788). True/false keys are "T" or "F"; the one-line justification goes in the explanation and the worked solution.

A figure, an equation with a derivation, a pitfall, a renamed-symbol note, a corrected-source note and the two tags are shown in place in `assets/template/unit.html`. A finished two-unit guide with an exam is in `assets/example/` (unit 1 and the exam come straight from the template files).

## 8. Markup rules that prevent rendering bugs

- Inside any math in HTML, write `&amp;` for `&` (aligned, cases, pmatrix) and `\lt`, `\gt` for `<`, `>`. A raw `<` is read as a tag and silently eats the rest of the line.
- Inline math `\( \)`, display math `\[ \]` only. No `$...$`.
- Split long display equations with `\begin{aligned} ... \\ ... \end{aligned}` so each line fits a phone screen (under about 45 characters of math per line). Keep tables whose cells hold long math to 2 columns. test_guide.js warns about anything that still overflows at phone width.
- Images: put files in `<guide>/img/`, reference them as `img/<name>.png`, keep `loading="lazy"`. build.py adds width and height; without them, contents links land in the wrong place while images load.
- No `<style>` or `<script>` in content files. No em dashes when `style.no_em_dashes` is true (the default).
- Keep `<!--QUESTIONS-->` exactly once per unit file and per exam file.
- Code goes in a code-block, never in a `<p>` (a `<p>` cannot hold a `<pre>`: the browser ends the paragraph and the block lands outside it). Inside it write `&lt;` and `&amp;`; MathJax does not touch it, so `\(` in code is safe. Inline code in prose is `<code>`.

## 9. Exam-only guide

A guide can be only a practice exam (what the make-practice-exam skill produces): no unit pages, just the start page, the exam and the summary. Declare it in `outline.json`:

```json
{
  "exam_only": true,
  "units": [],
  "exam": { "file": "exam/exam.html", "questions": "exam/exam.questions.html", "solutions": "exam/exam.solutions.html" },
  "sources": [ { "path": "slides/week3.pdf", "kind": "slides", "units": [], "use": "exam", "note": "the lectures the exam covers" } ]
}
```

- `units` stays empty (validate.py errors otherwise) and `exam` is required. Sources map to no unit: use `"use": "exam"` for material the questions are written from, `exam-intel` or `excluded` as usual.
- Exam questions carry `data-topic` (validate.py warns without it) and no `data-from` (an error: there are no units). The score breakdown groups by topic, weakest first.
- `unit_label` may be empty in `guide.config.json`; everything else is the same (`practice_minutes` sets the timer).
- build.py keeps the `IF_EXAM_ONLY` blocks of `top.html` and `bottom.html` and drops the `IF_UNITS` blocks: the start page explains the exam and shows one card, the summary has no unit table, the header meter follows the exam, and the page opens on the exam itself.
- `assets/example-exam-only/` is a finished one; build and test it as `build-and-publish.md` says.
