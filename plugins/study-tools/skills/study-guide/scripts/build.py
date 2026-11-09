#!/usr/bin/env python3
"""Assemble a study guide folder into ONE self-contained HTML page.

Usage
  python3 build.py <guide_dir> [--out FILE] [--allow-example] [--force] [--only L6,exam] [--sources-dir DIR]

--only builds a subset (the early one-unit draft): links to units not yet built are allowed.
--sources-dir re-checks the source map against the uploads folder. When omitted, build.py uses
"sources_dir" from outline.json if it is set and the folder exists.

Reads <guide_dir>/guide.config.json and <guide_dir>/outline.json, validates every content file
(validate.py), then writes <guide_dir>/study_guide.html (or --out). Images stay as files in
<guide_dir>/img/ and are referenced as img/<name>; publish them next to the page, or run
make_offline.py for a single file with the images embedded.

Template files come from ../assets/template/. A guide can override head.html, top.html or
bottom.html by placing its own copy in <guide_dir>/, and can add <guide_dir>/extra.css.
"""
import html as htmlmod, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.normpath(os.path.join(HERE, '..', 'assets', 'template'))
sys.path.insert(0, HERE)
import validate  # noqa: E402

JS_ORDER = ['eval.js', 'core.js', 'pages.js', 'theme.js', 'ask.js']


def read(p):
    return open(p, encoding='utf-8').read()


def pick(guide, name):
    own = os.path.join(guide, name)
    return own if os.path.exists(own) else os.path.join(TPL, name)


def strip_comments(s):
    return re.sub(r'<!--(?!QUESTIONS-->).*?-->', '', s, flags=re.S)


def if_exam(s, has_exam):
    return re.sub(r'<!--IF_EXAM-->(.*?)<!--END_IF_EXAM-->', (lambda m: m.group(1)) if has_exam else '', s, flags=re.S)


def fill(s, values, where):
    def rep(m):
        k = m.group(1)
        if k not in values:
            raise SystemExit('build: unknown placeholder {{%s}} in %s. Add "%s" to guide.config.json or remove it.' % (k, where, k))
        return values[k]
    return re.sub(r'\{\{\s*([a-z_]+)\s*\}\}', rep, s)


def page(guide, entry, label):
    body = read(os.path.join(guide, entry['file']))
    qs = read(os.path.join(guide, entry['questions']))
    sols = read(os.path.join(guide, entry['solutions']))
    if '<!--QUESTIONS-->' not in body:
        raise SystemExit('build: %s has no <!--QUESTIONS--> marker.' % entry['file'])
    body = body.replace('<!--QUESTIONS-->', strip_comments(qs) + '\n<div class="sols" hidden>\n' + strip_comments(sols) + '\n</div>\n', 1)
    return strip_comments(body).strip() + '\n'


def add_dims(out, guide):
    try:
        from PIL import Image
    except ImportError:
        print('build: Pillow is not installed; images get no width/height. Run: pip install pillow --break-system-packages')
        return out

    def dims(m):
        tag = m.group(0)
        if ' width=' in tag:
            return tag
        src = re.search(r'src="([^"]+)"', tag).group(1)
        try:
            w, h = Image.open(os.path.join(guide, src)).size
        except Exception:
            return tag
        return tag.replace('<img ', '<img width="%d" height="%d" ' % (w, h), 1)
    return re.sub(r'<img [^>]*src="(?!data:)[^"]+"[^>]*>', dims, out)


