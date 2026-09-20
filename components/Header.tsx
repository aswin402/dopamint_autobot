"use client";

import React from "react";
import { Bot, Sparkles, ExternalLink, Play, Pause, RefreshCw } from "lucide-react";

interface HeaderProps {
  metrics: {
    totalEvents: number;
    totalAttendees: number;
    totalConfirmed: number;
    completionRate: number;
  };
  runnerStatus: {
    isRunning: boolean;
    isPaused: boolean;
  };
  onSyncSheets: () => void;
  isSyncingSheets: boolean;
}

export default function Header({
  metrics,
  runnerStatus,
  onSyncSheets,
  isSyncingSheets,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Dopamint AutoBot
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                AaaS v1.0
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Autonomous Web Form & Event Registration Engine
          </p>
        </div>
      </div>

      {/* Model & System Health Badges */}
      <div className="hidden md:flex items-center gap-3">
        {/* Model Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Model:</span>
          <span className="font-semibold text-indigo-300">MiniMax-Text-01</span>
        </div>

        {/* Hono Backend Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Backend:</span>
          <span className="font-semibold text-emerald-300">Hono :4000</span>
        </div>

        {/* Runner Status Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
            runnerStatus.isRunning
              ? runnerStatus.isPaused
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-slate-900 border-slate-800 text-slate-400"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              runnerStatus.isRunning
                ? runnerStatus.isPaused
                  ? "bg-amber-400"
                  : "bg-emerald-400 animate-ping"
                : "bg-slate-500"
            }`}
          />
          <span>
            {runnerStatus.isRunning
              ? runnerStatus.isPaused
                ? "Paused"
                : "Automation Active"
              : "Engine Idle"}
          </span>
        </div>

        {/* Google Sheet Direct Link & Sync Button */}
        <button
          onClick={onSyncSheets}
          disabled={isSyncingSheets}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-emerald-400 ${
              isSyncingSheets ? "animate-spin" : ""
            }`}
          />
          <span>{isSyncingSheets ? "Syncing..." : "Sync Sheet"}</span>
        </button>

        <a
          href="https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-400 transition-all font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Live Spreadsheet</span>
        </a>
      </div>
    </header>
  );
}
