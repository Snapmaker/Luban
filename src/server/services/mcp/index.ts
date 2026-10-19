import type http from 'http';

import pkg from '../../../package.json';
import { deriveMcpHealth, McpHealthInput } from '../../../shared/lib/mcpHealth';
import logger from '../../lib/logger';
import config from '../configstore';
import { cachedMkcertCaRoot, handleTrustRequest, loadCaCertificate, mkcertCaRoot, resolveCaFile, resolveCaSetting } from './caTrust';
import { cameraStreamService } from './cameraStream';
import { diagnosticsSnapshot, startDiagnostics } from './diagnostics';
import { McpServer, isTrustedAddress, isTrustedOrigin, localSubnets } from './McpServer';
import { McpListeners, resolveHttpsFiles } from './mcpListeners';
import { OAuthShim } from './oauth';
import { handleJobDashboardRequest } from './jobDashboard';
import { dashboardReviews } from './jobDashboardState';
import { jobManager } from './jobs';
import { probeFeedService, resolveActiveProbeConfig } from './probeFeed';
import { pendantRuntime } from './pendantRuntime';
import { McpToolError, ToolRegistry } from './registry';
import { connectedMachineCapability } from './connectedMachine';
import { procedureRefusal } from './procedureGates';
import { liveToolCallHooks } from './toolResultHooks';
import { callRotaryNote } from './rotaryCallContext';
import { registerCalibrationTools } from './tools/calibration';
import { registerCameraTools } from './tools/camera';
import { registerCameraProgramTool } from './cameraProgram';
import { registerCameraModelTools } from './tools/cameraModel';
import { registerCamTools } from './tools/cam';
import { registerEnclosureTools } from './tools/enclosure';
import { registerGcodeTools, stopGcodeJob } from './tools/gcode';
import { registerLandmarkTools } from './tools/landmarks';
import { registerLaserTools } from './tools/laser';
import { registerMotorPowerTools } from './tools/motorPower';
import { currentReviewMachineKey, landmarkReviewForConnected, operatorReviews } from './landmarkReviewState';
import { registerMachineTools } from './tools/machine';
import { registerProbeTools } from './tools/probe';
import { registerProbingTools } from './tools/probing';
import { registerStatusTools } from './tools/status';
import { startFirmwareReadOnConnect } from './tools/firmware';
import { registerTelemetryTools } from './tools/telemetry';
import { registerVibrationTools } from './tools/vibration';
import { spindleTelemetryService } from './spindleTelemetry';
import { vibrationCaptureService } from './vibrationCaptures';
import { vibrationFeedService } from './vibrationFeed';
import { registerToolSetterTools } from './tools/toolsetter';
import { registerWorkspaceTools } from './tools/workspace';
import { registerThreadMillingTools } from './tools/threadMilling';

const log = logger('service:mcp');

// Off by default. Enabled by setting a port, either through the environment
// or the server configstore. Loopback only by default - reachable by local
// processes but never from the LAN the machine sits on. mcpAllowLan /
// LUBAN_MCP_ALLOW_LAN opts into listening on every interface, still refusing
// any client that is not on one of this machine's own IPv4 subnets. There is
// no authentication: anyone on that subnet can then command the machine, so
// the Settings pane says so in red.
const PORT_ENV = 'LUBAN_MCP_PORT';
const ALLOW_LAN_ENV = 'LUBAN_MCP_ALLOW_LAN';
const PORT_CONFIG_KEY = 'mcpPort';
const ENABLED_CONFIG_KEY = 'mcpEnabled';
const ALLOW_LAN_CONFIG_KEY = 'mcpAllowLan';
const DEFAULT_PORT = 40889;

const listeners = new McpListeners((message) => log.info(message), (message) => log.error(message));
let runningSettings: McpSettings | null = null;
let startupError: string | null = null;
let registeredToolCount = 0;
let broadcaster: McpBroadcaster | null = null;

/**
 * Broadcast an MCP-related event to connected UI clients (verbose console).
 * No-op until the service starts.
 */
export function mcpBroadcast(eventName: string, options?: object): void {
    // The active job keeps its own copy of what happened (get_gcode_job_status
    // events), so agents read the record instead of the server log.
    jobManager.recordActivity(eventName, options);
    broadcaster && broadcaster.broadcast(eventName, options);
}

