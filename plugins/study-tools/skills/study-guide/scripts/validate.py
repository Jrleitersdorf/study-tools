#!/usr/bin/env python3
"""Validate a study-guide folder before building, with plain, actionable messages.

Usage
  python3 validate.py outline <guide_dir> [--sources-dir DIR]   check guide.config.json + outline.json
  python3 validate.py guide   <guide_dir> [--allow-example] [--sources-dir DIR] [--only L6,exam]
                                                              check every content file (and the outline);
                                                              --only checks a subset for a partial (draft) build

Without --sources-dir, the uploads folder recorded as "sources_dir" in outline.json (absolute, or
relative to the guide folder) is used when it exists, so every check re-verifies the source map.

Exit code 0 when there are no errors (warnings are allowed), 1 otherwise.
Every message names the file, the line when known, what is wrong and how to fix it.
Only the Python standard library is used.
"""
import json, os, re, sys
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
QTYPES = {'mc', 'multi', 'tf', 'num'}
SOURCE_KINDS = {'slides', 'transcript', 'notes', 'reading', 'homework', 'practice-exam', 'review-sheet', 'hints', 'other'}
COMPONENTS = {'text', 'equation', 'figure', 'table', 'pitfall', 'worked-example', 'list', 'steps', 'subsection',
              'section-title', 'section-sources'}
SUB_COMPONENTS = COMPONENTS - {'subsection', 'section-title', 'section-sources'} | {'subsection-title'}
ID_RE = re.compile(r'^[A-Za-z][A-Za-z0-9-]*$')
QID_RE = re.compile(r'^[A-Za-z][A-Za-z0-9-]*_q\d+$')


class Node:
    __slots__ = ('tag', 'attrs', 'children', 'parent', 'line', 'text')

    def __init__(self, tag, attrs, parent, line):
        self.tag, self.attrs, self.parent, self.line = tag, dict(attrs), parent, line
        self.children, self.text = [], []

    def get(self, k, d=None):
        v = self.attrs.get(k, d)
        return d if v is None and d is not None else v

    def sg(self):
        return self.attrs.get('data-sg')

    def classes(self):
        return (self.attrs.get('class') or '').split()

    def iter(self):
        for c in self.children:
            yield c
            yield from c.iter()

    def find_all(self, pred):
        return [n for n in self.iter() if pred(n)]

    def find(self, pred):
        for n in self.iter():
            if pred(n):
                return n
        return None

    def content(self):
        out = []
        def walk(n):
            for piece in n.text:
                if isinstance(piece, Node):
                    walk(piece)
                else:
                    out.append(piece)
        walk(self)
        return re.sub(r'\s+', ' ', ''.join(out)).strip()


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', [], None, 1)
        self.cur = self.root
        self.comments = []

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur, self.getpos()[0])
        self.cur.children.append(n)
        self.cur.text.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        n = Node(tag, attrs, self.cur, self.getpos()[0])
        self.cur.children.append(n)
        self.cur.text.append(n)

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.text.append(data)

    def handle_comment(self, data):
        self.comments.append((self.getpos()[0], data))


def parse(path):
    raw = open(path, encoding='utf-8').read()
    t = Tree()
    t.feed(raw)
    t.close()
    return raw, t.root, t.comments


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, f, line, msg):
        self.errors.append('ERROR   %s%s  %s' % (f, ':%d' % line if line else '', msg))

    def warn(self, f, line, msg):
        self.warnings.append('WARNING %s%s  %s' % (f, ':%d' % line if line else '', msg))

    def print(self):
        for m in self.errors + self.warnings:
            print(m)
        print('\n%d error(s), %d warning(s).' % (len(self.errors), len(self.warnings)))
        if self.errors:
            print('Fix every ERROR before building. Warnings are worth reading: each one is a likely quality problem.')


def rel(guide, p):
    return os.path.relpath(p, guide)


def line_of(raw, idx):
    return raw.count('\n', 0, idx) + 1


# ---------------------------------------------------------------- config + outline
def load_json(rep, path, what):
    if not os.path.exists(path):
        rep.err(os.path.basename(path), 0, '%s is missing. Copy it from assets/template/ and fill it in.' % what)
        return None
    try:
        return json.load(open(path, encoding='utf-8'))
    except json.JSONDecodeError as e:
        rep.err(os.path.basename(path), e.lineno, 'is not valid JSON (%s). Fix the syntax: no comments, no trailing commas.' % e.msg)
        return None


