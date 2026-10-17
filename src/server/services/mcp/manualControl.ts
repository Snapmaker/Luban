// Pure ownership gate: manual USB input and MCP mutations cannot overlap.
const READ_ONLY = /^(get_|list_|validate_)/;

/** True for tools that never mutate machine or job state (no ownership needed). */
export function isReadOnlyTool(name: string): boolean {
    return READ_ONLY.test(name);
}

export class ManualControlGate {
    private mutations = 0;

    private manual = false;

    private onStop: (() => void) | null = null;

    public enterTool(name: string): () => void {
        if (name === 'stop_gcode_job') {
            if (this.onStop) { this.onStop(); }
            return () => undefined;
        }
        if (READ_ONLY.test(name)) {
            return () => undefined;
        }
        if (this.manual) {
            throw new Error('USB pendant owns manual control. Disarm it on /pendant before an MCP mutation.');
        }
        this.mutations += 1;
        return () => { this.mutations -= 1; };
    }

    /** True while the USB pendant owns manual control. */
    public isManual(): boolean {
        return this.manual;
    }

    public acquire(onStop: () => void = () => undefined): void {
        if (this.manual || this.mutations) {
            throw new Error('Another manual session or MCP operation is active.');
        }
        this.manual = true;
        this.onStop = onStop;
    }

    public release(): void {
        this.manual = false;
        this.onStop = null;
    }
}

export const manualControlGate = new ManualControlGate();
