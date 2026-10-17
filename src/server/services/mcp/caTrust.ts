/**
 * Browser trust for the MCP HTTPS listener (#218).
 *
 * The listener runs from mkcert files, but a browser that has never seen
 * the local CA refuses the origin (Chrome: no exception; Firefox: a
 * per-site exception that still leaves `isSecureContext` false for
 * notifications on some builds), and system notifications on the confirm
 * and dashboard pages need a trusted HTTPS origin. Two PLAIN-HTTP routes
 * fix that without the operator hunting for rootCA.pem on the server:
 *
 *   GET /ca.crt   the public CA certificate, application/x-x509-ca-cert
 *   GET /trust    an HTML page with the download link and per-OS/browser
 *                 install steps
 *
 * Where the CA file is: the optional setting `mcpHttpsCaFile` (env
 * LUBAN_MCP_HTTPS_CA) when the operator set one, else `rootCA.pem` under
 * `mkcert -CAROOT` when mkcert is on PATH (one execFile, cached). The key
 * is never served: a file that parses as a private key - or carries one
 * next to the certificate - is refused outright, and anything that is not
 * a CA certificate is refused too.
 *
 * Pure except for the two injected effects (execFile, readFileSync), so the
 * tests run without Luban.
 */
import { execFile as nodeExecFile } from 'child_process';
import { X509Certificate, createPrivateKey } from 'crypto';
import fs from 'fs';
import type http from 'http';
import path from 'path';

export const CA_FILE_CONFIG_KEY = 'mcpHttpsCaFile';
export const CA_FILE_ENV = 'LUBAN_MCP_HTTPS_CA';
export const CA_DOWNLOAD_NAME = 'luban-mcp-rootCA.crt';

export interface CaSetting {
    /** The operator's explicit CA path ('' = none). */
    caFile: string;
    source: 'env' | 'config' | null;
    envOverride: boolean;
}

/** Explicit CA path: env wins over the stored setting, an empty env value clears it. */
export function resolveCaSetting(env: NodeJS.ProcessEnv, readConfig: (key: string) => unknown): CaSetting {
    const fromEnv = env[CA_FILE_ENV];
    if (fromEnv !== undefined) {
        const value = String(fromEnv).trim();
        return { caFile: value, source: value ? 'env' : null, envOverride: true };
    }
    const stored = String(readConfig(CA_FILE_CONFIG_KEY) || '').trim();
    return { caFile: stored, source: stored ? 'config' : null, envOverride: false };
}

export type ExecFileLike = (file: string, args: string[], callback: (error: Error | null, stdout: string) => void) => unknown;

const MKCERT_RETRY_MS = 60000;

let mkcertRoot: { value: string | null; at: number } | null = null;
let mkcertPending: Promise<string | null> | null = null;

/** Drop the cached `mkcert -CAROOT` answer (tests). */
export function resetMkcertCache(): void {
    mkcertRoot = null;
    mkcertPending = null;
}

/**
 * `mkcert -CAROOT` once, cached for the process; a failure (mkcert not on
 * PATH) is remembered for a minute so a status poll never spawns it on
 * every request.
 */
export async function mkcertCaRoot(exec: ExecFileLike = nodeExecFile as unknown as ExecFileLike, now: () => number = Date.now): Promise<string | null> {
    if (mkcertRoot && (mkcertRoot.value !== null || now() - mkcertRoot.at < MKCERT_RETRY_MS)) {
        return mkcertRoot.value;
    }
    if (!mkcertPending) {
        // The callback may run synchronously (tests, or a spawn failure), so
        // the pending slot is only filled once the promise is known to be open.
        let settled = false;
        const pending = new Promise<string | null>((resolve) => {
            const finish = (value: string | null) => {
                mkcertRoot = { value, at: now() };
                settled = true;
                resolve(value);
            };
            try {
                exec('mkcert', ['-CAROOT'], (error, stdout) => {
                    const value = !error && stdout ? String(stdout).trim() : '';
                    finish(value || null);
                });
            } catch (err) {
                finish(null);
            }
        });
        if (settled) {
            return pending;
        }
        mkcertPending = pending;
        pending.then(() => {
            if (mkcertPending === pending) { mkcertPending = null; }
        });
    }
    return mkcertPending;
}

