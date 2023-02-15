#!/bin/bash

PLATFORM=`node -e "console.log(process.platform)"`
DEST_DIR="output"

#
# cleanup
#
rm -rf output
mkdir output

cp -af src/package.json "$DEST_DIR"

#
# compile src
#
SOURCE_DIR="$DEST_DIR/src"
mkdir -p "$SOURCE_DIR"

npm run pkgsync
cp -af src/package.json "$SOURCE_DIR"

pushd src
cross-env NODE_ENV=development babel "*.js" --config-file ../babel.config.js -d "../$SOURCE_DIR"
cross-env NODE_ENV=development babel "electron-app/**/*.js" --config-file ../babel.config.js -d "../$SOURCE_DIR/electron-app"
popd

#
# Resources Directory
#
RESOURCES_DIR="$DEST_DIR/resources"
mkdir -p "$RESOURCES_DIR"

#
# Copy Print Settings
#
echo "Copying print settings..."
PRINT_SETTING_DIR="$RESOURCES_DIR/print-settings"
mkdir -p "$PRINT_SETTING_DIR"

cp -r packages/luban-print-settings/resources/* "$PRINT_SETTING_DIR"
# cp -r packages/luban-print-settings/resources/laser "$PRINT_SETTING_DIR"
# cp -r packages/luban-print-settings/resources/printing "$PRINT_SETTING_DIR"

PRINT_SETTING_DOCS_DIR="$RESOURCES_DIR/print-settings-docs"
mkdir -p "$PRINT_SETTING_DOCS_DIR"

cp -r packages/luban-print-settings-docs/* "$PRINT_SETTING_DOCS_DIR"

#
# Copy other resources
#
echo "Copying other resources..."
cp -r resources/fonts "$RESOURCES_DIR"
cp -r resources/luban-case-library "$RESOURCES_DIR"
cp -r resources/scenes "$RESOURCES_DIR"
cp -r resources/engine-test "$RESOURCES_DIR"
