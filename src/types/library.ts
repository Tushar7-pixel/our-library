export type MediaType = 'book' | 'movie' | 'song';
export type ShelfStatus = 'yet_to_read' | 'completed';
export type BookRating = 'best' | 'good' | 'avg' | 'okeyish' | 'do_not_read';

export interface CharacterRelation {
    fromCharId: string;
    toCharId: string;
    relationship: string;
}

export interface Character {
    id: string;
    name: string;
    role: string;
    opinion: string;
}

export interface LibraryItem {
    id: string;
    title: string;
    creator: string;
    status: ShelfStatus;
    mediaType: MediaType | 'book';
    coverId?: string;
    rating?: BookRating;
    series?: string;
    seriesOrder?: number;
    notes?: string;           // <-- Freeform random journal / reading notes
    characters?: Character[];
    relations?: CharacterRelation[];
}