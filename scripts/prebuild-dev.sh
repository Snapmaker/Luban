#!/bin/bash

platform=`node -e "console.log(process.platform)"`

mkdir -p output
rm -rf output/*

npm run pkgsync

# compile src
pushd src
cp -af package.json ../output/
babel -d ../output *.js electron-app/**/*.js
popd

#
# copy Cura Engine
#
cura_version="2.7"
mkdir -p output/CuraEngine
cp -r CuraEngine/Config output/CuraEngine

mkdir -p output/CuraEngine/"$cura_version"
if [[ $platform == "darwin" ]]; then
    cp -r "CuraEngine/$cura_version/macOS" "output/CuraEngine/$cura_version/"
elif [[ $platform == "win32" ]]; then
    cp -r "CuraEngine/$cura_version/Win-x64" "output/CuraEngine/$cura_version/"
    cp -r "CuraEngine/$cura_version/Win-x86" "output/CuraEngine/$cura_version/"
elif [[ $platform == "linux" ]]; then
    cp -r "CuraEngine/$cura_version/Linux-x64" "output/CuraEngine/$cura_version/"
fi

