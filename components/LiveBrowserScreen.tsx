"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Globe,
  RefreshCw,
  MousePointer,
  Crosshair,
  ShieldAlert,
  CheckCircle,
  ExternalLink,
  Maximize2,
  Minimize2,
  Keyboard,
  Send,
  Loader2,
  Tv,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface LiveBrowserStatus {
  isRunning: boolean;
  isPaused: boolean;
  isHeadless?: boolean;
  currentUrl?: string | null;
  currentTitle?: string | null;
  latestFrame?: string | null;
  isHumanInterventionNeeded?: boolean;
  humanInterventionReason?: string | null;
  currentEvent?: { id: number; title: string; url: string } | null;
  currentAttendee?: { id: string; name: string; email: string } | null;
}

interface LiveBrowserScreenProps {
  initialStatus?: LiveBrowserStatus;
  pollIntervalMs?: number;
  compact?: boolean;
  className?: string;
  onTakeoverResolved?: () => void;
}

interface ClickRipple {
  id: number;
  x: number;
  y: number;
}

export const LiveBrowserScreen: React.FC<LiveBrowserScreenProps> = ({
  initialStatus,
  pollIntervalMs,
  compact = false,
  className = "",
  onTakeoverResolved,
}) => {
  const [status, setStatus] = useState<LiveBrowserStatus>(
    initialStatus || {
      isRunning: false,
      isPaused: false,
      isHeadless: true,
      latestFrame: null,
      currentUrl: null,
      currentTitle: null,
      isHumanInterventionNeeded: false,
    }
  );

  const [isInteractive, setIsInteractive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showKeyboardDrawer, setShowKeyboardDrawer] = useState<boolean>(false);
  const [keyboardText, setKeyboardText] = useState<string>("");
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [ripples, setRipples] = useState<ClickRipple[]>([]);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const screenWrapperRef = useRef<HTMLDivElement>(null);

  // Sync initialStatus when provided by parent
  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
      if (initialStatus.isHumanInterventionNeeded) {
        setIsInteractive(true);
      }
    }
  }, [initialStatus]);

  // Polling loop for live frame & status
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/automation/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setStatus(data);
            if (data.isHumanInterventionNeeded && !isInteractive) {
              setIsInteractive(true);
            }
          }
        }
      } catch {
        // network fallback
      }
    };

    // If human intervention is needed or runner is running, poll very rapidly for live frames (400ms - 800ms)
    const intervalTime =
      pollIntervalMs ||
      (status.isHumanInterventionNeeded
        ? 400
        : status.isRunning
        ? 750
        : 2500);

    const timer = setInterval(fetchStatus, intervalTime);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [status.isRunning, status.isHumanInterventionNeeded, isInteractive, pollIntervalMs]);

  // Send action to /api/automation/interact
  const sendInteraction = useCallback(
    async (payload: { action: string; x?: number; y?: number; text?: string }) => {
      setIsInteracting(true);
      try {
        const res = await fetch("/api/automation/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.frame) {
          setStatus((prev) => ({ ...prev, latestFrame: data.frame }));
        }
        if (data.message) {
          setLastActionMessage(data.message);
          setTimeout(() => setLastActionMessage(null), 3000);
        }
        if (payload.action === "resume" && onTakeoverResolved) {
          onTakeoverResolved();
        }
      } catch (err: any) {
        setLastActionMessage(err.message || "Action failed");
        setTimeout(() => setLastActionMessage(null), 3000);
      } finally {
        setIsInteracting(false);
      }
    },
    [onTakeoverResolved]
  );

  // Handle clicking on the live browser viewport
  const handleViewportClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInteractive && !status.isHumanInterventionNeeded) {
      setIsInteractive(true);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Viewport native resolution is 1280x800
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    const targetX = Math.round(clickX * scaleX);
    const targetY = Math.round(clickY * scaleY);

    // Ripple visual feedback
    const rippleId = Date.now();
    setRipples((prev) => [...prev, { id: rippleId, x: clickX, y: clickY }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== rippleId));
    }, 700);

    // Dispatch remote click
    await sendInteraction({ action: "click", x: targetX, y: targetY });
  };

  // Track hover coordinates on canvas for crosshair feedback
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInteractive && !status.isHumanInterventionNeeded) {
      setHoverCoords(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round((e.clientX - rect.left) * (1280 / rect.width));
    const y = Math.round((e.clientY - rect.top) * (800 / rect.height));
    setHoverCoords({ x, y });
  };

  const handleMouseLeave = () => {
    setHoverCoords(null);
  };

  // Keyboard text submit
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyboardText.trim()) return;
    await sendInteraction({ action: "type", text: keyboardText });
    setKeyboardText("");
  };

  // Toggle Fullscreen on wrapper
  const toggleFullscreen = () => {
    if (!screenWrapperRef.current) return;
    if (!document.fullscreenElement) {
      screenWrapperRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const activeUrl = status.currentUrl || status.currentEvent?.url || "about:blank";
  const displayUrl =
    activeUrl.replace(/^https?:\/\//, "").slice(0, compact ? 28 : 48) +
    (activeUrl.length > (compact ? 28 : 48) ? "..." : "");

  return (
    <div
      ref={screenWrapperRef}
      className={`rounded-2xl border border-border bg-card shadow-lg flex flex-col overflow-hidden transition-all duration-300 ${
        isFullscreen ? "p-4 bg-background fixed inset-0 z-50 rounded-none" : ""
      } ${className}`}
    >
      {/* 1. Browser Chrome Header Bar */}
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between gap-2 shrink-0 select-none">
        {/* Mac Traffic Lights & Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <Badge
            variant={
              status.isHumanInterventionNeeded
                ? "destructive"
                : status.isRunning
                ? "success"
                : "secondary"
            }
            className="text-[9px] px-1.5 py-0 font-mono uppercase tracking-wider font-bold"
          >
            {status.isHumanInterventionNeeded ? (
              <span className="flex items-center gap-1 animate-pulse">
                <ShieldAlert className="w-2.5 h-2.5 text-amber-300" />
                <span>Verify Human</span>
              </span>
            ) : status.isRunning ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Live View</span>
              </span>
            ) : (
              <span>Standby</span>
            )}
          </Badge>
        </div>

        {/* Address Bar */}
        <div className="flex-1 max-w-md mx-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/80 border border-border/80 text-[11px] font-mono text-muted-foreground shadow-2xs truncate">
          <Globe className="w-3 h-3 text-primary shrink-0" />
          <span className="truncate text-foreground/85 font-medium">{displayUrl}</span>
          {activeUrl.startsWith("http") && (
            <a
              href={activeUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto p-0.5 hover:text-foreground text-muted-foreground transition-colors shrink-0"
              title="Open link in external tab"
            >
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Interactive Mode Button */}
          <button
            type="button"
            onClick={() => setIsInteractive(!isInteractive)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
              isInteractive || status.isHumanInterventionNeeded
                ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title="Toggle interactive mouse control. When active, clicks on the screen are forwarded directly to Chromium."
          >
            {isInteractive || status.isHumanInterventionNeeded ? (
              <>
                <Crosshair className="w-3 h-3 animate-pulse" />
                <span className="hidden sm:inline">Interactive Active</span>
              </>
            ) : (
              <>
                <MousePointer className="w-3 h-3" />
                <span className="hidden sm:inline">Click to Control</span>
              </>
            )}
          </button>

          {/* Text/Keyboard Injection Toggle */}
          <button
            type="button"
            onClick={() => setShowKeyboardDrawer(!showKeyboardDrawer)}
            className={`p-1.5 rounded-lg border text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
              showKeyboardDrawer
                ? "bg-primary/10 border-primary text-primary"
                : "border-border hover:bg-muted"
            }`}
            title="Send keyboard keystrokes to active page"
          >
            <Keyboard className="w-3 h-3" />
          </button>

          {/* Refresh Frame Button */}
          <button
            type="button"
            onClick={() => sendInteraction({ action: "refresh" })}
            disabled={isInteracting}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh snapshot frame"
          >
            <RefreshCw className={`w-3 h-3 ${isInteracting ? "animate-spin text-primary" : ""}`} />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 2. Human Verification Takeover Banner */}
      {status.isHumanInterventionNeeded && (
        <div className="p-3 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border-b border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-pulse shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-xs border border-amber-500/30">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-foreground flex items-center gap-2">
                <span>Human Verification Required!</span>
                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                  {status.humanInterventionReason || "Anti-Bot Challenge"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click the Cloudflare / Captcha checkbox directly on the screen below. The agent will auto-detect completion, or click Resume.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              size="sm"
              onClick={() => sendInteraction({ action: "resume" })}
              className="w-full sm:w-auto text-xs font-bold gap-1.5 h-8 bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>I Have Solved It — Resume</span>
            </Button>
          </div>
        </div>
      )}

      {/* 3. Keyboard Keystroke Drawer */}
      {showKeyboardDrawer && (
        <form
          onSubmit={handleSendText}
          className="px-3 py-2 bg-muted/60 border-b border-border flex items-center gap-2 shrink-0 animate-in slide-in-from-top-1"
        >
          <Keyboard className="w-3.5 h-3.5 text-primary shrink-0" />
          <input
            type="text"
            value={keyboardText}
            onChange={(e) => setKeyboardText(e.target.value)}
            placeholder="Type text or captcha answer to send to active input..."
            className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!keyboardText.trim() || isInteracting}
            className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </Button>
        </form>
      )}

      {/* 4. Live Screen Viewport (16:10 Aspect Ratio matching 1280x800) */}
      <div
        ref={containerRef}
        onClick={handleViewportClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full aspect-[16/10] bg-zinc-950 flex items-center justify-center overflow-hidden select-none group ${
          isInteractive || status.isHumanInterventionNeeded ? "cursor-crosshair" : "cursor-default"
        }`}
      >
        {status.latestFrame ? (
          <>
            {/* Live Screencast Image Frame */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={status.latestFrame}
              alt="Live Browser Stream"
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />

            {/* Click Ripple Visual Feedback */}
            {ripples.map((ripple) => (
              <span
                key={ripple.id}
                className="absolute w-8 h-8 rounded-full border-2 border-primary bg-primary/20 pointer-events-none animate-ping -translate-x-1/2 -translate-y-1/2"
                style={{ left: ripple.x, top: ripple.y }}
              />
            ))}

            {/* Crosshair Target Coordinates Pill */}
            {hoverCoords && (
              <div
                className="absolute bottom-2 left-2 pointer-events-none px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1 shadow-md"
              >
                <Crosshair className="w-2.5 h-2.5 text-primary" />
                <span>
                  X: {hoverCoords.x} Y: {hoverCoords.y}
                </span>
                <span className="text-white/40 font-normal">| Live Pass-through</span>
              </div>
            )}

            {/* Interactive Mode Floating Indicator */}
            {(isInteractive || status.isHumanInterventionNeeded) && (
              <div className="absolute top-2 right-2 pointer-events-none px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Crosshair className="w-2.5 h-2.5 animate-spin" />
                <span>Interactive Takeover ON</span>
              </div>
            )}
          </>
        ) : (
          /* Standby State Display */
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/10 border border-border/40 flex items-center justify-center text-muted-foreground/60 shadow-inner">
              <Tv className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-xs text-foreground/80">
                {status.isRunning ? "Connecting to Chromium Screencast..." : "Chromium Engine Standby"}
              </div>
              <p className="text-[11px] max-w-xs text-muted-foreground/70">
                {status.isRunning
                  ? "Capturing initial page render. The live stream will appear here in milliseconds."
                  : "Launch an autonomous form fill or batch registration to watch the live visual execution."}
              </p>
            </div>
            {status.isRunning && (
              <div className="flex items-center gap-1.5 text-[10px] text-primary font-mono">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Awaiting frames...</span>
              </div>
            )}
          </div>
        )}

        {/* Action feedback toast inside viewport */}
        {lastActionMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/85 text-white border border-white/20 text-[10px] font-medium shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-none flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>{lastActionMessage}</span>
          </div>
        )}
      </div>

      {/* 5. Viewport Footer Controls & Info */}
      <div className="px-3 py-1.5 bg-muted/20 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-2 truncate">
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status.latestFrame ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            <span>{status.latestFrame ? "1280×800 Native" : "Standby"}</span>
          </span>
          {status.currentTitle && (
            <span className="truncate text-foreground/70 max-w-[200px]">
              &bull; {status.currentTitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-muted-foreground/70 hidden sm:inline">
            Click anywhere on screen to interact
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveBrowserScreen;
