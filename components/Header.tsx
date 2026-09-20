"use client";

import React from "react";
import { Sparkles, RefreshCw, ExternalLink, Activity, User, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  activeTitle: string;
  subtitle?: string;
  selectedAttendeeName?: string;
  runnerStatus: {
    isRunning: boolean;
    isPaused: boolean;
  };
  onSyncSheets: () => void;
  isSyncingSheets: boolean;
}

export default function Header({
  activeTitle,
  subtitle,
  selectedAttendeeName,
  runnerStatus,
  onSyncSheets,
  isSyncingSheets,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-6 flex items-center justify-between z-20 sticky top-0 transition-colors">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm md:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{activeTitle}</span>
            {runnerStatus.isRunning && (
              <Badge variant="success" className="animate-pulse">
                {runnerStatus.isPaused ? "Paused" : "Runner Active"}
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

        {/* Live MiniMax Engine Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-primary border border-primary/20 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>MiniMax M2.5</span>
        </div>

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
      </div>
    </header>
  );
}
