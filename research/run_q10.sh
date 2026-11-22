#!/bin/bash
PY=${PY:-python}
for st in medium strong weak; do
  $PY src/exp_detect.py --name cifaraug10-$st --methods exact,phash,phash_d4,sem,inv,struct > logs_d10a_$st.txt 2>&1
  $PY src/exp_detect.py --name cifaraug10-$st --methods pix,all > logs_d10b_$st.txt 2>&1
done
for st in medium strong; do
  $PY src/exp_protocol.py --name cifaraug10-$st --seeds 3 --views "struct,hash;struct,hash,sem" > logs_p10_$st.txt 2>&1
done
echo DONE > run_q10.done
