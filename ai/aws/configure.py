#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["tomlkit>=0.13,<1"]
# ///
"""Install only the AWS MCP entry, preserving other agent settings and servers."""
import datetime
import json
import os
from pathlib import Path
import shutil

import tomlkit


def install(dotfiles, home):
    source = json.loads((dotfiles / 'ai/mcps/mcp_config.json').read_text())['mcpServers']['aws-mcp']
    source['args'] = [arg.replace('$HOME', str(home)) for arg in source['args']]
    # Use this checkout's stable location, including installations outside ~/dev.
    source['args'][0] = str(dotfiles / 'ai/aws/access.py')
    portable = {key: value for key, value in source.items() if key != 'env_vars'}
    xdg = Path(os.environ.get('XDG_CONFIG_HOME') or home / '.config').expanduser()
    claude_override = os.environ.get('CLAUDE_CONFIG_DIR')
    claude_dir = Path(claude_override or home / '.claude').expanduser()
    claude_config = (claude_dir if claude_override else home) / '.claude.json'
    codex_dir = Path(os.environ.get('CODEX_HOME') or home / '.codex').expanduser()
    targets = [
        (claude_dir, claude_config),
        (home / '.cursor', home / '.cursor/mcp.json'),
        (home / '.gemini', home / '.gemini/settings.json'),
        (home / '.gemini', home / '.gemini/config/mcp_config.json'),
        (home / '.kiro', home / '.kiro/settings/mcp.json'),
        (home / '.codeium', home / '.codeium/mcp_config.json'),
        (xdg / 'devin', xdg / 'devin/mcp_config.json'),
    ]
    timestamp = datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f')

    def write(path, contents):
        if path.exists() and path.read_text() == contents:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            backup = path.with_name(path.name + '.before-aws-agent-' + timestamp)
            shutil.copyfile(path, backup)
            backup.chmod(0o600)
        path.write_text(contents)
        path.chmod(0o600)
        print(f'Configured AWS MCP: {path}')

    # Parse every target before writing, so a malformed file causes no partial install.
    updates = []
    for marker, path in targets:
        if not marker.exists():
            continue
        config = json.loads(path.read_text()) if path.exists() else {}
        servers = config.setdefault('mcpServers', {})
        previous = servers.get('aws-mcp', {})
        retained = {key: value for key, value in previous.items()
                    if key not in {'command', 'args', 'env', 'env_vars', 'type', 'url', 'transport'}}
        servers['aws-mcp'] = {**retained, **portable}
        updates.append((path, json.dumps(config, indent=2) + '\n'))
    if codex_dir.exists():
        path = codex_dir / 'config.toml'
        config = tomlkit.parse(path.read_text()) if path.exists() else tomlkit.document()
        servers = config.setdefault('mcp_servers', {})
        previous = servers.get('aws-mcp', {})
        retained = {key: value for key, value in previous.items()
                    if key not in {'command', 'args', 'env', 'env_vars', 'type', 'url', 'transport'}}
        servers['aws-mcp'] = {**retained, **source}
        updates.append((path, tomlkit.dumps(config)))
    for path, contents in updates:
        write(path, contents)


if __name__ == '__main__':
    install(Path(__file__).resolve().parents[2], Path.home())
