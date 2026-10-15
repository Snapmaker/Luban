import { Input, Radio, Select, Switch } from 'antd';
import React, { useState, useEffect } from 'react';

import api from '../../../../../api';
import i18n from '../../../../../lib/i18n';
import UniApi from '../../../../../lib/uni-api';
import { McpHealthPanel } from '../../../../components/McpHealth';
import SvgIcon from '../../../../components/SvgIcon';
import styles from '../form.styl';

interface McpMqttSettings {
    values: {
        host: string;
        port: string;
        user: string;
        clientId: string;
        feedToolsetter: string;
        feedOvertravel: string;
        feedProbe: string;
        inverted: string;
    };
    passSet: boolean;
    envOverrides: string[];
    configured: boolean;
    missing: string[];
    defaultClientId: string;
}

interface McpGpioSettings {
    values: {
        python: string;
        pinToolsetter: string;
        pinOvertravel: string;
        pinProbe: string;
        inverted: string;
        pollMs: string;
        blinkaEnv: string;
    };
    envOverrides: string[];
    configured: boolean;
    missing: string[];
    defaultPython: string;
    defaultBlinkaEnv: string;
}

interface McpTransportSettings {
    /** Stored choice: '' = auto, 'mqtt' or 'gpio'. */
    stored: string;
    envOverride: boolean;
    active: 'mqtt' | 'gpio';
}

interface McpSensorSettings {
    toolSetter: boolean;
    probe: boolean;
    envOverrides: string[];
}

interface McpCameraStreamStatus {
    enabled: boolean;
    source: 'env' | 'config' | 'default';
    fps: number;
    storedFps: number | null;
    maxClients: number;
    pageUrl: string | null;
    streamUrl: string | null;
    running: boolean;
    clients: number;
    device: string | null;
    lastError: string | null;
}

interface McpStatus {
    running: boolean;
    port: number | null;
    toolCount: number;
    settings: {
        enabled: boolean;
        port: number;
        source: 'env' | 'config';
        allowLan: boolean;
        allowLanSource: 'env' | 'config' | 'default';
    };
    lanUrls: string[];
    jobsUrl?: string;
    https?: {
        certFile: string;
        keyFile: string;
        envOverrides: string[];
        running: boolean;
        port: number | null;
        error: string | null;
        jobsUrl: string | null;
        lanUrls: string[];
    };
    transport: McpTransportSettings;
    sensors: McpSensorSettings;
    mqtt: McpMqttSettings;
    gpio: McpGpioSettings;
    buffers?: {
        jobEventLimit: number;
        jobEventLimitRange: [number, number];
        jobEventLimitSource: 'env' | 'config' | 'default';
        diagnosticsRecentLimit: number;
        diagnosticsRecentLimitRange: [number, number];
        diagnosticsRecentLimitSource: 'env' | 'config' | 'default';
    };
    approval?: {
        handoff: 'agent' | 'code';
        source: 'env' | 'config' | 'default';
    };
    cameraStream?: McpCameraStreamStatus;
    spindleTelemetry?: {
        enabled: boolean;
        statusPollMs: number;
        statusPollRange: [number, number];
        audioEnabled: boolean;
        audioDevice: string | null;
        sources: { [field: string]: 'env' | 'config' | 'default' };
        envNames: { [field: string]: string };
        devices: Array<{ entry: string; description: string; backend: string; builtIn: boolean; usb: boolean }>;
        resolves: boolean;
        resolution: string;
        guidance: string;
        error?: string;
    };
}
const MQTT_FIELDS: Array<{ name: keyof McpMqttSettings['values']; labelKey: string; placeholder?: string; channel?: string }> = [
    { name: 'host', labelKey: 'key-App/Settings/McpServer-MQTT host', placeholder: 'io.adafruit.com' },
    { name: 'port', labelKey: 'key-App/Settings/McpServer-MQTT port', placeholder: '8883 (TLS)' },
    { name: 'user', labelKey: 'key-App/Settings/McpServer-MQTT username' },
    { name: 'clientId', labelKey: 'key-App/Settings/McpServer-MQTT client id' },
    { name: 'feedToolsetter', labelKey: 'key-App/Settings/McpServer-Tool setter feed', channel: 'toolsetter' },
    { name: 'feedOvertravel', labelKey: 'key-App/Settings/McpServer-Overtravel feed', channel: 'overtravel' },
    { name: 'feedProbe', labelKey: 'key-App/Settings/McpServer-CNC probe feed', channel: 'probe' },
];

