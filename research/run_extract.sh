#!/bin/bash
set -x
PY=${PY:-python}; M=data/manifests
$PY src/extract.py --manifest $M/leafA.csv --name leafA --backbone mobilenetv3 --size 128 --d4
$PY src/extract.py --manifest $M/leafB.csv --name leafB --backbone mobilenetv3 --size 128 --d4
$PY src/extract.py --npz data/cifar_aug.npz --name cifaraug --backbone effnet_b0 --size 112
$PY src/extract.py --npz data/cifar_aug.npz --name cifaraug --backbone mobilenetv3 --size 112
$PY src/extract.py --manifest $M/leafA.csv --name leafA --backbone effnet_b0 --size 128
$PY src/extract.py --manifest $M/leafB.csv --name leafB --backbone effnet_b0 --size 128
$PY src/extract.py --manifest $M/covidcxr.csv --name covidcxr --backbone mobilenetv3 --size 160 --d4
$PY src/extract.py --manifest $M/covidcxr.csv --name covidcxr --backbone effnet_b0 --size 160
$PY src/extract.py --manifest $M/plantdoc.csv --name plantdoc --backbone mobilenetv3 --size 160 --d4
$PY src/extract.py --manifest $M/plantdoc.csv --name plantdoc --backbone effnet_b0 --size 160
$PY src/extract.py --manifest $M/cifar10.csv --name cifar10 --backbone mobilenetv3 --size 112
$PY src/extract.py --npz data/cifar_aug.npz --keys weak,medium,strong --subset 500 --name cifaraugsub --backbone mobilenetv3 --size 112 --d4
$PY src/extract.py --npz data/cifar_aug.npz --name cifaraug --backbone effnetv2_b0 --size 112
$PY src/extract.py --manifest $M/leafA.csv --name leafA --backbone effnetv2_b0 --size 128
$PY src/extract.py --manifest $M/leafB.csv --name leafB --backbone effnetv2_b0 --size 128
echo ALLDONE