def check_config(rep, guide):
    cfg = load_json(rep, os.path.join(guide, 'guide.config.json'), 'guide.config.json')
    if cfg is None:
        return None
    for k in ['guide_title', 'course', 'exam_name', 'unit_label', 'storage_key', 'header_kicker', 'scope_line']:
        if not str(cfg.get(k, '')).strip():
            rep.err('guide.config.json', 0, '"%s" is empty. Fill it in (see the "_%s" note in the template).' % (k, k))
    sk = str(cfg.get('storage_key', ''))
    if sk and not re.match(r'^[a-z0-9][a-z0-9-]*$', sk):
        rep.err('guide.config.json', 0, '"storage_key" must use lowercase letters, digits and hyphens only (got "%s").' % sk)
    if sk in ('phys100-quiz1',) and not os.path.basename(os.path.abspath(guide)) == 'example':
        rep.warn('guide.config.json', 0, '"storage_key" is still the template example. Give this guide its own key so progress is not shared with other guides.')
    if len(str(cfg.get('guide_title', ''))) > 60:
        rep.warn('guide.config.json', 0, '"guide_title" is long. Keep it to 2 to 6 words; it is the artifact name.')
    return cfg


def check_outline(rep, guide, sources_dir=None, require_files=True):
    o = load_json(rep, os.path.join(guide, 'outline.json'), 'outline.json')
    if o is None:
        return None
    units = o.get('units') or []
    if not units:
        rep.err('outline.json', 0, '"units" is empty. List one entry per unit page, in reading order.')
    seen = set()
    for i, u in enumerate(units):
        uid = u.get('id', '')
        where = 'units[%d]' % i
        if not ID_RE.match(uid or ''):
            rep.err('outline.json', 0, '%s has id "%s". Unit ids use letters, digits and hyphens and start with a letter (no dots or underscores), e.g. "L6" or "u3".' % (where, uid))
        if uid in seen:
            rep.err('outline.json', 0, 'unit id "%s" appears twice. Every unit needs its own id.' % uid)
        seen.add(uid)
        for k in ['num', 'title', 'file', 'questions', 'solutions']:
            if not str(u.get(k, '')).strip():
                rep.err('outline.json', 0, '%s ("%s") has no "%s".' % (where, uid, k))
        for k in ['file', 'questions', 'solutions']:
            p = u.get(k)
            if p and require_files and not os.path.exists(os.path.join(guide, p)):
                rep.err('outline.json', 0, '%s ("%s") points "%s" to %s, which does not exist yet. Create it from the template or fix the path.' % (where, uid, k, p))
        if not u.get('sources'):
            rep.warn('outline.json', 0, 'unit "%s" lists no sources. Every unit should name the files it is written from.' % uid)
    ex = o.get('exam')
    if ex:
        if 'minutes' in ex:
            rep.warn('outline.json', 0, 'exam has "minutes", which is ignored. Set the practice exam length as "practice_minutes" in guide.config.json.')
        for k in ['file', 'questions', 'solutions']:
            p = ex.get(k)
            if not p:
                rep.err('outline.json', 0, 'exam has no "%s".' % k)
            elif require_files and not os.path.exists(os.path.join(guide, p)):
                rep.err('outline.json', 0, 'exam "%s" points to %s, which does not exist yet.' % (k, p))
    if not sources_dir and o.get('sources_dir'):
        sd0 = o['sources_dir'] if os.path.isabs(o['sources_dir']) else os.path.join(guide, o['sources_dir'])
        if os.path.isdir(sd0):
            sources_dir = sd0
        else:
            rep.warn('outline.json', 0, '"sources_dir" is "%s", which is not a folder. Fix the path so the source map can be checked against the uploads.' % o['sources_dir'])
    srcs = o.get('sources')
    if not srcs:
        rep.err('outline.json', 0, '"sources" is empty. List EVERY uploaded file once, with the units it feeds (the source map).')
        srcs = []
    paths = set()
    for s in srcs:
        p = s.get('path', '')
        if p in paths:
            rep.err('outline.json', 0, 'source "%s" is listed twice.' % p)
        paths.add(p)
        if s.get('kind') not in SOURCE_KINDS:
            rep.warn('outline.json', 0, 'source "%s" has kind "%s". Use one of: %s.' % (p, s.get('kind'), ', '.join(sorted(SOURCE_KINDS))))
        for uref in s.get('units', []):
            if uref not in seen:
                rep.err('outline.json', 0, 'source "%s" maps to unit "%s", which is not in "units".' % (p, uref))
        if not s.get('units') and s.get('use') not in ('exam-intel', 'excluded'):
            rep.err('outline.json', 0, 'source "%s" feeds no unit. Map it to the units it supports, or set "use" to "exam-intel" or "excluded" with a "note" saying why. Nothing may be dropped silently.' % p)
        if s.get('use') == 'excluded' and not s.get('note'):
            rep.err('outline.json', 0, 'source "%s" is excluded without a "note". Say why it is not used.' % p)
    if sources_dir:
        found = []
        for dp, dn, fn in os.walk(sources_dir):
            dn[:] = [d for d in dn if not d.startswith('.')]
            for f in fn:
                if not f.startswith('.'):
                    found.append(os.path.relpath(os.path.join(dp, f), sources_dir))
        for f in sorted(found):
            if f not in paths and not any(f.endswith(p) or p.endswith(f) for p in paths):
                rep.err('outline.json', 0, 'uploaded file "%s" is not in the source map. Add it to "sources" (map it to units, or mark it exam-intel or excluded with a note).' % f)
        for p in sorted(paths):
            if not any(f == p or f.endswith(p) or p.endswith(f) for f in found):
                rep.warn('outline.json', 0, 'source "%s" was not found under %s. Check the path.' % (p, sources_dir))
    covered = {uid for s in srcs for uid in s.get('units', [])}
    for uid in seen - covered:
        rep.warn('outline.json', 0, 'no source in "sources" maps to unit "%s". Map the files it is written from.' % uid)
    return o


