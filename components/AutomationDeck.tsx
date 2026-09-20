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
    recentLogs: RunnerLog[];
  };
  activeDeckTab: "matrix" | "logs" | "nonsubmitted";
  setActiveDeckTab: (tab: "matrix" | "logs" | "nonsubmitted") => void;
  onStartAutomation: (selectedEventIds?: number[]) => void;
  onPauseAutomation: () => void;
  onResumeAutomation: () => void;
  onStopAutomation: () => void;
  onRefreshEvents: () => void;
  isLoadingEvents: boolean;
  selectedAttendeeId: string;
}

export default function AutomationDeck({
  attendees,
  events,
  metrics,
  runnerStatus,
  activeDeckTab,
  setActiveDeckTab,
  onStartAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  onRefreshEvents,
  isLoadingEvents,
  selectedAttendeeId,
}: AutomationDeckProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "closed" | "open">("all");
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toString().includes(search);

    if (!matchesSearch) return false;
    if (statusFilter === "closed") return e.soldOut || e.id === 23;
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

  const getStatusBadge = (status?: string, soldOut?: boolean) => {
    if (soldOut) {
      return (
        <Badge variant="destructive" className="text-[10px]">
          Closed
        </Badge>
      );
    }
    if (status === "confirmed_success") {
      return (
        <Badge variant="success" className="text-[10px] gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Confirmed</span>
        </Badge>
      );
    }
    if (status === "waitlist_joined") {
      return (
        <Badge variant="warning" className="text-[10px]">
          Waitlist
        </Badge>
      );
    }
    if (status === "custom_info_needed") {
      return (
        <Badge variant="warning" className="text-[10px]">
          Action Needed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px] text-muted-foreground">
        Queued
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Metric Cards Top Banner */}
      <div className="p-4 md:px-8 border-b border-border bg-card/60 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1 */}
        <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Confirmed
            </p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {metrics.totalConfirmed}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                / {metrics.totalEvents}
              </span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Waitlists
            </p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {metrics.totalWaitlisted}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Anti-Bot Pacing
            </p>
            <p className="text-xl font-bold text-primary mt-0.5 flex items-center gap-1.5">
              <span>18s–26s</span>
              <span className="text-xs">🐢</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Runner State
            </p>
            <p
              className={`text-sm font-bold mt-1 ${
                runnerStatus.isRunning
                  ? runnerStatus.isPaused
                    ? "text-amber-600"
                    : "text-emerald-600 animate-pulse"
                  : "text-muted-foreground"
              }`}
            >
              {runnerStatus.isRunning
                ? runnerStatus.isPaused
                  ? "Paused"
                  : "Active Batch"
                : "Standby"}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
            <Coffee className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Control Bar & Tabs */}
      <div className="px-4 md:px-8 py-3 border-b border-border bg-card/40 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-2xl border border-border">
          <button
            onClick={() => setActiveDeckTab("matrix")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeDeckTab === "matrix"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Registration Matrix</span>
          </button>

          <button
            onClick={() => setActiveDeckTab("nonsubmitted")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeDeckTab === "nonsubmitted"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Non-Submitted ({events.length - metrics.totalConfirmed})</span>
          </button>

          <button
            onClick={() => setActiveDeckTab("logs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeDeckTab === "logs"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Live Terminal</span>
          </button>
        </div>

        {/* Runner Action Controls */}
        <div className="flex items-center gap-2">
          {!runnerStatus.isRunning ? (
            <Button
              onClick={() => onStartAutomation(selectedEvents.length > 0 ? selectedEvents : undefined)}
              className="rounded-2xl gap-1.5 font-semibold text-xs shadow-xs"
              size="sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {selectedEvents.length > 0
                  ? `Run Selected (${selectedEvents.length})`
                  : "Run Batch"}
              </span>
            </Button>
          ) : runnerStatus.isPaused ? (
            <Button
              onClick={onResumeAutomation}
              variant="default"
              className="rounded-2xl gap-1.5 font-semibold text-xs bg-emerald-600 hover:bg-emerald-500"
              size="sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </Button>
          ) : (
            <Button
              onClick={onPauseAutomation}
              variant="default"
              className="rounded-2xl gap-1.5 font-semibold text-xs bg-amber-600 hover:bg-amber-500"
              size="sm"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </Button>
          )}

          {runnerStatus.isRunning && (
            <Button
              onClick={onStopAutomation}
              variant="destructive"
              className="rounded-2xl gap-1.5 font-semibold text-xs"
              size="sm"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshEvents}
            disabled={isLoadingEvents}
            className="rounded-xl text-xs border-border bg-card"
            title="Refresh database records"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${
                isLoadingEvents ? "animate-spin" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {/* TAB 1: REGISTRATION MATRIX */}
        {activeDeckTab === "matrix" && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${events.length} events...`}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1 rounded-xl cursor-pointer font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-foreground text-background"
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
                                {getStatusBadge(reg?.status, ev.soldOut || ev.id === 23)}
                              </td>
                            );
                          })}
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
                className="rounded-xl text-xs font-semibold"
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
                      className="rounded-xl text-xs border-border flex-shrink-0"
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
            <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-2xs">
              <div className="p-3 border-b border-border bg-muted/40 flex items-center justify-between text-xs font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span>Real-Time Playwright & MiniMax Execution Stream</span>
                </div>
                <Badge variant={runnerStatus.isRunning ? "success" : "secondary"}>
                  {runnerStatus.isRunning ? "STREAMING" : "IDLE"}
                </Badge>
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
    </div>
  );
}
