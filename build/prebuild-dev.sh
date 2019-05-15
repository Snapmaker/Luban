#!/bin/bash

PLATFORM=`node -e "console.log(process.platform)"`
DEST_DIR="output"

#
# cleanup
#
rm -rf output
mkdir output

#
# compile src
#
npm run pkgsync
cp -af src/package.json "$DEST_DIR"
pushd src
babel -d "../$DEST_DIR" *.js electron-app/**/*.js
popd

#
# copy Cura Engine
#
CURA_DIR="$DEST_DIR/CuraEngine"
CURA_VERSION="3.6"

mkdir -p "$CURA_DIR"
mkdir -p "$CURA_DIR/$CURA_VERSION"

if [[ "$PLATFORM" == "darwin" ]]; then
    cp -r "CuraEngine/$CURA_VERSION/macOS" "$CURA_DIR/$CURA_VERSION"
    cp -r CuraEngine/Config "$CURA_DIR"
elif [[ "$PLATFORM" == "win32" ]]; then
    cp -r "CuraEngine/$CURA_VERSION/Windows-x64" "$CURA_DIR/$CURA_VERSION"
    cp -r CuraEngine/Config "$CURA_DIR"
    mkdir -p C:/ProgramData/Snapmakerjs/CuraEngine/Config
    cp -r CuraEngine/Config C:/ProgramData/Snapmakerjs/CuraEngine
elif [[ "$PLATFORM" == "linux" ]]; then
    cp -r "CuraEngine/$CURA_VERSION/Linux" "$CURA_DIR/$CURA_VERSION"
    cp -r CuraEngine/Config "$CURA_DIR"
fi