/** The last `mkcert -CAROOT` answer without waiting; starts the lookup when none is cached. */
export function cachedMkcertCaRoot(exec?: ExecFileLike): string | null {
    if (!mkcertRoot) {
        mkcertCaRoot(exec).catch(() => undefined);
        return null;
    }
    return mkcertRoot.value;
}

export interface CaResolution {
    file: string | null;
    source: 'config' | 'env' | 'mkcert' | null;
    /** Why there is no file, or '' when there is one. */
    reason: string;
}

/** Which file to serve: the explicit setting when there is one, else mkcert's rootCA.pem. */
export function resolveCaFile(setting: CaSetting, caRoot: string | null): CaResolution {
    if (setting.caFile) {
        return { file: setting.caFile, source: setting.source === 'env' ? 'env' : 'config', reason: '' };
    }
    if (caRoot) {
        return { file: path.join(caRoot, 'rootCA.pem'), source: 'mkcert', reason: '' };
    }
    return {
        file: null,
        source: null,
        reason: 'mkcert is not on PATH (or has not answered yet) and no CA certificate file is set. Set the CA certificate '
            + 'file in Settings -> MCP Server (the public rootCA.pem from `mkcert -CAROOT`), or install mkcert.',
    };
}

export interface PemClassification {
    kind: 'private-key' | 'certificate' | 'unknown';
    ca?: boolean;
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    fingerprint256?: string;
}

const PRIVATE_KEY_MARKER = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;

/**
 * What a PEM file is. A private key is reported as such even when the
 * same file also carries a certificate (combined PEM): serving it would
 * leak the key, so the whole file is refused.
 */
export function classifyPem(content: string | Buffer): PemClassification {
    const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content);
    if (PRIVATE_KEY_MARKER.test(text)) {
        return { kind: 'private-key' };
    }
    try {
        createPrivateKey(text);
        return { kind: 'private-key' };
    } catch (err) {
        // Not a key the runtime recognises; fall through to the certificate check.
    }
    try {
        const cert = new X509Certificate(text);
        return {
            kind: 'certificate',
            ca: cert.ca,
            subject: cert.subject,
            issuer: cert.issuer,
            validFrom: cert.validFrom,
            validTo: cert.validTo,
            fingerprint256: cert.fingerprint256,
        };
    } catch (err) {
        return { kind: 'unknown' };
    }
}

export interface CaLoad {
    ok: boolean;
    file: string | null;
    source: CaResolution['source'];
    /** The certificate PEM, only when ok. */
    pem: string | null;
    info: PemClassification | null;
    error: string | null;
}

/** Read and vet the CA file. Never returns key material. */
export function loadCaCertificate(resolution: CaResolution, readFile: (file: string) => Buffer = (file) => fs.readFileSync(file)): CaLoad {
    const base = { file: resolution.file, source: resolution.source, pem: null, info: null };
    if (!resolution.file) {
        return { ...base, ok: false, error: resolution.reason };
    }
    let content: Buffer;
    try {
        content = readFile(resolution.file);
    } catch (err) {
        return { ...base, ok: false, error: `Cannot read ${resolution.file}: ${(err as Error).message}` };
    }
    const info = classifyPem(content);
    if (info.kind === 'private-key') {
        return { ...base, ok: false, error: `${resolution.file} contains a PRIVATE KEY and will not be served. Point the CA setting at the public rootCA.pem, never rootCA-key.pem or the server key.` };
    }
    if (info.kind !== 'certificate') {
        return { ...base, ok: false, error: `${resolution.file} is not a PEM certificate.` };
    }
    if (!info.ca) {
        return { ...base, ok: false, info, error: `${resolution.file} is not a CA certificate (basicConstraints CA is false) - it looks like a server/leaf certificate. Serve the CA that signed it (mkcert: rootCA.pem under \`mkcert -CAROOT\`).` };
    }
    const text = content.toString('utf8');
    const match = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
    return { ...base, ok: true, info, pem: `${(match ? match[0] : text).trim()}\n`, error: null };
}

/** Whether the HTTPS leaf certificate was issued by this CA (null when either cannot be read). */
export function leafIssuedBy(caPem: string | null, leafFile: string, readFile: (file: string) => Buffer = (file) => fs.readFileSync(file)): boolean | null {
    if (!caPem || !leafFile) {
        return null;
    }
    try {
        const leaf = new X509Certificate(readFile(leafFile));
        return leaf.checkIssued(new X509Certificate(caPem));
    } catch (err) {
        return null;
    }
}

