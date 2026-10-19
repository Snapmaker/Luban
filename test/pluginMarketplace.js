// Run with: node test/pluginMarketplace.js (also included in npm test).
// Checks the OpenAI (Codex / ChatGPT) marketplace wiring against the rules the
// Codex plugin loader enforces, so a broken path fails here, not at install time.
const fs = require('fs');
const path = require('path');
const test = require('tape');

const repoRoot = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
const marketplace = readJson('.agents/plugins/marketplace.json');

// Codex resolves manifest paths only when they start with ./ and stay inside the root.
function resolveInside(root, relative) {
    if (typeof relative !== 'string' || !relative.startsWith('./') || relative === './') return null;
    if (relative.split(/[\\/]/).includes('..')) return null;
    const resolved = path.resolve(root, relative);
    return resolved.startsWith(root + path.sep) ? resolved : null;
}

test('plugin marketplace: entries point at plugins inside the repo', (t) => {
    t.ok(marketplace.name, 'marketplace has a name');
    t.ok(marketplace.plugins.length > 0, 'marketplace lists plugins');
    for (const entry of marketplace.plugins) {
        const pluginRoot = resolveInside(repoRoot, entry.source && entry.source.path);
        t.equal(entry.source.source, 'local', `${entry.name}: local source`);
        t.ok(pluginRoot && fs.statSync(pluginRoot).isDirectory(), `${entry.name}: source path is a directory in the repo`);
        t.ok(['AVAILABLE', 'INSTALLED_BY_DEFAULT', 'NOT_AVAILABLE'].includes(entry.policy.installation), `${entry.name}: installation policy`);
        t.ok(['ON_INSTALL', 'ON_USE'].includes(entry.policy.authentication), `${entry.name}: authentication policy`);
        t.ok(entry.category, `${entry.name}: category`);
    }
    t.end();
});

test('plugin marketplace: luban-cnc bundles every skill and the repo MCP server', (t) => {
    const entry = marketplace.plugins.find((plugin) => plugin.name === 'luban-cnc');
    const pluginRoot = resolveInside(repoRoot, entry.source.path);
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
    t.equal(manifest.name, entry.name, 'manifest name matches the marketplace entry');

    const skillsDir = resolveInside(pluginRoot, manifest.skills);
    t.ok(skillsDir, 'skills path stays inside the plugin');
    const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory());
    t.ok(skills.length > 0, 'skills directory holds skills');
    for (const { name } of skills) {
        const skill = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
        const frontmatter = (skill.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
        t.ok(new RegExp(`^name: ${name}$`, 'm').test(frontmatter), `${name}: frontmatter name matches its directory`);
        t.ok(/^description: \S/m.test(frontmatter), `${name}: frontmatter has a description`);
    }

    const mcpConfig = resolveInside(pluginRoot, manifest.mcpServers);
    t.ok(mcpConfig, 'mcpServers path stays inside the plugin');
    t.deepEqual(JSON.parse(fs.readFileSync(mcpConfig, 'utf8')), readJson('.mcp.json'), 'plugin MCP config matches the repo .mcp.json');

    const prompts = manifest.interface.defaultPrompt;
    t.ok(prompts.length <= 3 && prompts.every((prompt) => prompt.length <= 128), 'at most 3 default prompts of at most 128 characters');
    t.end();
});
