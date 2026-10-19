import assert from 'assert';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import type http from 'http';
import type https from 'https';
import { resolveHttpsFiles } from '../mcpListeners';
import type { McpListeners } from '../mcpListeners';

class FakeServer extends EventEmitter {
    public port = 0;

    public host = '';

    public closed = false;

    public ready: () => void = () => undefined;

    public constructor(public handler: http.RequestListener, public options?: https.ServerOptions) { super(); }

    public listen(port: number, host: string, ready: () => void): void {
        this.port = port;
        this.host = host;
        this.ready = ready;
    }

    public close(): void { this.closed = true; }
}

function loadModule(file: string, dependencies: Record<string, unknown>) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true } });
    const exports: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    vm.runInNewContext(compiled.outputText, { exports,
        URL,
        Buffer,
        require: (name: string) => {
            if (!(name in dependencies)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return dependencies[name];
        } });
    return exports;
}

function fixture(readError = false, tlsError = false, validTo = '2099-01-01', validFrom = '2020-01-01') {
    const servers: FakeServer[] = [];
    const errors: string[] = [];
    const files: string[] = [];
    const { McpListeners: Listeners } = loadModule('mcpListeners.ts', {
        crypto: { X509Certificate: class { public validFrom = validFrom; public validTo = validTo; } },
        fs: { readFileSync: (file: string) => { files.push(file); if (readError) { throw new Error('ENOENT'); } return file; } },
        http: { createServer: (handler: http.RequestListener) => { const server = new FakeServer(handler); servers.push(server); return server; } },
        https: { createServer: (options: object, handler: http.RequestListener) => {
            if (tlsError) { throw new Error('key values mismatch'); }
            const server = new FakeServer(handler, options); servers.push(server); return server;
        } },
    });
    const listeners: McpListeners = new Listeners(() => undefined, (message: string) => errors.push(message));
    return { listeners, servers, errors, files };
}

