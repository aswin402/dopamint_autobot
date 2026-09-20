"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Play,
  Pause,
  Square,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Terminal,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  User,
  Ticket,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RunnerStatusData {
  isRunning: boolean;
  isPaused: boolean;
  isHeadless?: boolean;
  activeJobId?: string | null;
  currentEvent?: { id: number; title: string; url: string } | null;
  currentAttendee?: { id: string; name: string; email: string } | null;
  progress?: {
    completed: number;
    total: number;
    percent: number;
    successCount?: number;
    failedCount?: number;
    waitlistCount?: number;
    skippedCount?: number;
    remainingCount?: number;
  };
  stealthMetrics?: {
    stealthActive: boolean;
    webdriverMasked: boolean;
    humanJitterPacing: string;
    viewport: string;
    botScoreEvasion: string;
  };
  recentConfirmations?: Array<{
    eventId: number;
    eventTitle: string;
    attendeeName: string;
    timestamp: string;
  }>;
  recentLogs?: Array<{
    timestamp: string;
    level: "info" | "success" | "warn" | "error";
    message: string;
  }>;
}

interface AutomationMonitorPanelProps {
  onStartAutomation?: () => void;
  onPauseAutomation?: () => void;
  onResumeAutomation?: () => void;
  onStopAutomation?: () => void;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  className?: string;
}

