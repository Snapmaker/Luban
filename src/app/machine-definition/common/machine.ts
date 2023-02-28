import { PrintMode } from './print-base';

/**
 * 3D Printer or multi-function printer.
 */
export enum MachineType {
    Printer = '3D Printer',
    MultiFuncionPrinter = 'Multi-function 3D Printer',
}

interface WorkRange {
    min: number[];
    max: number[];
}

declare type MachinePrintMode = {
    mode: PrintMode;
    workRange: WorkRange;
};

declare type MachineToolHeadOptions = {
    identifier: string;

    // tool head specific config path
    configPath?: string;

    // tool head size may affect work range
    workRange?: WorkRange;
};


export declare type MachineMetadata = {
    // Work range in default print mode
    size: { x: number; y: number; z: number };

    toolHeads: MachineToolHeadOptions[];

    printModes?: MachinePrintMode[];

    // slicer version
    slicerVersion: number;
};


export declare type Machine = {
    identifier: string; // unique identifier

    fullName: string;
    machineType: MachineType; // 3D Printer

    // local path to machine image
    img: string;

    metadata: MachineMetadata;

    // legacy attributes:
    series?: string;
    seriesLabel?: string;
    seriesLabelWithoutI18n?: string;
    label?: string;
};
