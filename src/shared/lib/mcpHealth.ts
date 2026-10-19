/** Health reporting is read-only and independent of the MCP listener being available. */
export interface McpHealthIssue {
    id: string;
    title: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface McpHealth {
    enabled: boolean;
    issues: McpHealthIssue[];
}

export interface McpHealthInput {
    enabled: boolean;
    running: boolean;
    starting?: boolean;
    startupError?: string | null;
    httpError?: string | null;
    httpsError?: string | null;
    certificateValidTo?: number | null;
    diagnosticError?: string | null;
    probeTransportSelected?: boolean;
    probe?: {
        configured: boolean;
        connected: boolean;
        connecting: boolean;
        transport?: string;
        disabledSensors?: string[];
        missing?: string[];
        lastError?: string | null;
        downForMs?: number | null;
        feeds?: Record<string, { enabled?: boolean; source?: unknown }>;
        safetyTrip?: { reason?: string; channel?: string } | null;
    };
    camera?: { enabled: boolean; lastError: string | null };
}

export function deriveMcpHealth(input: McpHealthInput, now = Date.now()): McpHealth {
    const issues: McpHealthIssue[] = [];
    if (!input.enabled) { return { enabled: false, issues }; }
    const add = (id: string, title: string, message: string, severity: McpHealthIssue['severity'] = 'error') => {
        issues.push({ id, title, message, severity });
    };
    if (input.startupError) {
        add('startup', 'MCP could not start', `${input.startupError} Check Settings → MCP Server, then restart Luban when no job is running.`);
    } else if (input.httpError) {
        add('http', 'MCP HTTP listener failed', `${input.httpError} Check the MCP port and whether another application is using it. Apply any fix with a safe restart.`);
    } else if (!input.running && !input.starting) {
        add('not-running', 'MCP is enabled but not running', 'Check Settings → MCP Server. If you just enabled MCP, restart Luban when no job is running.', 'warning');
    }
    if (input.httpsError) {
        add('https', 'MCP HTTPS listener failed', `${input.httpsError} Check the certificate/key paths and port + 1 in Settings → MCP Server.`);
    } else if (input.certificateValidTo && input.certificateValidTo <= now) {
        add('certificate', 'MCP HTTPS certificate expired', 'Regenerate the mkcert certificate and restart Luban when no job is running. Browser HTTPS connections will fail certificate validation.');
    }
    if (input.diagnosticError) {
        add('diagnostics', 'MCP health check failed', `${input.diagnosticError} Check Settings → MCP Server.`);
    }
    const probe = input.probe;
    const allDisabled = ['probe', 'toolsetter', 'overtravel'].every((name) => probe?.disabledSensors?.includes(name));
    if (probe && !allDisabled) {
        const hasBindings = Object.values(probe.feeds || {}).some((feed) => feed.enabled !== false && !!feed.source);
        if (!probe.configured && (hasBindings || input.probeTransportSelected)) {
            add('probe-config', 'MCP probe feed is not configured',
                `Missing: ${(probe.missing || []).join(', ') || 'sensor configuration'}. Check Settings → MCP Server → Probe sensor feed.`, 'warning');
        } else if (probe.configured && !probe.connected
            && (!probe.connecting || !!probe.lastError || (probe.downForMs || 0) >= 10000)) {
            // Keep the same issue through reconnect attempts; connecting is not recovery.
            add('probe-feed', 'MCP probe feed is unavailable',
                `${probe.lastError || 'The sensor feed is disconnected.'} ${
                    probe.transport === 'gpio' ? 'Check the Blinka interpreter, USB bridge and pin configuration.' : 'Check the broker connection and probe-feed configuration.'
                } See Settings → MCP Server → Probe sensor feed. Sensor-dependent operations are unavailable.`, 'warning');
        }
    }
    if (probe?.safetyTrip) {
        add('probe-alarm', 'MCP sensor alarm is latched',
            `${probe.safetyTrip.reason || `Alarm on ${probe.safetyTrip.channel || 'a sensor'}.`} Review the alarm in Workspace → Connection.`);
    }
    if (input.camera?.enabled && input.camera.lastError) {
        add('camera', 'MCP camera stream has a problem', `${input.camera.lastError} Check the camera connection and Settings → MCP Server → Camera.`, 'warning');
    }
    return { enabled: true, issues };
}

/** Dismissed toasts stay dismissed for this incident, including changing retry counters. */
export class McpHealthChanges {
    private active = new Map<string, McpHealthIssue>();

    public update(health: McpHealth) {
        const current = new Map((health.enabled ? health.issues : []).map((issue) => [issue.id, issue]));
        const added = [...current.values()].filter((issue) => !this.active.has(issue.id));
        const updated = [...current.values()].filter((issue) => {
            const before = this.active.get(issue.id);
            return before && (before.message !== issue.message || before.severity !== issue.severity || before.title !== issue.title);
        });
        const removed = [...this.active.values()].filter((issue) => !current.has(issue.id));
        this.active = current;
        return { added, updated, removed, recovered: health.enabled ? removed : [] };
    }
}
