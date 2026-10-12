import LZString from 'lz-string';
import { db, FollowedFriend } from './db';
import { LibraryItem } from '@/types/library';

// Generates an instant share link with compressed data in the hash (No server/DB needed)
export async function pushMyShelfToServer(shareCode: string, ownerName: string): Promise<string> {
    const books = await db.books.toArray();
    const payload = LZString.compressToEncodedURIComponent(JSON.stringify({
        owner: ownerName,
        code: shareCode,
        books
    }));
    return payload;
}

// Imports the data directly from the hash
export async function syncFriendLibrary(payload: string): Promise<FollowedFriend> {
    const decompressed = LZString.decompressFromEncodedURIComponent(payload);
    if (!decompressed) throw new Error("Invalid or corrupted share link.");

    const data = JSON.parse(decompressed);
    const friendRecord: FollowedFriend = {
        shareCode: data.code || 'friend-shelf',
        friendName: data.owner || 'Friend',
        lastSyncedAt: new Date().toISOString(),
        books: data.books || []
    };

    await db.friends.put(friendRecord);
    return friendRecord;
}