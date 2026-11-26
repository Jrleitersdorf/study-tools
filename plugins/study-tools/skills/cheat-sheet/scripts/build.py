#!/usr/bin/env python3
"""Build a cheat sheet (or its long "wiki" version) from a sheet folder into a PDF.

    python3 build.py <sheet folder>                    check, build, enforce page rules, report
    python3 build.py <sheet folder> --only s2          build one section alone (fast drafts)
    python3 build.py <sheet folder> --render           also render every page to PNG for viewing
    python3 build.py <sheet folder> --check            only run the source checks, no LaTeX
    python3 build.py <sheet folder> --out <file.pdf>   where to write the PDF

The sheet folder holds sheet.json, sections/<id>.tex, figs/ and optionally macros.tex (course
macros). Work files go to <sheet>/build/. The PDF is written to <sheet>/<title>.pdf.

Page rules enforced here (the design the skill promises):
  * a topic that fits on one page never starts on one page and ends on the next: the build
    moves it to a new page and rebuilds (unless the topic says \\allowsplit);
  * pages more than a third empty are reported with the reason, so the writer can tighten or
    allow a split;
  * overfull lines, missing figures and LaTeX errors are reported with the file and line.
Exit status: 0 when the PDF was built with no errors (warnings allowed), 1 otherwise.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
STY = os.path.join(SKILL, 'assets', 'template', 'cheatsheet.sty')
SP_PER_PT = 65536.0


class Report:
    def __init__(self):
        self.errors, self.warnings, self.notes = [], [], []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def note(self, msg):
        self.notes.append(msg)

    def show(self):
        for title, items in (('ERRORS', self.errors), ('WARNINGS', self.warnings), ('NOTES', self.notes)):
            if items:
                print('\n%s (%d)' % (title, len(items)))
                for m in items:
                    print('  - ' + m)


# ---------------------------------------------------------------- source checks
def tex_escape(s):
    return (s.replace('\\', '\\textbackslash{}').replace('&', '\\&').replace('%', '\\%')
            .replace('#', '\\#').replace('_', '\\_').replace('$', '\\$'))


def load_config(sheet, rep):
    path = os.path.join(sheet, 'sheet.json')
    if not os.path.exists(path):
        rep.err('sheet.json is missing in %s. Copy assets/template/sheet.json and fill it in.' % sheet)
        return None
    try:
        cfg = json.load(open(path, encoding='utf-8'))
    except ValueError as e:
        rep.err('sheet.json is not valid JSON: %s' % e)
        return None
    for k in ('title', 'course', 'header', 'sections'):
        if not cfg.get(k):
            rep.err('sheet.json needs "%s".' % k)
    if cfg.get('paper', 'letter') not in ('letter', 'a4'):
        rep.err('sheet.json "paper" must be "letter" or "a4".')
    if cfg.get('layout', 'standard') not in ('standard', 'dense'):
        rep.err('sheet.json "layout" must be "standard" or "dense".')
    nums = set()
    for i, s in enumerate(cfg.get('sections') or []):
        for k in ('id', 'num', 'title', 'tab'):
            if not s.get(k):
                rep.err('section %d in sheet.json needs "%s".' % (i + 1, k))
        if s.get('num') in nums:
            rep.err('two sections in sheet.json have num "%s".' % s.get('num'))
        nums.add(s.get('num'))
        f = os.path.join(sheet, 'sections', '%s.tex' % s.get('id'))
        if s.get('id') and not os.path.exists(f):
            rep.err('section "%s" has no file sections/%s.tex.' % (s.get('id'), s.get('id')))
        if len(s.get('tab', '')) > 14:
            rep.warn('section "%s": tab label "%s" is long; side tabs fit about 12 characters.' % (s.get('id'), s.get('tab')))
    return cfg


MATH_RE = re.compile(r'\\\((.*?)\\\)|\\\[(.*?)\\\]|\$(.+?)\$', re.S)


def check_section(sheet, sec, cfg, rep):
    path = os.path.join(sheet, 'sections', '%s.tex' % sec['id'])
    if not os.path.exists(path):
        return
    rel = 'sections/%s.tex' % sec['id']
    text = open(path, encoding='utf-8').read()
    lines = text.split('\n')
    no_em = (cfg.get('style') or {}).get('no_em_dashes', True)

    def line_of(pos):
        return text.count('\n', 0, pos) + 1

    if no_em:
        for m in re.finditer(r'\u2014|(?<!-)---(?!-)', text):
            rep.err('%s:%d has an em dash. The style forbids them: use a colon, a comma or a new sentence.' % (rel, line_of(m.start())))
    if '\\cssection' in text:
        rep.err('%s calls \\cssection. build.py writes the section heading from sheet.json; start the file with its first \\cstopic.' % rel)
    topics = list(re.finditer(r'\\cstopic\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}', text))
    if not topics:
        rep.err('%s has no \\cstopic. Every section holds one or more topics.' % rel)
    for i, m in enumerate(topics):
        num, title, refs = m.group(1), m.group(2), m.group(3)
        if not num.startswith(sec['num'] + '.'):
            rep.err('%s:%d: topic "%s" is in section %s; number it %s.n.' % (rel, line_of(m.start()), num, sec['num'], sec['num']))
        if not refs.strip():
            rep.warn('%s:%d: topic %s has no source pointer (third argument), e.g. "L4 pp.2--9".' % (rel, line_of(m.start()), num))
        end = topics[i + 1].start() if i + 1 < len(topics) else len(text)
        body = text[m.end():end]
        body_nc = re.sub(r'(?m)^\s*%.*$', '', body)
        if not re.match(r'\s*(\\allowsplit\s*)?\\takeaway\{', body_nc):
            rep.warn('%s:%d: topic %s should start with \\takeaway{...} (what the topic covers, then its implications).' % (rel, line_of(m.start()), num))
        for b in re.finditer(r'\\begin\{keybox\}\{([^}]*)\}(.*?)\\end\{keybox\}', body, re.S):
            if '\\keyeq' in b.group(2) and '\\begin{symbols}' not in b.group(2):
                rep.warn('%s:%d: key box "%s" has an equation but no symbols table. Define every symbol under the equation.' % (rel, line_of(m.end() + b.start()), b.group(1)))
    for m in MATH_RE.finditer(text):
        math = next(g for g in m.groups() if g is not None)
        for s in re.finditer(r'(?<![\\/])\b[\w)}]+\s*/\s*[\w({\\]', math):
            frag = s.group(0)
            if re.search(r'\d\s*/\s*\d', frag) or re.search(r'[a-zA-Z)}]\s*/\s*[a-zA-Z(\\{]', frag):
                if '_{1/2}' in math[max(0, s.start() - 3):s.end() + 2] or re.search(r'\{1/2\}', math):
                    continue
                rep.warn('%s:%d: "%s" in math is a slash fraction. Write \\frac{..}{..} so it stacks.' % (rel, line_of(m.start()), frag.strip()))
                break
    for m in re.finditer(r'\\(?:sheetfig(?:\[[^\]]*\])?|includegraphics(?:\[[^\]]*\])?)\{([^}]+)\}', text):
        f = m.group(1)
        if not os.path.exists(os.path.join(sheet, f)):
            rep.err('%s:%d: figure "%s" does not exist (paths are relative to the sheet folder).' % (rel, line_of(m.start()), f))
    for m in re.finditer(r'\\begin\{factcard\*?\}\{[^}]*\}\[([^\]]+)\]', text):
        if not os.path.exists(os.path.join(sheet, m.group(1))):
            rep.err('%s:%d: fact-card image "%s" does not exist.' % (rel, line_of(m.start()), m.group(1)))
    for m in re.finditer(r'\.svg\}', text):
        rep.err('%s:%d: LaTeX cannot include SVG. Convert it: rsvg-convert -f pdf -o figs/x.pdf figs/x.svg' % (rel, line_of(m.start())))


# ---------------------------------------------------------------- LaTeX
def write_main(sheet, cfg, build, only):
    paper = 'a4paper' if cfg.get('paper') == 'a4' else 'letterpaper'
    dense = cfg.get('layout') == 'dense'
    if dense:
        land = ',landscape' if cfg.get('landscape') else ''
        geom = '\\usepackage[%s%s,margin=0.4in,top=0.45in,bottom=0.45in,headheight=0pt,headsep=0pt,footskip=0.2in]{geometry}' % (paper, land)
    else:
        geom = '\\usepackage[%s,top=0.9in,bottom=0.8in,left=0.85in,right=0.95in,headheight=14pt,headsep=0.3in]{geometry}' % paper
    secs = [s for s in cfg['sections'] if not only or s['id'] in only]
    body = []
    for s in secs:
        body.append('\\cssection{%s}{%s}{%s}{%s}' % (s['num'], tex_escape(s['title']), tex_escape(s['tab']), tex_escape(s.get('summary', ''))))
        body.append('\\input{sections/%s}' % s['id'])
    cover = '' if only else '\\cscover{%s}' % cfg.get('intro', '')
    if dense:
        body = ['\\begin{multicols*}{%d}' % int(cfg.get('dense_columns', 3)), cover] + body + ['\\end{multicols*}']
        cover = ''
    tex = '\n'.join([
        '\\documentclass[%s]{article}' % ('10pt' if not dense else '10pt'),
        geom,
        '\\usepackage%s{cheatsheet}' % ('[dense]' if dense else ''),
        '\\graphicspath{{./}}',
        '\\SheetTitle{%s}' % tex_escape(cfg['title']),
        '\\SheetCourse{%s}' % tex_escape(cfg.get('course', '')),
        '\\SheetScope{%s}' % tex_escape(cfg.get('scope', '')),
        '\\SheetHeader{%s}' % tex_escape(cfg['header']),
        '\\IfFileExists{macros.tex}{\\input{macros.tex}}{}',
        '\\IfFileExists{breaks.tex}{\\input{breaks.tex}}{}',
        '\\begin{document}',
        cover,
    ] + body + ['\\end{document}', ''])
    open(os.path.join(build, 'main.tex'), 'w', encoding='utf-8').write(tex)


def stage(sheet, build):
    os.makedirs(build, exist_ok=True)
    shutil.copy(STY, os.path.join(build, 'cheatsheet.sty'))
    for d in ('sections', 'figs'):
        src, dst = os.path.join(sheet, d), os.path.join(build, d)
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
    if os.path.exists(os.path.join(sheet, 'macros.tex')):
        shutil.copy(os.path.join(sheet, 'macros.tex'), os.path.join(build, 'macros.tex'))


def pdflatex(build):
    p = subprocess.run(['pdflatex', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', 'main.tex'],
                       cwd=build, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600)
    return p.returncode == 0


def log_problems(build, rep, final):
    log_path = os.path.join(build, 'main.log')
    if not os.path.exists(log_path):
        rep.err('LaTeX produced no log. Is pdflatex installed?')
        return
    log = open(log_path, encoding='latin-1').read()
    for m in re.finditer(r'^(\./)?([^\n:]+\.tex):(\d+): (.*)$', log, re.M):
        ctx = log[m.end():m.end() + 300].split('\n')
        detail = ' '.join(x.strip() for x in ctx[:3] if x.strip())[:200]
        rep.err('%s:%s: %s %s' % (m.group(2), m.group(3), m.group(4), detail))
    if not final:
        return
    for m in re.finditer(r'Overfull \\hbox \(([\d.]+)pt too wide\) (?:in paragraph|detected) at lines? (\d+)', log):
        if float(m.group(1)) > 2.0:
            fname = 'main.tex'
            before = log[:m.start()]
            opens = re.findall(r'\((\./sections/[^\s()]+\.tex)', before)
            if opens:
                fname = opens[-1][2:]
            rep.warn('%s:%s: a line sticks out %.0fpt into the margin. Rephrase, shorten the math, or split it.' % (fname, m.group(2), float(m.group(1))))
    for m in re.finditer(r"LaTeX Warning: File `([^']+)' not found", log):
        rep.err('figure %s not found.' % m.group(1))
    for m in re.finditer(r'Missing character: There is no (\S+)', log):
        rep.warn('a character the font cannot print: %s. Use the LaTeX command for it.' % m.group(1))


def read_positions(build):
    pos_path = os.path.join(build, 'main.pos')
    geom, starts, ends, splits = None, {}, {}, set()
    if not os.path.exists(pos_path):
        return None
    for line in open(pos_path, encoding='latin-1'):
        parts = line.split()
        if not parts or (parts[0] in ('start', 'end') and len(parts) != 4):
            continue
        if parts[0] == 'geom':
            geom = (int(parts[1]), int(parts[2]))
        elif parts[0] == 'start':
            starts[parts[1]] = (int(parts[2]), int(parts[3]))
        elif parts[0] == 'end':
            ends[parts[1]] = (int(parts[2]), int(parts[3]))
        elif parts[0] == 'split' and len(parts) > 1:
            splits.add(parts[1])
    return geom, starts, ends, splits


def topic_heights(build):
    got = read_positions(build)
    if not got or not got[0]:
        return {}, None
    (texth, bottom), starts, ends, splits = got
    top = bottom + texth
    out = {}
    for t, (p0, y0) in starts.items():
        if t not in ends:
            continue
        p1, y1 = ends[t]
        if p0 == p1:
            h = y0 - y1
        else:
            h = (y0 - bottom) + (p1 - p0 - 1) * texth + (top - y1)
        out[t] = {'start': p0, 'end': p1, 'height': h, 'fits': h <= 0.97 * texth, 'split_ok': t in splits,
                  'y0': y0, 'y1': y1}
    refine_heights(os.path.join(build, 'main.pdf'), out, texth, bottom)
    return out, texth


def refine_heights(pdf, heights, texth, bottom):
    """A topic that breaks over two pages leaves white space at the foot of the first page
    (the box that did not fit). Measure the content actually printed instead, so a topic that
    would fit on one page is recognised as fitting."""
    split = {t: v for t, v in heights.items() if v['end'] == v['start'] + 1}
    if not split or not os.path.exists(pdf):
        return
    try:
        import pdfplumber
    except ImportError:
        return
    top_sp = bottom + texth
    with pdfplumber.open(pdf) as doc:
        for t, v in split.items():
            if v['start'] - 1 >= len(doc.pages):
                continue
            page = doc.pages[v['start'] - 1]
            W, H = page.width, page.height
            y0_from_top = H - v['y0'] / SP_PER_PT
            text_bottom_from_top = H - bottom / SP_PER_PT
            objs = [o for o in page.chars + page.rects + page.lines + page.images + page.curves
                    if o.get('x1', 0) < W * 0.88 and o.get('top', 0) >= y0_from_top - 1 and o.get('bottom', H) <= text_bottom_from_top + 1]
            if not objs:
                continue
            used_first = (max(o['bottom'] for o in objs) - y0_from_top) * SP_PER_PT
            used_second = top_sp - v['y1']
            h = used_first + used_second + 8 * SP_PER_PT
            v['height'] = h
            v['fits'] = h <= 0.97 * texth


def page_fill(pdf, rep, cfg, heights, texth_sp):
    try:
        import pdfplumber
    except ImportError:
        rep.note('pdfplumber is not installed, so empty space on pages was not measured (pip install pdfplumber).')
        return []
    flagged = []
    starts_by_page = {}
    for t, v in heights.items():
        starts_by_page.setdefault(v['start'], []).append(t)
    with pdfplumber.open(pdf) as doc:
        n = len(doc.pages)
        for i, page in enumerate(doc.pages, start=1):
            W, H = page.width, page.height
            objs = [o for o in page.chars + page.rects + page.lines + page.images + page.curves
                    if o.get('x1', 0) < W * 0.88 and o.get('top', 0) > 0.7 * 72 and o.get('bottom', H) < H - 0.65 * 72]
            if not objs:
                continue
            lowest = max(o['bottom'] for o in objs)
            text_bottom = H - 0.8 * 72
            text_top = 0.9 * 72 + 14 + 0.3 * 72
            empty = (text_bottom - lowest) / (text_bottom - text_top)
            flagged.append((i, empty))
    return flagged


def build(sheet, args):
    rep = Report()
    cfg = load_config(sheet, rep)
    if not cfg:
        rep.show()
        return 1
    only = set(args.only.split(',')) if args.only else None
    if only:
        known = {s['id'] for s in cfg['sections']}
        for o in only:
            if o not in known:
                rep.err('--only %s: no section with that id in sheet.json.' % o)
    for s in cfg['sections']:
        if not only or s['id'] in only:
            check_section(sheet, s, cfg, rep)
    if rep.errors or args.check:
        rep.show()
        if not rep.errors:
            print('\nSource checks passed.')
        return 1 if rep.errors else 0
    if not shutil.which('pdflatex'):
        rep.err('pdflatex is not installed. Install TeX Live (texlive-latex-extra, texlive-fonts-recommended) and run again.')
        rep.show()
        return 1

    build_dir = os.path.join(sheet, 'build' if not only else 'build-' + '-'.join(sorted(only)))
    stage(sheet, build_dir)
    breaks_path = os.path.join(build_dir, 'breaks.tex')
    open(breaks_path, 'w').write('')
    write_main(sheet, cfg, build_dir, only)
    dense = cfg.get('layout') == 'dense'
    breaks = []
    heights = {}
    for it in range(6):
        ok = pdflatex(build_dir) and pdflatex(build_dir)
        if not ok:
            log_problems(build_dir, rep, final=False)
            if not rep.errors:
                rep.err('LaTeX stopped. See %s/main.log.' % build_dir)
            rep.show()
            return 1
        if dense:
            break
        heights, texth = topic_heights(build_dir)
        firsts = {s['num'] + '.1' for s in cfg['sections']}
        new = [t for t, v in heights.items() if v['start'] != v['end'] and v['fits'] and not v['split_ok'] and t not in breaks and t not in firsts]
        if not new:
            break
        breaks += new
        open(breaks_path, 'w').write(''.join('\\breakbefore{%s}\n' % t for t in breaks))
    pdflatex(build_dir)
    log_problems(build_dir, rep, final=True)

    pdf_in = os.path.join(build_dir, 'main.pdf')
    if args.out:
        out = args.out
    elif only:
        out = os.path.join(sheet, 'draft-%s.pdf' % '-'.join(sorted(only)))
    else:
        out = os.path.join(sheet, re.sub(r'[\\/:*?"<>|]', '', cfg['title']) + '.pdf')
    shutil.copy(pdf_in, out)

    pages = 0
    try:
        from pypdf import PdfReader
        pages = len(PdfReader(out).pages)
    except Exception:
        pass
    if breaks:
        rep.note('moved to a new page so they are not split: topics %s.' % ', '.join(sorted(breaks, key=lambda x: [int(p) if p.isdigit() else p for p in x.split('.')])))
    firsts = {s['num'] + '.1' for s in cfg['sections']}
    got = read_positions(build_dir)
    for t, v in sorted(heights.items()):
        if v['start'] == v['end'] or v['split_ok']:
            continue
        if t in firsts and got and v['height'] <= texth:
            over = v['height'] - (v['y0'] - got[0][1])
            rep.warn('topic %s, the first of its section, runs onto the next page by about %d lines. Trim it so it stays on the section page, or put \\allowsplit after its \\cstopic.' % (t, max(1, round(over / SP_PER_PT / 12.5))))
        elif not v['fits']:
            rep.note('topic %s is longer than a page (%.2f pages), so it runs onto the next page. Fine if it must be that long; otherwise cut it or split it into two topics.' % (t, v['height'] / float(texth)))
    if not dense and heights:
        fills = page_fill(out, rep, cfg, heights, None)
        sec_last = {}
        got = read_positions(build_dir)
        starts = got[1] if got else {}
        first_page_of_topic = {v[0]: t for t, v in starts.items()}
        first_topics = {}
        for t in starts:
            sec = t.split('.')[0]
            key = [int(x) if x.isdigit() else 0 for x in t.split('.')]
            if sec not in first_topics or key < first_topics[sec][0]:
                first_topics[sec] = (key, t)
        section_starts = {v[1] for v in first_topics.values()}
        for i, empty in fills:
            if i == 1 or i == pages or empty <= 0.34:
                continue
            nxt = first_page_of_topic.get(i + 1)
            if nxt in section_starts:
                if empty > 0.6:
                    rep.note('page %d is %d%% empty because the section ends there and section %s starts a new page. Fine; check nothing is missing from the section.' % (i, round(empty * 100), nxt.split('.')[0]))
                continue
            if nxt and nxt in breaks:
                why = ' Topic %s was moved to the next page so it would not split. Shorten it or this page, or put \\allowsplit after its \\cstopic.' % nxt
            elif nxt:
                why = ' The next page starts topic %s, which did not fit here.' % nxt
            else:
                why = ' A long box or figure did not fit at the bottom; shrink it or move it.'
            rep.warn('page %d is %d%% empty.%s' % (i, round(empty * 100), why))
    budget = cfg.get('page_budget')
    if budget and pages and not only and pages > budget:
        rep.warn('the sheet has %d pages, over the page budget of %d in sheet.json. Cut what is least likely to be asked, or agree a new budget with the student.' % (pages, budget))

    if args.render:
        render_dir = os.path.join(build_dir, 'pages')
        if os.path.isdir(render_dir):
            shutil.rmtree(render_dir)
        os.makedirs(render_dir)
        subprocess.run(['pdftoppm', '-r', str(args.dpi), '-png', out, os.path.join(render_dir, 'p')], check=False)
        rep.note('pages rendered to %s (view them; the check above does not judge looks).' % render_dir)

    print('Built %s: %d pages, %d topics.' % (out, pages, len(heights)))
    rep.show()
    return 1 if rep.errors else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('--only', help='comma-separated section ids to build alone')
    ap.add_argument('--out')
    ap.add_argument('--render', action='store_true')
    ap.add_argument('--dpi', type=int, default=80)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    sys.exit(build(os.path.abspath(args.sheet), args))


if __name__ == '__main__':
    main()
