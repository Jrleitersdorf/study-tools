# Example: ECON 101 practice midterm (made-up)

A finished run of the skill on a made-up intro economics course, small enough to read in a few minutes:

- `course/exam-format.md`: the confirmed exam profile, read from a past midterm the student had already taken (open mode).
- `work/blueprint.md`: the twelve slots that profile turns into.
- `work/verification.md`: what the blind re-solve and the checks found, and what changed.
- `guide/`: the exam-only study guide that is the practice exam.

Build, test and print it from the skill folder (`<tmp>` is any writable scratch folder):

```
python3 ../study-guide/scripts/build.py assets/example/guide --allow-example --out <tmp>/econ/study_guide.html
node ../study-guide/scripts/test_guide.js <tmp>/econ/study_guide.html --libs "$(bash ../study-guide/scripts/fetch_libs.sh)"
python3 scripts/check_exam.py assets/example/guide --blueprint assets/example/work/blueprint.md --minutes-per-point 1.6
node scripts/make_paper.js assets/example/guide --out <tmp>/econ --libs "$(bash ../study-guide/scripts/fetch_libs.sh)"
```
