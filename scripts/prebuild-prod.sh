#!/bin/bash

PLATFORM=`node -e "console.log(process.platform)"`
DEST_DIR="dist/cnc"

#
# cleanup
#
rm -rf output
mkdir output

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

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
CURA_VERSION="2.7"
CURA_DIR="$DEST_DIR/CuraEngine"
mkdir -p "$CURA_DIR"
cp -r CuraEngine/Config "$CURA_DIR"

mkdir -p "$CURA_DIR/$CURA_VERSION"
if [[ "$PLATFORM" == "darwin" ]]; then
    cp -r "CuraEngine/$CURA_VERSION/macOS" "$CURA_DIR/$CURA_VERSION"
elif [[ "$PLATFORM" == "win32" ]]; then
    cp -r "CuraEngine/$CURA_VERSION/Win-x64" "$CURA_DIR/$CURA_VERSION"
    cp -r "CuraEngine/$CURA_VERSION/Win-x86" "$CURA_DIR/$CURA_VERSION"
elif [[ "$PLATFORM" == "linux" ]]; then
    cp -r "CuraEngine/$CURA_VERSION/Linux-x64" "$CURA_DIR/$CURA_VERSION"
fi
