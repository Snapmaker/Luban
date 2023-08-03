import { EventEmitter } from 'events';

import SocketServer from '../../../lib/SocketManager';

class Channel extends EventEmitter {
    protected socket: SocketServer;

    public setSocket(socket: SocketServer): void {
        this.socket = socket;
    }

    /**
     * Connection open.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async connectionOpen(options?: object): Promise<boolean> {
        return false;
    }

    /**
     * Start heartbeat.
     */
    public async startHeartbeat(): Promise<void> {
        return Promise.resolve();
    }
}


export default Channel;
