# Diagrams

Original diagrams are what students remember most from a good sheet. Draw one wherever a picture makes an idea click faster than text, and nowhere else.

## When to draw

Draw a diagram when:
- an equation has several variables and the student must know which is which (label each on a picture of the setup);
- a procedure moves through a structure: a tree, a network, a graph, a pipeline, a circuit, a cycle, a timeline;
- a comparison is spatial or visual: two architectures, two maps, two curves, before and after;
- the student got a question wrong because they could not picture the situation (from `course/weak-spots.md`);
- the exam asks students to read or sketch a figure (a supply and demand shift, a phase diagram, a titration curve).

Do not draw when a table or a sentence says it as fast, or to decorate. Crop a figure from the sources instead when the original figure itself is what the exam shows (an artwork, a map, a slide plot).

## How to draw

- Hand-written SVG, one file per diagram in `figs/gen-<name>.svg`, converted to PDF: `rsvg-convert -f pdf -o figs/gen-<name>.pdf figs/gen-<name>.svg`.
- White background; dark text 13 to 15 px; one or two accent colors (the sheet uses navy `#1f3a5f` and red `#c0392b`); lines 1.2 to 2.4 px.
- Every label readable at print size. Labels sit next to what they name, not in a legend.
- Width 0.4 to 0.75 of the line (`\sheetfig[0.5]`). A diagram that fills the page is too big; a diagram beside a computation (`\sidebyside`) is usually 0.4 to 0.5.
- The caption says what to notice, in one sentence.
- For plots of functions, compute the points with a short Python script that writes the SVG, so the curve is exact.
- Use the sheet's notation, exactly as the boxes write it.

## How to check

- View each one after converting: `pdftoppm -r 150 -png figs/gen-<name>.pdf /tmp/check` and look at the image. Check that nothing overlaps, no label is cut off, and arrows point the right way.
- Check the content as strictly as an equation: values on axes, which arrow is which, what is labeled. A wrong diagram teaches the wrong thing more effectively than wrong text; the content audit covers every diagram.
