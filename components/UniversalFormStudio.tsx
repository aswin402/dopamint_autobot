"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Globe,
  Sparkles,
  Search,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Sliders,
  Zap,
  Building,
  Briefcase,
  Bell,
  Upload,
  FileText,
  Users,
  Layers,
  Pause,
  Square,
  Trash2,
  Plus,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetectedField, InspectionResult } from "@/lib/automation/runner";
import { playNotificationChime, triggerDesktopNotification } from "@/lib/notifications";

interface AttendeeProfile {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  message?: string;
  pitch?: string;
  [key: string]: any;
}

interface UniversalFormStudioProps {
  attendees?: any[];
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  onLaunchSuccess?: () => void;
}

export const UniversalFormStudio: React.FC<UniversalFormStudioProps> = ({
  attendees = [],
  isVisualMode = false,
  onToggleVisualMode,
  onLaunchSuccess,
}) => {
  // Active Tab: "single" or "matrix"
  const [activeTab, setActiveTab] = useState<"single" | "matrix">("matrix");

  // --------------------------------------------------------------------------
  // Single Form Studio State
  // --------------------------------------------------------------------------
  const [targetUrl, setTargetUrl] = useState("https://mowli.in/");
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>({
    name: "aswin",
    email: "aswinvishal402@gmail.com",
    phone: "9384514564",
    message: "hii",
    company: "Celestialabs",
    role: "Developer",
  });

  const [isSingleLaunching, setIsSingleLaunching] = useState(false);
  const [singleLaunchMessage, setSingleLaunchMessage] = useState<string | null>(null);
  const [singleLaunchSuccess, setSingleLaunchSuccess] = useState<boolean | null>(null);

  // --------------------------------------------------------------------------
  // Multi-Target Matrix Runner State ($N$ URLs × $M$ People)
  // --------------------------------------------------------------------------
  const [matrixUrlsText, setMatrixUrlsText] = useState("https://mowli.in/");
  const [matrixProfiles, setMatrixProfiles] = useState<AttendeeProfile[]>([
    {
      id: "p-1",
      name: "aswin",
      email: "aswinvishal402@gmail.com",
      phone: "9384514564",
      message: "hii",
      company: "Celestialabs",
      role: "Developer",
    },
  ]);

  const [pairingMode, setPairingMode] = useState<"cartesian" | "pairwise">("cartesian");
  const [pacingDelaySec, setPacingDelaySec] = useState<number>(8);
  const [preSubmitDelayMs, setPreSubmitDelayMs] = useState<number>(1500);

  // File Ingestion State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Profile Form
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [newProfile, setNewProfile] = useState<AttendeeProfile>({
    name: "",
    email: "",
    phone: "",
    message: "Hello, interested in collaborating!",
    company: "Celestialabs",
    role: "Member",
  });

  // Batch Live Monitoring State
  const [isMatrixRunning, setIsMatrixRunning] = useState(false);
  const [isMatrixPaused, setIsMatrixPaused] = useState(false);
  const [matrixStatus, setMatrixStatus] = useState<any>(null);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // Parse URLs from multiline string
  const targetUrlsList = matrixUrlsText
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));

  // Calculate total matrix tasks
  const calculatedTotalTasks =
    pairingMode === "pairwise"
      ? Math.max(targetUrlsList.length, matrixProfiles.length)
      : targetUrlsList.length * matrixProfiles.length;

  // Single Form Quick Presets
  const presets = [
    { label: "Mowli.in (Contact Form)", url: "https://mowli.in/" },
  ];

  // --------------------------------------------------------------------------
  // Single Form Actions
  // --------------------------------------------------------------------------
  const handleInspect = async (urlToInspect?: string) => {
    const url = urlToInspect || targetUrl;
    if (!url || !url.startsWith("http")) {
      setInspectError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsInspecting(true);
    setInspectError(null);
    setSingleLaunchMessage(null);

    try {
      const res = await fetch("/api/automation/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to inspect target form");
      }

      setInspectionResult(data);

      const updatedData = { ...formData };
      data.fields.forEach((f: DetectedField) => {
        if (f.suggestedKey && !updatedData[f.suggestedKey]) {
          if (f.suggestedKey === "name") updatedData.name = "aswin";
          else if (f.suggestedKey === "email") updatedData.email = "aswinvishal402@gmail.com";
          else if (f.suggestedKey === "phone") updatedData.phone = "9384514564";
          else if (f.suggestedKey === "message") updatedData.message = "hii";
        }
      });
      setFormData(updatedData);
    } catch (err: any) {
      setInspectError(err.message || "Failed to analyze target DOM");
    } finally {
      setIsInspecting(false);
    }
  };

  const handleLaunchSingle = async () => {
    if (!targetUrl || !targetUrl.startsWith("http")) {
      setInspectError("A valid target URL is required to launch automation");
      return;
    }

    setIsSingleLaunching(true);
    setSingleLaunchMessage(null);
    setSingleLaunchSuccess(null);

    try {
      const res = await fetch("/api/automation/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          data: formData,
          headless: !isVisualMode,
          preSubmitDelayMs: 1500,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to start form automation");
      }

      setSingleLaunchSuccess(true);
      setSingleLaunchMessage(
        `🚀 Agent started autonomous execution on ${targetUrl} [${
          isVisualMode ? "Visual Browser Window" : "Headless Stealth"
        }]. Actively monitoring progress...`
      );
      onLaunchSuccess?.();

      // Poll until done
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await fetch("/api/automation/status", { cache: "no-store" });
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (!status.isRunning && pollCount > 1) {
              clearInterval(pollInterval);
              setIsSingleLaunching(false);
              playNotificationChime();
              triggerDesktopNotification(
                "Dopamint Autonomous Agent",
                `Automation completed for ${targetUrl}! 1 confirmed success.`
              );
              setSingleLaunchMessage(
                `🎉 Success! Autonomous form submission completed and verified on ${targetUrl} (1/1 success, 0 errors).`
              );
            }
          }
        } catch {}

        if (pollCount > 60) {
          clearInterval(pollInterval);
          setIsSingleLaunching(false);
        }
      }, 1500);
    } catch (err: any) {
      setSingleLaunchSuccess(false);
      setSingleLaunchMessage(`⚠️ Launch error: ${err.message}`);
      setIsSingleLaunching(false);
    }
  };

  // --------------------------------------------------------------------------
  // Matrix Batch Runner Actions ($N$ URLs × $M$ People)
  // --------------------------------------------------------------------------
  const handleLaunchMatrix = async () => {
    if (targetUrlsList.length === 0) {
      setBatchFeedback("⚠️ Please provide at least one valid target URL.");
      return;
    }
    if (matrixProfiles.length === 0) {
      setBatchFeedback("⚠️ Please add at least one person/profile record.");
      return;
    }

    setIsMatrixRunning(true);
    setIsMatrixPaused(false);
    setBatchFeedback(null);

    const targets = targetUrlsList.map((url, i) => ({
      url,
      title: `Form #${i + 1}`,
    }));

    try {
      const res = await fetch("/api/automation/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets,
          profiles: matrixProfiles,
          options: {
            headless: !isVisualMode,
            pairingMode,
            pacingDelaySec,
            preSubmitDelayMs,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start matrix batch");
      }

      setBatchFeedback(
        `🚀 Batch Matrix launched: ${targets.length} forms × ${matrixProfiles.length} profiles = ${data.totalTasks} tasks queued.`
      );
      onLaunchSuccess?.();

      // Start continuous status polling
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await fetch("/api/automation/status", { cache: "no-store" });
          if (statusRes.ok) {
            const status = await statusRes.json();
            setMatrixStatus(status);
            setIsMatrixPaused(Boolean(status.isPaused));

            if (!status.isRunning && pollCount > 1) {
              clearInterval(pollInterval);
              setIsMatrixRunning(false);
              playNotificationChime();
              triggerDesktopNotification(
                "Matrix Batch Completed",
                `Finished ${status.progress.completed}/${status.progress.total} tasks. Succeeded: ${status.progress.successCount}, Failed: ${status.progress.failedCount}.`
              );
              setBatchFeedback(
                `🎉 Batch complete! Succeeded: ${status.progress.successCount}, Failed: ${status.progress.failedCount} out of ${status.progress.total} tasks.`
              );
            }
          }
        } catch {}

        if (pollCount > 300) {
          clearInterval(pollInterval);
          setIsMatrixRunning(false);
        }
      }, 1500);
    } catch (err: any) {
      setIsMatrixRunning(false);
      setBatchFeedback(`❌ Error starting matrix batch: ${err.message}`);
    }
  };

  const handlePauseResume = async () => {
    try {
      const action = isMatrixPaused ? "resume" : "pause";
      await fetch(`/api/automation/${action}`, { method: "POST" });
      setIsMatrixPaused(!isMatrixPaused);
    } catch {}
  };

  const handleStopMatrix = async () => {
    try {
      await fetch("/api/automation/stop", { method: "POST" });
      setIsMatrixRunning(false);
      setIsMatrixPaused(false);
      setBatchFeedback("⏹️ Batch runner stopped by user.");
    } catch {}
  };

  // --------------------------------------------------------------------------
  // Document Upload Extraction Handler (.pdf, .xlsx, .csv, .docx, .md)
  // --------------------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFeedback(null);

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse document");
      }

      let urlsAdded = 0;
      let peopleAdded = 0;

      // Extract and merge Target URLs
      if (data.events && Array.isArray(data.events) && data.events.length > 0) {
        const newUrls = data.events.map((ev: any) => ev.url).filter(Boolean);
        const existingUrls = matrixUrlsText.split("\n").map((u) => u.trim()).filter(Boolean);
        const mergedUrls = Array.from(new Set([...existingUrls, ...newUrls]));
        setMatrixUrlsText(mergedUrls.join("\n"));
        urlsAdded = newUrls.length;
      }

      // Extract and merge Attendees / Profiles
      if (data.attendees && Array.isArray(data.attendees) && data.attendees.length > 0) {
        const parsedProfiles: AttendeeProfile[] = data.attendees.map((a: any, i: number) => ({
          id: `doc-${Date.now()}-${i}`,
          name: a.name || "Member",
          email: a.email,
          phone: a.phone || "9384514564",
          company: a.company || "Celestialabs",
          role: a.role || "Member",
          message: a.pitch || "Hello, interested in connecting!",
        }));

        setMatrixProfiles((prev) => {
          const seen = new Set(prev.map((p) => p.email.toLowerCase()));
          const uniqueNew = parsedProfiles.filter((p) => !seen.has(p.email.toLowerCase()));
          return [...prev, ...uniqueNew];
        });
        peopleAdded = parsedProfiles.length;
      }

      setUploadFeedback(
        `✅ Successfully processed ${file.name}! Ingested ${urlsAdded} target URLs and ${peopleAdded} people profiles.`
      );
    } catch (err: any) {
      setUploadFeedback(`⚠️ Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Add person from database roster
  const handleImportRosterAttendee = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) return;
    const a = attendees.find((item) => item.id === id);
    if (a) {
      if (matrixProfiles.some((p) => p.email.toLowerCase() === a.email.toLowerCase())) {
        return;
      }
      setMatrixProfiles((prev) => [
        ...prev,
        {
          id: a.id,
          name: a.name,
          email: a.email,
          phone: a.phone || "9384514564",
          company: a.company || "Celestialabs",
          role: a.role || "Member",
          message: a.pitch || "Hello, interested in connecting!",
        },
      ]);
    }
    e.target.value = "";
  };

  // Add custom person modal save
  const handleSaveNewProfile = () => {
    if (!newProfile.name || !newProfile.email) return;
    setMatrixProfiles((prev) => [
      ...prev,
      {
        ...newProfile,
        id: `custom-${Date.now()}`,
      },
    ]);
    setNewProfile({
      name: "",
      email: "",
      phone: "",
      message: "Hello, interested in connecting!",
      company: "Celestialabs",
      role: "Member",
    });
    setShowAddProfileModal(false);
  };

  const handleRemoveProfile = (index: number) => {
    setMatrixProfiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto min-h-0 bg-background">
      <div className="flex flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full pb-32">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Universal Form Studio
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                Zero-Hardcoding
              </Badge>
              {isMatrixRunning && (
                <Badge variant="warning" className="animate-pulse text-xs flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {isMatrixPaused ? "Paused" : "Matrix Running"}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Autonomous form automation engine. Supports $N$ links $\times$ $M$ people, document ingestion (.pdf, .xlsx, .docx, .md), and stealth anti-bot pacing.
            </p>
          </div>

          {/* Visual Browser Mode Toggle */}
          <div className="flex items-center gap-3 bg-card border border-border px-3.5 py-2 rounded-xl shadow-2xs self-start sm:self-auto">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {isVisualMode ? (
                <>
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span className="text-foreground font-semibold">Visual Browser</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span>Headless Stealth</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onToggleVisualMode}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                isVisualMode ? "bg-primary" : "bg-muted"
              }`}
              title="Toggle between on-screen physical Chromium window (150ms slowMo) and background headless mode"
            >
              <div
                className={`w-4 h-4 rounded-full bg-background transition-transform shadow-2xs ${
                  isVisualMode ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl border border-border/80 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "matrix"
                ? "bg-background text-foreground shadow-2xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4 text-primary" />
            <span>Multi-Target Matrix ($N$ Links × $M$ People)</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
              Batch
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "single"
                ? "bg-background text-foreground shadow-2xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="w-4 h-4 text-primary" />
            <span>Single Form Inspector</span>
          </button>
        </div>

        {/* ================================================================== */}
        {/* TAB 1: MULTI-TARGET MATRIX RUNNER ($N$ URLs × $M$ People)         */}
        {/* ================================================================== */}
        {activeTab === "matrix" && (
          <div className="space-y-6">
            {/* Top Multi-Format Document Ingestion Banner */}
            <div className="bg-gradient-to-r from-primary/5 via-card to-card border border-primary/20 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Import Data Source from Document
                  </h3>
                  <Badge variant="outline" className="text-[10px] bg-background border-primary/30">
                    PDF, XLSX, CSV, DOCX, MD
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a spreadsheet, PDF document, or Word document containing form URLs and people records. The autonomous parser extracts them automatically.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.md,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-2 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing Document...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Upload Data Source</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {uploadFeedback && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 text-xs text-primary rounded-xl">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadFeedback}</span>
              </div>
            )}

            {/* Matrix Setup Grid (URLs on Left, People Profiles on Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: N Target Form URLs */}
              <div className="lg:col-span-6 flex flex-col gap-3 bg-card border border-border rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span>Target Form URLs ($N$)</span>
                  </label>
                  <Badge variant="secondary" className="text-xs font-mono font-bold">
                    {targetUrlsList.length} URLs Loaded
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  Paste target form links (one URL per line). The agent inspects each page's DOM semantically.
                </p>

                <textarea
                  value={matrixUrlsText}
                  onChange={(e) => setMatrixUrlsText(e.target.value)}
                  rows={6}
                  placeholder="https://mowli.in/&#10;https://example.com/contact&#10;https://form.domain.org/signup"
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs sm:text-sm font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
                />

                {/* Quick chip buttons */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[11px] text-muted-foreground">Quick Add:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!matrixUrlsText.includes("https://mowli.in/")) {
                        setMatrixUrlsText((prev) => (prev ? `${prev}\nhttps://mowli.in/` : "https://mowli.in/"));
                      }
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
                  >
                    + Mowli.in
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixUrlsText("")}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-muted hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground border border-border transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                {/* Target URLs List Preview */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Configured Targets:
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {targetUrlsList.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70 italic">No valid URLs entered yet.</p>
                    ) : (
                      targetUrlsList.map((url, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/70 text-xs font-mono"
                        >
                          <span className="truncate max-w-[280px] sm:max-w-[340px] text-foreground">
                            #{i + 1} {url}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-sans font-semibold">
                            Ready
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: M People / Profiles */}
              <div className="lg:col-span-6 flex flex-col gap-3 bg-card border border-border rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>People & Profiles ($M$)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono font-bold">
                      {matrixProfiles.length} Profiles
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setShowAddProfileModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Person</span>
                    </button>
                  </div>
                </div>

                {/* Import from Team Roster */}
                {attendees.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Import Roster:</span>
                    <select
                      onChange={handleImportRosterAttendee}
                      defaultValue=""
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="" disabled>
                        Select member from Team Roster...
                      </option>
                      {attendees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Profiles Cards List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {matrixProfiles.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      No profile records added. Click "Add Person" or upload a document.
                    </div>
                  ) : (
                    matrixProfiles.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-background border border-border hover:border-border/80 transition-all group"
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {p.name || "N/A"}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                              {p.email}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            {p.phone && <span>📞 {p.phone}</span>}
                            {p.company && <span>🏢 {p.company}</span>}
                            {p.role && <span>💼 {p.role}</span>}
                          </div>
                          {p.message && (
                            <p className="text-[11px] text-muted-foreground/80 italic truncate max-w-sm">
                              "{p.message}"
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveProfile(idx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 opacity-60 group-hover:opacity-100 transition-all cursor-pointer"
                          title="Remove profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Execution Options Bar */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Matrix Execution & Anti-Bot Strategy Options</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pairing Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>Pairing Mode</span>
                  </label>
                  <select
                    value={pairingMode}
                    onChange={(e) => setPairingMode(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="cartesian">
                      Cartesian Matrix ({targetUrlsList.length} × {matrixProfiles.length} = {calculatedTotalTasks} tasks)
                    </option>
                    <option value="pairwise">
                      Pairwise 1:1 Matching ({calculatedTotalTasks} tasks)
                    </option>
                  </select>
                </div>

                {/* Anti-Bot Delay */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Inter-Task Pacing Delay</span>
                  </label>
                  <select
                    value={pacingDelaySec}
                    onChange={(e) => setPacingDelaySec(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value={5}>5s (Rapid Mode)</option>
                    <option value={8}>8s (Recommended Anti-Bot)</option>
                    <option value={15}>15s (Stealth Guarded)</option>
                    <option value={25}>25s (Ultra-Safe Evader)</option>
                  </select>
                </div>

                {/* Pre-submit Pause */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Pre-Submit Review Pause</span>
                  </label>
                  <select
                    value={preSubmitDelayMs}
                    onChange={(e) => setPreSubmitDelayMs(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value={1000}>1.0s (Fast)</option>
                    <option value={1500}>1.5s (Standard)</option>
                    <option value={3000}>3.0s (Human Review Simulation)</option>
                  </select>
                </div>

                {/* Browser Mode Display */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    {isVisualMode ? (
                      <Eye className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>Execution Environment</span>
                  </label>
                  <div className="p-2 rounded-xl bg-background border border-border text-xs font-medium text-foreground flex items-center justify-between">
                    <span>{isVisualMode ? "Visual Headed Browser" : "Headless Stealth"}</span>
                    <button
                      type="button"
                      onClick={onToggleVisualMode}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-semibold"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Launch CTA Bar & Live Matrix KPIs */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">
                      Ready to Run Matrix Automation
                    </h3>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {calculatedTotalTasks} Total Submissions
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pairs {targetUrlsList.length} target forms with {matrixProfiles.length} attendee profiles with humanized keystrokes & anti-bot evasion.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isMatrixRunning ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePauseResume}
                        className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {isMatrixPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleStopMatrix}
                        className="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLaunchMatrix}
                      disabled={calculatedTotalTasks === 0}
                      className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md hover:shadow-lg"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Launch Matrix Batch ({calculatedTotalTasks} Submissions)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress & Live Status Banner */}
              {matrixStatus && (
                <div className="p-4 rounded-xl bg-background border border-border space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-2">
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${matrixStatus.isRunning ? "animate-spin text-primary" : "text-muted-foreground"}`}
                      />
                      <span>
                        Batch Progress: {matrixStatus.progress.completed} / {matrixStatus.progress.total} (
                        {matrixStatus.progress.percent}%)
                      </span>
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {matrixStatus.progress.remainingCount} remaining
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${matrixStatus.progress.percent}%` }}
                    />
                  </div>

                  {/* Quick KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-xs font-semibold text-muted-foreground">Successes</div>
                      <div className="text-sm font-bold text-emerald-500">
                        {matrixStatus.progress.successCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-xs font-semibold text-muted-foreground">Failures</div>
                      <div className="text-sm font-bold text-rose-500">
                        {matrixStatus.progress.failedCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-xs font-semibold text-muted-foreground">Active Form</div>
                      <div className="text-xs font-mono font-medium truncate text-foreground">
                        {matrixStatus.currentEvent?.title || "Idle"}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-xs font-semibold text-muted-foreground">Active Person</div>
                      <div className="text-xs font-medium truncate text-foreground">
                        {matrixStatus.currentAttendee?.name || "Idle"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {batchFeedback && (
                <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{batchFeedback}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: SINGLE FORM STUDIO (Existing Focused Mode)                 */}
        {/* ================================================================== */}
        {activeTab === "single" && (
          <div className="space-y-6">
            {/* Target URL Input */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-primary" />
                Target Web Form URL
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://mowli.in/ or https://example.com/contact"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-xs sm:text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleInspect()}
                  disabled={isInspecting || !targetUrl.trim()}
                  className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs shrink-0"
                >
                  {isInspecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Inspecting...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-primary" />
                      <span>Inspect Form</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLaunchSingle}
                  disabled={isSingleLaunching || isInspecting || !targetUrl.trim()}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs shrink-0"
                >
                  {isSingleLaunching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Launching...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Run Automation</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">Quick Presets:</span>
                {presets.map((preset) => (
                  <button
                    key={preset.url}
                    onClick={() => {
                      setTargetUrl(preset.url);
                      handleInspect(preset.url);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-primary" />
                    {preset.label}
                  </button>
                ))}
              </div>

              {inspectError && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inspectError}</span>
                </div>
              )}

              {singleLaunchMessage && (
                <div
                  className={`flex items-center gap-2 p-3 text-xs rounded-xl border ${
                    singleLaunchSuccess
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {singleLaunchSuccess ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  )}
                  <span>{singleLaunchMessage}</span>
                </div>
              )}
            </div>

            {/* Single Form Payload Form & Detected DOM Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Payload Config */}
              <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span>Submission Payload</span>
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    Semantic Auto-Mapping
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-foreground">Name</label>
                    <input
                      type="text"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Email</label>
                    <input
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Phone</label>
                    <input
                      type="text"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Message</label>
                    <textarea
                      value={formData.message || ""}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={3}
                      className="w-full bg-background border border-border rounded-xl p-3 text-xs sm:text-sm text-foreground outline-none focus:border-primary resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Detected DOM Schema */}
              <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Detected DOM Schema</span>
                  </h3>
                  {inspectionResult && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {inspectionResult.fields.length} Fields Found
                    </Badge>
                  )}
                </div>

                {!inspectionResult ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                    <Search className="w-8 h-8 opacity-40 text-primary" />
                    <p className="text-xs">
                      Click "Inspect Form" above to extract interactive DOM inputs without hardcoded selectors.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {inspectionResult.fields.map((f, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className="font-semibold text-foreground truncate">
                            {f.label || f.placeholder || f.name || f.tag}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground truncate">
                            tag: {f.tag} | type: {f.type || "text"} | name: {f.name || "N/A"}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {f.suggestedKey || "custom"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Custom Person Profile */}
        {showAddProfileModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Add Attendee Profile</h3>
                <button
                  type="button"
                  onClick={() => setShowAddProfileModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-foreground">Full Name *</label>
                  <input
                    type="text"
                    value={newProfile.name}
                    onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                    placeholder="Aswin Vishal"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground">Email Address *</label>
                  <input
                    type="email"
                    value={newProfile.email}
                    onChange={(e) => setNewProfile({ ...newProfile, email: e.target.value })}
                    placeholder="aswinvishal402@gmail.com"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground">Phone Number</label>
                  <input
                    type="text"
                    value={newProfile.phone}
                    onChange={(e) => setNewProfile({ ...newProfile, phone: e.target.value })}
                    placeholder="9384514564"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-foreground">Company</label>
                    <input
                      type="text"
                      value={newProfile.company}
                      onChange={(e) => setNewProfile({ ...newProfile, company: e.target.value })}
                      placeholder="Celestialabs"
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-foreground">Role</label>
                    <input
                      type="text"
                      value={newProfile.role}
                      onChange={(e) => setNewProfile({ ...newProfile, role: e.target.value })}
                      placeholder="Developer"
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground">Custom Message / Notes</label>
                  <textarea
                    value={newProfile.message}
                    onChange={(e) => setNewProfile({ ...newProfile, message: e.target.value })}
                    rows={2}
                    placeholder="Hello, excited to connect!"
                    className="w-full mt-1 bg-background border border-border rounded-lg p-2.5 text-foreground outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddProfileModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewProfile}
                  disabled={!newProfile.name || !newProfile.email}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalFormStudio;