# ---------------------------------------------------------------- content
def check_math(rep, f, raw):
    for m in re.finditer(r'\\\((.*?)\\\)|\\\[(.*?)\\\]', raw, re.S):
        body = m.group(1) if m.group(1) is not None else m.group(2)
        ln = line_of(raw, m.start())
        if re.search(r'<(?![/a-zA-Z!])|<(?=[a-zA-Z]\b)|<(?=\s)', body) or re.search(r'(?<![\\a-zA-Z])>', body.replace('->', '')):
            if re.search(r'</?(b|i|span|a|br|sub|sup|em|strong)\b', body) is None:
                rep.err(f, ln, 'a raw < or > inside math: "%s". The HTML parser breaks it. Write \\lt and \\gt.' % body.strip()[:60])
        if re.search(r'&(?!amp;|lt;|gt;|nbsp;|#\d+;|#x[0-9a-fA-F]+;)', body):
            rep.err(f, ln, 'a raw & inside math: "%s". In HTML write &amp; (for example in aligned: a &amp;= b).' % body.strip()[:60])
        if body.count('{') != body.count('}'):
            rep.err(f, ln, 'unbalanced braces in math: "%s". MathJax will show an error box.' % body.strip()[:60])
    # math delimiters left open
    if raw.count('\\(') != raw.count('\\)'):
        rep.err(f, 0, 'the number of \\( and \\) differs (%d vs %d). Some inline math is not closed.' % (raw.count('\\('), raw.count('\\)')))
    if raw.count('\\[') != raw.count('\\]'):
        rep.err(f, 0, 'the number of \\[ and \\] differs (%d vs %d). Some display math is not closed.' % (raw.count('\\['), raw.count('\\]')))


def check_style(rep, f, raw, cfg, allow_example):
    style = (cfg or {}).get('style', {}) or {}
    if style.get('no_em_dashes', True):
        body = re.sub(r'<!--.*?-->', lambda m: '\n' * m.group(0).count('\n'), raw, flags=re.S)
        for m in re.finditer('\u2014', body):
            ln = line_of(body, m.start())
            ctx = body[max(0, m.start() - 30):m.start() + 30].replace('\n', ' ')
            rep.err(f, ln, 'an em dash ("...%s..."). The style forbids them: use a comma, colon, semicolon or parentheses.' % ctx)
    if '{{' in re.sub(r'<!--.*?-->', '', raw, flags=re.S):
        rep.err(f, 0, 'a leftover {{placeholder}}. Replace it with real content.')
    if not allow_example and 'data-example' in raw:
        rep.err(f, 0, 'still contains data-example="true" (template example content). Replace the example content and remove the attribute.')
    # The unit-scope line and the section-sources labels are where sources are named; skip them.
    body = re.sub(r'<!--.*?-->', lambda m: '\n' * m.group(0).count('\n'), raw, flags=re.S)
    body = re.sub(r'<(\w+)[^>]*data-sg="(?:unit-scope|section-sources)"[^>]*>.*?</\1>', lambda m: '\n' * m.group(0).count('\n'), body, flags=re.S)
    pat = (r'\b(?:see|on|in) (?:the )?(?:slides?|pages?) \d+(?:\s*(?:to|-|and)\s*\d+)?'
           r'|\bas shown (?:on|in) (?:the )?(?:slide|reading|figure on)[^.,;]*'
           r'|\bthe slides? (?:shows?|says?|states?)\b')
    for m in re.finditer(pat, body, re.I):
        rep.warn(f, line_of(body, m.start()), 'a pointer to the sources ("%s"). Outside the unit-scope line and the section-sources labels the guide must be self-contained: teach the content instead.' % m.group(0))


