import { PrintMode } from './print-base';

/**
 * 3D Printer or multi-function printer.
 */
export enum MachineType {
    MultiFuncionPrinter = 'Multi-function 3D Printer',
    Printer = '3D Printer',
    Laser = 'Laser',
}

export enum MachineGcodeFlavor {
    MARLIN = 'marlin',
    GRBL = 'grbl'
}

interface WorkRange {
    min: number[];
    max: number[];
}

declare type MachinePrintMode = {
    mode: PrintMode;
    workRange: WorkRange;
};

export declare type MachineToolHeadOptions = {
    identifier: string;

    // tool head specific config path
    configPath?: string;

    // tool head size may affect work range
    workRange?: WorkRange;

    goHomeOnConnection?: boolean;

    supportCameraCapture?: boolean;

    // Allow start print remotely, defaults to false
    disableRemoteStartPrint?: boolean;
};

export declare type MachineModuleOptions = {
    identifier: string;

    workRangeOffset?: number[];
};


export declare type MachineMetadata = {
    // Work range in default print mode
    size: { x: number; y: number; z: number };

    toolHeads: MachineToolHeadOptions[];

    modules?: MachineModuleOptions[];

    printModes?: MachinePrintMode[];

    // slicer version
    slicerVersion: number;

    gcodeFlavor?: MachineGcodeFlavor;
};

export declare type LaserMachineMetadata = {
    size: { x: number; y: number; z: number };

    toolHeads: MachineToolHeadOptions[];

    modules?: MachineModuleOptions[];

    // by default, Luban can control the machine's workflow, but for machines
    // like Ray, you will need to use lock button on the machine to
    // start/stop/pause/resume the machine.
    disableWorkflowControl?: boolean;

    serialPortBaudRate?: number;
}


/**
 * Machine Definition.
 */
export declare type Machine = {
    identifier: string; // unique identifier

    fullName: string;
    machineType: MachineType; // 3D Printer

    // local path to machine image
    img: string;

    metadata: MachineMetadata | LaserMachineMetadata;

    // legacy attributes:
    series?: string;
    seriesLabel?: string;
    label?: string;
};
