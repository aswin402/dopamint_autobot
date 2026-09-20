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
} from "lucide-react";

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
    completionRate: number;
  };
  runnerStatus: {
    isRunning: boolean;
    isPaused: boolean;
    recentLogs: RunnerLog[];
  };
  activeTab: "matrix" | "logs" | "nonsubmitted" | "team";
  setActiveTab: (tab: "matrix" | "logs" | "nonsubmitted" | "team") => void;
  onStartAutomation: () => void;
  onPauseAutomation: () => void;
  onResumeAutomation: () => void;
  onStopAutomation: () => void;
  onRefreshEvents: () => void;
  isLoadingEvents: boolean;
}

export default function AutomationDeck({
  attendees,
  events,
  metrics,
  runnerStatus,
  activeTab,
  setActiveTab,
  onStartAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  onRefreshEvents,
  isLoadingEvents,
}: AutomationDeckProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "closed">("all");

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toString().includes(search);

    if (!matchesSearch) return false;
    if (statusFilter === "closed") return e.soldOut || e.id === 23;
    if (statusFilter === "confirmed") {
      return e.registrations.some((r) => r.status === "confirmed_success");
    }
    return true;
  });

  const getStatusBadge = (status?: string, soldOut?: boolean) => {
    if (soldOut) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          ❌ Closed
        </span>
      );
    }
    if (status === "confirmed_success") {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>✅ Confirmed</span>
        </span>
      );
    }
    if (status === "waitlist_joined") {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          ⏳ Waitlist
        </span>
      );
    }
    if (status === "custom_info_needed") {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          ⚠️ Action Needed
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        ⏳ Queued
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Metric Cards Top Banner */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/30 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1 */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Confirmed
            </p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">
              {metrics.totalConfirmed}
              <span className="text-xs font-normal text-slate-500 ml-1">
                / {metrics.totalEvents * attendees.length}
              </span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Team Coverage
            </p>
            <p className="text-xl font-bold text-cyan-400 mt-0.5">
              {metrics.completionRate}%
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Human Pacing
            </p>
            <p className="text-xl font-bold text-indigo-400 mt-0.5 flex items-center gap-1.5">
              <span>18s–26s</span>
              <span className="text-xs">🐢</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Engine Mode
            </p>
            <p
              className={`text-sm font-bold mt-1 ${
                runnerStatus.isRunning
                  ? runnerStatus.isPaused
                    ? "text-amber-400"
                    : "text-emerald-400 animate-pulse"
                  : "text-slate-400"
              }`}
            >
              {runnerStatus.isRunning
                ? runnerStatus.isPaused
                  ? "Paused"
                  : "Active Running"
                : "Standby"}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
            <Coffee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar & Tabs */}
      <div className="px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "matrix"
                ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Registration Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab("nonsubmitted")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "nonsubmitted"
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Non-Submitted (33)</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal Logs</span>
          </button>

          <button
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "team"
                ? "bg-purple-500/10 text-purple-300 border border-purple-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team Personas (6)</span>
          </button>
        </div>

        {/* Runner Action Controls */}
        <div className="flex items-center gap-2">
          {!runnerStatus.isRunning ? (
            <button
              onClick={onStartAutomation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Launch Batch</span>
            </button>
          ) : runnerStatus.isPaused ? (
            <button
              onClick={onResumeAutomation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={onPauseAutomation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          {runnerStatus.isRunning && (
            <button
              onClick={onStopAutomation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={onRefreshEvents}
            disabled={isLoadingEvents}
            title="Refresh database records"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingEvents ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* TAB 1: REGISTRATION MATRIX */}
        {activeTab === "matrix" && (
          <div className="space-y-3">
            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search 148 events..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    statusFilter === "all"
                      ? "bg-slate-800 text-white font-medium"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All ({events.length})
                </button>
                <button
                  onClick={() => setStatusFilter("confirmed")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    statusFilter === "confirmed"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Confirmed (115)
                </button>
                <button
                  onClick={() => setStatusFilter("closed")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    statusFilter === "closed"
                      ? "bg-red-500/10 text-red-400 border border-red-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Closed / Sold Out
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3 min-w-[240px]">Event Title</th>
                      {attendees.map((a) => (
                        <th key={a.id} className="p-3 text-center min-w-[110px]">
                          {a.name.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {filteredEvents.slice(0, 100).map((ev) => (
                      <tr
                        key={ev.id}
                        className="hover:bg-slate-900/50 transition-colors"
                      >
                        <td className="p-3 font-mono text-center text-slate-500">
                          {ev.id}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-slate-200 hover:text-cyan-400 transition-colors line-clamp-1"
                            >
                              {ev.title}
                            </a>
                            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                          </div>
                          {ev.date && (
                            <span className="text-[10px] text-slate-500">
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NON-SUBMITTED EVENTS */}
        {activeTab === "nonsubmitted" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>33 Events Remaining:</strong> Categorized by exact reason and required inputs.
                </span>
              </div>
              <span className="text-[11px] font-mono">115 / 148 Verified</span>
            </div>

            <div className="space-y-2">
              {events
                .filter(
                  (e) =>
                    !e.registrations.some((r) => r.status === "confirmed_success")
                )
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px]">
                          #{ev.id}
                        </span>
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-200 hover:text-cyan-400 flex items-center gap-1"
                        >
                          {ev.title}
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </a>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {ev.url ? (ev.id === 23 || ev.soldOut ? "Sold Out" : "Custom Inputs") : "Private Event"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                      <p className="font-semibold text-slate-300 mb-0.5">
                        Required Action / Questions:
                      </p>
                      {ev.id === 82 && "Q1: Backpack alias, Q2: How long using Backpack (Stocks, Crypto)"}
                      {ev.id === 66 && "Q1: Token sale raise target in USD, Q2: Planned sale timing (e.g. Q1 2027)"}
                      {ev.id === 139 && "Q1: XRP wallet address (starts with r...), Q2: XRP holding confirmation"}
                      {ev.id === 117 && "Q1: BSC wallet address, Q2: RISEx / TurboFlow EVM trading wallet"}
                      {ev.id === 120 && "Q1: Arcus wallet address or high-volume Perp DEX address"}
                      {ev.id === 62 && "Q1: GitHub profile URL / username"}
                      {![82, 66, 139, 117, 120, 62].includes(ev.id) &&
                        (ev.url
                          ? "Standard profile and company bio ready for auto-submission."
                          : "Private closed-door event with no public Luma RSVP link.")}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: TERMINAL LOGS */}
        {activeTab === "logs" && (
          <div className="rounded-xl border border-slate-800 bg-black/90 p-4 font-mono text-xs text-slate-300 space-y-1.5 h-[500px] overflow-y-auto">
            <div className="text-slate-500 mb-3 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>// Dopamint AutoBot Real-Time Execution Log</span>
              <span>Pacing: 18s–26s</span>
            </div>
            {runnerStatus.recentLogs.length === 0 ? (
              <p className="text-slate-600">No active log output. Click 'Launch Batch' or instruct AutoBot in chat.</p>
            ) : (
              runnerStatus.recentLogs.map((l, i) => (
                <div key={i} className="flex gap-2 items-start leading-relaxed">
                  <span className="text-slate-600 shrink-0">
                    [{l.timestamp.split("T")[1].slice(0, 8)}]
                  </span>
                  <span
                    className={
                      l.level === "success"
                        ? "text-emerald-400"
                        : l.level === "warn"
                        ? "text-amber-400"
                        : l.level === "error"
                        ? "text-rose-400"
                        : "text-slate-300"
                    }
                  >
                    {l.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: TEAM PERSONAS */}
        {activeTab === "team" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attendees.map((person) => {
              let wallets: Record<string, string> = {};
              try {
                wallets = person.wallets ? JSON.parse(person.wallets) : {};
              } catch (e) {}

              return (
                <div
                  key={person.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {person.name}
                      </h4>
                      <p className="text-cyan-400 text-[11px]">
                        {person.role} • {person.company}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20 font-medium">
                      Active Profile
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-400 text-[11px] pt-1">
                    <p>
                      <strong>Email:</strong> {person.email}
                    </p>
                    <p>
                      <strong>Telegram:</strong> {person.telegram || "N/A"}
                    </p>
                    <p>
                      <strong>Twitter:</strong> {person.twitter || "N/A"}
                    </p>
                    <p className="font-mono text-emerald-400 truncate">
                      <strong>EVM Wallet:</strong>{" "}
                      {wallets.evm || "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8901"}
                    </p>
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
