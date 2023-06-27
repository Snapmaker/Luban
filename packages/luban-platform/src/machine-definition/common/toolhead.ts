export enum ToolHeadType {
    Print = 'printing',
    Laser = 'laser',
    CNC = 'cnc',
}

export declare type ToolHeadMetadata = {
    headType: ToolHeadType;

    // Print specific
    numberOfExtruders?: number;
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
