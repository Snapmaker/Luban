import events from 'events';

// Workflow State
export const WORKFLOW_STATE_RUNNING = 'running';
export const WORKFLOW_STATE_PAUSED = 'paused';
export const WORKFLOW_STATE_IDLE = 'idle';

class Workflow extends events.EventEmitter {
    state = WORKFLOW_STATE_IDLE;

    isIdle() {
        return this.state === WORKFLOW_STATE_IDLE;
    }

    isRunning() {
        return this.state === WORKFLOW_STATE_RUNNING;
    }

    isPaused() {
        return this.state === WORKFLOW_STATE_PAUSED;
    }

    start() {
        if (this.state !== WORKFLOW_STATE_RUNNING) {
            this.state = WORKFLOW_STATE_RUNNING;
            this.emit('start');
        }
    }

    pause() {
        if (this.state === WORKFLOW_STATE_RUNNING) {
            this.state = WORKFLOW_STATE_PAUSED;
            this.emit('pause');
        }
    }

    resume() {
        if (this.state === WORKFLOW_STATE_PAUSED) {
            this.state = WORKFLOW_STATE_RUNNING;
            this.emit('resume');
        }
    }

    stop() {
        if (this.state !== WORKFLOW_STATE_IDLE) {
            this.state = WORKFLOW_STATE_IDLE;
            this.emit('stop');
        }
    }
}

export default Workflow;
