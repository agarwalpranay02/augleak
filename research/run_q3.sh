#!/bin/bash
PY=${PY:-python}
while pgrep -f "exp_detect.py" > /dev/null; do sleep 10; done
for n in cifaraugsub-strong cifaraugsub-weak; do
  $PY src/exp_detect.py --name $n --methods hash,pix,all > logs_detect2_$n.txt 2>&1
done
$PY src/exp_detect.py --name leafB --methods hash,pix > logs_detect2_leafB.txt 2>&1
for n in leafA cifaraugsub-medium cifaraugsub-strong; do
  $PY src/exp_protocol.py --name $n --seeds 3 --views "struct,hash;struct,hash,sem" > logs_protocol_$n.txt 2>&1
done
$PY src/exp_protocol.py --name leafB --seeds 3 --views "struct,hash" > logs_protocol_leafB.txt 2>&1
$PY -u src/exp_audit.py --name cifar10 > audit_cifar10.log 2>&1
echo DONE > run_q3.done
