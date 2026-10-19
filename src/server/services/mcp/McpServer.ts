import os from 'os';
import http from 'http';

import logger from '../../lib/logger';
import { McpToolError, ToolRegistry } from './registry';

const log = logger('service:mcp');

// MCP Streamable HTTP transport, stateless mode, implemented directly:
// the official SDK requires Node >= 18 and Electron 15 embeds Node 16.
//
// Scope: JSON-RPC 2.0 over POST /mcp. No session ids, no SSE stream (GET
// returns 405, which the spec permits for servers that don't offer one).
const PROTOCOL_VERSION = '2025-03-26';

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;

const MAX_BODY_BYTES = 4 * 1024 * 1024;

interface JsonRpcMessage {
    jsonrpc?: string;
    id?: number | string | null;
    method?: string;
    params?: { [key: string]: unknown };
}

function rpcResult(id: number | string, result: object): object {
    return { jsonrpc: '2.0', id, result };
}

function rpcError(id: number | string | null, code: number, message: string): object {
    return { jsonrpc: '2.0', id, error: { code, message } };
}

// Requests from browsers carry an Origin header; a permitted one is only
// ever localhost (or the app's own luban:// scheme). Anything else is a
// DNS-rebinding attempt on a loopback-only server, per MCP spec guidance.
export function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) {
        return true;
    }
    return /^(luban:\/\/|https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$)/.test(origin);
}

export function isLoopback(address: string | undefined): boolean {
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function ipv4ToInt(address: string): number | null {
    const parts = address.split('.');
    if (parts.length !== 4) {
        return null;
    }
    let value = 0;
    for (const part of parts) {
        const n = Number(part);
        if (!Number.isInteger(n) || n < 0 || n > 255) {
            return null;
        }
        value = (value * 256) + n;
    }
    return value;
}

/**
 * IPv4 addresses of this machine's own non-internal interfaces, with their
 * netmasks - the subnets an operator on "the local network" sits on.
 */
export function localSubnets(): { address: string; netmask: string }[] {
    const result: { address: string; netmask: string }[] = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (!iface.internal && (iface.family === 'IPv4' || (iface.family as unknown) === 4)) {
                result.push({ address: iface.address, netmask: iface.netmask });
            }
        }
    }
    return result;
}

/**
 * True when the remote address is on one of this machine's own IPv4 subnets
 * (mcpAllowLan). IPv4-mapped IPv6 is unwrapped; other IPv6 is refused - the
 * LAN option is deliberately narrow, not "anything routable".
 */
export function isLocalSubnetAddress(address: string | undefined): boolean {
    if (!address) {
        return false;
    }
    const plain = address.startsWith('::ffff:') ? address.slice(7) : address;
    const remote = ipv4ToInt(plain);
    if (remote === null) {
        return false;
    }
    for (const subnet of localSubnets()) {
        const local = ipv4ToInt(subnet.address);
        const mask = ipv4ToInt(subnet.netmask);
        if (local === null || mask === null) {
            continue;
        }
        // eslint-disable-next-line no-bitwise
        if (((remote & mask) >>> 0) === ((local & mask) >>> 0)) {
            return true;
        }
    }
    return false;
}

/** Browser origins acceptable in LAN mode: a host on one of our subnets. */
export function isLocalSubnetOrigin(origin: string | undefined): boolean {
    if (!origin) {
        return true;
    }
    const match = origin.match(/^https?:\/\/([0-9.]+)(:\d+)?$/);
    return !!match && isLocalSubnetAddress(match[1]);
}

/**
 * The one trust boundary, shared by every route (/mcp, the OAuth shim, the
 * confirm pages): a local process, or in LAN mode a host on one of this
 * machine's own subnets.
 */
export function isTrustedAddress(address: string | undefined, allowLan: boolean): boolean {
    return isLoopback(address) || (allowLan && isLocalSubnetAddress(address));
}

export function isTrustedOrigin(origin: string | undefined, allowLan: boolean): boolean {
    return isAllowedOrigin(origin) || (allowLan && isLocalSubnetOrigin(origin));
}

export interface McpServerOptions {
    /** mcpAllowLan: accept same-subnet clients, not only loopback. */
    allowLan?: boolean;
    /** Label for the caller (from its OAuth token) - for log lines only. */
    identifyClient?: (req: http.IncomingMessage) => string | null;
}

export class McpServer {
    private registry: ToolRegistry;

    private serverName: string;

    private serverVersion: string;

    private onActivity: ((activity: object) => void) | null;

    private options: McpServerOptions;

    public constructor(
        registry: ToolRegistry,
        serverName: string,
        serverVersion: string,
        onActivity?: (activity: object) => void,
        options?: McpServerOptions
    ) {
        this.registry = registry;
        this.serverName = serverName;
        this.serverVersion = serverVersion;
        this.onActivity = onActivity || null;
        this.options = options || {};
    }

    public handleRequest = (req: http.IncomingMessage, res: http.ServerResponse): void => {
        // index.ts gates every route already; re-check per request as
        // defense in depth, with the SAME policy (a hard loopback check here
        // used to refuse every LAN client that the outer gate had admitted).
        const allowLan = !!this.options.allowLan;
        if (!isTrustedAddress(req.socket.remoteAddress, allowLan)) {
            this.respond(res, 403, { error: allowLan ? 'local subnet only' : 'loopback only' });
            return;
        }
        if (!isTrustedOrigin(req.headers.origin, allowLan)) {
            log.warn(`MCP request with disallowed origin rejected: ${req.headers.origin}`);
            this.respond(res, 403, { error: 'origin not allowed' });
            return;
        }

        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname !== '/mcp') {
            this.respond(res, 404, { error: 'not found' });
            return;
        }
        if (req.method !== 'POST') {
            // No SSE stream is offered (GET) and no sessions exist to end (DELETE).
            res.writeHead(405, { Allow: 'POST' });
            res.end();
            return;
        }

