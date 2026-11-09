# Phases 5, 6 and 7: exam intelligence, practice questions, worked solutions, the practice exam

Phase 5 writes the exam intelligence. In phase 6 each unit gets its questions and solutions right after its text. Phase 7 writes the practice exam once every unit exists.

## Phase 5: exam intelligence (`work/exam_intel.md`)

Compile, with the source named on every line:
1. **Logistics and scope**: date, length, format, book and calculator rules, what is covered (from the syllabus, announcements, transcripts, the user).
2. **Signals**: everything the instructor said will be tested ("that will be a quiz question", "remember this formula") and will not be ("I won't ask you to derive it"). Quote them here; the guide itself never quotes.
3. **Style of past and practice exams**: question types and their mix, how many parts, how numbers are used, what counts as a full answer (for example, true/false with a one-line justification), difficulty, recurring topics. If a real past exam and its practice version both exist, note how the real one differed (often: definitions turned into computations, more parts, finer details).
4. **Weighting**: which units and topics carry the most weight, combining the signals, the practice exams and the user's own priorities from intake.

This file drives the exam tags in the units, the question mix, and the practice exam.

## Practice questions for each unit

Write `units/<unit>.questions.html` from `assets/template/questions.html` (markup and attribute rules are in its header comment and in `template-reference.md`).

**How many.** 6 to 15 per unit; toward the upper end for heavily weighted units and whenever practice exams were supplied (lean on them: they are the best evidence of what will be asked).

**Mix.** Mirror the real exam's types. Multiple choice (`mc`) and select-all (`multi`) for concepts and comparisons, true/false (`tf`) for crisp claims and traps, numeric (`num`) for anything computed. A computation the exam would ask as multiple choice can still be numeric here: typing the number teaches more.

**Each question.**
- The stem is fully self-contained: restate every number, definition and setup as the exam would. Never "as above", "from the slides", "in the example".
- One unambiguous key. Distractors are real mistakes a student makes (sign error, the inverse relation, the right formula with the wrong quantity), never filler, never "all of the above".
- Numeric keys as a decimal: exact when the value terminates (0.125, 24), otherwise at least 5 significant digits (0.36788 for e^-1, not 0.37 or 0.3679), with a tolerance that fits the scale. validate.py warns on keys that look rounded. Exact forms typed by the reader (3/4, e^-1, sqrt(2)/2) are evaluated automatically.
- True/false: the engine offers only True and False, so the one-line justification the exam expects goes in the explanation and as the last step of the worked solution.
- Every question must be answerable from the guide text. If it is not, add the missing fact (not the answer) to the unit.
- **Practice exams the user will take.** Write new questions in its style. Do not mirror its items (the same scenario or the same answer path with new numbers), do not reuse its numbers or worked examples, and never discuss its questions. Lecture facts stay in the unit text even when one of them also answers a practice question; that is teaching, not leaking.

**Accuracy is the priority.** A wrong key is worse than a missing question. For every question, solve it from scratch before writing the key, then check the key against the unit text. For multiple choice and select-all, check every option independently: confirm each wrong option is actually wrong, not merely less right.

## Worked solutions

Write `units/<unit>.solutions.html` from `assets/template/solutions.html`: one block per question, in the same order. The reader sees it after Show answer. Write it the way they would solve it with pen and paper (and no calculator unless the config says one is allowed):

- **Numeric**: 3 to 6 steps. Pull the givens out of the question in notation, write the formula, substitute, simplify exactly (fractions, e, roots), and only at the end approximate with values a person knows (e^-1 is about 0.368, ln 2 about 0.693, sqrt 2 about 1.414). A small table or grid is welcome when it helps.
- **Multiple choice, select-all, true/false**: 2 to 5 steps of decisive reasoning: name the principle that settles it, apply it, dismiss the tempting wrong options in a clause each. For true/false, the last step is the one-line justification the exam expects.
- `sol-a` states the answer exactly as keyed: "(b) Bias up, variance down", "True", "\(1/12\approx0.083\)". `sol-why` (optional) is one sentence of transferable intuition or the trap.
- Each solution takes under a minute to read. Recompute every number. validate.py checks that each answer line agrees with its key.

## The practice exam (`exam/`)

Build it after all units are written and audited, from `assets/template/exam.html`, `exam.questions.html` and `exam.solutions.html`. Add `"exam"` to `outline.json` (file, questions, solutions). Its time target is `practice_minutes` in `guide.config.json`, the only place it is set.

- **Size.** When the guide covers the whole exam, match it: the same number of questions (or a proportional sample for a very long exam), the same mix of types, `practice_minutes` = `exam_minutes`, the same conditions. When the guide covers only part of the exam's scope (one lecture of a six-lecture quiz), size it to that share: about share x the real question count, at least about 10 questions, and `practice_minutes` = share x `exam_minutes`, rounded. State the share in the exam instructions ("These cover Lecture 4, about a sixth of the midterm, so they take 15 minutes rather than 90.").
- Weight topics by `exam_intel.md`. Every unit appears at least once; heavily signaled topics appear more. Tag each question with `data-from="<unit>"` for the score breakdown.
- Use new questions, not copies of the unit questions. Make them a little harder than the unit questions, in the way real exams tend to be harder than practice: more computation, more parts, finer details.
- When the user supplied a practice exam and will NOT take it themselves, you may adapt its questions (changed numbers, upgraded format); when they will take it, write fresh questions in its style under the rule above (no mirrored items).
- Each exam question gets a worked solution like any other. The engine hides Check until the reader submits, then shows right or wrong, the score, a per-unit breakdown, Show answer and Solve it for me.
