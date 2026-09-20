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
  Edit3,
  Save,
  Bookmark,
  Database,
  Copy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetectedField, InspectionResult } from "@/lib/automation/runner";
import { playNotificationChime, triggerDesktopNotification } from "@/lib/notifications";

export interface AttendeeProfile {
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

interface SavedTemplate {
  id: string;
  name: string;
  url: string;
  data: Record<string, string>;
  createdAt: string;
}

interface UniversalFormStudioProps {
  attendees?: any[];
  events?: any[];
  onRefreshData?: () => Promise<void> | void;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  onLaunchSuccess?: () => void;
}

export const UniversalFormStudio: React.FC<UniversalFormStudioProps> = ({
  attendees = [],
  events = [],
  onRefreshData,
  isVisualMode = false,
  onToggleVisualMode,
  onLaunchSuccess,
}) => {
  // Active Tab: "matrix" ($N$ URLs × $M$ People) or "single" (Focused Form Studio)
  const [activeTab, setActiveTab] = useState<"matrix" | "single">("matrix");

  // --------------------------------------------------------------------------
  // Single Form Studio State (Zero Hardcoded Defaults)
  // --------------------------------------------------------------------------
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Dynamic Key-Value Form Payload (CRUD: Add, Edit, Delete field pairs)
  const [formData, setFormData] = useState<Record<string, string>>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  // State for adding custom fields to payload
  const [newFieldKey, setNewFieldKey] = useState<string>("");
  const [newFieldValue, setNewFieldValue] = useState<string>("");
  const [showAddFieldForm, setShowAddFieldForm] = useState<boolean>(false);

  const [isSingleLaunching, setIsSingleLaunching] = useState(false);
  const [singleLaunchMessage, setSingleLaunchMessage] = useState<string | null>(null);
  const [singleLaunchSuccess, setSingleLaunchSuccess] = useState<boolean | null>(null);

  // Saved Templates (Stored in LocalStorage)
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templateNameInput, setTemplateNameInput] = useState<string>("");
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // Multi-Target Matrix Runner State ($N$ URLs × $M$ People)
  // --------------------------------------------------------------------------
  const [matrixUrlsText, setMatrixUrlsText] = useState<string>("");
  const [matrixProfiles, setMatrixProfiles] = useState<AttendeeProfile[]>([]);

  const [pairingMode, setPairingMode] = useState<"cartesian" | "pairwise">("cartesian");
  const [pacingDelaySec, setPacingDelaySec] = useState<number>(8);
  const [preSubmitDelayMs, setPreSubmitDelayMs] = useState<number>(1500);

  // File Ingestion State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Modal (Handles both CREATE and UPDATE CRUD operations)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfileIndex, setEditingProfileIndex] = useState<number | null>(null);
  const [syncProfileToDatabase, setSyncProfileToDatabase] = useState(false);
  const [profileForm, setProfileForm] = useState<AttendeeProfile>({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    message: "",
  });

  // URL Editing Modal (Handles Target URL UPDATE CRUD)
  const [editingUrlIndex, setEditingUrlIndex] = useState<number | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>("");

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

  // Load saved templates from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("autobot_saved_templates");
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Save templates to localStorage
  const persistTemplates = (templates: SavedTemplate[]) => {
    setSavedTemplates(templates);
    try {
      localStorage.setItem("autobot_saved_templates", JSON.stringify(templates));
    } catch {}
  };

