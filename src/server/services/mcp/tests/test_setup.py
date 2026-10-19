"""Hardware-free setup tests: no installers, trust stores or real Luban config touched."""

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('mcp_setup', Path(__file__).resolve().parents[1] / 'setup.py')
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='luban-setup-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / 'settings.json'
        self.data = self.root / 'data with spaces'
        self.commands = []

    def invoke(self, *args):
        self.output = io.StringIO()
        with redirect_stdout(self.output), redirect_stderr(self.output):
            return setup.main(['--config', str(self.config), '--data-dir', str(self.data), *args])

    def settings(self):
        return json.loads(self.config.read_text())

    def fake_run(self, command, check):
        self.assertTrue(check)
        self.commands.append(command)
        if '-cert-file' in command:
            Path(command[command.index('-cert-file') + 1]).write_text('test certificate')
            Path(command[command.index('-key-file') + 1]).write_text('test private key')
        return subprocess.CompletedProcess(command, 0)

    def test_preview_has_no_side_effects(self):
        with patch.object(setup.subprocess, 'run') as run:
            self.assertEqual(self.invoke('--https', '--lan-ip', '192.168.1.25', '--install-ca', '--blinka'), 0)
            run.assert_not_called()
        self.assertFalse(self.config.exists())
        self.assertFalse(self.data.exists())

    def test_basic_setup_preserves_settings_and_makes_exact_backup(self):
        original = b'{"macros": [{"name": "existing"}], "mcpPort": 40900, "mcpAllowLan": true, "mcpHttpsCert": "old.pem"}'
        self.config.write_bytes(original)
        self.assertEqual(self.invoke('--apply'), 0)
        settings = self.settings()
        self.assertEqual(settings['macros'], [{'name': 'existing'}])
        self.assertEqual(settings['mcpPort'], 40900)
        self.assertTrue(settings['mcpEnabled'])
        self.assertTrue(settings['mcpAllowLan'])
        self.assertEqual(settings['mcpHttpsCert'], 'old.pem')
        self.assertEqual(next(self.root.glob('settings.json.backup-*')).read_bytes(), original)
        if os.name != 'nt':
            self.assertEqual(self.config.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.invoke('--apply', '--local-only', '--port', '40889'), 0)
        self.assertFalse(self.settings()['mcpAllowLan'])
        self.assertEqual(self.settings()['mcpPort'], 40889)

    def test_new_setup_and_invalid_config(self):
        self.assertEqual(self.invoke('--apply'), 0)
        self.assertEqual(self.settings(), {'mcpEnabled': True, 'mcpPort': 40889, 'mcpAllowLan': False})
        for content in ['{invalid', '[]', '{"mcpPort": true}', '{"mcpPort": 1.5}', '{"other": NaN}']:
            self.config.write_text(content)
            self.assertEqual(self.invoke('--apply'), 1)
            self.assertEqual(self.config.read_text(), content)

    def test_https_needs_valid_port_and_explicit_lan_names(self):
        for args in [('--port', '0'), ('--https', '--port', '65535'), ('--install-ca',)]:
            self.assertEqual(self.invoke(*args, '--apply'), 1)
        self.config.write_text('{"mcpAllowLan": true}')
        self.assertEqual(self.invoke('--https', '--apply'), 1)
        self.assertIn('Supply --lan-ip', self.output.getvalue())
        for address in ['localhost', '::1', '127.0.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '-install']:
            with self.assertRaises(SystemExit):
                self.invoke('--lan-ip', address)
        with patch.object(setup.shutil, 'which', return_value=None):
            self.assertEqual(self.invoke('--https', '--local-only', '--apply'), 1)
        self.assertFalse(self.data.exists())

    def test_https_trust_is_opt_in_and_renewal_preserves_old_assets(self):
        with patch.object(setup.shutil, 'which', return_value='/fake/mkcert'), \
                patch.object(setup.subprocess, 'run', side_effect=self.fake_run):
            self.assertEqual(self.invoke('--https', '--lan-ip', '192.168.1.25', '--apply'), 0)
            old_key = Path(self.settings()['mcpHttpsKey'])
            self.assertTrue(old_key.is_absolute())
            self.assertTrue(old_key.is_file())
            self.assertFalse(any('-install' in command for command in self.commands))
            self.assertIn('192.168.1.25', self.commands[0])
            if os.name != 'nt':
                self.assertEqual(old_key.stat().st_mode & 0o777, 0o600)
            self.commands.clear()
            self.assertEqual(self.invoke('--https', '--lan-ip', '192.168.1.26', '--install-ca', '--apply'), 0)
            self.assertEqual(self.commands[0], ['/fake/mkcert', '-install'])
            self.assertNotEqual(self.settings()['mcpHttpsKey'], str(old_key))
            self.assertEqual(old_key.read_text(), 'test private key')

    def test_blinka_uses_sibling_requirements_from_another_cwd(self):
        previous = Path.cwd()
        try:
            os.chdir(self.root)
            with patch.object(setup.subprocess, 'run', side_effect=self.fake_run):
                self.assertEqual(self.invoke('--blinka', '--apply'), 0)
        finally:
            os.chdir(previous)
        self.assertEqual(self.commands[0][:3], [setup.sys.executable, '-m', 'venv'])
        self.assertEqual(self.commands[1][-1], str(setup.MCP_DIR / 'requirements.txt'))
        self.assertEqual(self.commands[1][0], self.settings()['mcpGpioPython'])
        self.assertNotIn('mcpProbeTransport', self.settings())

    def test_failed_install_or_concurrent_writer_preserves_configuration(self):
        original = b'{"mcpEnabled": false, "mcpGpioPython": "old-python"}'
        self.config.write_bytes(original)
        with patch.object(setup.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, ['pip'])):
            self.assertEqual(self.invoke('--blinka', '--apply'), 1)
        self.assertEqual(self.config.read_bytes(), original)
        with redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(ValueError, 'changed during setup'):
                setup.save_config(self.config, b'{}', {'mcpEnabled': True})
        self.assertEqual(self.config.read_bytes(), original)

    def test_env_override_warning_does_not_print_secret_values(self):
        with patch.dict(os.environ, {'LUBAN_MCP_MQTT_PASS': 'do-not-display-this'}):
            self.assertEqual(self.invoke(), 0)
        self.assertIn('LUBAN_MCP_MQTT_PASS', self.output.getvalue())
        self.assertNotIn('do-not-display-this', self.output.getvalue())


if __name__ == '__main__':
    unittest.main()