        const client = this.options.identifyClient ? this.options.identifyClient(req) : null;
        this.readBody(req, res, (body) => {
            this.handlePost(body, res, client);
        });
    };

    private readBody(req: http.IncomingMessage, res: http.ServerResponse, callback: (body: string) => void): void {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                req.destroy();
                this.respond(res, 413, { error: 'body too large' });
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (!res.writableEnded) {
                callback(Buffer.concat(chunks).toString('utf8'));
            }
        });
        req.on('error', (err) => {
            log.warn(`MCP request error: ${err.message}`);
        });
    }

    private async handlePost(body: string, res: http.ServerResponse, client: string | null): Promise<void> {
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch (err) {
            this.respond(res, 400, rpcError(null, JSONRPC_PARSE_ERROR, 'Parse error'));
            return;
        }

        const messages: JsonRpcMessage[] = Array.isArray(parsed) ? parsed : [parsed as JsonRpcMessage];
        if (messages.length === 0) {
            this.respond(res, 400, rpcError(null, JSONRPC_INVALID_REQUEST, 'Empty batch'));
            return;
        }

        const responses = [];
        for (const message of messages) {
            // eslint-disable-next-line no-await-in-loop
            const response = await this.handleMessage(message, client);
            if (response) {
                responses.push(response);
            }
        }

        if (responses.length === 0) {
            // Notifications only
            res.writeHead(202);
            res.end();
        } else if (Array.isArray(parsed)) {
            this.respond(res, 200, responses);
        } else {
            this.respond(res, 200, responses[0]);
        }
    }

    private async handleMessage(message: JsonRpcMessage, client: string | null): Promise<object | null> {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            return rpcError((message && message.id) || null, JSONRPC_INVALID_REQUEST, 'Invalid request');
        }

        // Notification: no response
        if (message.id === undefined || message.id === null) {
            return null;
        }

        const { id, method, params } = message;
        try {
            switch (method) {
                case 'initialize': {
                    const info = (params && params.clientInfo) as { name?: unknown; version?: unknown } | undefined;
                    const described = info && typeof info.name === 'string'
                        ? `${info.name}${typeof info.version === 'string' ? ` ${info.version}` : ''}`
                        : 'unnamed client';
                    log.info(`MCP initialize from ${described}${client ? ` [token: ${client}]` : ''} `
                        + `(protocol ${(params && params.protocolVersion) || '?'})`);
                    return rpcResult(id, {
                        protocolVersion: PROTOCOL_VERSION,
                        capabilities: {
                            tools: { listChanged: false },
                        },
                        serverInfo: {
                            name: this.serverName,
                            version: this.serverVersion,
                        },
                    });
                }
                case 'ping':
                    return rpcResult(id, {});
                case 'tools/list':
                    return rpcResult(id, { tools: this.registry.list() });
                case 'tools/call':
                    return await this.handleToolCall(id, params, client);
                default:
                    return rpcError(id, JSONRPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
            }
        } catch (err) {
            log.error(`MCP ${method} failed: ${(err as Error).message}`);
            return rpcError(id, JSONRPC_INTERNAL_ERROR, 'Internal error');
        }
    }

    private async handleToolCall(id: number | string, params: JsonRpcMessage['params'], client: string | null): Promise<object> {
        const name = params && params.name;
        if (typeof name !== 'string') {
            return rpcError(id, JSONRPC_INVALID_PARAMS, 'tools/call requires a tool name');
        }
        if (!this.registry.has(name)) {
            return rpcError(id, JSONRPC_INVALID_PARAMS, `Unknown tool: ${name}`);
        }

        // Every call logs its arguments and a result summary (truncated -
        // args can carry whole gcode files, results whole images), so the
        // server log alone tells the story of an agent session.
        const summarize = (value: unknown, limit: number): string => {
            let text: string;
            try {
                text = JSON.stringify(value, (key, v) => {
                    if (typeof v === 'string' && v.length > 300) {
                        return `${v.slice(0, 120)}...<${v.length} chars>`;
                    }
                    return v;
                }) || 'undefined';
            } catch (err) {
                text = String(value);
            }
            return text.length > limit ? `${text.slice(0, limit)}...<truncated>` : text;
        };
        const args = ((params && params.arguments) as object) || {};
        const startedAt = Date.now();
        log.info(`tool ${name}${client ? ` [${client}]` : ''} <- ${summarize(args, 600)}`);
        try {
            const result = await this.registry.call(name, args);
            log.info(`tool ${name} ok in ${Date.now() - startedAt}ms -> ${summarize(result, 900)}`);
            this.onActivity && this.onActivity({ tool: name, ok: true, durationMs: Date.now() - startedAt });
            // A tool that returns non-text content (e.g. an image) supplies
            // the MCP content array itself via mcpContent.
            const content = (result as { mcpContent?: object[] })?.mcpContent
                || [{ type: 'text', text: JSON.stringify(result) }];
            return rpcResult(id, {
                content,
                isError: false,
            });
        } catch (err) {
            // Tool failures are results, not protocol errors, so the model
            // calling the tool can read them.
            const text = err instanceof McpToolError ? err.message : `Tool failed: ${(err as Error).message}`;
            log.warn(`tool ${name} failed in ${Date.now() - startedAt}ms: ${text}`);
            this.onActivity && this.onActivity({ tool: name, ok: false, durationMs: Date.now() - startedAt, error: text });
            return rpcResult(id, {
                content: [{ type: 'text', text }],
                isError: true,
            });
        }
    }

    private respond(res: http.ServerResponse, status: number, payload: object): void {
        const body = JSON.stringify(payload);
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
    }
}
