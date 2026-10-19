import { Modal, message } from 'antd';
import React, { useEffect, useState } from 'react';

import api from '../../../../api';
import { controller } from '../../../../communication/socket-communication';
import i18n from '../../../../lib/i18n';

// Live pills for the MCP probe sensor feed (touch probe, tool setter contact,
// tool setter overtravel), shown beside the machine module badges as a visual
// test aid: press a sensor, watch its pill go red.
//   yellow - unknown: feed not connected, channel unbound, or no reading yet
//   green  - reading present and idle
//   red    - in contact / tripped, or the safety alarm is latched on it
// Seeded from GET /api/mcp (probeFeed snapshot), then driven by the server's
// mcp:activity events (tool 'probe_feed'), with a slow poll as reconciliation.

type Channel = 'toolsetter' | 'overtravel' | 'probe';

const CHANNELS: Array<{ channel: Channel; labelKey: string }> = [
    { channel: 'probe', labelKey: 'key-Workspace/Connection-probeTool' },
    { channel: 'toolsetter', labelKey: 'key-Workspace/Connection-toolSetter' },
    { channel: 'overtravel', labelKey: 'key-Workspace/Connection-toolSetterOvertravel' },
];

const COLORS = {
    unknown: '#FFA940',
    ok: '#4CB518',
    bad: '#FF4D4F',
};

const POLL_MS = 10000;

interface FeedSnapshot {
    configured: boolean;
    connected: boolean;
    transport: string;
    bound: { [channel in Channel]?: boolean };
    triggered: { [channel in Channel]?: boolean | null };
    alarmChannel: Channel | null;
}

interface ProbeFeedStatusBody {
    transport: string;
    configured: boolean;
    connected: boolean;
    feeds: { [channel: string]: { source: string | null; last: { triggered: boolean } | null } };
    safetyTrip: { channel: Channel } | null;
}

function snapshotFromStatus(body: ProbeFeedStatusBody | undefined): FeedSnapshot | null {
    if (!body) {
        return null;
    }
    const snapshot: FeedSnapshot = {
        configured: !!body.configured,
        connected: !!body.connected,
        transport: body.transport,
        bound: {},
        triggered: {},
        alarmChannel: body.safetyTrip ? body.safetyTrip.channel : null,
    };
    CHANNELS.forEach(({ channel }) => {
        const feed = body.feeds ? body.feeds[channel] : null;
        snapshot.bound[channel] = !!(feed && feed.source);
        snapshot.triggered[channel] = feed && feed.last ? !!feed.last.triggered : null;
    });
    return snapshot;
}

