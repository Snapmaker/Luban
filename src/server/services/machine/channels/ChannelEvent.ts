

export enum ChannelEvent {
    // channel connecting
    Connecting = 'connecting',

    // channel connected
    Connected = 'connected',

    /**
     * machine is ready
     * data: {
     *
     * }
     */
    Ready = 'ready',

    // channel disconnected
    Disconnected = 'disconnected',

    // error report from machine
    ErrorReport = 'error-report',

    // Upload file
    UploadFileProgress = 'upload-progress',
}
