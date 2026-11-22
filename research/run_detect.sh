#!/bin/bash
PY=${PY:-python}
$PY src/exp_detect.py --name leafA --methods exact,phash,phash_d4,inv,fused,sem,struct > logs_detect_leafA.txt 2>&1
$PY src/exp_detect.py --name leafB --methods exact,phash,phash_d4,inv,fused,sem,struct > logs_detect_leafB.txt 2>&1
$PY src/exp_detect.py --name cifaraugsub-strong --methods inv,fused,sem > logs_detect_cs.txt 2>&1
$PY src/exp_detect.py --name cifaraugsub-weak --methods inv,fused,sem > logs_detect_cw.txt 2>&1
$PY src/exp_detect.py --name cifaraugsub-medium --methods exact > logs_detect_cm.txt 2>&1
for n in leafA leafB cifaraugsub-medium cifaraugsub-strong cifaraugsub-weak; do
  $PY src/exp_protocol.py --name $n --seeds 3 --views "struct;struct,sem" > logs_protocol_$n.txt 2>&1
done
echo DONE > run_detect.done
