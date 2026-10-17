import { strict as assert } from 'assert';
import { generateKeyPairSync } from 'crypto';
import type http from 'http';
import {
    CA_DOWNLOAD_NAME,
    classifyPem,
    handleTrustRequest,
    leafIssuedBy,
    loadCaCertificate,
    mkcertCaRoot,
    cachedMkcertCaRoot,
    resetMkcertCache,
    resolveCaFile,
    resolveCaSetting,
    trustPageHtml,
} from '../caTrust';

// Throwaway test-only certificates (openssl, EC P-256, 2026-10-17): a CA, a
// leaf it issued, and an unrelated CA. No private key is embedded.
const CA_PEM = `-----BEGIN CERTIFICATE-----
MIIBzjCCAXWgAwIBAgIUSwnTDqUGbVh+1cI3DHkhWtDtrigwCgYIKoZIzj0EAwIw
NTEXMBUGA1UECgwObHViYW4tbWNwLXRlc3QxGjAYBgNVBAMMEWx1YmFuLW1jcCB0
ZXN0IENBMB4XDTI2MTAxNzIzMjQyM1oXDTM2MTAxNDIzMjQyM1owNTEXMBUGA1UE
CgwObHViYW4tbWNwLXRlc3QxGjAYBgNVBAMMEWx1YmFuLW1jcCB0ZXN0IENBMFkw
EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/j0fHDcMF1tzCGuMk/PBrQU0W0b1xLD8
m0JcVhOmr5SwPtdUW/QgFZ6V4MQ0Hs5rqlghiv3DuZmTWK8lhrwpuaNjMGEwHQYD
VR0OBBYEFJQjjziq04ermIU772LDeiCEwFFeMB8GA1UdIwQYMBaAFJQjjziq04er
mIU772LDeiCEwFFeMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoG
CCqGSM49BAMCA0cAMEQCIFinrvfiRb+p0rhWOlsiLFIJjajX+MkAbnHTIzKRnED2
AiBHHyJ7kU+fgjhrjn6LjaBdO2dPviA8FVdR7n6+NwsR4Q==
-----END CERTIFICATE-----
`;
const LEAF_PEM = `-----BEGIN CERTIFICATE-----
MIIB7DCCAZKgAwIBAgIUIpl1leXwl6j+wDALxiQBNcEIM4owCgYIKoZIzj0EAwIw
NTEXMBUGA1UECgwObHViYW4tbWNwLXRlc3QxGjAYBgNVBAMMEWx1YmFuLW1jcCB0
ZXN0IENBMB4XDTI2MTAxNzIzMjQyM1oXDTM2MTAxNDIzMjQyM1owNzEXMBUGA1UE
CgwObHViYW4tbWNwLXRlc3QxHDAaBgNVBAMME2x1YmFuLW1jcCB0ZXN0IGxlYWYw
WTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATiCi6mmm10A+quBZlIfEQTDeA1x4Yd
KaWEBV+fGSNAlLrpgmIQtzM+oNbEMn4+HmxNWEdr36KaBp49MEzrI9IVo34wfDAJ
BgNVHRMEAjAAMBoGA1UdEQQTMBGCCWxvY2FsaG9zdIcEfwAAATATBgNVHSUEDDAK
BggrBgEFBQcDATAdBgNVHQ4EFgQUFLOuMS7caa83bxzE7x8FWGz4jk4wHwYDVR0j
BBgwFoAUlCOPOKrTh6uYhTvvYsN6IITAUV4wCgYIKoZIzj0EAwIDSAAwRQIgeaFu
xDVgjc513frtuS016vDoVHkkbplMxginYGtd+DUCIQCqA0tLDEx+E4ZqgN5fZdgL
isryb5pU9u3c75nVgCmINw==
-----END CERTIFICATE-----
`;
const OTHER_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIBmjCCAUGgAwIBAgIUJAKAX6j94cwMEfE/FEtpXMwlQxowCgYIKoZIzj0EAwIw
IzEOMAwGA1UECgwFb3RoZXIxETAPBgNVBAMMCG90aGVyIENBMB4XDTI2MTAxNzIz
MjQyM1oXDTM2MTAxNDIzMjQyM1owIzEOMAwGA1UECgwFb3RoZXIxETAPBgNVBAMM
CG90aGVyIENBMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE4gouppptdAPqrgWZ
SHxEEw3gNceGHSmlhAVfnxkjQJS66YJiELczPqDWxDJ+Ph5sTVhHa9+imgaePTBM
6yPSFaNTMFEwHQYDVR0OBBYEFBSzrjEu3GmvN28cxO8fBVhs+I5OMB8GA1UdIwQY
MBaAFBSzrjEu3GmvN28cxO8fBVhs+I5OMA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZI
zj0EAwIDRwAwRAIgTik+zkbh6emTJpj2fouq3GdPN7jtVAD/f7zTWTQ+2o4CIEW0
J5mN9xzis8pFBcXIXCiV3Ti+hWG0062tmR6hYt9I
-----END CERTIFICATE-----
`;

/** A fresh private key generated for this run; never a fixture. */
function privateKeyPem(): string {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    return privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
}

function files(map: Record<string, string>) {
    return (file: string): Buffer => {
        if (!(file in map)) { throw new Error('ENOENT'); }
        return Buffer.from(map[file]);
    };
}

interface Reply { status: number; headers: Record<string, string>; body: string | undefined }

type RouteDeps = Parameters<typeof handleTrustRequest>[3];

function request(route: string, routeDeps: RouteDeps, options: { method?: string; encrypted?: boolean; host?: string } = {}): Reply | null {
    const reply: Reply = { status: 0, headers: {}, body: undefined };
    const req = {
        method: options.method || 'GET',
        headers: { host: options.host || '192.168.1.10:40890' },
        socket: { encrypted: !!options.encrypted },
    } as unknown as http.IncomingMessage;
    const res = {
        writeHead(status: number, headers: Record<string, string>) { reply.status = status; reply.headers = headers || {}; },
        end(body?: string) { reply.body = body; },
    } as unknown as http.ServerResponse;
    const handled = handleTrustRequest(req, res, new URL(route, 'http://localhost'), routeDeps);
    return handled ? reply : null;
}

function deps(overrides: Partial<RouteDeps> = {}): RouteDeps {
    return {
        setting: () => ({ caFile: '/ca/rootCA.pem', source: 'config', envOverride: false }),
        caRoot: () => null,
        httpPort: () => 40889,
        https: () => ({ configured: true, running: true, port: 40890, error: null, certFile: '/tls/cert.pem' }),
        readFile: files({ '/ca/rootCA.pem': CA_PEM, '/tls/cert.pem': LEAF_PEM }),
        ...overrides,
    };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['the explicit CA setting comes from env first, then the store; an empty env value clears it', () => {
        const config = (key: string) => ({ mcpHttpsCaFile: ' /stored/rootCA.pem ' }[key]);
        assert.deepEqual(resolveCaSetting({}, config), { caFile: '/stored/rootCA.pem', source: 'config', envOverride: false });
        assert.deepEqual(resolveCaSetting({ LUBAN_MCP_HTTPS_CA: ' /env/rootCA.pem ' }, config), { caFile: '/env/rootCA.pem', source: 'env', envOverride: true });
        assert.deepEqual(resolveCaSetting({ LUBAN_MCP_HTTPS_CA: '' }, config), { caFile: '', source: null, envOverride: true });
        assert.deepEqual(resolveCaSetting({}, () => undefined), { caFile: '', source: null, envOverride: false });
    }],
    ['the served file is the explicit setting, else rootCA.pem under mkcert -CAROOT, else nothing with a reason', () => {
        assert.deepEqual(resolveCaFile({ caFile: '/x/ca.pem', source: 'config', envOverride: false }, '/root'), { file: '/x/ca.pem', source: 'config', reason: '' });
        assert.deepEqual(resolveCaFile({ caFile: '/x/ca.pem', source: 'env', envOverride: true }, null), { file: '/x/ca.pem', source: 'env', reason: '' });
        const mkcert = resolveCaFile({ caFile: '', source: null, envOverride: false }, '/home/op/.local/share/mkcert');
        assert.equal(mkcert.source, 'mkcert');
        assert.match(mkcert.file || '', /mkcert[\\/]rootCA\.pem$/);
        const none = resolveCaFile({ caFile: '', source: null, envOverride: false }, null);
        assert.equal(none.file, null);
        assert.match(none.reason, /mkcert is not on PATH/);
    }],
    ['mkcert -CAROOT is run once and cached; a failure is remembered for a minute', async () => {
        resetMkcertCache();
        let calls = 0;
        let clock = 1000;
        const exec = (file: string, args: string[], callback: (error: Error | null, stdout: string) => void) => {
            calls += 1;
            assert.equal(file, 'mkcert');
            assert.deepEqual(args, ['-CAROOT']);
            callback(null, '/home/op/.local/share/mkcert\n');
        };
        assert.equal(cachedMkcertCaRoot(exec), null); // kicks the lookup
        assert.equal(await mkcertCaRoot(exec, () => clock), '/home/op/.local/share/mkcert');
        assert.equal(await mkcertCaRoot(exec, () => clock), '/home/op/.local/share/mkcert');
        assert.equal(cachedMkcertCaRoot(exec), '/home/op/.local/share/mkcert');
        assert.equal(calls, 1);

        resetMkcertCache();
        calls = 0;
        const missing = (_file: string, _args: string[], callback: (error: Error | null, stdout: string) => void) => {
            calls += 1;
            callback(new Error('spawn mkcert ENOENT'), '');
        };
        assert.equal(await mkcertCaRoot(missing, () => clock), null);
        assert.equal(await mkcertCaRoot(missing, () => clock + 1000), null);
        assert.equal(calls, 1);
        clock += 70000;
        assert.equal(await mkcertCaRoot(missing, () => clock), null);
        assert.equal(calls, 2);
        resetMkcertCache();
    }],
    ['a PEM is classified as private key, CA certificate, leaf certificate or unknown', () => {
        assert.equal(classifyPem(privateKeyPem()).kind, 'private-key');
        assert.equal(classifyPem('-----BEGIN RSA PRIVATE KEY-----\nnot really\n-----END RSA PRIVATE KEY-----\n').kind, 'private-key');
        assert.equal(classifyPem('-----BEGIN ENCRYPTED PRIVATE KEY-----\nxx\n-----END ENCRYPTED PRIVATE KEY-----\n').kind, 'private-key');
        // A combined file (certificate + key) is a key as far as serving goes.
        assert.equal(classifyPem(`${CA_PEM}${privateKeyPem()}`).kind, 'private-key');
        const ca = classifyPem(Buffer.from(CA_PEM));
        assert.equal(ca.kind, 'certificate');
        assert.equal(ca.ca, true);
        assert.match(ca.subject || '', /luban-mcp test CA/);
        assert.match(ca.fingerprint256 || '', /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
        const leaf = classifyPem(LEAF_PEM);
        assert.equal(leaf.kind, 'certificate');
        assert.equal(leaf.ca, false);
        assert.equal(classifyPem('hello').kind, 'unknown');
    }],
    ['loading refuses a key, a non-certificate and a leaf, and returns only the certificate block of a CA', () => {
        const read = files({
            '/ca.pem': `${CA_PEM}\n# trailing comment\n`,
            '/key.pem': privateKeyPem(),
            '/leaf.pem': LEAF_PEM,
            '/junk.pem': 'not pem',
        });
        const ok = loadCaCertificate({ file: '/ca.pem', source: 'config', reason: '' }, read);
        assert.equal(ok.ok, true);
        assert.equal(ok.pem, CA_PEM);
        assert.equal(ok.error, null);
        const key = loadCaCertificate({ file: '/key.pem', source: 'config', reason: '' }, read);
        assert.equal(key.ok, false);
        assert.equal(key.pem, null);
        assert.match(key.error || '', /PRIVATE KEY and will not be served/);
        const leaf = loadCaCertificate({ file: '/leaf.pem', source: 'mkcert', reason: '' }, read);
        assert.equal(leaf.ok, false);
        assert.match(leaf.error || '', /not a CA certificate/);
        assert.match(loadCaCertificate({ file: '/junk.pem', source: 'config', reason: '' }, read).error || '', /not a PEM certificate/);
        assert.match(loadCaCertificate({ file: '/missing.pem', source: 'config', reason: '' }, read).error || '', /Cannot read \/missing.pem: ENOENT/);
        assert.match(loadCaCertificate({ file: null, source: null, reason: 'no mkcert' }, read).error || '', /no mkcert/);
    }],
    ['the leaf-vs-CA check says whether the HTTPS certificate was issued by the served CA', () => {
        const read = files({ '/leaf.pem': LEAF_PEM, '/junk.pem': 'x' });
        assert.equal(leafIssuedBy(CA_PEM, '/leaf.pem', read), true);
        assert.equal(leafIssuedBy(OTHER_CA_PEM, '/leaf.pem', read), false);
        assert.equal(leafIssuedBy(null, '/leaf.pem', read), null);
        assert.equal(leafIssuedBy(CA_PEM, '/junk.pem', read), null);
        assert.equal(leafIssuedBy(CA_PEM, '/missing.pem', read), null);
    }],
    ['/ca.crt serves the CA as a download with the x509 CA media type and never a key', () => {
        const ok = request('/ca.crt', deps());
        assert.ok(ok);
        assert.equal(ok.status, 200);
        assert.equal(ok.headers['Content-Type'], 'application/x-x509-ca-cert');
        assert.equal(ok.headers['Content-Disposition'], `attachment; filename="${CA_DOWNLOAD_NAME}"`);
        assert.equal(ok.headers['Cache-Control'], 'no-store');
        assert.equal(ok.body, CA_PEM);
        const head = request('/ca.crt', deps(), { method: 'HEAD' });
        assert.equal(head?.status, 200);
        assert.equal(head?.body, undefined);

        const keyed = request('/ca.crt', deps({ readFile: files({ '/ca/rootCA.pem': privateKeyPem() }) }));
        assert.equal(keyed?.status, 404);
        assert.doesNotMatch(keyed?.body || '', /PRIVATE KEY-----/);
        assert.match(keyed?.body || '', /will not be served/);

        const none = request('/ca.crt', deps({ setting: () => ({ caFile: '', source: null, envOverride: false }) }));
        assert.equal(none?.status, 404);
        assert.match(none?.body || '', /mkcert is not on PATH/);

        assert.equal(request('/mcp', deps()), null);
        assert.equal(request('/ca.crt', deps(), { method: 'POST' })?.status, 405);
    }],
    ['both routes redirect an HTTPS request to the plain HTTP listener', () => {
        const page = request('/trust', deps(), { encrypted: true, host: '192.168.1.10:40890' });
        assert.equal(page?.status, 302);
        assert.equal(page?.headers.Location, 'http://192.168.1.10:40889/trust');
        const crt = request('/ca.crt', deps(), { encrypted: true, host: '[::1]:40890' });
        assert.equal(crt?.headers.Location, 'http://[::1]:40889/ca.crt');
        // HTTP listener down: serve in place rather than loop.
        assert.equal(request('/ca.crt', deps({ httpPort: () => null }), { encrypted: true })?.status, 200);
    }],
    ['/trust explains the status and lists per-OS steps, escaping what it quotes', () => {
        const ok = request('/trust', deps({ https: () => ({ configured: true, running: true, port: 40890, error: null, certFile: '/tls/cert.pem' }) }));
        assert.equal(ok?.status, 200);
        assert.equal(ok?.headers['Content-Type'], 'text/html; charset=utf-8');
        const html = ok?.body || '';
        for (const expected of ['Windows', 'macOS', 'Linux', 'iPhone / iPad', 'Android', 'Firefox', 'certutil', 'Certificate Trust Settings',
            'href="/ca.crt"', CA_DOWNLOAD_NAME, 'https://192.168.1.10:40890/jobs', 'issued by this CA', 'luban-mcp test CA']) {
            assert.ok(html.includes(expected), `trust page lacks ${expected}`);
        }
        assert.doesNotMatch(html, /NOT issued/);
        assert.doesNotMatch(html, /BEGIN CERTIFICATE/);

        const mismatch = request('/trust', deps({ readFile: files({ '/ca/rootCA.pem': OTHER_CA_PEM, '/tls/cert.pem': LEAF_PEM }) }));
        assert.match(mismatch?.body || '', /NOT issued by this CA/);

        const broken = request('/trust', deps({
            setting: () => ({ caFile: '/ca/<evil>.pem', source: 'config', envOverride: false }),
            https: () => ({ configured: true, running: false, port: null, error: 'key values <mismatch>', certFile: '/tls/cert.pem' }),
        }));
        const text = broken?.body || '';
        assert.match(text, /No CA certificate can be served: Cannot read \/ca\/&lt;evil&gt;\.pem/);
        assert.match(text, /configured but not running: key values &lt;mismatch&gt;/);
        assert.doesNotMatch(text, /<evil>|<mismatch>/);

        const unconfigured = trustPageHtml({
            ca: loadCaCertificate({ file: null, source: null, reason: 'none' }),
            https: { configured: false, running: false, port: null, error: null },
            leafIssuedByCa: null,
            host: '127.0.0.1',
        });
        assert.match(unconfigured, /HTTPS is not configured/);
    }],
];
