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
