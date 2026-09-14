#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""Expose canonical AWS skills to agents omitted by the AWS CLI detector."""
import argparse
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil
import hashlib


def link_skills(user_dir, names=None, devin_dir=None, pi_dir=None):
    user_dir = Path(user_dir).expanduser().resolve()
    shared = user_dir / ".agents/skills"
    if not shared.is_dir():
        if names:
            raise ValueError(f"Install AWS skills first: {shared}")
        print("No shared AWS skills to link yet")
        return
    sources = [p for p in shared.iterdir() if (p / ".aws-skill-metadata").is_file()
               and (p / "SKILL.md").is_file() and (names is None or p.name in names)]
    if names and set(names) - {p.name for p in sources}:
        raise ValueError("Some selected skills are missing from the shared AWS installation")
    targets = []
    if (user_dir / ".gemini").is_dir():
        targets += [user_dir / ".gemini/antigravity/skills",
                    user_dir / ".gemini/antigravity-cli/skills"]
    devin_dir = Path(devin_dir).expanduser().resolve() if devin_dir is not None else user_dir / ".config/devin"
    if devin_dir.is_dir():
        targets.append(devin_dir / "skills")
    changes = []
    for directory in targets:
        for source in sources:
            target = directory / source.name
            if target.exists() and target.samefile(source):
                continue
            if target.exists() or target.is_symlink():
                if target.is_symlink() or not (target / ".aws-skill-metadata").is_file():
                    raise ValueError(f"Refusing to replace a non-AWS skill: {target}")
            changes.append((source, target))
    # Pi already discovers the canonical shared directory. Archive redundant
    # local copies instead of making links that AWS CLI remove-skill cannot remove.
    pi_dir = Path(pi_dir).expanduser().resolve() if pi_dir is not None else user_dir / ".pi/agent"
    pi_skills = pi_dir / "skills"
    pi_sources = [] if pi_skills.exists() and pi_skills.samefile(shared) else sources
    for source in pi_sources:
        target = pi_skills / source.name
        if not (target.exists() or target.is_symlink()):
            continue
        same_source = target.exists() and target.samefile(source)
        # A reverse link from the shared directory makes this the real source.
        if same_source and not target.is_symlink():
            continue
        if not same_source and (target.is_symlink() or not (target / ".aws-skill-metadata").is_file()):
            raise ValueError(f"Refusing to replace a non-AWS Pi skill: {target}")
        changes.append((None, target))
    backup = user_dir / ".agents/skill-backups/aws" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    for source, target in changes:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() or target.is_symlink():
            location = hashlib.sha256(str(target.parent).encode()).hexdigest()[:16]
            destination = backup / location / target.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(target), str(destination))
        if source is not None:
            target.symlink_to(source, target_is_directory=True)
    print(f"AWS skills: {len(sources)} canonical skills, {len(changes)} discovery entries updated")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-dir", type=Path, default=Path.home())
    parser.add_argument("--skill", action="append")
    args = parser.parse_args()
    xdg_dir = os.environ.get("XDG_CONFIG_HOME")
    link_skills(args.user_dir, args.skill,
                devin_dir=Path(xdg_dir) / "devin" if xdg_dir else None,
                pi_dir=os.environ.get("PI_CODING_AGENT_DIR") or None)
