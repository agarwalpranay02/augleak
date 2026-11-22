#!/bin/bash
PY=${PY:-python}
while [ ! -f run_q10.done ]; do sleep 20; done
$PY -u src/finetune.py --name cifar-aug --size 64 --k 8 --strength medium --epochs 4 --seeds 1,2 > ft2_cm.log 2>&1
$PY -u src/finetune.py --name cifar-aug --size 64 --k 8 --strength weak --epochs 4 --seeds 1,2 > ft2_cw.log 2>&1
$PY -u src/finetune.py --name leafB --size 96 --epochs 3 --seeds 1,2 > ft2_lb.log 2>&1
$PY -u src/finetune.py --name cifar-aug --size 64 --k 8 --strength medium --epochs 4 --seeds 0,1,2 --arch effnet_b0 > ft2_cm_eff.log 2>&1
echo DONE > run_ft2.done
