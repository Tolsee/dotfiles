#!/usr/bin/env python3
"""Add Pi trial defaults and prompt discovery while preserving user settings."""
import json
import os
from pathlib import Path

root = Path(__file__).resolve().parent
agent_dir = Path(os.environ.get("PI_CODING_AGENT_DIR") or Path.home() / ".pi/agent").expanduser()
agent_dir.mkdir(parents=True, exist_ok=True)
settings_path = agent_dir / "settings.json"
settings = json.loads(settings_path.read_text()) if settings_path.exists() else {}
if not isinstance(settings, dict):
    raise ValueError("Pi settings must be a JSON object")
defaults = json.loads((root / "settings.json").read_text())
for key, value in defaults.items():
    settings.setdefault(key, value)
prompts = settings.setdefault("prompts", [])
if not isinstance(prompts, list):
    raise ValueError("Pi prompts must be an array")
prompt_path = str(root / "prompts")
if prompt_path not in prompts:
    prompts.append(prompt_path)
content = json.dumps(settings, indent=2) + "\n"
if not settings_path.exists() or settings_path.read_text() != content:
    settings_path.write_text(content)
print("Pi defaults and native Codex review prompt configured.")
