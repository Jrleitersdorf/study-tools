#!/usr/bin/env bash
# Download a local copy of MathJax 3.2.2 for the browser tests (the sandbox usually cannot reach
# cdnjs, which the published page uses; npm usually can). Only needed when the review has math.
# Usage: bash fetch_libs.sh [DIR]     default DIR: $ST_LIBS or ~/.cache/study-tools-libs
# Prints the directory to pass as --libs to test_review.js.
set -euo pipefail
DIR="${1:-${ST_LIBS:-$HOME/.cache/study-tools-libs}}"
mkdir -p "$DIR"
cd "$DIR"
if [ ! -f mathjax/es5/tex-svg.js ]; then
  npm pack mathjax@3.2.2 --silent >/dev/null
  rm -rf mathjax && mkdir mathjax && tar xzf mathjax-3.2.2.tgz -C mathjax --strip-components=1 && rm -f mathjax-3.2.2.tgz
fi
echo "$DIR"
