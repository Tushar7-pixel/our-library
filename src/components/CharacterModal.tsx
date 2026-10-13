"use client";

import { useState } from "react";
import { LibraryItem, Character, CharacterRelation } from "@/types/library";
import {
  X,
  ArrowRight,
  UserPlus,
  Network,
  Trash2,
  BookOpen,
  PenLine,
  Check,
} from "lucide-react";

interface Props {
  book: LibraryItem;
  onClose: () => void;
  onUpdateBook: (updatedBook: LibraryItem) => void;
}

export function CharacterModal({ book, onClose, onUpdateBook }: Props) {
  const [activeTab, setActiveTab] = useState<
    "notes" | "view" | "add_character" | "add_relation"
  >("notes");

  // Freeform handwritten notes state
  const [randomNotes, setRandomNotes] = useState(book.notes || "");
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Character creation states
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charOpinion, setCharOpinion] = useState("");

  // Relation creation states
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relationshipType, setRelationshipType] = useState("");

  const characters = book.characters || [];
  const relations = book.relations || [];

  const handleSaveNotes = () => {
    onUpdateBook({ ...book, notes: randomNotes });
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleAddCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) return;

    const newChar: Character = {
      id: crypto.randomUUID(),
      name: charName.trim(),
      role: charRole.trim() || "Character",
      opinion: charOpinion.trim() || "No notes added.",
    };

    onUpdateBook({ ...book, characters: [...characters, newChar] });
    setCharName("");
    setCharRole("");
    setCharOpinion("");
    setActiveTab("view");
  };

  const handleDeleteCharacter = (charId: string) => {
    onUpdateBook({
      ...book,
      characters: characters.filter((c) => c.id !== charId),
      relations: relations.filter(
        (r) => r.fromCharId !== charId && r.toCharId !== charId,
      ),
    });
  };

  const handleAddRelationship = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId || !relationshipType.trim()) return;

    const newRelation: CharacterRelation = {
      fromCharId: sourceId,
      toCharId: targetId,
      relationship: relationshipType.trim(),
    };

    onUpdateBook({ ...book, relations: [...relations, newRelation] });
    setSourceId("");
    setTargetId("");
    setRelationshipType("");
    setActiveTab("view");
  };

  const handleDeleteRelation = (index: number) => {
    onUpdateBook({
      ...book,
      relations: relations.filter((_, idx) => idx !== index),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      {/* Notebook Page Card */}
      <div className="notebook-sheet font-notes text-[#1e1e1e] border-2 border-[#333] rounded-2xl w-full max-w-xl shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
        {/* Binder Ring Holes (Stationary in left margin) */}
        <div className="absolute left-2.5 sm:left-3.5 top-6 bottom-6 flex flex-col justify-between pointer-events-none z-10">
          <div className="w-3.5 h-3.5 rounded-full bg-[#1c1d1f] shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#1c1d1f] shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#1c1d1f] shadow-inner" />
        </div>

        {/* Content Container (Padded strictly past the red margin line) */}
        <div className="flex-1 flex flex-col min-w-0 pl-13 sm:pl-16 pr-4 sm:pr-6 py-4 sm:py-5 overflow-hidden">
          {/* Notebook Header */}
          <div className="flex items-start justify-between pb-2 border-b-2 border-dashed border-[#555] mb-2 gap-2">
            <div className="min-w-0">
              <h2 className="font-handwriting text-2xl sm:text-3xl font-bold tracking-wide text-[#111] truncate leading-tight">
                <span className="border-b-2 border-[#111] pb-0.5">
                  {book.title}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-[#555] mt-0.5 italic truncate">
                ~ Field Notes & Character Dossier ~
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#e7e1d5] rounded text-[#333] transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Horizontally scrollable tabs for mobile */}
          <div className="flex items-center gap-1.5 mb-2.5 font-handwriting text-base border-b border-[#ddd] pb-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-2.5 py-0.5 rounded whitespace-nowrap flex items-center gap-1 transition text-sm sm:text-base ${
                activeTab === "notes"
                  ? "bg-[#1c1c1c] text-[#fcf9f2]"
                  : "text-[#444] hover:bg-[#eee8da]"
              }`}
            >
              <PenLine className="w-3 h-3" /> Notes
            </button>
            <button
              onClick={() => setActiveTab("view")}
              className={`px-2.5 py-0.5 rounded whitespace-nowrap transition text-sm sm:text-base ${
                activeTab === "view"
                  ? "bg-[#1c1c1c] text-[#fcf9f2]"
                  : "text-[#444] hover:bg-[#eee8da]"
              }`}
            >
              Dossier ({characters.length})
            </button>
            <button
              onClick={() => setActiveTab("add_character")}
              className={`px-2.5 py-0.5 rounded whitespace-nowrap transition text-sm sm:text-base ${
                activeTab === "add_character"
                  ? "bg-[#1c1c1c] text-[#fcf9f2]"
                  : "text-[#444] hover:bg-[#eee8da]"
              }`}
            >
              + Person
            </button>
            <button
              disabled={characters.length < 2}
              onClick={() => setActiveTab("add_relation")}
              className={`px-2.5 py-0.5 rounded whitespace-nowrap transition text-sm sm:text-base ${
                characters.length < 2
                  ? "opacity-30 cursor-not-allowed text-stone-400"
                  : activeTab === "add_relation"
                    ? "bg-[#1c1c1c] text-[#fcf9f2]"
                    : "text-[#444] hover:bg-[#eee8da]"
              }`}
            >
              + Link
            </button>
          </div>

          {/* Scrollable Work Area */}
          <div className="flex-1 overflow-y-auto pr-1">
            {/* TAB 1: RANDOM SCRATCHPAD NOTES */}
            {activeTab === "notes" && (
              <div className="flex flex-col h-full min-h-[220px]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] sm:text-xs font-sans text-[#666] italic truncate">
                    Thoughts, spoilers & quotes:
                  </span>
                  <button
                    onClick={handleSaveNotes}
                    className="px-2.5 py-1 bg-[#1c1c1c] hover:bg-black text-white rounded text-[11px] font-sans flex items-center gap-1 transition shrink-0"
                  >
                    {isSavedNotice ? (
                      <>
                        <Check className="w-3 h-3" /> Saved
                      </>
                    ) : (
                      "Save Notes"
                    )}
                  </button>
                </div>

                <textarea
                  value={randomNotes}
                  onChange={(e) => setRandomNotes(e.target.value)}
                  placeholder="Write your notes here... (e.g. Chapter 14 twist completely blew my mind! Don't trust the therapist...)"
                  rows={8}
                  className="w-full bg-transparent border-0 outline-none resize-none font-handwriting text-lg sm:text-2xl text-[#1a1a1a] leading-[28px] focus:ring-0 p-0 selection:bg-[#fde047]"
                  style={{ lineHeight: "28px" }}
                />
              </div>
            )}

            {/* TAB 2: DOSSIER LIST */}
            {activeTab === "view" && (
              <div className="space-y-4">
                {characters.length === 0 ? (
                  <div className="py-10 text-center text-[#666] font-handwriting text-base sm:text-lg italic">
                    No characters jotted down yet. Tap "+ Person" to add one.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      <h3 className="font-handwriting text-base sm:text-lg font-bold text-[#222] uppercase tracking-wide">
                        Cast & Verdicts:
                      </h3>
                      {characters.map((c) => (
                        <div
                          key={c.id}
                          className="bg-[#fffefc]/85 border border-[#d6cfc0] rounded-lg p-2.5 sm:p-3 relative group shadow-2xs"
                        >
                          <button
                            onClick={() => handleDeleteCharacter(c.id)}
                            className="absolute top-2 right-2 text-[#999] hover:text-red-700 opacity-80 sm:opacity-0 group-hover:opacity-100 transition p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex flex-wrap items-baseline gap-1.5 pr-6">
                            <span className="font-handwriting text-lg sm:text-xl font-bold text-[#111] border-b border-[#333] border-dashed">
                              {c.name}
                            </span>
                            <span className="text-[10px] font-mono text-[#555] bg-[#f0eae1] px-1.5 py-0.2 rounded border border-[#ddd]">
                              [{c.role}]
                            </span>
                          </div>
                          <p className="font-handwriting text-base sm:text-lg text-[#222] mt-1 leading-snug break-words">
                            "{c.opinion}"
                          </p>
                        </div>
                      ))}
                    </div>

                    {relations.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h3 className="font-handwriting text-base sm:text-lg font-bold text-[#222] uppercase tracking-wide">
                          Connected Links:
                        </h3>
                        {relations.map((r, i) => {
                          const from =
                            characters.find((c) => c.id === r.fromCharId)
                              ?.name || "Unknown";
                          const to =
                            characters.find((c) => c.id === r.toCharId)?.name ||
                            "Unknown";
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between bg-[#fffefc]/85 border border-[#d6cfc0] px-2.5 py-1.5 rounded-lg group text-xs sm:text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-1.5 font-handwriting text-sm sm:text-base pr-2">
                                <span className="font-bold underline">
                                  {from}
                                </span>
                                <ArrowRight className="w-3 h-3 text-[#666] shrink-0" />
                                <span className="bg-[#fef3c7] px-1.5 py-0.2 rounded border border-[#f59e0b]/40 italic text-xs">
                                  {r.relationship}
                                </span>
                                <ArrowRight className="w-3 h-3 text-[#666] shrink-0" />
                                <span className="font-bold underline">
                                  {to}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteRelation(i)}
                                className="text-[#999] hover:text-red-700 opacity-80 sm:opacity-0 group-hover:opacity-100 transition p-1 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB 3: ADD PERSON */}
            {activeTab === "add_character" && (
              <form
                onSubmit={handleAddCharacter}
                className="space-y-2.5 font-handwriting text-base sm:text-lg"
              >
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-[#333] mb-0.5">
                    Character Name:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juliette Ferrars, Aaron Warner"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    className="w-full bg-[#fffefc] border border-[#bbb] rounded px-2.5 py-1 text-sm sm:text-base text-[#111] outline-none font-notes"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-[#333] mb-0.5">
                    Archetype / Role:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lethal touch protagonist, Commander"
                    value={charRole}
                    onChange={(e) => setCharRole(e.target.value)}
                    className="w-full bg-[#fffefc] border border-[#bbb] rounded px-2.5 py-1 text-sm sm:text-base text-[#111] outline-none font-notes"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-[#333] mb-0.5">
                    Handwritten Opinion:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What is your take on them?"
                    value={charOpinion}
                    onChange={(e) => setCharOpinion(e.target.value)}
                    className="w-full bg-[#fffefc] border border-[#bbb] rounded px-2.5 py-1 text-sm sm:text-base text-[#111] outline-none font-notes"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1 font-sans text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("view")}
                    className="text-[#666] hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#1c1c1c] text-white rounded font-medium"
                  >
                    Save Note
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: ADD RELATION */}
            {activeTab === "add_relation" && (
              <form
                onSubmit={handleAddRelationship}
                className="space-y-2.5 font-handwriting text-base sm:text-lg"
              >
                <div className="grid grid-cols-2 gap-2 font-sans text-xs">
                  <div>
                    <label className="block font-bold text-[#333] mb-1">
                      From:
                    </label>
                    <select
                      required
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      className="w-full bg-[#fffefc] border border-[#bbb] rounded px-2 py-1"
                    >
                      <option value="">Select Character</option>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#333] mb-1">
                      To:
                    </label>
                    <select
                      required
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full bg-[#fffefc] border border-[#bbb] rounded px-2 py-1"
                    >
                      <option value="">Select Target</option>
                      {characters
                        .filter((c) => c.id !== sourceId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-[#333] mb-0.5">
                    Connection:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enemies to lovers, Betrayed, Secret siblings"
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    className="w-full bg-[#fffefc] border border-[#bbb] rounded px-2.5 py-1 text-sm sm:text-base text-[#111] outline-none font-notes"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1 font-sans text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("view")}
                    className="text-[#666] hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#1c1c1c] text-white rounded font-medium"
                  >
                    Pin Relationship
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
