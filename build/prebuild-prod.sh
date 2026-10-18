#!/bin/bash

PLATFORM=`node -e "console.log(process.platform)"`
DEST_DIR="dist/Luban"

#
# cleanup
#
rm -rf output
mkdir output

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

cp -af src/package.json "$DEST_DIR"

#
# compile src
#
SOURCE_DIR="$DEST_DIR/src"
mkdir -p "$SOURCE_DIR"

npm run pkgsync
cp -af src/package.json "$SOURCE_DIR"

# The main process (src/main.js, src/electron-app/*) and the server child
# entry (src/server-cli.js) are bundled by gulp production
# (webpack.config.main.production.js) into "$SOURCE_DIR"; nothing is compiled
# file by file here any more.

#
# Resources Directory
#
RESOURCES_DIR="$DEST_DIR/resources"
mkdir -p "$RESOURCES_DIR"

#
# Copy Print Settings
#
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
cp -r resources/fonts "$RESOURCES_DIR"
cp -r resources/luban-case-library "$RESOURCES_DIR"
cp -r resources/scenes "$RESOURCES_DIR"
cp -r resources/engine-test "$RESOURCES_DIR"
