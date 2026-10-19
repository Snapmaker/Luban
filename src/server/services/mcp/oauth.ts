import crypto from 'crypto';
import http from 'http';
import type { TLSSocket } from 'tls';

import logger from '../../lib/logger';

const log = logger('service:mcp:oauth');

// OAuth 2.1 compatibility shim for MCP clients.
//
// The trust boundary of this server is the network (loopback, or the
// machine's own subnets with mcpAllowLan) plus the human confirm pages; the
// README says "no authentication exists" and that stays true. But some MCP
// clients (Claude Code / Claude Desktop with an `http` server entry) run the
// MCP authorization flow before their first JSON-RPC call - metadata
// discovery, Dynamic Client Registration (RFC 7591), authorization code +
// PKCE (RFC 7636), token exchange - and refuse to connect when any step
// 404s. This module answers every step of that dance and grants it to
// everyone who reaches it: /authorize redirects straight back with a code,
// /token hands out an opaque bearer token, and /mcp never checks tokens.
//
// What the flow buys us is attribution: the client_name registered by a
// client travels with its token, so the server log can say WHICH agent
// called a tool.
//
// Every route here sits behind the same address / Origin gate as /mcp
// (index.ts applies it before routing), so the LAN setting is respected.

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_CLIENTS = 256;
const MAX_CODES = 256;
const MAX_TOKENS = 1024;
const MAX_BODY_BYTES = 64 * 1024;

interface RegisteredClient {
    clientId: string;
    clientName: string;
    redirectUris: string[];
    software: string | null;
    registeredAt: number;
    registeredFrom: string;
}

interface PendingCode {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    createdAt: number;
}

interface IssuedToken {
    kind: 'access' | 'refresh';
    clientId: string;
    issuedAt: number;
}

/** Client label for log lines: "Claude Code (luban-3f9a…)" or the bare id. */
export function describeClient(client: { clientId: string; clientName: string } | undefined, clientId: string): string {
    if (client && client.clientName && client.clientName !== client.clientId) {
        return `${client.clientName} (${client.clientId})`;
    }
    return clientId;
}

function isLoopbackHost(hostname: string): boolean {
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}

/**
 * Redirect URIs a client may register: loopback http(s) (the SDKs' local
 * callback listener) or a private-use scheme (desktop apps). An http(s) URI
 * to some other host is refused - there is no reason for a code minted on
 * this LAN to leave it.
 */
export function isAcceptableRedirectUri(value: string): boolean {
    let url: URL;
    try {
        url = new URL(value);
    } catch (err) {
        return false;
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
        return isLoopbackHost(url.hostname);
    }
    return /^[a-z][a-z0-9+.-]*:$/i.test(url.protocol);
}

