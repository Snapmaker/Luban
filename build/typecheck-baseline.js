/**
 * Type check a tsconfig against a committed baseline of known errors.
 *
 * The app tsconfig (tsconfig.json) inherits well over a thousand errors from
 * upstream Luban, mostly in legacy React/three code. Fixing them wholesale is
 * out of scope, so CI ratchets instead: the check fails when any file gains
 * errors of a given code, and asks for the baseline to be lowered when a file
 * loses them. Counts are keyed by file and TS code rather than line or
 * message, so unrelated edits that move or reword an existing error do not
 * trip the check.
 *
 * --only <path prefix> counts just the errors in files under that prefix. The
 * MCP code's strict tsconfig pulls in the legacy server modules it imports,
 * whose strict-mode errors are not the MCP's to fix; with an empty baseline
 * the MCP files themselves must stay clean. Syntax, configuration and global
 * errors always fail: they can prevent TypeScript from checking file types.
 *
 * Usage:
 *   node build/typecheck-baseline.js <tsconfig> <baseline.json> [--only <prefix>]           check
 *   node build/typecheck-baseline.js <tsconfig> <baseline.json> [--only <prefix>] --update  rewrite the baseline
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const argv = process.argv.slice(2);
const update = argv.includes('--update');
const onlyAt = argv.indexOf('--only');
const only = onlyAt >= 0 ? argv[onlyAt + 1] : null;
const [tsconfig, baselineFile] = argv.filter((arg, i) => !arg.startsWith('--') && (onlyAt < 0 || i !== onlyAt + 1));
if (!tsconfig || !baselineFile || (onlyAt >= 0 && !only)) {
    console.error('usage: node build/typecheck-baseline.js <tsconfig> <baseline.json> [--only <prefix>] [--update]');
    process.exit(2);
}

function failOnDiagnostics(diagnostics) {
    const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length) {
        process.stderr.write(ts.formatDiagnostics(errors, {
            getCanonicalFileName: (file) => file,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getNewLine: () => ts.sys.newLine,
        }));
        process.exit(1);
    }
}

function currentErrors() {
    const parsed = ts.getParsedCommandLineOfConfigFile(path.resolve(tsconfig), { noEmit: true }, {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => failOnDiagnostics([diagnostic]),
    });
    if (!parsed) {
        process.exit(1);
    }
    failOnDiagnostics(parsed.errors);
    const program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        projectReferences: parsed.projectReferences,
    });
    // tsc skips semantic checking after syntax/options/global failures. Never
    // filter or baseline those failures, even when they are outside --only.
    failOnDiagnostics([
        ...program.getOptionsDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...program.getSyntacticDiagnostics(),
    ]);

    const counts = {};
    let total = 0;
    for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
        if (diagnostic.category !== ts.DiagnosticCategory.Error) {
            continue;
        }
        if (!diagnostic.file) {
            failOnDiagnostics([diagnostic]);
        }
        const file = path.relative(process.cwd(), diagnostic.file.fileName).split(path.sep).join('/');
        if (only && !file.startsWith(only)) {
            continue;
        }
        const code = `TS${diagnostic.code}`;
        counts[file] = counts[file] || {};
        counts[file][code] = (counts[file][code] || 0) + 1;
        total++;
    }
    return { counts, total };
}

function sorted(counts) {
    const out = {};
    for (const file of Object.keys(counts).sort()) {
        out[file] = {};
        for (const code of Object.keys(counts[file]).sort()) {
            out[file][code] = counts[file][code];
        }
    }
    return out;
}

const { counts, total } = currentErrors();
const onlyArgs = only ? ` --only ${only}` : '';

if (update) {
    const written = only ? { tsconfig, only, total, errors: sorted(counts) } : { tsconfig, total, errors: sorted(counts) };
    fs.writeFileSync(baselineFile, `${JSON.stringify(written, null, 2)}\n`);
    console.log(`Baseline written: ${total} errors in ${Object.keys(counts).length} files -> ${baselineFile}`);
    process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).errors;
const added = [];
const removed = [];
for (const file of new Set([...Object.keys(baseline), ...Object.keys(counts)])) {
    for (const code of new Set([...Object.keys(baseline[file] || {}), ...Object.keys(counts[file] || {})])) {
        const was = (baseline[file] && baseline[file][code]) || 0;
        const now = (counts[file] && counts[file][code]) || 0;
        if (now > was) {
            added.push(`${file} ${code}: ${was} -> ${now}`);
        } else if (now < was) {
            removed.push(`${file} ${code}: ${was} -> ${now}`);
        }
    }
}

console.log(`${tsconfig}: ${total} errors${only ? ` under ${only}` : ''} (baseline ${baselineFile}).`);
if (added.length) {
    console.error(`\nNew type errors (fix them; the baseline only shrinks):\n  ${added.sort().join('\n  ')}`);
    console.error(`\nRun \`npx tsc --noEmit -p ${tsconfig}\` and look at the files above.`);
}
if (removed.length) {
    const log = added.length ? console.error : console.log;
    log(`\nErrors fixed since the baseline:\n  ${removed.sort().join('\n  ')}`);
    log(`\nLower the baseline: node build/typecheck-baseline.js ${tsconfig} ${baselineFile}${onlyArgs} --update`);
}
process.exit(added.length || removed.length ? 1 : 0);
