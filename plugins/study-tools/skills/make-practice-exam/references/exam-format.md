<!-- Copied from shared/references/exam-format.md by scripts/sync_shared.py. Edit the shared copy, not this one. -->
# Exam format: copy the structure of the real exam

Shared by every study-tools skill that writes questions, grades an attempt, or decides what a sheet emphasizes. The output of this file is the **exam profile**: a short, confirmed description of what the real exam looks like. Everything downstream (question mix, difficulty, answer forms, what a cheat sheet weights, how an attempt is graded) follows it.

Do not skip this because the course "looks like" a type you know. Two courses with the same name can have completely different exams: an intro statistics exam may be all computation and another all interpretation; an art history final may be slide identifications or long comparative essays.

## 1. Ask for the evidence

Put this in the skill's first message, together with the upload request (one message, not two):

> Do you have a practice exam, a past exam, sample questions, or your instructor's description of the exam (an announcement, the syllabus section, a review sheet)? I'll copy its structure: the kinds of questions, how hard they are, what the answers look like and what it covers. If it's one you haven't taken yet and want to take blind, tell me and I'll use only its structure, never its questions. If you have a graded exam of your own from this course, that helps me match the difficulty too.

Evidence, strongest first. Use the strongest available and say which one the profile rests on:
1. A past exam by the same instructor for the same course.
2. A practice exam the instructor released.
3. The student's own graded exam or quiz from this course (shows the real grading, partial credit and difficulty).
4. The instructor's description: announcement, syllabus, review sheet, what they said in a recording.
5. Homework and in-class quizzes from the course (style and difficulty, not format).
6. Nothing: section 5.