function base64url(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pkceChallenge(verifier: string): string {
    return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function randomToken(prefix: string, bytes = 24): string {
    return `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;
}

/** Drop the oldest entries of an insertion-ordered Map beyond a cap. */
function trim<K, V>(map: Map<K, V>, max: number): void {
    while (map.size > max) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
    }
}

export class OAuthShim {
    private clients = new Map<string, RegisteredClient>();

    private codes = new Map<string, PendingCode>();

    private tokens = new Map<string, IssuedToken>();

    private port: number;

    public constructor(port: number) {
        this.port = port;
    }

    /**
     * Serve an OAuth / metadata route. Returns false when the path is not one
     * of ours so the caller can fall through to /mcp and the confirm pages.
     */
    public handleRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): boolean {
        const { pathname } = url;
        if (/^\/\.well-known\/oauth-protected-resource(\/mcp)?$/.test(pathname)) {
            this.methodGuard(req, res, 'GET', () => this.protectedResourceMetadata(req, res));
            return true;
        }
        if (/^\/\.well-known\/(oauth-authorization-server|openid-configuration)(\/mcp)?$/.test(pathname)) {
            this.methodGuard(req, res, 'GET', () => this.authorizationServerMetadata(req, res));
            return true;
        }
        if (pathname === '/register') {
            this.methodGuard(req, res, 'POST', () => this.readBody(req, res, (body) => this.register(req, res, body)));
            return true;
        }
        if (pathname === '/authorize') {
            this.methodGuard(req, res, 'GET', () => this.authorize(req, res, url));
            return true;
        }
        if (pathname === '/token') {
            this.methodGuard(req, res, 'POST', () => this.readBody(req, res, (body) => this.token(req, res, body)));
            return true;
        }
        return false;
    }

    /**
     * Who is calling, from the Authorization header - for LOG LINES ONLY.
     * A missing or unknown token is not refused: the network is the trust
     * boundary, and clients that never ran the flow (or hold a token from
     * before a restart) must keep working.
     */
    public identifyClient(req: http.IncomingMessage): string | null {
        const header = req.headers.authorization;
        if (typeof header !== 'string') {
            return null;
        }
        const match = header.match(/^Bearer\s+(\S+)$/i);
        if (!match) {
            return null;
        }
        const token = this.tokens.get(match[1]);
        if (!token || token.kind !== 'access') {
            return 'unknown token';
        }
        return describeClient(this.clients.get(token.clientId), token.clientId);
    }

    // ---- metadata -------------------------------------------------------

    /**
     * The URL the client reached us by, so the endpoints we advertise are the
     * ones it can actually use (127.0.0.1 vs a LAN address). The Host header
     * is only ever echoed back to the client that sent it.
     */
    private issuer(req: http.IncomingMessage): string {
        const scheme = (req.socket as TLSSocket).encrypted ? 'https' : 'http';
        const host = req.headers.host;
        if (typeof host === 'string' && /^[A-Za-z0-9.\-[\]:]{1,253}$/.test(host)) {
            return `${scheme}://${host}`;
        }
        return `${scheme}://127.0.0.1:${req.socket.localPort || this.port}`;
    }

    private protectedResourceMetadata(req: http.IncomingMessage, res: http.ServerResponse): void {
        const issuer = this.issuer(req);
        this.json(res, 200, {
            resource: `${issuer}/mcp`,
            authorization_servers: [issuer],
            bearer_methods_supported: ['header'],
            scopes_supported: [],
        });
    }

    private authorizationServerMetadata(req: http.IncomingMessage, res: http.ServerResponse): void {
        const issuer = this.issuer(req);
        this.json(res, 200, {
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            registration_endpoint: `${issuer}/register`,
            response_types_supported: ['code'],
            response_modes_supported: ['query'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
            scopes_supported: [],
        });
    }

    // ---- dynamic client registration (RFC 7591) -------------------------

    private register(req: http.IncomingMessage, res: http.ServerResponse, body: string): void {
        let metadata: { [key: string]: unknown };
        try {
            metadata = JSON.parse(body);
        } catch (err) {
            this.json(res, 400, { error: 'invalid_client_metadata', error_description: 'body must be JSON' });
            return;
        }
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
            this.json(res, 400, { error: 'invalid_client_metadata', error_description: 'body must be a JSON object' });
            return;
        }

        const redirectUris = Array.isArray(metadata.redirect_uris)
            ? metadata.redirect_uris.filter((u): u is string => typeof u === 'string')
            : [];
        const refused = redirectUris.filter(u => !isAcceptableRedirectUri(u));
        if (refused.length > 0) {
            this.json(res, 400, {
                error: 'invalid_redirect_uri',
                error_description: `redirect URIs must be loopback http(s) or a private-use scheme: ${refused.join(', ')}`,
            });
            return;
        }

        // Short: it appears on every tool log line for this client.
        const clientId = randomToken('luban', 6);
        const clientName = typeof metadata.client_name === 'string' && metadata.client_name.trim()
            ? metadata.client_name.trim().slice(0, 120)
            : clientId;
        const software = typeof metadata.software_id === 'string'
            ? `${metadata.software_id}${typeof metadata.software_version === 'string' ? ` ${metadata.software_version}` : ''}`
            : null;
        const client: RegisteredClient = {
            clientId,
            clientName,
            redirectUris,
            software,
            registeredAt: Date.now(),
            registeredFrom: req.socket.remoteAddress || '?',
        };
        this.clients.set(clientId, client);
        trim(this.clients, MAX_CLIENTS);
        log.info(`oauth client registered: ${describeClient(client, clientId)}${software ? ` [${software}]` : ''} `
            + `redirect_uris=${JSON.stringify(redirectUris)} from ${client.registeredFrom}`);

        this.json(res, 201, {
            ...metadata,
            client_id: clientId,
            client_id_issued_at: Math.floor(client.registeredAt / 1000),
            client_name: clientName,
            redirect_uris: redirectUris,
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
        });
    }

    // ---- authorization endpoint -----------------------------------------

    /**
     * Grants immediately: whoever can reach this page is already inside the
     * trust boundary, and the human decision points that matter are the job
     * confirm pages, not a login. Nothing is sent to a redirect URI that is
     * not registered for the client or loopback.
     */
    private authorize(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
        const q = url.searchParams;
        const clientId = q.get('client_id') || '';
        const redirectUri = q.get('redirect_uri') || '';
        const state = q.get('state');
        const client = this.clients.get(clientId);

        if (!redirectUri) {
            this.page(res, 400, 'Missing redirect_uri.');
            return;
        }
        const redirectKnown = client ? client.redirectUris.includes(redirectUri) : false;
        if (!redirectKnown && !isAcceptableRedirectUri(redirectUri)) {
            this.page(res, 400, 'redirect_uri is neither registered for this client nor a loopback / private-scheme URI.');
            return;
        }
        // From here on errors go back to the client the OAuth way.
        const fail = (error: string, description: string) => {
            log.warn(`oauth authorize refused for ${describeClient(client, clientId || '(no client_id)')}: ${description}`);
            this.redirect(res, redirectUri, { error, error_description: description, state });
        };
        if (!clientId) {
            fail('invalid_request', 'client_id is required');
            return;
        }
        if (q.get('response_type') !== 'code') {
            fail('unsupported_response_type', 'only response_type=code is supported');
            return;
        }
        const codeChallenge = q.get('code_challenge') || '';
        if (!codeChallenge || (q.get('code_challenge_method') || 'S256') !== 'S256') {
            fail('invalid_request', 'PKCE with code_challenge_method=S256 is required');
            return;
        }

        this.pruneCodes();
        const code = randomToken('code');
        this.codes.set(code, { clientId, redirectUri, codeChallenge, createdAt: Date.now() });
        trim(this.codes, MAX_CODES);
        log.info(`oauth authorize granted to ${describeClient(client, clientId)} from ${req.socket.remoteAddress} `
            + `-> ${redirectUri}${client ? '' : ' (client_id not registered here; token still issued)'}`);
        this.redirect(res, redirectUri, { code, state });
    }

    // ---- token endpoint -------------------------------------------------

    private token(req: http.IncomingMessage, res: http.ServerResponse, body: string): void {
        const params = this.parseForm(req, body);
        if (!params) {
            this.json(res, 400, { error: 'invalid_request', error_description: 'body must be form-encoded or JSON' });
            return;
        }
        const grantType = params.get('grant_type');
        if (grantType === 'authorization_code') {
            this.tokenFromCode(req, res, params);
            return;
        }
        if (grantType === 'refresh_token') {
            this.tokenFromRefresh(req, res, params);
            return;
        }
        this.json(res, 400, { error: 'unsupported_grant_type', error_description: `grant_type ${grantType || '(missing)'}` });
    }

    private tokenFromCode(req: http.IncomingMessage, res: http.ServerResponse, params: URLSearchParams): void {
        this.pruneCodes();
        const code = params.get('code') || '';
        const pending = this.codes.get(code);
        // Single use, whatever the outcome.
        this.codes.delete(code);
        if (!pending) {
            this.json(res, 400, { error: 'invalid_grant', error_description: 'unknown or expired authorization code' });
            return;
        }
        const clientId = params.get('client_id');
        if (clientId && clientId !== pending.clientId) {
            this.json(res, 400, { error: 'invalid_grant', error_description: 'code was issued to a different client' });
            return;
        }
        const redirectUri = params.get('redirect_uri');
        if (redirectUri && redirectUri !== pending.redirectUri) {
            this.json(res, 400, { error: 'invalid_grant', error_description: 'redirect_uri does not match the authorization request' });
            return;
        }
        const verifier = params.get('code_verifier') || '';
        if (!verifier || pkceChallenge(verifier) !== pending.codeChallenge) {
            log.warn(`oauth token refused for ${pending.clientId}: PKCE verifier mismatch`);
            this.json(res, 400, { error: 'invalid_grant', error_description: 'PKCE code_verifier does not match' });
            return;
        }
        this.issueTokens(req, res, pending.clientId);
    }

    private tokenFromRefresh(req: http.IncomingMessage, res: http.ServerResponse, params: URLSearchParams): void {
        const refresh = params.get('refresh_token') || '';
        const known = this.tokens.get(refresh);
        if (!known || known.kind !== 'refresh') {
            // After a restart nothing is known; the client redoes the (automatic) flow.
            this.json(res, 400, { error: 'invalid_grant', error_description: 'unknown refresh token' });
            return;
        }
        const clientId = params.get('client_id');
        if (clientId && clientId !== known.clientId) {
            this.json(res, 400, { error: 'invalid_grant', error_description: 'refresh token belongs to a different client' });
            return;
        }
        this.tokens.delete(refresh);
        this.issueTokens(req, res, known.clientId);
    }

    private issueTokens(req: http.IncomingMessage, res: http.ServerResponse, clientId: string): void {
        const accessToken = randomToken('at');
        const refreshToken = randomToken('rt');
        const issuedAt = Date.now();
        this.tokens.set(accessToken, { kind: 'access', clientId, issuedAt });
        this.tokens.set(refreshToken, { kind: 'refresh', clientId, issuedAt });
        trim(this.tokens, MAX_TOKENS);
        log.info(`oauth token issued to ${describeClient(this.clients.get(clientId), clientId)} from ${req.socket.remoteAddress}`);
        // No expires_in: the token never has to be refreshed because /mcp
        // never rejects one. It only labels log lines.
        this.json(res, 200, {
            access_token: accessToken,
            token_type: 'Bearer',
            refresh_token: refreshToken,
            scope: '',
        });
    }

    // ---- plumbing -------------------------------------------------------

    private pruneCodes(): void {
        const now = Date.now();
        for (const [code, pending] of this.codes) {
            if (now - pending.createdAt > CODE_TTL_MS) {
                this.codes.delete(code);
            }
        }
    }

    private parseForm(req: http.IncomingMessage, body: string): URLSearchParams | null {
        const contentType = String(req.headers['content-type'] || '');
        if (contentType.includes('application/json')) {
            try {
                const parsed = JSON.parse(body);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    return null;
                }
                const params = new URLSearchParams();
                for (const key of Object.keys(parsed)) {
                    if (parsed[key] !== undefined && parsed[key] !== null) {
                        params.set(key, String(parsed[key]));
                    }
                }
                return params;
            } catch (err) {
                return null;
            }
        }
        return new URLSearchParams(body);
    }

    private methodGuard(req: http.IncomingMessage, res: http.ServerResponse, method: string, next: () => void): void {
        if (req.method !== method) {
            res.writeHead(405, { Allow: method });
            res.end();
            return;
        }
        next();
    }

    private readBody(req: http.IncomingMessage, res: http.ServerResponse, callback: (body: string) => void): void {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                req.destroy();
                this.json(res, 413, { error: 'invalid_request', error_description: 'body too large' });
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
            log.warn(`oauth request error: ${err.message}`);
        });
    }

    private redirect(res: http.ServerResponse, redirectUri: string, params: { [key: string]: string | null }): void {
        const target = new URL(redirectUri);
        for (const key of Object.keys(params)) {
            if (params[key] !== null && params[key] !== undefined) {
                target.searchParams.set(key, params[key] as string);
            }
        }
        res.writeHead(302, { Location: target.toString(), 'Cache-Control': 'no-store' });
        res.end();
    }

    private json(res: http.ServerResponse, status: number, payload: object): void {
        const body = JSON.stringify(payload);
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'Cache-Control': 'no-store',
        });
        res.end(body);
    }

    private page(res: http.ServerResponse, status: number, message: string): void {
        const body = `<!doctype html><meta charset="utf-8"><title>Luban MCP</title><p>${message}</p>`;
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
    }
}