const ProbeFeedStatusBadges: React.FC = () => {
    const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(null);

    useEffect(() => {
        let alive = true;
        const load = () => {
            api.getMcpStatus()
                .then((res) => {
                    if (alive) {
                        setSnapshot(snapshotFromStatus((res as { body: { probeFeed?: ProbeFeedStatusBody } }).body.probeFeed));
                    }
                })
                .catch(() => undefined);
        };
        load();
        const timer = setInterval(load, POLL_MS);

        const onActivity = (options) => {
            const { tool, phase, channel, triggered } = options || {};
            if (tool !== 'probe_feed') {
                return;
            }
            setSnapshot((previous) => {
                if (!previous) {
                    return previous;
                }
                if (phase === 'reading' && channel) {
                    return { ...previous, connected: true, triggered: { ...previous.triggered, [channel]: !!triggered } };
                }
                if (phase === 'connected') {
                    return { ...previous, connected: true };
                }
                if (phase === 'disconnected') {
                    return { ...previous, connected: false, triggered: {} };
                }
                if (phase === 'OVERTRAVEL_ALARM' || phase === 'CRASH_ALARM') {
                    return { ...previous, alarmChannel: channel || previous.alarmChannel };
                }
                return previous;
            });
        };
        controller.on('mcp:activity', onActivity);

        return () => {
            alive = false;
            clearInterval(timer);
            controller.off('mcp:activity', onActivity);
        };
    }, []);

    if (!snapshot || !snapshot.configured) {
        return null;
    }
    const pills = CHANNELS.filter(({ channel }) => snapshot.bound[channel]);
    if (!pills.length) {
        return null;
    }

    // The operator's own click is the explicit word the safety model asks
    // for; the server still refuses while the sensor reads triggered.
    const confirmClearAlarm = () => {
        Modal.confirm({
            title: i18n._('key-Workspace/Connection-Clear the latched safety alarm?'),
            content: i18n._('key-Workspace/Connection-Only after you have physically inspected the machine. All MCP motion stays blocked until the alarm is cleared; the clear is refused while the sensor still reads triggered.'),
            okText: i18n._('key-Workspace/Connection-Clear alarm'),
            okType: 'danger',
            onOk: async () => api.clearMcpAlarm({ reason: 'operator clicked Clear alarm on the Workspace connection panel' })
                .then((res) => {
                    const body = (res as { body: { cleared: boolean; probeFeed?: ProbeFeedStatusBody } }).body;
                    setSnapshot(snapshotFromStatus(body.probeFeed));
                    if (!body.cleared) {
                        message.info(i18n._('key-Workspace/Connection-No safety alarm was latched.'));
                    }
                })
                .catch((err) => {
                    const msg = err && err.response && err.response.body && err.response.body.msg;
                    message.error(`${i18n._('key-Workspace/Connection-Alarm not cleared:')} ${msg || err.message || err}`);
                }),
        });
    };

    return (
        <div className="sm-flex sm-flex-wrap">
            {pills.map(({ channel, labelKey }) => {
                let state: keyof typeof COLORS = 'unknown';
                let detail = i18n._('key-Workspace/Connection-Sensor unknown (feed not connected or no reading yet)');
                const latched = snapshot.alarmChannel === channel;
                if (latched) {
                    // The sensor may well be idle again; the LATCH is what is
                    // red. It survives reconnects on purpose - only the
                    // operator's explicit clear (clear_overtravel_alarm) or a
                    // restart releases it.
                    state = 'bad';
                    detail = i18n._('key-Workspace/Connection-Safety alarm latched - all motion blocked until the operator clears it (clear_overtravel_alarm) or Luban restarts');
                } else if (snapshot.connected && snapshot.triggered[channel] === true) {
                    state = 'bad';
                    detail = i18n._('key-Workspace/Connection-Sensor in contact');
                } else if (snapshot.connected && snapshot.triggered[channel] === false) {
                    state = 'ok';
                    detail = i18n._('key-Workspace/Connection-Sensor idle');
                }
                return (
                    <div
                        key={channel}
                        className="sm-flex align-center padding-horizontal-8 background-grey-3 border-radius-12 margin-top-8 margin-right-8"
                        title={`${detail} (${snapshot.transport})`}
                    >
                        <span className="margin-right-8 tooltip-message height-24">{i18n._(labelKey)}</span>
                        <span
                            style={{
                                display: 'inline-block',
                                backgroundColor: COLORS[state],
                                height: 6,
                                width: 6,
                                borderRadius: 3,
                            }}
                        />
                        {latched && (
                            <>
                                <span className="margin-left-4" style={{ color: COLORS.bad, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {i18n._('key-Workspace/Connection-ALARM')}
                                </span>
                                <button
                                    type="button"
                                    className="margin-left-8"
                                    onClick={confirmClearAlarm}
                                    style={{
                                        border: `1px solid ${COLORS.bad}`,
                                        color: COLORS.bad,
                                        background: 'transparent',
                                        borderRadius: 10,
                                        padding: '0 8px',
                                        height: 18,
                                        lineHeight: '16px',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {i18n._('key-Workspace/Connection-Clear alarm')}
                                </button>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ProbeFeedStatusBadges;