export interface TrustPageModel {
    ca: CaLoad;
    https: { configured: boolean; running: boolean; port: number | null; error: string | null };
    /** The leaf-vs-CA check, or null when it could not be made. */
    leafIssuedByCa: boolean | null;
    /** Host (no port) the page was requested on, for the example URLs. */
    host: string;
}

function esc(value: unknown): string {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const PAGE_STYLE = `
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#10151d;color:#edf1f7}
*{box-sizing:border-box}body{max-width:900px;margin:auto;padding:24px;line-height:1.45}h1{margin:0;font-size:2rem}
a{color:#8fc7ff}a.button{display:inline-block;font:inherit;border:1px solid #55677f;border-radius:8px;padding:10px 14px;background:#223146;color:#fff;text-decoration:none}
.panel,details{background:#192330;border:1px solid #344359;border-radius:12px;padding:18px;margin:14px 0}
.muted{color:#b1bfd1;font-size:.9rem}.error{color:#ffb9bc}.ok{color:#9fe3b0}code,pre{font-size:.9em;background:#0c1118;border-radius:6px;padding:2px 6px}
pre{padding:10px;white-space:pre-wrap;overflow-wrap:anywhere}summary{cursor:pointer;font-weight:600;font-size:1.05rem}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px}dt{color:#b1bfd1}dd{margin:0;overflow-wrap:anywhere}
@media(max-width:600px){body{padding:14px}dl{grid-template-columns:1fr}}
`;

/** The /trust page. Static text plus the model; no scripts. */
export function trustPageHtml(model: TrustPageModel): string {
    const { ca, https } = model;
    const httpsUrl = https.port ? `https://${model.host}:${https.port}/jobs` : null;
    const status = [];
    if (!https.configured) {
        status.push('<p class="muted">HTTPS is not configured on this MCP server, so nothing needs trusting yet. Set the certificate and key paths in Settings → MCP Server first.</p>');
    } else if (https.running) {
        status.push(`<p class="ok">HTTPS is running on port ${esc(https.port)}${httpsUrl ? ` — <a href="${esc(httpsUrl)}">${esc(httpsUrl)}</a>` : ''}.</p>`);
    } else {
        status.push(`<p class="error">HTTPS is configured but not running${https.error ? `: ${esc(https.error)}` : ''}.</p>`);
    }
    let caBlock: string;
    if (ca.ok && ca.info) {
        caBlock = `<p><a class="button" href="/ca.crt" download="${CA_DOWNLOAD_NAME}">Download the CA certificate (${CA_DOWNLOAD_NAME})</a></p>
<dl><dt>Subject</dt><dd>${esc(ca.info.subject)}</dd><dt>SHA-256 fingerprint</dt><dd><code>${esc(ca.info.fingerprint256)}</code></dd>
<dt>Valid</dt><dd>${esc(ca.info.validFrom)} → ${esc(ca.info.validTo)}</dd><dt>Served from</dt><dd>${esc(ca.file)} (${esc(ca.source === 'mkcert' ? 'mkcert -CAROOT' : `setting, ${ca.source}`)})</dd></dl>
<p class="muted">Compare the fingerprint with what the browser shows when you install it. Only the public certificate is served; the CA key (<code>rootCA-key.pem</code>) and the server key never leave this computer.</p>
${model.leafIssuedByCa === false ? '<p class="error">The HTTPS server certificate was NOT issued by this CA. Trusting this CA will not make the HTTPS origin trusted - check which mkcert CA signed the certificate (regenerate it with the same mkcert, or point the CA setting at the right rootCA.pem).</p>' : ''}
${model.leafIssuedByCa === true ? '<p class="ok">The HTTPS server certificate is issued by this CA.</p>' : ''}`;
    } else {
        caBlock = `<p class="error">No CA certificate can be served: ${esc(ca.error)}</p>
<p class="muted">On the computer running Luban, <code>mkcert -CAROOT</code> prints the directory holding <code>rootCA.pem</code>; that public file is the one to set in Settings → MCP Server → HTTPS → CA certificate file.</p>`;
    }
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trust the Luban MCP HTTPS certificate</title><style>${PAGE_STYLE}</style></head><body>
<header><p class="muted">LUBAN · MCP SERVER</p><h1>Trust the HTTPS certificate</h1></header>
<p>The MCP HTTPS listener uses a certificate signed by a <strong>local mkcert CA</strong>. Browsers do not know that CA until you install it on each device, so Chrome, Edge and Safari refuse the HTTPS origin and system notifications on the <a href="/jobs">job dashboard</a> and confirm pages stay unavailable (Firefox offers a one-off exception, which is not the same as trust). This page is served over plain HTTP on purpose: download the CA here, install it once per device, then open the HTTPS address.</p>
<section class="panel"><h2 style="margin-top:0">Status</h2>${status.join('')}${caBlock}</section>
<section class="panel"><h2 style="margin-top:0">Install the CA on this device</h2>
<p class="muted">Pick your operating system. After installing, close the browser completely, reopen it, and load the HTTPS address${httpsUrl ? ` (<a href="${esc(httpsUrl)}">${esc(httpsUrl)}</a>)` : ''}: the padlock should show no warning. Then turn on system notifications on the dashboard.</p>
<details open><summary>Windows (Chrome, Edge, Safari-style system trust)</summary>
<ol><li>Download <code>${CA_DOWNLOAD_NAME}</code> above and open it.</li>
<li>Click <em>Install Certificate…</em>, choose <em>Current User</em> (or <em>Local Machine</em> for every account), then <em>Place all certificates in the following store</em> → <em>Trusted Root Certification Authorities</em>, and accept the security warning.</li>
<li>Command-line alternative: <pre>certutil -addstore -user Root ${CA_DOWNLOAD_NAME}</pre></li>
<li>Chrome and Edge use the Windows store at once (restart the browser).</li></ol>
<p><strong>Firefox on Windows:</strong> <em>Settings → Privacy &amp; Security → Certificates → View Certificates → Authorities → Import…</em>, pick the file and tick <em>Trust this CA to identify websites</em>. Or set <code>security.enterprise_roots.enabled</code> to <code>true</code> in <code>about:config</code> so Firefox uses the Windows store.</p></details>
<details><summary>macOS (Safari, Chrome, Edge)</summary>
<ol><li>Download the file and double-click it; Keychain Access opens and adds it to the <em>login</em> keychain.</li>
<li>Find it under <em>Certificates</em>, open it, expand <em>Trust</em> and set <em>When using this certificate</em> to <em>Always Trust</em>; confirm with your password.</li>
<li>Command-line alternative (system-wide): <pre>sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CA_DOWNLOAD_NAME}</pre></li></ol>
<p><strong>Firefox on macOS:</strong> import it under <em>Settings → Privacy &amp; Security → Certificates → View Certificates → Authorities → Import…</em> (trust for websites), or enable <code>security.enterprise_roots.enabled</code>.</p></details>
<details><summary>Linux (Chrome, Chromium, Edge, Firefox)</summary>
<ol><li>Chrome, Chromium and Edge read the NSS database in your home directory (<code>libnss3-tools</code> provides <code>certutil</code>): <pre>certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Luban mkcert CA" -i ${CA_DOWNLOAD_NAME}</pre></li>
<li>System-wide trust (curl, Node with <code>NODE_EXTRA_CA_CERTS</code> unset, most GTK apps): Debian/Ubuntu <pre>sudo cp ${CA_DOWNLOAD_NAME} /usr/local/share/ca-certificates/luban-mcp-rootCA.crt &amp;&amp; sudo update-ca-certificates</pre> Fedora/RHEL <pre>sudo cp ${CA_DOWNLOAD_NAME} /etc/pki/ca-trust/source/anchors/ &amp;&amp; sudo update-ca-trust</pre> Arch <pre>sudo trust anchor --store ${CA_DOWNLOAD_NAME}</pre></li>
<li>Firefox keeps its own store: <em>Settings → Privacy &amp; Security → Certificates → View Certificates → Authorities → Import…</em>, trust for websites; or set <code>security.enterprise_roots.enabled</code> to <code>true</code> after the system-wide step.</li></ol></details>
<details><summary>iPhone / iPad (Safari, Chrome, Firefox all use the system store)</summary>
<ol><li>Open this page in <strong>Safari</strong> over HTTP and tap the download button; allow the website to download a configuration profile.</li>
<li><em>Settings → Profile Downloaded → Install</em> (enter the passcode, accept the warning).</li>
<li><em>Settings → General → About → Certificate Trust Settings</em> and switch on <em>full trust</em> for the Luban/mkcert root. Without this last step the certificate is installed but not trusted.</li>
<li>Open the HTTPS address in Safari. For system notifications add the dashboard to the Home Screen (<em>Share → Add to Home Screen</em>) and enable them from the installed app.</li></ol></details>
<details><summary>Android (Chrome, Edge, Firefox)</summary>
<ol><li>Download the file, then <em>Settings → Security (or Security &amp; privacy) → More security settings / Encryption &amp; credentials → Install a certificate → CA certificate</em>, confirm <em>Install anyway</em>, and pick <code>${CA_DOWNLOAD_NAME}</code> from Downloads. (Older Android: <em>Settings → Security → Install from storage</em>.)</li>
<li>Chrome and Edge trust user-installed CAs immediately.</li>
<li>Firefox for Android ignores user CAs unless enabled: <em>Settings → About Firefox</em>, tap the logo five times, then <em>Settings → Secret Settings → Use third party CA certificates</em>.</li></ol></details>
<details><summary>The computer running Luban</summary>
<p>Run <code>mkcert -install</code> there once (or <code>python3 src/server/services/mcp/setup.py --https --install-ca --apply</code>); it installs this same CA into the system and browser stores. The page above is for the <em>other</em> devices.</p></details>
</section>
<section class="panel"><h2 style="margin-top:0">Still refused?</h2>
<ul><li>The server certificate must list the address you open (localhost, 127.0.0.1 and the LAN IP): regenerate it with mkcert including that IP and restart Luban.</li>
<li>HTTP and HTTPS are different origins: notification permission granted on one does not carry to the other.</li>
<li>Clear the browser's HSTS/certificate cache or restart it after installing the CA.</li>
<li>Node-based MCP clients need <code>NODE_EXTRA_CA_CERTS=/path/to/${CA_DOWNLOAD_NAME}</code>; never disable certificate verification.</li></ul>
<p class="muted"><a href="/jobs">Back to the job dashboard</a></p></section>
</body></html>`;
}

export interface TrustRouteDeps {
    setting: () => CaSetting;
    /** Cached `mkcert -CAROOT` answer (null = unknown / not installed). */
    caRoot: () => string | null;
    httpPort: () => number | null;
    https: () => TrustPageModel['https'] & { certFile: string };
    readFile?: (file: string) => Buffer;
}

function headers(type: string, extra: Record<string, string> = {}): Record<string, string> {
    return {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        ...extra,
    };
}

/** True when the route was handled. Mount before the MCP endpoint, after the address/Origin gate. */
export function handleTrustRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL, deps: TrustRouteDeps): boolean {
    if (url.pathname !== '/trust' && url.pathname !== '/ca.crt') {
        return false;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end();
        return true;
    }
    const host = String(req.headers.host || '127.0.0.1').replace(/:\d+$/, '');
    const encrypted = !!(req.socket as { encrypted?: boolean }).encrypted;
    const httpPort = deps.httpPort();
    if (encrypted && httpPort) {
        // These routes are deliberately plain HTTP: the download must work in
        // a browser that does not trust the HTTPS origin yet.
        res.writeHead(302, { Location: `http://${host}:${httpPort}${url.pathname}`, 'Cache-Control': 'no-store' });
        res.end();
        return true;
    }
    const ca = loadCaCertificate(resolveCaFile(deps.setting(), deps.caRoot()), deps.readFile);
    if (url.pathname === '/ca.crt') {
        if (!ca.ok || !ca.pem) {
            res.writeHead(404, headers('text/plain; charset=utf-8'));
            res.end(req.method === 'HEAD' ? undefined : `No CA certificate is available: ${ca.error}\nSee /trust.\n`);
            return true;
        }
        res.writeHead(200, headers('application/x-x509-ca-cert', {
            'Content-Disposition': `attachment; filename="${CA_DOWNLOAD_NAME}"`,
            'Content-Length': String(Buffer.byteLength(ca.pem)),
        }));
        res.end(req.method === 'HEAD' ? undefined : ca.pem);
        return true;
    }
    const https = deps.https();
    const page = trustPageHtml({
        ca,
        https: { configured: https.configured, running: https.running, port: https.port, error: https.error },
        leafIssuedByCa: https.configured ? leafIssuedBy(ca.pem, https.certFile, deps.readFile) : null,
        host,
    });
    res.writeHead(200, headers('text/html; charset=utf-8'));
    res.end(req.method === 'HEAD' ? undefined : page);
    return true;
}
