# Phase 4: find the patterns, then write the explanations and lessons

The grade says what was missed; this phase says why, and what to do about it. It is the part the student cannot get from an answer key.

## 1. Find the gap patterns

For every miss, partial and guessed answer, write in one line what went wrong in the student's thinking, then group the lines:
- **Habits** (`habits`): mistakes of method that would recur on a different question. Name them as habits, in plain words, not as topics. Good: "Incomplete select-all answers", "Did not use the definition the question gave", "Dates a decade or two late", "Thesis without evidence", "Off-by-one in loop traces", "Sign lost when moving a term", "Answered a different question than asked", "Units dropped". Bad: "Unit 3", "Perspective".
- **Units** (`units`): the topics the questions belong to, for the per-unit breakdown. Use the course pack's unit names when there is one.
- **Guessed versus solid.** A right answer the student guessed is not knowledge. Keep these visible: they count in the unsure filter and the weak spots.

Use the student's notes as evidence ("copied the formula without understanding" is a habit). Do not invent a pattern from one item when a plain one-off explanation is more honest; a miss can have no habit (the build warns, so decide deliberately). Usually 3 to 7 habits for a full exam.

## 2. The explanation on every card

`explanation`, on every question, right ones included: two or three sentences of the correct reasoning, saying why the key is right and, for a miss, why the student's answer is not. Name the principle, apply it, dismiss the tempting wrong option in a clause.

## 3. The walkthrough on every miss

Required when the verdict is not right, and for every guessed answer. Shape: `think` (how to think about this kind of question, 1 to 3 sentences), `steps` (2 to 6 steps), `answer` (exactly as the exam wants it), `trap` (the specific pull that led the student, or a typical student, astray). Fit it to the question type:

| Type | Steps look like |
|---|---|
| Computation (math, science, economics, accounting) | givens in notation; the formula with every symbol defined; substitute; simplify exactly with \frac; approximate at the end; a size or units check |
| Code tracing or writing | a trace table of the variables per iteration, or the invariant; the edge case (empty input, first and last index); the corrected line in a code block |
| Conceptual multiple choice or select-all | the principle that settles it; each option judged in a clause; why the tempting one fails |
| True/false with justification | the claim restated precisely; the fact or counterexample that settles it; the one-sentence justification |
| Identification (work, term, specimen, passage) | the clues to look for (style, medium, subject, date range, wording); how each clue points to the answer; the significance a full answer adds |
| Essay or short answer | what the prompt actually asks; a plan (thesis, evidence with specific features, analysis, counter-point); one rewritten sentence that shows the difference |
| Case or scenario analysis | the issues a full answer spots; the rule for each; its application to these facts; the conclusion |

## 4. The lessons

5 to 16 short lessons (`lessons`), ordered by points lost, costliest habit first, then guessed answers. One lesson per habit, sometimes two for a big habit (one for the idea, one for exam technique such as essay planning). Each lesson:
- `idea`: the concept in 2 to 4 sentences, simply, every symbol defined.
- `how`: how to think about this kind of question; a procedure the student can run under time pressure.
- `example`: one worked example, **new**: not a copy or a close variant of an exam question (same scenario, same numbers, same answer path), unless the exam is open and the student wants practice on it. build_review.py flags examples that read like an exam question, and refuses them when `exam_mode` is blind.
- `trap`: the mistake to watch for, in one or two sentences.
- `habits` and `questions`: what it targets, which links the lesson and the cards both ways.

Then `fixes`: 3 to 8 one-sentence habits that fix most of the misses, in imperative form ("Mark every select-all option T or F before you choose").

## 5. Style for every string

Formal, concise and direct. Paragraphs of 2 to 3 sentences. No em dashes (build_review.py refuses them). Math in `\( \)` and `\[ \]`, fractions with `\frac`, every symbol defined where it first appears. Keep inline formulas short: split a long chain into two formulas, because inline math cannot wrap on a phone. Code in fenced blocks or `code` objects. Quote the student's own words only in `student_note` and the transcript; elsewhere describe their answer neutrally ("the answer names two episodes"). Be honest and kind: name the gap plainly, never mock it.