// Pin fields carry the pull as a suffix ("D2:up"); polarity is the separate
// inverted switch, exactly like the MQTT channels.
const GPIO_PIN_FIELDS: Array<{ name: keyof McpGpioSettings['values']; labelKey: string; placeholder: string; channel: string }> = [
    { name: 'pinToolsetter', labelKey: 'key-App/Settings/McpServer-Tool setter pin', placeholder: 'D2:up', channel: 'toolsetter' },
    { name: 'pinOvertravel', labelKey: 'key-App/Settings/McpServer-Overtravel pin', placeholder: 'D3:up', channel: 'overtravel' },
    { name: 'pinProbe', labelKey: 'key-App/Settings/McpServer-CNC probe pin', placeholder: 'A0:down', channel: 'probe' },
];

const CHANNELS = ['toolsetter', 'overtravel', 'probe'];

const LABEL_STYLE = { width: 160, flexShrink: 0 };

function parseInvertedFlags(names: string): { [channel: string]: boolean } {
    const list = String(names || '').split(',').map((n) => n.trim().toLowerCase());
    const flags: { [channel: string]: boolean } = {};
    CHANNELS.forEach((channel) => {
        flags[channel] = list.includes(channel);
    });
    return flags;
}

/**
 * MCP server settings: enabled + port, persisted in the server configstore.
 * Changes apply at the next application start; the label reports what this
 * run is actually doing. The probe feed section configures the external
 * tool-setter / overtravel / touch-probe sensor transport - MQTT (Adafruit
 * IO) or direct GPIO through Adafruit Blinka / U2IF - with the transport
 * choice itself. Environment variables (LUBAN_MCP_PROBE_TRANSPORT,
 * LUBAN_MCP_MQTT_*, LUBAN_MCP_GPIO_*) override these fields; the pane
 * flags which ones are currently overridden.
 */
