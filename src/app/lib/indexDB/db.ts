// db.ts
import Dexie, { Table } from 'dexie';

export interface downloadRecord {
    id?: number;
    // name: string;
    // age: number;

    savePath: string,
    // fileName: string,
    ext: string,
    name: string,
    fileNum: number,
    downloadUrl: string,
    startTime: Date,
    state: ('progressing' | 'completed' | 'cancelled' | 'interrupted'),
    paused: boolean,
    totalBytes: number,
    receivedBytes: number,
}

export class MySubClassedDexie extends Dexie {
    // 'friends' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    public downloadRecords!: Table<downloadRecord>;

    public constructor() {
        super('myDatabase');
        this.version(1).stores({
            downloadRecords: '++id, [startTime+savePath], downloadUrl' // Primary key and indexed props
        });
    }
}

export const db = new MySubClassedDexie();
