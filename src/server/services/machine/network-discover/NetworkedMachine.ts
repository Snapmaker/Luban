export interface NetworkedMachineInfo {
    name: string;
    address: string; // IP address
    lastSeen: number; // timestamp
    model?: string; // indicates which machine model it is
    protocol?: string; // indicates which protocol it uses
}

export interface MachineFinder {
    list(): Promise<NetworkedMachineInfo[]>;
}
