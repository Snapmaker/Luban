#!/bin/bash

# Forks build unsigned: repo secrets that are not configured arrive as EMPTY
# env vars, and an empty-but-set CSC_LINK makes electron-builder try to
# import a certificate from "" (it dies with "<cwd> not a file" right after
# packaging). Unset them and turn off keychain auto-discovery so the build
# proceeds unsigned; the afterSign hook (build/notarize.js) then ad-hoc
# signs mac apps so they still launch on Apple Silicon.
# (Before set -x so a real certificate value is never echoed to the log.)
if [ -z "${CSC_LINK:-}" ]; then
    unset CSC_LINK CSC_KEY_PASSWORD
    export CSC_IDENTITY_AUTO_DISCOVERY=false
fi

set -x

__dirname="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
electron_version=$(electron --version)

display_usage() {
    npm run electron-builder -- --help
}

if [ $# -le 1 ]; then
    display_usage
    exit 1
fi

if [[ ( $# == "--help") ||  $# == "-h" ]]; then
    display_usage
    exit 0
fi

pushd "$__dirname/../dist/Luban"
echo "Cleaning up \"`pwd`/node_modules\""
rm -rf node_modules
echo "Installing packages..."
npm install --omit=dev
npm dedupe
popd

echo "Rebuild native modules using electron ${electron_version}"

if [[ " $* " == *" --linux "* ]]; then
    # Linux: ship serialport's N-API prebuild (prebuilds/linux-x64/
    # node.napi.glibc.node, needs glibc 2.2.5) instead of compiling it here -
    # a runner-compiled addon inherits the runner's glibc (2.42 on 26.04) and
    # will not load on older distros. electron-rebuild misses that prebuild
    # (it only looks for node.napi.node) and --which-module adds to the list
    # rather than limiting it, so rebuild with --only. node-gyp-build prefers
    # build/Release over prebuilds/, so nothing compiled may be left beside
    # it, and electron-builder's own rebuild is off for the same reason
    # (font-scanner is already built for Electron here).
    # Compile for baseline x86-64 whatever the runner image's compiler
    # defaults to: the 26.04 image targets x86-64-v3, and its font-scanner
    # build died with SIGILL ("trap invalid opcode in fontmanager.node") on
    # the Luban host's Celeron N4020, which is x86-64-v2 (no AVX2/BMI2).
    # node-gyp's make honours CFLAGS/CXXFLAGS; an explicit -march overrides
    # the compiler's default. check-linux-native-floor.sh guards the result.
    if [[ " $* " == *" --x64 "* ]]; then
        export CFLAGS="-march=x86-64 -mtune=generic ${CFLAGS:-}"
        export CXXFLAGS="-march=x86-64 -mtune=generic ${CXXFLAGS:-}"
    fi
    echo "Native addons in dist/Luban:"
    find dist/Luban/node_modules -name binding.gyp -not -path '*/node-addon-api/*'
    npm run electron-rebuild -- --version=${electron_version:1} --module-dir=dist/Luban --only=font-scanner || exit 1
    find dist/Luban/node_modules -type d -path '*/@serialport/bindings-cpp' | while read -r dir; do
        rm -rf "$dir/build" "$dir/bin"
    done
    cross-env USE_HARD_LINKS=false npm run electron-builder -- "$@" -c.npmRebuild=false
    exit $?
fi

npm run electron-rebuild -- --version=${electron_version:1} --module-dir=dist/Luban --which-module=font-scanner,serialport

cross-env USE_HARD_LINKS=false npm run electron-builder -- "$@"
