export enum SVGClippingType {
    Offset = 'offset',
    Background = 'background',
    Ringing = 'ringing',
    Union = 'union',
    Clip = 'clip',
}

export enum SVGClippingOperation {
    Separate = 'separate',
    Merged = 'merged'
}

export enum SVGClippingResultType {
    Add = 'add',
    Update = 'update',
    Delete = 'delete'
}

export interface SVGClipping {
    type: SVGClippingType,
    operation: SVGClippingOperation,
    offset: number
}

