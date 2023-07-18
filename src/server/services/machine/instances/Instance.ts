
class MachineInstance {
    protected channel;
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

    public onMachineReady(): void {
        // TODO
    }
}

export default MachineInstance;


