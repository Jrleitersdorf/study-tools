#!/usr/bin/env bash
# Download local copies of MathJax 3.2.2 and MathLive 0.109.2 for the browser tests and the PDF
# export (the sandbox usually cannot reach the CDNs the published page uses; npm can).
# Usage: bash fetch_libs.sh [DIR]     default DIR: $SG_LIBS or ~/.cache/study-guide-libs
# Prints the directory to pass as --libs to test_guide.js and make_pdf.js.
set -euo pipefail
DIR="${1:-${SG_LIBS:-$HOME/.cache/study-guide-libs}}"
mkdir -p "$DIR"
cd "$DIR"
if [ ! -f mathjax/es5/tex-svg.js ]; then
  npm pack mathjax@3.2.2 --silent >/dev/null
  rm -rf mathjax && mkdir mathjax && tar xzf mathjax-3.2.2.tgz -C mathjax --strip-components=1 && rm -f mathjax-3.2.2.tgz
fi
if [ ! -f mathlive/mathlive.min.js ]; then
  npm pack mathlive@0.109.2 --silent >/dev/null
  rm -rf mathlive && mkdir mathlive && tar xzf mathlive-0.109.2.tgz -C mathlive --strip-components=1 && rm -f mathlive-0.109.2.tgz
fi
echo "$DIR"
