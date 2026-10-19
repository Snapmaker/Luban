import { X509Certificate } from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import type { Socket } from 'net';

export interface McpListenerSettings {
    port: number;
    allowLan: boolean;
    certFile: string;
    keyFile: string;
}

export function resolveHttpsFiles(env: NodeJS.ProcessEnv, readConfig: (key: string) => unknown) {
    const fields = { certFile: 'Cert', keyFile: 'Key' };
    const paths = { certFile: '', keyFile: '' };
    const envOverrides: string[] = [];
    for (const field of Object.keys(fields) as Array<keyof typeof fields>) {
        const value = env[`LUBAN_MCP_HTTPS_${fields[field].toUpperCase()}`];
        const stored = readConfig(`mcpHttps${fields[field]}`);
        paths[field] = String(value === undefined ? stored || '' : value).trim();
        if (value !== undefined) { envOverrides.push(field); }
    }
    return { ...paths, envOverrides };
}

/** HTTPS is additive: an absent/bad certificate never takes the HTTP listener down. */
export class McpListeners {
    private httpServer: http.Server | null = null;

    private httpsServer: https.Server | null = null;

    private sockets = new Set<Socket>();

    public httpPort: number | null = null;

    public httpsPort: number | null = null;

    public httpsError: string | null = null;

    public httpError: string | null = null;

    public certificateValidTo: number | null = null;

    private info: (message: string) => void;

    private error: (message: string) => void;

    public constructor(info: (message: string) => void, error: (message: string) => void) {
        this.info = info;
        this.error = error;
    }

    public get started(): boolean {
        return !!(this.httpServer || this.httpsServer);
    }

    private track(server: http.Server | https.Server): void {
        server.on('connection', (socket: Socket) => {
            this.sockets.add(socket);
            socket.once('close', () => this.sockets.delete(socket));
        });
    }

    public start(settings: McpListenerSettings, handler: http.RequestListener): void {
        if (this.started) {
            return;
        }
        this.httpsError = null;
        this.httpError = null;
        this.certificateValidTo = null;
        const host = settings.allowLan ? '0.0.0.0' : '127.0.0.1';
        const server = http.createServer(handler);
        this.httpServer = server;
        this.track(server);
        server.on('error', (err: Error) => {
            if (this.httpServer !== server) { return; }
            this.httpError = err.message;
            this.error(`MCP HTTP listener: ${err.message}`);
            server.close();
            this.httpServer = null;
            this.httpPort = null;
        });
        server.listen(settings.port, host, () => {
            if (this.httpServer !== server) { return; }
            this.httpPort = settings.port;
            this.info(`MCP HTTP listening on ${host}:${settings.port}`);
        });
        if (!settings.certFile && !settings.keyFile) {
            return;
        }
        try {
            if (!settings.certFile || !settings.keyFile) {
                throw new Error('Set both MCP HTTPS certificate and key paths.');
            }
            if (settings.port >= 65535) {
                throw new Error('HTTPS uses MCP port + 1; set the HTTP port to 65534 or lower.');
            }
            const cert = fs.readFileSync(settings.certFile);
            const parsed = new X509Certificate(cert);
            this.certificateValidTo = Date.parse(parsed.validTo);
            if (Date.parse(parsed.validFrom) > Date.now() || this.certificateValidTo <= Date.now()) {
                throw new Error('The HTTPS certificate is expired or not yet valid. Regenerate it with mkcert and check the system clock.');
            }
            const secure = https.createServer({
                cert,
                key: fs.readFileSync(settings.keyFile),
                minVersion: 'TLSv1.2',
            }, handler);
            this.httpsServer = secure;
            this.track(secure);
            secure.on('error', (err: Error) => {
                if (this.httpsServer !== secure) { return; }
                this.httpsError = err.message;
                this.error(`MCP HTTPS listener: ${err.message}`);
                secure.close();
                this.httpsServer = null;
                this.httpsPort = null;
            });
            secure.listen(settings.port + 1, host, () => {
                if (this.httpsServer !== secure) { return; }
                this.httpsPort = settings.port + 1;
                this.info(`MCP HTTPS listening on ${host}:${this.httpsPort}`);
            });
        } catch (err) {
            this.httpsError = (err as Error).message;
            this.error(`MCP HTTPS listener: ${this.httpsError}`);
        }
    }

    public stop(): void {
        this.httpServer?.close();
        this.httpsServer?.close();
        this.httpServer = null;
        this.httpsServer = null;
        this.httpPort = null;
        this.httpsPort = null;
        this.httpsError = null;
        this.httpError = null;
        this.certificateValidTo = null;
        // Node 16's server.close() does not close keep-alive/stream sockets.
        for (const socket of this.sockets) { socket.destroy(); }
        this.sockets.clear();
    }
}
