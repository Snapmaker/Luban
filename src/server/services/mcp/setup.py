#!/usr/bin/env python3
"""Configure the MCP component of Luban; preview by default, --apply to write."""

import argparse
import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

MCP_DIR = Path(__file__).resolve().parent


def default_data_dir():
    if sys.platform == 'win32':
        return Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData' / 'Local')) / 'Luban' / 'mcp'
    if sys.platform == 'darwin':
        return Path.home() / 'Library' / 'Application Support' / 'Luban' / 'mcp'
    return Path.home() / '.local' / 'share' / 'luban' / 'mcp'


def lan_address(value):
    try:
        address = ipaddress.IPv4Address(value)
    except ipaddress.AddressValueError as error:
        raise argparse.ArgumentTypeError('Use the Luban computer\'s numeric LAN IPv4 address.') from error
    if address.is_loopback or address.is_unspecified or address.is_multicast or int(address) == 0xffffffff:
        raise argparse.ArgumentTypeError('Use a LAN interface address, not loopback/broadcast/multicast.')
    return str(address)


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('--apply', action='store_true', help='Perform the setup; close Luban first. Default: preview only.')
    result.add_argument('--config', type=Path, default=Path.home() / '.snapmaker-luban.json', help='Luban configstore file.')
    result.add_argument('--data-dir', type=Path, default=default_data_dir(), help='Private directory for generated certificates/venvs, outside the checkout.')
    result.add_argument('--port', type=int, help='HTTP port (default: preserve existing, otherwise 40889).')
    network = result.add_mutually_exclusive_group()
    network.add_argument('--lan-ip', action='append', type=lan_address, default=[], help='Enable LAN access; include this server IPv4 in HTTPS certificate. Repeat for multiple interfaces.')
    network.add_argument('--local-only', action='store_true', help='Disable LAN access. Otherwise preserve the existing setting.')
    result.add_argument('--https', action='store_true', help='Generate a new mkcert certificate and configure HTTPS on HTTP port + 1.')
    result.add_argument('--install-ca', action='store_true', help='With --https, run mkcert -install to trust its CA on this computer (may request elevation).')
    result.add_argument('--blinka', action='store_true', help='Create a Python venv, install MCP requirements, and save its interpreter path. Configure pins in Luban.')
    return result


def reject_json_constant(value):
    raise ValueError('Invalid JSON constant in Luban configuration: ' + value)


def read_config(path):
    raw = path.read_bytes() if path.exists() else None
    config = json.loads(raw, parse_constant=reject_json_constant) if raw is not None else {}
    if not isinstance(config, dict):
        raise ValueError('Luban configuration must be a JSON object; it was left unchanged.')
    return raw, config