def print_contents(guide, units, unit_word):
    """The contents list on the PDF cover: every unit with its numbered section titles."""
    rows = []
    for u in units:
        try:
            raw = strip_comments(read(os.path.join(guide, u['file'])))
        except OSError:
            continue
        label = u.get('label') or unit_word
        subs = []
        for m in re.finditer(r'<h3[^>]*data-sg="section-title"[^>]*>(.*?)</h3>', raw, re.S):
            h = m.group(1)
            n = re.search(r'<span class="n">(.*?)</span>', h)
            title = re.sub(r'<[^>]+>', '', re.sub(r'<span class="n">.*?</span>', '', h)).strip()
            subs.append('<li>%s%s</li>' % ((n.group(1) + ' ') if n else '', title))
        rows.append('<li>%s %s: %s%s</li>' % (htmlmod.escape(label), htmlmod.escape(str(u.get('num', ''))), htmlmod.escape(u.get('title', '')),
                                              ('<ol>' + ''.join(subs) + '</ol>') if subs else ''))
    return '<ol class="print-toc">' + ''.join(rows) + '</ol>'


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    guide = os.path.abspath(argv[1])
    out_path = os.path.join(guide, 'study_guide.html')
    if '--out' in argv:
        out_path = os.path.abspath(argv[argv.index('--out') + 1])
    allow = '--allow-example' in argv
    only = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
    sd = argv[argv.index('--sources-dir') + 1] if '--sources-dir' in argv else None  # else outline.json "sources_dir"
    rep = validate.check_guide(guide, allow, sd, only)
    if rep.errors:
        rep.print()
        if '--force' not in argv:
            print('\nbuild: stopped because validation found errors. Fix them (or pass --force to build anyway for a quick look).')
            return 1
    elif rep.warnings:
        rep.print()

    cfg = json.load(open(os.path.join(guide, 'guide.config.json'), encoding='utf-8'))
    outline = json.load(open(os.path.join(guide, 'outline.json'), encoding='utf-8'))
    exam = outline.get('exam')
    if only:
        outline['units'] = [u for u in outline['units'] if u['id'] in only]
        if 'exam' not in only:
            exam = None
    unit = cfg.get('unit_label', 'Unit')
    plural = cfg.get('unit_label_plural') or unit + 's'
    values = {k: htmlmod.escape(str(v), quote=True) for k, v in cfg.items() if not k.startswith('_') and not isinstance(v, (dict, list))}
    values.update({'unit_label': htmlmod.escape(unit), 'unit_label_plural': htmlmod.escape(plural),
                   'unit_lower': htmlmod.escape(unit.lower()), 'unit_lower_plural': htmlmod.escape(plural.lower())})
    for k in ['exam_hint_label', 'skip_label']:
        values.setdefault(k, {'exam_hint_label': 'Exam hint', 'skip_label': 'Not tested'}[k])
    values['print_contents'] = print_contents(guide, outline['units'], unit)

    parts = []
    parts.append(fill(strip_comments(read(pick(guide, 'head.html'))), values, 'head.html').strip())
    css = [read(os.path.join(TPL, n)) for n in ('tokens.css', 'components.css', 'layout.css')]
    if os.path.exists(os.path.join(guide, 'extra.css')):
        css.append(read(os.path.join(guide, 'extra.css')))
    parts.append('<style>\n' + '\n'.join(css) + '</style>')
    parts.append(fill(strip_comments(if_exam(read(pick(guide, 'top.html')), bool(exam))), values, 'top.html').strip())
    for u in outline['units']:
        parts.append(page(guide, u, u['id']))
    if exam:
        parts.append(page(guide, exam, 'exam'))
    parts.append(fill(strip_comments(if_exam(read(pick(guide, 'bottom.html')), bool(exam))), values, 'bottom.html').strip())

    runtime = {k: v for k, v in cfg.items() if not k.startswith('_')}
    if isinstance(runtime.get('style'), dict):
        runtime['style'] = {k: v for k, v in runtime['style'].items() if not k.startswith('_')}
    parts.append('<script>window.SG = { config: %s };</script>' % json.dumps(runtime, ensure_ascii=True).replace('</', '<\\/'))
    for n in JS_ORDER:
        parts.append('<script>\n' + read(os.path.join(TPL, 'js', n)) + '\n</script>')
    parts.append(read(os.path.join(TPL, 'mathfield-fonts.html')).strip())
    parts.append('<script>\n' + read(os.path.join(TPL, 'js', 'mathfield.js')) + '\n</script>')
    parts.append('<script>\n' + read(os.path.join(TPL, 'js', 'mathjax-config.js')) + '\n</script>')
    parts.append('<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js"></script>')
    out = '\n'.join(parts) + '\n'
    out = re.sub(r'<details class="questions"(?![^>]*\bopen\b)', '<details class="questions" open', out)
    out = add_dims(out, guide)
    problems = validate.check_assembled(out)
    if only:
        problems = [p for p in problems if not p.startswith('links to missing ids')]
    for p in problems:
        print('ERROR   built page  ' + p)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    open(out_path, 'w', encoding='utf-8').write(out)

    markup = out.split('<script>window.SG', 1)[0]
    n_units = len(outline['units'])
    n_ex = len(re.findall(r'data-id="exam_q', markup))
    n_q = markup.count('data-sg="question"') - n_ex
    imgs = sorted(set(re.findall(r'src="(img/[^"]+)"', markup)))
    out_dir = os.path.dirname(out_path)
    if imgs and os.path.abspath(out_dir) != guide:
        import shutil
        for im in imgs:
            os.makedirs(os.path.join(out_dir, os.path.dirname(im)), exist_ok=True)
            shutil.copy2(os.path.join(guide, im), os.path.join(out_dir, im))
    print('build: wrote %s (%d KB): %d units, %d sections, %d unit questions, %d exam questions, %d figures.' % (
        os.path.relpath(out_path), len(out.encode('utf-8')) // 1024, n_units, markup.count('data-sg="section"'), n_q, n_ex, len(imgs)))
    if imgs:
        print('build: publish these image files next to the page (same relative paths): ' + ', '.join(imgs))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