def unit_checks(rep, guide, u, cfg, all_ids, allow_example, qids, sol_ids, exam=False):
    f = u['file'] if not exam else u['file']
    path = os.path.join(guide, f)
    if not os.path.exists(path):
        return
    raw, root, comments = parse(path)
    check_math(rep, f, raw)
    check_style(rep, f, raw, cfg, allow_example)
    if '<!--QUESTIONS-->' not in raw:
        rep.err(f, 0, 'the <!--QUESTIONS--> marker is missing. Keep it where the questions go (see the template).')
    if exam:
        sec = root.find(lambda n: n.sg() == 'exam')
        if not sec:
            rep.err(f, 0, 'no <section data-sg="exam">. Start from assets/template/exam.html.')
            return
        if sec.get('id') != 'exam':
            rep.err(f, sec.line, 'the exam section id must be "exam".')
        if 'exam-page' not in sec.classes():
            rep.err(f, sec.line, 'the exam section needs class="exam-page".')
        body = sec.find(lambda n: n.sg() == 'exam-body')
        if not body or body.get('id') != 'exam-q':
            rep.err(f, sec.line, 'the exam needs <div class="exam-body" id="exam-q" data-sg="exam-body">.')
        if not sec.find(lambda n: n.sg() == 'exam-instructions'):
            rep.warn(f, sec.line, 'no exam-instructions paragraph. Say the format, the number of questions and the conditions.')
        if raw.find('<!--QUESTIONS-->') > raw.find('data-sg="exam-submit"') >= 0:
            rep.err(f, 0, 'the <!--QUESTIONS--> marker must come before the exam-submit div.')
        if sec.get('data-minutes') is not None:
            rep.warn(f, sec.line, 'data-minutes on the exam section is ignored. Set the practice exam length as "practice_minutes" in guide.config.json.')
        if not str((cfg or {}).get('practice_minutes', '')).strip():
            rep.warn('guide.config.json', 0, '"practice_minutes" is not set, so the practice exam has no time target. Set it (the real exam length, or the guide\'s share of it).')
        for n in root.iter():
            if n.get('id'):
                all_ids.setdefault(n.get('id'), []).append(f)
        return
    secs = root.find_all(lambda n: n.sg() == 'unit')
    if len(secs) != 1:
        rep.err(f, 0, 'must contain exactly one <section data-sg="unit"> (found %d).' % len(secs))
        return
    s = secs[0]
    uid = u['id']
    if s.get('id') != uid:
        rep.err(f, s.line, 'the unit section id is "%s" but outline.json says "%s". Make them the same.' % (s.get('id'), uid))
    if 'unit' not in s.classes():
        rep.err(f, s.line, 'the unit section needs class="unit".')
    if (s.get('data-num') or '') != str(u.get('num', '')):
        rep.err(f, s.line, 'data-num is "%s" but outline.json says "%s".' % (s.get('data-num'), u.get('num')))
    if not (s.get('data-title') or '').strip():
        rep.err(f, s.line, 'data-title is empty. Put the unit title there.')
    for tag, msg in [('unit-head', 'the unit-head block'), ('unit-kicker', 'the unit-kicker line'), ('unit-title', 'the unit title (h2)'),
                     ('unit-scope', 'the one-sentence unit-scope line'), ('takeaway', 'the takeaway box')]:
        if not s.find(lambda n, t=tag: n.sg() == t):
            rep.err(f, s.line, 'missing %s (data-sg="%s"). Copy it from the template.' % (msg, tag))
    tk = s.find(lambda n: n.sg() == 'takeaway')
    if tk:
        words = len(tk.content().split())
        if words < 25:
            rep.warn(f, tk.line, 'the takeaway is very short (%d words). Aim for 3 to 6 sentences that state the core results.' % words)
        if words > 170:
            rep.warn(f, tk.line, 'the takeaway is long (%d words). Keep it to 3 to 6 sentences.' % words)
    sects = s.find_all(lambda n: n.sg() == 'section')
    if not sects:
        rep.err(f, s.line, 'no sections (data-sg="section"). A unit needs at least one numbered section.')
    num = str(u.get('num', ''))
    for k, sc in enumerate(sects, 1):
        sid = sc.get('id', '')
        if sid != '%s-%d' % (uid, k):
            rep.err(f, sc.line, 'section id "%s" should be "%s-%d" (sections are numbered in order).' % (sid, uid, k))
        if 'sect' not in sc.classes():
            rep.err(f, sc.line, 'section %s needs class="sect".' % sid)
        h = sc.find(lambda n: n.sg() == 'section-title')
        if not h:
            rep.err(f, sc.line, 'section %s has no section-title (h3).' % sid)
        else:
            nn = h.find(lambda n: 'n' in n.classes())
            want = '%s.%d' % (num, k)
            if not nn:
                rep.err(f, h.line, 'section %s title needs <span class="n">%s</span> before the title text.' % (sid, want))
            elif nn.content() != want:
                rep.err(f, h.line, 'section %s is numbered "%s" but should be "%s".' % (sid, nn.content(), want))
            if not h.get('data-short'):
                rep.warn(f, h.line, 'section %s title has no data-short (the 1 to 4 word label for the contents).' % sid)
        if not sc.find(lambda n: n.sg() == 'section-sources'):
            rep.warn(f, sc.line, 'section %s has no section-sources line (which source material it covers).' % sid)
        for ch in sc.children:
            t = ch.sg()
            if t is None:
                rep.warn(f, ch.line, 'a <%s> inside section %s has no data-sg tag. Every block needs one (see template-reference.md).' % (ch.tag, sid))
            elif t not in COMPONENTS:
                rep.warn(f, ch.line, 'data-sg="%s" is not a component that belongs directly in a section.' % t)
            if t == 'subsection':
                if not ch.find(lambda n: n.sg() == 'subsection-title'):
                    rep.err(f, ch.line, 'a subsection in %s has no subsection-title (h4).' % sid)
                for c2 in ch.children:
                    if c2.sg() is None:
                        rep.warn(f, c2.line, 'a <%s> inside a subsection of %s has no data-sg tag.' % (c2.tag, sid))
        for p in sc.find_all(lambda n: n.sg() == 'text'):
            sentences = len(re.findall(r'[.!?](\s|$)', re.sub(r'\\\(.*?\\\)', 'x', p.content())))
            if sentences > 5:
                rep.warn(f, p.line, 'a paragraph in %s has about %d sentences. The default style is 2 to 3 per paragraph.' % (sid, sentences))
    for eq in s.find_all(lambda n: n.sg() == 'equation'):
        if not eq.find(lambda n: n.sg() == 'equation-name'):
            rep.warn(f, eq.line, 'an equation card has no equation-name.')
        m = eq.find(lambda n: n.sg() == 'equation-math')
        if not m or '\\[' not in m.content():
            rep.err(f, eq.line, 'an equation card needs <div class="eq-math" data-sg="equation-math">\\[ ... \\]</div>.')
    for fig in s.find_all(lambda n: n.sg() == 'figure'):
        img = fig.find(lambda n: n.tag == 'img')
        if not img:
            rep.err(f, fig.line, 'a figure has no <img>.')
            continue
        src = img.get('src', '')
        if not src.startswith('data:') and not os.path.exists(os.path.join(guide, src)):
            rep.err(f, img.line, 'image "%s" does not exist in the guide folder. Put the file in img/ or fix the path.' % src)
        if not (img.get('alt') or '').strip():
            rep.err(f, img.line, 'image "%s" has no alt text. Describe what it shows in 1 to 2 sentences.' % src)
        if not fig.find(lambda n: n.sg() == 'figure-caption'):
            rep.warn(f, fig.line, 'figure "%s" has no figure-caption saying what to notice.' % src)
    for pit in s.find_all(lambda n: n.sg() == 'pitfall'):
        if not pit.content().startswith('Watch out'):
            rep.warn(f, pit.line, 'a pitfall should start with <b>Watch out.</b>')
    tags_exam = s.find_all(lambda n: n.sg() == 'exam-tag')
    lbl = (cfg or {}).get('exam_hint_label')
    for t in tags_exam:
        if lbl and t.content() != lbl:
            rep.warn(f, t.line, 'exam-tag text "%s" differs from config exam_hint_label "%s".' % (t.content(), lbl))
    qb = s.find(lambda n: n.sg() == 'questions')
    if not qb:
        rep.err(f, s.line, 'no questions block (details data-sg="questions"). Copy it from the template.')
    elif qb.get('id') != uid + '-q':
        rep.err(f, qb.line, 'the questions block id must be "%s-q".' % uid)
    cf = s.find(lambda n: n.sg() == 'confidence')
    if not cf:
        rep.warn(f, s.line, 'no confidence block. Copy it from the template.')
    elif cf.get('data-sec') != uid:
        rep.err(f, cf.line, 'the confidence block needs data-sec="%s".' % uid)
    for n in root.iter():
        if n.get('id'):
            all_ids.setdefault(n.get('id'), []).append(f)