/**
 * UI-only broadcast, NOT recorded on the active job: high-rate telemetry such
 * as the judged machine position (mcp:position, one per 2 s heartbeat) would
 * otherwise crowd a long scan's capped event log.
 */
export function mcpBroadcastLive(eventName: string, options?: object): void {
    broadcaster && broadcaster.broadcast(eventName, options);
}

function validPort(raw: unknown): number | null {
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return null;
    }
    return port;
}

interface McpSettings {
    enabled: boolean;
    port: number;
    source: 'env' | 'config';
    /** Accept clients from this machine's own IPv4 subnets, not just loopback. */
    allowLan: boolean;
    allowLanSource: 'env' | 'config' | 'default';
}

function resolveAllowLan(): { allowLan: boolean; source: 'env' | 'config' | 'default' } {
    const envRaw = process.env[ALLOW_LAN_ENV];
    if (envRaw !== undefined && String(envRaw).trim() !== '') {
        return { allowLan: ['1', 'true', 'yes', 'on'].includes(String(envRaw).trim().toLowerCase()), source: 'env' };
    }
    const configRaw = config.get(ALLOW_LAN_CONFIG_KEY);
    if (configRaw !== undefined && configRaw !== null) {
        return { allowLan: !!configRaw, source: 'config' };
    }
    return { allowLan: false, source: 'default' };
}

function resolveSettings(): McpSettings {
    const envRaw = process.env[PORT_ENV];
    if (envRaw) {
        const envPort = validPort(envRaw);
        if (envPort === null) {
            log.error(`Ignoring invalid ${PORT_ENV}: ${envRaw}`);
        } else {
            const lan = resolveAllowLan();
            return { enabled: true, port: envPort, source: 'env', allowLan: lan.allowLan, allowLanSource: lan.source };
        }
    }

    const configPort = validPort(config.get(PORT_CONFIG_KEY));
    const enabledRaw = config.get(ENABLED_CONFIG_KEY);
    // Legacy behaviour: before mcpEnabled existed, setting mcpPort enabled
    // the service. Keep that when the flag is absent.
    const enabled = (enabledRaw === undefined || enabledRaw === null)
        ? configPort !== null
        : !!enabledRaw;
    const lan = resolveAllowLan();
    return { enabled, port: configPort || DEFAULT_PORT, source: 'config', allowLan: lan.allowLan, allowLanSource: lan.source };
}

/**
 * LAN interfaces in the order an operator would expect: real subnets first,
 * point-to-point /32 addresses (VPN/tailnet interfaces) last - a /32 only
 * ever matches the machine itself, so it is a poor address to hand out.
 */
function orderedLanSubnets(): { address: string; netmask: string }[] {
    return [...localSubnets()].sort((a, b) => Number(a.netmask === '255.255.255.255') - Number(b.netmask === '255.255.255.255'));
}

/** Where a browser should open confirm pages: a LAN address when LAN mode is on, else loopback. */
function publicBaseUrl(port: number, allowLan: boolean, scheme = 'http'): string {
    if (allowLan) {
        const subnet = orderedLanSubnets()[0];
        if (subnet) {
            return `${scheme}://${subnet.address}:${port}`;
        }
    }
    return `${scheme}://127.0.0.1:${port}`;
}

function lanUrls(port: number, scheme = 'http'): string[] {
    return orderedLanSubnets().map((subnet) => `${scheme}://${subnet.address}:${port}/mcp`);
}

/** Served by Luban's authenticated main API even when both MCP listeners are down. */
export function getMcpHealth() {
    const enabled = resolveSettings().enabled;
    const snapshot: McpHealthInput = {
        enabled,
        running: listeners.httpPort !== null || listeners.httpsPort !== null,
        starting: listeners.started && !listeners.httpPort && !listeners.httpsPort && !listeners.httpError && !listeners.httpsError,
        startupError,
        httpError: listeners.httpError,
        httpsError: listeners.httpsError,
        certificateValidTo: listeners.certificateValidTo,
        probeTransportSelected: !!String(process.env.LUBAN_MCP_PROBE_TRANSPORT || config.get('mcpProbeTransport') || '').trim(),
    };
    if (enabled) {
        try {
            snapshot.probe = probeFeedService.status() as McpHealthInput['probe'];
            snapshot.camera = cameraStreamService.status();
        } catch (err) {
            snapshot.diagnosticError = (err as Error).message;
        }
    }
    return deriveMcpHealth(snapshot);
}

