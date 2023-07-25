import events from 'events';

// Workflow State
export const WORKFLOW_STATUS_RUNNING = 'running';
export const WORKFLOW_STATUS_PAUSED = 'paused';
export const WORKFLOW_STATUS_IDLE = 'idle';

class Workflow extends events.EventEmitter {
    state = WORKFLOW_STATUS_IDLE;

    isIdle() {
        return this.state === WORKFLOW_STATUS_IDLE;
    }

    isRunning() {
        return this.state === WORKFLOW_STATUS_RUNNING;
    }

    isPaused() {
        return this.state === WORKFLOW_STATUS_PAUSED;
    }

    start() {
        if (this.state !== WORKFLOW_STATUS_RUNNING) {
            this.state = WORKFLOW_STATUS_RUNNING;
            this.emit('start');
        }
    }

    pause() {
        if (this.state === WORKFLOW_STATUS_RUNNING) {
            this.state = WORKFLOW_STATUS_PAUSED;
            this.emit('pause');
        }
    }

    resume() {
        if (this.state === WORKFLOW_STATUS_PAUSED) {
            this.state = WORKFLOW_STATUS_RUNNING;
            this.emit('resume');
        }
    }

    stop() {
        if (this.state !== WORKFLOW_STATUS_IDLE) {
            this.state = WORKFLOW_STATUS_IDLE;
            this.emit('stop');
        }
    }
}

export default Workflow;