def question_checks(rep, guide, qfile, sfile, cfg, all_ids, allow_example, qids, sol_ids, unit_ids, exam=False):
    qpath, spath = os.path.join(guide, qfile), os.path.join(guide, sfile)
    if not os.path.exists(qpath) or not os.path.exists(spath):
        return
    qraw, qroot, _ = parse(qpath)
    sraw, sroot, _ = parse(spath)
    for f, raw in ((qfile, qraw), (sfile, sraw)):
        check_math(rep, f, raw)
        check_style(rep, f, raw, cfg, allow_example)
    sols = {}
    for so in sroot.find_all(lambda n: 'sol' in n.classes() and n.get('data-for')):
        fid = so.get('data-for')
        if fid in sols:
            rep.err(sfile, so.line, 'two worked solutions for "%s".' % fid)
        sols[fid] = so
        sol_ids.setdefault(fid, []).append(sfile)
        if so.sg() != 'solution':
            rep.warn(sfile, so.line, 'solution "%s" should carry data-sg="solution".' % fid)
        if not so.find(lambda n: 'ws' in n.classes()):
            rep.err(sfile, so.line, 'solution "%s" has no steps list (<ol class="ws">).' % fid)
        if not so.find(lambda n: 'sol-a' in n.classes()):
            rep.err(sfile, so.line, 'solution "%s" has no answer line (<p class="sol-a"><b>Answer:</b> ...).' % fid)
    checks = qroot.find_all(lambda n: 'check' in n.classes())
    if not checks:
        rep.err(qfile, 0, 'no questions (<div class="check" data-sg="question">).')
    for c in checks:
        qid, typ, ans = c.get('data-id', ''), c.get('data-type', ''), c.get('data-ans', '')
        where = 'question "%s"' % qid
        if c.sg() != 'question':
            rep.warn(qfile, c.line, '%s should carry data-sg="question".' % where)
        if exam:
            if not re.match(r'^exam_q\d+$', qid):
                rep.err(qfile, c.line, 'exam question id "%s" should look like "exam_q3".' % qid)
            fr = c.get('data-from')
            if not fr:
                rep.warn(qfile, c.line, '%s has no data-from naming the unit it tests (used for the score breakdown).' % where)
            elif fr not in unit_ids:
                rep.err(qfile, c.line, '%s has data-from="%s", which is not a unit id.' % (where, fr))
        elif not QID_RE.match(qid):
            rep.err(qfile, c.line, 'question id "%s" should look like "<unit-id>_q<n>", e.g. "L6_q3".' % qid)
        if qid in qids:
            rep.err(qfile, c.line, 'question id "%s" is used twice in the guide. Ids must be unique.' % qid)
        qids[qid] = qfile
        if typ not in QTYPES:
            rep.err(qfile, c.line, '%s has data-type="%s". Use mc, multi, tf or num.' % (where, typ))
            continue
        stem = c.find(lambda n: 'qt' in n.classes())
        if not stem or not stem.content():
            rep.err(qfile, c.line, '%s has no stem (<p class="qt">).' % where)
        else:
            st = stem.content()
            m = re.search(r'\b(above|below|previous question|from the slides?|in (the )?lecture|as shown|this example|the figure)\b', st, re.I)
            if m:
                rep.warn(qfile, stem.line, '%s stem says "%s". Stems must be self-contained: restate what the reader needs.' % (where, m.group(0)))
        opts = c.find_all(lambda n: n.tag == 'li' and n.get('data-k') is not None)
        keys = [o.get('data-k') for o in opts]
        if typ in ('mc', 'multi'):
            if len(opts) < 2:
                rep.err(qfile, c.line, '%s needs options (<ol class="opts"><li data-k="a">...).' % where)
            elif not 3 <= len(opts) <= 6 and typ == 'mc':
                rep.warn(qfile, c.line, '%s has %d options. Use 3 to 5.' % (where, len(opts)))
            if len(set(keys)) != len(keys):
                rep.err(qfile, c.line, '%s has two options with the same data-k.' % where)
            ak = [a.strip() for a in ans.split(',') if a.strip()]
            for a in ak:
                if a not in keys:
                    rep.err(qfile, c.line, '%s has data-ans="%s" but no option with data-k="%s". Fix the key or the option.' % (where, ans, a))
            if typ == 'mc' and len(ak) != 1:
                rep.err(qfile, c.line, '%s is single-answer (mc) but data-ans lists %d keys. Use data-type="multi" or one key.' % (where, len(ak)))
            if typ == 'multi' and len(ak) < 2:
                rep.warn(qfile, c.line, '%s is select-all (multi) with only one right option. Make it mc, or check the key.' % where)
            for o in opts:
                if re.search(r'\ball of the above\b|\bnone of the above\b', o.content(), re.I):
                    rep.warn(qfile, o.line, '%s uses "all/none of the above". Write a real option instead.' % where)
        elif typ == 'tf':
            if ans not in ('T', 'F'):
                rep.err(qfile, c.line, '%s is true/false; data-ans must be "T" or "F" (got "%s").' % (where, ans))
            if opts:
                rep.err(qfile, c.line, '%s is true/false and must not list options; the engine draws True and False.' % where)
        elif typ == 'num':
            try:
                float(ans)
            except ValueError:
                rep.err(qfile, c.line, '%s has data-ans="%s". A numeric key must be a plain decimal number (e.g. 0.36788).' % (where, ans))
            else:
                frac = ans.split('.', 1)[1] if '.' in ans else ''
                sig = len(re.sub(r'^0+', '', ans.lstrip('-+').replace('.', '')))
                if len(frac) >= 4 and sig < 5:
                    rep.warn(qfile, c.line, '%s has data-ans="%s": %d decimals but only %d significant digits, which looks rounded. Store the exact value when it terminates (0.125), otherwise at least 5 significant digits (0.19149, not 0.1915).' % (where, ans, len(frac), sig))
            if c.get('data-tol') is None:
                rep.warn(qfile, c.line, '%s has no data-tol; the default 0.005 is used. Set a tolerance that fits the scale.' % where)
            if opts:
                rep.err(qfile, c.line, '%s is numeric and must not list options.' % where)
        if not c.find(lambda n: 'expl' in n.classes()):
            rep.warn(qfile, c.line, '%s has no explanation (<div class="expl">).' % where)
        so = sols.get(qid)
        if not so:
            rep.err(sfile, 0, 'no worked solution for %s. Add <div class="sol" data-for="%s"> to %s.' % (where, qid, sfile))
            continue
        sa = so.find(lambda n: 'sol-a' in n.classes())
        if sa:
            txt = sa.content()
            if typ == 'num':
                try:
                    key, tol = float(ans), float(c.get('data-tol') or 0.005)
                    nums = [float(x.replace(',', '')) for x in re.findall(r'-?\d[\d,]*\.?\d*(?:e-?\d+)?', txt) if re.match(r'^-?\d', x)]
                    if nums and not any(abs(v - key) <= max(tol, abs(key) * 0.002) for v in nums):
                        rep.err(sfile, sa.line, 'the answer line of %s ("%s") does not show the key %s. The solution must reach exactly the key.' % (where, txt[:60], ans))
                except ValueError:
                    pass
            elif typ == 'tf':
                want = 'True' if ans == 'T' else 'False'
                if want not in txt:
                    rep.err(sfile, sa.line, 'the answer line of %s should say "%s" (the key is %s).' % (where, want, ans))
            else:
                letters = {k: 'abcdefgh'[i] for i, k in enumerate(keys)}
                for a in [x.strip() for x in ans.split(',')]:
                    if a in letters and '(' + letters[a] + ')' not in txt:
                        rep.err(sfile, sa.line, 'the answer line of %s ("%s") does not name option (%s), which is in the key.' % (where, txt[:60], letters[a]))
    for fid in sols:
        if fid not in qids:
            rep.err(sfile, sols[fid].line, 'worked solution for "%s" matches no question. Fix data-for or delete it.' % fid)


