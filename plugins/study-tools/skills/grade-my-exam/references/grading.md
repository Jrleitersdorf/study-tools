# Phase 3: grade every question

The order matters: solve, then compare with the key, then compare with the student. A grader who reads the key or the student's answer first anchors on it.

## 1. Solve the exam yourself, from scratch

Write `<review>/solutions.md` before opening the key or looking at the student's answers:
- **Every question**, in order, with the full reasoning, not just the answer.
- **Multiple choice and select-all**: judge every option on its own as true or false, with a one-line reason each. Confirm each wrong option is actually wrong, not merely less right. Watch quantifiers ("all", "only", "always"), "NOT" stems, "if" versus "if and only if", directions and signs.
- **Numeric**: work exactly (fractions, roots, e), then the decimal to at least 5 significant digits; note units.
- **True/false with justification**: the verdict and the one sentence that settles it.
- **Written** (short answer, essay, proof, code, identification, passage or case analysis): a model answer at the real length the exam allows, and a rubric of 2 to 5 points with marks that add up to the question's points (`references/exam-format.md` section 7). For code, also list what must be true of any correct solution, and run the student's code mentally on a small input (or actually, if a sandbox is available and the code is safe).
- Use the course material and the course pack's notes for conventions and notation (a factor of 1/2, a sign convention, a definition the instructor gave). When the question gives a definition, use that one.

## 2. Compare with the key, then reconcile

- **The instructor's key or rubric wins** for the grade. Where your solution disagrees with it, re-solve the question once more from scratch. If you still disagree, grade by the key and write the disagreement in `key_dispute` on that card (what the key says, what you get, why, and that the student may want to ask the instructor). Never silently "fix" a key.
- **No key**: your solution is the key. Say so in `meta.key_source` ("Claude's key (no key was supplied)").
- **Independent re-grade.** When subagents are available, give one helper the exam, the confirmed transcript, the credit rules and `off-limits.md` (with the instruction not to open listed files), but not your solutions or grades, and have it solve and grade every question on its own. Compare item by item. Every disagreement gets a third look from scratch; record the outcome in `solutions.md`. Without subagents, re-solve every exact question a second time in a fresh pass, options in a different order. Accuracy over speed: a wrong key on the page is the worst outcome of this skill.

## 3. Grade the student

**Exact types** (mc, multi, tf, num) are graded exactly:
- mc and tf: the choice equals the key. multi: the set equals the key's set; apply the stated rule (all-or-nothing by default; if partial credit applies, compute it and explain it in `verdict_reason`).
- num: within the tolerance the exam implies (the stated rounding, or about 0.5% of the key when unstated); a right number with wrong or missing units follows the exam's rule.
- tf with justification: the choice is graded exactly; the justification is graded against the model sentence. A right choice with a wrong or missing justification is `partial` (or `wrong` if the exam gives no credit without it), with the split in `verdict_reason` or the credit rules.
- `earned` is a plain number. build_review.py checks that the verdict matches the key.

**Written types** are graded against the rubric (the instructor's when given, otherwise yours):
- Mark each rubric point `got` (full, part or none) with a short `comment` when it is not full.
- Report the mark as a range, `{"low", "likely", "high"}`: likely is the rubric total; low and high are what a stricter or a more generous grader would plausibly give (typically one rubric point either way; wider for essays). Language-model grading of written work agrees with instructors on right versus wrong far better than on exact marks, and its errors lean lenient: when unsure between two marks, put the lower one in likely.
- The page labels these marks as estimates and the total as a range. Never present an estimate as the grade.

**A graded real exam** (`meta.kind: "graded"`): the instructor's marks are the truth. Each `earned` is the instructor's number; the verdict follows the marks. Still solve every question yourself: the explanations, walkthroughs and lessons need correct reasoning, and a mark that looks wrong becomes a `key_dispute` ("you may want to ask about this one"), never a changed grade.

**Confidence.** From the student's notes: "guessed" sets `confidence: "guessed"`, "unsure", "between B and D" or "not sure" sets `unsure`; otherwise `solid`. A right answer that was guessed or unsure is a weak spot: it gets a walkthrough when guessed, and it counts in the page's "unsure" filter and in the weak spots of the course pack.

**Verdicts.** `right` = full marks; `partial` = some; `wrong` = none; `blank` = unanswered. For estimates the verdict follows `likely`.

## 4. Score

build_review.py adds up the points: exact points, plus the low, likely and high of every estimated mark, and prints the score as "about 74%, likely 71 to 80%". Use those numbers in your message to the student; do not compute your own.
