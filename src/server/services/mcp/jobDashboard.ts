import type http from 'http';
import type { JobManager } from './jobs';
import { dashboardHtml, notificationWorker } from './jobDashboardPage';
import type { DashboardReview } from './jobDashboardState';

function reply(res: http.ServerResponse, status: number, body: unknown, type = 'application/json'): void {
    res.writeHead(status, {
        'Content-Type': `${type}; charset=utf-8`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
    });
    res.end(type.endsWith('json') ? JSON.stringify(body) : String(body));
}

const stopping = new Set<string>();

/** Caller applies the existing LAN/address + Origin trust boundary before routing here. */
export function handleJobDashboardRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    manager: JobManager,
    stop: (id: string) => Promise<object>,
    /** The CA trust page (plain HTTP) when HTTPS is configured, else null (#218). */
    trust: () => { url: string } | null = () => null,
    /** Operator review pages (/confirm/r<id>) for the feed, already summarized (jobDashboardState.dashboardReviews). */
    reviews: () => DashboardReview[] = () => []
): void {
    if (req.method === 'GET') {
        if (url.pathname === '/' || url.pathname === '/jobs' || url.pathname === '/jobs/') {
            reply(res, 200, dashboardHtml, 'text/html');
            return;
        }
        if (url.pathname === '/jobs/manifest.webmanifest') {
            reply(res, 200, {
                name: 'Luban jobs',
                short_name: 'Luban jobs',
                start_url: '/jobs/',
                scope: '/jobs/',
                display: 'standalone',
                background_color: '#10151d',
                theme_color: '#10151d',
                icons: [{ src: '/jobs/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            }, 'application/manifest+json');
            return;
        }
        if (url.pathname === '/jobs/icon.svg') {
            reply(res, 200, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="36" fill="#10151d"/><path d="M55 42v106h82v-24H81V42z" fill="#8fc7ff"/></svg>', 'image/svg+xml');
            return;
        }
        if (url.pathname === '/jobs/notifications.js') {
            reply(res, 200, notificationWorker, 'application/javascript');
            return;
        }
        if (url.pathname === '/jobs/status.json') {
            const raw = url.searchParams.get('since');
            const since = raw !== null && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
            reply(res, 200, {
                jobs: manager.dashboardJobs(),
                activeId: manager.getActive()?.id || null,
                trust: trust(),
                reviews: reviews(),
                ...manager.dashboardFeed.read(since, url.searchParams.get('instance')),
            });
            return;
        }
        const detail = url.pathname.match(/^\/jobs\/([0-9a-f]+)\.json$/);
        if (detail) {
            const job = manager.get(detail[1]);
            reply(res, job ? 200 : 404, job ? {
                job: manager.describe(job), events: job.events.slice(-100),
            } : { error: 'Unknown or expired job.' });
            return;
        }
    }
    const action = url.pathname.match(/^\/jobs\/([0-9a-f]+)\/(stop|dismiss)$/);
    if (req.method === 'POST' && action) {
        // A custom header prevents cross-origin HTML forms from issuing commands.
        // Do not enable CORS here. The index.ts origin/address gate still applies.
        if (req.headers['x-luban-job-action'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site') {
            reply(res, 403, { error: 'Use the job dashboard to request this action.' });
            return;
        }
        const job = manager.get(action[1]);
        if (!job) {
            reply(res, 404, { error: 'Unknown or expired job.' });
            return;
        }
        const canDismiss = job.state === 'awaiting_confirmation' || job.state === 'approved';
        const canStop = manager.getActive() === job && (job.state === 'started' || job.state === 'starting' || job.state === 'start_unverified');
        if ((action[2] === 'dismiss' ? !canDismiss : !canStop) || stopping.has(job.id)) {
            reply(res, 409, { error: 'Job changed or a stop is already pending. Refresh and check its status.' });
            return;
        }
        stopping.add(job.id);
        stop(job.id).then((result) => reply(res, 200, result)).catch((error: Error) => {
            reply(res, 500, { error: error.message });
        }).finally(() => stopping.delete(job.id));
        return;
    }
    reply(res, req.method === 'GET' ? 404 : 405, { error: 'Unknown route or unsupported method.' });
}
