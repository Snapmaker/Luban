/* eslint-disable camelcase */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { isolatedModule } from './jobDashboard.test';

// Every tool that stages a job for the operator's confirm page returns its
// confirm_url: the motion rules tell agents to deliver it as the last line and
// end the turn, and registry.ts adds that handoff only when it is present.
// goto_work_origin returned none (found live on the Ray, 2026-10-19).

type Result = Record<string, unknown>;
type Tool = { name: string; handler: (args: object) => Promise<Result> };

/** tools/camera.ts with every import inert and only goto_work_origin's staging path stubbed. */
function cameraTools(baseUrl?: () => string): Map<string, Tool> {
    const source = fs.readFileSync(path.join(__dirname, '../tools/camera.ts'), 'utf8');
    const deps: Record<string, unknown> = {};
    for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) deps[match[1]] = {};
    const position = {
        machine: { x: 120, y: 80, z: 40 },
        originOffset: { x: 10, y: 20, z: 0 },
        originOffsetSource: 'heartbeat',
        warnings: [],
        machineStatus: 'idle',
        isHomed: true,
    };
    const camera = isolatedModule('tools/camera.ts', {
        ...deps,
        '../../../lib/logger': () => ({ info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined }),
        '../procedureLimits': require('../procedureLimits'),
        '../registry': { McpToolError: Error },
        '../probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
        './machine': {
            assertFreshHeartbeat: () => undefined,
            traverseMachine: () => ({ hasZ: true }),
            getPositionSnapshot: () => position,
            requirePlanningTravel: () => ({ limits: { xMin: 0, xMax: 320, yMin: 0, yMax: 350 } }),
            safeTraverseZ: () => 0,
            motionFloorZ: () => -50,
            motionGcodeForm: () => 'G53 absolute',
        },
        '../connectedMachine': {
            assertToolheadNotOn: () => ({ state: 'off' }),
            connectedToolheadNote: () => null,
            describeConnectedMachine: () => ({ identifier: 'A350' }),
            connectedMachineTag: () => '(machine: A350)',
        },
        '../directMovePlan': {
            planGotoWorkOrigin: () => ({ reviewText: 'G90\nG53;\nG0 X10 Y20;\nG54;', name: 'goto work origin', destinationMachine: { x: 10, y: 20 }, relative: false }),
        },
        '../landmarks': { landmarkStore: { obstacleBoxes: () => [] } },
        '../clearanceContext': { clearanceOptions: () => ({}) },
        './staging': { validateStagedEnvelope: () => ({ warnings: [] }) },
        '../jobs': { jobManager: { submit: () => ({ id: 'job123' }), describe: (job: { id: string }) => ({ id: job.id }) } },
    }, { clearTimeout, Date, JSON });
    const tools: Map<string, Tool> = new Map();
    camera.registerCameraTools({ register: (tool: Tool) => tools.set(tool.name, tool) }, baseUrl);
    return tools;
}

/**
 * Each `jobManager.submit(` in a tool module, with the code up to the next
 * submit, tool registration or top-level function: the staging result built
 * from that job lives there.
 */
function stagingSites(): Array<{ file: string; line: number; body: string }> {
    const dir = path.join(__dirname, '..');
    const files = [
        ...fs.readdirSync(path.join(dir, 'tools')).filter((name) => name.endsWith('.ts')).map((name) => `tools/${name}`),
        'cameraProgram.ts',
    ];
    const sites: Array<{ file: string; line: number; body: string }> = [];
    for (const file of files) {
        const source = fs.readFileSync(path.join(dir, file), 'utf8');
        const starts = [...source.matchAll(/jobManager\.submit\(/g)].map((m) => m.index as number);
        for (const start of starts) {
            const rest = source.slice(start + 1);
            const ends = [/jobManager\.submit\(/, /registry\.register\(/, /\n(?:export )?(?:async )?function /]
                .map((pattern) => rest.search(pattern))
                .filter((at) => at >= 0);
            const end = ends.length ? start + 1 + Math.min(...ends) : source.length;
            sites.push({ file, line: source.slice(0, start).split('\n').length, body: source.slice(start, end) });
        }
    }
    return sites;
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['goto_work_origin\'s staging result carries confirm_url and next_step, and keeps its note', async () => {
        const tools = cameraTools(() => 'http://127.0.0.1:40889');
        const tool = tools.get('goto_work_origin');
        assert.ok(tool, 'goto_work_origin is registered');
        const result = await tool.handler({ reason: 'check the origin' });
        assert.equal(result.confirm_url, 'http://127.0.0.1:40889/confirm/job123');
        assert.match(String(result.next_step), /open confirm_url/);
        assert.match(String(result.next_step), /start_gcode_job with wait_for_approval_ms/);
        assert.match(String(result.note), /MACHINE destination/);
    }],
    ['every staging site returns a confirm_url (or is a policy-approved run with no confirm page)', () => {
        const sites = stagingSites();
        assert.ok(sites.length >= 20, `found ${sites.length} staging sites; the scan is broken`);
        const missing = sites
            .filter((site) => !/confirm_url:/.test(site.body) && !/jobManager\.approveByPolicy\(/.test(site.body))
            .map((site) => `${site.file}:${site.line}`);
        assert.deepEqual(missing, [], `staging without confirm_url: ${missing.join(', ')}`);
        assert.ok(sites.some((site) => site.file === 'tools/camera.ts' && /confirm_url:/.test(site.body)), 'goto_work_origin is scanned');
    }],
];
