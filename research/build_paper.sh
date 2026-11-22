#!/bin/bash
# Regenerate every figure, table and in-text number from results/, then compile the paper.
set -e
PY=${PY:-python}
cd "$(dirname "$0")"
for f in fig_inflation fig_exploit fig_detect fig_audit; do $PY src/$f.py; done
$PY src/make_numbers.py
cd paper/figs && xelatex -interaction=nonstopmode fig1_concept.tex >/dev/null && cd ..
pdflatex -interaction=nonstopmode main.tex >/dev/null; bibtex main >/dev/null
pdflatex -interaction=nonstopmode main.tex >/dev/null; pdflatex -interaction=nonstopmode main.tex >/dev/null
echo "built paper/main.pdf"
# NeurIPS (E&D track) version: shares figures, tables and numbers with paper/
cd ../paper_neurips
pdflatex -interaction=nonstopmode main.tex >/dev/null; bibtex main >/dev/null
pdflatex -interaction=nonstopmode main.tex >/dev/null; pdflatex -interaction=nonstopmode main.tex >/dev/null
echo "built paper_neurips/main.pdf"
# TMLR version: wider text (6.5 in), so its figures are redrawn at that width
cd ..
for f in fig_inflation fig_exploit fig_detect fig_audit; do AUGLEAK_COL2=6.5 AUGLEAK_FIGDIR="$PWD/paper_tmlr/figs" $PY src/$f.py; done
cp paper/figs/fig1_concept.pdf paper_tmlr/figs/
cd paper_tmlr
pdflatex -interaction=nonstopmode main.tex >/dev/null; bibtex main >/dev/null
pdflatex -interaction=nonstopmode main.tex >/dev/null; pdflatex -interaction=nonstopmode main.tex >/dev/null
echo "built paper_tmlr/main.pdf"
