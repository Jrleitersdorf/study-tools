# Planning the sheet

The plan decides the sheet's quality more than the writing does. Write it in `work/plan.md`, show the student the short version, and build only after they confirm.

## 1. Layout and budget from the exam's rules

| What may be brought in | Layout | Budget |
|---|---|---|
| Any printed material (open book) | standard | about 6 pages per lecture-week of material; agree a total |
| Nothing (sheet is for studying) | standard | about half of the open-book budget |
| One or two pages, one sheet both sides | dense, 3 columns (landscape) or 2 (portrait), at the allowed paper size | exactly the allowed pages |
| An index card | dense, 2 columns, at the card's size (set the paper in `sheet.json` and say what size to print) | one or two sides |
| A laptop | standard, plus offer the study-guide skill for searching | as open book |

Set `layout`, `paper`, `landscape`, `dense_columns` and `page_budget` in `sheet.json`. A budget is a ceiling, not a target: a shorter sheet that has everything is better.

Dense sheets keep the same components but cut prose: takeaways become one line or go, key boxes keep the equations or facts and one-line meanings, tables carry most of the content, examples are one line, and figures appear only when they replace text.

## 2. Organization

Default: **by concept**. Sections are the course's major concepts (for example "Neural networks", "Training", "Convolutional networks"; or "The Reformation", "Wars of religion", "State building"; or "Sorting", "Graphs", "Dynamic programming"), and the final section is **Across topics: comparisons**, which holds the questions that need two units at once.

Use **by lecture or chapter** when the student asks, or when the course is strictly sequential and the exam follows lecture order. Ask in the plan confirmation; do not decide silently. Students who must find things in seconds under time pressure sometimes find the lecture order easier, because it matches their notes.

Either way:
- **Teach each idea once.** Write an overlap map: every idea that appears in more than one lecture gets one home topic; other places recall it in a clause with a pointer ("see 2.4"). Shared machinery gets its own section (for example "Training: the shared machinery"), and each later section gets a short "what changes here" topic that compares against it.
- **Number sections and topics** (6.1, 6.2), never letters. A topic is 3 to 8 words, and should fit on one page; split a topic that does not into two topics with distinct titles.
- **Inside a topic, one block per method or result**, in teaching order. When a topic covers several methods, each gets its own visually distinct box, and a change table names which method each row concerns.

## 3. What to keep and what to cut

Start from the exam profile and the question bank, then the notes.
1. **Weight toward what is asked.** For every question type in the profile, the sheet must hold what answering it needs: the formula and how to use it, the definition with its trap, the identifying features of a work, the steps of a procedure. Put the weight where the profile puts the points.
2. **Do not overfit.** Other questions will appear. Every unit in scope keeps its core results even if no practice question touches it; list those in the coverage map as "not in the bank".
3. **Cut**: history and motivation that no question uses, derivations (keep final equations only, unless the exam asks for derivations or proofs), repeated material, examples that teach nothing new, and anything the exam provides (a formula sheet, tables).
4. **Keep and expand**: the student's weak spots (more explanation, a worked example, a trap box), instructor signals, conventions that differ between sources, and anything a question has to compute by hand in the time allowed.
5. **Respect the exam's conditions.** No calculator: keep forms that can be evaluated by hand. Timed: favor recipes and decision tables over long explanations.

## 4. The coverage map

`work/coverage.md` has two tables:
- every question in the bank, the topic and box that answers it, and whether a student could answer it from the sheet alone;
- every unit and its key results, and the topic that holds each.

Gaps in either table are fixed before writing ends. The findability test in `audits.md` uses the first table.

## 5. The plan the student sees

Keep it short: the layout and budget; the sections with their topics, each topic with the boxes it will get in a few words; what is deliberately left out; and two questions: "By concept or by lecture?" (if not settled) and "Anything to add or drop?". Wait for the answer, unless the student is away (then proceed and state the choices in one line).

## 6. The optional wiki

The wiki is the long companion: the same sections and topic numbers, the same explainers and diagrams, with fuller explanations, all examples and the extra figures the sheet cut. It is for reading and lookup when the sheet is too short. Build it from the same notes with `"kind": "wiki"` and a title ending in "Wiki" in its own sheet folder, a page budget about 1.5 times the sheet's, and pointers from each sheet topic to its wiki topic in the topic's source pointer ("L13 pp.16--20; wiki 1.4"). Offer it at delivery; build it only if the student wants it.
