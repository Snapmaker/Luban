#!/bin/bash
#
# Load serialport's native addon with the packaged Electron (in node mode, so
# no display is needed) from the packaged app.asar, and check node-gyp-build
# picks the shipped N-API prebuild rather than a compiled copy.
#
# Usage: build/smoke-linux-serialport.sh output/linux-unpacked

set -e

unpacked=${1:?usage: $0 <linux-unpacked dir>}
resources="$(cd "$unpacked/resources" && pwd)"
exe=$(find "$unpacked" -maxdepth 1 -type f -perm -u+x -iname 'snapmaker*' | head -1)
if [ -z "$exe" ]; then
    echo "::error::no Snapmaker executable in $unpacked"
    ls -l "$unpacked"
    exit 1
fi
echo "Electron: $exe"

ELECTRON_RUN_AS_NODE=1 "$exe" -e '
const path = require("path");
const app = path.join(process.argv[1], "app.asar");
const pkg = path.join(app, "node_modules/@serialport/bindings-cpp");
const gypBuild = require(require.resolve("node-gyp-build", { paths: [pkg] }));
const addon = gypBuild.resolve(pkg);
console.log("electron", process.versions.electron, "node", process.versions.node, "napi", process.versions.napi);
console.log("serialport addon:", addon);
if (!addon.endsWith(path.join("prebuilds", "linux-x64", "node.napi.glibc.node"))) {
    console.error("serialport addon is not the shipped N-API prebuild");
    process.exit(1);
}
const { autoDetect } = require(pkg);
autoDetect().list().then((ports) => {
    console.log("SerialPort.list() ok:", ports.length, "port(s)");
}, (err) => {
    console.error("SerialPort.list() failed:", err);
    process.exit(1);
});
' "$resources"