/**
 * Status of the MCP service for this run. Settings changes apply at the
 * next start; `running`/`port` describe what is actually live now.
 */
export function getMcpStatus() {
    const settings = resolveSettings();
    const live = runningSettings || settings;
    const httpsSettings = resolveHttpsFiles(process.env, (key) => config.get(key));
    const httpsBase = listeners.httpsPort ? publicBaseUrl(listeners.httpsPort, live.allowLan, 'https') : null;
    // The CA trust page lives on the PLAIN HTTP listener (#218): a browser
    // that does not trust the HTTPS origin yet has to be able to fetch it.
    const httpBase = publicBaseUrl(listeners.httpPort || live.port, live.allowLan);
    const caSetting = resolveCaSetting(process.env, (key) => config.get(key));
    const ca = loadCaCertificate(resolveCaFile(caSetting, cachedMkcertCaRoot()));
    return {
        running: listeners.httpPort !== null || listeners.httpsPort !== null,
        port: listeners.httpPort,
        httpError: listeners.httpError,
        startupError,
        health: getMcpHealth(),
        https: {
            ...httpsSettings,
            configured: !!(httpsSettings.certFile || httpsSettings.keyFile),
            configuredPort: settings.port < 65535 ? settings.port + 1 : null,
            running: listeners.httpsPort !== null,
            port: listeners.httpsPort,
            error: listeners.httpsError,
            certificateValidTo: listeners.certificateValidTo,
            jobsUrl: httpsBase ? `${httpsBase}/jobs` : null,
            mcpUrl: httpsBase ? `${httpsBase}/mcp` : null,
            lanUrls: listeners.httpsPort && live.allowLan ? lanUrls(listeners.httpsPort, 'https') : [],
            // Browser trust (caTrust.ts): the stored CA path, whether env
            // overrides it, and what /ca.crt would actually serve right now.
            caFile: caSetting.caFile,
            caEnvOverride: caSetting.envOverride,
            ca: {
                file: ca.file,
                source: ca.source,
                ok: ca.ok,
                error: ca.error,
                subject: ca.info ? ca.info.subject : null,
                fingerprint256: ca.info ? ca.info.fingerprint256 : null,
            },
            trustUrl: `${httpBase}/trust`,
            caUrl: `${httpBase}/ca.crt`,
        },
        toolCount: registeredToolCount,
        jobsUrl: `${httpsBase || publicBaseUrl(live.port, live.allowLan)}/jobs`,
        settings,
        // LAN URLs an agent on the same subnet can use (only meaningful when
        // allowLan is on AND the server is running with it).
        lanUrls: listeners.httpPort && live.allowLan ? lanUrls(listeners.httpPort) : [],
        // Sensor feed snapshot for the Workspace connection pills; live
        // updates arrive over mcp:activity (tool 'probe_feed').
        probeFeed: probeFeedService.status(),
        // Timing evidence (event-loop stalls, heartbeat cadence, gcode
        // pacing, sensor pipe latency) - diagnostics.ts.
        diagnostics: diagnosticsSnapshot(),
        // Live MJPEG view of the camera (/camera on this same server) -
        // cameraStream.ts. URLs follow the LAN setting like confirm pages.
        cameraStream: {
            ...cameraStreamService.status(),
            ...(listeners.started ? {} : {
                pageUrl: `${publicBaseUrl(settings.port, settings.allowLan)}/camera`,
                streamUrl: `${publicBaseUrl(settings.port, settings.allowLan)}/camera/stream.mjpeg`,
                snapshotUrl: `${publicBaseUrl(settings.port, settings.allowLan)}/camera/snapshot.jpg`,
            }),
        },
    };
}

export interface McpBroadcaster {
    broadcast: (eventName: string, options?: object) => void;
}

