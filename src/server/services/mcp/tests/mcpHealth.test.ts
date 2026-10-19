import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { deriveMcpHealth, McpHealthChanges, McpHealthInput } from '../../../../shared/lib/mcpHealth';
import * as healthModule from '../../../../shared/lib/mcpHealth';

const healthy: McpHealthInput = { enabled: true, running: true };
const disconnected = { configured: true, connected: false, connecting: false, transport: 'gpio', lastError: 'USB bridge missing' };

function load(file: string, dependencies: Record<string, unknown>, globals: object = {}) {
    const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
    const exports: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, jsx: ts.JsxEmit.React, esModuleInterop: true,
    } });
    vm.runInNewContext(compiled.outputText, { exports,
        ...globals,
        require: (name: string) => {
            if (!(name in dependencies)) { throw new Error(`Unstubbed ${name}`); }
            return dependencies[name];
        } });
    return exports;
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['disabled MCP stays quiet; listener and startup causes remain visible even if HTTPS alone is running', () => {
        const broken = { ...healthy, running: false, httpError: 'port busy', httpsError: 'PEM missing', probe: disconnected };
        assert.deepStrictEqual(deriveMcpHealth({ ...broken, enabled: false }).issues, []);
        assert.deepStrictEqual(deriveMcpHealth(broken).issues.map((i) => i.id), ['http', 'https', 'probe-feed']);
        assert.strictEqual(deriveMcpHealth({ ...healthy, httpError: 'port busy' }).issues[0].id, 'http');
        assert.strictEqual(deriveMcpHealth({ ...broken, startupError: 'registration failed' }).issues[0].id, 'startup');
        assert.strictEqual(deriveMcpHealth({ ...healthy, running: false, starting: true }).issues.length, 0);
        assert.strictEqual(deriveMcpHealth({ ...healthy, running: false }).issues[0].id, 'not-running');
    }],
    ['unused/disabled sensors stay quiet, partial configuration and failed reconnects stay visible', () => {
        const unconfigured = { ...disconnected, configured: false, lastError: null };
        assert.strictEqual(deriveMcpHealth({ ...healthy, probe: unconfigured }).issues.length, 0);
        assert.strictEqual(deriveMcpHealth({ ...healthy, probe: { ...disconnected, disabledSensors: ['probe', 'overtravel', 'toolsetter'] } }).issues.length, 0);
        assert.strictEqual(deriveMcpHealth({ ...healthy, probe: unconfigured, probeTransportSelected: true }).issues[0].id, 'probe-config');
        assert.strictEqual(deriveMcpHealth({ ...healthy, probe: { ...unconfigured, feeds: { probe: { source: 'GP6' } } } }).issues[0].id, 'probe-config');
        assert.strictEqual(deriveMcpHealth({ ...healthy, probe: { ...disconnected, connecting: true, lastError: null } }).issues.length, 0);
        assert.strictEqual(deriveMcpHealth({ ...healthy, probe: { ...disconnected, connecting: true } }).issues[0].id, 'probe-feed');
        assert.strictEqual(deriveMcpHealth({ ...healthy, probe: { ...disconnected, connected: true } }).issues.length, 0);
    }],
    ['certificate expiry, diagnostic exceptions, camera failures and latched alarms have actionable issues', () => {
        const report = deriveMcpHealth({ ...healthy,
            certificateValidTo: 100,
            diagnosticError: 'bad config',
            probe: { ...disconnected, connected: true, safetyTrip: { channel: 'probe' } },
            camera: { enabled: true, lastError: 'Camera unplugged' } }, 200);
        assert.deepStrictEqual(report.issues.map((i) => i.id), ['certificate', 'diagnostics', 'probe-alarm', 'camera']);
        assert(report.issues.every((issue) => issue.message.length > 30));
        assert.strictEqual(deriveMcpHealth({ ...healthy, certificateValidTo: 300 }, 200).issues.length, 0);
    }],
    ['notifications deduplicate changing retries, clear on recovery, and re-arm for a later incident', () => {
        const changes = new McpHealthChanges();
        const fault = deriveMcpHealth({ ...healthy, probe: disconnected });
        assert.strictEqual(changes.update(fault).added.length, 1);
        assert.strictEqual(changes.update(fault).added.length, 0);
        const retry = deriveMcpHealth({ ...healthy, probe: { ...disconnected, connecting: true, lastError: 'retry failed' } });
        assert.strictEqual(changes.update(retry).updated.length, 1);
        assert.strictEqual(changes.update(deriveMcpHealth(healthy)).recovered.length, 1);
        assert.strictEqual(changes.update(fault).added.length, 1);
        const disabled = changes.update({ enabled: false, issues: [] });
        assert.strictEqual(disabled.removed.length, 1);
        assert.strictEqual(disabled.recovered.length, 0);
    }],
    ['a synchronous MCP startup exception leaves health reporting available inside Luban', () => {
        let enabled = true;
        let stops = 0;
        const deps: Record<string, unknown> = {};
        const source = fs.readFileSync(path.join(__dirname, '../index.ts'), 'utf8');
        for (const match of source.matchAll(/from '([^']+)'/g)) { deps[match[1]] = {}; }
        Object.assign(deps, {
            '../../../shared/lib/mcpHealth': healthModule,
            '../../lib/logger': () => ({ info: () => undefined, error: () => undefined }),
            '../configstore': { get: (key: string) => (key === 'mcpEnabled' ? enabled : undefined) },
            './registry': { ToolRegistry: class {} },
            './tools/status': { registerStatusTools: () => { throw new Error('fixture startup failure'); } },
            './mcpListeners': { McpListeners: class {
                public started = false;
                public httpPort = null;
                public httpsPort = null;
                public stop() { stops++; }
            } },
            './probeFeed': { probeFeedService: { status: () => ({ configured: false }) } },
            './cameraStream': { cameraStreamService: { status: () => ({ enabled: false, lastError: null }) } },
        });
        const service = load('../index.ts', deps, { process: { env: {} } });
        assert.doesNotThrow(() => service.startMcpService());
        assert.strictEqual(stops, 1);
        assert(service.getMcpHealth().issues[0].message.includes('fixture startup failure'));
        enabled = false;
        assert.strictEqual(service.getMcpHealth().issues.length, 0);
    }],
    ['app monitor avoids toast storms, opens MCP Settings, handles stale health, and cleans up', async () => {
        let snapshot = deriveMcpHealth({ ...healthy, probe: disconnected });
        let fail = false;
        type Poll = () => Promise<void>;
        const timers = new Map<number, Poll>();
        let sequence = 0;
        const calls: string[] = [];
        const visible = new Set<string>();
        // Assigned inside callbacks (here and act() below) that
        // control-flow analysis does not follow.
        let content!: React.ReactElement;
        const toast = Object.assign((element: React.ReactElement, options: { toastId: string }) => {
            content = element; calls.push('add'); visible.add(options.toastId);
        }, {
            isActive: (id: string) => visible.has(id),
            update: () => calls.push('update'),
            dismiss: (id: string) => { calls.push('dismiss'); visible.delete(id); },
            success: () => calls.push('recovered'),
        });
        const module = load('../../../../app/ui/components/McpHealth/index.tsx', {
            react: React,
            '../../../../shared/lib/mcpHealth': healthModule,
            '../Toast': { toast, ToastContainer: (props: object) => React.createElement('div', { ...props, 'data-test': 'health-toast-container' }) },
            '../../../api': { getMcpHealth: async () => { if (fail) { throw new Error('offline'); } return { body: snapshot }; } },
            '../../../lib/uni-api': { Event: { emit: (event: string, data: { activeTab: string }) => calls.push(`${event}:${data.activeTab}`) } },
        }, {
            setTimeout: (fn: () => Promise<void>) => { sequence++; timers.set(sequence, fn); return sequence; },
            clearTimeout: (id: number) => timers.delete(id),
        });
        let root!: renderer.ReactTestRenderer;
        await act(async () => { root = renderer.create(React.createElement(module.McpHealthNotifications)); });
        const tick = async () => {
            const [id, fn] = [...timers.entries()][0]; timers.delete(id);
            await act(async () => { await fn(); });
        };
        assert.deepStrictEqual(calls, ['add']);
        const container = root.root.findByProps({ 'data-test': 'health-toast-container' });
        assert.strictEqual(container.props.enableMultiContainer, true);
        assert.strictEqual(container.props.containerId, 'mcp-health');
        const buttons = renderer.create(content).root.findAllByType('button');
        const settingsButton = buttons.find((button) => button.children.includes('Open MCP Settings'));
        assert(settingsButton);
        settingsButton.props.onClick();
        assert(calls.includes('appbar-menu:preferences.show:mcp'));
        await tick();
        assert.strictEqual(calls.filter((c) => c === 'add').length, 1);
        const dismissButton = buttons.find((button) => button.children.includes('Dismiss'));
        assert(dismissButton);
        dismissButton.props.onClick();
        assert.strictEqual(visible.size, 0); // Actual dismiss action; retry text must not reopen it.
        snapshot = deriveMcpHealth({ ...healthy, probe: { ...disconnected, lastError: 'still disconnected', connecting: true } });
        await tick();
        assert.strictEqual(calls.filter((c) => c === 'add').length, 1);
        fail = true;
        await tick(); await tick(); await tick();
        assert.strictEqual(calls.filter((c) => c === 'add').length, 2); // one status-unavailable incident
        fail = false;
        snapshot = deriveMcpHealth(healthy);
        await tick();
        assert.strictEqual(calls.filter((c) => c === 'recovered').length, 2);
        snapshot = deriveMcpHealth({ ...healthy, probe: disconnected });
        await tick();
        assert.strictEqual(calls.filter((c) => c === 'add').length, 3);
        snapshot = { enabled: false, issues: [] };
        await tick();
        assert.strictEqual(calls.filter((c) => c === 'recovered').length, 2);
        fail = true;
        await tick(); await tick();
        assert.strictEqual(calls.filter((c) => c === 'add').length, 3); // disabled MCP stays quiet even if status fails
        await act(async () => { root.unmount(); });
        assert.strictEqual(timers.size, 0);
        fail = false;
        snapshot = deriveMcpHealth({ ...healthy, probe: disconnected });
        await act(async () => { root = renderer.create(React.createElement(module.McpHealthPanel)); });
        assert(root.root.findAllByType('strong').some((node) => node.children.includes('MCP probe feed is unavailable')));
        snapshot = deriveMcpHealth(healthy);
        await tick();
        assert(root.root.findAllByType('p').some((node) => node.children.includes('No MCP service problems reported.')));
        await act(async () => { root.unmount(); });
        assert.strictEqual(timers.size, 0);
    }],
];
