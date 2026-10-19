// Run with: node test/typecheckBaseline.js (also included in npm test).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('tape');

const checker = path.resolve(__dirname, '../build/typecheck-baseline.js');
const prefix = 'src/server/services/mcp/';

// Assertion names stay fixed and the checker's output is printed only on
// failure: a passing "ok N src/x.ts(1,2): error TS1109" line is still picked up
// by the tsc problem matcher that setup-node registers, and shows as a CI error.
function reports(t, result, text, name) {
    const found = result.output.includes(text);
    t.ok(found, name);
    if (!found) t.comment(result.output);
}

function exits(t, result, status, name) {
    t.equal(result.status, status, name);
    if (result.status !== status) t.comment(result.output);
}

function withProject(check) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luban-typecheck-'));
    const write = (file, text) => {
        const target = path.join(root, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text);
    };
    const config = (options = {}) => write('tsconfig.json', JSON.stringify({
        compilerOptions: { strict: true, types: [], skipLibCheck: true, ...options },
        include: ['src/**/*.ts'],
    }));
    const run = (...args) => {
        const result = spawnSync(process.execPath, [checker, 'tsconfig.json', 'baseline.json', ...args], {
            cwd: root,
            encoding: 'utf8',
        });
        if (result.error) throw result.error;
        return { ...result, output: result.stdout + result.stderr };
    };
    try {
        config();
        write('baseline.json', JSON.stringify({ errors: {} }));
        write('src/legacy.ts', 'export const legacy: number = "bad";');
        write(`${prefix}check.ts`, 'export const value: number = 1;');
        check({ root, write, config, run });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('typecheck: ignore legacy semantic errors but reject new MCP errors', (t) => {
    withProject(({ write, run }) => {
        const clean = run('--only', prefix);
        exits(t, clean, 0, 'clean MCP files pass');
        write(`${prefix}check.ts`, 'export const value: number = "bad";');
        const broken = run('--only', prefix);
        t.equal(broken.status, 1, 'new MCP error fails the check');
        reports(t, broken, `${prefix}check.ts TS2322: 0 -> 1`, 'the new MCP error is named');
    });
    t.end();
});

test('typecheck: an excluded syntax error must not hide MCP errors or rewrite the baseline', (t) => {
    withProject(({ root, write, run }) => {
        write('src/legacy.ts', 'export const legacy = ;');
        write(`${prefix}check.ts`, 'export const value: number = "bad";');
        const before = fs.readFileSync(path.join(root, 'baseline.json'), 'utf8');
        for (const args of [[], ['--update']]) {
            const broken = run('--only', prefix, ...args);
            t.equal(broken.status, 1, `syntax error fails ${args.length ? 'update' : 'check'}`);
            reports(t, broken, 'src/legacy.ts(1,23): error TS1109', 'the syntax error is printed');
        }
        t.equal(fs.readFileSync(path.join(root, 'baseline.json'), 'utf8'), before, 'failed update preserves the baseline');
    });
    t.end();
});

test('typecheck: configuration and global errors stay fatal outside the path filter', (t) => {
    withProject(({ config, write, run }) => {
        config({ types: ['missing-type-package'] });
        const missingType = run('--only', prefix);
        t.equal(missingType.status, 1, 'missing ambient types fail');
        reports(t, missingType, 'TS2688', 'the missing type package is named');
        config({ noLib: true });
        const missingGlobals = run('--only', prefix);
        t.equal(missingGlobals.status, 1, 'missing global types fail');
        reports(t, missingGlobals, 'TS2318', 'the missing globals are named');
        write('tsconfig.json', '{ "compilerOptions": { "target": "invalid-target" } }');
        const badConfig = run('--only', prefix);
        t.equal(badConfig.status, 1, 'invalid compiler options fail');
        reports(t, badConfig, 'TS6046', 'the invalid option is named');
    });
    t.end();
});

test('typecheck: preserve baseline keys, updates, and the shrinking ratchet', (t) => {
    withProject(({ root, write, run }) => {
        const baseline = () => JSON.parse(fs.readFileSync(path.join(root, 'baseline.json'), 'utf8'));
        t.equal(run('--update').status, 0, 'write an unfiltered baseline');
        t.deepEqual(baseline(), { tsconfig: 'tsconfig.json', total: 1, errors: { 'src/legacy.ts': { TS2322: 1 } } });
        t.equal(run().status, 0, 'unchanged errors match the baseline');
        write('src/legacy.ts', 'export const legacy: number = 1;');
        const fixed = run();
        t.equal(fixed.status, 1, 'fixed errors require a smaller baseline');
        reports(t, fixed, 'src/legacy.ts TS2322: 1 -> 0', 'the fixed error is named');
        t.equal(run('--only', prefix, '--update').status, 0, 'write a filtered baseline');
        t.deepEqual(baseline(), { tsconfig: 'tsconfig.json', only: prefix, total: 0, errors: {} });
        t.equal(run('--only', prefix).status, 0, 'clean filtered baseline matches');
    });
    t.end();
});
