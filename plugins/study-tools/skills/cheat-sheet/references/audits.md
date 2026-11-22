# Audits

Three audits run in order before the student sees a full draft. Each is done by someone who did not write the section: a helper agent when available (give it the section file, the rendered pages, the notes and the sources), otherwise a separate pass by you that starts from the sources, not from memory of writing. Write each report to `work/audits/<audit>-<section>.md` and fix everything before the next audit.

## 1. Content and diagrams

For every topic:
- **Facts**: every equation re-derived or checked against the sources; every number in examples and worked examples recomputed; every true-or-false verdict checked, including the reason; every date, name, attribution and definition checked against the sources.
- **Symbols and terms**: every symbol in a box is in its symbols table; every term is defined before use or where used; one meaning per symbol across the sheet.
- **Diagrams**: every diagram checked like an equation: axes, values, labels, arrows, which part is which, and that its notation matches the boxes.
- **Coverage**: every question in the bank that this section should answer is answerable from it (`work/coverage.md`); every key result of its units is present.
- **Cuts**: anything no question could use and that the student did not ask for; repeats of an idea taught elsewhere (replace with a pointer); derivations the exam does not ask for.
- **Blind material**: nothing tailored to a blind exam's specific questions; nothing from an off-limits file.
- **Uncertain items**: anything the auditor cannot confirm is kept and flagged to the student at delivery, never silently dropped.

## 2. Format

Build the section (`scripts/build.py <sheet> --only <id> --render`) and look at every page image:
- no topic split across pages unless agreed; no page more than a third empty (the build lists them; fix by trimming, merging, or moving a box);
- nothing cramped: equations have room, tables are not squeezed, boxes do not touch;
- no line running into the margin (the build lists overfull lines);
- diagrams sized to be read and not to dominate; figures sharp;
- the contents' grey sublines list the boxes a student would look for, and nothing trivial (star small boxes);
- headers and tabs right on every page.

## 3. Findability

Once the whole sheet builds: a helper who has not seen the sheet being written gets only the PDF (page images and its text) and the question bank, and for each question records the page and box where the answer is, and how long it took to find it. Any question whose answer cannot be found, or takes more than about 20 seconds, is a defect: move the fact to where a student would look, add it to a box title, or add a pointer. Run it on blind items' structure, never on the blind items themselves.

## 4. Design pass

A last look at the whole PDF as the student will print it: consistent spacing, consistent box use for the same kind of content, takeaways neither thin nor dense, no orphan headings, the contents page fits and reads well, the page count within the budget.
