export enum RecordState {
    Progressing = 'progressing',
    Completed = 'completed',
    Cancelled = 'cancelled',
    Interrupted = 'interrupted',
}

export const BYTE: number = 1;
export const KB: number = 1024 * BYTE;
export const MB: number = 1024 * KB;

export enum DetailModalState {
    Close = -1,
    Reset = -2,
}

export const ModelFileExt = {
    stl: '.stl',
    obj: '.obj',
    '3mf': '.3mf',
    amf: '.amf',
};

export const ProjectFileExt = {
    snap3dp: '.snap3dp',
};

export const resourcesDomain = 'https://resources.snapmaker.com';

export const IMG_RESOURCE_BASE_URL = 'https://d3gw8b56b7j3w6.cloudfront.net/';

export enum AccessResourceWebState {
    INITIAL,
    PASS,
    BLOCKED,
}
