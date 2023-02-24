import { PrintMode } from './common/print-base';

declare type MachinePrintMode = {
    mode: PrintMode;
};

export declare type MachineMetadata = {
    slicerVersion: number;
    printModes?: MachinePrintMode[];
};

export declare type Machine = {
    identifier: string; // unique identifier

    fullName: string;
    machineType: string; // 3D Printer

    // local path to machine image
    img: string;

    metadata: MachineMetadata;
};


export { PrintMode };
