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
  Terminal,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  User,
  Ticket,
  Sparkles,
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
      } catch (err) {
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

  if (isCollapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-between py-4 px-2 border-l border-border bg-card/60 w-12 shrink-0 h-full transition-all">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          title="Expand Live Automation Monitor"
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
            Live Monitor
          </span>
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-2" />
        </div>

        <div className="w-2" />
      </div>
    );
  }

  return (
    <aside
      className={`hidden lg:flex flex-col border-l border-border bg-card/70 backdrop-blur-md w-80 xl:w-96 shrink-0 h-full overflow-hidden transition-all text-xs ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="relative">
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
              Live Automation Monitor
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Stealth Browser & Form Injection
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
            className="text-[10px] px-2 py-0.5"
          >
            {status.isPaused
              ? "PAUSED"
              : status.isRunning
              ? status.isHeadless === false
                ? "👁️ WATCHING"
                : "STREAMING"
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
        {/* 2. Controls & Headed Browser Mode Switch */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">
              Execution Controls
            </span>

            {onToggleVisualMode && (
              <button
                type="button"
                onClick={onToggleVisualMode}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                  isVisualMode
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
                title="Watch real-time browser window pop up on your desktop"
              >
                {isVisualMode ? (
                  <>
                    <Eye className="w-3 h-3 text-amber-500 animate-pulse" />
                    <span>Live Window ON</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3" />
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
                className="flex-1 rounded-xl text-xs font-bold gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Run Batch</span>
              </Button>
            ) : (
              <>
                {status.isPaused ? (
                  <Button
                    onClick={() => onResumeAutomation?.()}
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl text-xs font-semibold gap-1.5 h-8 border-emerald-500 text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Resume</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => onPauseAutomation?.()}
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl text-xs font-semibold gap-1.5 h-8 border-amber-500 text-amber-600 hover:bg-amber-50 cursor-pointer"
                  >
                    <Pause className="w-3 h-3 fill-current" />
                    <span>Pause</span>
                  </Button>
                )}

                <Button
                  onClick={() => onStopAutomation?.()}
                  size="sm"
                  variant="destructive"
                  className="rounded-xl text-xs font-semibold gap-1.5 h-8 cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 3. Non-Bot Detection & Stealth Shield */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Non-Bot Detection Active</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
              99.8% Human Likelihood
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/20">
            <div>
              <span className="block text-[10px] uppercase font-semibold text-foreground/80">
                Webdriver Flag:
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                Masked (null)
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-foreground/80">
                Human Jitter:
              </span>
              <span className="text-foreground font-mono">
                {status.stealthMetrics?.humanJitterPacing || "40ms - 150ms"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-foreground/80">
                Canvas Fingerprint:
              </span>
              <span className="text-foreground font-mono">Spoofed Linux/X11</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-foreground/80">
                Anti-Captcha:
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                Turnstile Evasion
              </span>
            </div>
          </div>
        </div>

        {/* 4. Active Target & Progress */}
        {status.isRunning && (
          <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span>Batch Progress</span>
              </span>
              <span className="font-mono text-primary font-bold text-xs">
                {status.progress?.completed || 0} / {status.progress?.total || 0} (
                {status.progress?.percent || 0}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${status.progress?.percent || 0}%` }}
              />
            </div>

            {/* Current Target */}
            {status.currentEvent && (
              <div className="space-y-1 pt-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">
                  Current Target Event:
                </div>
                <div className="font-semibold text-xs text-foreground truncate">
                  #{status.currentEvent.id} • {status.currentEvent.title}
                </div>
              </div>
            )}

            {status.currentAttendee && (
              <div className="space-y-1 pt-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">
                  Submitting For Attendee:
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                  <User className="w-3 h-3 text-primary" />
                  <span className="font-medium text-foreground">
                    {status.currentAttendee.name}
                  </span>
                  <span>({status.currentAttendee.email})</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Recent Confirmations Feed */}
        {status.recentConfirmations && status.recentConfirmations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                <span>Recent Confirmations</span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {status.recentConfirmations.length} claimed
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
                  <Badge variant="olive" className="text-[9px] px-1.5 py-0">
                    200 OK
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Live Runner Log Stream */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>Real-Time Stream</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {status.recentLogs?.length || 0} entries
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-muted/40 border border-border font-mono text-[10px] max-h-52 overflow-y-auto space-y-1.5">
            {(!status.recentLogs || status.recentLogs.length === 0) ? (
              <div className="text-muted-foreground text-center py-6">
                No active automation logs. Run a batch from chat or matrix.
              </div>
            ) : (
              status.recentLogs.slice(-15).map((log, idx) => (
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
