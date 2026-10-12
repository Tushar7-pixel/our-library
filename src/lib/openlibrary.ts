export interface SearchResult {
    title: string;
    author: string;
    coverId?: string;
}

export async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=title,author_name,cover_i`
    );
    if (!res.ok) return [];
    const data = await res.json();

    return data.docs.map((doc: any) => ({
        title: doc.title,
        author: doc.author_name?.[0] || 'Unknown Author',
        coverId: doc.cover_i ? String(doc.cover_i) : undefined,
    }));
}

export function getCoverUrl(coverId?: string): string {
    if (!coverId) return 'https://placehold.co/120x180/e8e5dc/777?text=No+Cover';
    return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
}