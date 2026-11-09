#!/usr/bin/env python3
"""Make a single offline HTML file from a built guide: images, MathJax and MathLive embedded.

Usage: python3 make_offline.py <study_guide.html> <out.html> [--libs DIR]

The offline copy is one file that works with no internet connection: equations render, the math
answer box works, and progress saves in the reader's browser. Ask and Solve it for me need the
published artifact; in the offline copy they hide themselves.

It needs local copies of MathJax 3.2.2 (es5/tex-svg.js) and MathLive 0.109.2 (mathlive.min.js),
the same ones the browser tests use. They are looked up in --libs, then $SG_LIBS, then
~/.cache/study-guide-libs; if they are missing, the script runs fetch_libs.sh (npm) once.
If they still cannot be found, it writes a copy that loads both libraries from their CDNs, prints
a loud warning, and exits with code 3: that copy shows raw TeX instead of equations without a
network connection, so do not call it an offline copy.

The page's Google Fonts link is kept; without a network the page falls back to system fonts.
Rare TeX macros that MathJax loads on demand (autoload) also need a network; the macros the
template uses are all built in.
"""
import base64, mimetypes, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MJ_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js"></script>'


def find_libs(argv):
    cands = []
    if '--libs' in argv:
        cands.append(argv[argv.index('--libs') + 1])
    if os.environ.get('SG_LIBS'):
        cands.append(os.environ['SG_LIBS'])
    cands.append(os.path.join(os.path.expanduser('~'), '.cache', 'study-guide-libs'))

    def ok(d):
        return os.path.exists(os.path.join(d, 'mathjax', 'es5', 'tex-svg.js')) and os.path.exists(os.path.join(d, 'mathlive', 'mathlive.min.js'))
    for d in cands:
        if ok(d):
            return d
    target = cands[0]
    try:
        print('make_offline: libraries not found; running fetch_libs.sh %s' % target)
        subprocess.run(['bash', os.path.join(HERE, 'fetch_libs.sh'), target], check=True, stdout=subprocess.DEVNULL)
    except Exception as e:  # noqa: BLE001
        print('make_offline: fetch_libs.sh failed: %s' % e)
    return target if ok(target) else None


def inline_js(path):
    js = open(path, encoding='utf-8').read()
    return '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>'


def main(argv):
    args = [a for i, a in enumerate(argv) if not (a == '--libs' or (i > 0 and argv[i - 1] == '--libs'))]
    if len(args) < 3:
        print(__doc__)
        return 2
    src, out = args[1], args[2]
    base = os.path.dirname(os.path.abspath(src))
    s = open(src, encoding='utf-8').read()
    missing = []

    def rep(m):
        p = os.path.join(base, m.group(1))
        if not os.path.exists(p):
            missing.append(m.group(1))
            return m.group(0)
        mt = mimetypes.guess_type(p)[0] or 'image/png'
        return 'src="data:%s;base64,%s"' % (mt, base64.b64encode(open(p, 'rb').read()).decode())
    s = re.sub(r'src="((?:img|images)/[^"]+)"', rep, s)

    libs = find_libs(argv)
    offline = False
    if libs and MJ_TAG in s:
        ml = inline_js(os.path.join(libs, 'mathlive', 'mathlive.min.js'))
        mj = inline_js(os.path.join(libs, 'mathjax', 'es5', 'tex-svg.js'))
        # MathLive first (mathfield.js finds window.MathLive and skips its CDN load), then MathJax,
        # which reads the window.MathJax configuration set by the script just before this tag.
        s = s.replace(MJ_TAG, ml + '\n' + mj, 1)
        offline = True

    skel = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n')
    head, sep, body = s.partition('<header class="top"')
    doc = skel + head + '</head>\n<body>\n' + sep + body + '\n</body>\n</html>\n'
    open(out, 'w', encoding='utf-8').write(doc)
    size = len(doc.encode('utf-8')) // 1024
    if missing:
        print('make_offline: MISSING images: ' + ', '.join(missing))
    if not offline:
        print('\n' + '!' * 78)
        print('make_offline: WARNING. MathJax and MathLive could NOT be embedded (no local copies and')
        print('fetch_libs.sh failed). The file %s still loads them from the internet:' % out)
        print('without a network connection it shows raw TeX instead of equations and a plain answer box.')
        print('Tell the user it needs an internet connection, or run fetch_libs.sh where npm works and retry.')
        print('!' * 78 + '\n')
        return 3
    print('offline copy: %s (%d KB), images, MathJax and MathLive embedded; works without a network.' % (out, size))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
