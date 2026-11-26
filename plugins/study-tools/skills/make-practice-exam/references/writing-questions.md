# Writing the questions

Write a bank larger than the exam (about 1.5 to 2 questions per slot), verify it (`verification.md`), then choose the final set. The extra questions are what let you drop anything ambiguous without weakening the exam.

Write from the course pack's notes, never from memory of the subject: every question must be answerable from what the course taught, in the course's notation and terms.

## Every question

- **Self-contained stem.** Restate every number, definition, setup, passage, document or image the question needs, as the real exam would. Never "as in lecture", "from the example above".
- **One unambiguous answer.** For multiple choice, exactly one option is right under any reasonable reading. For select-all, each option is clearly right or clearly wrong on its own. For numeric answers, the stem fixes units and rounding.
- **Distractors are real mistakes**, specific to the subject: a sign or direction error, the inverse relation, a formula for the wrong case, a neighbouring date, the right artist with the wrong work, a rule from a similar case, an off-by-one trace, the right claim with the wrong reason. Never filler; never "all of the above" unless the real exam uses it.
- **Matches its slot**: type, points, demand, number of steps, unit.
- **Matches the real exam's voice**: stem length, wording habits, use of scenarios and data.
- **Blind and off-limits files**: never mirror a blind item (its scenario, its numbers, its answer path) and never open an off-limits file (`exam-format.md` section 4). Lecture facts may and should be tested even when a blind item also tests them.

## By type

Use the catalog in `exam-format.md` section 6 to pick the page type. Specifics:

- **Multiple choice and select-all**: 4 or 5 options (match the real exam). Vary the key's position: across the exam, keys spread evenly over the letters, with no long runs. For select-all, vary how many options are right (2 to 4), and state the credit rule in the instructions if the real exam is all-or-nothing.
- **True or false**: balance true and false across the exam (roughly half each, not alternating). The falsehood sits in one checkable place: a quantifier, a direction, a condition, a date. When the real exam wants a justification, follow the true-or-false item with a written item for the justification (1 to 2 points), or make the whole item written.
- **Numeric**: values chosen so the work by hand is realistic in the time and the answer is clean or clearly approximable. Store the key exactly or to 5 significant digits with a sensible tolerance (see the study-guide markup rules).
- **Written** (short answer, essay, proof, derivation, code, identification, passage, document, case analysis, translation):
  - the prompt as the real exam words it, with its length or time guidance ("in 3 to 5 sentences", "about 20 minutes");
  - a **model answer** written the way a top student would write it in the exam, at the real length;
  - a **rubric** of 2 to 5 points, each with its marks, that a student can apply to their own answer: "states a thesis that takes a position (2)", "uses two specific pieces of evidence from the documents (2)", "the loop invariant is stated and maintained (2)";
  - for code: the model solution plus what any correct solution must do (inputs, outputs, edge cases, complexity), since many correct programs exist;
  - for proofs: the key idea and the steps that must appear, since many correct proofs exist;
  - for identification: the image or excerpt in the stem (from the course material, or drawn), and marks for each element (name, maker, date, significance).
- **Multi-part problems**: one item per part, each self-contained enough to answer if the previous part went wrong (give the needed result: "Using \(k = 3\), ...").

## Solutions

Every item gets a worked solution the student sees after submitting, written as they would solve it under exam conditions: for computations, the givens, the principle, the steps by hand and the answer; for option questions, the principle that settles it and why each tempting option fails; for written items, the model answer and rubric (which are the solution), plus one line on the most common way to lose marks.

## Markup

The exam is a study-guide exam page. Its markup (question types, keys, tolerances, written items, model answers, rubrics, points, topics) is documented in the study-guide skill's `assets/template/exam.questions.html` and `exam.solutions.html` header comments and its `references/template-reference.md`. Read those before writing the files; they are the source of truth for tags.
