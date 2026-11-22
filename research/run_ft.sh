#!/bin/bash
PY=${PY:-python}
while pgrep -f "exp_audit.py" > /dev/null || pgrep -f run_q3.sh > /dev/null; do sleep 10; done
$PY -u src/finetune.py --name cifar-aug --size 64 --k 8 --strength medium --epochs 4 --splits random,group --seeds 0 > ft_cifar_medium.log 2>&1
$PY -u src/finetune.py --name leafB --size 96 --epochs 3 --splits random,group --seeds 0 > ft_leafB.log 2>&1
$PY -u src/finetune.py --name cifar-aug --size 64 --k 8 --strength weak --epochs 4 --splits random,group --seeds 0 > ft_cifar_weak.log 2>&1
echo DONE > run_ft.done