function startConfiguredMcpService(socketServer?: McpBroadcaster): void {
    if (listeners.started) {
        return;
    }

    const settings = resolveSettings();
    if (!settings.enabled) {
        return;
    }
    const port = settings.port;
    runningSettings = settings;

    const registry = new ToolRegistry();
    registerStatusTools(registry);
    registerMachineTools(registry);
    registerEnclosureTools(registry);
    const baseUrl = () => publicBaseUrl(listeners.httpsPort || port, settings.allowLan, listeners.httpsPort ? 'https' : 'http');
    registerGcodeTools(registry, baseUrl);
    registerThreadMillingTools(registry);
    registerCameraTools(registry, baseUrl);
    registerCameraProgramTool(registry, baseUrl);
    registerCameraModelTools(registry, baseUrl);
    registerCalibrationTools(registry);
    registerLandmarkTools(registry, baseUrl);
    registerProbeTools(registry);
    registerTelemetryTools(registry);
    registerVibrationTools(registry);
    registerToolSetterTools(registry, baseUrl);
    registerWorkspaceTools(registry, baseUrl);
    registerProbingTools(registry, baseUrl);
    registerCamTools(registry, baseUrl);
    registerLaserTools(registry, baseUrl);
    registerMotorPowerTools(registry, baseUrl);
    // Read a GRBL machine's configuration once per connection, in memory only
    // (tools/firmware.ts): the validator's M4 rule and get_machine_profile use it.
    startFirmwareReadOnConnect();
    // Refuse rather than translate (#265 WP4b): a CNC procedure the connected
    // machine's dialect row does not allow is refused, naming the machine,
    // before its handler runs (procedureGates.ts).
    registry.setProcedureGate((name, args) => {
        const refusal = procedureRefusal(connectedMachineCapability(), name, args as { [key: string]: unknown });
        if (refusal) {
            throw new McpToolError(refusal);
        }
    });
    // Machine visibility (#265 WP8): applied records and the landmark review
    // on every motion / staging result, the rotary `stock` scope around the
    // tools that take it (toolResultHooks.ts).
    registry.setCallHooks(liveToolCallHooks());
    // The confirm page's Landmarks row: what was enforced, and the review status, when each job was staged.
    jobManager.setLandmarksSource(() => {
        const review = landmarkReviewForConnected();
        if (!review.machine.connected) {
            return null;
        }
        return {
            status: review.status,
            landmarks: review.landmarks.map((l) => ({ name: l.name, requiredToolheadZ: l.requiredToolheadZ, basis: l.basis })),
            question: review.question,
            rotaryNote: callRotaryNote(),
        };
    });
    registeredToolCount = registry.list().length;

    // Operator-facing live camera view; also the single frame source for
    // every MCP capture while it runs (camera.ts LiveFrameSource).
    cameraStreamService.start(baseUrl);

    broadcaster = socketServer || null;

    // Mirror tool activity to connected UI clients so the Workspace console
    // can show agent traffic (verbose toggle).
    const onActivity = (activity: object) => {
        mcpBroadcast('mcp:activity', activity);
    };

    // OAuth-shaped handshake for clients that insist on one (oauth.ts). It
    // authenticates nobody - it exists so those clients connect at all, and
    // so their registered name can label the log.
    const oauth = new OAuthShim(port);
    const mcpServer = new McpServer(registry, 'snapmaker-luban', pkg.version, onActivity, {
        allowLan: settings.allowLan,
        identifyClient: (req) => oauth.identifyClient(req),
    });

    const handleRequest: http.RequestListener = (req, res) => {
        // Same trust boundary for every route: local processes only (plus, in
        // LAN mode, hosts on this machine's own subnets), and no browser
        // contexts other than localhost / the app's own scheme (or, in LAN
        // mode, a same-subnet host).
        if (!isTrustedAddress(req.socket.remoteAddress, settings.allowLan)
            || !isTrustedOrigin(req.headers.origin, settings.allowLan)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'forbidden' }));
            return;
        }

        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/pendant' || url.pathname.startsWith('/pendant/')) {
            pendantRuntime.handleRequest(req, res, url).catch((err: Error) => {
                log.error(`Pendant request failed: ${err.message}`);
                if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); }
                res.end(JSON.stringify({ error: 'Pendant request failed.' }));
            });
            return;
        }
        if (url.pathname === '/' || url.pathname === '/jobs' || url.pathname.startsWith('/jobs/')) {
            handleJobDashboardRequest(req, res, url, jobManager, async (id) => stopGcodeJob({ job_id: id, wait_ms: 0 }, 'operator'), () => {
                // The dashboard links to the CA trust page only once HTTPS is configured.
                const https = resolveHttpsFiles(process.env, (key) => config.get(key));
                return https.certFile || https.keyFile ? { url: `${publicBaseUrl(listeners.httpPort || port, settings.allowLan)}/trust` } : null;
            }, () => dashboardReviews(operatorReviews.list())); // links only; the decision stays on /confirm/r<id>
            return;
        }
        if (handleTrustRequest(req, res, url, {
            // CA certificate download + per-OS install steps, plain HTTP (caTrust.ts).
            setting: () => resolveCaSetting(process.env, (key) => config.get(key)),
            caRoot: () => cachedMkcertCaRoot(),
            httpPort: () => listeners.httpPort,
            https: () => {
                const files = resolveHttpsFiles(process.env, (key) => config.get(key));
                return {
                    configured: !!(files.certFile || files.keyFile),
                    running: listeners.httpsPort !== null,
                    port: listeners.httpsPort,
                    error: listeners.httpsError,
                    certFile: files.certFile,
                };
            },
        })) {
            return;
        }
        if (url.pathname.startsWith('/confirm')) {
            // Staged landmark / device decisions (/confirm/r<id>, landmarkReviewState.ts) first,
            // then the human job-confirmation pages (jobs.ts).
            if (!operatorReviews.handleConfirmRequest(req, res, url.pathname, currentReviewMachineKey)) {
                jobManager.handleConfirmRequest(req, res, url.pathname);
            }
            return;
        }
        if (url.pathname === '/camera' || url.pathname.startsWith('/camera/')) {
            // Live MJPEG camera view (cameraStream.ts); off = 404
            cameraStreamService.handleRequest(req, res, url);
            return;
        }
        if (url.pathname === '/telemetry/live.json') {
            // Spindle telemetry of the running (or latest) file job for the
            // camera page's side panel: latest RPM / noise / chatter values
            // and two-minute sparkline tails. Read-only.
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : JSON.stringify(spindleTelemetryService.live()));
            return;
        }
        if (oauth.handleRequest(req, res, url)) {
            return;
        }

        mcpServer.handleRequest(req, res);
    };
    listeners.start({ port, allowLan: settings.allowLan, ...resolveHttpsFiles(process.env, (key) => config.get(key)) }, handleRequest);
    startDiagnostics();
    // Warm the `mkcert -CAROOT` cache so the Settings pane and /trust can
    // name the CA file on their first request. Absence is not an error.
    mkcertCaRoot().catch(() => undefined);

    // Arm the external probe feed (and its overtravel tripwire) without any
    // agent involvement when it is fully configured. Failure is logged and
    // retried by the feed's own backoff; it must never break startup.
    if (resolveActiveProbeConfig().configured) {
        probeFeedService.connect().catch((err: Error) => {
            log.error(`Probe feed auto-connect failed: ${err.message}`);
        });
    }

    // Accelerometers (opt-in, read-only): their own monitor and bridge,
    // retried by their own backoff; never part of the probe feed.
    try {
        vibrationFeedService.reconfigure();
    } catch (err) {
        log.error(`Accelerometer feed start failed: ${(err as Error).message}`);
    }
}

export function startMcpService(socketServer?: McpBroadcaster): void {
    if (listeners.started) { return; }
    startupError = null;
    try {
        startConfiguredMcpService(socketServer);
    } catch (err) {
        startupError = (err as Error).message || String(err);
        listeners.stop();
        log.error(`MCP startup failed: ${startupError}`);
        // Keep Luban and its main API available to report the failure.
    }
}

export function stopMcpService(): void {
    // Resolves once a queued pendant run has settled and restored G54; the machine
    // connection outlives the MCP service, so the restore still reaches the controller.
    pendantRuntime.shutdown().catch((err: Error) => log.warn(`Pendant shutdown: ${err.message}`));
    cameraStreamService.shutdown();
    vibrationCaptureService.shutdown();
    vibrationFeedService.shutdown();
    listeners.stop();
    runningSettings = null;
    startupError = null;
}
