import { EventEmitter } from 'events';

class Channel extends EventEmitter {
    /**
     * Start heartbeat.
     */
    public async startHeartbeat(): Promise<void> {
        return Promise.resolve();
    }
}


export default Channel;
