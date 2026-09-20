"use client";

import React, { useState } from "react";
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Search,
  Terminal,
  Grid,
  Users,
  FileQuestion,
  RefreshCw,
  ShieldCheck,
  Coffee,
  Check,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  Download,
  X,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Attendee {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  telegram?: string;
  twitter?: string;
  linkedin?: string;
  wallets?: string;
}

interface EventItem {
  id: number;
  title: string;
  url: string;
  date?: string;
  platform?: string;
  soldOut: boolean;
  registrations: {
    attendeeId: string;
    status: string;
    serverStatus?: number;
  }[];
}

interface RunnerLog {
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

interface AutomationDeckProps {
  attendees: Attendee[];
  events: EventItem[];
  metrics: {
    totalEvents: number;
    totalAttendees: number;
    totalConfirmed: number;
    totalWaitlisted: number;
    completionRate: number;
  };
  runnerStatus: {
    isRunning: boolean;
    isPaused: boolean;
    isHeadless?: boolean;
    recentLogs: RunnerLog[];
  };
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  activeDeckTab: "matrix" | "logs" | "nonsubmitted";
  setActiveDeckTab: (tab: "matrix" | "logs" | "nonsubmitted") => void;
  onStartAutomation: (selectedEventIds?: number[]) => void;
  onPauseAutomation: () => void;
  onResumeAutomation: () => void;
  onStopAutomation: () => void;
  onRefreshEvents: () => void;
  isLoadingEvents: boolean;
  selectedAttendeeId: string;
  onOpenExport?: (dataset?: "matrix" | "confirmed" | "roster" | "events") => void;
}

export default function AutomationDeck({
  attendees,
  events,
  metrics,
  runnerStatus,
  isVisualMode = false,
  onToggleVisualMode,
  activeDeckTab,
  setActiveDeckTab,
  onStartAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  onRefreshEvents,
  isLoadingEvents,
  selectedAttendeeId,
  onOpenExport,
}: AutomationDeckProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "closed" | "open">("all");
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);