def save_config(path, original, settings):
    """Preserve unrelated keys, keep a private backup, and avoid a partial JSON write."""
    current, _ = read_config(path)
    if current != original:
        raise ValueError('Luban configuration changed during setup. Close Luban and run setup again.')
    path.parent.mkdir(parents=True, exist_ok=True)
    if original is not None:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + '.backup-', delete=False) as backup:
            backup.write(original)
        print('Configuration backup:', backup.name)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, prefix=path.name + '.tmp-', delete=False) as output:
            temporary = Path(output.name)
            json.dump(settings, output, indent=4, ensure_ascii=False)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
        # Detect a writer during the backup/write too. Luban must remain closed.
        if (path.read_bytes() if path.exists() else None) != original:
            raise ValueError('Luban configuration changed during setup; settings were not replaced.')
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def run_setup(args):
    if args.install_ca and not args.https:
        raise ValueError('--install-ca requires --https.')
    config_path = args.config.expanduser().resolve()
    data_dir = args.data_dir.expanduser().resolve()
    original, settings = read_config(config_path)
    raw_port = args.port if args.port is not None else settings.get('mcpPort', 40889)
    try:
        port = int(raw_port)
    except (ValueError, TypeError) as error:
        raise ValueError('Invalid MCP port; supply --port between 1 and 65535.') from error
    if isinstance(raw_port, bool) or str(port) != str(raw_port) or not 1 <= port <= 65535:
        raise ValueError('Invalid MCP port; supply --port between 1 and 65535.')
    if args.https and port == 65535:
        raise ValueError('HTTPS requires HTTP port 65534 or lower (HTTPS uses port + 1).')
    allow_lan = bool(args.lan_ip) or (bool(settings.get('mcpAllowLan', False)) and not args.local_only)
    if args.https and allow_lan and not args.lan_ip:
        raise ValueError('Supply --lan-ip for the HTTPS certificate, or --local-only to disable LAN access.')
    settings.update(mcpEnabled=True, mcpPort=port, mcpAllowLan=allow_lan)
    print('Apply setup:' if args.apply else 'Preview only; add --apply after closing Luban.')
    print('Luban configuration:', config_path)
    print('Enable MCP HTTP on port', port, '(LAN access)' if allow_lan else '(loopback only)')
    if allow_lan:
        print('LAN access allows clients on the local subnet to control the machine without login.')
    if args.https:
        print('Generate a new mkcert certificate under', data_dir, 'for HTTPS port', port + 1)
        print('Certificate names:', ', '.join(['localhost', '127.0.0.1', '::1'] + args.lan_ip))
        print('Install local CA trust:', 'yes (mkcert -install)' if args.install_ca else 'no; existing trust is unchanged')
    if args.blinka:
        print('Create a Blinka venv under', data_dir, 'using', sys.executable)
        print('Install requirements from', MCP_DIR / 'requirements.txt')
    overrides = sorted(key for key in os.environ if key.startswith('LUBAN_MCP_'))
    if overrides:
        print('Environment overrides may take precedence over saved settings:', ', '.join(overrides))
    if not args.apply:
        return

    # Preflight all external prerequisites before creating assets or changing settings.
    mkcert = shutil.which('mkcert') if args.https else None
    if args.https and not mkcert:
        raise ValueError('Install mkcert first: https://github.com/FiloSottile/mkcert#installation')
    if args.blinka and not (MCP_DIR / 'requirements.txt').is_file():
        raise ValueError('Keep setup.py beside the MCP requirements.txt file.')
    if args.https or args.blinka:
        data_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    if args.https:
        if args.install_ca:
            subprocess.run([mkcert, '-install'], check=True)
        cert_dir = Path(tempfile.mkdtemp(prefix='tls-', dir=data_dir))
        cert, key = cert_dir / 'cert.pem', cert_dir / 'key.pem'
        print('Generating HTTPS files in', cert_dir)
        subprocess.run([mkcert, '-cert-file', str(cert), '-key-file', str(key),
                        'localhost', '127.0.0.1', '::1', *args.lan_ip], check=True)
        if not cert.is_file() or not key.is_file():
            raise ValueError('mkcert did not create both certificate files; settings were not changed.')
        key.chmod(0o600)
        settings.update(mcpHttpsCert=str(cert), mcpHttpsKey=str(key))
    if args.blinka:
        venv_dir = Path(tempfile.mkdtemp(prefix='blinka-', dir=data_dir))
        print('Creating Blinka environment in', venv_dir)
        subprocess.run([sys.executable, '-m', 'venv', str(venv_dir)], check=True)
        interpreter = venv_dir / ('Scripts/python.exe' if sys.platform == 'win32' else 'bin/python')
        subprocess.run([str(interpreter), '-m', 'pip', 'install', '-r', str(MCP_DIR / 'requirements.txt')], check=True)
        settings['mcpGpioPython'] = str(interpreter)
    save_config(config_path, original, settings)
    print('Saved. Start Luban normally, then open Settings > MCP Server to check health and dashboard links.')
    if args.https:
        print('For each phone/PC: use mkcert -CAROOT to find rootCA.pem, then install/trust that PUBLIC CA certificate.')
        print('Never transfer rootCA-key.pem or the server key.pem. Enable job notifications in each browser session.')
    if args.blinka:
        print('Select GPIO/Blinka transport and your sensor pins in MCP Settings. USB drivers/permissions remain device-specific.')
    print('Environment overrides still apply. No Luban process was started or restarted.')


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        run_setup(args)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print('Setup failed:', error, file=sys.stderr)
        print('Completed assets may remain in the data directory; existing certificates/venvs were not overwritten.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