export const AutomationMonitorPanel: React.FC<AutomationMonitorPanelProps> = ({
  onStartAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  isVisualMode = false,
  onToggleVisualMode,
  className = "",
}) => {
  const [status, setStatus] = useState<RunnerStatusData>({
    isRunning: false,
    isPaused: false,
    isHeadless: true,
    recentLogs: [],
    recentConfirmations: [],
  });
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Poll status from /api/automation/status
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/automation/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setStatus(data);
          }
        }
      } catch {
        // silently fallback
      }
    };

    fetchStatus();
    // Poll faster when running (1.5s), slower when idle (3.5s)
    const interval = setInterval(fetchStatus, status.isRunning ? 1500 : 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [status.isRunning]);

  // Collapsed Sidebar View (Rail mode)
  if (isCollapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-between py-4 px-2 border-l border-border bg-card/60 w-12 shrink-0 h-full transition-all select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Expand Automation Monitor"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-3 py-6">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              status.isRunning
                ? "bg-emerald-500 animate-ping"
                : status.isPaused
                ? "bg-amber-500"
                : "bg-muted-foreground/40"
            }`}
          />
          <span className="[writing-mode:vertical-rl] text-[10px] uppercase font-bold tracking-widest text-muted-foreground select-none">
            Monitor
          </span>
          <span className="text-[10px] font-mono font-bold text-foreground mt-2">
            {status.progress?.completed || 0}/{status.progress?.total || 0}
          </span>
        </div>

        <div className="w-2" />
      </div>
    );
  }

  const completed = status.progress?.completed || 0;
  const total = status.progress?.total || 0;
  const percent = status.progress?.percent || 0;
  const successCount = status.progress?.successCount || 0;
  const failedCount = status.progress?.failedCount || 0;
  const remainingCount =
    status.progress?.remainingCount ?? Math.max(0, total - completed);

  return (
    <aside
      className={`hidden lg:flex flex-col border-l border-border bg-card/80 backdrop-blur-md w-80 xl:w-96 shrink-0 h-full overflow-hidden transition-all text-xs select-none ${className}`}
    >
      {/* 1. Top Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Activity
              className={`w-4 h-4 ${
                status.isRunning ? "text-emerald-600 animate-pulse" : "text-primary"
              }`}
            />
            {status.isRunning && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-foreground text-xs leading-none">
              Automation Monitor
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Live Bulk Registration Agent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            variant={
              status.isRunning
                ? status.isHeadless === false
                  ? "warning"
                  : "success"
                : status.isPaused
                ? "warning"
                : "secondary"
            }
            className="text-[10px] px-2 py-0.5 font-bold"
          >
            {status.isPaused
              ? "PAUSED"
              : status.isRunning
              ? status.isHeadless === false
                ? "👁️ WATCHING"
                : "RUNNING"
              : "IDLE"}
          </Badge>

          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
            title="Collapse panel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 2. Core Operational Metrics: Done, Success, Failed, Remaining */}
        <div className="p-3.5 rounded-2xl bg-card border border-border space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Batch Progress</span>
            </span>
            <span className="font-mono text-foreground font-bold text-xs">
              {percent}% Completed
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* 4 Essential KPI Cards */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Processed / Done */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Processed
                </span>
                <span className="text-sm font-bold text-foreground font-mono">
                  {completed}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {" "}
                    / {total}
                  </span>
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Success / Confirmed */}
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-wider block">
                  Success
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {successCount}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Failed / Errors */}
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold tracking-wider block">
                  Failed
                </span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {failedCount}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Remaining / Queue */}
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold tracking-wider block">
                  Remaining
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {remainingCount}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Execution Controls */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Controls</span>

            {/* Watch Live Visual Toggle */}
            {onToggleVisualMode && (
              <button
                type="button"
                onClick={onToggleVisualMode}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                  isVisualMode
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
                title="Launch headed Chromium window on screen"
              >
                {isVisualMode ? (
                  <>
                    <Eye className="w-3 h-3 text-amber-500 animate-pulse" />
                    <span>Watch Live: ON</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3 text-muted-foreground" />
                    <span>Watch Live: OFF</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!status.isRunning ? (
              <Button
                onClick={() => onStartAutomation?.()}
                size="sm"
                className="w-full rounded-xl text-xs font-bold gap-2 h-9 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch Automation Batch</span>
              </Button>
            ) : (
              <>
                {status.isPaused ? (
                  <Button
                    onClick={() => onResumeAutomation?.()}
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl text-xs font-semibold gap-1.5 h-9 border-emerald-500 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => onPauseAutomation?.()}
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl text-xs font-semibold gap-1.5 h-9 border-amber-500 text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </Button>
                )}

                <Button
                  onClick={() => onStopAutomation?.()}
                  size="sm"
                  variant="destructive"
                  className="rounded-xl text-xs font-semibold gap-1.5 h-9 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 4. Active Target (Shows dynamically when runner is processing) */}
        {status.isRunning && status.currentEvent && (
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Active Target Event
              </span>
              {status.currentEvent.url && (
                <a
                  href={status.currentEvent.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <span>Open URL</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            <div className="font-semibold text-xs text-foreground truncate">
              {status.currentEvent.title}
            </div>

            {status.currentAttendee && (
              <div className="pt-1.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 truncate">
                  <User className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {status.currentAttendee.name}
                  </span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {status.currentAttendee.email}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 5. Anti-Bot Stealth Badge (Clean & Subtle) */}
        <div className="px-3 py-2 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center justify-between text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Anti-Bot Stealth Protection</span>
          </div>
          <span className="text-[10px] font-semibold font-mono bg-emerald-500/15 px-1.5 py-0.5 rounded">
            99.8% Human Pacing
          </span>
        </div>

        {/* 6. Recent Confirmations Feed */}
        {status.recentConfirmations && status.recentConfirmations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                <span>Recent Confirmations</span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {status.recentConfirmations.length} confirmed
              </span>
            </div>

            <div className="space-y-1.5">
              {status.recentConfirmations.slice(0, 4).map((c, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-[11px] text-foreground truncate">
                      {c.eventTitle}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      <span>{c.attendeeName}</span>
                    </div>
                  </div>
                  <Badge variant="olive" className="text-[9px] px-1.5 py-0 font-mono">
                    Confirmed
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Real-Time Execution Log Stream */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>Real-Time Logs</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {status.recentLogs?.length || 0} entries
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-muted/40 border border-border font-mono text-[10px] max-h-48 overflow-y-auto space-y-1.5">
            {!status.recentLogs || status.recentLogs.length === 0 ? (
              <div className="text-muted-foreground text-center py-6">
                No active automation logs. Trigger batch registration from chat or matrix.
              </div>
            ) : (
              status.recentLogs.slice(-20).map((log, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-1.5 leading-tight ${
                    log.level === "error"
                      ? "text-rose-600 dark:text-rose-400"
                      : log.level === "success"
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : log.level === "warn"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-foreground/90"
                  }`}
                >
                  <span className="text-muted-foreground/60 select-none shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