def check_guide(guide, allow_example=False, sources_dir=None, only=None):
    """only: a set of unit ids (and optionally 'exam') for a partial build such as the early one-unit draft."""
    rep = Report()
    cfg = check_config(rep, guide)
    o = check_outline(rep, guide, sources_dir, require_files=not only)
    if o is None:
        return rep
    all_ids, qids, sol_ids = {}, {}, {}
    unit_ids = {u.get('id') for u in o.get('units', [])}
    later = set(unit_ids)
    for u in o.get('units', []):
        later |= {sec.get('id') for sec in u.get('sections', []) if sec.get('id')} | {u.get('id', '') + '-q'}
    units = [u for u in o.get('units', []) if not only or u.get('id') in only]
    if only:
        missing = [x for x in only if x != 'exam' and x not in unit_ids]
        if missing:
            rep.err('outline.json', 0, '--only names %s, which is not a unit id in outline.json.' % ', '.join(missing))
        for u in units:
            for k in ['file', 'questions', 'solutions']:
                if u.get(k) and not os.path.exists(os.path.join(guide, u[k])):
                    rep.err('outline.json', 0, 'unit "%s" points "%s" to %s, which does not exist yet.' % (u.get('id'), k, u[k]))
    for u in units:
        unit_checks(rep, guide, u, cfg, all_ids, allow_example, qids, sol_ids)
        if u.get('questions') and u.get('solutions'):
            question_checks(rep, guide, u['questions'], u['solutions'], cfg, all_ids, allow_example, qids, sol_ids, unit_ids)
            for qid in list(qids):
                if qids[qid] == u['questions'] and not qid.startswith(u.get('id', '') + '_'):
                    rep.warn(u['questions'], 0, 'question "%s" is in unit "%s" but its id does not start with "%s_".' % (qid, u.get('id'), u.get('id')))
    ex = o.get('exam')
    if only and 'exam' not in only:
        ex = None
    if ex:
        unit_checks(rep, guide, {'file': ex['file'], 'id': 'exam'}, cfg, all_ids, allow_example, qids, sol_ids, exam=True)
        question_checks(rep, guide, ex['questions'], ex['solutions'], cfg, all_ids, allow_example, qids, sol_ids, unit_ids, exam=True)
    for i, fs in all_ids.items():
        if len(fs) > 1:
            rep.err(fs[0], 0, 'id "%s" is used more than once (%s). Ids must be unique across the guide.' % (i, ', '.join(sorted(set(fs)))))
    # links resolve
    reserved = {'intro', 'summary', 'exam', 'toc'}
    files = [u['file'] for u in units if u.get('file')] + ([ex['file']] if ex else [])
    files += [u.get('questions') for u in units if u.get('questions')] + [u.get('solutions') for u in units if u.get('solutions')]
    for f in files:
        p = os.path.join(guide, f)
        if not os.path.exists(p):
            continue
        raw = open(p, encoding='utf-8').read()
        raw_nc = re.sub(r'<!--.*?-->', lambda m: '\n' * m.group(0).count('\n'), raw, flags=re.S)
        for m in re.finditer(r'href="#([^"]+)"', raw_nc):
            if m.group(1) not in all_ids and m.group(1) not in reserved:
                if only and m.group(1) in later:
                    rep.warn(f, line_of(raw_nc, m.start()), 'link to "#%s", a unit or section that is in the outline but not in this partial build; it will work in the full build.' % m.group(1))
                else:
                    rep.err(f, line_of(raw_nc, m.start()), 'link to "#%s", which is not an id anywhere in the guide. Link only to units and sections listed in outline.json.' % m.group(1))
    total_q = len([q for q in qids if not q.startswith('exam_')])
    if units and total_q < 6 * len(units):
        rep.warn('outline.json', 0, 'only %d practice questions for %d unit(s). Aim for 6 to 15 per unit, more when practice exams were supplied.' % (total_q, len(units)))
    for u in units:
        p = os.path.join(guide, u.get('file', ''))
        if u.get('file') and os.path.exists(p) and not allow_example:
            n = prose_words(open(p, encoding='utf-8').read())
            if n < 1500:
                rep.warn(u['file'], 0, 'about %d words of prose (math not counted). The target is 2,000 to 3,000 (15 to 20 minutes of reading): check nothing exam-relevant is missing.' % n)
            elif n > 3600:
                rep.warn(u['file'], 0, 'about %d words of prose (math not counted). The target is 2,000 to 3,000: trim the lowest-value material or split the unit.' % n)
    return rep


