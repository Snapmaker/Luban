export declare interface MachineState {
    machineIdentifier: string;
    machineSize: { x: number; y: number; z: number };
}

export declare interface MachineStateUpdateOptions {
    machineIdentifier?: string;
    machineSize?: { x: number; y: number; z: number };
}
