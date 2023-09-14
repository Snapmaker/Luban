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
    workSpeedValue?: number,
    laserPower?: number,
    nozzleTemperatureValue?: number,
    heatedBedTemperatureValue?: number,
    zOffset?: number,
    headType?: string,
    uploadName?: string,
    isCameraCapture?: boolean,
    renderName?: string,
    renderGcodeFileName?: string, // for http connection type
    moveOrders?: object
};

export type ConnectedData = {
    toolHead?: string,
    series?: string,
    headType?: string,
    status?: string,
    isHomed?: boolean,
    moduleStatusList?: object,
    seriesSize?: string,
    isMoving?: boolean,
    err?: string
};

export type MarlinStateData = {
    status?: string, // for workflow status
    laserFocalLength?: number,
    laserPower?: number,
    nozzleTemperature?: number,
    nozzleTargetTemperature?: number,
    nozzleRightTemperature?: number,
    nozzleRightTargetTemperature?: number,
    heatedBedTemperature?: number,
    heatedBedTargetTemperature?: number,
    isEnclosureDoorOpen?: boolean,
    airPurifier?: boolean,
    airPurifierHasPower?: boolean,
    airPurifierSwitch?: boolean,
    airPurifierFanSpeed?: number,
    airPurifierFilterHealth?: number, // Filter lifetime
    isEmergencyStopped?: boolean,
    moduleStatusList?: object,
    laserCamera?: boolean,
    pos?: object,
    nozzleSizeList?: number [],
    originOffset?: object,
    isHomed?: boolean,
    headType?: string,
    toolHead?: string,
    currentWorkNozzle?: number,
    cncTargetSpindleSpeed?: number,
    cncCurrentSpindleSpeed?: number,
    laserTargetPower?: number,
    ledValue?: number,
    fanLevel?: number,
    isDoorEnable?: boolean
};

/**
 * Connection Type
 *
 * Type of connection, either via network or via serial port.
 */
export enum ConnectionType {
    Serial = 'serial',
    WiFi = 'wifi',
}
