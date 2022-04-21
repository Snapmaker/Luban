export type EventOptions = {
    address?: string, // only for TCP connection
    eventName: string,
    host?: string,
    token?: string,
    gcode?: string,
    x?: number,
    y?: number,
    feedRate?: number,
    gcodePath?: string,
    value?: number,
    enable?: boolean,
    workSpeedFactor?: number,
    laserPower?: number,
    nozzleTemperatureValue?: number,
    heatedBedTemperatureValue?: number,
    zOffset?: number,
    headType?: string,
    uploadName?: string,
    renderGcodeFileName?: string
};
