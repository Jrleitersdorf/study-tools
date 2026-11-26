# Study Tools

Study Tools is a Claude plugin I built to help me learn course material and prepare for exams. It started as a study guide I made for one of my machine learning quizzes, and I have since turned it into something that should work for most classes, whether math, computer science, the sciences or the humanities.

The plugin will grow over time. Each tool is its own skill, so new ones can be added without changing the others.

## Tools

| Skill | What it does |
| :- | :- |
| `study-guide` | Turns your course material into an interactive study guide with one page per lecture or topic, practice questions with worked solutions, a practice exam, and Ask and Solve-it-for-me buttons powered by Claude. |
| `cheat-sheet` | Builds a printable cheat sheet PDF from your course material, cut down to what the exam asks and organized so you can find anything in seconds, with diagrams, worked examples and true-or-false checks. It fits whatever your exam allows, from an open-book reference to one dense page. |
| `make-practice-exam` | Writes a practice exam that copies the structure of your real one: the kinds of questions, how hard they are, what the answers look like, the points, the time and what it covers. Take it on screen with a timer and grading, or print it with an answer key. |
| `grade-my-exam` | Grades a practice exam you took on your own from photos, scans or a list of answers, finds the patterns behind what you missed, and builds a review page that teaches exactly those gaps. |

## Install

You need a paid Claude plan (Pro or above).

**In claude.ai or the Claude desktop app**

1. Open **Customize > Plugins**.
2. Select **Add > Add marketplace** and enter `Jrleitersdorf/study-tools`.
3. Find **Study Tools** in the list and select **Add**.

**In Claude Code**

```
/plugin marketplace add Jrleitersdorf/study-tools
/plugin install study-tools@study-tools
```

## Updates

I update the plugin regularly. In claude.ai, open the marketplace under **Customize > Plugins** and turn on **Sync automatically**, or select **Check for updates** whenever you like. In Claude Code, turn on auto-update for the marketplace in `/plugin`, or run `/plugin marketplace update study-tools`.

What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

## Use

Type the skill's name in a chat (`/study-guide`, `/cheat-sheet`, `/make-practice-exam`, `/grade-my-exam`), or just ask for what you want: a study guide, a cheat sheet, a practice exam, or "grade my practice test". Claude asks you to upload your course material (slides, notes, transcripts, readings, homework, past exams and anything your instructor said about the exam).

If you have a practice exam, a past exam or sample questions, share them. Every tool uses them to match the real exam's format and difficulty. If there is one you want to take blind later, say so, and Claude will only use its structure.

The tools share what they learn about a class. Claude reads your material once into a course pack, and the cheat sheet, the practice exams and the grading reuse it, along with the topics you keep missing.

Study guides, practice exams and exam reviews are published as Claude artifacts, which you can open on any device. Ask, Solve it for me and feedback on written answers only work in the published artifact, because they call Claude from inside the page.

More detail on each tool is in the [plugin's README](plugins/study-tools/README.md).

## Repository layout

```
.claude-plugin/marketplace.json   the catalog Claude reads when you add this marketplace
plugins/study-tools/              the plugin itself
  .claude-plugin/plugin.json      name, version and metadata
  skills/<skill>/                 each skill: SKILL.md, references, assets and scripts
shared/references/                rules every skill uses (exam format, course pack), copied into each skill
scripts/sync_shared.py            copies shared/references into the skills; --check fails if a copy is stale
```

## Feedback

If something does not work for your class, open an issue with the type of course and what went wrong. That is the most useful thing for improving the plugin.

## License

[MIT](LICENSE)
