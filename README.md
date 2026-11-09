# Study Tools

Study Tools is a Claude plugin I built to help me learn course material and prepare for exams. It started as a study guide I made for one of my machine learning quizzes, and I have since turned it into something that should work for most classes, whether math, computer science, the sciences or the humanities.

The plugin will grow over time. Each tool is its own skill, so new ones can be added without changing the others.

## Tools

| Skill | What it does |
| :- | :- |
| `study-guide` | Turns your course material into an interactive study guide with one page per lecture or topic, practice questions with worked solutions, a practice exam, and Ask and Solve-it-for-me buttons powered by Claude. |

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

Type `/study-guide` in a chat, or ask Claude to make a study guide for your class. Claude asks you to upload your course material (slides, notes, transcripts, readings, homework, past exams and anything your instructor said about the exam), agrees the structure of the guide with you, and then builds it one unit at a time.

The finished guide is published as a Claude artifact, which you can open on any device. Ask and Solve it for me only work in the published artifact, because they call Claude from inside the page.

More detail on what the guide contains and how it is built is in the [plugin's README](plugins/study-tools/README.md).

## Repository layout

```
.claude-plugin/marketplace.json   the catalog Claude reads when you add this marketplace
plugins/study-tools/              the plugin itself
  .claude-plugin/plugin.json      name, version and metadata
  skills/study-guide/             the study-guide skill, its references, template and scripts
```

## Feedback

If something does not work for your class, open an issue with the type of course and what went wrong. That is the most useful thing for improving the plugin.

## License

[MIT](LICENSE)
