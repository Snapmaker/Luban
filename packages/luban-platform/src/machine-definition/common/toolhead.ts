export enum ToolHeadType {
    Print = 'printing',
    Laser = 'laser',
    CNC = 'cnc',
}

export declare type ToolHeadMetadata = {
    headType: ToolHeadType;

    // Print specific
    numberOfExtruders?: number;

    supportCrosshair?: boolean;
};

export declare type ToolHead = {
    identifier: string;

    label: string;
    image: string;

    platform?: string[];
    metadata: ToolHeadMetadata;

    // legacy
    value?: string;
    pathname?: string;
};
