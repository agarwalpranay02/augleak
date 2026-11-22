#!/bin/bash
PY=${PY:-python}
$PY src/exp_exploit.py --name leafA > logs_v_exA.txt 2>&1
$PY src/exp_exploit.py --name leafB > logs_v_exB.txt 2>&1
$PY src/exp_repeats.py leafA v1 > logs_v_repA.txt 2>&1
$PY src/exp_repeats.py leafB Original > logs_v_repB.txt 2>&1
$PY src/exp_audit.py --name covidcxr > logs_v_cov.txt 2>&1
$PY src/exp_detect.py --name leafA --methods struct,pix > logs_v_detA.txt 2>&1
echo DONE > run_verify.done
