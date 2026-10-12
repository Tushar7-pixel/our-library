"use client";

import { useState, useMemo, useEffect } from "react";
import { LibraryItem, ShelfStatus, BookRating } from "@/types/library";
import {
  getCoverUrl,
  searchOpenLibrary,
  SearchResult,
} from "@/lib/openlibrary";
import { CharacterModal } from "@/components/CharacterModal";
import {
  Plus,
  Trash2,
  Check,
  LayoutGrid,
  List,
  FolderArchive,
  ChevronRight,
  BookOpen,
  UserCheck,
  Download,
  Upload,
  Share2,
  CloudUpload,
  RefreshCw,
  Library,
  UserPlus,
} from "lucide-react";
import {
  exportLocalBackup,
  importLocalBackup,
  db,
  FollowedFriend,
} from "@/lib/db";
import { pushMyShelfToServer, syncFriendLibrary } from "@/lib/sync";

export default function EReaderLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentShelf, setCurrentShelf] = useState<ShelfStatus>("completed");
  const [viewMode, setViewMode] = useState<"compact_grid" | "series" | "list">(
    "series",
  );
  const [activeSeriesFilter, setActiveSeriesFilter] = useState<string | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectingBook, setInspectingBook] = useState<LibraryItem | null>(
    null,
  );

  // Search & add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [seriesInput, setSeriesInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedRating, setSelectedRating] = useState<BookRating>("good");

  // Multi-library & sync state
  const [activeView, setActiveView] = useState<"my_library" | string>(
    "my_library",
  );
  const [followedFriends, setFollowedFriends] = useState<FollowedFriend[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Initial Load from IndexedDB and Check URL for Friend Share Links
  useEffect(() => {
    async function init() {
      try {
        const storedBooks = await db.books.toArray();
        setItems(storedBooks);

        const storedFriends = await db.friends.toArray();
        setFollowedFriends(storedFriends);

        // Auto-detect ?share=friend-code from URL
        const params = new URLSearchParams(window.location.search);
        const incomingShare = params.get("share");
        if (incomingShare) {
          handleSyncFriend(incomingShare);
        }
      } catch (err) {
        console.error("Failed to load local DB:", err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Determine active books (own shelf vs followed friend)
  const currentDisplayBooks = useMemo(() => {
    if (activeView === "my_library") return items;
    const friend = followedFriends.find((f) => f.shareCode === activeView);
    return friend ? friend.books : [];
  }, [activeView, items, followedFriends]);

  const filteredShelfItems = useMemo(() => {
    return currentDisplayBooks.filter((item) => {
      const matchesShelf = item.status === currentShelf;
      const matchesSeries = activeSeriesFilter
        ? item.series === activeSeriesFilter
        : true;
      return matchesShelf && matchesSeries;
    });
  }, [currentDisplayBooks, currentShelf, activeSeriesFilter]);

  const collections = useMemo(() => {
    const shelfItems = currentDisplayBooks.filter(
      (i) => i.status === currentShelf,
    );
    const groups: Record<string, LibraryItem[]> = {};
    const standalones: LibraryItem[] = [];

    shelfItems.forEach((book) => {
      if (book.series) {
        if (!groups[book.series]) groups[book.series] = [];
        groups[book.series].push(book);
      } else {
        standalones.push(book);
      }
    });

    return { groups, standalones };
  }, [currentDisplayBooks, currentShelf]);

  // Add Book and persist to IndexedDB
  const handleAddBook = async (book: SearchResult) => {
    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      title: book.title,
      creator: book.author,
      coverId: book.coverId,
      status: currentShelf,
      mediaType: "book",
      rating: currentShelf === "completed" ? selectedRating : undefined,
      series: seriesInput.trim() ? seriesInput.trim() : undefined,
    };

    await db.books.put(newItem);
    setItems((prev) => [newItem, ...prev]);
    setIsAddOpen(false);
    setSearchQuery("");
    setSeriesInput("");
    setSearchResults([]);
  };

  // Update Book (characters, notes, rating) and persist
  const handleUpdateBook = async (updated: LibraryItem) => {
    if (activeView !== "my_library") return;
    await db.books.put(updated);
    setItems((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setInspectingBook(updated);
  };

  // Delete Selected Books
  const deleteSelected = async () => {
    if (activeView !== "my_library") return;
    await db.books.bulkDelete(selectedIds);
    setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeView !== "my_library") return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleShare = async () => {
    const username = prompt(
      "Enter your handle/username to publish share link:",
      "alex",
    );
    if (!username) return;
    setIsSyncing(true);
    try {
      const code = await pushMyShelfToServer(
        `${username.toLowerCase()}-shelf`,
        username,
      );
      const url = `${window.location.origin}?share=${code}`;
      navigator.clipboard.writeText(url);
      alert(`Share link copied to clipboard!\n${url}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const count = await importLocalBackup(file);
    alert(`Successfully restored ${count} books from local backup!`);
    const refreshed = await db.books.toArray();
    setItems(refreshed);
  };

  const handlePublishMyShelf = async () => {
    const code = prompt(
      "Choose a unique Share Code (e.g. 'alex-books'):",
      "my-shelf",
    );
    if (!code) return;
    setIsSyncing(true);
    try {
      await pushMyShelfToServer(code, "Reader");
      alert(`Published! Friends can import code: ${code}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFriend = async (codeToSync?: string) => {
    const code = codeToSync || prompt("Enter friend's Share Code:");
    if (!code) return;
    setIsSyncing(true);
    try {
      const friend = await syncFriendLibrary(code);
      const updated = await db.friends.toArray();
      setFollowedFriends(updated);
      setActiveView(friend.shareCode);
      alert(`Synced! Viewing ${friend.friendName}'s library.`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const results = await searchOpenLibrary(searchQuery);
    setSearchResults(results);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex items-center justify-center font-serif text-[#555]">
        Loading your library...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] text-[#1c1c1c] font-sans selection:bg-[#dedad0] flex flex-col md:flex-row">
      {/* 1. SIDEBAR: Collections & Friends */}
      <aside className="w-full md:w-60 lg:w-64 bg-[#f1eee4] border-b md:border-b-0 md:border-r border-[#e0dcce] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#e0dcce] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-[#222]" />
            <span className="font-serif font-bold text-sm tracking-tight">
              Paperback
            </span>
          </div>
          <button
            onClick={() => handleSyncFriend()}
            title="Follow Friend"
            className="p-1.5 hover:bg-[#e4dec8] rounded text-[#555] hover:text-[#111] transition"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 flex-1 overflow-y-auto space-y-1">
          <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#777]">
            Active Collection
          </p>

          <button
            onClick={() => {
              setActiveView("my_library");
              setActiveSeriesFilter(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-semibold transition ${
              activeView === "my_library"
                ? "bg-[#1c1c1c] text-white shadow-xs"
                : "text-[#444] hover:bg-[#e5e0d2]"
            }`}
          >
            <span className="truncate">My Library</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${activeView === "my_library" ? "bg-stone-700 text-stone-200" : "bg-[#ded8c8]"}`}
            >
              {items.length}
            </span>
          </button>

          {followedFriends.length > 0 && (
            <div className="pt-3">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#777]">
                Friends (Read-Only)
              </p>
              {followedFriends.map((f) => (
                <button
                  key={f.shareCode}
                  onClick={() => {
                    setActiveView(f.shareCode);
                    setActiveSeriesFilter(null);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition mb-0.5 ${
                    activeView === f.shareCode
                      ? "bg-[#1c1c1c] text-white font-semibold"
                      : "text-[#555] hover:bg-[#e5e0d2]"
                  }`}
                >
                  <span className="truncate">{f.friendName}'s Shelf</span>
                  <span className="text-[10px] opacity-70 font-mono">
                    {f.books.length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#e0dcce] bg-[#eae5d8]/40 hidden md:block text-[11px] text-[#666]">
          {activeView === "my_library" ? (
            <span className="flex items-center gap-1.5 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />{" "}
              Offline Local Storage
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-stone-700">
              <span className="w-2 h-2 rounded-full bg-stone-500 inline-block" />{" "}
              Synced Friend Cache
            </span>
          )}
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-[#f8f6f0]/95 backdrop-blur-md border-b border-[#e2ded2] px-4 sm:px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-5">
              <button
                onClick={() => {
                  setCurrentShelf("completed");
                  setActiveSeriesFilter(null);
                  setSelectedIds([]);
                }}
                className={`text-xs uppercase font-bold tracking-wider pb-1 border-b-2 transition ${
                  currentShelf === "completed"
                    ? "border-[#1c1c1c] text-[#1c1c1c]"
                    : "border-transparent text-[#777] hover:text-[#222]"
                }`}
              >
                Books Read (
                {
                  currentDisplayBooks.filter((i) => i.status === "completed")
                    .length
                }
                )
              </button>
              <button
                onClick={() => {
                  setCurrentShelf("yet_to_read");
                  setActiveSeriesFilter(null);
                  setSelectedIds([]);
                }}
                className={`text-xs uppercase font-bold tracking-wider pb-1 border-b-2 transition ${
                  currentShelf === "yet_to_read"
                    ? "border-[#1c1c1c] text-[#1c1c1c]"
                    : "border-transparent text-[#777] hover:text-[#222]"
                }`}
              >
                Unread (
                {
                  currentDisplayBooks.filter((i) => i.status === "yet_to_read")
                    .length
                }
                )
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center border border-[#ccc8bb] bg-white rounded overflow-hidden">
                <button
                  onClick={() => setViewMode("series")}
                  title="Series View"
                  className={`px-2.5 py-1 text-xs flex items-center gap-1 ${
                    viewMode === "series"
                      ? "bg-[#1c1c1c] text-white"
                      : "hover:bg-[#f3efe4]"
                  }`}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Series</span>
                </button>
                <button
                  onClick={() => setViewMode("compact_grid")}
                  title="Grid View"
                  className={`px-2.5 py-1 text-xs flex items-center gap-1 ${
                    viewMode === "compact_grid"
                      ? "bg-[#1c1c1c] text-white"
                      : "hover:bg-[#f3efe4]"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  title="List View"
                  className={`px-2.5 py-1 text-xs flex items-center gap-1 ${
                    viewMode === "list"
                      ? "bg-[#1c1c1c] text-white"
                      : "hover:bg-[#f3efe4]"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>

              {activeView === "my_library" ? (
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="flex items-center gap-1 text-xs bg-[#1c1c1c] hover:bg-black text-white px-2.5 py-1 rounded font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#eae5d8] rounded text-[#666]">
                  VIEW ONLY
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#666] pt-1.5 mt-1 border-t border-[#ede9de]">
            <div>
              {activeSeriesFilter ? (
                <button
                  onClick={() => setActiveSeriesFilter(null)}
                  className="font-medium text-[#1c1c1c] bg-[#eae5d8] px-2 py-0.5 rounded hover:bg-[#dfd9cb] transition"
                >
                  ← All (Series: {activeSeriesFilter})
                </button>
              ) : (
                <span>{filteredShelfItems.length} books listed</span>
              )}
            </div>

            {selectedIds.length > 0 && activeView === "my_library" && (
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1 text-xs bg-rose-900 text-white px-2 py-0.5 rounded"
              >
                <Trash2 className="w-3 h-3" /> Remove ({selectedIds.length})
              </button>
            )}
          </div>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 pb-24 overflow-y-auto">
          {filteredShelfItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#888] text-sm">
              <BookOpen className="w-8 h-8 stroke-1 mb-2 text-[#aaa]" />
              <p>No books in this shelf.</p>
              {activeView === "my_library" && (
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="mt-2 text-xs text-[#1c1c1c] underline"
                >
                  + Add your first book
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 1. Series View */}
              {viewMode === "series" && !activeSeriesFilter && (
                <div className="space-y-6">
                  {Object.keys(collections.groups).length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#666] mb-3">
                        Series Collections
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {Object.entries(collections.groups).map(
                          ([seriesName, bks]) => (
                            <div
                              key={seriesName}
                              onClick={() => setActiveSeriesFilter(seriesName)}
                              className="cursor-pointer bg-white border border-[#dcd8cb] hover:border-[#1c1c1c] p-3 rounded shadow-xs flex items-center justify-between group transition"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-12 bg-[#e8e4d8] border border-[#ccc] rounded flex items-center justify-center font-bold text-xs text-[#555] relative shrink-0">
                                  <div className="absolute -top-1 -right-1 w-full h-full border border-[#ccc] bg-[#f0ecdf] -z-10 rounded" />
                                  {bks.length}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-serif font-bold text-sm text-[#1c1c1c] truncate">
                                    {seriesName}
                                  </h4>
                                  <p className="text-[11px] text-[#777] truncate">
                                    {bks[0]?.creator}
                                  </p>
                                  <span className="text-[10px] text-[#444] bg-[#f4f0e6] px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                    {bks.length} Books
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#aaa] group-hover:text-[#1c1c1c] shrink-0 ml-2" />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {collections.standalones.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#666] mb-3">
                        Standalone Novels ({collections.standalones.length})
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                        {collections.standalones.map((item) => (
                          <CompactBookCard
                            key={item.id}
                            item={item}
                            isSelected={selectedIds.includes(item.id)}
                            onSelect={toggleSelect}
                            onClick={() => setInspectingBook(item)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Compact Grid View */}
              {(viewMode === "compact_grid" || activeSeriesFilter) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                  {filteredShelfItems.map((item) => (
                    <CompactBookCard
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.includes(item.id)}
                      onSelect={toggleSelect}
                      onClick={() => setInspectingBook(item)}
                    />
                  ))}
                </div>
              )}

              {/* 3. Dense List View */}
              {viewMode === "list" && !activeSeriesFilter && (
                <div className="divide-y divide-[#e5e1d5] border border-[#dcd8cb] bg-white rounded overflow-hidden shadow-xs">
                  {filteredShelfItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => setInspectingBook(item)}
                        className="px-3.5 py-2 flex items-center justify-between hover:bg-[#faf8f2] cursor-pointer text-xs group transition"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          {activeView === "my_library" && (
                            <button
                              onClick={(e) => toggleSelect(item.id, e)}
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                                isSelected
                                  ? "bg-[#1c1c1c] text-white border-[#1c1c1c]"
                                  : "border-[#aaa] bg-white"
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-3 h-3 stroke-[3]" />
                              )}
                            </button>
                          )}
                          <div className="min-w-0">
                            <p className="font-serif font-bold text-xs text-[#1c1c1c] truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-[#777] truncate">
                              {item.creator}{" "}
                              {item.series &&
                                `• ${item.series} #${item.seriesOrder || ""}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {item.status === "completed" && item.rating && (
                            <span className="text-[10px] font-mono text-[#555] uppercase">
                              {item.rating === "best" && "★★★★★"}
                              {item.rating === "good" && "★★★★☆"}
                              {item.rating === "avg" && "★★★☆☆"}
                              {item.rating === "okeyish" && "★★☆☆☆"}
                              {item.rating === "do_not_read" && "AVOID"}
                            </span>
                          )}
                          {(item.characters?.length || 0) > 0 && (
                            <span className="text-[10px] bg-[#f4f0e6] border border-[#dcd8cb] px-1.5 py-0.2 rounded text-[#444] flex items-center gap-1 font-medium">
                              <UserCheck className="w-2.5 h-2.5" />{" "}
                              {item.characters?.length}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>

        {/* 3. BOTTOM DOCK */}
        <footer className="sticky bottom-0 z-20 bg-[#f1eee4]/95 backdrop-blur-md border-t border-[#e2ded2] px-4 sm:px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={exportLocalBackup}
                title="Export JSON Backup"
                className="px-2.5 py-1 border border-[#ccc8bb] bg-white rounded hover:bg-[#ede9de] flex items-center gap-1 text-[11px]"
              >
                <Download className="w-3 h-3" /> Backup
              </button>

              <label
                title="Restore JSON Backup"
                className="px-2.5 py-1 border border-[#ccc8bb] bg-white rounded hover:bg-[#ede9de] flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Upload className="w-3 h-3" /> Restore
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleShare}
                className="px-2.5 py-1 border border-[#ccc8bb] bg-white hover:bg-[#ede9de] rounded text-[11px] flex items-center gap-1"
              >
                <Share2 className="w-3 h-3" /> Share Link
              </button>
            </div>

            <div>
              {activeView === "my_library" ? (
                <button
                  onClick={handlePublishMyShelf}
                  disabled={isSyncing}
                  className="px-3 py-1 bg-[#1c1c1c] text-white hover:bg-black rounded font-medium text-[11px] flex items-center gap-1.5 transition"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>
                    {isSyncing ? "Publishing..." : "Publish / Update My Shelf"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => handleSyncFriend(activeView)}
                  disabled={isSyncing}
                  className="px-3 py-1 bg-[#1c1c1c] text-white hover:bg-black rounded font-medium text-[11px] flex items-center gap-1.5 transition"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  <span>
                    {isSyncing ? "Syncing..." : "Sync Friend's Updates"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>

      {/* Add Book Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#f8f6f0] text-[#1c1c1c] border border-[#bbb] rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h2 className="text-base font-serif font-bold text-[#1c1c1c] mb-3">
              Add to{" "}
              {currentShelf === "completed" ? "Books Read" : "Unread Shelf"}
            </h2>

            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Search Title or Author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-white border border-[#ccc] rounded px-3 py-1.5 text-xs outline-none focus:border-[#1c1c1c]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#1c1c1c] text-white rounded text-xs font-semibold hover:bg-black transition"
              >
                Search
              </button>
            </form>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[10px] text-[#555] uppercase font-bold mb-1">
                  Series / Collection
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shatter Me, Twisted"
                  value={seriesInput}
                  onChange={(e) => setSeriesInput(e.target.value)}
                  className="w-full bg-white border border-[#ccc] rounded px-2.5 py-1 text-xs outline-none focus:border-[#1c1c1c]"
                />
              </div>

              {currentShelf === "completed" && (
                <div>
                  <label className="block text-[10px] text-[#555] uppercase font-bold mb-1">
                    Verdict
                  </label>
                  <select
                    value={selectedRating}
                    onChange={(e) =>
                      setSelectedRating(e.target.value as BookRating)
                    }
                    className="w-full bg-white border border-[#ccc] rounded px-2.5 py-1 text-xs outline-none focus:border-[#1c1c1c]"
                  >
                    <option value="best">Best</option>
                    <option value="good">Good</option>
                    <option value="avg">Avg</option>
                    <option value="okeyish">Okeyish</option>
                    <option value="do_not_read">DO NOT READ</option>
                  </select>
                </div>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {searchResults.map((res, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-white border border-[#e2ded2] rounded"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <img
                      src={getCoverUrl(res.coverId)}
                      className="w-7 h-10 object-cover grayscale border rounded shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {res.title}
                      </p>
                      <p className="text-[10px] text-[#666] truncate">
                        {res.author}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddBook(res)}
                    className="text-xs px-2.5 py-1 border border-[#1c1c1c] hover:bg-[#1c1c1c] hover:text-white rounded transition shrink-0"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-xs text-[#666] hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossier Notebook Modal */}
      {inspectingBook && (
        <CharacterModal
          book={inspectingBook}
          onClose={() => setInspectingBook(null)}
          onUpdateBook={handleUpdateBook}
        />
      )}
    </div>
  );
}

function CompactBookCard({
  item,
  isSelected,
  onSelect,
  onClick,
}: {
  item: LibraryItem;
  isSelected: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer flex flex-col text-left select-none"
    >
      <div className="relative aspect-[2/3] w-full bg-[#eeeae0] rounded border border-[#d8d4c7] overflow-hidden shadow-xs group-hover:border-[#1c1c1c] transition">
        <img
          src={getCoverUrl(item.coverId)}
          alt={item.title}
          className="w-full h-full object-cover grayscale contrast-125"
          loading="lazy"
        />

        <button
          onClick={(e) => onSelect(item.id, e)}
          className={`absolute bottom-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center border transition ${
            isSelected
              ? "bg-[#1c1c1c] border-[#1c1c1c] text-white"
              : "bg-white/90 border-[#aaa] opacity-0 group-hover:opacity-100"
          }`}
        >
          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
        </button>

        {(item.characters?.length || 0) > 0 && (
          <div className="absolute top-1 right-1 bg-white/95 text-[#1c1c1c] border border-[#ccc] px-1 py-0.2 rounded text-[9px] font-medium flex items-center gap-0.5">
            <UserCheck className="w-2.5 h-2.5" />
            {item.characters?.length}
          </div>
        )}
      </div>

      <div className="mt-1">
        <h4 className="font-serif text-xs font-bold text-[#1c1c1c] line-clamp-1 leading-snug">
          {item.title}
        </h4>
        <p className="text-[10px] text-[#777] truncate">{item.creator}</p>
        {item.rating && item.status === "completed" && (
          <div className="text-[9px] text-[#444] font-semibold uppercase mt-0.5">
            {item.rating === "best" && "★★★★★"}
            {item.rating === "good" && "★★★★☆"}
            {item.rating === "avg" && "★★★☆☆"}
            {item.rating === "okeyish" && "★★☆☆☆"}
            {item.rating === "do_not_read" && "AVOID"}
          </div>
        )}
      </div>
    </div>
  );
}
