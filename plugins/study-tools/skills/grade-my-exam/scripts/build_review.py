#!/usr/bin/env python3
"""Check a review.json and build the exam review page from it.

Usage
  python3 build_review.py <review.json> [--out FILE] [--check] [--force]

  --check   only validate and print the computed score; write nothing
  --force   build even when there are errors (for a quick look; never publish such a page)

The data format is described in ../assets/template/review.html (header comment). This script:
  1. reads review.json and reports every problem in plain language (ERROR stops the build,
     WARN does not);
  2. computes the score (exact points plus the low / likely / high range of estimated written
     marks), the right / partly / wrong / blank / unsure counts, and the points per unit and habit;
  3. embeds every image as a data URI, so the page is one self-contained file;
  4. marks whether any text contains \\( \\) or \\[ \\] math: only then does the page load
     MathJax 3.2.2 from cdnjs (it also loads it later if a Claude answer contains math);
  5. writes <folder of review.json>/exam_review.html (or --out) and prints a one-line summary.

Exit code: 0 built, 1 errors found, 2 bad usage or unreadable file.
"""
import base64
import difflib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.normpath(os.path.join(HERE, '..', 'assets', 'template'))
TYPES = {'mc', 'multi', 'tf', 'num', 'written'}
VERDICTS = {'right', 'partial', 'wrong', 'blank'}
CONF = {'solid', 'unsure', 'guessed'}
IMG_TYPES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml'}
MAX_IMAGES_BYTES = 12 * 1024 * 1024


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append('%s: %s' % (where, msg))

    def warn(self, where, msg):
        self.warnings.append('%s: %s' % (where, msg))


def num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def fmt(x):
    return ('%.2f' % x).rstrip('0').rstrip('.')


def walk_strings(obj, path=''):
    """Yield (path, string) for every string in the data, skipping image sources."""
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k in ('src', 'storage_key', 'id', 'type', 'verdict', 'confidence', 'kind', 'exam_mode', 'lang'):
                continue
            yield from walk_strings(v, '%s.%s' % (path, k) if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, '%s[%d]' % (path, i))


def lint_text(rep, data):
    """Style and math checks on every piece of text."""
    has_math = False
    for path, s in walk_strings(data):
        if path.startswith('summary'):
            continue
        if '\u2014' in s and not data.get('meta', {}).get('allow_em_dashes'):
            rep.err(path, 'contains an em dash. The default style has none: use a comma, a colon or two sentences.')
        stripped = re.sub(r'```.*?```', '', s, flags=re.S)
        stripped = re.sub(r'`[^`\n]*`', '', stripped)
        if '\\(' in stripped or '\\[' in stripped:
            has_math = True
        if stripped.count('\\(') != stripped.count('\\)'):
            rep.err(path, 'has %d "\\(" but %d "\\)". Every inline formula needs both.' % (stripped.count('\\('), stripped.count('\\)')))
        if stripped.count('\\[') != stripped.count('\\]'):
            rep.err(path, 'has %d "\\[" but %d "\\]". Every display formula needs both.' % (stripped.count('\\['), stripped.count('\\]')))
        if re.search(r'(?<![\\$])\$[^$\s][^$]*\$', stripped):
            rep.warn(path, 'looks like it uses $...$ math. The page only typesets \\( \\) and \\[ \\].')
        for m in re.finditer(r'\\\((.*?)\\\)|\\\[(.*?)\\\]', stripped, flags=re.S):
            body = m.group(1) or m.group(2) or ''
            if re.search(r'[\w)}]\s*/\s*[\w({\\]', body):
                rep.warn(path, 'writes a fraction with a slash inside math (%s). Use \\frac{a}{b}.' % body.strip()[:40])
        if s.count('```') % 2:
            rep.err(path, 'has an unclosed ``` code fence.')
    return has_math


