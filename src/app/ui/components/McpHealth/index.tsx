import React, { useEffect, useRef, useState } from 'react';

import { McpHealth, McpHealthChanges, McpHealthIssue } from '../../../../shared/lib/mcpHealth';
import api from '../../../api';
import UniApi from '../../../lib/uni-api';
import { ToastContainer, toast } from '../Toast';

const POLL_MS = 5000;
const CONTAINER_ID = 'mcp-health';

/** Poll Luban's main API, not either MCP port; a broken listener must remain reportable. */
function useMcpHealth(): McpHealth | null {
    const [health, setHealth] = useState<McpHealth | null>(null);
    useEffect(() => {
        let alive = true;
        let timer: ReturnType<typeof setTimeout>;
        let previous: McpHealth | null = null;
        let failures = 0;
        const poll = async () => {
            try {
                const response = await api.getMcpHealth() as { body: McpHealth };
                if (!alive) { return; }
                previous = response.body;
                failures = 0;
                setHealth(previous);
            } catch (err) {
                failures += 1;
                // Do not claim MCP is broken before learning it was enabled.
                // Preserve known issues while the status API is unavailable.
                if (alive && previous?.enabled && failures >= 2) {
                    setHealth({ enabled: true,
                        issues: [...previous.issues, {
                            id: 'health-unavailable',
                            title: 'MCP health status is unavailable',
                            message: 'Luban cannot read MCP health. Displayed problems may be stale; checks will retry automatically.',
                            severity: 'warning',
                        }] });
                }
            } finally {
                if (alive) { timer = setTimeout(poll, POLL_MS); }
            }
        };
        poll();
        return () => { alive = false; clearTimeout(timer); };
    }, []);
    return health;
}

function IssueContent({ issue }: { issue: McpHealthIssue }) {
    return (
        <div className="mcp-health-notice">
            <strong>{issue.title}</strong>
            <p className="mcp-health-notice-message">{issue.message}</p>
            <div className="mcp-health-notice-actions">
                <button type="button" onClick={() => UniApi.Event.emit('appbar-menu:preferences.show', { activeTab: 'mcp' })}>
                    Open MCP Settings
                </button>
                <button type="button" onClick={() => toast.dismiss(`mcp-health-${issue.id}`)}>Dismiss</button>
            </div>
        </div>
    );
}

/** Mounted once in the app shell, so Home and other routes receive the same alerts. */
export const McpHealthNotifications: React.FC = () => {
    const health = useMcpHealth();
    const changes = useRef(new McpHealthChanges());
    useEffect(() => {
        if (!health) { return; }
        const delta = changes.current.update(health);
        for (const issue of delta.added) {
            toast(<IssueContent issue={issue} />, {
                containerId: CONTAINER_ID, toastId: `mcp-health-${issue.id}`, type: issue.severity, autoClose: false, closeOnClick: false,
            });
        }
        for (const issue of delta.updated) {
            const id = `mcp-health-${issue.id}`;
            if (toast.isActive(id)) {
                toast.update(id, { render: <IssueContent issue={issue} />, type: issue.severity });
            }
        }
        for (const issue of delta.removed) { toast.dismiss(`mcp-health-${issue.id}`); }
        for (const issue of delta.recovered) {
            toast.success(`MCP issue cleared: ${issue.title}`, { containerId: CONTAINER_ID, autoClose: 5000 });
        }
    }, [health]);
    useEffect(() => () => {
        for (const issue of changes.current.update({ enabled: false, issues: [] }).removed) {
            toast.dismiss(`mcp-health-${issue.id}`);
        }
    }, []);
    return (
        <ToastContainer
            enableMultiContainer
            containerId={CONTAINER_ID}
            className="mcp-health-notifications"
            position="top-center"
            autoClose={false}
            hideProgressBar
            closeOnClick={false}
            draggable={false}
        />
    );
};

/** Dismissing a toast never hides the current fault from Settings. */
export const McpHealthPanel: React.FC = () => {
    const health = useMcpHealth();
    return (
        <section aria-label="MCP service health" className="margin-top-16">
            <strong>MCP service health</strong>
            {!health && <p>Checking service health…</p>}
            {health && !health.enabled && <p>MCP is disabled. Health alerts are off.</p>}
            {health?.enabled && !health.issues.length && <p>No MCP service problems reported.</p>}
            {health?.enabled && health.issues.map((issue) => (
                <div key={issue.id} style={{ borderLeft: `3px solid ${issue.severity === 'error' ? '#FF4D4F' : '#FAAD14'}`, paddingLeft: 12 }}>
                    <strong>{issue.title}</strong>
                    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{issue.message}</p>
                </div>
            ))}
        </section>
    );
};
