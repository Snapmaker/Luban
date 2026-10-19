#!/bin/bash
# deb/rpm post-remove; see linux-after-install.sh for the placeholder rule.

# Delete the link to the binary
rm -f '/usr/bin/${executable}'

# Drop the AppArmor profile installed by linux-after-install.sh.
if [ -f '/etc/apparmor.d/${executable}' ]; then
    if command -v apparmor_parser > /dev/null 2>&1; then
        apparmor_parser -R '/etc/apparmor.d/${executable}' || true
    fi
    rm -f '/etc/apparmor.d/${executable}'
fi
