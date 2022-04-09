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
cross-env NODE_ENV=development babel "*.js" --config-file ../babel.config.js -d "../$DEST_DIR"
cross-env NODE_ENV=development babel "electron-app/**/*.js" --config-file ../babel.config.js -d "../$DEST_DIR/electron-app"
popd

#
# Resources Directory
#
RESOURCES_DIR="$DEST_DIR/resources"
mkdir -p "$RESOURCES_DIR"

#
# copy Cura Engine
#
CURA_DIR="$RESOURCES_DIR/CuraEngine"
CURA_VERSION="3.6"

mkdir -p "$CURA_DIR"
mkdir -p "$CURA_DIR/$CURA_VERSION"

if [[ "$PLATFORM" == "darwin" ]]; then
    cp -r "resources/CuraEngine/$CURA_VERSION/macOS" "$CURA_DIR/$CURA_VERSION"
elif [[ "$PLATFORM" == "win32" ]]; then
    cp -r "resources/CuraEngine/$CURA_VERSION/Windows-x64" "$CURA_DIR/$CURA_VERSION"
elif [[ "$PLATFORM" == "linux" ]]; then
    cp -r "resources/CuraEngine/$CURA_VERSION/Linux" "$CURA_DIR/$CURA_VERSION"
fi
cp -r resources/CuraEngine/Config "$CURA_DIR"

#
# Copy other resources
#
cp -r resources/fonts "$RESOURCES_DIR"
cp -r resources/luban-case-library "$RESOURCES_DIR"
cp -r resources/scenes "$RESOURCES_DIR"
