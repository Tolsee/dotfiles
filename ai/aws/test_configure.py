import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import configure
import tomlkit


class ConfigureTest(unittest.TestCase):
    def test_custom_client_roots_are_updated_instead_of_default_roots(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            root = home / 'dotfiles'
            (root / 'ai/mcps').mkdir(parents=True)
            (root / 'ai/mcps/mcp_config.json').write_text(json.dumps({'mcpServers': {'aws-mcp': {
                'command': 'python3', 'args': ['$HOME/dev/dotfiles/ai/aws/access.py', 'mcp']}}}))
            custom_claude = home / 'work-claude'
            custom_codex = home / 'work-codex'
            for path in [custom_claude, custom_codex, home / '.claude', home / '.codex']:
                path.mkdir()
            with patch.dict(os.environ, {'CLAUDE_CONFIG_DIR': str(custom_claude),
                                         'CODEX_HOME': str(custom_codex),
                                         'XDG_CONFIG_HOME': str(home / '.config')}):
                configure.install(root, home)
            self.assertTrue((custom_claude / '.claude.json').exists())
            self.assertTrue((custom_codex / 'config.toml').exists())
            self.assertFalse((home / '.claude.json').exists())
            self.assertFalse((home / '.codex/config.toml').exists())

    def test_installs_all_clients_preserving_unrelated_settings_and_timeout(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            root = home / 'dotfiles'
            (root / 'ai/mcps').mkdir(parents=True)
            (root / 'ai/mcps/mcp_config.json').write_text(json.dumps({'mcpServers': {'aws-mcp': {
                'command': 'python3', 'args': ['$HOME/dev/dotfiles/ai/aws/access.py', 'mcp'],
                'env_vars': ['AWS_AGENT_ACCOUNT']}}}))
            xdg = home / 'custom-config'
            (xdg / 'devin').mkdir(parents=True)
            for name in ['.claude', '.cursor', '.gemini', '.kiro', '.codeium', '.codex']:
                (home / name).mkdir()
            original = {'otherSetting': True, 'mcpServers': {'keep': {'url': 'https://example.com'},
                         'aws-mcp': {'command': 'old', 'env': {'AWS_PROFILE': 'example-b'}, 'timeout': 60}}}
            (home / '.claude.json').write_text(json.dumps(original))
            codex = home / '.codex/config.toml'
            codex.write_text('# preserve\nmodel = "existing"\n[mcp_servers.keep]\nurl = "https://example.com"\n'
                             '[mcp_servers.aws-mcp]\ncommand = "old"\nstartup_timeout_sec = 90\n'
                             '[mcp_servers.aws-mcp.env]\nAWS_PROFILE = "example-b"\n')
            with patch.dict(os.environ, {'XDG_CONFIG_HOME': str(xdg), 'CODEX_HOME': '', 'CLAUDE_CONFIG_DIR': ''}):
                configure.install(root, home)
                first = codex.read_text()
                configure.install(root, home)
                self.assertEqual(codex.read_text(), first)
            config = json.loads((home / '.claude.json').read_text())
            self.assertEqual(config['otherSetting'], True)
            self.assertEqual(config['mcpServers']['keep'], original['mcpServers']['keep'])
            aws = config['mcpServers']['aws-mcp']
            self.assertEqual(aws['timeout'], 60)
            self.assertNotIn('env', aws)
            self.assertNotIn('env_vars', aws)
            config = tomlkit.parse(codex.read_text())
            self.assertEqual(config['model'], 'existing')
            self.assertIn('# preserve', first)
            self.assertEqual(config['mcp_servers']['aws-mcp']['startup_timeout_sec'], 90)
            self.assertEqual(config['mcp_servers']['aws-mcp']['env_vars'], ['AWS_AGENT_ACCOUNT'])
            self.assertTrue((xdg / 'devin/mcp_config.json').exists())
            self.assertEqual(len(list(home.glob('.claude.json.before-*'))), 1)


if __name__ == '__main__':
    unittest.main()
