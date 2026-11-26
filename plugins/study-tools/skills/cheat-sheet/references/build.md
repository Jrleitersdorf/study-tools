# Build and deliver

## Commands

```
python3 scripts/build.py <sheet>                     check sources, build, enforce page rules, report
python3 scripts/build.py <sheet> --only s2 --render  one section alone, pages rendered to <sheet>/build-s2/pages/
python3 scripts/build.py <sheet> --check             source checks only, no LaTeX
python3 scripts/build.py <sheet> --render --dpi 110  everything, with page images for viewing
python3 scripts/build.py <sheet> --out "<path>.pdf"  choose the output file
```

Requirements: pdflatex with the TeX Live packages tcolorbox, listings, fancyhdr, eso-pic, titlesec, tabularx, booktabs, enumitem, zref, lm (most full TeX Live installs have them; on Debian or Ubuntu, `texlive-latex-extra texlive-fonts-recommended`); `rsvg-convert` for diagrams; poppler (`pdftoppm`) for rendering; Python with pypdf and pdfplumber for the page checks. If pdflatex is missing and cannot be installed, say so and stop; do not fall back to another format silently.

## Reading the report

- **ERRORS** stop the build: a LaTeX error with its file and line, a missing figure, an em dash, a topic in the wrong section. Fix and rerun.
- **WARNINGS**: overfull lines, pages more than a third empty (with the reason), a first topic that runs off its section page (with how many lines to trim), the page budget exceeded, slash fractions, a missing takeaway or symbols table.
- **NOTES**: topics moved to a new page so they do not split, topics longer than a page, where the page images are.

The build rebuilds until no topic that fits on a page is split, so the final PDF already has those moves. A page left mostly empty by a move is the trade-off: trim the moved topic or what precedes it.

The checks do not judge looks. View the rendered pages.

## Delivery

1. Build the full sheet, view every page, and run the audits (`audits.md`).
2. Name the file after `sheet.json`'s title ("PHYS 110 Midterm Cheat Sheet.pdf"). A later version is "... v2.pdf"; never overwrite a version the student has.
3. Send the PDF to the student. If their computer is linked and they keep course files in a folder, also save it there, next to their other exam material, and say where.
4. In the message, in a few lines: the page count and how it is organized; the items flagged as uncertain; the list of things worth writing into their printed copies by hand (if any); and one offer: the wiki, or a practice exam in the same format (the `make-practice-exam` skill), or a study guide.
5. The review round: ask for comments by page and topic ("3.2: the takeaway is too thin", "page 14 is cramped"). Apply them, rebuild as a new version, and reply to each comment saying what changed and where. When the student asks questions without asking for changes, answer them and change nothing.
6. Update the course pack (`course-pack.md`, "After the skill finishes").
