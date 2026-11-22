# Writing a section

Write from the course pack's notes, the plan and the coverage map. One section file at a time (or one helper per section, each given the plan, the overlap map, `course/exam-format.md`, `course/off-limits.md` and this file). The comparisons section comes last, written from the finished sections.

## The shape of every topic

1. `\cstopic{n.m}{Title}{pointers}`: the pointers name where the topic lives in the student's material, in the pages they will have ("L13 pp.16--20; reading ch.3"; add "wiki 1.4" when there is a wiki).
2. `\takeaway{...}`: **what the topic covers, then its implications**: what follows from it, when it applies, where it is used, how it connects. Three to five sentences, plain words, no jargon the topic has not defined yet. Not a teaser and not a dense summary: a student who reads only the takeaways should know the main facts and why they matter.
3. The content, one block per method or result, in teaching order. Before each box, a one or two sentence **lead-in** saying what the box is for and when to use it. A box never appears cold.
4. A `changetable` or a comparison `tablebox` when the topic has knobs, choices or alternatives.
5. A `tfbox` with 2 to 5 checks at the end: the traps a true-or-false or select-all question would set, each with the reason in a few words. True-or-false facts live inside their topic; there is no separate bank.

## Components, and how to write each

**Key box with an equation** (`keybox` + `\keyeq` + `symbols` + `\means` + `\nuance`).
- Final equations only: no derivations, no intermediate algebra unless a step is itself asked.
- One formula per line, stacked fractions (`\frac`), generous spacing (`\\[4pt]` between lines).
- The note on the left (`\keyeq[...]`) says in plain words what each line shows: "Line 1: the number left after time t. Line 2: ...". This is the part students rely on most; never leave it out.
- `symbols`: every symbol in the box, with units, in the order they appear. Group symbols that come in pairs ("\(N(t)\); \(N_0\)").
- `\means`: one sentence the student could say out loud. `\nuance`: the condition, exception or confusion.
- A multi-variable equation gets a worked example or a diagram showing which variable is which.

**Key box with definitions** (`\defn`): term, then a definition precise enough to decide a true-or-false question. Add the contrast when two terms are confused.

**Fact card** (`factcard`): for anything identified by its features: a work of art or music, a building, a specimen, a person, an event, a court case, a treaty, a text. Labels depend on the subject:
- works: Artist or composer, date; Medium; Where; Recognize by; Significance;
- events: When; Who; Cause; What happened; Consequence; Significance;
- cases: Facts; Question; Holding; Rule; Why it matters;
- passages: Text and author; Speaker and context; What it shows; Devices;
- people: Dates; Known for; Key works or ideas; Connected to.
"Recognize by" and "Significance" are what identification questions grade; never skip them. An image goes in only if the student may face the image on the exam, and it must be from the course material or drawn for the sheet.

**Change table** (`changetable`): rows of "what you change", "what happens", "why". One row per knob or choice the course discusses; when the topic has several methods, start each row with the method's name. The "why" column is a few words, not a sentence. Headings adapt to the subject: `[If the facts change][Fact][Outcome][Rule]` for law, `[If this changes][Change][Effect on the market][Why]` for economics, `[Variations][Change][Effect][Why]` for an algorithm.

**Table box** (`tablebox`): comparisons (methods, works, periods, organisms side by side), timelines, lookup tables (output layer and loss by task; conjugation tables; enzyme by substrate). Columns are short; prefer three or four columns; math in cells stays short.

**Worked example** (`worked` + `\sidebyside`): for anything students must compute or apply step by step.
- The rule students asked for: **the original formula first, then each part plugged in with a label saying what it is, then the number**. Not a column of numbers.
- One running example that is hard enough to extend to any question of its kind, rather than several easy ones.
- A diagram on the left and the computation on the right when the setup has structure (a tree, a network, a circuit, a timeline). Keep the diagram compact.
- End with the answer and, if useful, a five-step recipe for this kind of question.

**Example line** (`\example{...}`): a one-line use of the box just above, with real numbers or a real case.

**Trap box** (`trap`): a common mistake or a question pattern, with a bold title ("Select-all on layer shapes", "Dates one decade off", "Which clock starts when"). Use it for instructor-flagged traps and for patterns from the student's past mistakes (`course/weak-spots.md`).

**Code** (`codeblock`): short, runnable code the exam reads or writes; the key lines only. Follow it with a box saying what it computes, its complexity and when to use it, and a change table for its parameters.

**Figures** (`\sheetfig`): a figure cropped from the sources when it is the thing students must recognize or read (a plot, an artwork, a map, a structure). Caption: what to notice, not where it came from. Original diagrams: `diagrams.md`.

## By kind of course

The components are the same everywhere; what fills them differs.
- **Math, physics, engineering, statistics**: key boxes with equations dominate; worked examples for every procedure; change tables for parameters; traps for sign conventions and conditions of theorems.
- **Computer science**: key boxes for complexity and invariants, code blocks for algorithms, worked traces (input, each step, output), comparison tables of data structures or models.
- **Natural sciences**: definitions, process diagrams (steps in order), tables comparing structures or reactions, figures to label, graph-reading rules.
- **Economics and social sciences**: definitions with contrasts, change tables for shifts ("if supply falls"), graph sketches, short model summaries, key studies as fact cards (who, method, finding, limitation).
- **History**: timelines in table boxes, fact cards for events and people, cause and consequence tables, comparison tables across periods or places, "significance" in every card.
- **Literature and philosophy**: fact cards for works and passages, tables of themes by work, definitions of terms and devices, argument outlines (claim, reasons, objection, reply).
- **Art and music history**: fact cards with images for every work likely to be shown, "recognize by" clues, comparison tables of styles and periods.
- **Languages**: conjugation and declension tables, grammar rules with one example each, vocabulary grouped by theme, common false friends as traps.
- **Law, business, medicine**: case fact cards, rule statements with elements, issue-spotting checklists as tables, decision tables.

## Style

- Formal, concise and direct. Paragraphs of 2 to 3 sentences. No em dashes. No filler ("It is important to note that").
- Explain simply: intuition first, then the formula or fact.
- No quotes from the instructor and no provenance in the text ("as shown in lecture 4"); sources go in the topic pointer only.
- Notation: one symbol per meaning across the whole sheet, even when the sources reuse a symbol. Where the sheet renames something the slides call differently, say so once in that topic.
- Do not explain what the student said they already know, and do not add material nobody will be asked about.

## Before handing a section to the audit

- `scripts/build.py <sheet> --only <id> --render` builds with no errors; fix every warning or know why it stays.
- View every page of the section: nothing cramped, no box running into the margin, no page more than a third empty, diagrams readable at print size.
- Every topic has a takeaway, every box a lead-in, every equation its symbols, every topic its checks.
- The coverage map's entries for this section are filled.
