import configparser
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import access
import profiles


class AgentAccessTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'config'
        self.original = '# keep this comment\n[default]\nlogin_session = unchanged\n'
        for account in ('example-a', 'example-b'):
            self.original += (f'\n[profile {account}]\nsso_start_url = https://example.awsapps.com/start\n'
                              'sso_region = ap-southeast-2\nsso_account_id = 123456789012\n'
                              'sso_role_name = ExampleAdminRole\nregion = us-east-2\n')
        self.path.write_text(self.original)
        self.settings = Path(self.temp.name) / 'settings.json'
        self.settings.write_text(json.dumps({'accounts': {'example-a': 'ExampleReadRole', 'example-b': 'ExampleReadRole'}}))
        self.environment = patch.dict(os.environ, {'AWS_AGENT_SETTINGS': str(self.settings)}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_default_account_is_installed_and_matches_proxy_selection(self):
        # A example-b-only machine must not assume a example-a profile exists.
        cfg = profiles.read_config(self.path)
        cfg.remove_section('profile example-a')
        self.settings.write_text(json.dumps({'accounts': {'example-b': 'ExampleReadRole'}}))
        with self.path.open('w') as stream: cfg.write(stream)
        profiles.install(self.path)
        with patch.dict(os.environ, {}, clear=False):
            self.assertEqual(access.profile_order(self.path), ['example-b-agent'])
        with patch.dict(os.environ, {'AWS_DEFAULT_PROFILE': 'example-b'}, clear=False):
            self.assertEqual(access.profile_order(self.path), ['example-b-agent'])

    def test_profiles_preserve_human_config_and_rerun_is_noop(self):
        self.assertEqual(profiles.install(self.path), 2)
        installed = self.path.read_text()
        self.assertTrue(installed.startswith(self.original))
        self.assertEqual(profiles.install(self.path), 0)
        self.assertEqual(self.path.read_text(), installed)
        self.assertEqual(len(list(self.path.parent.glob('config.before-*'))), 1)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)

    def test_conflicting_alias_prevents_all_writes(self):
        self.path.write_text(self.original + '\n[profile example-b-agent]\nrole_arn = foreign\n')
        before = self.path.read_bytes()
        with self.assertRaises(ValueError):
            profiles.install(self.path)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertFalse(list(self.path.parent.glob('config.before-*')))

    def test_sdk_proxy_exposes_only_agent_profiles_and_strips_admin_credentials(self):
        profiles.install(self.path)
        def invoke(command, env):
            self.assertEqual(env['AWS_MCP_PROXY_PROFILES'], 'example-a-agent example-b-agent')
            for key in access.AUTH_ENV - {'AWS_MCP_PROXY_PROFILES'}:
                self.assertNotIn(key, env)
            self.assertEqual(env['AWS_SHARED_CREDENTIALS_FILE'], os.devnull)
            cfg = profiles.read_config(env['AWS_CONFIG_FILE'])
            self.assertEqual(set(cfg.sections()), {'profile example-b-agent', 'profile example-a-agent'})
            for section in cfg.values():
                if not section: continue
                self.assertEqual(set(section), {'region', 'credential_process'})
                self.assertIn('credentials', section['credential_process'])
                self.assertIn(str(self.path), section['credential_process'])
            self.proxy_path = Path(env['AWS_CONFIG_FILE'])
            return 0
        with patch.dict(os.environ, {'AWS_VAULT': 'example-b', 'AWS_AGENT_ACCOUNT': 'example-b', 'AWS_ACCESS_KEY_ID': 'fixture',
                                    'AWS_MCP_PROXY_PROFILES': 'default example-b'}, clear=False):
            with patch.object(access.subprocess, 'call', side_effect=invoke):
                self.assertEqual(access.mcp(self.path), 0)
        self.assertFalse(self.proxy_path.exists())

    def test_shell_account_does_not_select_task_target_and_mixed_auth_fails(self):
        profiles.install(self.path)
        with patch.dict(os.environ, {'AWS_AGENT_ACCOUNT': 'unknown', 'AWS_PROFILE': 'example-b'}, clear=False):
            self.assertEqual(access.profile_order(self.path), ['example-a-agent', 'example-b-agent'])
        with self.path.open('a') as stream: stream.write('credential_process = untrusted\n')
        with patch.dict(os.environ, {}, clear=False):
            with self.assertRaises(ValueError): access.mcp(self.path)

    def test_actual_role_mismatch_never_exports_credentials(self):
        identity = {'Account': '123456789012', 'Arn':
                    'arn:aws:sts::123456789012:assumed-role/AWSReservedSSO_ExampleAdminRole_abc/user'}
        with patch.object(access.subprocess, 'check_output', return_value=json.dumps(identity).encode()) as call:
            with self.assertRaises(ValueError): access.export('123456789012', 'ExampleReadRole')
            self.assertEqual(call.call_count, 1)

    def test_vault_failure_does_not_retry_another_profile(self):
        profiles.install(self.path)
        with patch.object(access.subprocess, 'check_output', side_effect=access.subprocess.CalledProcessError(1, 'aws-vault')) as call:
            with self.assertRaises(access.subprocess.CalledProcessError):
                access.credentials(self.path, 'example-b')
            self.assertEqual(call.call_count, 1)
            self.assertIn('example-b-agent', call.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
