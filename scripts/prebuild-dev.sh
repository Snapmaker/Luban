#!/bin/bash

mkdir -p output
rm -rf output/*

npm run pkgsync

pushd src
cp -af package.json ../output/
cp -r ../CuraEngine ../output
babel -d ../output *.js electron-app/**/*.js
popd

