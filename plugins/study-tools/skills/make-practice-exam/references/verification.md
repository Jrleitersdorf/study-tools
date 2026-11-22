# Verifying the bank

A wrong key on a practice exam teaches the wrong thing and costs the student's trust. Every question is verified independently before it can be chosen.

## 1. Blind re-solve

A helper that did not write the questions (an agent when available; otherwise a separate pass that starts from the course notes, not the keys) receives the stems and options only, plus the course notes, and answers every question with its reasoning. For written items it writes its own short answer and then marks the model answer against the rubric for correctness.

Compare with the keys:
- **Agrees**: keep.
- **Disagrees**: work out who is right from the sources. Fix the key, fix the stem, or drop the question. Never keep a question whose key two careful solvers dispute.
- **Ambiguous** (the solver found two defensible answers, or needed an assumption the stem does not state): rewrite the stem or drop it.

## 2. Item checks

For every remaining question:
- every option of a multiple-choice or select-all item judged on its own: each wrong option is actually wrong, not merely less right;
- numeric keys recomputed by a short script where possible, with the tolerance checked against the rounding a student would do by hand;
- the stem is self-contained, uses the course's notation, and contains no clue to the answer (a grammatical mismatch, the longest option always right, a repeated word);
- the rubric of a written item gives full marks to the model answer and to at least one other correct answer, and no marks to a confident wrong one;
- nothing mirrors a blind item.

## 3. Whole-exam checks

On the chosen set:
- counts, points, types and unit coverage match the blueprint;
- difficulty: the share of recall, application and multi-step items matches the profile;
- key positions spread over the letters; true and false roughly balanced;
- no two questions test the same fact the same way, and no question gives away another's answer;
- the total time to solve by hand fits the time limit.

Record the results in `work/verification.md`: each dropped or changed question and why.
