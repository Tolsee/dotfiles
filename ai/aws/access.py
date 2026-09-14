#!/usr/bin/env python3
"""Use locally approved aws-vault SSO sessions for commands and the multi-account AWS MCP."""
import argparse
import configparser
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile

from profiles import SSO_KEYS, config_path, read_config, read_settings

SCRIPT = str(Path(__file__).resolve())
AUTH_ENV = {
    'AWS_VAULT', 'AWS_PROFILE', 'AWS_DEFAULT_PROFILE', 'AWS_MCP_PROXY_PROFILES',
    'AWS_AGENT_ACCOUNT',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
    'AWS_SECURITY_TOKEN', 'AWS_CREDENTIAL_EXPIRATION',
    'AWS_CONTAINER_CREDENTIALS_FULL_URI', 'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI',
    'AWS_CONTAINER_AUTHORIZATION_TOKEN', 'AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE',
    'AWS_ROLE_ARN', 'AWS_ROLE_SESSION_NAME', 'AWS_WEB_IDENTITY_TOKEN_FILE',
}


def clean_env():
    env = {key: value for key, value in os.environ.items()
           if key not in AUTH_ENV and not key.startswith('AWS_ENDPOINT_URL')}
    env['AWS_SHARED_CREDENTIALS_FILE'] = os.devnull
    env['AWS_EC2_METADATA_DISABLED'] = 'true'
    env['AWS_VAULT_PROFILE_ENV'] = 'false'
    return env


def agent_profile(name):
    account = name.removesuffix('-agent')
    accounts = read_settings()
    if account not in accounts:
        raise ValueError(f'Unknown account: {name}; choose one of {", ".join(accounts)}')
    return account + '-agent'


def profile_config(path, name):
    cfg = read_config(path)
    values = dict(cfg['profile ' + agent_profile(name)])
    role = read_settings()[agent_profile(name).removesuffix('-agent')]
    if values.get('sso_role_name') != role or set(values) - set(SSO_KEYS) - {'sso_role_name'}:
        raise ValueError(f'{name}: SSO profile does not match the approved local role')
    if not values.get('region'):
        raise ValueError(f'{name}: configure a workload region in the local AWS profile')
    if not values.get('sso_account_id'):
        raise ValueError(f'{name}: missing SSO account ID')
    return values


def credentials(path, name):
    profile = agent_profile(name)
    values = profile_config(path, profile)
    env = clean_env()
    env['AWS_CONFIG_FILE'] = str(path)
    # The child verifies STS identity before exporting to the SDK's private pipe.
    return subprocess.check_output([
        'aws-vault', 'exec', '--no-profile-env', profile, '--', sys.executable,
        SCRIPT, 'export', values['sso_account_id'], values['sso_role_name'],
    ], env=env)


def export(expected_account, expected_role):
    result = subprocess.check_output(['aws', 'sts', 'get-caller-identity', '--output', 'json'])
    identity = json.loads(result)
    prefix = f'arn:aws:sts::{expected_account}:assumed-role/AWSReservedSSO_{expected_role}_'
    if identity.get('Account') != expected_account or not identity.get('Arn', '').startswith(prefix):
        raise ValueError('Refusing credentials: STS account or role did not match agent profile')
    return subprocess.check_output(['aws', 'configure', 'export-credentials', '--format', 'process'])


def command_env(path, name):
    creds = json.loads(credentials(path, name))
    env = clean_env()
    env.update(AWS_CONFIG_FILE=str(path), AWS_VAULT=agent_profile(name),
               AWS_ACCESS_KEY_ID=creds['AccessKeyId'],
               AWS_SECRET_ACCESS_KEY=creds['SecretAccessKey'],
               AWS_SESSION_TOKEN=creds['SessionToken'])
    region = profile_config(path, name)['region']
    env.update(AWS_REGION=region, AWS_DEFAULT_REGION=region)
    return env


def profile_order(path):
    source = read_config(path)
    names = [account + '-agent' for account in read_settings()
             if 'profile ' + account + '-agent' in source]
    if not names:
        raise ValueError('No agent profiles installed; run ai/aws/profiles.py first')
    # The first profile bootstraps the upstream connection. Account operations
    # select their own aws_profile per call; terminal state does not select it.
    return names


def mcp(path):
    names = profile_order(path)
    proxy_config = configparser.ConfigParser(interpolation=None)
    for name in names:
        values = profile_config(path, name)
        proxy_config['profile ' + name] = {
            'region': values['region'],
            'credential_process': shlex.join([
                sys.executable, SCRIPT, '--config', str(path), 'credentials', name]),
        }
    # SDK profiles deliberately contain only the aws-vault credential process.
    # SSO config here would take precedence over it and bypass Keychain caching.
    with tempfile.TemporaryDirectory(prefix='aws-agent-mcp-') as directory:
        proxy_path = Path(directory) / 'config'
        with proxy_path.open('w') as stream:
            proxy_config.write(stream)
        proxy_path.chmod(0o600)
        env = clean_env()
        env.update(AWS_CONFIG_FILE=str(proxy_path), AWS_MCP_PROXY_PROFILES=' '.join(names))
        return subprocess.call([
            'uvx', 'mcp-proxy-for-aws@latest',
            'https://aws-mcp.us-east-1.api.aws/mcp', '--metadata', 'INSTALL_SOURCE=aws-cli',
        ], env=env)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=config_path())
    subs = parser.add_subparsers(dest='mode', required=True)
    subs.add_parser('mcp')
    subs.add_parser('profile')
    for mode in ('credentials', 'export', 'exec'):
        sub = subs.add_parser(mode)
        sub.add_argument('account')
        if mode == 'export':
            sub.add_argument('role')
        if mode == 'exec':
            sub.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    path = args.config.expanduser().resolve()
    if args.mode == 'mcp':
        return mcp(path)
    if args.mode == 'profile':
        print(profile_order(path)[0])
        return 0
    if args.mode in ('credentials', 'export'):
        payload = credentials(path, args.account) if args.mode == 'credentials' else export(args.account, args.role)
        sys.stdout.buffer.write(payload)
        return 0
    command = args.command
    if command[:1] == ['--']:
        command = command[1:]
    if not command:
        parser.error('exec requires a command after the account')
    os.execvpe(command[0], command, command_env(path, args.account))


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        print(f'AWS agent access failed: {error}', file=sys.stderr)
        sys.exit(1)
