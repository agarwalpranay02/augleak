#!/bin/bash
# Regenerate every figure, table and in-text number reported in the paper from results/.
# Output goes to ./output (set AUGLEAK_OUT to change it).
set -e
PY=${PY:-python}
cd "$(dirname "$0")"
for f in fig_inflation fig_exploit fig_detect fig_audit; do $PY src/$f.py; done
$PY src/make_numbers.py
echo "figures in ${AUGLEAK_OUT:-output}/figs, tables and numbers in ${AUGLEAK_OUT:-output}"
