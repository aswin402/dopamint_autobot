"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Tv,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ExternalLink,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  Brain,
  Check,
  Send,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RunnerStatus {
  isRunning: boolean;
  isPaused: boolean;
  isHeadless?: boolean;
  isHumanInterventionNeeded?: boolean;
  humanInterventionReason?: string | null;
  pendingIntervention?: {
    id: string;
    fieldLabel: string;
    fieldType: string;
    options?: string[];
    attendeeName?: string;
    attendeeEmail?: string;
    eventTitle?: string;
    targetUrl?: string;
  } | null;
  currentEvent?: any;
  currentAttendee?: any;
  currentTitle?: string;
  currentUrl?: string;
  latestFrame?: string | null;
  progress?: {
    completed: number;
    total: number;
    percent: number;
    successCount: number;
    failedCount: number;
    remainingCount: number;
  };
  recentLogs?: any[];
}

interface UserLiveMonitorPageProps {
  runnerStatus: RunnerStatus;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  onPauseAutomation?: () => Promise<void> | void;
  onResumeAutomation?: () => Promise<void> | void;
  onStopAutomation?: () => Promise<void> | void;
  onNavigateToForm?: () => void;
  attendees?: any[];
}

export function UserLiveMonitorPage({
  runnerStatus,
  isVisualMode = false,
  onToggleVisualMode,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  onNavigateToForm,
  attendees = [],
}: UserLiveMonitorPageProps) {
  // HITL intervention state
  const [interventionValue, setInterventionValue] = useState<string>("");
  const [interventionRemember, setInterventionRemember] = useState<boolean>(true);
  const [isSubmittingIntervention, setIsSubmittingIntervention] = useState(false);
  const [interventionToast, setInterventionToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const pendingIntervention = runnerStatus?.pendingIntervention;
  const isInterventionVisible = Boolean(
    runnerStatus?.isHumanInterventionNeeded || runnerStatus?.pendingIntervention
  );

  // Pre-fill intervention default if options exist
  useEffect(() => {
    if (pendingIntervention?.options && pendingIntervention.options.length > 0) {
      setInterventionValue(pendingIntervention.options[0]);
    } else {
      setInterventionValue("");
    }
  }, [pendingIntervention?.id]);

  // Handle HITL Submission
  const handleSubmitIntervention = async (customVal?: string) => {
    const finalVal = customVal !== undefined ? customVal : interventionValue;
    if (!finalVal.trim() && pendingIntervention?.fieldType !== "checkbox") {
      setInterventionToast({ type: "error", message: "Please provide an answer before resuming." });
      return;
    }

    setIsSubmittingIntervention(true);
    setInterventionToast(null);

    try {
      const res = await fetch("/api/automation/intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interventionId: pendingIntervention?.id,
          value: finalVal,
          remember: interventionRemember,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit answer.");

      setInterventionToast({
        type: "success",
        message: "Answer submitted! Automation resumed on live form.",
      });
      setTimeout(() => setInterventionToast(null), 4000);
    } catch (err: any) {
      setInterventionToast({ type: "error", message: err.message || "Failed to resolve intervention." });
    } finally {
      setIsSubmittingIntervention(false);
    }
  };

  const progress = runnerStatus?.progress || {
    completed: 0,
    total: 0,
    percent: 0,
    successCount: 0,
    failedCount: 0,
    remainingCount: 0,
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Live Automation Monitor</span>
                {runnerStatus?.isRunning ? (
                  <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-mono animate-pulse">
                    Live Engine Active
                  </Badge>
                ) : runnerStatus?.isPaused ? (
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] uppercase font-mono">
                    Paused at Checkpoint
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase font-mono text-muted-foreground">
                    Idle
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time Playwright screencast and background form filling execution.
              </p>
            </div>
          </div>
        </div>

        {/* Play / Pause / Stop Controls */}
        <div className="flex items-center gap-2">
          {onToggleVisualMode && (
            <button
              type="button"
              onClick={onToggleVisualMode}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isVisualMode
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-500 shadow-2xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={isVisualMode ? "Chromium Window Visible on Desktop" : "Running Headless in Background"}
            >
              {isVisualMode ? <Eye className="w-4 h-4 text-amber-500 animate-pulse" /> : <EyeOff className="w-4 h-4" />}
            </button>
          )}

          {runnerStatus?.isRunning && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPauseAutomation && onPauseAutomation()}
              className="text-xs h-9 rounded-xl border-amber-500/40 text-amber-500 hover:bg-amber-500/10 gap-1.5 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </Button>
          )}

          {runnerStatus?.isPaused && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResumeAutomation && onResumeAutomation()}
              className="text-xs h-9 rounded-xl border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </Button>
          )}

          {(runnerStatus?.isRunning || runnerStatus?.isPaused) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStopAutomation && onStopAutomation()}
              className="text-xs h-9 rounded-xl border-rose-500/40 text-rose-500 hover:bg-rose-500/10 gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </Button>
          )}
        </div>
      </div>

      {/* METRICS COUNTERS (Completed, Remaining, Errors, Members) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Completed */}
        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {progress.successCount || progress.completed || 0}
          </div>
          <div className="text-[10px] text-muted-foreground">Confirmed registrations</div>
        </div>

        {/* Remaining */}
        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Remaining</span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {progress.remainingCount || Math.max(0, (progress.total || 0) - (progress.completed || 0))}
          </div>
          <div className="text-[10px] text-muted-foreground">Queued in batch</div>
        </div>

        {/* Errors */}
        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Errors</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-500 font-mono">
            {progress.failedCount || 0}
          </div>
          <div className="text-[10px] text-muted-foreground">Failed attempts</div>
        </div>

        {/* Member */}
        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Target Member</span>
            <User className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base font-bold text-foreground truncate">
            {runnerStatus?.currentAttendee?.name || attendees[0]?.name || "Autonomous Bot"}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {runnerStatus?.currentAttendee?.email || attendees[0]?.email || "Single Attendee"}
          </div>
        </div>
      </div>

      {/* HUMAN-IN-THE-LOOP (HITL) FLOATING RADAR BANNER */}
      {isInterventionVisible && pendingIntervention && (
        <div className="rounded-3xl p-6 bg-gradient-to-r from-amber-500/15 via-background to-amber-950/20 border-2 border-amber-500 shadow-xl backdrop-blur-xl animate-in zoom-in-95 duration-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/30">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
                ⚠️ HUMAN INTERVENTION REQUIRED (PAUSED)
              </span>
            </div>

            <span className="text-xs text-muted-foreground font-mono">
              Target: {pendingIntervention.eventTitle || "Luma Event"}
            </span>
          </div>

          <div className="space-y-3">
            <div className="text-sm sm:text-base font-bold text-foreground">
              {pendingIntervention.fieldLabel || "Please supply answer for required field:"}
            </div>

            {/* Options Pills if available */}
            {pendingIntervention.options && pendingIntervention.options.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {pendingIntervention.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setInterventionValue(opt);
                      handleSubmitIntervention(opt);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      interventionValue === opt
                        ? "bg-amber-500 text-black border-amber-400 font-bold shadow-md"
                        : "bg-background hover:bg-muted text-foreground border-border hover:border-amber-500/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Text input if no options or custom input */}
            {(!pendingIntervention.options || pendingIntervention.options.length === 0) && (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  autoFocus
                  value={interventionValue}
                  onChange={(e) => setInterventionValue(e.target.value)}
                  placeholder="Type your answer here..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitIntervention();
                  }}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-background border border-amber-500/60 text-xs text-foreground outline-none focus:ring-1 focus:ring-amber-500"
                />
                <Button
                  onClick={() => handleSubmitIntervention()}
                  disabled={isSubmittingIntervention}
                  className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 bg-amber-500 text-black hover:bg-amber-400 cursor-pointer shadow-xs"
                >
                  {isSubmittingIntervention ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Resume</span>
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="rememberCheckbox"
                checked={interventionRemember}
                onChange={(e) => setInterventionRemember(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-500 cursor-pointer"
              />
              <label htmlFor="rememberCheckbox" className="text-[11px] text-muted-foreground cursor-pointer">
                Remember this answer for similar form questions automatically
              </label>
            </div>
          </div>
        </div>
      )}

      {/* LIVE SCREENCAST VIEWPORT */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col">
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {runnerStatus?.isRunning ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
              )}
            </span>
            <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
              Live Chromium Browser Viewport
            </span>
          </div>

          <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            <span>
              {isVisualMode ? "🖥️ Headed Window Active" : "🥷 Stealth Screencast"}
            </span>
            {runnerStatus?.currentUrl && (
              <a
                href={runnerStatus.currentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Event URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Canvas or Frame */}
        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
          {runnerStatus?.latestFrame ? (
            <img
              src={
                runnerStatus.latestFrame.startsWith("data:")
                  ? runnerStatus.latestFrame
                  : `data:image/jpeg;base64,${runnerStatus.latestFrame}`
              }
              alt="Playwright Screencast Frame"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center space-y-3 p-8">
              <Tv className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <div className="text-xs font-semibold text-muted-foreground">
                {runnerStatus?.isRunning
                  ? "Streaming browser frame from background engine..."
                  : "No active automation run. Start a batch from the Form page."}
              </div>
              {!runnerStatus?.isRunning && onNavigateToForm && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onNavigateToForm}
                  className="text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                >
                  Configure & Start Automation &rarr;
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RECENT LOG TERMINAL */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
              Live Execution Feed
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            {runnerStatus?.recentLogs?.length || 0} events logged
          </span>
        </div>

        <div className="p-4 bg-muted/20 font-mono text-[11px] max-h-44 overflow-y-auto custom-scrollbar space-y-1.5">
          {runnerStatus?.recentLogs && runnerStatus.recentLogs.length > 0 ? (
            runnerStatus.recentLogs.slice(-15).map((log: any, idx: number) => {
              const text = typeof log === "string" ? log : log.message || JSON.stringify(log);
              return (
                <div key={idx} className="flex items-start gap-2 text-foreground/80 leading-relaxed">
                  <span className="text-muted-foreground select-none">&gt;</span>
                  <span>{text}</span>
                </div>
              );
            })
          ) : (
            <div className="text-muted-foreground/60 italic">Waiting for runner events...</div>
          )}
        </div>
      </div>
    </div>
  );
}
