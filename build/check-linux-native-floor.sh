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

# Instruction-level ceiling: x86-64-v2 (SSE4.2, SSSE3, POPCNT, CMPXCHG16B).
# The glibc floor cannot see this - an addon compiled with the runner
# compiler's default -march (x86-64-v3 on the 26.04 image) links against an
# old glibc yet dies with "invalid opcode" on a v2 CPU. Disassemble and list
# the VEX/EVEX (any 'v'-prefixed mnemonic or ymm/zmm/opmask register) and
# BMI1/BMI2/LZCNT/MOVBE/ADX instructions found, most frequent first. tzcnt is
# allowed: compilers emit it for baseline as 'rep bsf', which older CPUs run
# as bsf.
beyond_v2_instructions() {
    objdump -d --no-show-raw-insn "$1" | awk -F'\t' '
        NF >= 2 {
            split($2, w, " ");
            m = w[1];
            if (m == "rep" || m == "repz" || m == "repnz" || m == "lock" || m == "notrack" || m == "bnd") { m = w[2] }
            if ((m ~ /^v/ && m !~ /^ver[rw]$/) \
                || m ~ /^(andn|bextr|blsi|blsmsk|blsr|bzhi|mulx|pdep|pext|rorx|sarx|shlx|shrx|lzcnt|movbe|adcx|adox)$/ \
                || $2 ~ /%[yz]mm[0-9]/ || $2 ~ /%k[0-7]([^0-9]|$)/) { print m }
        }' | sort | uniq -c | sort -rn | head -8
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
        isa=$(beyond_v2_instructions "$f")
        if [ -n "$isa" ]; then
            echo "::error file=$f::uses instructions beyond x86-64-v2 (AVX/AVX2/AVX-512/BMI/FMA/MOVBE), which fault with SIGILL on x86-64-v2 CPUs such as the Luban host's Celeron N4020. Most frequent:"
            echo "$isa"
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
echo "OK: $checked x86-64 native addons within GLIBC $GLIBC_MAX / CXXABI $CXXABI_MAX and the x86-64-v2 instruction set"