const McpServer: React.FC = () => {
    const [status, setStatus] = useState<McpStatus | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [port, setPort] = useState('');
    const [allowLan, setAllowLan] = useState(false);
    const [httpsCert, setHttpsCert] = useState('');
    const [httpsKey, setHttpsKey] = useState('');
    const [toolSetterEnabled, setToolSetterEnabled] = useState(true);
    const [probeEnabled, setProbeEnabled] = useState(true);
    const [transport, setTransport] = useState('');
    const [mqtt, setMqtt] = useState<{ [field: string]: string }>({});
    const [inverted, setInverted] = useState<{ [channel: string]: boolean }>({});
    const [mqttPass, setMqttPass] = useState('');
    const [mqttPassTouched, setMqttPassTouched] = useState(false);
    const [gpio, setGpio] = useState<{ [field: string]: string }>({});
    const [gpioInverted, setGpioInverted] = useState<{ [channel: string]: boolean }>({});
    // Diagnostic buffer sizes; '' = server default. Stored values only (an
    // env override disables the field).
    const [jobEventLimit, setJobEventLimit] = useState('');
    const [diagnosticsRecentLimit, setDiagnosticsRecentLimit] = useState('');
    // Job approval hand-off: true = a waiting agent starts on the operator's click.
    const [approvalHandoffAgent, setApprovalHandoffAgent] = useState(true);
    // Live MJPEG camera view served by the MCP server (/camera). Applies at
    // once on save: off disconnects every viewer. '' fps = server default.
    const [cameraStreamEnabled, setCameraStreamEnabled] = useState(false);
    const [cameraStreamFps, setCameraStreamFps] = useState('');
    // Spindle telemetry (opt-in, read at the next file-job start). The
    // microphone is chosen here by name from the host's capture sources;
    // the server never picks one.
    const [spindleTelemetry, setSpindleTelemetry] = useState(false);
    const [spindleStatusPollMs, setSpindleStatusPollMs] = useState('');
    const [spindleAudio, setSpindleAudio] = useState(false);
    const [spindleAudioDevice, setSpindleAudioDevice] = useState('');

    useEffect(() => {
        api.getMcpStatus()
            .then((res) => {
                const body = (res as { body: McpStatus }).body;
                setStatus(body);
                setEnabled(body.settings.enabled);
                setPort(String(body.settings.port));
                setAllowLan(!!body.settings.allowLan);
                setHttpsCert(body.https?.certFile || '');
                setHttpsKey(body.https?.keyFile || '');
                if (body.sensors) {
                    setToolSetterEnabled(body.sensors.toolSetter !== false);
                    setProbeEnabled(body.sensors.probe !== false);
                }
                setTransport(body.transport ? body.transport.stored : '');
                if (body.buffers) {
                    setJobEventLimit(body.buffers.jobEventLimitSource === 'config' ? String(body.buffers.jobEventLimit) : '');
                    setDiagnosticsRecentLimit(body.buffers.diagnosticsRecentLimitSource === 'config' ? String(body.buffers.diagnosticsRecentLimit) : '');
                }
                if (body.approval) {
                    setApprovalHandoffAgent(body.approval.handoff !== 'code');
                }
                if (body.cameraStream) {
                    setCameraStreamEnabled(!!body.cameraStream.enabled);
                    setCameraStreamFps(body.cameraStream.storedFps === undefined || body.cameraStream.storedFps === null
                        ? '' : String(body.cameraStream.storedFps));
                }
                if (body.spindleTelemetry && !body.spindleTelemetry.error) {
                    setSpindleTelemetry(!!body.spindleTelemetry.enabled);
                    setSpindleStatusPollMs(body.spindleTelemetry.statusPollMs ? String(body.spindleTelemetry.statusPollMs) : '');
                    setSpindleAudio(!!body.spindleTelemetry.audioEnabled);
                    setSpindleAudioDevice(body.spindleTelemetry.audioDevice || '');
                }
                const { inverted: mqttInvertedNames, ...mqttValues } = body.mqtt.values;
                setMqtt({ ...mqttValues });
                setInverted(parseInvertedFlags(mqttInvertedNames));

                if (body.gpio) {
                    const { inverted: gpioInvertedNames, ...gpioValues } = body.gpio.values;
                    setGpio({ ...gpioValues });
                    setGpioInverted(parseInvertedFlags(gpioInvertedNames));
                }
            })
            .catch(() => setStatus(null));
    }, []);

    const telemetryEnv = (field: string) => !!(status && status.spindleTelemetry && status.spindleTelemetry.sources
        && status.spindleTelemetry.sources[field] === 'env');
    const telemetryEnvNote = (field: string) => (telemetryEnv(field) && status && status.spindleTelemetry
        ? ` — ${i18n._('key-App/Settings/McpServer-Overridden by environment variable')} ${status.spindleTelemetry.envNames[field]}` : '');

    const onSave = async () => {
        const value = Number(port);
        if (!Number.isInteger(value) || value < 1 || value > 65535) {
            return;
        }
        const mqttUpdate: { [field: string]: string } = { ...mqtt };
        mqttUpdate.inverted = CHANNELS.filter((channel) => inverted[channel]).join(',');
        if (mqttPassTouched) {
            mqttUpdate.pass = mqttPass;
        }
        const gpioUpdate: { [field: string]: string } = { ...gpio };
        gpioUpdate.inverted = CHANNELS.filter((channel) => gpioInverted[channel]).join(',');
        await api.setMcpSettings({
            enabled,
            port: value,
            allowLan,
            https: {
                ...(status?.https?.envOverrides.includes('certFile') ? {} : { certFile: httpsCert }),
                ...(status?.https?.envOverrides.includes('keyFile') ? {} : { keyFile: httpsKey }),
            },
            sensors: { toolSetter: toolSetterEnabled, probe: probeEnabled },
            transport,
            mqtt: mqttUpdate,
            gpio: gpioUpdate,
            buffers: { jobEventLimit, diagnosticsRecentLimit },
            approvalHandoff: approvalHandoffAgent ? 'agent' : 'code',
            cameraStream: { enabled: cameraStreamEnabled, fps: cameraStreamFps },
            spindleTelemetry: {
                ...(telemetryEnv('enabled') ? {} : { enabled: spindleTelemetry }),
                ...(telemetryEnv('statusPollMs') ? {} : { statusPollMs: spindleStatusPollMs }),
                ...(telemetryEnv('audioEnabled') ? {} : { audioEnabled: spindleAudio }),
                ...(telemetryEnv('audioDevice') ? {} : { audioDevice: spindleAudioDevice }),
            },
        });
        // The stream toggle applies immediately; refresh the live URL / state.
        api.getMcpStatus()
            .then((res) => setStatus((res as { body: McpStatus }).body))
            .catch(() => undefined);
    };

    useEffect(() => {
        UniApi.Event.on('appbar-menu:settings.save', onSave);
        return () => {
            UniApi.Event.off('appbar-menu:settings.save', onSave);
        };
    }, [onSave]);

    const handleChangePort = (e) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setPort(value);
        }
    };

    let statusLine = i18n._('key-App/Settings/McpServer-Status unknown');
    if (status) {
        statusLine = status.running
            ? `${i18n._('key-App/Settings/McpServer-Running this session at')} ${status.port ? `http://127.0.0.1:${status.port}/mcp` : `https://127.0.0.1:${status.https?.port}/mcp`} (${status.toolCount} tools)`
            : i18n._('key-App/Settings/McpServer-Not running this session');
        if (status.settings.source === 'env') {
            statusLine += ` — ${i18n._('key-App/Settings/McpServer-Overridden by LUBAN_MCP_PORT')}`;
        }
    }

    let transportLine = '';
    if (status && status.transport) {
        transportLine = `${i18n._('key-App/Settings/McpServer-Active this session:')} ${status.transport.active.toUpperCase()}`;
        if (status.transport.envOverride) {
            transportLine += ` — ${i18n._('key-App/Settings/McpServer-Overridden by LUBAN_MCP_PROBE_TRANSPORT')}`;
        }
    }

    const mqttEnvOverrides = status ? status.mqtt.envOverrides : [];
    const gpioEnvOverrides = status && status.gpio ? status.gpio.envOverrides : [];

    const renderInvertedSwitch = (checked: boolean, onChange: (checked: boolean) => void) => (
        <>
            <Switch
                className="margin-left-8"
                size="small"
                checked={checked}
                onChange={onChange}
                disabled={!enabled}
            />
            <span
                className="margin-left-4"
                style={{ whiteSpace: 'nowrap' }}
                title={i18n._('key-App/Settings/McpServer-Normally-open sensor: idles at 1, reads 0 on contact')}
            >
                {i18n._('key-App/Settings/McpServer-Inverted')}
            </span>
        </>
    );

    return (
        <div className={styles['form-container']}>
            <McpHealthPanel />
            <div className="border-bottom-normal padding-bottom-4">
                <SvgIcon
                    name="TitleSetting"
                    type={['static']}
                />
                <span className="margin-left-4">{i18n._('key-App/Settings/McpServer-MCP Server')}</span>
            </div>
            <div className="margin-top-16">
                <div className="margin-bottom-8">{statusLine}</div>
                <div className="sm-flex align-center margin-bottom-8">
                    <Switch checked={enabled} onChange={(checked) => setEnabled(checked)} />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Enable MCP server (applies after restart)')}</span>
                </div>
                <div className={styles['set-port-box']}>
                    <Input
                        value={port}
                        onChange={handleChangePort}
                        disabled={!enabled}
                        className={styles['port-input']}
                    />
                    <div className={styles['port-tips']}>
                        {i18n._('key-App/Settings/McpServer-Local agents connect at')} http://127.0.0.1:&lt;port&gt;/mcp. {allowLan
                            ? i18n._('key-App/Settings/McpServer-LAN access is ON: hosts on this machine\'s own subnets are accepted too.')
                            : i18n._('key-App/Settings/McpServer-Loopback only; never reachable from the network')}
                    </div>
                </div>
                <div className="sm-flex align-center margin-bottom-8 margin-top-8">
                    <Switch
                        checked={allowLan}
                        onChange={(checked) => setAllowLan(checked)}
                        disabled={!enabled || !!(status && status.settings && status.settings.allowLanSource === 'env')}
                    />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Allow access from the local network (same subnet only; applies after restart)')}</span>
                </div>
                {allowLan && (
                    <div className="margin-bottom-8" style={{ color: '#FF4D4F' }}>
                        {i18n._('key-App/Settings/McpServer-WARNING: there is no authentication. Anyone on your local network can then command the machine. Only enable on a trusted network, and never leave the machine unattended.')}
                        {status && status.lanUrls && status.lanUrls.length > 0 && (
                            <div style={{ color: 'inherit' }}>{i18n._('key-App/Settings/McpServer-LAN URLs:')} {status.lanUrls.join(', ')}</div>
                        )}
                        {status && status.settings && status.settings.allowLanSource === 'env' && (
                            <div>{i18n._('key-App/Settings/McpServer-Overridden by LUBAN_MCP_ALLOW_LAN')}</div>
                        )}
                    </div>
                )}
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>HTTPS and browser notifications</span>
            </div>
            <div className="margin-top-8">
                <p>
                    HTTPS listens on the MCP port + 1 (default 40890), alongside HTTP.
                    Set both mkcert PEM file paths on the server, save, then restart Luban.
                </p>
                <label htmlFor="mcp-https-cert" className="sm-flex align-center margin-top-8">
                    <span style={LABEL_STYLE}>Certificate file</span>
                    <Input
                        id="mcp-https-cert"
                        value={httpsCert}
                        onChange={(e) => setHttpsCert(e.target.value)}
                        disabled={!enabled || status?.https?.envOverrides.includes('certFile')}
                        placeholder="/path/to/mcp-cert.pem"
                    />
                </label>
                <label htmlFor="mcp-https-key" className="sm-flex align-center margin-top-8">
                    <span style={LABEL_STYLE}>Private key file</span>
                    <Input
                        id="mcp-https-key"
                        value={httpsKey}
                        onChange={(e) => setHttpsKey(e.target.value)}
                        disabled={!enabled || status?.https?.envOverrides.includes('keyFile')}
                        placeholder="/path/to/mcp-key.pem"
                    />
                </label>
                <p className={styles['port-tips']}>Trust the mkcert CA on each browser/phone and include the server’s LAN IP in the certificate. Clear both paths to turn HTTPS off after restart. Environment overrides: LUBAN_MCP_HTTPS_CERT / LUBAN_MCP_HTTPS_KEY.</p>
                <div>{status?.https?.running ? `HTTPS running on port ${status.https.port}` : 'HTTPS is not running this session.'}</div>
                {status?.https?.error && <div style={{ color: '#FF4D4F' }}>{status.https.error}</div>}
                {status?.running && status.jobsUrl && (
                    <p><a href={status.jobsUrl} target="_blank" rel="noopener noreferrer">Open job dashboard</a></p>
                )}
                {status?.https?.lanUrls.map((url) => <div key={url}>{url}</div>)}
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>{i18n._('key-App/Settings/McpServer-Job approval')}</span>
            </div>
            <div className="margin-top-8">
                <div className="sm-flex align-center">
                    <Switch
                        checked={approvalHandoffAgent}
                        onChange={(checked) => setApprovalHandoffAgent(checked)}
                        disabled={!enabled || !!(status && status.approval && status.approval.source === 'env')}
                    />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Hand approval to the waiting agent (your click on the confirm page starts the job; no code to copy)')}</span>
                </div>
                <div className={styles['port-tips']}>
                    {i18n._('key-App/Settings/McpServer-Off: the confirm page shows a one-time code you must relay to the agent yourself. Either way only your click in the browser authorises motion.')}
                    {status && status.approval && status.approval.source === 'env' ? ` — ${i18n._('key-App/Settings/McpServer-Overridden by environment variable')} LUBAN_MCP_APPROVAL_HANDOFF` : ''}
                </div>
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>{i18n._('key-App/Settings/McpServer-Camera')}</span>
            </div>
            <div className="margin-top-8">
                <div className="sm-flex align-center">
                    <Switch
                        checked={cameraStreamEnabled}
                        onChange={(checked) => setCameraStreamEnabled(checked)}
                        disabled={!enabled || !!(status && status.cameraStream && status.cameraStream.source === 'env')}
                    />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Live camera stream in the browser (MJPEG at /camera on the MCP port; applies on save)')}</span>
                </div>
                {cameraStreamEnabled && status && status.cameraStream && status.cameraStream.pageUrl && (
                    <div className="margin-top-8">
                        {i18n._('key-App/Settings/McpServer-Watch at:')}{' '}
                        <a href={status.cameraStream.pageUrl} target="_blank" rel="noopener noreferrer">{status.cameraStream.pageUrl}</a>
                        {status.running
                            ? ` — ${status.cameraStream.running
                                ? `${i18n._('key-App/Settings/McpServer-streaming to')} ${status.cameraStream.clients} ${i18n._('key-App/Settings/McpServer-viewer(s)')}`
                                : i18n._('key-App/Settings/McpServer-idle until a browser opens it')}`
                            : ` — ${i18n._('key-App/Settings/McpServer-Not running this session')}`}
                        {status.cameraStream.lastError ? ` — ${status.cameraStream.lastError}` : ''}
                    </div>
                )}
                <div className={styles['port-tips']}>
                    {i18n._('key-App/Settings/McpServer-One capture loop owns the camera while someone watches; agent captures (capture_frame, move_and_capture, visual servo) are served from the same frames, so both work at once. Off: /camera answers 404 and viewers are disconnected. Default: on once a camera is configured.')}
                    {status && status.cameraStream && status.cameraStream.source === 'env' ? ` — ${i18n._('key-App/Settings/McpServer-Overridden by environment variable')} LUBAN_MCP_CAMERA_STREAM_ENABLED` : ''}
                </div>
                <div className="sm-flex align-center margin-top-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Stream frame rate (fps)')}</span>
                    <Input
                        value={cameraStreamFps}
                        onChange={(e) => {
                            if (/^\d*$/.test(e.target.value)) {
                                setCameraStreamFps(e.target.value);
                            }
                        }}
                        disabled={!enabled || !cameraStreamEnabled}
                        className={styles['port-input']}
                        placeholder={status && status.cameraStream ? String(status.cameraStream.fps) : '5'}
                    />
                    <span className="margin-left-8">1-15; {i18n._('key-App/Settings/McpServer-applies when the stream next starts')}</span>
                </div>
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>{i18n._('key-App/Settings/McpServer-Spindle telemetry')}</span>
            </div>
            <div className="margin-top-8">
                <div className={styles['port-tips']}>
                    {i18n._('key-App/Settings/McpServer-Opt-in. Records the spindle RPM the controller reports during file jobs and, with a microphone, tracks RPM at 20 frames/s to flag sag, blips, chatter and runout per commanded speed. Observes only: it never pauses or stops a job. Applies at the next file job; with telemetry on the job event log default rises to 200000.')}
                </div>
                <div className="sm-flex align-center margin-top-8">
                    <Switch checked={spindleTelemetry} onChange={(checked) => setSpindleTelemetry(checked)} disabled={!enabled || telemetryEnv('enabled')} />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Record status RPM during file jobs')}{telemetryEnvNote('enabled')}</span>
                </div>
                <div className="sm-flex align-center margin-top-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Extra status poll (ms)')}</span>
                    <Input
                        value={spindleStatusPollMs}
                        onChange={(e) => {
                            if (/^\d*$/.test(e.target.value)) {
                                setSpindleStatusPollMs(e.target.value);
                            }
                        }}
                        disabled={!enabled || !spindleTelemetry || telemetryEnv('statusPollMs')}
                        className={styles['port-input']}
                        placeholder={i18n._('key-App/Settings/McpServer-off')}
                    />
                    <span className="margin-left-8">
                        {status && status.spindleTelemetry && status.spindleTelemetry.statusPollRange ? `${status.spindleTelemetry.statusPollRange[0]}-${status.spindleTelemetry.statusPollRange[1]}; ` : ''}
                        {i18n._('key-App/Settings/McpServer-empty = the 2 s heartbeat only. Each poll is one /api/v1/status round trip (~25 ms, ~400 bytes) during file jobs only.')}
                        {telemetryEnvNote('statusPollMs')}
                    </span>
                </div>
                <div className="sm-flex align-center margin-top-8">
                    <Switch checked={spindleAudio} onChange={(checked) => setSpindleAudio(checked)} disabled={!enabled || !spindleTelemetry || telemetryEnv('audioEnabled')} />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Record a microphone (RPM tracking, chatter, runout; FLAC under the app data dir)')}{telemetryEnvNote('audioEnabled')}</span>
                </div>
                <div className="sm-flex align-center margin-top-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Capture device')}</span>
                    <Select
                        style={{ minWidth: 360 }}
                        value={spindleAudioDevice || undefined}
                        onChange={(value) => setSpindleAudioDevice(value ? String(value) : '')}
                        allowClear
                        showSearch
                        disabled={!enabled || telemetryEnv('audioDevice')}
                        placeholder={i18n._('key-App/Settings/McpServer-Choose a microphone by name - nothing is picked for you')}
                        options={(status && status.spindleTelemetry ? status.spindleTelemetry.devices : []).map((device) => ({
                            value: device.entry,
                            label: `${device.description} — ${device.entry}${device.builtIn ? ` (${i18n._('key-App/Settings/McpServer-built-in')})` : ''}${device.usb ? ' (USB)' : ''}`,
                        }))}
                    />
                    <span className="margin-left-8">{telemetryEnvNote('audioDevice')}</span>
                </div>
                <div className={styles['port-tips']}>
                    {status && status.spindleTelemetry ? status.spindleTelemetry.guidance : ''}
                    {status && status.spindleTelemetry && status.spindleTelemetry.audioDevice ? ` ${i18n._('key-App/Settings/McpServer-Configured device')}: ${status.spindleTelemetry.resolution}.` : ''}
                </div>
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>{i18n._('key-App/Settings/McpServer-Diagnostic buffers')}</span>
            </div>
            <div className="margin-top-8">
                <div className={styles['port-tips']}>
                    {i18n._('key-App/Settings/McpServer-Long procedures (surface scans, bed surveys) write several events per step; raise the job event limit so the whole record survives. Applies immediately; empty = default (2000, or 200000 with spindle telemetry on).')}
                </div>
                <div className="sm-flex align-center margin-top-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Job event log (events kept per job)')}</span>
                    <Input
                        value={jobEventLimit}
                        onChange={(e) => {
                            if (/^\d*$/.test(e.target.value)) {
                                setJobEventLimit(e.target.value);
                            }
                        }}
                        disabled={!enabled || !!(status && status.buffers && status.buffers.jobEventLimitSource === 'env')}
                        className={styles['port-input']}
                        placeholder={status && status.buffers ? String(status.buffers.jobEventLimit) : '2000'}
                    />
                    <span className="margin-left-8">
                        {status && status.buffers ? `${status.buffers.jobEventLimitRange[0]}-${status.buffers.jobEventLimitRange[1]}` : ''}
                        {status && status.buffers && status.buffers.jobEventLimitSource === 'env' ? ` — ${i18n._('key-App/Settings/McpServer-Overridden by environment variable')} LUBAN_MCP_JOB_EVENT_LIMIT` : ''}
                    </span>
                </div>
                <div className="sm-flex align-center margin-top-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Recent timing records (per diagnostics list)')}</span>
                    <Input
                        value={diagnosticsRecentLimit}
                        onChange={(e) => {
                            if (/^\d*$/.test(e.target.value)) {
                                setDiagnosticsRecentLimit(e.target.value);
                            }
                        }}
                        disabled={!enabled || !!(status && status.buffers && status.buffers.diagnosticsRecentLimitSource === 'env')}
                        className={styles['port-input']}
                        placeholder={status && status.buffers ? String(status.buffers.diagnosticsRecentLimit) : '40'}
                    />
                    <span className="margin-left-8">
                        {status && status.buffers ? `${status.buffers.diagnosticsRecentLimitRange[0]}-${status.buffers.diagnosticsRecentLimitRange[1]}` : ''}
                        {status && status.buffers && status.buffers.diagnosticsRecentLimitSource === 'env' ? ` — ${i18n._('key-App/Settings/McpServer-Overridden by environment variable')} LUBAN_MCP_DIAGNOSTICS_RECENT_LIMIT` : ''}
                    </span>
                </div>
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>{i18n._('key-App/Settings/McpServer-Probe sensor feed')}</span>
            </div>
            <div className="margin-top-8">
                <div className="margin-bottom-8">
                    {i18n._('key-App/Settings/McpServer-External tool setter, overtravel and touch probe sensors report over this feed. Applies at the next feed connection.')}
                </div>
                <div className="sm-flex align-center margin-bottom-8">
                    <Switch checked={toolSetterEnabled} onChange={(checked) => setToolSetterEnabled(checked)} disabled={!enabled} />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Tool setter (contact + overtravel sensors)')}</span>
                    <Switch className="margin-left-16" checked={probeEnabled} onChange={(checked) => setProbeEnabled(checked)} disabled={!enabled} />
                    <span className="margin-left-8">{i18n._('key-App/Settings/McpServer-Touch probe')}</span>
                </div>
                <div className="margin-bottom-8">
                    {i18n._('key-App/Settings/McpServer-A disabled sensor is never bound: no pill, no readings, and procedures that need it refuse. If the USB sensor bridge is unplugged the feed just reports "not detected" and keeps retrying quietly - disable the sensors here when you know it will be absent.')}
                </div>
                <div className="sm-flex align-center margin-bottom-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Transport')}</span>
                    <Radio.Group
                        value={transport}
                        onChange={(e) => setTransport(e.target.value)}
                        disabled={!enabled || !!(status && status.transport && status.transport.envOverride)}
                    >
                        <Radio.Button value="">{i18n._('key-App/Settings/McpServer-Auto')}</Radio.Button>
                        <Radio.Button value="mqtt">MQTT</Radio.Button>
                        <Radio.Button value="gpio">GPIO</Radio.Button>
                    </Radio.Group>
                </div>
                {transportLine && <div className="margin-bottom-8">{transportLine}</div>}
                <div className="margin-bottom-8">
                    {i18n._('key-App/Settings/McpServer-Auto picks MQTT unless only the GPIO side is configured.')}
                </div>
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>{i18n._('key-App/Settings/McpServer-MQTT (Adafruit IO)')}</span>
            </div>
            <div className="margin-top-8">
                <div className="margin-bottom-8">
                    {i18n._('key-App/Settings/McpServer-Feed fields accept an Adafruit IO feed key or a full topic path.')}
                </div>
                {mqttEnvOverrides.length > 0 && (
                    <div className="margin-bottom-8">
                        {i18n._('key-App/Settings/McpServer-Overridden by environment variables:')} {mqttEnvOverrides.join(', ')}
                    </div>
                )}
                {MQTT_FIELDS.map((field) => {
                    let placeholder = field.placeholder || '';
                    if (field.name === 'clientId' && status) {
                        placeholder = status.mqtt.defaultClientId;
                    }
                    return (
                        <div className="sm-flex align-center margin-bottom-8" key={field.name}>
                            <span style={LABEL_STYLE}>{i18n._(field.labelKey)}</span>
                            <Input
                                value={mqtt[field.name] || ''}
                                placeholder={placeholder}
                                onChange={(e) => setMqtt({ ...mqtt, [field.name]: e.target.value })}
                                disabled={!enabled}
                            />
                            {field.channel && renderInvertedSwitch(
                                !!inverted[field.channel],
                                (checked) => setInverted({ ...inverted, [field.channel]: checked })
                            )}
                        </div>
                    );
                })}
                <div className="sm-flex align-center margin-bottom-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-MQTT password / key')}</span>
                    <Input.Password
                        value={mqttPass}
                        placeholder={status && status.mqtt.passSet
                            ? i18n._('key-App/Settings/McpServer-(saved - leave blank to keep)')
                            : ''}
                        onChange={(e) => {
                            setMqttPass(e.target.value);
                            setMqttPassTouched(true);
                        }}
                        disabled={!enabled}
                    />
                </div>
            </div>

            <div className="border-bottom-normal padding-bottom-4 margin-top-16">
                <span>{i18n._('key-App/Settings/McpServer-GPIO (Adafruit Blinka / U2IF)')}</span>
            </div>
            <div className="margin-top-8">
                <div className="margin-bottom-8">
                    {i18n._('key-App/Settings/McpServer-Sensors wired to pins of a Blinka board - by default a U2IF USB bridge (Pico / KB2040). Pin = Blinka pin name with an optional :up / :down / :float pull suffix. Python = an interpreter with adafruit-blinka installed (the venv from requirements.txt).')}
                </div>
                {gpioEnvOverrides.length > 0 && (
                    <div className="margin-bottom-8">
                        {i18n._('key-App/Settings/McpServer-Overridden by environment variables:')} {gpioEnvOverrides.join(', ')}
                    </div>
                )}
                {status && status.gpio && !status.gpio.configured && (
                    <div className="margin-bottom-8">
                        {i18n._('key-App/Settings/McpServer-Not configured - missing:')} {status.gpio.missing.join('; ')}
                    </div>
                )}
                {GPIO_PIN_FIELDS.map((field) => (
                    <div className="sm-flex align-center margin-bottom-8" key={field.name}>
                        <span style={LABEL_STYLE}>{i18n._(field.labelKey)}</span>
                        <Input
                            value={gpio[field.name] || ''}
                            placeholder={field.placeholder}
                            onChange={(e) => setGpio({ ...gpio, [field.name]: e.target.value })}
                            disabled={!enabled}
                        />
                        {renderInvertedSwitch(
                            !!gpioInverted[field.channel],
                            (checked) => setGpioInverted({ ...gpioInverted, [field.channel]: checked })
                        )}
                    </div>
                ))}
                <div className="sm-flex align-center margin-bottom-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Python interpreter')}</span>
                    <Input
                        value={gpio.python || ''}
                        placeholder={status && status.gpio ? status.gpio.defaultPython : 'python3'}
                        onChange={(e) => setGpio({ ...gpio, python: e.target.value })}
                        disabled={!enabled}
                    />
                </div>
                <div className="sm-flex align-center margin-bottom-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Poll interval (ms)')}</span>
                    <Input
                        value={gpio.pollMs || ''}
                        placeholder="10"
                        onChange={(e) => {
                            if (/^\d*$/.test(e.target.value)) {
                                setGpio({ ...gpio, pollMs: e.target.value });
                            }
                        }}
                        disabled={!enabled}
                    />
                </div>
                <div className="sm-flex align-center margin-bottom-8">
                    <span style={LABEL_STYLE}>{i18n._('key-App/Settings/McpServer-Blinka environment')}</span>
                    <Input
                        value={gpio.blinkaEnv || ''}
                        placeholder={status && status.gpio ? status.gpio.defaultBlinkaEnv : 'BLINKA_U2IF=1'}
                        onChange={(e) => setGpio({ ...gpio, blinkaEnv: e.target.value })}
                        disabled={!enabled}
                    />
                </div>
                <div className="margin-bottom-8">
                    {i18n._('key-App/Settings/McpServer-NAME=VALUE pairs handed to the monitor so Blinka picks the board: BLINKA_U2IF=1 (default: Pico / KB2040 U2IF bridge), BLINKA_MCP2221=1, BLINKA_FT232H=1, BLINKA_FORCEBOARD=... - or "native" for on-board GPIO such as a Raspberry Pi header.')}
                </div>
            </div>
        </div>
    );
};

export default McpServer;