  // --------------------------------------------------------------------------
  // Profile CRUD Operations
  // --------------------------------------------------------------------------
  const handleOpenAddProfile = () => {
    setEditingProfileIndex(null);
    setProfileForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      role: "",
      message: "",
    });
    setSyncProfileToDatabase(false);
    setShowProfileModal(true);
  };

  const handleOpenEditProfile = (profile: AttendeeProfile, index: number) => {
    setEditingProfileIndex(index);
    setProfileForm({
      id: profile.id,
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      company: profile.company || "",
      role: profile.role || "",
      message: profile.message || profile.pitch || "",
    });
    setSyncProfileToDatabase(Boolean(profile.id && !profile.id.startsWith("local-")));
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      alert("Name and Email are required fields.");
      return;
    }

    const payload: AttendeeProfile = {
      ...profileForm,
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
      phone: profileForm.phone?.trim() || "",
      company: profileForm.company?.trim() || "",
      role: profileForm.role?.trim() || "",
      message: profileForm.message?.trim() || "",
    };

    // If user chose to sync with SQLite Database
    if (syncProfileToDatabase) {
      try {
        if (payload.id && !payload.id.startsWith("local-")) {
          // Update existing DB attendee
          await fetch(`/api/attendees/${payload.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              company: payload.company,
              role: payload.role,
              pitch: payload.message,
            }),
          });
        } else {
          // Create new DB attendee
          const res = await fetch("/api/attendees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              company: payload.company,
              role: payload.role,
              pitch: payload.message,
            }),
          });
          const created = await res.json();
          if (created.attendee?.id) {
            payload.id = created.attendee.id;
          }
        }
        await onRefreshData?.();
      } catch (err) {
        console.error("Failed to sync profile with database:", err);
      }
    }

    if (editingProfileIndex !== null) {
      // UPDATE existing profile in state
      setMatrixProfiles((prev) => {
        const updated = [...prev];
        updated[editingProfileIndex] = {
          ...updated[editingProfileIndex],
          ...payload,
        };
        return updated;
      });
    } else {
      // CREATE new profile in state
      setMatrixProfiles((prev) => [
        ...prev,
        {
          ...payload,
          id: payload.id || `local-${Date.now()}`,
        },
      ]);
    }

    setShowProfileModal(false);
  };

  const handleRemoveProfile = (index: number) => {
    setMatrixProfiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllProfiles = () => {
    if (confirm("Are you sure you want to remove all profiles from the batch list?")) {
      setMatrixProfiles([]);
    }
  };

  const handleImportAllRoster = () => {
    if (attendees.length === 0) return;
    const existingEmails = new Set(matrixProfiles.map((p) => p.email.toLowerCase()));
    const newItems: AttendeeProfile[] = attendees
      .filter((a) => !existingEmails.has(a.email.toLowerCase()))
      .map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        phone: a.phone || "",
        company: a.company || "",
        role: a.role || "",
        message: a.pitch || "",
      }));

    setMatrixProfiles((prev) => [...prev, ...newItems]);
  };

  const handleImportSingleRosterAttendee = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) return;
    const a = attendees.find((item) => item.id === id);
    if (a) {
      if (!matrixProfiles.some((p) => p.email.toLowerCase() === a.email.toLowerCase())) {
        setMatrixProfiles((prev) => [
          ...prev,
          {
            id: a.id,
            name: a.name,
            email: a.email,
            phone: a.phone || "",
            company: a.company || "",
            role: a.role || "",
            message: a.pitch || "",
          },
        ]);
      }
    }
    e.target.value = "";
  };

  // --------------------------------------------------------------------------
  // Target URL CRUD Operations
  // --------------------------------------------------------------------------
  const handleRemoveUrl = (index: number) => {
    const updated = targetUrlsList.filter((_, i) => i !== index);
    setMatrixUrlsText(updated.join("\n"));
  };

  const handleStartEditUrl = (index: number) => {
    setEditingUrlIndex(index);
    setEditingUrlValue(targetUrlsList[index] || "");
  };

  const handleSaveEditUrl = () => {
    if (editingUrlIndex === null) return;
    const trimmed = editingUrlValue.trim();
    if (!trimmed.startsWith("http")) {
      alert("Please enter a valid URL starting with http:// or https://");
      return;
    }
    const updated = [...targetUrlsList];
    updated[editingUrlIndex] = trimmed;
    setMatrixUrlsText(updated.join("\n"));
    setEditingUrlIndex(null);
    setEditingUrlValue("");
  };

  const handleImportEventUrl = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const eventUrl = e.target.value;
    if (!eventUrl) return;
    const existing = new Set(targetUrlsList);
    if (!existing.has(eventUrl)) {
      setMatrixUrlsText((prev) => (prev ? `${prev}\n${eventUrl}` : eventUrl));
    }
    e.target.value = "";
  };

  const handleClearAllUrls = () => {
    if (confirm("Clear all target URLs?")) {
      setMatrixUrlsText("");
    }
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

      // Extract and merge Attendees / Profiles without hardcoded fallbacks
      if (data.attendees && Array.isArray(data.attendees) && data.attendees.length > 0) {
        const parsedProfiles: AttendeeProfile[] = data.attendees.map((a: any, i: number) => ({
          id: `doc-${Date.now()}-${i}`,
          name: a.name || "Member",
          email: a.email,
          phone: a.phone || "",
          company: a.company || "",
          role: a.role || "",
          message: a.pitch || "",
        }));

        setMatrixProfiles((prev) => {
          const seen = new Set(prev.map((p) => p.email.toLowerCase()));
          const uniqueNew = parsedProfiles.filter((p) => !seen.has(p.email.toLowerCase()));
          return [...prev, ...uniqueNew];
        });
        peopleAdded = parsedProfiles.length;
      }

      setUploadFeedback(
        `✅ Successfully extracted ${urlsAdded} target URLs and ${peopleAdded} attendee profiles from ${file.name}.`
      );
      setTimeout(() => setUploadFeedback(null), 6000);
    } catch (err: any) {
      setUploadFeedback(`⚠️ Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --------------------------------------------------------------------------
  // Single Form Dynamic Payload CRUD
  // --------------------------------------------------------------------------
  const handleAddCustomField = () => {
    const key = newFieldKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) return;
    setFormData((prev) => ({
      ...prev,
      [key]: newFieldValue.trim(),
    }));
    setNewFieldKey("");
    setNewFieldValue("");
    setShowAddFieldForm(false);
  };

  const handleRemoveField = (keyToRemove: string) => {
    setFormData((prev) => {
      const next = { ...prev };
      delete next[keyToRemove];
      return next;
    });
  };

  const handleAutofillFromAttendee = (attendeeId: string) => {
    const attendee = attendees.find((a) => a.id === attendeeId);
    if (!attendee) return;

    setFormData((prev) => ({
      ...prev,
      name: attendee.name || prev.name || "",
      email: attendee.email || prev.email || "",
      phone: attendee.phone || prev.phone || "",
      company: attendee.company || prev.company || "",
      role: attendee.role || prev.role || "",
      message: attendee.pitch || prev.message || "",
      telegram: attendee.telegram || prev.telegram || "",
      website: attendee.website || prev.website || "",
      country: attendee.country || prev.country || "",
    }));
  };

  const handleSaveTemplate = () => {
    const name = templateNameInput.trim() || `Template ${savedTemplates.length + 1}`;
    const newTemplate: SavedTemplate = {
      id: `tpl-${Date.now()}`,
      name,
      url: targetUrl.trim(),
      data: { ...formData },
      createdAt: new Date().toISOString(),
    };
    persistTemplates([...savedTemplates, newTemplate]);
    setTemplateNameInput("");
    setShowSaveTemplateModal(false);
  };

  const handleLoadTemplate = (tpl: SavedTemplate) => {
    setTargetUrl(tpl.url);
    setFormData({ ...tpl.data });
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    persistTemplates(savedTemplates.filter((t) => t.id !== id));
  };

  // --------------------------------------------------------------------------
  // Single Form Actions (Inspect & Launch)
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

      // Dynamically add detected DOM keys to formData without hardcoding any values
      setFormData((prev) => {
        const updated = { ...prev };
        data.fields.forEach((f: DetectedField) => {
          const key = (f.suggestedKey || f.name || f.label || "field").toLowerCase().replace(/\s+/g, "_");
          if (key && !(key in updated)) {
            updated[key] = "";
          }
        });
        return updated;
      });
    } catch (err: any) {
      setInspectError(err.message || "Failed to analyze target DOM schema");
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
        `🚀 Agent started execution on ${targetUrl} [${
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
                "Autonomous Agent Studio",
                `Automation completed for ${targetUrl}!`
              );
              setSingleLaunchMessage(
                `🎉 Success! Autonomous form submission completed and verified on ${targetUrl}.`
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
      title: `Target Form #${i + 1}`,
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

  return (
    <div className="flex-1 w-full h-full overflow-y-auto min-h-0 bg-background custom-scrollbar">
      <div className="flex flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full pb-32">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Autonomous Form Studio</span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                  Zero-Hardcoding
                </Badge>
              </h1>
              {isMatrixRunning && (
                <Badge variant="warning" className="animate-pulse text-xs flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {isMatrixPaused ? "Paused" : "Batch Active"}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Autonomous browser-driven form execution. Supports batch matrix ($N$ Links × $M$ People), document parsing (.pdf, .xlsx, .docx, .md), and stealth anti-bot evasion.
            </p>
          </div>

          {/* Visual Browser Mode Toggle */}
          <div className="flex items-center gap-3 bg-card border border-border px-3.5 py-2 rounded-xl shadow-2xs self-start sm:self-auto shrink-0">
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
              title="Toggle between physical on-screen browser window and background stealth mode"
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
            <span>Single Form Studio</span>
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
                  Upload spreadsheets, registration forms, or documents. The agent automatically extracts target URLs and attendee records with zero hardcoding.
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
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 text-xs text-primary rounded-xl animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadFeedback}</span>
              </div>
            )}

            {/* Matrix Setup Grid (URLs on Left, People Profiles on Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: N Target Form URLs (with Full CRUD) */}
              <div className="lg:col-span-6 flex flex-col gap-3 bg-card border border-border rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span>Target Form URLs ($N$)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono font-bold">
                      {targetUrlsList.length} Targets
                    </Badge>
                    {targetUrlsList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllUrls}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-muted hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground border border-border transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Paste form URLs below (one per line) or import from your saved events list:
                </p>

                {/* Import from Saved Events Dropdown */}
                {events.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Database className="w-3 h-3 text-primary" />
                      <span>Saved Events:</span>
                    </span>
                    <select
                      onChange={handleImportEventUrl}
                      defaultValue=""
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="" disabled>
                        Choose an event to add its URL...
                      </option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.url}>
                          {ev.title} ({ev.url})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea
                  value={matrixUrlsText}
                  onChange={(e) => setMatrixUrlsText(e.target.value)}
                  rows={5}
                  placeholder="https://example.com/register&#10;https://forms.company.com/survey&#10;https://mowli.in/"
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs sm:text-sm font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
                />

                {/* Target URLs List Preview with In-Place CRUD (Edit, Delete) */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Configured Targets ({targetUrlsList.length}):
                  </span>
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {targetUrlsList.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                        No target URLs added yet. Enter links above, select a saved event, or upload a document.
                      </div>
                    ) : (
                      targetUrlsList.map((url, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background border border-border text-xs group hover:border-primary/40 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 font-mono">
                            <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              #{i + 1}
                            </span>
                            <span className="truncate text-foreground" title={url}>
                              {url}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditUrl(i)}
                              className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                              title="Edit URL"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUrl(i)}
                              className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete URL"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: M People / Profiles (with Full CRUD) */}
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
                      onClick={handleOpenAddProfile}
                      className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Profile</span>
                    </button>
                  </div>
                </div>

                {/* Import from Team Roster Controls */}
                {attendees.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                        <Users className="w-3 h-3 text-primary" />
                        <span>Team Roster:</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleImportAllRoster}
                        className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                      >
                        + Import All ({attendees.length})
                      </button>
                    </div>
                    <select
                      onChange={handleImportSingleRosterAttendee}
                      defaultValue=""
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="" disabled>
                        Choose individual member from Team Roster...
                      </option>
                      {attendees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Profiles Cards List with Edit & Delete CRUD */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {matrixProfiles.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-2">
                      <Users className="w-6 h-6 mx-auto opacity-40 text-primary" />
                      <p>No profiles added yet.</p>
                      <p className="text-[11px] text-muted-foreground/80">
                        Click "Add Profile", import from your Team Roster, or upload a document.
                      </p>
                    </div>
                  ) : (
                    matrixProfiles.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-background border border-border hover:border-primary/40 transition-all group"
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {p.name || "Unnamed Attendee"}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                              {p.email}
                            </Badge>
                            {p.id && !p.id.startsWith("local-") && (
                              <Badge variant="secondary" className="text-[9px] py-0 px-1 text-primary border-primary/20">
                                DB Synced
                              </Badge>
                            )}
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

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProfile(p, idx)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            title="Edit profile"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveProfile(idx)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                            title="Remove profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {matrixProfiles.length > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleClearAllProfiles}
                      className="text-[11px] text-muted-foreground hover:text-rose-500 cursor-pointer"
                    >
                      Clear all profiles
                    </button>
                  </div>
                )}
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
                    Pairs {targetUrlsList.length} target forms with {matrixProfiles.length} attendee profiles using randomized typing delays & anti-bot evasion.
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
        {/* TAB 2: SINGLE FORM STUDIO (Focused Single-Target Execution)        */}
        {/* ================================================================== */}
        {activeTab === "single" && (
          <div className="space-y-6">
            {/* Target URL Input & Inspection Controls */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  Target Web Form URL
                </label>
                {events.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">From Events:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setTargetUrl(e.target.value);
                          handleInspect(e.target.value);
                        }
                      }}
                      defaultValue=""
                      className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="" disabled>
                        Pick saved event...
                      </option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.url}>
                          {ev.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://example.com/form or https://mowli.in/"
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
                      <span>Inspecting DOM...</span>
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
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Run Automation</span>
                    </>
                  )}
                </button>
              </div>

              {/* Saved Form Templates Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bookmark className="w-3 h-3 text-primary" />
                    <span>Saved Templates:</span>
                  </span>
                  {savedTemplates.length === 0 ? (
                    <span className="text-xs text-muted-foreground/60 italic">No saved templates yet.</span>
                  ) : (
                    savedTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => handleLoadTemplate(tpl)}
                        className="group flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
                      >
                        <span className="font-medium">{tpl.name}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                          className="text-muted-foreground hover:text-rose-500 transition-colors"
                          title="Delete template"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {targetUrl.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(true)}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save Current as Template</span>
                  </button>
                )}
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
              {/* Dynamic Form Payload Config with Full Field CRUD */}
              <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span>Submission Payload ({Object.keys(formData).length} Fields)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddFieldForm(!showAddFieldForm)}
                    className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Field</span>
                  </button>
                </div>

                {/* Autofill From Team Roster Dropdown */}
                {attendees.length > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border">
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span>Autofill:</span>
                    </span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleAutofillFromAttendee(e.target.value);
                      }}
                      defaultValue=""
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="" disabled>
                        Select member to autofill matching payload fields...
                      </option>
                      {attendees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Add Custom Field Inline Box */}
                {showAddFieldForm && (
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <div className="text-xs font-bold text-foreground">Add New Payload Field</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Field key (e.g. linkedin, city, why_join)"
                        value={newFieldKey}
                        onChange={(e) => setNewFieldKey(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        placeholder="Field value"
                        value={newFieldValue}
                        onChange={(e) => setNewFieldValue(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddFieldForm(false)}
                        className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomField}
                        disabled={!newFieldKey.trim()}
                        className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                      >
                        Add to Payload
                      </button>
                    </div>
                  </div>
                )}

                {/* Field Pairs Inputs */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {Object.keys(formData).length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                      No fields configured. Inspect a form to auto-detect fields or add custom fields.
                    </div>
                  ) : (
                    Object.entries(formData).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground capitalize flex items-center gap-1.5">
                            <span>{key.replace(/_/g, " ")}</span>
                            <span className="text-[10px] font-mono text-muted-foreground lowercase">
                              ({key})
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(key)}
                            className="text-muted-foreground hover:text-rose-500 p-1 text-xs transition-colors cursor-pointer"
                            title="Remove this field"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {key === "message" || key === "pitch" || key.includes("question") || key.includes("about") ? (
                          <textarea
                            value={val}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            rows={3}
                            placeholder={`Enter ${key.replace(/_/g, " ")}...`}
                            className="w-full bg-background border border-border rounded-xl p-3 text-xs sm:text-sm text-foreground outline-none focus:border-primary resize-y"
                          />
                        ) : (
                          <input
                            type={key.includes("email") ? "email" : "text"}
                            value={val}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            placeholder={`Enter ${key.replace(/_/g, " ")}...`}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Detected DOM Schema */}
              <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Detected Form DOM Schema</span>
                  </h3>
                  {inspectionResult && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {inspectionResult.fields.length} Fields Detected
                    </Badge>
                  )}
                </div>

                {!inspectionResult ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2 border border-dashed border-border rounded-xl">
                    <Search className="w-8 h-8 opacity-40 text-primary" />
                    <p className="text-xs">
                      Enter a URL and click "Inspect Form" to analyze input fields, select boxes, and checkboxes in real-time.
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
                        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
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

        {/* ================================================================== */}
        {/* MODAL: Add / Edit Person Profile (Full CRUD with Database Sync)    */}
        {/* ================================================================== */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">
                  {editingProfileIndex !== null ? "Edit Attendee Profile" : "Add Attendee Profile"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-foreground">Full Name *</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground">Email Address *</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={profileForm.phone || ""}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-foreground">Company / Organization</label>
                    <input
                      type="text"
                      value={profileForm.company || ""}
                      onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                      placeholder="Organization name"
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-foreground">Role / Title</label>
                    <input
                      type="text"
                      value={profileForm.role || ""}
                      onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                      placeholder="Title or role"
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground">Custom Message / Bio / Pitch</label>
                  <textarea
                    value={profileForm.message || ""}
                    onChange={(e) => setProfileForm({ ...profileForm, message: e.target.value })}
                    rows={2}
                    placeholder="Enter custom message or pitch to submit in forms..."
                    className="w-full mt-1 bg-background border border-border rounded-lg p-2.5 text-foreground outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Database Sync Option */}
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncProfileToDatabase}
                    onChange={(e) => setSyncProfileToDatabase(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="text-muted-foreground">
                    Save to Team Roster Database (persistent across sessions)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={!profileForm.name.trim() || !profileForm.email.trim()}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {editingProfileIndex !== null ? "Update Profile" : "Save Profile"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* MODAL: Edit Target URL                                             */}
        {/* ================================================================== */}
        {editingUrlIndex !== null && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">
                  Edit Target URL #{editingUrlIndex + 1}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingUrlIndex(null)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="font-medium text-foreground">Target URL</label>
                <input
                  type="url"
                  value={editingUrlValue}
                  onChange={(e) => setEditingUrlValue(e.target.value)}
                  placeholder="https://example.com/form"
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs sm:text-sm font-mono text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingUrlIndex(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditUrl}
                  disabled={!editingUrlValue.trim()}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-2xs"
                >
                  Update Target URL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* MODAL: Save Form Template                                          */}
        {/* ================================================================== */}
        {showSaveTemplateModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Save Form Template</h3>
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="font-medium text-foreground">Template Name</label>
                <input
                  type="text"
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  placeholder="e.g. Mowli Contact Form, Waitlist V1"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-primary text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!templateNameInput.trim()}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-2xs"
                >
                  Save Template
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
