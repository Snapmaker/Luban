import Channel from '../channels/Channel';

class MachineInstance {
    protected channel: Channel;
    protected socket;

    // state
    private isReady: boolean = false;

    public constructor() {
        this.isReady = false;
    }

    public setChannel(channel): void {
        this.channel = channel;
    }

    public setSocket(socket): void {
        this.socket = socket;
    }

    public isMachineReady(): boolean {
        return this.isReady;
    }

    /**
     * Time for preparing machine initial state, start heartbeat, etc.
     */
    public async onPrepare(): Promise<void> {
        // TODO
    }

    /**
     * Before closing, time to unsubscribe.
     */
    public async onClosing(): Promise<void> {
        // TODO
    }

    /**
     * connection closed, thus channel is disconnected as well.
     */
    public async onClosed(): Promise<void> {
        // TODO
    }
}

export default MachineInstance;


