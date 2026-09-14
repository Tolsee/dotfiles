#!/usr/bin/env python3
"""Append reduced-permission SSO profiles without changing human profiles."""
import configparser
import datetime
import json
import re
import os
from pathlib import Path
import shutil

SSO_KEYS = ('sso_start_url', 'sso_region', 'sso_session', 'sso_account_id',
            'region', 'output', 'cli_pager')


def settings_path():
    default = Path(os.environ.get('XDG_CONFIG_HOME') or '~/.config').expanduser() / 'aws-agent/settings.json'
    return Path(os.environ.get('AWS_AGENT_SETTINGS') or default).expanduser().resolve()


def read_settings():
    accounts = json.loads(settings_path().read_text()).get('accounts')
    if not isinstance(accounts, dict) or not accounts:
        raise ValueError('Local AWS agent settings require a non-empty accounts mapping')
    for name, role in accounts.items():
        if not re.fullmatch(r'[A-Za-z0-9_-]+', name) or name.endswith('-agent'):
            raise ValueError('Account aliases must be simple profile names without the -agent suffix')
        if not isinstance(role, str) or not re.fullmatch(r'[A-Za-z0-9_+=,.@-]+', role):
            raise ValueError(f'{name}: expected an SSO permission-set name')
    return accounts


def config_path():
    return Path(os.environ.get('AWS_CONFIG_FILE') or '~/.aws/config').expanduser().resolve()


def read_config(path):
    cfg = configparser.ConfigParser(interpolation=None)
    with open(path) as stream:
        cfg.read_file(stream)
    return cfg


def install(path):
    cfg = read_config(path)
    additions = []
    for account, role in read_settings().items():
        source_name = 'profile ' + account
        if source_name not in cfg:
            raise ValueError(f'{account}: configured source SSO profile is missing')
        source = cfg[source_name]
        if not source.get('sso_account_id') or not (source.get('sso_session') or
                (source.get('sso_start_url') and source.get('sso_region'))):
            raise ValueError(f'{account}: expected an existing SSO profile')
        values = {key: source[key] for key in SSO_KEYS if key in source}
        values['sso_role_name'] = role
        if not values.get('region'):
            values['region'] = cfg.get('default', 'region', fallback='')
        if not values['region']:
            raise ValueError(f'{account}: configure a workload region in the local AWS profile')
        section = 'profile ' + account + '-agent'
        if section in cfg:
            if dict(cfg[section]) != values:
                raise ValueError(f'Refusing to replace different existing profile: {section}')
        else:
            additions.append('\n[' + section + ']\n' + ''.join(
                f'{key} = {value}\n' for key, value in values.items()))
    if not additions:
        return 0
    backup = path.with_name(path.name + '.before-agent-profiles-' +
                            datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f'))
    shutil.copyfile(path, backup)
    backup.chmod(0o600)
    with path.open('a') as stream:
        stream.write('\n# Agent profiles: reduced permissions; human profiles above are preserved.\n')
        stream.writelines(additions)
    path.chmod(0o600)
    return len(additions)


if __name__ == '__main__':
    print(f'Added {install(config_path())} agent profiles')