def prose_words(raw):
    """Words of prose in a unit file, as writing.md counts them: comments, the questions block,
    tables, display math and inline math are removed before counting; equation names, symbol
    definitions, captions, pitfalls and examples count as prose."""
    import html as _h
    s = re.sub(r'<!--.*?-->', '', raw, flags=re.S)
    s = re.sub(r'<details.*?</details>', '', s, flags=re.S)
    s = re.sub(r'<table.*?</table>', '', s, flags=re.S)
    s = re.sub(r'\\\[.*?\\\]', '', s, flags=re.S)
    s = re.sub(r'\\\(.*?\\\)', '', s, flags=re.S)
    t = _h.unescape(re.sub(r'<[^>]+>', ' ', s))
    return len([w for w in t.split() if re.search(r'[A-Za-z0-9]', w)])


def check_assembled(html):
    """Checks on the built single-file guide. Returns a list of error strings."""
    errs = []
    html = html.split('<script>window.SG', 1)[0]
    ids = re.findall(r'\sid="([^"]+)"', html)
    dups = sorted({i for i in ids if ids.count(i) > 1})
    if dups:
        errs.append('duplicate ids in the built guide: %s' % ', '.join(dups[:10]))
    idset = set(ids) | {'toc'}
    broken = sorted({l for l in re.findall(r'href="#([^"]+)"', html) if l not in idset})
    if broken:
        errs.append('links to missing ids in the built guide: %s' % ', '.join(broken[:10]))
    if '{{' in html:
        errs.append('a {{placeholder}} survived into the built guide; check guide.config.json and the template overrides.')
    return errs


def main(argv):
    if len(argv) < 3 or argv[1] not in ('outline', 'guide'):
        print(__doc__)
        return 2
    guide = argv[2]
    allow = '--allow-example' in argv
    sd = None
    if '--sources-dir' in argv:
        sd = argv[argv.index('--sources-dir') + 1]
    only = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
    if argv[1] == 'outline':
        rep = Report()
        check_config(rep, guide)
        check_outline(rep, guide, sd, require_files=False)
    else:
        rep = check_guide(guide, allow, sd, only)
    rep.print()
    return 1 if rep.errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