When there are several, the newer and closer one wins, but note conflicts (for example, last year's exam covered fewer units because the course moved faster this year).

## 2. Read it into an exam profile

Read every question, not a sample. Record the profile in `course/exam-format.md` (see `course-pack.md`) with these parts.

**Logistics.** Length in minutes, total points, number of questions, sections, allowed materials (closed book, one sheet, open book with printed material, open laptop), calculator or not, what is provided (formula sheet, tables, a word bank, the documents for a document-based question), paper or online.

**Sections.** One row per section or per question type:

| Field | What to write |
|---|---|
| type | from the catalog in section 6 |
| count, points | how many, points each |
| answer form | a letter, a number with units, an expression, a one-line justification, a paragraph, an essay with a thesis, a proof, code, labels on a diagram, a name and date |
| credit rules | partial credit, all-or-nothing select-all, "justification required for credit", penalty for wrong answers |
| time | minutes per question implied by length and count |

**Difficulty.** Measure it from the questions; do not guess from the course level. For each question note:
- the demand: recall (a definition, a date), understand (explain, paraphrase), apply (use a method on a new case), analyze (compare, trace, find the flaw), evaluate or create (argue, design, prove);
- the number of steps from reading to answer;
- whether it needs work by hand (computation, a derivation, a trace) and how much;
- how close the wrong options are (obvious filler, or each one a real mistake);
- whether it combines units.

Summarize as a distribution, for example "about 40% recall of definitions, 45% one-step applications, 15% multi-step problems that combine two units; distractors are common sign and direction errors". Add two or three anchors that describe a typical easy, middle and hard item in abstract terms. If the exam is blind, the anchors must not reveal its questions.

**Coverage.** Which units or topics the questions hit and roughly what share each, which units the exam skips, and whether the share follows class time or the instructor's emphasis.

**Style.** Wording habits ("Which of the following is NOT"), scenarios, data tables, figures or passages in the stem, stem length, traps the instructor likes (sign conventions, "if" versus "if and only if", dates that are one decade off, a quotation from the wrong author).

**Instructor signals.** What they said will or will not be tested, with the source.

**Unknowns.** Every field the evidence does not settle, marked `assumed` with the assumption.

## 3. Confirm it with the student

This step is required. Show the profile compactly: a small table of sections (type, count, points, answer form), one line on difficulty, one on coverage, and the list of `assumed` fields. Then ask:

> Is this what the real exam will look like? Correct anything that's off, especially anything marked assumed, and tell me if this year's exam will differ (different units, fewer calculations, a new format).

Proceed only after the student confirms or corrects it. If the student is away, proceed with the assumptions stated in one line at the top of the output, and ask again at delivery.

## 4. Blind practice and off-limits material

Every exam-like file gets one of three modes, recorded in `course/off-limits.md`:

| Mode | When | What is allowed |
|---|---|---|
| open | the student has taken it, or does not care | use it freely: its questions can be adapted, varied and discussed |
| blind | the student will take it later as a real test of readiness | structure only: format, types, difficulty, coverage. Never reproduce or closely vary its questions (same scenario, same numbers, same answer path), never discuss its items, never tailor a sheet to its specific questions. Facts the lectures teach stay in every output even when one also answers a blind item. |
| off-limits | the student is saving it (a practice final, a graded key) | do not open it at all. List it so helpers never open it either. |

Ask the mode for each file when it is unclear. Pass the list to every helper agent with the instruction not to open off-limits files and not to mirror blind ones. Files that describe blind or off-limits items (exam notes, answer keys) go in a separate folder marked as spoilers.

## 5. When there is no exam evidence

Ask three short questions, with choices where possible: the format (multiple choice, short answer, problems, essays, a mix), the length and time, and the allowed materials. Fill the rest from the syllabus, the homework style and the course's subject, using the defaults below, and mark the whole profile `assumed`.

| Course kind | Assumed default |
|---|---|
| Math, physics, engineering | multi-part problems worked by hand, some short conceptual questions |
| Computer science | conceptual multiple choice, code tracing, short code writing, complexity questions |
| Natural sciences | multiple choice, short explanations, data or graph interpretation, labeled diagrams |
| Social sciences, economics | multiple choice, short answers, graph or data interpretation, one short essay |
| History | identifications (term, date, significance), short answers, one essay or document-based question |
| Literature, philosophy | passage identification and analysis, short answers, one or two essays |
| Art and music history | image or audio identification (name, maker, date, significance), comparisons, a short essay |
| Languages | vocabulary, grammar fill-in, translation, reading comprehension, a short composition |
| Law, business, medicine | case or scenario analysis (spot the issues, apply the rule), short answers |

## 6. Question types across subjects

The catalog every skill uses. The last column is how a study-tools page represents the type: `mc`, `multi`, `tf` and `num` are graded automatically; `written` shows a model answer and rubric, and the student marks it (see section 7).

| Type | Common in | Answer | Writing it well | Page type |
|---|---|---|---|---|
| Multiple choice | everywhere | one option | every wrong option is a real mistake a student makes | mc |
| Select all that apply | sciences, CS, social sciences | a set | judge each option on its own; state the credit rule | multi |
| True or false | everywhere | T or F | test one claim; traps sit in quantifiers and directions | tf |
| True or false with justification | STEM, social sciences | T or F plus one sentence | the justification is graded: give a model one | tf, followed by a written item, or written |
| Numeric computation | math, sciences, economics, accounting | a number, with units | the stem gives every value; keep exact forms | num |
| Expression or derivation | math, physics, engineering | a formula or derivation | state what form the answer should take | written |
| Proof | math, theoretical CS | an argument | a rubric: right claim, key idea, rigor, no gaps | written |
| Code writing | CS | code | a model solution plus what must be true of any correct one | written (code) |
| Code tracing or output | CS | the output or a value | small, self-contained code in the stem | num, mc or written (code) |
| Definition or short answer | everywhere | 1 to 4 sentences | a model answer and 2 to 4 rubric points | written |
| Essay | humanities, social sciences | thesis, evidence, analysis | the prompt, a model outline, a rubric (thesis, evidence, analysis, organization) | written |
| Identification of a work, specimen or place | art and music history, biology, geology, geography | name, maker, date, significance | the image or excerpt goes in the stem; marks for each element | mc, or written |
| Term identification | history, social sciences | what, when, who, why it matters | rubric points for each element | written |
| Passage analysis | literature, philosophy, languages, history | context, speaker, significance | quote the passage in the stem; rubric | written |
| Document-based question | history | an essay using given documents | the documents go in the stem | written |
| Case or scenario analysis | law, business, ethics, medicine | the issues and how the rules apply | list the issues a full answer spots | written |
| Diagram labeling | anatomy, biology, chemistry, geography | labels | one item per label, or a written item with the key | mc or written |
| Matching, ordering, chronology | history, biology, processes | pairs or a sequence | the key is the full order | mc (each option an order), or written |
| Fill in the blank | languages, vocabulary, definitions | words | list accepted variants in the model answer | written, or mc |
| Translation or composition | languages | text | a model answer and what a grader looks for | written |
| Data or graph interpretation | sciences, economics, psychology | a value read off, then an inference | include the data in the stem | num or mc, plus written |
| Multi-part problem | STEM, economics | parts (a), (b), (c) | one item per part, each self-contained | one item per part |

Oral, listening and lab-practical exams cannot be fully simulated on a page. Write their questions as written items with a model answer and say so.

## 7. Grading answers that are not exact

Multiple choice, select all, true or false and numeric answers are graded exactly. Everything else is graded against a model answer and a rubric:
- Write the model answer the way a top student would on the exam, at the real length, and 2 to 5 rubric points, each worth stated marks.
- The student marks their own answer against the rubric (full, partial or none). Claude's feedback is advice, not the grade: studies of rubric-based grading by language models find good agreement on right versus wrong but weak agreement on fine-grained marks, and errors that lean lenient. Say this once where the feedback appears.
- When a real answer key or the instructor's rubric exists, it wins over anything Claude writes.
