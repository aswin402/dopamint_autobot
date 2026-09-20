"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SheetsSyncViewProps {
  onSyncSheets: () => void;
  isSyncing: boolean;
  syncResult?: {
    success: boolean;
    message?: string;
    stdout?: string;
    stderr?: string;
  } | null;
  spreadsheetUrl?: string;
}

export const SheetsSyncView: React.FC<SheetsSyncViewProps> = ({
  onSyncSheets,
  isSyncing,
  syncResult,
  spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>Google Sheets Synchronization</span>
          <Badge variant="olive" className="text-xs">
            Live Two-Way
          </Badge>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Synchronize real-world form registrations and questions directly into your Google Sheets spreadsheet.
        </p>
      </div>

      {/* Main Action Card */}
      <Card className="rounded-3xl border-border bg-card shadow-2xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Events & Team Registration Sheet
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Connected to Google Drive API & Playwright Inserter
                </p>
              </div>
            </div>

            <Button
              onClick={onSyncSheets}
              disabled={isSyncing}
              className="rounded-2xl gap-2 font-semibold text-xs shadow-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>{isSyncing ? "Syncing in Background..." : "Sync Now"}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="p-4 rounded-2xl bg-muted/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="font-semibold text-foreground block">
                Target Spreadsheet URL:
              </span>
              <span className="text-muted-foreground font-mono text-[11px] truncate block mt-0.5">
                {spreadsheetUrl}
              </span>
            </div>

            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:text-primary transition-colors font-semibold flex-shrink-0 shadow-2xs"
            >
              <span>Open Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {syncResult && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 ${
                syncResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {syncResult.success ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>
                  {syncResult.message ||
                    (syncResult.success ? "Sync completed successfully" : "Sync failed")}
                </span>
              </div>

              {syncResult.stdout && (
                <pre className="p-3 rounded-xl bg-background/50 text-[11px] font-mono overflow-x-auto text-foreground">
                  {syncResult.stdout}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
