"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  Clock,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
  Check,
  AlertTriangle,
  Terminal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SheetConfigItem {
  id: string;
  name: string;
  spreadsheetUrl: string;
  sheetName: string;
  syncDirection: "two_way" | "export_only" | "import_only";
  autoSync: boolean;
  frequency: string;
  isActive: boolean;
  lastSyncAt?: string | null;
  lastStatus?: string | null;
  lastMessage?: string | null;
  createdAt: string;
}

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
  isSyncing: globalIsSyncing,
  syncResult: globalSyncResult,
}) => {
  const [configs, setConfigs] = useState<SheetConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSyncingId, setActiveSyncingId] = useState<string | null>(null);
  const [localSyncResult, setLocalSyncResult] = useState<any>(null);

  // CRUD Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    name: "",
    spreadsheetUrl: "",
    sheetName: "Registrations",
    syncDirection: "two_way" as "two_way" | "export_only" | "import_only",
    autoSync: false,
    frequency: "manual",
    isActive: true,
  });

  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<SheetConfigItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch configs
  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sheets/configs");
      const data = await res.json();
      if (data.configs) {
        setConfigs(data.configs);
      }
    } catch (err) {
      console.error("Failed to load sheet configurations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingId(null);
    setFormState({
      name: "",
      spreadsheetUrl: "",
      sheetName: "Registrations",
      syncDirection: "two_way",
      autoSync: false,
      frequency: "manual",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (config: SheetConfigItem) => {
    setModalMode("edit");
    setEditingId(config.id);
    setFormState({
      name: config.name,
      spreadsheetUrl: config.spreadsheetUrl,
      sheetName: config.sheetName || "Sheet1",
      syncDirection: config.syncDirection || "two_way",
      autoSync: Boolean(config.autoSync),
      frequency: config.frequency || "manual",
      isActive: Boolean(config.isActive),
    });
    setIsModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.spreadsheetUrl.trim()) {
      alert("Name and Google Spreadsheet URL are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/sheets/configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create configuration");
      } else {
        const res = await fetch(`/api/sheets/configs/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update configuration");
      }

      setIsModalOpen(false);
      fetchConfigs();
    } catch (err: any) {
      alert(err.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!deleteConfirmConfig) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/sheets/configs/${deleteConfirmConfig.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete configuration");

      setDeleteConfirmConfig(null);
      fetchConfigs();
    } catch (err: any) {
      alert(err.message || "Failed to delete configuration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncIndividual = async (configId: string) => {
    setActiveSyncingId(configId);
    setLocalSyncResult(null);
    try {
      const res = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId }),
      });
      const data = await res.json();
      setLocalSyncResult(data);
      fetchConfigs();
    } catch (err: any) {
      setLocalSyncResult({
        success: false,
        message: err.message || "Sync failed",
      });
    } finally {
      setActiveSyncingId(null);
    }
  };

  const activeSyncResult = localSyncResult || globalSyncResult;
  const isSyncingAny = globalIsSyncing || activeSyncingId !== null;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Google Sheets Synchronization</span>
            <Badge variant="secondary" className="text-xs">
              {configs.length} Connection{configs.length === 1 ? "" : "s"}
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage two-way sync endpoints, targets, and automatic synchronization schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Sheet Connection Button */}
          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="rounded-2xl gap-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sheet Connection</span>
          </Button>

          {/* Sync All Button */}
          <Button
            onClick={onSyncSheets}
            disabled={isSyncingAny}
            variant="outline"
            size="sm"
            className="rounded-2xl gap-1.5 text-xs border-border bg-card hover:bg-muted cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-primary ${
                isSyncingAny ? "animate-spin" : ""
              }`}
            />
            <span>{isSyncingAny ? "Syncing All..." : "Sync All Active"}</span>
          </Button>
        </div>
      </div>

      {/* 2. Connected Sheets Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs.map((config) => {
          const isThisSyncing = activeSyncingId === config.id;
          return (
            <Card
              key={config.id}
              className={`rounded-3xl border transition-all shadow-2xs ${
                config.isActive
                  ? "bg-card border-border hover:border-border/80"
                  : "bg-muted/30 border-border/60 opacity-70"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold text-foreground truncate">
                        {config.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                        <Layers className="w-3 h-3" />
                        <span>Tab: </span>
                        <span className="font-semibold text-foreground">
                          {config.sheetName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(config)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Edit Sheet Connection"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmConfig(config)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Sheet Connection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0 text-xs">
                {/* Direction and Frequency Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent text-primary border border-primary/20">
                    {config.syncDirection === "two_way" ? (
                      <>
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                        <span>Two-Way</span>
                      </>
                    ) : config.syncDirection === "export_only" ? (
                      <>
                        <ArrowUpRight className="w-2.5 h-2.5" />
                        <span>Export Only</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownLeft className="w-2.5 h-2.5" />
                        <span>Import Only</span>
                      </>
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{config.frequency}</span>
                  </span>

                  {config.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground bg-muted">
                      Disabled
                    </span>
                  )}
                </div>

                {/* Target URL */}
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground truncate">
                    {config.spreadsheetUrl}
                  </span>
                  <a
                    href={config.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-card transition-colors shrink-0 cursor-pointer"
                    title="Open Google Sheet in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Last Synced details */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <div className="truncate">
                    {config.lastSyncAt ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Check className="w-3 h-3" />
                        Synced {new Date(config.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : (
                      <span>Not synced yet</span>
                    )}
                  </div>

                  <Button
                    onClick={() => handleSyncIndividual(config.id)}
                    disabled={isThisSyncing || isSyncingAny}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 rounded-xl text-[11px] gap-1.5 border-border bg-card hover:bg-muted cursor-pointer shrink-0"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-primary ${
                        isThisSyncing ? "animate-spin" : ""
                      }`}
                    />
                    <span>{isThisSyncing ? "Syncing..." : "Sync Now"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3. Sync Execution Output / Console */}
      {activeSyncResult && (
        <Card className="rounded-3xl border-border bg-card shadow-2xs overflow-hidden">
          <CardHeader className="py-3 px-6 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Last Synchronization Console Output
                </span>
              </div>
              <Badge
                variant={activeSyncResult.success ? "success" : "destructive"}
                className="text-[10px]"
              >
                {activeSyncResult.success ? "SUCCESS" : "ERROR"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs text-foreground font-semibold">
              {activeSyncResult.message}
            </div>
            {activeSyncResult.stdout && (
              <pre className="p-3.5 rounded-2xl bg-muted/60 font-mono text-[11px] text-foreground overflow-x-auto leading-relaxed max-h-52">
                {activeSyncResult.stdout}
              </pre>
            )}
            {activeSyncResult.stderr && (
              <pre className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 font-mono text-[11px] text-rose-600 dark:text-rose-400 overflow-x-auto">
                {activeSyncResult.stderr}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. Create / Edit Sheet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {modalMode === "create" ? "Add Google Sheet" : "Edit Sheet Connection"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Connect an external Google Sheet for automated two-way syncing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Connection Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  placeholder="e.g. KBW & Modular Events Tracker"
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Google Spreadsheet URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={formState.spreadsheetUrl}
                  onChange={(e) =>
                    setFormState({ ...formState, spreadsheetUrl: e.target.value })
                  }
                  placeholder="https://docs.google.com/spreadsheets/d/1EtPcPe6.../edit"
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Sheet / Tab Name
                  </label>
                  <input
                    type="text"
                    value={formState.sheetName}
                    onChange={(e) =>
                      setFormState({ ...formState, sheetName: e.target.value })
                    }
                    placeholder="e.g. Registrations or Sheet1"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Sync Direction
                  </label>
                  <select
                    value={formState.syncDirection}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        syncDirection: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="two_way">Two-Way Synchronization</option>
                    <option value="export_only">Export to Google Sheet</option>
                    <option value="import_only">Import from Google Sheet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Sync Frequency
                  </label>
                  <select
                    value={formState.frequency}
                    onChange={(e) =>
                      setFormState({ ...formState, frequency: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="manual">Manual Trigger Only</option>
                    <option value="15m">Every 15 Minutes</option>
                    <option value="1h">Every Hour</option>
                    <option value="daily">Daily Sync</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isActiveSheet"
                    checked={formState.isActive}
                    onChange={(e) =>
                      setFormState({ ...formState, isActive: e.target.checked })
                    }
                    className="rounded border-border accent-emerald-600 cursor-pointer"
                  />
                  <label
                    htmlFor="isActiveSheet"
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Active Connection
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Add Connection"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {deleteConfirmConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Delete Sheet Connection?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Remove connection configuration
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">
                "{deleteConfirmConfig.name}"
              </span>
              ? Your external Google Sheet will remain intact, but it will no longer synchronize with AutoBot.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteConfirmConfig(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfig}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
