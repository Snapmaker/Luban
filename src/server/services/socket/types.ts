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
    renderGcodeFileName?: string,
    moveOrders?: object
};

export type ConnectedData = {
    toolHead?: string,
    series?: string,
    headType?: string,
    status?: string,
    isHomed?: boolean,
    moduleStatusList?: object,
    seriesSize?: string
};

export type MarlinStateData = {
    status?: string, // for workflow status
    laserFocalLength?: number,
    laserPower?: number,
    nozzleStatus?: number,
    nozzleRightStatus?: number
    nozzleTemperature?: number,
    nozzleTargetTemperature?: number,
    nozzleRightTemperature?: number,
    nozzleRightTargetTemperature?: number,
    heatedBedTemperature?: number,
    heatedBedTargetTemperature?: number,
    isEnclosureDoorOpen?: boolean,
    airPurifier?: boolean,
    airPurifierSwitch?: boolean,
    airPurifierFanSpeed?: number,
    airPurifierFilterHealth?: number, // Filter lifetime
    isEmergencyStopped?: boolean,
    moduleStatusList?: object,
    laserCamera?: boolean,
    pos?: object,
    originOffset?: object,
    cncCurrentSpindleSpeed?: number,
    cncTargetSpindleSpeed?: number,
    currentWorkNozzle?: string,
};
