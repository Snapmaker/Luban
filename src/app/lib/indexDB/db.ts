// db.ts
import Dexie, { Table } from 'dexie';

type downloadRecordState = 'progressing' | 'completed' | 'cancelled' | 'interrupted';
export interface downloadRecord {
    id?: number;
    // name: string;
    // age: number;

    savePath: string;
    // fileName: string,
    ext: string;
    name: string;
    fileNum: number;
    downloadUrl: string;
    startTime: Date;
    state: downloadRecordState;
    paused: boolean;
    totalBytes: number;
    receivedBytes: number;
}

export class MySubClassedDexie extends Dexie {
    public downloadRecords!: Table<downloadRecord>;

    public constructor() {
        super('snapmakerDatabase');
        this.version(1).stores({
            downloadRecords: '++id, [startTime+savePath], downloadUrl', // Primary key and indexed props
        });
    }
}

export const db = new MySubClassedDexie();
