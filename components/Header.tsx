"use client";

import React from "react";
import { Sparkles, RefreshCw, ExternalLink, Activity, User, CheckCircle2, Eye, EyeOff, Download, LogIn, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

interface HeaderProps {
  activeTitle: string;
  subtitle?: string;
  selectedAttendeeName?: string;
  runnerStatus: {
    isRunning: boolean;
    isPaused: boolean;
    isHeadless?: boolean;
  };
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  onSyncSheets: () => void;
  isSyncingSheets: boolean;
  onOpenExport?: () => void;
}

export default function Header({
  activeTitle,
  subtitle,
  selectedAttendeeName,
  runnerStatus,
  isVisualMode = false,
  onToggleVisualMode,
  onSyncSheets,
  isSyncingSheets,
  onOpenExport,
}: HeaderProps) {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-6 flex items-center justify-between z-20 sticky top-0 transition-colors">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm md:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{activeTitle}</span>
            {runnerStatus.isRunning && (
              <Badge
                variant={runnerStatus.isHeadless === false ? "warning" : "success"}
                className="animate-pulse gap-1"
              >
                {runnerStatus.isPaused
                  ? "Paused"
                  : runnerStatus.isHeadless === false
                  ? "👁️ Watching Live"
                  : "Runner Active"}
              </Badge>
            )}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Active Attendee Indicator */}
        {selectedAttendeeName && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground font-medium">
            <User className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">Attendee:</span>
            <span className="font-semibold text-foreground truncate max-w-[140px]">
              {selectedAttendeeName}
            </span>
          </div>
        )}

        {/* Autonomous Agent Status Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Agent Online</span>
        </div>

        {/* Watch Live Visual Browser Mode Switch */}
        {onToggleVisualMode && (
          <button
            type="button"
            onClick={onToggleVisualMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isVisualMode
                ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-2xs"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
            title={
              isVisualMode
                ? "Visual Browser ON: Chromium window opens on your screen so you can watch form interactions in real time."
                : "Visual Browser OFF: Runs silently in the background (headless)."
            }
          >
            {isVisualMode ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span>Watch Live</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold uppercase">
                  ON
                </span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Watch Live</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-medium uppercase">
                  OFF
                </span>
              </>
            )}
          </button>
        )}

        {/* Export Data Button */}
        {onOpenExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenExport}
            className="rounded-xl text-xs gap-1.5 h-8 border-border bg-card hover:bg-muted text-foreground cursor-pointer"
            title="Export registration matrix, confirmed passes, team roster, or events catalog"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        )}

        {/* Google Sheets Sync Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSyncSheets}
          disabled={isSyncingSheets}
          className="rounded-xl text-xs gap-1.5 h-8 border-border bg-card hover:bg-muted text-foreground"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-primary ${
              isSyncingSheets ? "animate-spin" : ""
            }`}
          />
          <span className="hidden sm:inline">
            {isSyncingSheets ? "Syncing..." : "Sync Sheets"}
          </span>
        </Button>

        {/* User Authentication Profile / Sign In */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 pl-1.5 border-l border-border/60">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-muted/60 border border-border text-xs">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="font-semibold text-foreground truncate max-w-[110px] hidden sm:inline">
                {user.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={openAuthModal}
            className="rounded-xl text-xs gap-1.5 h-8 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 font-semibold cursor-pointer shadow-2xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Button>
        )}
      </div>
    </header>
  );
}
