#!/bin/bash
#
# Fail if a native addon in a packaged Linux tree needs a newer glibc or C++
# ABI than the oldest distros Luban supports (Debian 10 / RHEL 8: glibc 2.28,
# libstdc++ CXXABI 1.3.9 is what the 24.04-built packages always needed).
# An addon compiled on the CI runner inherits the runner's glibc, so moving the
# runner to a newer Ubuntu would otherwise ship packages that only load on that
# Ubuntu or newer.
#
# Also checks that serialport loads its shipped N-API prebuild: node-gyp-build
# prefers build/Release (and electron-rebuild's bin/) over prebuilds/, so a
# runner-compiled copy must not be packaged.
#
# Usage: build/check-linux-native-floor.sh <dir> [<dir> ...]

GLIBC_MAX=2.28
CXXABI_MAX=1.3.9

if [ $# -eq 0 ]; then
    echo "usage: $0 <dir> [<dir> ...]" >&2
    exit 2
fi

# Prints the highest version of symbol set $1 (GLIBC, CXXABI, GLIBCXX) needed by ELF file $2.
max_version() {
    objdump -T "$2" | grep -o "$1_[0-9][0-9.]*" | sed "s/^$1_//" | sort -V | tail -1
}

# True if version $1 is newer than $2.
newer_than() {
    [ -n "$1" ] && [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]
}

failed=0
checked=0
for root in "$@"; do
    if [ ! -d "$root" ]; then
        echo "::error::$root is not a directory"
        failed=1
        continue
    fi

    while IFS= read -r -d '' f; do
        # serialport ships prebuilds for every platform; only x86-64 ELF runs here.
        file -b "$f" | grep -q 'ELF 64-bit.*x86-64' || continue
        checked=$((checked + 1))
        glibc=$(max_version GLIBC "$f")
        cxxabi=$(max_version CXXABI "$f")
        glibcxx=$(max_version GLIBCXX "$f")
        echo "${f#$root/}: GLIBC ${glibc:-none}, CXXABI ${cxxabi:-none}, GLIBCXX ${glibcxx:-none}"
        if newer_than "$glibc" "$GLIBC_MAX"; then
            echo "::error file=$f::needs GLIBC_$glibc (floor is $GLIBC_MAX)"
            failed=1
        fi
        if newer_than "$cxxabi" "$CXXABI_MAX"; then
            echo "::error file=$f::needs CXXABI_$cxxabi (floor is $CXXABI_MAX)"
            failed=1
        fi
    done < <(find "$root" -type f -name '*.node' -print0)

    compiled=$(find "$root" -type f -path '*/@serialport/bindings-cpp/*' \( -path '*/bindings-cpp/build/*' -o -path '*/bindings-cpp/bin/*' \))
    if [ -n "$compiled" ]; then
        echo "::error::$root packages a compiled serialport addon, which node-gyp-build would load instead of the prebuild:"
        echo "$compiled"
        failed=1
    fi
    if [ -z "$(find "$root" -type f -path '*/@serialport/bindings-cpp/prebuilds/linux-x64/node.napi.glibc.node')" ]; then
        echo "::error::$root has no serialport prebuild (prebuilds/linux-x64/node.napi.glibc.node)"
        failed=1
    fi
done

if [ "$checked" -eq 0 ]; then
    echo "::error::no x86-64 .node files found under $*"
    exit 1
fi
if [ "$failed" -ne 0 ]; then
    exit 1
fi
echo "OK: $checked x86-64 native addons within GLIBC $GLIBC_MAX / CXXABI $CXXABI_MAX"
