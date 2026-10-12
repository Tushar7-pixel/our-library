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
    "view" | "notes" | "add_character" | "add_relation"
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

  // Save random notes handler
  const handleSaveNotes = () => {
    onUpdateBook({ ...book, notes: randomNotes });
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  // Add character handler
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

  // Delete character
  const handleDeleteCharacter = (charId: string) => {
    onUpdateBook({
      ...book,
      characters: characters.filter((c) => c.id !== charId),
      relations: relations.filter(
        (r) => r.fromCharId !== charId && r.toCharId !== charId,
      ),
    });
  };

  // Add relationship
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 animate-in fade-in duration-150">
      {/* Notebook Page Card */}
      <div className="notebook-sheet font-notes text-[#1e1e1e] border-2 border-[#333] rounded-lg max-w-2xl w-full p-5 sm:p-6 sm:pl-14 shadow-2xl relative flex flex-col max-h-[88vh]">
        {/* Binder Ring Holes */}
        <div className="absolute left-3 top-8 bottom-8 flex flex-col justify-between pointer-events-none">
          <div className="w-3.5 h-3.5 rounded-full bg-[#1c1d1f] shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#1c1d1f] shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#1c1d1f] shadow-inner" />
        </div>

        {/* Notebook Top Title Bar */}
        <div className="flex items-center justify-between pb-2.5 border-b-2 border-dashed border-[#555] mb-2">
          <div>
            <h2 className="font-handwriting text-2xl sm:text-3xl font-bold tracking-wide text-[#111]">
              <span className="border-b-2 border-[#111] pb-0.5">
                {book.title}
              </span>
            </h2>
            <p className="text-xs text-[#555] mt-1 italic">
              ~ Field Notes & Character Dossier ~
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#e7e1d5] rounded text-[#333] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 text-xs font-handwriting text-base border-b border-[#ddd] pb-2 flex-wrap">
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-3 py-0.5 rounded flex items-center gap-1 transition ${
              activeTab === "notes"
                ? "bg-[#1c1c1c] text-[#fcf9f2]"
                : "text-[#444] hover:bg-[#eee8da]"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" /> Jotted Notes
          </button>
          <button
            onClick={() => setActiveTab("view")}
            className={`px-3 py-0.5 rounded transition ${
              activeTab === "view"
                ? "bg-[#1c1c1c] text-[#fcf9f2]"
                : "text-[#444] hover:bg-[#eee8da]"
            }`}
          >
            Dossier ({characters.length})
          </button>
          <button
            onClick={() => setActiveTab("add_character")}
            className={`px-3 py-0.5 rounded transition ${
              activeTab === "add_character"
                ? "bg-[#1c1c1c] text-[#fcf9f2]"
                : "text-[#444] hover:bg-[#eee8da]"
            }`}
          >
            + Add Person
          </button>
          <button
            disabled={characters.length < 2}
            onClick={() => setActiveTab("add_relation")}
            className={`px-3 py-0.5 rounded transition ${
              characters.length < 2
                ? "opacity-30 cursor-not-allowed"
                : activeTab === "add_relation"
                  ? "bg-[#1c1c1c] text-[#fcf9f2]"
                  : "text-[#444] hover:bg-[#eee8da]"
            }`}
          >
            + Connect Line
          </button>
        </div>

        {/* TAB BODY */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: RANDOM SCRATCHPAD NOTES */}
          {activeTab === "notes" && (
            <div className="flex flex-col h-full min-h-[260px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-sans text-[#666] italic">
                  Jot down thoughts, favorite quotes, spoilers or chapter
                  reactions:
                </span>
                <button
                  onClick={handleSaveNotes}
                  className="px-3 py-1 bg-[#1c1c1c] hover:bg-black text-white rounded text-xs font-sans flex items-center gap-1 transition"
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

              {/* Lined Textarea matching notebook rules */}
              <textarea
                value={randomNotes}
                onChange={(e) => setRandomNotes(e.target.value)}
                placeholder="Write your notes here... (e.g. Chapter 14 twist completely blew my mind! Don't trust the therapist...)"
                rows={9}
                className="w-full bg-transparent border-0 outline-none resize-none font-handwriting text-xl sm:text-2xl text-[#1a1a1a] leading-[28px] focus:ring-0 p-0 selection:bg-[#fde047]"
                style={{ lineHeight: "28px" }}
              />
            </div>
          )}

          {/* TAB 2: DOSSIER LIST */}
          {activeTab === "view" && (
            <div className="space-y-4">
              {characters.length === 0 ? (
                <div className="py-12 text-center text-[#666] font-handwriting text-lg italic">
                  No characters added yet. Switch to "+ Add Person" to create
                  one.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <h3 className="font-handwriting text-lg font-bold text-[#222] uppercase tracking-wide">
                      Cast & Verdicts:
                    </h3>
                    {characters.map((c) => (
                      <div
                        key={c.id}
                        className="bg-[#fffefc]/85 border border-[#d6cfc0] rounded p-3 relative group shadow-xs"
                      >
                        <button
                          onClick={() => handleDeleteCharacter(c.id)}
                          className="absolute top-2 right-2 text-[#999] hover:text-red-700 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-baseline gap-2">
                          <span className="font-handwriting text-xl font-bold text-[#111] border-b border-[#333] border-dashed">
                            {c.name}
                          </span>
                          <span className="text-[11px] font-mono text-[#555] bg-[#f0eae1] px-1.5 py-0.5 rounded border border-[#ddd]">
                            [{c.role}]
                          </span>
                        </div>
                        <p className="font-handwriting text-lg text-[#222] mt-1 leading-snug">
                          "{c.opinion}"
                        </p>
                      </div>
                    ))}
                  </div>

                  {relations.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h3 className="font-handwriting text-lg font-bold text-[#222] uppercase tracking-wide">
                        Connected Links:
                      </h3>
                      {relations.map((r, i) => {
                        const from =
                          characters.find((c) => c.id === r.fromCharId)?.name ||
                          "Unknown";
                        const to =
                          characters.find((c) => c.id === r.toCharId)?.name ||
                          "Unknown";
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-[#fffefc]/85 border border-[#d6cfc0] px-3 py-1.5 rounded group text-sm"
                          >
                            <div className="flex items-center gap-2 font-handwriting text-base">
                              <span className="font-bold underline">
                                {from}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#666]" />
                              <span className="bg-[#fef3c7] px-2 py-0.5 rounded border border-[#f59e0b]/40 italic text-sm">
                                {r.relationship}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#666]" />
                              <span className="font-bold underline">{to}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteRelation(i)}
                              className="text-[#999] hover:text-red-700 opacity-0 group-hover:opacity-100 transition"
                            >
                              <Trash2 className="w-3 h-3" />
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
              className="space-y-3 font-handwriting text-lg"
            >
              <div>
                <label className="block text-sm font-bold text-[#333] mb-0.5">
                  Character Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alicia Berenson, Theo Faber"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  className="w-full bg-[#fffefc] border border-[#bbb] rounded px-3 py-1 text-base text-[#111] outline-none font-notes"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#333] mb-0.5">
                  Role / Tag:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mute Painter, Psychotherapist, Suspect"
                  value={charRole}
                  onChange={(e) => setCharRole(e.target.value)}
                  className="w-full bg-[#fffefc] border border-[#bbb] rounded px-3 py-1 text-base text-[#111] outline-none font-notes"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#333] mb-0.5">
                  Opinion / Personality Note:
                </label>
                <textarea
                  rows={2}
                  placeholder="What is your take on them?"
                  value={charOpinion}
                  onChange={(e) => setCharOpinion(e.target.value)}
                  className="w-full bg-[#fffefc] border border-[#bbb] rounded px-3 py-1 text-base text-[#111] outline-none font-notes"
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
                  className="px-3 py-1.5 bg-[#1c1c1c] text-white rounded font-medium"
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
              className="space-y-3 font-handwriting text-lg"
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
                <label className="block text-sm font-bold text-[#333] mb-0.5">
                  Connection:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Therapist of, Accused by, Married to"
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="w-full bg-[#fffefc] border border-[#bbb] rounded px-3 py-1 text-base text-[#111] outline-none font-notes"
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
                  className="px-3 py-1.5 bg-[#1c1c1c] text-white rounded font-medium"
                >
                  Pin Relationship
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