def check_image(rep, where, o, base, budget):
    if o is None:
        return
    if not isinstance(o, dict) or not isinstance(o.get('src'), str):
        rep.err(where, 'an image must be {"src": "img/name.png", "alt": "..."}.')
        return
    if not o.get('alt'):
        rep.warn(where, 'image has no "alt" text. Describe what it shows (it also goes into the Ask prompt).')
    src = o['src']
    if src.startswith('data:'):
        budget[0] += len(src)
        return
    path = os.path.normpath(os.path.join(base, src))
    ext = os.path.splitext(path)[1].lower()
    if ext not in IMG_TYPES:
        rep.err(where, 'image "%s" must be png, jpg, gif, webp or svg.' % src)
        return
    if not os.path.exists(path):
        rep.err(where, 'image file "%s" was not found next to review.json (looked at %s).' % (src, path))
        return
    budget[0] += os.path.getsize(path) * 4 // 3
    o['_path'] = path


def validate(data, base):
    rep = Report()
    if not isinstance(data, dict):
        rep.err('file', 'the top level must be an object with "meta", "units", "habits", "questions", "lessons" and "fixes".')
        return rep, False
    meta = data.get('meta')
    if not isinstance(meta, dict):
        rep.err('meta', 'is missing. It holds title, course, exam, kind, key_source and storage_key.')
        meta = {}
    for k in ('title', 'course', 'exam', 'storage_key', 'key_source'):
        if not isinstance(meta.get(k), str) or not meta.get(k).strip():
            rep.err('meta.' + k, 'is missing or empty.')
    if isinstance(meta.get('title'), str) and not 2 <= len(meta['title'].split()) <= 7:
        rep.warn('meta.title', 'should be a name of 2 to 6 words, like "ARTH 101 Quiz 3 Review".')
    if isinstance(meta.get('storage_key'), str) and not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,60}', meta['storage_key']):
        rep.err('meta.storage_key', 'must be lowercase letters, digits and hyphens, like "arth101-quiz3-review".')
    kind = meta.get('kind', 'practice')
    if kind not in ('practice', 'graded'):
        rep.err('meta.kind', 'must be "practice" (Claude graded it) or "graded" (the instructor marked it); got %r.' % kind)
    if meta.get('exam_mode', 'open') not in ('open', 'blind'):
        rep.err('meta.exam_mode', 'must be "open" or "blind".')
    if meta.get('taken') and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(meta['taken'])):
        rep.err('meta.taken', 'must be a date written YYYY-MM-DD.')
    t = meta.get('time')
    if t is not None and not (isinstance(t, dict) and num(t.get('used_min', 0)) and num(t.get('limit_min', 0))):
        rep.err('meta.time', 'must be {"used_min": 38, "limit_min": 45} (either may be left out).')
    if not isinstance(meta.get('credit_rules', []), list):
        rep.err('meta.credit_rules', 'must be a list of sentences.')

    units = {}
    for i, u in enumerate(data.get('units') or []):
        if not isinstance(u, dict) or not u.get('id') or not u.get('name'):
            rep.err('units[%d]' % i, 'needs "id" and "name".')
            continue
        if u['id'] in units:
            rep.err('units[%d]' % i, 'id "%s" is used twice.' % u['id'])
        units[u['id']] = u
    habits = {}
    for i, h in enumerate(data.get('habits') or []):
        if not isinstance(h, dict) or not h.get('id') or not h.get('name'):
            rep.err('habits[%d]' % i, 'needs "id" and "name".')
            continue
        if h['id'] in habits:
            rep.err('habits[%d]' % i, 'id "%s" is used twice.' % h['id'])
        habits[h['id']] = h

    budget = [0]
    qs = data.get('questions')
    if not isinstance(qs, list) or not qs:
        rep.err('questions', 'must be a non-empty list, one entry per exam question, in exam order.')
        qs = []
    seen = set()
    for i, q in enumerate(qs):
        if not isinstance(q, dict):
            rep.err('questions[%d]' % i, 'must be an object.')
            continue
        qid = str(q.get('id', '')).strip()
        w = 'question %s' % (qid or '#%d' % (i + 1))
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,15}', qid):
            rep.err(w, '"id" must be the number on the exam as a string, such as "7" or "4b".')
        elif qid.lower() in seen:
            rep.err(w, 'id is used twice.')
        q['id'] = qid
        seen.add(qid.lower())
        typ = q.get('type')
        if typ not in TYPES:
            rep.err(w, '"type" must be one of mc, multi, tf, num, written; got %r.' % typ)
            continue
        if not num(q.get('points')) or q['points'] <= 0:
            rep.err(w, '"points" must be a positive number.')
            q['points'] = 1
        pts = q['points']
        if not isinstance(q.get('prompt'), str) or not q['prompt'].strip():
            rep.err(w, '"prompt" (the question as on the exam) is missing.')
        for u in ([q['unit']] if isinstance(q.get('unit'), str) else q.get('unit') or []):
            if u not in units:
                rep.err(w, 'unit "%s" is not in "units".' % u)
        if not q.get('unit') and units:
            rep.warn(w, 'has no "unit", so it is left out of the per-unit breakdown.')
        for h in q.get('habits') or []:
            if h not in habits:
                rep.err(w, 'habit "%s" is not in "habits".' % h)
        check_image(rep, w + ' image', q.get('image'), base, budget)
        ans, key = q.get('answer'), q.get('correct')
        if not isinstance(ans, dict):
            rep.err(w, '"answer" (what the student gave) must be an object, e.g. {"choice": "B"} or {"blank": true}.')
            ans = q['answer'] = {}
        if not isinstance(key, dict):
            rep.err(w, '"correct" (the key) must be an object, e.g. {"choice": "A"}.')
            key = q['correct'] = {}
        for side, o in (('answer', ans), ('correct', key)):
            check_image(rep, '%s %s.image' % (w, side), o.get('image'), base, budget)
            if 'code' in o and not isinstance(o['code'], str):
                rep.err(w, '"%s.code" must be a string of code.' % side)
        blank = bool(ans.get('blank'))
        auto = None
        if typ in ('mc', 'multi', 'tf'):
            if typ == 'tf':
                for o in (ans, key):
                    c = o.get('choice')
                    if isinstance(c, bool):
                        o['choice'] = 'T' if c else 'F'
                    elif isinstance(c, str) and c.strip().lower() in ('t', 'true'):
                        o['choice'] = 'T'
                    elif isinstance(c, str) and c.strip().lower() in ('f', 'false'):
                        o['choice'] = 'F'
                keys = ['T', 'F']
            else:
                opts = q.get('options')
                if not isinstance(opts, list) or len(opts) < 2 or not all(isinstance(o, dict) and o.get('key') and 'text' in o for o in opts):
                    rep.err(w, '"options" must be a list of at least two {"key": "A", "text": "..."}.')
                    opts = []
                keys = [str(o.get('key')) for o in opts]
                if len(set(keys)) != len(keys):
                    rep.err(w, 'two options share a key.')
            kc = key.get('choice')
            kset = set(map(str, kc if isinstance(kc, list) else [kc])) if kc not in (None, '', []) else set()
            if not kset:
                rep.err(w, '"correct.choice" is missing.')
            elif not kset <= set(keys):
                rep.err(w, '"correct.choice" %s is not among the options %s.' % (sorted(kset), ', '.join(keys)))
            if typ == 'multi' and kc is not None and not isinstance(kc, list):
                rep.err(w, 'a select-all key must be a list, e.g. ["A", "C"].')
            if typ != 'multi' and isinstance(kc, list):
                rep.err(w, 'only select-all questions take a list as the key.')
            ac = ans.get('choice')
            aset = set(map(str, ac if isinstance(ac, list) else [ac])) if ac not in (None, '', []) else set()
            if not blank and not aset:
                rep.err(w, '"answer.choice" is missing. Use {"blank": true} for an unanswered question.')
            elif aset and not aset <= set(keys):
                rep.err(w, '"answer.choice" %s is not among the options %s. If the student wrote something else, put it in answer.text and confirm it with them.' % (sorted(aset), ', '.join(keys)))
            if kset:
                auto = 'blank' if blank else ('right' if aset == kset else 'wrong')
        elif typ == 'num':
            if key.get('value') is None:
                rep.err(w, '"correct.value" is missing.')
            elif not blank:
                try:
                    a, k = float(str(ans.get('value')).replace(',', '')), float(key['value'])
                    tol = float(key.get('tolerance', 0) or 0) or max(abs(k) * 1e-6, 1e-12)
                    auto = 'right' if abs(a - k) <= tol else 'wrong'
                except (TypeError, ValueError):
                    rep.warn(w, 'could not read answer.value %r as a number; the verdict is taken as written.' % ans.get('value'))
            else:
                auto = 'blank'
        else:
            if not (key.get('text') or key.get('code') or key.get('image')):
                rep.err(w, 'a written question needs a model answer in "correct.text" (or correct.code).')
            if not blank and not (ans.get('text') or ans.get('code') or ans.get('image')):
                rep.err(w, '"answer" has no text, code or image. Use {"blank": true} if it was left blank.')
        v = q.get('verdict')
        if v not in VERDICTS:
            rep.err(w, '"verdict" must be right, partial, wrong or blank; got %r.' % v)
            continue
        justified = typ == 'tf' and bool(key.get('text'))
        if auto and v != auto and not q.get('verdict_reason'):
            if not (justified and auto == 'right' and v in ('partial', 'wrong')):
                rep.err(w, 'the answer %s the key, but "verdict" is "%s". Fix one of them, or explain a credit rule in "verdict_reason".' % ('matches' if auto == 'right' else 'does not match', v))
        if justified and auto == 'wrong' and v in ('right', 'partial') and not q.get('verdict_reason'):
            rep.err(w, 'the true/false choice is wrong, so a correct justification cannot make it "%s" without a "verdict_reason".' % v)
        e = q.get('earned')
        if num(e):
            lo = li = hi = e
        elif isinstance(e, dict) and all(num(e.get(k)) for k in ('low', 'likely', 'high')):
            lo, li, hi = e['low'], e['likely'], e['high']
            if kind == 'graded':
                rep.err(w, 'on a graded exam the instructor\'s mark is the truth: "earned" must be a plain number.')
            if typ != 'written' and not q.get('verdict_reason') and not justified:
                rep.warn(w, 'is graded exactly (%s), so "earned" should be a plain number, not a range.' % typ)
            if not lo <= li <= hi:
                rep.err(w, '"earned" must have low <= likely <= high; got %s.' % json.dumps(e))
        else:
            rep.err(w, '"earned" must be a number, or {"low": , "likely": , "high": } for an estimated written mark.')
            continue
        if lo < 0 or hi > pts:
            rep.err(w, '"earned" must stay between 0 and the %s points of the question.' % fmt(pts))
        if typ == 'written' and kind == 'practice' and num(e) and not q.get('verdict_reason') and 0 < e < pts:
            rep.warn(w, 'is a written answer graded by Claude: give "earned" as {"low", "likely", "high"} so the page shows it as an estimate.')
        if v == 'right' and li != pts:
            rep.err(w, 'verdict "right" needs full marks (likely %s of %s). Use "partial" otherwise.' % (fmt(li), fmt(pts)))
        if v in ('wrong', 'blank') and li != 0 and not q.get('verdict_reason'):
            rep.err(w, 'verdict "%s" with %s points earned: use "partial", or explain in "verdict_reason".' % (v, fmt(li)))
        if v == 'partial' and not 0 < li < pts:
            rep.err(w, 'verdict "partial" needs earned strictly between 0 and %s.' % fmt(pts))
        if q.get('confidence', 'solid') not in CONF:
            rep.err(w, '"confidence" must be solid, unsure or guessed.')
        if not isinstance(q.get('explanation'), str) or not q['explanation'].strip():
            rep.err(w, '"explanation" (two or three sentences of the correct reasoning) is missing.')
        rub = q.get('rubric')
        if typ == 'written' and not rub:
            rep.err(w, 'a written question needs a "rubric": [{"point", "marks", "got"}], marks adding up to the points.')
        if rub:
            if not all(isinstance(r, dict) and r.get('point') and num(r.get('marks')) for r in rub):
                rep.err(w, 'every rubric entry needs "point" and a numeric "marks".')
            else:
                tm = sum(r['marks'] for r in rub)
                if abs(tm - pts) > 1e-9:
                    rep.err(w, 'rubric marks add up to %s but the question is worth %s.' % (fmt(tm), fmt(pts)))
                if all(num(r.get('got')) for r in rub):
                    tg = sum(r['got'] for r in rub)
                    if abs(tg - li) > 1e-9:
                        rep.err(w, 'rubric "got" adds up to %s but earned%s is %s.' % (fmt(tg), '.likely' if isinstance(e, dict) else '', fmt(li)))
                    for r in rub:
                        if r['got'] > r['marks'] or r['got'] < 0:
                            rep.err(w, 'rubric point "%s" has got %s of %s.' % (str(r['point'])[:30], fmt(r['got']), fmt(r['marks'])))
        wk = q.get('walkthrough')
        needs = v != 'right' or q.get('confidence', 'solid') == 'guessed'
        if needs and not wk:
            rep.err(w, 'is a %s, so it needs a "walkthrough": {"think", "steps", "answer", "trap"}.' % ('miss' if v != 'right' else 'guessed answer'))
        if wk:
            if not isinstance(wk, dict) or not all(wk.get(k) for k in ('think', 'steps', 'answer', 'trap')) or not isinstance(wk.get('steps'), list):
                rep.err(w, '"walkthrough" needs "think", a list of "steps", "answer" and "trap".')
        if v != 'right' and not q.get('habits'):
            rep.warn(w, 'is a miss with no "habits". Name the pattern behind it so it reaches the lessons.')
        q['_lo'], q['_li'], q['_hi'] = lo, li, hi

    qids = {str(q.get('id', '')).lower() for q in qs if isinstance(q, dict)}
    ls = data.get('lessons') or []
    if not isinstance(ls, list):
        rep.err('lessons', 'must be a list.')
        ls = []
    if len(ls) > 16:
        rep.err('lessons', 'has %d lessons; keep 5 to 16. Merge the ones that teach the same habit.' % len(ls))
    elif len(ls) < 5:
        rep.warn('lessons', 'has %d lessons; the default is 5 to 16. Fewer is fine only when very little was missed.' % len(ls))
    lids = set()
    blind = meta.get('exam_mode') == 'blind'
    covered = set()
    for i, l in enumerate(ls):
        w = 'lesson %s' % (l.get('id') if isinstance(l, dict) else '#%d' % (i + 1))
        if not isinstance(l, dict):
            rep.err(w, 'must be an object.')
            continue
        if not re.fullmatch(r'L\d{1,2}', str(l.get('id', ''))):
            rep.err(w, '"id" must be "L1", "L2", ... in order.')
        elif l['id'] in lids:
            rep.err(w, 'id is used twice.')
        lids.add(l.get('id'))
        for k in ('title', 'idea', 'how', 'trap'):
            if not isinstance(l.get(k), str) or not l[k].strip():
                rep.err(w, '"%s" is missing.' % k)
        ex = l.get('example')
        if not isinstance(ex, dict) or not ex.get('prompt') or not ex.get('solution'):
            rep.err(w, '"example" needs a "prompt" (a new question) and a "solution".')
            ex = {}
        check_image(rep, w + ' example.image', ex.get('image'), base, budget)
        for qi in l.get('questions') or []:
            if str(qi).lower() not in qids:
                rep.err(w, 'question "%s" is not in "questions".' % qi)
        for h in l.get('habits') or []:
            if h not in habits:
                rep.err(w, 'habit "%s" is not in "habits".' % h)
            covered.add(h)
        if ex.get('prompt'):
            for q in qs:
                if not isinstance(q, dict) or not isinstance(q.get('prompt'), str):
                    continue
                r = difflib.SequenceMatcher(None, ex['prompt'].lower(), q['prompt'].lower()).ratio()
                if r > 0.75:
                    msg = 'worked example reads like a copy of question %s (%.0f%% the same). Write a new example that teaches the same idea.' % (q['id'], r * 100)
                    (rep.err if blind else rep.warn)(w, msg)
    for h in habits:
        used = any(h in (q.get('habits') or []) for q in qs if isinstance(q, dict))
        if used and h not in covered:
            rep.warn('habit ' + h, 'appears in the misses but no lesson lists it in "habits".')
    fixes = data.get('fixes') or []
    if not isinstance(fixes, list) or not all(isinstance(f, str) for f in fixes):
        rep.err('fixes', 'must be a list of sentences.')
    elif not 3 <= len(fixes) <= 8:
        rep.warn('fixes', 'has %d entries; 3 to 8 short habits read best.' % len(fixes))
    if budget[0] > MAX_IMAGES_BYTES:
        rep.err('images', 'add up to about %d MB once embedded; keep them under 12 MB (resize photos to about 1600 px wide).' % (budget[0] // 1048576))
    has_math = lint_text(rep, data)
    return rep, has_math


def summarize(data, has_math):
    qs, meta = data['questions'], data['meta']
    tot = sum(q['points'] for q in qs)
    lo = sum(q['_lo'] for q in qs)
    li = sum(q['_li'] for q in qs)
    hi = sum(q['_hi'] for q in qs)
    est_ids = [q['id'] for q in qs if isinstance(q.get('earned'), dict)]
    pct = (lambda x: int(round(100.0 * x / tot)) if tot else 0)
    counts = {v: sum(1 for q in qs if q['verdict'] == v) for v in VERDICTS}
    counts['unsure'] = sum(1 for q in qs if q.get('confidence', 'solid') != 'solid')
    counts['flagged'] = sum(1 for q in qs if (q.get('student_note') or '').strip())
    counts['guessed_right'] = [q['id'] for q in qs if q['verdict'] == 'right' and q.get('confidence', 'solid') != 'solid']
    units = []
    for u in data.get('units') or []:
        e = p = 0.0
        for q in qs:
            us = [q['unit']] if isinstance(q.get('unit'), str) else (q.get('unit') or [])
            if u['id'] in us:
                e += q['_li'] / len(us)
                p += q['points'] / len(us)
        if p:
            units.append({'id': u['id'], 'name': u['name'], 'earned': round(e, 2), 'possible': round(p, 2)})
    lesson_of = {}
    for l in data.get('lessons') or []:
        for h in l.get('habits') or []:
            lesson_of.setdefault(h, l.get('id'))
    habits = []
    for h in data.get('habits') or []:
        ids = [q['id'] for q in qs if h['id'] in (q.get('habits') or [])]
        lost = sum(q['points'] - q['_li'] for q in qs if h['id'] in (q.get('habits') or []))
        habits.append({'id': h['id'], 'name': h['name'], 'questions': ids, 'lost': round(lost, 2), 'lesson': lesson_of.get(h['id'])})
    habits.sort(key=lambda x: (-x['lost'], -len(x['questions'])))
    return {
        'points_total': tot, 'low': lo, 'likely': li, 'high': hi,
        'pct_low': pct(lo), 'pct_likely': pct(li), 'pct_high': pct(hi),
        'estimated': bool(est_ids) and meta.get('kind', 'practice') == 'practice',
        'estimated_ids': est_ids, 'counts': counts, 'units': units, 'habits': habits, 'has_math': has_math,
    }


def embed_images(obj):
    if isinstance(obj, dict):
        if isinstance(obj.get('src'), str) and obj.get('_path'):
            p = obj.pop('_path')
            ext = os.path.splitext(p)[1].lower()
            raw = open(p, 'rb').read()
            obj['src'] = 'data:%s;base64,%s' % (IMG_TYPES[ext], base64.b64encode(raw).decode('ascii'))
            if 'width' not in obj and ext != '.svg':
                try:
                    from PIL import Image  # noqa: WPS433
                    with Image.open(p) as im:
                        obj['width'], obj['height'] = im.size
                except Exception:  # noqa: BLE001
                    pass
        for v in obj.values():
            embed_images(v)
    elif isinstance(obj, list):
        for v in obj:
            embed_images(v)


def strip_private(obj):
    if isinstance(obj, dict):
        return {k: strip_private(v) for k, v in obj.items() if not k.startswith('_')}
    if isinstance(obj, list):
        return [strip_private(v) for v in obj]
    return obj


def main(argv):
    args = [a for a in argv[1:] if not a.startswith('--')]
    out = None
    if '--out' in argv:
        i = argv.index('--out')
        out = argv[i + 1] if i + 1 < len(argv) else None
        args = [a for a in args if a != out]
    if len(args) != 1:
        print(__doc__)
        return 2
    src = os.path.abspath(args[0])
    base = os.path.dirname(src)
    try:
        text = open(src, encoding='utf-8').read()
    except OSError as e:
        print('build_review: cannot read %s: %s' % (src, e))
        return 2
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        line = text.splitlines()[e.lineno - 1] if e.lineno - 1 < len(text.splitlines()) else ''
        print('ERROR   %s is not valid JSON at line %d, column %d: %s\n        %s\n        %s^' % (os.path.basename(src), e.lineno, e.colno, e.msg, line[:120], ' ' * min(e.colno - 1, 120)))
        print('        Common causes: a trailing comma, a missing comma between entries, an unescaped " or a single backslash (write \\\\( in JSON for \\( ).')
        return 1
    rep, has_math = validate(data, base)
    for wmsg in rep.warnings:
        print('WARN    ' + wmsg)
    for emsg in rep.errors:
        print('ERROR   ' + emsg)
    if rep.errors and '--force' not in argv:
        print('build_review: %d error(s), %d warning(s). Nothing was written; fix the errors and run again.' % (len(rep.errors), len(rep.warnings)))
        return 1
    try:
        data['summary'] = summarize(data, has_math)
    except Exception as e:  # noqa: BLE001
        print('build_review: could not compute the score (%s). Fix the errors above first.' % e)
        return 1
    s = data['summary']
    score = ('about %d%%, likely %d to %d%%' % (s['pct_likely'], s['pct_low'], s['pct_high'])) if s['estimated'] else ('%d%%' % s['pct_likely'])
    line = '%d questions, %d lessons, score %s (%s of %s points), %d right, %d partly, %d wrong, %d blank, %d unsure, math: %s' % (
        len(data['questions']), len(data.get('lessons') or []), score, fmt(s['likely']), fmt(s['points_total']),
        s['counts']['right'], s['counts']['partial'], s['counts']['wrong'], s['counts']['blank'], s['counts']['unsure'], 'yes' if has_math else 'no')
    if '--check' in argv:
        print('build_review: checked, %d warning(s). %s.' % (len(rep.warnings), line))
        return 1 if rep.errors else 0
    n_img = [0]

    def count(o):
        if isinstance(o, dict):
            if o.get('_path'):
                n_img[0] += 1
            for v in o.values():
                count(v)
        elif isinstance(o, list):
            for v in o:
                count(v)
    count(data)
    embed_images(data)
    payload = json.dumps(strip_private(data), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    tpl = open(os.path.join(TPL, 'review.html'), encoding='utf-8').read()
    tpl = re.sub(r'<!--.*?-->', '', tpl, count=1, flags=re.S).lstrip()
    css = open(os.path.join(TPL, 'review.css'), encoding='utf-8').read()
    js = open(os.path.join(TPL, 'review.js'), encoding='utf-8').read()
    meta = data['meta']
    vals = {
        'title': meta['title'].replace('<', '&lt;'), 'storage_key': meta['storage_key'],
        'css': css, 'js': js.replace('</script', '<\\/script'), 'data': payload,
    }
    html = re.sub(r'\{\{(\w+)\}\}', lambda m: vals[m.group(1)], tpl)
    out = os.path.abspath(out) if out else os.path.join(base, 'exam_review.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    size = len(html.encode('utf-8'))
    print('build_review: wrote %s (%d KB, %d image(s) embedded): %s.' % (out, size // 1024, n_img[0], line))
    if size > 15 * 1024 * 1024:
        print('ERROR   the page is over 15 MB; an artifact may be at most 16 MB. Shrink the images.')
        return 1
    return 1 if rep.errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
