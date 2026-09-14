const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'install'), 'utf8');

function install(existing = {}) {
  const files = new Map(Object.entries(existing));
  files.set(path.join(__dirname, 'mcp_config.json'), JSON.stringify({ mcpServers: {
    'aws-mcp': { command: 'python3', args: ['/fixture/access.py', 'mcp'] },
    shared: { command: 'shared-server' },
  }}));
  vm.runInNewContext(source, {
    __dirname,
    require(name) {
      if (name === 'path') return path;
      if (name === 'fs') return {
        existsSync: file => files.has(file),
        readFileSync: file => files.get(file),
        writeFileSync: (file, content) => files.set(file, content),
        mkdirSync() {},
      };
      throw new Error(`Unexpected module: ${name}`);
    },
    process: { env: { USERPROFILE: '/fixture' }, argv: ['node', 'install'],
      exit: code => { throw new Error(`Unexpected exit: ${code}`); } },
    console: { log() {}, warn() {}, error(message) { throw new Error(message); } },
  });
  return files;
}

test('generic setup does not register AWS on a fresh machine', () => {
  const files = install();
  for (const file of ['/fixture/.claude.json', '/fixture/.gemini/config/mcp_config.json']) {
    const servers = JSON.parse(files.get(file)).mcpServers;
    assert.equal(servers['aws-mcp'], undefined);
    assert.equal(servers.shared.command, 'shared-server');
  }
  assert.doesNotMatch(files.get('/fixture/.codex/config.toml'), /aws-mcp/);
});

test('generic setup preserves an AWS entry installed by its dedicated setup', () => {
  const aws = { command: 'python3', args: ['/stable/access.py', 'mcp'], timeout: 60 };
  const original = JSON.stringify({ mcpServers: { 'aws-mcp': aws } });
  const files = install({
    '/fixture/.claude.json': original,
    '/fixture/.gemini/config/mcp_config.json': original,
    '/fixture/.codex/config.toml': 'model = "existing"\n[mcp_servers."aws-mcp"]\ncommand = "python3"\n'
      + '[mcp_servers."aws-mcp".env]\nAWS_AGENT_ACCOUNT = "example-b"\n'
      + '[mcp_servers.shared]\ncommand = "old"\n',
  });
  for (const file of ['/fixture/.claude.json', '/fixture/.gemini/config/mcp_config.json']) {
    assert.deepEqual(JSON.parse(files.get(file)).mcpServers['aws-mcp'], aws);
  }
  const codex = files.get('/fixture/.codex/config.toml');
  assert.match(codex, /\[mcp_servers\."aws-mcp"\]/);
  assert.match(codex, /AWS_AGENT_ACCOUNT = "example-b"/);
  assert.match(codex, /command = "shared-server"/);
  assert.doesNotMatch(codex, /command = "old"/);
});