  // Event CRUD State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<"create" | "edit">("create");
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    url: "",
    date: "",
    platform: "luma",
    soldOut: false,
  });
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<EventItem | null>(null);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  // Cell Override State
  const [overrideModalCell, setOverrideModalCell] = useState<{
    eventId: number;
    eventTitle: string;
    attendeeId: string;
    attendeeName: string;
    currentStatus?: string;
  } | null>(null);
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toString().includes(search);

    if (!matchesSearch) return false;
    if (statusFilter === "closed") return e.soldOut;
    if (statusFilter === "confirmed") {
      return e.registrations.some((r) => r.status === "confirmed_success");
    }
    if (statusFilter === "open") {
      return !e.soldOut && !e.registrations.some((r) => r.status === "confirmed_success");
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedEvents.length === filteredEvents.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(filteredEvents.map((e) => e.id));
    }
  };

  const toggleSelectEvent = (id: number) => {
    setSelectedEvents((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenCreateEvent = () => {
    setEventModalMode("create");
    setEditingEventId(null);
    setEventForm({
      title: "",
      url: "",
      date: "",
      platform: "luma",
      soldOut: false,
    });
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (ev: EventItem) => {
    setEventModalMode("edit");
    setEditingEventId(ev.id);
    setEventForm({
      title: ev.title,
      url: ev.url,
      date: ev.date || "",
      platform: ev.platform || "luma",
      soldOut: ev.soldOut,
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.url.trim()) {
      alert("Event Title and URL are required.");
      return;
    }

    setIsSubmittingEvent(true);
    try {
      if (eventModalMode === "create") {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create event");
      } else {
        const res = await fetch(`/api/events/${editingEventId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update event");
      }

      setIsEventModalOpen(false);
      onRefreshEvents();
    } catch (err: any) {
      alert(err.message || "Failed to save event");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirmEvent) return;
    setIsSubmittingEvent(true);
    try {
      const res = await fetch(`/api/events/${deleteConfirmEvent.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete event");

      setDeleteConfirmEvent(null);
      onRefreshEvents();
    } catch (err: any) {
      alert(err.message || "Failed to delete event");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleOverrideStatus = async (newStatus: string) => {
    if (!overrideModalCell) return;
    setIsSubmittingOverride(true);
    try {
      const res = await fetch("/api/registrations/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: overrideModalCell.eventId,
          attendeeId: overrideModalCell.attendeeId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      setOverrideModalCell(null);
      onRefreshEvents();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const getStatusBadge = (status?: string, soldOut?: boolean) => {
    if (soldOut) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          Closed
        </span>
      );
    }
    if (status === "confirmed_success") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <Check className="w-2.5 h-2.5" />
          Confirmed
        </span>
      );
    }
    if (status === "waitlist_joined") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
          Waitlist
        </span>
      );
    }
    if (status === "queued") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
          Queued
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground/60">
        —
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Automation Matrix</span>
            <Badge variant="secondary" className="text-xs">
              {metrics.totalEvents} Events
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time cross-attendee registration status, batch executor & logs.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Event Button */}
          <Button
            onClick={handleOpenCreateEvent}
            size="sm"
            className="rounded-2xl gap-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event</span>
          </Button>

          {/* Export Matrix Button */}
          {onOpenExport && (
            <Button
              onClick={() => onOpenExport("matrix")}
              variant="outline"
              size="sm"
              className="rounded-2xl gap-1.5 text-xs border-border bg-card hover:bg-muted text-foreground cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Export Matrix</span>
            </Button>
          )}

          {/* Refresh Events */}
          <Button
            onClick={onRefreshEvents}
            disabled={isLoadingEvents}
            variant="outline"
            size="sm"
            className="rounded-2xl gap-1.5 text-xs border-border bg-card hover:bg-muted cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-primary ${
                isLoadingEvents ? "animate-spin" : ""
              }`}
            />
            <span>Refresh</span>
          </Button>

          {/* Start / Pause / Stop Runner buttons */}
          {!runnerStatus.isRunning ? (
            <Button
              onClick={() => onStartAutomation(selectedEvents.length > 0 ? selectedEvents : undefined)}
              size="sm"
              className="rounded-2xl gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {selectedEvents.length > 0
                  ? `Run (${selectedEvents.length})`
                  : "Run All"}
              </span>
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              {runnerStatus.isPaused ? (
                <Button
                  onClick={onResumeAutomation}
                  size="sm"
                  variant="outline"
                  className="rounded-2xl gap-1.5 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </Button>
              ) : (
                <Button
                  onClick={onPauseAutomation}
                  size="sm"
                  variant="outline"
                  className="rounded-2xl gap-1.5 text-xs border-amber-500 text-amber-600 hover:bg-amber-50 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </Button>
              )}

              <Button
                onClick={onStopAutomation}
                size="sm"
                variant="destructive"
                className="rounded-2xl gap-1.5 text-xs cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Sub-Tabs Header */}
      <div className="flex items-center gap-2 border-b border-border pb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveDeckTab("matrix")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
            activeDeckTab === "matrix"
              ? "bg-accent text-foreground font-bold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Matrix Table</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
            {events.length}
          </span>
        </button>

        <button
          onClick={() => setActiveDeckTab("nonsubmitted")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
            activeDeckTab === "nonsubmitted"
              ? "bg-accent text-foreground font-bold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileQuestion className="w-3.5 h-3.5" />
          <span>Non-Submitted</span>
        </button>

        <button
          onClick={() => setActiveDeckTab("logs")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
            activeDeckTab === "logs"
              ? "bg-accent text-foreground font-bold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Execution Stream</span>
          {runnerStatus.isRunning && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div>
        {/* TAB 1: MATRIX VIEW */}
        {activeDeckTab === "matrix" && (
          <div className="space-y-4">
            {/* Search & Status Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events by title or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-2xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1 rounded-xl cursor-pointer font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-accent text-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground bg-card border border-border"
                  }`}
                >
                  All ({events.length})
                </button>
                <button
                  onClick={() => setStatusFilter("open")}
                  className={`px-3 py-1 rounded-xl cursor-pointer font-medium transition-all ${
                    statusFilter === "open"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground bg-card border border-border"
                  }`}
                >
                  Open / Pending
                </button>
                <button
                  onClick={() => setStatusFilter("confirmed")}
                  className={`px-3 py-1 rounded-xl cursor-pointer font-medium transition-all ${
                    statusFilter === "confirmed"
                      ? "bg-emerald-600 text-white"
                      : "text-muted-foreground hover:text-foreground bg-card border border-border"
                  }`}
                >
                  Confirmed ({metrics.totalConfirmed})
                </button>
                <button
                  onClick={() => setStatusFilter("closed")}
                  className={`px-3 py-1 rounded-xl cursor-pointer font-medium transition-all ${
                    statusFilter === "closed"
                      ? "bg-rose-600 text-white"
                      : "text-muted-foreground hover:text-foreground bg-card border border-border"
                  }`}
                >
                  Closed / Sold Out
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="rounded-3xl border border-border overflow-hidden bg-card shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedEvents.length === filteredEvents.length &&
                            filteredEvents.length > 0
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-border cursor-pointer accent-primary"
                        />
                      </th>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3 min-w-[260px]">Event Title</th>
                      {attendees.map((a) => (
                        <th key={a.id} className="p-3 text-center min-w-[110px]">
                          {a.name.split(" ")[0]}
                        </th>
                      ))}
                      <th className="p-3 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-foreground">
                    {filteredEvents.slice(0, 100).map((ev) => {
                      const isChecked = selectedEvents.includes(ev.id);
                      return (
                        <tr
                          key={ev.id}
                          className={`hover:bg-muted/40 transition-colors ${
                            isChecked ? "bg-accent/40" : ""
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectEvent(ev.id)}
                              className="rounded border-border cursor-pointer accent-primary"
                            />
                          </td>
                          <td className="p-3 font-mono text-center text-muted-foreground">
                            {ev.id}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                              >
                                {ev.title}
                              </a>
                              <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                            </div>
                            {ev.date && (
                              <span className="text-[10px] text-muted-foreground">
                                {ev.date}
                              </span>
                            )}
                          </td>

                          {/* Attendee status columns */}
                          {attendees.map((person) => {
                            const reg = ev.registrations.find(
                              (r) => r.attendeeId === person.id
                            );
                            return (
                              <td key={person.id} className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOverrideModalCell({
                                      eventId: ev.id,
                                      eventTitle: ev.title,
                                      attendeeId: person.id,
                                      attendeeName: person.name,
                                      currentStatus: reg?.status,
                                    })
                                  }
                                  className="cursor-pointer hover:scale-105 transition-transform"
                                  title="Click to override registration status"
                                >
                                  {getStatusBadge(reg?.status, ev.soldOut)}
                                </button>
                              </td>
                            );
                          })}

                          {/* Action column */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditEvent(ev)}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title="Edit Event"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmEvent(ev)}
                                className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Delete Event"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NON-SUBMITTED EVENTS */}
        {activeDeckTab === "nonsubmitted" && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-foreground text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Showing events that require special handling (approval-gated, wallet verification, or complex questionnaires).
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => onStartAutomation()}
                className="rounded-xl text-xs font-semibold cursor-pointer"
              >
                Attempt Auto-Registration
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {events
                .filter((e) => !e.registrations.some((r) => r.status === "confirmed_success"))
                .slice(0, 30)
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-3xl bg-card border border-border shadow-2xs hover:border-primary/40 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate">
                        #{ev.id} • {ev.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{ev.date || "Upcoming"}</span>
                        <span>•</span>
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <span>Open Form</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStartAutomation([ev.id])}
                      className="rounded-xl text-xs border-border flex-shrink-0 cursor-pointer"
                    >
                      Register Now
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: LIVE TERMINAL LOGS */}
        {activeDeckTab === "logs" && (
          <div className="space-y-3 max-w-5xl mx-auto">
            {isVisualMode && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-foreground">
                <div className="flex items-center gap-2.5">
                  <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                      Visual Headed Browser Mode Active:
                    </span>{" "}
                    <span className="text-muted-foreground">
                      An interactive Chromium window will open directly on your desktop with 150ms slowMo pacing so you can watch forms fill in real-time.
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-2xs">
              <div className="p-3 border-b border-border bg-muted/40 flex items-center justify-between text-xs font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span>Real-Time Playwright & MiniMax Execution Stream</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={runnerStatus.isHeadless === false ? "warning" : "secondary"} className="gap-1">
                    {runnerStatus.isHeadless === false ? (
                      <>
                        <Eye className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                        <span>Visual Window</span>
                      </>
                    ) : (
                      "Headless"
                    )}
                  </Badge>
                  <Badge variant={runnerStatus.isRunning ? "success" : "secondary"}>
                    {runnerStatus.isRunning ? "STREAMING" : "IDLE"}
                  </Badge>
                </div>
              </div>

              <div className="p-4 font-mono text-xs max-h-[520px] overflow-y-auto space-y-2 bg-background/50">
                {runnerStatus.recentLogs.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    No runner logs yet. Trigger an automation to stream logs here.
                  </div>
                ) : (
                  runnerStatus.recentLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 ${
                        log.level === "error"
                          ? "text-rose-600 dark:text-rose-400"
                          : log.level === "success"
                          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                          : log.level === "warn"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                      }`}
                    >
                      <span className="text-muted-foreground text-[10px] select-none shrink-0 mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event Create / Edit Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {eventModalMode === "create" ? "Add New Event" : "Edit Event Details"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Event listing used for matrix tracking and automated submissions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="e.g. Celestia Modular Meetup Bangalore"
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Registration URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={eventForm.url}
                  onChange={(e) => setEventForm({ ...eventForm, url: e.target.value })}
                  placeholder="https://lu.ma/event-slug"
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Date / Time</label>
                  <input
                    type="text"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    placeholder="e.g. Oct 24, 2026"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Platform</label>
                  <select
                    value={eventForm.platform}
                    onChange={(e) => setEventForm({ ...eventForm, platform: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="luma">Luma</option>
                    <option value="partiful">Partiful</option>
                    <option value="eventbrite">Eventbrite</option>
                    <option value="google_form">Google Form</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="soldOutCheck"
                  checked={eventForm.soldOut}
                  onChange={(e) => setEventForm({ ...eventForm, soldOut: e.target.checked })}
                  className="rounded border-border accent-rose-600 cursor-pointer"
                />
                <label htmlFor="soldOutCheck" className="text-xs text-foreground cursor-pointer font-medium">
                  Mark as Sold Out / Registration Closed
                </label>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEvent}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEvent
                    ? "Saving..."
                    : eventModalMode === "create"
                    ? "Add Event"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {deleteConfirmEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Delete Event?</h3>
                <p className="text-xs text-muted-foreground">Removes event #{deleteConfirmEvent.id}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConfirmEvent.title}"</span>? This will also remove any attendee registrations tied to it.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteConfirmEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={isSubmittingEvent}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmittingEvent ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cell Status Override Modal */}
      {overrideModalCell && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Update Status</h3>
                <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                  {overrideModalCell.attendeeName} • #{overrideModalCell.eventId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModalCell(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              Event: <span className="font-semibold text-foreground">{overrideModalCell.eventTitle}</span>
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Select New Status:</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleOverrideStatus("confirmed_success")}
                  disabled={isSubmittingOverride}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Confirmed Pass
                  </span>
                  <span className="text-[10px] font-mono">confirmed_success</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOverrideStatus("waitlist_joined")}
                  disabled={isSubmittingOverride}
                  className="w-full px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Waitlist Joined</span>
                  <span className="text-[10px] font-mono">waitlist_joined</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOverrideStatus("queued")}
                  disabled={isSubmittingOverride}
                  className="w-full px-3 py-2 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Queued for Processing</span>
                  <span className="text-[10px] font-mono">queued</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOverrideStatus("error")}
                  disabled={isSubmittingOverride}
                  className="w-full px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Mark as Failed / Error</span>
                  <span className="text-[10px] font-mono">error</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOverrideStatus("clear")}
                  disabled={isSubmittingOverride}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Reset / Clear Status</span>
                  <span className="text-[10px] font-mono">clear</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
