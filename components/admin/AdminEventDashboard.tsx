"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  ExternalLink,
  Upload,
  FileSpreadsheet,
  FileText,
  Globe,
  Tag,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  ChevronRight,
  RefreshCw,
  Edit2,
  Check,
  X,
  FileUp,
  Link as LinkIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EventItem {
  id: number;
  title: string;
  url: string;
  date?: string | null;
  category?: string | null;
  platform?: string;
  isLuma?: boolean;
  soldOut?: boolean;
  requireApproval?: boolean;
  registrations?: any[];
}

interface AdminEventDashboardProps {
  events: EventItem[];
  onRefreshEvents: () => Promise<void> | void;
  isLoading?: boolean;
}

export function AdminEventDashboard({
  events,
  onRefreshEvents,
  isLoading = false,
}: AdminEventDashboardProps) {
  // Category & Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Ingestion Mode: "url" | "file" | "sheets"
  const [ingestMode, setIngestMode] = useState<"url" | "file" | "sheets">("url");
  const [pastedUrls, setPastedUrls] = useState("");
  const [targetCategory, setTargetCategory] = useState<string>("Korea Blockchain Week");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Google Sheets input
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");

  // File upload state & preview
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [stagedEvents, setStagedEvents] = useState<any[]>([]);
  const [stagedFileName, setStagedFileName] = useState<string | null>(null);

  // Quick edit category inline state
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<string>("");

  // Compute distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    // Default standard categories
    set.add("Korea Blockchain Week");
    set.add("ETH Seoul & Web3");
    set.add("AI & Hackathons");
    set.add("VIP & Side Events");
    set.add("General");

    events.forEach((e) => {
      if (e.category && e.category.trim()) {
        set.add(e.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [events]);

  // Compute counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: events.length };
    categories.forEach((cat) => {
      counts[cat] = events.filter((e) => (e.category || "General") === cat).length;
    });
    return counts;
  }, [events, categories]);

  // Filtered events list
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchCat =
        selectedCategory === "All" || (ev.category || "General") === selectedCategory;
      const matchSearch =
        !searchQuery ||
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.url.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [events, selectedCategory, searchQuery]);

  // Helper feedback timer
  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Add new category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const cat = newCategoryName.trim();
    setSelectedCategory(cat);
    setTargetCategory(cat);
    setNewCategoryName("");
    setIsAddingCategory(false);
    showFeedback("success", `Created category "${cat}". You can now import events into it.`);
  };

  // Submit pasted URLs / single event
  const handleImportUrls = async () => {
    if (!pastedUrls.trim()) {
      showFeedback("error", "Please paste at least one Luma event URL or text.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Use document parser API on raw text
      const parseRes = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: pastedUrls,
          mode: "events",
          category: targetCategory,
        }),
      });

      const parseData = await parseRes.json();
      if (!parseRes.ok || !parseData.events || parseData.events.length === 0) {
        throw new Error(parseData.error || "No valid Luma URLs detected in text.");
      }

      // Bulk create events
      const createRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: parseData.events,
          category: targetCategory,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to save events.");
      }

      showFeedback(
        "success",
        `Successfully imported ${createData.createdCount || parseData.events.length} Luma events into "${targetCategory}".`
      );
      setPastedUrls("");
      await onRefreshEvents();
    } catch (err: any) {
      showFeedback("error", err.message || "Import failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google Sheet Import
  const handleImportGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      showFeedback("error", "Please provide a valid Google Sheet link.");
      return;
    }

    setIsSubmitting(true);
    try {
      const parseRes = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleSheetUrl,
          mode: "events",
          category: targetCategory,
        }),
      });

      const parseData = await parseRes.json();
      if (!parseRes.ok || !parseData.events || parseData.events.length === 0) {
        throw new Error(parseData.error || "No events found in Google Sheet.");
      }

      const createRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: parseData.events,
          category: targetCategory,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to save events.");

      showFeedback(
        "success",
        `Imported ${createData.createdCount || parseData.events.length} events from Google Sheets into "${targetCategory}".`
      );
      setGoogleSheetUrl("");
      await onRefreshEvents();
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to parse Google Sheet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle File Upload (.xlsx, .csv, .docx, .pdf, .md)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "events");
      formData.append("category", targetCategory);

      const res = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.events || data.events.length === 0) {
        throw new Error(data.error || "No Luma events found in this file.");
      }

      setStagedEvents(data.events);
      setStagedFileName(file.name);
      showFeedback("success", `Parsed ${data.events.length} events from ${file.name}. Review below and confirm import.`);
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to parse file.");
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Commit staged events from file to DB
  const handleCommitStagedEvents = async () => {
    if (stagedEvents.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: stagedEvents,
          category: targetCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save staged events.");

      showFeedback(
        "success",
        `Saved ${data.createdCount || stagedEvents.length} events to database registry.`
      );
      setStagedEvents([]);
      setStagedFileName(null);
      await onRefreshEvents();
    } catch (err: any) {
      showFeedback("error", err.message || "Commit failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}" from the registry?`)) return;

    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete event.");
      showFeedback("success", `Removed event #${id}`);
      await onRefreshEvents();
    } catch (err: any) {
      showFeedback("error", err.message || "Delete failed");
    }
  };

  // Inline update category for an event
  const handleSaveEventCategory = async (eventId: number) => {
    if (!editingCategory.trim()) return;
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: editingCategory.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update category.");
      setEditingEventId(null);
      await onRefreshEvents();
      showFeedback("success", "Category updated.");
    } catch (err: any) {
      showFeedback("error", err.message || "Update failed");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Top Banner / Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Luma Event Registry</span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                  Admin Curator
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Curate and categorize official Luma events. Users will only select & automate events from this registry.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRefreshEvents()}
            disabled={isLoading}
            className="text-xs h-9 gap-1.5 rounded-xl border-border bg-card hover:bg-muted cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Registry</span>
          </Button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* EVENT INGESTION CONSOLE */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>Import Luma Events to Registry</span>
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIngestMode("url")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                ingestMode === "url"
                  ? "bg-card text-foreground shadow-2xs border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Direct URLs / Text
            </button>
            <button
              type="button"
              onClick={() => setIngestMode("file")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                ingestMode === "file"
                  ? "bg-card text-foreground shadow-2xs border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Upload Doc / Excel / PDF
            </button>
            <button
              type="button"
              onClick={() => setIngestMode("sheets")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                ingestMode === "sheets"
                  ? "bg-card text-foreground shadow-2xs border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Google Sheets Link
            </button>
          </div>
        </div>

        {/* Target Category Assignment */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <span className="text-xs font-semibold text-muted-foreground shrink-0">
            Assign To Category:
          </span>
          <select
            value={targetCategory}
            onChange={(e) => setTargetCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-background border border-border text-xs text-foreground font-semibold outline-none focus:border-primary max-w-xs cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            (Events will appear under this category for user selection)
          </span>
        </div>

        {/* Tab 1: Paste URLs */}
        {ingestMode === "url" && (
          <div className="space-y-3">
            <textarea
              rows={4}
              value={pastedUrls}
              onChange={(e) => setPastedUrls(e.target.value)}
              placeholder="Paste one or multiple Luma URLs (e.g. https://lu.ma/kbw-kickoff-2026 or raw text containing luma links)..."
              className="w-full p-3.5 rounded-2xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary font-mono custom-scrollbar resize-none leading-relaxed"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleImportUrls}
                disabled={isSubmitting || !pastedUrls.trim()}
                className="h-9 px-4 rounded-xl text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing & Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Import Events to Registry</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: File Upload (Docs, Excel, PDF, MD) */}
        {ingestMode === "file" && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv,.docx,.pdf,.md,.txt"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-2xl p-6 text-center cursor-pointer transition-all bg-muted/20 hover:bg-muted/40 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                <FileUp className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-foreground">
                Drop your file here or click to browse
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Supports Excel (.xlsx, .csv), Word (.docx), PDF (.pdf), and Markdown (.md)
              </div>
            </div>

            {/* Staged Events Preview */}
            {stagedEvents.length > 0 && (
              <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>
                      Parsed {stagedEvents.length} events from {stagedFileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStagedEvents([]);
                        setStagedFileName(null);
                      }}
                      className="text-xs h-7 text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCommitStagedEvents}
                      disabled={isSubmitting}
                      className="text-xs h-8 rounded-xl font-bold bg-primary text-primary-foreground gap-1.5"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Commit {stagedEvents.length} to Registry</span>
                    </Button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  {stagedEvents.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-card border border-border text-xs flex items-center justify-between gap-3"
                    >
                      <div className="truncate min-w-0">
                        <span className="font-semibold text-foreground truncate block">
                          {ev.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate block">
                          {ev.url}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono shrink-0">
                        {ev.category || targetCategory}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Google Sheets Link */}
        {ingestMode === "sheets" && (
          <div className="space-y-3">
            <div className="relative">
              <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="url"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Make sure the sheet is public or shared with &quot;Anyone with the link can view&quot;.
              </span>
              <Button
                onClick={handleImportGoogleSheet}
                disabled={isSubmitting || !googleSheetUrl.trim()}
                className="h-9 px-4 rounded-xl text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching Sheet...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Import Sheet Events</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CATEGORIES NAV & SEARCH BAR */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === "All"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              All Events ({categoryCounts.All || 0})
            </button>

            {categories.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Add Category Button / Form */}
            {!isAddingCategory ? (
              <button
                type="button"
                onClick={() => setIsAddingCategory(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 border border-primary/30 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Category</span>
              </button>
            ) : (
              <form onSubmit={handleCreateCategory} className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name..."
                  className="px-2.5 py-1 rounded-lg bg-background border border-primary text-xs text-foreground outline-none w-36"
                />
                <button
                  type="submit"
                  className="p-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search curated events..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* CURATED EVENTS REGISTRY LIST */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
              Curated Events ({filteredEvents.length})
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Category: <strong className="text-foreground">{selectedCategory}</strong>
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Globe className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <div className="text-sm font-semibold text-foreground">No events found in this category</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Paste Luma URLs above or upload a document/sheet to add events to &quot;{selectedCategory}&quot;.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredEvents.map((ev) => {
              const isEditing = editingEventId === ev.id;
              const registrationsCount = ev.registrations?.length || 0;

              return (
                <div
                  key={ev.id}
                  className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground hover:text-primary transition-colors">
                        {ev.title}
                      </span>
                      {ev.soldOut && (
                        <Badge variant="outline" className="text-[9px] border-rose-500/30 text-rose-500 bg-rose-500/10">
                          Sold Out
                        </Badge>
                      )}
                      {ev.requireApproval && (
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500 bg-amber-500/10">
                          Approval Required
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 font-mono"
                      >
                        <span className="truncate max-w-xs">{ev.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      {ev.date && <span>📅 {ev.date}</span>}
                      {registrationsCount > 0 && (
                        <span className="text-emerald-500 font-semibold">
                          ✓ {registrationsCount} Registered
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Category Assignment */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={editingCategory}
                          onChange={(e) => setEditingCategory(e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-background border border-primary text-xs font-semibold text-foreground outline-none"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleSaveEventCategory(ev.id)}
                          className="p-1 rounded-lg bg-primary text-primary-foreground cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEventId(null)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEventId(ev.id);
                          setEditingCategory(ev.category || "General");
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Change Category"
                      >
                        <Tag className="w-3 h-3 text-amber-500" />
                        <span>{ev.category || "General"}</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(ev.id, ev.title)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
