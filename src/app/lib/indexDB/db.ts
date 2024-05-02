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

export const db = new Dexie('snapmakerDatabase');

db.version(1).stores({
    downloadRecords: '++id, [startTime+savePath], downloadUrl'
});

export const downloadRecords: Table<downloadRecord> = db.table('downloadRecords');
