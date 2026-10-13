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
  FolderArchive,
  BookOpen,
  UserCheck,
  Download,
  Upload,
  CloudUpload,
  RefreshCw,
  Library,
  UserPlus,
  CheckCircle2,
  BookMarked,
  Layers,
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
  const [viewMode, setViewMode] = useState<"shelves" | "series" | "list">(
    "shelves",
  );
  const [activeSeriesFilter, setActiveSeriesFilter] = useState<string | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectingBook, setInspectingBook] = useState<LibraryItem | null>(
    null,
  );

  // Status transition modal
  const [statusModalBook, setStatusModalBook] = useState<LibraryItem | null>(
    null,
  );
  const [verdictChoice, setVerdictChoice] = useState<BookRating>("good");

  // Move-to-Series Modal State (Single or Batch)
  const [seriesModalBook, setSeriesModalBook] = useState<LibraryItem | null>(
    null,
  );
  const [isBatchSeriesModalOpen, setIsBatchSeriesModalOpen] = useState(false);
  const [seriesTargetChoice, setSeriesTargetChoice] = useState<string>("");
  const [newSeriesNameInput, setNewSeriesNameInput] = useState<string>("");
  const [seriesOrderInput, setSeriesOrderInput] = useState<string>("");

  // Search & add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addSeriesChoice, setAddSeriesChoice] = useState<string>("none"); // "none" | "new" | existingName
  const [addCustomSeriesInput, setAddCustomSeriesInput] = useState("");
  const [addSeriesOrderInput, setAddSeriesOrderInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedRating, setSelectedRating] = useState<BookRating>("good");
  const [initialStatus, setInitialStatus] =
    useState<ShelfStatus>("yet_to_read");

  // Multi-library & sync state
  const [activeView, setActiveView] = useState<"my_library" | string>(
    "my_library",
  );
  const [followedFriends, setFollowedFriends] = useState<FollowedFriend[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const storedBooks = await db.books.toArray();
        setItems(storedBooks);

        const storedFriends = await db.friends.toArray();
        setFollowedFriends(storedFriends);

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

  const currentDisplayBooks = useMemo(() => {
    if (activeView === "my_library") return items;
    const friend = followedFriends.find((f) => f.shareCode === activeView);
    return friend ? friend.books : [];
  }, [activeView, items, followedFriends]);

  const booksRead = useMemo(
    () => currentDisplayBooks.filter((b) => b.status === "completed"),
    [currentDisplayBooks],
  );
  const booksUnread = useMemo(
    () => currentDisplayBooks.filter((b) => b.status === "yet_to_read"),
    [currentDisplayBooks],
  );

  // Unique list of all existing series names
  const existingSeriesList = useMemo(() => {
    const set = new Set<string>();
    items.forEach((b) => {
      if (b.series && b.series.trim()) set.add(b.series.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  const seriesGroups = useMemo(() => {
    const groups: Record<
      string,
      { total: number; read: number; unread: number; books: LibraryItem[] }
    > = {};
    currentDisplayBooks.forEach((b) => {
      if (b.series) {
        if (!groups[b.series]) {
          groups[b.series] = { total: 0, read: 0, unread: 0, books: [] };
        }
        groups[b.series].total += 1;
        if (b.status === "completed") groups[b.series].read += 1;
        if (b.status === "yet_to_read") groups[b.series].unread += 1;
        groups[b.series].books.push(b);
      }
    });
    return groups;
  }, [currentDisplayBooks]);

  // MOVE STATUS HANDLERS
  const moveBookStatus = async (
    book: LibraryItem,
    newStatus: ShelfStatus,
    rating?: BookRating,
  ) => {
    if (activeView !== "my_library") return;
    const updated: LibraryItem = {
      ...book,
      status: newStatus,
      rating:
        newStatus === "completed" ? rating || book.rating || "good" : undefined,
    };
    await db.books.put(updated);
    setItems((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setStatusModalBook(null);
  };

  const batchMoveStatus = async (newStatus: ShelfStatus) => {
    if (activeView !== "my_library" || selectedIds.length === 0) return;
    const updatedBooks: LibraryItem[] = [];
    for (const id of selectedIds) {
      const book = items.find((b) => b.id === id);
      if (book) {
        const updated = {
          ...book,
          status: newStatus,
          rating: newStatus === "completed" ? book.rating || "good" : undefined,
        };
        await db.books.put(updated);
        updatedBooks.push(updated);
      }
    }
    setItems((prev) =>
      prev.map((b) => updatedBooks.find((u) => u.id === b.id) || b),
    );
    setSelectedIds([]);
  };

  // MOVE TO SERIES HANDLERS
  const openMoveSeriesModal = (book: LibraryItem) => {
    setSeriesModalBook(book);
    setSeriesTargetChoice(book.series || "none");
    setNewSeriesNameInput("");
    setSeriesOrderInput(book.seriesOrder ? String(book.seriesOrder) : "");
  };

  const saveBookSeries = async () => {
    if (!seriesModalBook || activeView !== "my_library") return;
    let finalSeries: string | undefined = undefined;

    if (seriesTargetChoice === "new") {
      finalSeries = newSeriesNameInput.trim() || undefined;
    } else if (seriesTargetChoice !== "none") {
      finalSeries = seriesTargetChoice.trim();
    }

    const orderNum = parseInt(seriesOrderInput, 10);
    const updated: LibraryItem = {
      ...seriesModalBook,
      series: finalSeries,
      seriesOrder: !isNaN(orderNum) && finalSeries ? orderNum : undefined,
    };

    await db.books.put(updated);
    setItems((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setSeriesModalBook(null);
  };

  const saveBatchSeries = async () => {
    if (activeView !== "my_library" || selectedIds.length === 0) return;
    let finalSeries: string | undefined = undefined;

    if (seriesTargetChoice === "new") {
      finalSeries = newSeriesNameInput.trim() || undefined;
    } else if (seriesTargetChoice !== "none") {
      finalSeries = seriesTargetChoice.trim();
    }

    const updatedBooks: LibraryItem[] = [];
    for (const id of selectedIds) {
      const book = items.find((b) => b.id === id);
      if (book) {
        const updated: LibraryItem = {
          ...book,
          series: finalSeries,
          seriesOrder: finalSeries ? book.seriesOrder : undefined,
        };
        await db.books.put(updated);
        updatedBooks.push(updated);
      }
    }

    setItems((prev) =>
      prev.map((b) => updatedBooks.find((u) => u.id === b.id) || b),
    );
    setIsBatchSeriesModalOpen(false);
    setSelectedIds([]);
  };

  // ADD BOOK HANDLER
  const handleAddBook = async (book: SearchResult) => {
    let assignedSeries: string | undefined = undefined;
    if (addSeriesChoice === "new") {
      assignedSeries = addCustomSeriesInput.trim() || undefined;
    } else if (addSeriesChoice !== "none") {
      assignedSeries = addSeriesChoice.trim();
    }

    const orderNum = parseInt(addSeriesOrderInput, 10);

    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      title: book.title,
      creator: book.author,
      coverId: book.coverId,
      status: initialStatus,
      mediaType: "book",
      rating: initialStatus === "completed" ? selectedRating : undefined,
      series: assignedSeries,
      seriesOrder: !isNaN(orderNum) && assignedSeries ? orderNum : undefined,
    };

    await db.books.put(newItem);
    setItems((prev) => [newItem, ...prev]);
    setIsAddOpen(false);
    setSearchQuery("");
    setAddSeriesChoice("none");
    setAddCustomSeriesInput("");
    setAddSeriesOrderInput("");
    setSearchResults([]);
  };

  const handleUpdateBook = async (updated: LibraryItem) => {
    if (activeView !== "my_library") return;
    await db.books.put(updated);
    setItems((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setInspectingBook(updated);
  };

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
    const username = prompt("Enter your handle to publish share link:", "alex");
    if (!username) return;
    setIsSyncing(true);
    try {
      const code = await pushMyShelfToServer(
        `${username.toLowerCase()}-shelf`,
        username,
      );
      const url = `${window.location.origin}?share=${code}`;
      navigator.clipboard.writeText(url);
      alert(`Share link copied!\n${url}`);
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
    alert(`Restored ${count} books!`);
    const refreshed = await db.books.toArray();
    setItems(refreshed);
  };

  const handlePublishMyShelf = async () => {
    const code = prompt("Choose a unique Share Code:", "my-shelf");
    if (!code) return;
    setIsSyncing(true);
    try {
      await pushMyShelfToServer(code, "Reader");
      alert(`Published! Share code: ${code}`);
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
      <div className="min-h-screen bg-[#f3efe6] flex items-center justify-center font-serif text-[#666]">
        Opening library...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ebe6dc] text-[#2c2621] font-sans flex flex-col md:flex-row p-2 sm:p-4 gap-4">
      {/* 1. SOFT INSET SIDEBAR */}
      <aside className="w-full md:w-60 bg-[#f7f4ee] rounded-2xl border border-[#ded8cb] p-4 flex flex-col shrink-0 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#e8e2d5]">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-[#8c6b4f]" />
            <span className="font-serif font-bold text-base tracking-tight text-[#3d332a]">
              Paperback
            </span>
          </div>
          <button
            onClick={() => handleSyncFriend()}
            title="Follow Friend"
            className="p-1.5 hover:bg-[#ede7da] rounded-lg text-[#6e6155] transition"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Shelves List */}
        <div className="py-4 flex-1 space-y-1">
          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#998b7e] mb-2">
            Shelves
          </p>

          <button
            onClick={() => {
              setActiveView("my_library");
              setActiveSeriesFilter(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeView === "my_library"
                ? "bg-[#eeddc9] text-[#4a3421] shadow-xs"
                : "text-[#665a4e] hover:bg-[#ede7da]"
            }`}
          >
            <span>My Library</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/70 font-mono">
              {items.length}
            </span>
          </button>

          {followedFriends.length > 0 && (
            <div className="pt-4">
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#998b7e] mb-2">
                Friends (Read-Only)
              </p>
              {followedFriends.map((f) => (
                <button
                  key={f.shareCode}
                  onClick={() => {
                    setActiveView(f.shareCode);
                    setActiveSeriesFilter(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition mb-1 ${
                    activeView === f.shareCode
                      ? "bg-[#eeddc9] text-[#4a3421] font-semibold"
                      : "text-[#665a4e] hover:bg-[#ede7da]"
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

        {/* Sync & Backup Dock inside Sidebar */}
        <div className="pt-3 border-t border-[#e8e2d5] space-y-2">
          <div className="flex gap-1.5">
            <button
              onClick={exportLocalBackup}
              title="Backup JSON"
              className="flex-1 py-1.5 px-2 bg-white hover:bg-[#f2ece1] border border-[#ded8cb] rounded-lg text-[11px] text-[#55493e] flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3" /> Backup
            </button>
            <label
              title="Restore JSON"
              className="flex-1 py-1.5 px-2 bg-white hover:bg-[#f2ece1] border border-[#ded8cb] rounded-lg text-[11px] text-[#55493e] flex items-center justify-center gap-1 cursor-pointer"
            >
              <Upload className="w-3 h-3" /> Restore
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={
              activeView === "my_library"
                ? handlePublishMyShelf
                : () => handleSyncFriend(activeView)
            }
            disabled={isSyncing}
            className="w-full py-1.5 bg-[#4a3b2f] hover:bg-[#382b20] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            {activeView === "my_library" ? (
              <>
                <CloudUpload className="w-3.5 h-3.5" /> Publish / Share
              </>
            ) : (
              <>
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />{" "}
                Sync Friend
              </>
            )}
          </button>
        </div>
      </aside>

      {/* 2. THE MAIN INSET "READOWL" CANVAS */}
      <main className="flex-1 bg-[#faf8f4] rounded-2xl border border-[#ded8cb] p-4 sm:p-6 flex flex-col shadow-sm min-w-0">
        {/* TOP TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ece6d9]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setViewMode("shelves");
                setActiveSeriesFilter(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "shelves"
                  ? "bg-[#e8ded1] text-[#3d332a]"
                  : "text-[#7d7165] hover:bg-[#f0ebe0]"
              }`}
            >
              Physical Shelves
            </button>
            <button
              onClick={() => setViewMode("series")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "series"
                  ? "bg-[#e8ded1] text-[#3d332a]"
                  : "text-[#7d7165] hover:bg-[#f0ebe0]"
              }`}
            >
              Series Collections ({Object.keys(seriesGroups).length})
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "list"
                  ? "bg-[#e8ded1] text-[#3d332a]"
                  : "text-[#7d7165] hover:bg-[#f0ebe0]"
              }`}
            >
              List View
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeView === "my_library" && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-3 py-1.5 bg-[#4a3b2f] hover:bg-[#382b20] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Book
              </button>
            )}
          </div>
        </div>

        {/* BATCH ACTION BAR */}
        {selectedIds.length > 0 && activeView === "my_library" && (
          <div className="my-3 p-2 bg-[#f1ebe0] border border-[#dcd3c3] rounded-xl flex items-center justify-between text-xs animate-in fade-in">
            <span className="font-semibold text-[#544639]">
              {selectedIds.length} book(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBatchSeriesModalOpen(true)}
                className="px-2.5 py-1 bg-white hover:bg-[#eadecd] border border-[#d0c6b5] rounded-lg text-[#3d332a] flex items-center gap-1 font-medium transition"
              >
                <Layers className="w-3.5 h-3.5 text-[#8c6b4f]" /> Set Series
              </button>
              <button
                onClick={() => batchMoveStatus("completed")}
                className="px-2.5 py-1 bg-white hover:bg-[#eadecd] border border-[#d0c6b5] rounded-lg text-[#3d332a] flex items-center gap-1 font-medium transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Mark
                as Read
              </button>
              <button
                onClick={() => batchMoveStatus("yet_to_read")}
                className="px-2.5 py-1 bg-white hover:bg-[#eadecd] border border-[#d0c6b5] rounded-lg text-[#3d332a] flex items-center gap-1 font-medium transition"
              >
                <BookMarked className="w-3.5 h-3.5 text-amber-700" /> Move to
                Unread
              </button>
              <button
                onClick={deleteSelected}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        )}

        {/* SHELVES WORKSPACE */}
        <div className="flex-1 overflow-y-auto py-4 space-y-10">
          {/* VIEW MODE 1: PHYSICAL SHELVES (READOWL STYLE) */}
          {viewMode === "shelves" && (
            <>
              <ShelfRow
                title="Next up (Unread)"
                count={booksUnread.length}
                books={booksUnread}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
                onInspect={setInspectingBook}
                onQuickMove={(book) => setStatusModalBook(book)}
                onMoveSeries={openMoveSeriesModal}
                isReadOnly={activeView !== "my_library"}
              />

              <ShelfRow
                title="Finished (Books Read)"
                count={booksRead.length}
                books={booksRead}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
                onInspect={setInspectingBook}
                onQuickMove={(book) => moveBookStatus(book, "yet_to_read")}
                onMoveSeries={openMoveSeriesModal}
                isReadOnly={activeView !== "my_library"}
              />
            </>
          )}

          {/* VIEW MODE 2: SERIES COLLECTIONS */}
          {viewMode === "series" && (
            <div className="space-y-6">
              {Object.keys(seriesGroups).length === 0 ? (
                <div className="text-center py-12 text-[#8c7f73] text-sm">
                  No series added yet. Add a series name when adding books or
                  use the series button on a book.
                </div>
              ) : (
                Object.entries(seriesGroups).map(([seriesName, group]) => (
                  <div
                    key={seriesName}
                    className="bg-white/60 border border-[#e5decfa5] rounded-2xl p-4 shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-[#eee7da] pb-2">
                      <div>
                        <h3 className="font-serif font-bold text-sm text-[#382e25]">
                          {seriesName}
                        </h3>
                        <p className="text-[11px] text-[#7d7063]">
                          {group.read} Read • {group.unread} Unread (
                          {group.total} Total)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 pt-2">
                      {group.books
                        .sort(
                          (a, b) =>
                            (a.seriesOrder || 99) - (b.seriesOrder || 99),
                        )
                        .map((b) => (
                          <ShelfBookCard
                            key={b.id}
                            item={b}
                            isSelected={selectedIds.includes(b.id)}
                            onSelect={toggleSelect}
                            onInspect={setInspectingBook}
                            onQuickMove={(bk) => {
                              if (bk.status === "yet_to_read")
                                setStatusModalBook(bk);
                              else moveBookStatus(bk, "yet_to_read");
                            }}
                            onMoveSeries={openMoveSeriesModal}
                            isReadOnly={activeView !== "my_library"}
                          />
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW MODE 3: COMPACT LIST VIEW */}
          {viewMode === "list" && (
            <div className="divide-y divide-[#ece5d8] border border-[#ded7c8] bg-white rounded-xl overflow-hidden shadow-xs">
              {currentDisplayBooks.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setInspectingBook(item)}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-[#faf7f0] cursor-pointer text-xs group transition"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    {activeView === "my_library" && (
                      <button
                        onClick={(e) => toggleSelect(item.id, e)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selectedIds.includes(item.id)
                            ? "bg-[#4a3b2f] text-white border-[#4a3b2f]"
                            : "border-[#b8ad9e] bg-white"
                        }`}
                      >
                        {selectedIds.includes(item.id) && (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="font-serif font-bold text-sm text-[#332a22] truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#7d7164] truncate">
                        {item.creator}{" "}
                        {item.series && (
                          <span className="italic text-[#8c6b4f]">
                            • {item.series}{" "}
                            {item.seriesOrder ? `#${item.seriesOrder}` : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {activeView === "my_library" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMoveSeriesModal(item);
                        }}
                        title="Assign Series"
                        className="p-1 hover:bg-[#ede7da] rounded text-[#6e6155]"
                      >
                        <FolderArchive className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        item.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.status === "completed" ? "Read" : "Unread"}
                    </span>
                    {activeView === "my_library" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.status === "yet_to_read")
                            setStatusModalBook(item);
                          else moveBookStatus(item, "yet_to_read");
                        }}
                        className="text-[11px] underline text-[#554638] hover:text-black"
                      >
                        {item.status === "yet_to_read"
                          ? "Mark Read"
                          : "Make Unread"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MOVE SINGLE BOOK TO SERIES MODAL */}
      {seriesModalBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#faf7f2] border border-[#cfc6b6] rounded-2xl max-w-sm w-full p-5 shadow-xl font-sans">
            <h3 className="font-serif font-bold text-base text-[#382e25] mb-1">
              Assign Series: {seriesModalBook.title}
            </h3>
            <p className="text-xs text-[#7d7165] mb-4">
              Connect this title to a series collection or set as a standalone
              novel.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-1">
                  Choose Series
                </label>
                <select
                  value={seriesTargetChoice}
                  onChange={(e) => setSeriesTargetChoice(e.target.value)}
                  className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-2 text-xs outline-none"
                >
                  <option value="none">— Standalone (No Series) —</option>
                  <option value="new">+ Create New Series...</option>
                  {existingSeriesList.length > 0 && (
                    <optgroup label="Existing Series Collections">
                      {existingSeriesList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {seriesTargetChoice === "new" && (
                <div>
                  <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-1">
                    New Series Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A Court of Thorns and Roses"
                    value={newSeriesNameInput}
                    onChange={(e) => setNewSeriesNameInput(e.target.value)}
                    className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#4a3b2f]"
                  />
                </div>
              )}

              {seriesTargetChoice !== "none" && (
                <div>
                  <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-1">
                    Volume / Book # in Series (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1, 2, 3"
                    value={seriesOrderInput}
                    onChange={(e) => setSeriesOrderInput(e.target.value)}
                    className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#4a3b2f]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSeriesModalBook(null)}
                className="px-3 py-1.5 text-xs text-[#6e6155] hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={saveBookSeries}
                className="px-4 py-1.5 bg-[#4a3b2f] hover:bg-[#382b20] text-white rounded-lg text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH MOVE TO SERIES MODAL */}
      {isBatchSeriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#faf7f2] border border-[#cfc6b6] rounded-2xl max-w-sm w-full p-5 shadow-xl font-sans">
            <h3 className="font-serif font-bold text-base text-[#382e25] mb-1">
              Move {selectedIds.length} Books to Series
            </h3>
            <p className="text-xs text-[#7d7165] mb-4">
              Group all selected books together under a single series
              collection.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-1">
                  Choose Series
                </label>
                <select
                  value={seriesTargetChoice}
                  onChange={(e) => setSeriesTargetChoice(e.target.value)}
                  className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-2 text-xs outline-none"
                >
                  <option value="none">
                    — Remove From Series (Make Standalone) —
                  </option>
                  <option value="new">+ Create New Series...</option>
                  {existingSeriesList.length > 0 && (
                    <optgroup label="Existing Series Collections">
                      {existingSeriesList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {seriesTargetChoice === "new" && (
                <div>
                  <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-1">
                    New Series Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Percy Jackson"
                    value={newSeriesNameInput}
                    onChange={(e) => setNewSeriesNameInput(e.target.value)}
                    className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#4a3b2f]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsBatchSeriesModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#6e6155] hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={saveBatchSeries}
                className="px-4 py-1.5 bg-[#4a3b2f] hover:bg-[#382b20] text-white rounded-lg text-xs font-semibold"
              >
                Apply Series
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STATUS TRANSITION MODAL */}
      {statusModalBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#faf7f2] border border-[#cfc6b6] rounded-2xl max-w-sm w-full p-5 shadow-xl font-sans">
            <h3 className="font-serif font-bold text-base text-[#382e25] mb-1">
              Mark as Read: {statusModalBook.title}
            </h3>
            <p className="text-xs text-[#7d7165] mb-4">
              Select your reader verdict for this book:
            </p>

            <div className="space-y-2 mb-5">
              {(
                [
                  "best",
                  "good",
                  "avg",
                  "okeyish",
                  "do_not_read",
                ] as BookRating[]
              ).map((r) => (
                <button
                  key={r}
                  onClick={() => setVerdictChoice(r)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition ${
                    verdictChoice === r
                      ? "bg-[#eeddc9] border-[#cbb59d] text-[#4a3421]"
                      : "bg-white border-[#e0d8ca] text-[#55483c] hover:bg-[#f6f1e7]"
                  }`}
                >
                  <span className="capitalize">{r.replace(/_/g, " ")}</span>
                  {verdictChoice === r && (
                    <Check className="w-4 h-4 text-[#4a3421]" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setStatusModalBook(null)}
                className="px-3 py-1.5 text-xs text-[#6e6155] hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  moveBookStatus(statusModalBook, "completed", verdictChoice)
                }
                className="px-4 py-1.5 bg-[#4a3b2f] hover:bg-[#382b20] text-white rounded-lg text-xs font-semibold"
              >
                Save as Read
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD BOOK MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#faf7f2] border border-[#cfc6b6] rounded-2xl max-w-md w-full p-5 shadow-2xl font-sans">
            <h2 className="text-base font-serif font-bold text-[#382e25] mb-3">
              Add Book to Library
            </h2>

            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Search title, author, or ISBN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-white border border-[#d6cdbd] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#4a3b2f]"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-[#4a3b2f] text-white rounded-lg text-xs font-semibold"
              >
                Search
              </button>
            </form>

            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-1">
                    Target Shelf
                  </label>
                  <select
                    value={initialStatus}
                    onChange={(e) =>
                      setInitialStatus(e.target.value as ShelfStatus)
                    }
                    className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value="yet_to_read">Next Up (Unread)</option>
                    <option value="completed">Finished (Read)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-1">
                    Series Option
                  </label>
                  <select
                    value={addSeriesChoice}
                    onChange={(e) => setAddSeriesChoice(e.target.value)}
                    className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value="none">Standalone (No Series)</option>
                    <option value="new">+ Create New Series...</option>
                    {existingSeriesList.length > 0 && (
                      <optgroup label="Existing Series Collections">
                        {existingSeriesList.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Dynamic series inputs */}
              {addSeriesChoice === "new" && (
                <div>
                  <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-0.5">
                    New Series Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shatter Me, Twisted"
                    value={addCustomSeriesInput}
                    onChange={(e) => setAddCustomSeriesInput(e.target.value)}
                    className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#4a3b2f]"
                  />
                </div>
              )}

              {addSeriesChoice !== "none" && (
                <div>
                  <label className="block text-[10px] text-[#7d7165] uppercase font-bold mb-0.5">
                    Volume / Book # in Series (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1, 2, 3"
                    value={addSeriesOrderInput}
                    onChange={(e) => setAddSeriesOrderInput(e.target.value)}
                    className="w-full bg-white border border-[#d6cdbd] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#4a3b2f]"
                  />
                </div>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {searchResults.map((res, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-white border border-[#e8e2d5] rounded-xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <img
                      src={getCoverUrl(res.coverId)}
                      className="w-8 h-11 object-cover rounded shadow-2xs"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-[#332a22]">
                        {res.title}
                      </p>
                      <p className="text-[10px] text-[#7d7165] truncate">
                        {res.author}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddBook(res)}
                    className="text-xs px-3 py-1 bg-[#eeddc9] hover:bg-[#e4d0b9] text-[#4a3421] font-semibold rounded-lg"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-xs text-[#7d7165] hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTEBOOK CHARACTER MODAL */}
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

// -------------------------------------------------------------
// SUBCOMPONENT: THE PHYSICAL SHELF ROW WITH WOODEN LEDGE
// -------------------------------------------------------------
function ShelfRow({
  title,
  count,
  books,
  selectedIds,
  onSelect,
  onInspect,
  onQuickMove,
  onMoveSeries,
  isReadOnly,
}: {
  title: string;
  count: number;
  books: LibraryItem[];
  selectedIds: string[];
  onSelect: (id: string, e: React.MouseEvent) => void;
  onInspect: (book: LibraryItem) => void;
  onQuickMove: (book: LibraryItem) => void;
  onMoveSeries: (book: LibraryItem) => void;
  isReadOnly: boolean;
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif font-bold text-sm text-[#45382d]">{title}</h2>
        <span className="text-[11px] text-[#8c7f73] font-medium">
          {count} books
        </span>
      </div>

      {books.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#998b7e] italic">
          No books placed on this shelf yet.
        </div>
      ) : (
        <div className="relative pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 sm:gap-6 relative z-10 px-2">
            {books.map((b) => (
              <ShelfBookCard
                key={b.id}
                item={b}
                isSelected={selectedIds.includes(b.id)}
                onSelect={onSelect}
                onInspect={onInspect}
                onQuickMove={onQuickMove}
                onMoveSeries={onMoveSeries}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-3.5 bg-gradient-to-r from-[#e3ded4] via-[#ebe6dc] to-[#e3ded4] rounded-xs shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_2px_4px_-1px_rgba(0,0,0,0.03)] border-t border-[#f7f4ee]" />
          <div className="absolute -bottom-1.5 left-1 right-1 h-2 bg-[#d6cfc2] rounded-b-sm opacity-80" />
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUBCOMPONENT: THE INDIVIDUAL BOOK CARD WITH 3D DEPTH
// -------------------------------------------------------------
function ShelfBookCard({
  item,
  isSelected,
  onSelect,
  onInspect,
  onQuickMove,
  onMoveSeries,
  isReadOnly,
}: {
  item: LibraryItem;
  isSelected: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onInspect: (book: LibraryItem) => void;
  onQuickMove: (book: LibraryItem) => void;
  onMoveSeries: (book: LibraryItem) => void;
  isReadOnly: boolean;
}) {
  return (
    <div
      onClick={() => onInspect(item)}
      className="group cursor-pointer flex flex-col text-left select-none relative"
    >
      <div className="relative aspect-[2/3] w-full bg-[#f0eae0] rounded-sm overflow-hidden shadow-[0_8px_16px_-3px_rgba(0,0,0,0.12),0_3px_6px_-2px_rgba(0,0,0,0.06)] border border-[#d6cfc3] group-hover:-translate-y-1 group-hover:shadow-[0_12px_20px_-3px_rgba(0,0,0,0.18)] transition transform duration-150">
        <img
          src={getCoverUrl(item.coverId)}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-200"
          loading="lazy"
        />

        {/* Multi-Select Checkbox */}
        {!isReadOnly && (
          <button
            onClick={(e) => onSelect(item.id, e)}
            className={`absolute top-1.5 left-1.5 w-4 h-4 rounded border flex items-center justify-center transition ${
              isSelected
                ? "bg-[#4a3b2f] border-[#4a3b2f] text-white"
                : "bg-white/80 border-[#999] opacity-0 group-hover:opacity-100"
            }`}
          >
            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </button>
        )}

        {/* Action Buttons on Cover */}
        {!isReadOnly && (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            {/* Move Series Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveSeries(item);
              }}
              title="Assign to Series"
              className="p-1 bg-white/90 hover:bg-white text-[#382b20] rounded-md shadow-xs transition"
            >
              <FolderArchive className="w-3.5 h-3.5 text-[#8c6b4f]" />
            </button>

            {/* Quick Shelf Move (Read / Unread) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickMove(item);
              }}
              title={
                item.status === "yet_to_read"
                  ? "Mark as Read"
                  : "Move to Unread"
              }
              className="p-1 bg-white/90 hover:bg-white text-[#382b20] rounded-md shadow-xs transition"
            >
              {item.status === "yet_to_read" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <BookMarked className="w-3.5 h-3.5 text-amber-700" />
              )}
            </button>
          </div>
        )}

        {/* Series Order Tag or Character Count Tag */}
        <div className="absolute top-1 right-1 flex items-center gap-0.5">
          {item.seriesOrder && (
            <div className="bg-[#4a3b2f] text-white px-1 py-0.2 rounded text-[8px] font-mono font-bold">
              #{item.seriesOrder}
            </div>
          )}
          {(item.characters?.length || 0) > 0 && (
            <div className="bg-white/90 text-[#382b20] border border-[#ccc] px-1 py-0.2 rounded text-[8px] font-medium flex items-center gap-0.5">
              <UserCheck className="w-2.5 h-2.5" />
              {item.characters?.length}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2">
        <h4 className="font-serif text-xs font-bold text-[#332a22] line-clamp-1 leading-snug">
          {item.title}
        </h4>
        <p className="text-[10px] text-[#7d7165] truncate">{item.creator}</p>
        {item.series && (
          <p className="text-[9px] text-[#8c6b4f] truncate italic font-medium">
            {item.series} {item.seriesOrder ? `#${item.seriesOrder}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
