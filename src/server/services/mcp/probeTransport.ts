// Shared vocabulary of the external probe sensor feed, in its own module so
// the orchestrator (probeFeed.ts) and the transport backends (MQTT in
// probeFeed.ts, Blinka GPIO in gpioFeed.ts) can all import it without cycles.

export type ProbeChannel = 'toolsetter' | 'overtravel' | 'probe';

export const PROBE_CHANNELS: ProbeChannel[] = ['toolsetter', 'overtravel', 'probe'];

export type ProbeTransportKind = 'mqtt' | 'gpio';

/**
 * A probe feed transport delivers raw sensor values per channel; the
 * ProbeFeedService owns everything downstream (polarity, the reading cache,
 * the overtravel/crash latch, reconnection). Implementations extend
 * EventEmitter and emit:
 *
 *   'reading' (channel: ProbeChannel, value: string, meta?: ReadingMeta) - the sensor CHANGED
 *             (meta.sentAt: the transport's own wall-clock ms at detection, when it has one,
 *             so the server can measure pipe latency)
 *   'refresh' (channel: ProbeChannel, value: string) - polled, unchanged
 *             (freshness only; MQTT never emits it, polling GPIO does)
 *   'error'   (err: Error)  - after connect() resolved; connect failures reject
 *   'close'   ()            - the transport is dead; the service reconnects
 *
 * A closed transport is not reusable - the service builds a new one from
 * freshly resolved configuration on every (re)connect.
 */
/** Optional per-reading timing from a transport that stamps its readings. */
export interface ReadingMeta {
    /** Wall-clock ms (same host clock) when the transport detected the change. */
    sentAt?: number;
}

export interface ProbeTransport {
    connect(): Promise<void>;
    end(): void;
    isConnected(): boolean;
    /** Transport-specific fields merged into get_probe_feed_status. */
    describe(): object;
    on(event: 'reading', listener: (channel: ProbeChannel, value: string, meta?: ReadingMeta) => void): this;
    on(event: 'refresh', listener: (channel: ProbeChannel, value: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'close', listener: () => void): this;
}
