import Dexie, { Table } from 'dexie';
import { LibraryItem } from '@/types/library';

export interface FollowedFriend {
    shareCode: string;       // e.g. "alex-reads"
    friendName: string;      // e.g. "Alex"
    lastSyncedAt: string;
    books: LibraryItem[];    // Friend's entire shelf saved locally
}

export class LocalLibraryDatabase extends Dexie {
    books!: Table<LibraryItem, string>;
    friends!: Table<FollowedFriend, string>;

    constructor() {
        super('EreaderLibraryDB');
        this.version(2).stores({
            books: 'id, title, creator, status, series, rating',
            friends: 'shareCode, friendName, lastSyncedAt'
        });
    }
}

export const db = new LocalLibraryDatabase();
// 1. Export all local books & notes to a downloadable .json file
export async function exportLocalBackup() {
    const allBooks = await db.books.toArray();
    const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        library: allBooks
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `library-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 2. Import backup .json file and restore to IndexedDB
export async function importLocalBackup(file: File): Promise<number> {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed.library || !Array.isArray(parsed.library)) {
        throw new Error('Invalid backup file format.');
    }

    // Clear or bulk put
    await db.books.bulkPut(parsed.library);
    return parsed.library.length;
}