const handler: http.RequestListener = (_req, res) => res.end('shared');
const settings = { port: 40889, allowLan: false, certFile: '/cert.pem', keyFile: '/key.pem' };

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['certificate paths use independent env overrides, including explicit empty values', () => {
        const config = (key: string) => ({ mcpHttpsCert: '/stored-cert', mcpHttpsKey: '/stored-key' }[key]);
        assert.deepStrictEqual(resolveHttpsFiles({}, config), { certFile: '/stored-cert', keyFile: '/stored-key', envOverrides: [] });
        assert.deepStrictEqual(resolveHttpsFiles({ LUBAN_MCP_HTTPS_CERT: '  /env-cert  ', LUBAN_MCP_HTTPS_KEY: '' }, config),
            { certFile: '/env-cert', keyFile: '', envOverrides: ['certFile', 'keyFile'] });
    }],
    ['HTTP and HTTPS share a handler, bind policy, and consecutive ports; live status waits for listening', () => {
        for (const allowLan of [false, true]) {
            const { listeners, servers } = fixture();
            listeners.start({ ...settings, allowLan }, handler);
            assert.strictEqual(servers.length, 2);
            assert.strictEqual(servers[0].handler, servers[1].handler);
            assert.strictEqual(servers[0].handler, handler);
            assert.strictEqual(servers[0].port, 40889);
            assert.strictEqual(servers[1].port, 40890);
            assert.strictEqual(servers[1].host, allowLan ? '0.0.0.0' : '127.0.0.1');
            assert.strictEqual(servers[0].host, servers[1].host);
            assert.strictEqual(servers[1].options?.minVersion, 'TLSv1.2');
            assert.strictEqual(listeners.httpsPort, null);
            servers.forEach((server) => server.ready());
            assert.strictEqual(listeners.httpPort, 40889);
            assert.strictEqual(listeners.httpsPort, 40890);
            listeners.start(settings, handler);
            assert.strictEqual(servers.length, 2);
            listeners.stop();
        }
    }],
    ['no TLS paths is HTTP-only; partial pair, bad files/PEM, and +1 overflow leave HTTP working', () => {
        const plain = fixture();
        plain.listeners.start({ ...settings, certFile: '', keyFile: '' }, handler);
        assert.strictEqual(plain.servers.length, 1);
        assert.strictEqual(plain.listeners.httpsError, null);
        for (const test of [
            { setup: fixture(), settings: { ...settings, keyFile: '' } },
            { setup: fixture(), settings: { ...settings, port: 65535 } },
            { setup: fixture(true), settings },
            { setup: fixture(false, true), settings },
            { setup: fixture(false, false, '2001-01-01'), settings },
            { setup: fixture(false, false, '2099-01-01', '2098-01-01'), settings },
        ]) {
            test.setup.listeners.start(test.settings, handler);
            test.setup.servers[0].ready();
            assert.strictEqual(test.setup.listeners.httpPort, test.settings.port);
            assert.strictEqual(test.setup.listeners.httpsPort, null);
            assert(test.setup.listeners.httpsError);
            assert.strictEqual(test.setup.errors.length, 1);
            test.setup.listeners.stop();
        }
    }],
    ['port conflicts are independent; shutdown closes both listeners and persistent sockets; restart clears errors', () => {
        const { listeners, servers } = fixture();
        listeners.start(settings, handler);
        servers.forEach((server) => server.ready());
        servers[1].emit('error', new Error('EADDRINUSE'));
        assert.strictEqual(listeners.httpsPort, null);
        assert.strictEqual(listeners.httpPort, 40889);
        assert.strictEqual(listeners.httpsError, 'EADDRINUSE');
        let destroyed = 0;
        const socket = Object.assign(new EventEmitter(), { destroy: () => { destroyed++; } });
        servers[0].emit('connection', socket);
        listeners.stop();
        assert.strictEqual(destroyed, 1);
        assert(servers.every((server) => server.closed));
        assert.strictEqual(listeners.started, false);
        listeners.start(settings, handler);
        servers.slice(2).forEach((server) => server.ready());
        assert.strictEqual(listeners.httpsError, null);
        servers[2].emit('error', new Error('HTTP busy'));
        assert.strictEqual(listeners.httpPort, null);
        assert.strictEqual(listeners.httpError, 'HTTP busy');
        assert.strictEqual(listeners.httpsPort, 40890);
        // A late callback from the previous generation cannot corrupt the new listener.
        servers[0].ready();
        servers[1].emit('error', new Error('old listener'));
        assert.strictEqual(listeners.httpPort, null);
        assert.strictEqual(listeners.httpError, 'HTTP busy');
        assert.strictEqual(listeners.httpsPort, 40890);
        listeners.stop();
    }],
    ['OAuth metadata preserves actual transport and port, ignoring forwarded-proto headers', () => {
        const { OAuthShim } = loadModule('oauth.ts', { crypto: require('crypto'), '../../lib/logger': () => ({}) });
        const oauth = new OAuthShim(40889);
        for (const encrypted of [true, false]) {
            for (const host of ['192.168.1.20:40890', undefined]) {
                const req = { method: 'GET', socket: { encrypted, localPort: encrypted ? 40890 : 40889 }, headers: { host, 'x-forwarded-proto': 'https' } };
                let body = '';
                const res = { writeHead: () => undefined, end: (value: string) => { body = value; } };
                oauth.handleRequest(req, res, new URL('http://localhost/.well-known/oauth-authorization-server'));
                const metadata = JSON.parse(body);
                const expected = `${encrypted ? 'https' : 'http'}://${host || `127.0.0.1:${req.socket.localPort}`}`;
                assert.strictEqual(metadata.issuer, expected);
                assert.strictEqual(metadata.token_endpoint, `${expected}/token`);
                assert.strictEqual(metadata.authorization_endpoint, `${expected}/authorize`);
                oauth.handleRequest(req, res, new URL('http://localhost/.well-known/oauth-protected-resource'));
                assert.strictEqual(JSON.parse(body).resource, `${expected}/mcp`);
            }
        }
    }],
];
