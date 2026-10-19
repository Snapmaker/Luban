#!/bin/bash
# deb/rpm post-install. electron-builder substitutes ${sanitizedProductName}
# and ${executable} with a plain regex, so no other "dollar-brace" sequences
# may appear in this file. Replaces electron-builder's default template, so
# its three duties come first.

# Link to the binary
ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'

# SUID chrome-sandbox for Electron 5+
chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true

update-mime-database /usr/share/mime || true
update-desktop-database /usr/share/applications || true

# Ubuntu 23.10+ restricts unprivileged user namespaces
# (kernel.apparmor_restrict_unprivileged_userns=1). Without an AppArmor
# profile granting userns, Chromium's sandbox cannot start and the app dies
# on launch with "Trace/breakpoint trap (core dumped)" (observed on Ubuntu
# 24.04, 2026-09-04). Install the same shape of profile Ubuntu ships for
# other Electron apps (Discord, code, ...). Only where AppArmor is new
# enough to know abi/4.0 - older releases neither have the restriction nor
# accept the syntax.
if [ -d /etc/apparmor.d ] && [ -f /etc/apparmor.d/abi/4.0 ]; then
    cat > '/etc/apparmor.d/${executable}' <<'EOF'
# Allow Snapmaker Luban (Electron) to create the unprivileged user namespace
# its Chromium sandbox needs. Installed by the snapmaker-luban package.
abi <abi/4.0>,
include <tunables/global>

profile ${executable} "/opt/${sanitizedProductName}/${executable}" flags=(unconfined) {
  userns,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/${executable}>
}
EOF
    if command -v apparmor_parser > /dev/null 2>&1; then
        apparmor_parser -r '/etc/apparmor.d/${executable}' || true
    fi
fi
