#!/usr/bin/env python3
"""Whole-exam checks for a practice exam (verification.md section 3).

Usage: python3 check_exam.py <guide> [--blueprint work/blueprint.md] [--minutes-per-point X]

<guide> is the exam-only study guide folder. The study-guide skill's validate.py checks each
question's markup; this script checks the exam as a whole:
  - the summary: questions and points by type and by topic
  - against the blueprint (when given): the count of each page type and the total points
  - key positions: how often each letter is the key, and runs of the same letter
  - true or false balance
  - written items: a solution with a model answer and rubric whose marks add up to the points
  - time: with --minutes-per-point, the expected time against practice_minutes

Exit code 1 when there is an ERROR, otherwise 0. WARN lines are judgment calls to look at.
"""
import json
import os
import re
import sys
from collections import Counter, OrderedDict

try:
    from bs4 import BeautifulSoup
except ImportError:
    print('This script needs BeautifulSoup: pip install beautifulsoup4 (add --break-system-packages if pip asks).')
    sys.exit(3)


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith('--'):
        print(__doc__)
        return 2
    guide = sys.argv[1]
    errors, warns = [], []
    outline = json.load(open(os.path.join(guide, 'outline.json'), encoding='utf-8'))
    cfg = json.load(open(os.path.join(guide, 'guide.config.json'), encoding='utf-8'))
    ex = outline.get('exam') or {}
    if not ex:
        print('ERROR: outline.json has no "exam" entry.')
        return 1
    qs = BeautifulSoup(open(os.path.join(guide, ex['questions']), encoding='utf-8').read(), 'html.parser')
    ss = BeautifulSoup(open(os.path.join(guide, ex['solutions']), encoding='utf-8').read(), 'html.parser')
    sols = {s.get('data-for'): s for s in ss.find_all(attrs={'data-sg': 'solution'})}
    items = qs.find_all(attrs={'data-sg': 'question'})
    if not items:
        print('ERROR: no questions found in ' + ex['questions'])
        return 1

    by_type, pts_type = Counter(), Counter()
    by_topic = OrderedDict()
    keys, tf = [], Counter()
    total = 0.0
    for n, q in enumerate(items, 1):
        t = q.get('data-type', '?')
        p = float(q.get('data-points', '1'))
        total += p
        by_type[t] += 1
        pts_type[t] += p
        topic = q.get('data-topic') or q.get('data-from') or '(none)'
        c = by_topic.setdefault(topic, [0, 0.0])
        c[0] += 1
        c[1] += p
        ans = q.get('data-ans', '')
        if t == 'mc':
            keys.append((n, ans, len(q.find_all(attrs={'data-sg': 'option'}))))
        elif t == 'tf':
            tf[ans] += 1
        elif t == 'written':
            so = sols.get(q.get('data-id'))
            if so is None:
                errors.append('Q%d (written) has no solution.' % n)
                continue
            if not so.find(attrs={'data-sg': 'model-answer'}):
                errors.append('Q%d (written) has no model answer.' % n)
            rb = so.find(attrs={'data-sg': 'rubric'})
            if not rb:
                errors.append('Q%d (written) has no rubric.' % n)
            else:
                marks = [li.get('data-marks') for li in rb.find_all('li')]
                if any(m is None for m in marks):
                    warns.append('Q%d: a rubric point has no data-marks.' % n)
                else:
                    s = sum(float(m) for m in marks)
                    if abs(s - p) > 1e-9:
                        errors.append('Q%d: the rubric adds up to %g marks but the question is worth %g points.' % (n, s, p))
        if t != 'written' and q.get('data-id') not in sols:
            warns.append('Q%d has no worked solution (the student sees only the explanation after submitting).' % n)

    print('%s: %d questions, %g points, %s minutes' % (cfg.get('guide_title', guide), len(items), total, cfg.get('practice_minutes', '?')))
    print('\nBy type:')
    for t, k in by_type.most_common():
        print('  %-8s %3d questions  %6g points' % (t, k, pts_type[t]))
    print('\nBy topic (in order of first appearance):')
    for topic, (k, p) in by_topic.items():
        print('  %-34s %3d questions  %6g points  %4.0f%%' % (topic[:34], k, p, 100 * p / total if total else 0))
    if '(none)' in by_topic:
        warns.append('%d question(s) have no data-topic: the score breakdown cannot group them.' % by_topic['(none)'][0])

    if keys:
        let = Counter(a for _, a, _ in keys)
        nopt = Counter(k for _, _, k in keys).most_common(1)[0][0]
        print('\nMultiple-choice keys: ' + ', '.join('%s %d' % (l, let[l]) for l in sorted(let)))
        if len(keys) >= 6:
            exp = len(keys) / float(nopt)
            for l in 'abcdefgh'[:nopt]:
                if let[l] == 0:
                    warns.append('no multiple-choice key is (%s); spread the keys over every letter.' % l)
                elif let[l] > 2 * exp + 1:
                    warns.append('(%s) is the key %d times out of %d; spread the keys more evenly.' % (l, let[l], len(keys)))
        run, prev = 1, None
        for i, (n, a, _) in enumerate(keys):
            run = run + 1 if a == prev else 1
            prev = a
            if run == 3:
                warns.append('three multiple-choice questions in a row have the key (%s), ending at Q%d.' % (a, n))
    if sum(tf.values()) >= 4:
        print('True or false keys: T %d, F %d' % (tf['T'], tf['F']))
        if min(tf['T'], tf['F']) < 0.3 * sum(tf.values()):
            warns.append('true or false is unbalanced (T %d, F %d); aim for roughly half each.' % (tf['T'], tf['F']))

    bp = arg('--blueprint')
    if bp:
        want_type, want_pts = Counter(), 0.0
        for line in open(bp, encoding='utf-8'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(cells) < 4 or not re.match(r'^\d+$', cells[0]):
                continue
            m = re.search(r'\((mc|multi|tf|num|written)\)', cells[2])
            if m:
                want_type[m.group(1)] += 1
            try:
                want_pts += float(cells[3])
            except ValueError:
                pass
        print('\nAgainst the blueprint (%s):' % bp)
        for t in sorted(set(want_type) | set(by_type)):
            mark = 'ok' if want_type[t] == by_type[t] else 'DIFFERENT'
            print('  %-8s blueprint %3d  exam %3d  %s' % (t, want_type[t], by_type[t], mark))
            if want_type[t] != by_type[t]:
                errors.append('the blueprint has %d %s slot(s) but the exam has %d.' % (want_type[t], t, by_type[t]))
        print('  points   blueprint %g  exam %g' % (want_pts, total))
        if abs(want_pts - total) > 1e-9:
            errors.append('the blueprint totals %g points but the exam totals %g.' % (want_pts, total))

    mpp = arg('--minutes-per-point')
    if mpp and cfg.get('practice_minutes'):
        need = float(mpp) * total
        print('\nTime: about %.0f minutes of work at %s minutes per point; the limit is %s.' % (need, mpp, cfg['practice_minutes']))
        if need > float(cfg['practice_minutes']) * 1.1:
            warns.append('the exam needs about %.0f minutes at the real exam\'s pace but allows %s.' % (need, cfg['practice_minutes']))

    print()
    for e in errors:
        print('ERROR: ' + e)
    for w in warns:
        print('WARN: ' + w)
    if not errors and not warns:
        print('No problems found.')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
