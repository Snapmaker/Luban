enum WorkflowStatus {
    Unknown = 'unknown',
    Idle = 'idle',

    // job
    Starting = 'starting',
    Running = 'running',
    Pausing = 'pausing',
    Paused = 'paused',
    Stopping = 'stopping',
    Stopped = 'stopped',
    Finishing = 'finishing',
    Completed = 'completed',

    /**
     * recovering job from power-outage
     */
    Recovering = 'recovering',

    /**
     * resuming job from paused state
     */
    Resuming = 'resuming',
}

export {
    WorkflowStatus,
};
