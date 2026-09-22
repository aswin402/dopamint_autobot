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
  Tv,
  ExternalLink,
  Filter,
  CheckSquare,
  ChevronDown,
  Key,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetectedField, InspectionResult } from "@/lib/automation/runner";
import { playNotificationChime, triggerDesktopNotification } from "@/lib/notifications";
import { LiveBrowserScreen } from "./LiveBrowserScreen";

export interface ThemedDropdownOption<T> {
  value: T;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive" | "warning";
  icon?: React.ReactNode;
}

interface ThemedDropdownProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: ThemedDropdownOption<T>[];
  icon?: React.ReactNode;
  direction?: "up" | "down";
  align?: "left" | "right";
  className?: string;
  placeholder?: string;
}

function ThemedDropdown<T>({
  value,
  onChange,
  options,
  icon,
  direction = "down",
  align = "left",
  className = "",
  placeholder = "Select option",
}: ThemedDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleMouseDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${isOpen ? "z-50" : "z-10"} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer shadow-2xs ${
          isOpen
            ? "bg-background border-primary ring-1 ring-primary/30 text-foreground"
            : "bg-background border-border hover:border-primary/50 text-foreground"
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 pr-1">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="font-semibold truncate text-left">
            {selected?.label || placeholder}
          </span>
          {selected?.badge && (
            <Badge
              variant={selected.badgeVariant || "secondary"}
              className="text-[9px] px-1.5 py-0 font-mono shrink-0"
            >
              {selected.badge}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${
            isOpen ? (direction === "up" ? "-rotate-180" : "rotate-180") : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 min-w-[260px] sm:min-w-[300px] max-w-[92vw] max-h-72 overflow-y-auto custom-scrollbar bg-popover/98 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 ${
            direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${align === "right" ? "right-0 left-auto" : "left-0 right-auto"}`}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer text-left ${
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold border border-primary/25"
                    : "text-foreground hover:bg-muted/70 hover:text-foreground border border-transparent"
                }`}
              >
                <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="font-semibold truncate">{opt.label}</span>
                    {opt.badge && (
                      <Badge
                        variant={opt.badgeVariant || (isSelected ? "default" : "secondary")}
                        className="text-[9px] px-1.5 py-0 font-mono shrink-0"
                      >
                        {opt.badge}
                      </Badge>
                    )}
                  </div>
                  {opt.sublabel && (
                    <span
                      className={`text-[10px] leading-tight ${
                        isSelected ? "text-primary/80" : "text-muted-foreground"
                      }`}
                    >
                      {opt.sublabel}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  // Active Tab: "matrix" (Bulk Automation), "single" (Single Form), or "live" (Inbuilt Live Browser)
  const [activeTab, setActiveTab] = useState<"matrix" | "single" | "live">("matrix");
  const [runnerStatus, setRunnerStatus] = useState<any>(null);

  // Poll automation runner status for tab indicators and live screens
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/automation/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setRunnerStatus(data);
          }
        }
      } catch {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, runnerStatus?.isRunning ? 800 : 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [runnerStatus?.isRunning]);

  // --------------------------------------------------------------------------
  // Bulk Automation State
  // --------------------------------------------------------------------------
  const [matrixUrlsText, setMatrixUrlsText] = useState<string>("");
  const [matrixProfiles, setMatrixProfiles] = useState<AttendeeProfile[]>([]);

  const [pairingMode, setPairingMode] = useState<"cartesian" | "pairwise">("cartesian");
  const [pacingDelaySec, setPacingDelaySec] = useState<number>(8);
  const [preSubmitDelayMs, setPreSubmitDelayMs] = useState<number>(1500);

  // File Ingestion State
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  // URL Management State (Add, Edit, Bulk Paste)
  const [quickUrlInput, setQuickUrlInput] = useState<string>("");
  const [editingUrlIndex, setEditingUrlIndex] = useState<number | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>("");
  const [showBulkUrlModal, setShowBulkUrlModal] = useState<boolean>(false);
  const [bulkUrlInputText, setBulkUrlInputText] = useState<string>("");

  // Table Search & Filter State
  const [urlSearchQuery, setUrlSearchQuery] = useState<string>("");
  const [peopleSearchQuery, setPeopleSearchQuery] = useState<string>("");
  const [activeTableView, setActiveTableView] = useState<"both" | "forms" | "people">("both");
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);
  const [copiedEmailIndex, setCopiedEmailIndex] = useState<number | null>(null);

  // Batch Live Monitoring State
  const [isMatrixRunning, setIsMatrixRunning] = useState(false);
  const [isMatrixPaused, setIsMatrixPaused] = useState(false);
  const [matrixStatus, setMatrixStatus] = useState<any>(null);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Single Form Studio State
  // --------------------------------------------------------------------------
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [newFieldKey, setNewFieldKey] = useState<string>("");
  const [newFieldValue, setNewFieldValue] = useState<string>("");
  const [showAddFieldForm, setShowAddFieldForm] = useState<boolean>(false);

  const [isSingleLaunching, setIsSingleLaunching] = useState(false);
  const [singleLaunchMessage, setSingleLaunchMessage] = useState<string | null>(null);
  const [singleLaunchSuccess, setSingleLaunchSuccess] = useState<boolean | null>(null);

  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templateNameInput, setTemplateNameInput] = useState<string>("");
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);

  // Load saved templates on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("autobot_saved_templates");
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const persistTemplates = (templates: SavedTemplate[]) => {
    setSavedTemplates(templates);
    try {
      localStorage.setItem("autobot_saved_templates", JSON.stringify(templates));
    } catch {}
  };

  // Parse URLs from multiline string
  const targetUrlsList = targetUrlsTextToList(matrixUrlsText);

  function targetUrlsTextToList(text: string): string[] {
    return text
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));
  }

  // Filtered lists for table search
  const filteredUrls = targetUrlsList.filter((url) => {
    if (!urlSearchQuery.trim()) return true;
    return url.toLowerCase().includes(urlSearchQuery.toLowerCase());
  });

  const filteredProfiles = matrixProfiles.filter((p) => {
    if (!peopleSearchQuery.trim()) return true;
    const q = peopleSearchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.company && p.company.toLowerCase().includes(q)) ||
      (p.role && p.role.toLowerCase().includes(q))
    );
  });

  // Calculate total matrix tasks
  const calculatedTotalTasks =
    pairingMode === "pairwise"
      ? Math.max(targetUrlsList.length, matrixProfiles.length)
      : targetUrlsList.length * matrixProfiles.length;

  // Domain name extraction helper
  const getDomainFromUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return "web form";
    }
  };

  // Copy helper
  const handleCopyText = (text: string, type: "url" | "email", index: number) => {
    try {
      navigator.clipboard.writeText(text);
      if (type === "url") {
        setCopiedUrlIndex(index);
        setTimeout(() => setCopiedUrlIndex(null), 2000);
      } else {
        setCopiedEmailIndex(index);
        setTimeout(() => setCopiedEmailIndex(null), 2000);
      }
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
      lumaSessionKey: "",
      proxyUrl: "",
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
      lumaSessionKey: profile.lumaSessionKey || "",
      proxyUrl: profile.proxyUrl || "",
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
      lumaSessionKey: profileForm.lumaSessionKey?.trim() || null,
      proxyUrl: profileForm.proxyUrl?.trim() || null,
    };

    if (syncProfileToDatabase) {
      try {
        if (payload.id && !payload.id.startsWith("local-")) {
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
              lumaSessionKey: payload.lumaSessionKey,
              proxyUrl: payload.proxyUrl,
            }),
          });
        } else {
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
              lumaSessionKey: payload.lumaSessionKey,
              proxyUrl: payload.proxyUrl,
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
      setMatrixProfiles((prev) => {
        const updated = [...prev];
        updated[editingProfileIndex] = {
          ...updated[editingProfileIndex],
          ...payload,
        };
        return updated;
      });
    } else {
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
    if (confirm("Are you sure you want to remove all people from this automation?")) {
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
  const handleAddQuickUrl = () => {
    const trimmed = quickUrlInput.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      alert("Please enter a valid URL starting with http:// or https://");
      return;
    }
    if (targetUrlsList.includes(trimmed)) {
      alert("This URL is already in your target list.");
      return;
    }
    setMatrixUrlsText((prev) => (prev ? `${prev}\n${trimmed}` : trimmed));
    setQuickUrlInput("");
  };

  const handleBulkAddUrls = () => {
    if (!bulkUrlInputText.trim()) return;
    const matches = bulkUrlInputText.match(/https?:\/\/[^\s"'<>]+/g) || [];
    if (matches.length === 0) {
      alert("No valid URLs found in the text. Ensure links begin with http:// or https://");
      return;
    }
    const existing = new Set(targetUrlsList);
    const added: string[] = [];
    for (const u of matches) {
      const clean = u.trim().replace(/[.,;)]+$/, "");
      if (!existing.has(clean)) {
        existing.add(clean);
        added.push(clean);
      }
    }
    if (added.length > 0) {
      setMatrixUrlsText((prev) => (prev ? `${prev}\n${added.join("\n")}` : added.join("\n")));
    }
    setBulkUrlInputText("");
    setShowBulkUrlModal(false);
  };

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
    if (confirm("Are you sure you want to clear all target form URLs?")) {
      setMatrixUrlsText("");
    }
  };

  // --------------------------------------------------------------------------
  // Document Upload Extraction Handler (.pdf, .xlsx, .csv, .docx, .md)
  // --------------------------------------------------------------------------
  const processUploadedFile = async (file: File) => {
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

      if (data.events && Array.isArray(data.events) && data.events.length > 0) {
        const newUrls = data.events.map((ev: any) => ev.url).filter(Boolean);
        const existingUrls = targetUrlsList;
        const mergedUrls = Array.from(new Set([...existingUrls, ...newUrls]));
        urlsAdded = mergedUrls.length - existingUrls.length;
        setMatrixUrlsText(mergedUrls.join("\n"));
      }

      if (data.attendees && Array.isArray(data.attendees) && data.attendees.length > 0) {
        const existingEmails = new Set(matrixProfiles.map((p) => p.email.toLowerCase()));
        const uniquePeople: AttendeeProfile[] = [];

        for (const a of data.attendees) {
          if (a.email && !existingEmails.has(a.email.toLowerCase())) {
            existingEmails.add(a.email.toLowerCase());
            uniquePeople.push({
              id: a.id || `uploaded-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: a.name || "Attendee",
              email: a.email,
              phone: a.phone || "",
              company: a.company || "",
              role: a.role || "",
              message: a.pitch || a.notes || "",
            });
          }
        }

        peopleAdded = uniquePeople.length;
        if (uniquePeople.length > 0) {
          setMatrixProfiles((prev) => [...prev, ...uniquePeople]);
        }
      }

      setUploadFeedback(
        `Imported ${file.name}: Added ${urlsAdded} links and ${peopleAdded} people profiles.`
      );
      await onRefreshData?.();
    } catch (err: any) {
      alert(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  // --------------------------------------------------------------------------
  // Launch & Runner Controls
  // --------------------------------------------------------------------------
  const handleLaunchMatrix = async () => {
    if (targetUrlsList.length === 0) {
      alert("Please configure at least one valid target URL.");
      return;
    }
    if (matrixProfiles.length === 0) {
      alert("Please add at least one person profile to submit.");
      return;
    }

    setIsMatrixRunning(true);
    setIsMatrixPaused(false);
    setBatchFeedback("Dispatching bulk automation batch...");

    try {
      const res = await fetch("/api/automation/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: targetUrlsList,
          profiles: matrixProfiles,
          pairingMode,
          pacingDelaySec,
          preSubmitDelayMs,
          isHeadless: !isVisualMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to launch bulk automation");
      }

      setBatchFeedback(
        `Bulk automation launched! Processing ${data.totalTasks || calculatedTotalTasks} tasks.`
      );
      onLaunchSuccess?.();
    } catch (err: any) {
      setIsMatrixRunning(false);
      alert(err.message || "Failed to start bulk automation");
    }
  };

  const handlePauseResume = async () => {
    try {
      if (isMatrixPaused) {
        await fetch("/api/automation/resume", { method: "POST" });
        setIsMatrixPaused(false);
      } else {
        await fetch("/api/automation/pause", { method: "POST" });
        setIsMatrixPaused(true);
      }
    } catch {}
  };

  const handleStopMatrix = async () => {
    try {
      await fetch("/api/automation/stop", { method: "POST" });
      setIsMatrixRunning(false);
      setIsMatrixPaused(false);
      setBatchFeedback("Bulk automation stopped.");
    } catch {}
  };

  // Poll matrix execution status
  useEffect(() => {
    if (!isMatrixRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/automation/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setMatrixStatus(data);
          if (!data.isRunning) {
            setIsMatrixRunning(false);
            setIsMatrixPaused(false);
            playNotificationChime();
            triggerDesktopNotification(
              "Bulk Automation Complete",
              `Finished ${data.progress?.completed || 0} tasks (${data.progress?.successCount || 0} successes).`
            );
          }
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [isMatrixRunning]);

  // --------------------------------------------------------------------------
  // Single Form Studio Handlers
  // --------------------------------------------------------------------------
  const handleInspect = async (overrideUrl?: string) => {
    const urlToInspect = overrideUrl || targetUrl;
    if (!urlToInspect || !urlToInspect.startsWith("http")) {
      setInspectError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsInspecting(true);
    setInspectError(null);
    setInspectionResult(null);

    try {
      const res = await fetch("/api/automation/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToInspect, isHeadless: !isVisualMode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to inspect form structure.");
      }

      setInspectionResult(data.data);

      if (data.data?.fields && Array.isArray(data.data.fields)) {
        const detectedMap: Record<string, string> = { ...formData };
        data.data.fields.forEach((f: DetectedField) => {
          const key = f.suggestedKey || f.name || f.tag;
          if (key && !detectedMap[key]) {
            detectedMap[key] = "";
          }
        });
        setFormData(detectedMap);
      }
    } catch (err: any) {
      setInspectError(err.message || "Failed to inspect the form.");
    } finally {
      setIsInspecting(false);
    }
  };

  const handleAutofillFromAttendee = (attendeeId: string) => {
    const selected = attendees.find((a) => a.id === attendeeId);
    if (!selected) return;

    setFormData((prev) => ({
      ...prev,
      name: selected.name || prev.name,
      email: selected.email || prev.email,
      phone: selected.phone || prev.phone,
      company: selected.company || prev.company,
      role: selected.role || prev.role,
      message: selected.pitch || prev.message,
    }));
  };

  const handleAddCustomField = () => {
    if (!newFieldKey.trim()) return;
    const cleanKey = newFieldKey.trim().toLowerCase().replace(/\s+/g, "_");
    setFormData((prev) => ({
      ...prev,
      [cleanKey]: newFieldValue,
    }));
    setNewFieldKey("");
    setNewFieldValue("");
    setShowAddFieldForm(false);
  };

  const handleRemoveField = (key: string) => {
    const copy = { ...formData };
    delete copy[key];
    setFormData(copy);
  };

  const handleLaunchSingle = async () => {
    if (!targetUrl || !targetUrl.startsWith("http")) {
      alert("Please enter a valid target URL.");
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
          formData,
          isHeadless: !isVisualMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Automation failed");
      }

      setSingleLaunchSuccess(true);
      setSingleLaunchMessage(data.message || "Form submitted successfully!");
      onLaunchSuccess?.();
    } catch (err: any) {
      setSingleLaunchSuccess(false);
      setSingleLaunchMessage(err.message || "Automation failed.");
    } finally {
      setIsSingleLaunching(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateNameInput.trim() || !targetUrl.trim()) return;
    const newTpl: SavedTemplate = {
      id: `tpl-${Date.now()}`,
      name: templateNameInput.trim(),
      url: targetUrl.trim(),
      data: formData,
      createdAt: new Date().toISOString(),
    };
    persistTemplates([...savedTemplates, newTpl]);
    setTemplateNameInput("");
    setShowSaveTemplateModal(false);
  };

  const handleLoadTemplate = (tpl: SavedTemplate) => {
    setTargetUrl(tpl.url);
    setFormData(tpl.data);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    persistTemplates(savedTemplates.filter((t) => t.id !== id));
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto min-h-0 bg-background custom-scrollbar">
      <div className="flex flex-col gap-5 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full pb-36">
        {/* ================================================================== */}
        {/* HERO COMMAND HEADER: Tab Selector & Visual Mode Indicator           */}
        {/* ================================================================== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Globe className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Autonomous Form Studio</span>
              </h1>
              {isMatrixRunning && (
                <Badge variant="warning" className="animate-pulse text-[10px] gap-1 font-mono uppercase">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  {isMatrixPaused ? "Paused" : "Running Batch"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Configure multi-link form targets, attendee data rosters, and anti-bot execution rules in high-density tables.
            </p>
          </div>

          {/* Mode Selector Tabs (Segmented Linear Style) */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "matrix"
                  ? "bg-background text-foreground shadow-2xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Bulk Automation</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border/60">
                {calculatedTotalTasks}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("single")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "single"
                  ? "bg-background text-foreground shadow-2xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-primary" />
              <span>Single Form</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("live")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "live"
                  ? "bg-background text-foreground shadow-2xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-primary" />
              <span>Live Screencast</span>
              {runnerStatus?.isRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              )}
            </button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* TAB 1: BULK AUTOMATION (Enterprise Data Tables)                   */}
        {/* ================================================================== */}
        {activeTab === "matrix" && (
          <div className="space-y-6">
            {/* 1. Metric Stat Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Target Forms
                  </span>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {targetUrlsList.length}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Globe className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    People Profiles
                  </span>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {matrixProfiles.length}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Batch Workload
                  </span>
                  <div className="text-lg font-bold text-primary font-mono">
                    {calculatedTotalTasks} Tasks
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <Layers className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Pacing Guard
                  </span>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {pacingDelaySec}s Delay
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* 2. File Ingestion Dropzone Strip */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processUploadedFile(file);
              }}
              className={`border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.003]"
                  : "border-border/80 bg-card/60 hover:bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">
                      Auto-Extract Links & Attendee Rosters From Document
                    </span>
                    <div className="flex items-center gap-1">
                      {["PDF", "XLSX", "CSV", "DOCX", "MD"].map((fmt) => (
                        <span
                          key={fmt}
                          className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/60 font-semibold"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Drop your spreadsheet or contact list here to automatically populate the data tables below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
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
                  className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Reading Document...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Browse Document</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {uploadFeedback && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 rounded-xl animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadFeedback}</span>
              </div>
            )}

            {/* 3. Table Navigation Switcher (Both / Forms / People) */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTableView("both")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTableView === "both"
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Split View (All Tables)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTableView("forms")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTableView === "forms"
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe className="w-3 h-3 text-primary" />
                  <span>Target Forms</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-muted/80">
                    {targetUrlsList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTableView("people")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTableView === "people"
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-3 h-3 text-primary" />
                  <span>People & Data</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-muted/80">
                    {matrixProfiles.length}
                  </span>
                </button>
              </div>

              <div className="text-xs text-muted-foreground font-mono hidden md:block">
                Mode: {pairingMode === "cartesian" ? "Cartesian N×M" : "Pairwise 1:1"}
              </div>
            </div>

            {/* 4. ENTERPRISE DATA TABLES CONTAINER */}
            <div className="space-y-8">
              {/* TABLE 1: TARGET FORM LINKS */}
              {(activeTableView === "both" || activeTableView === "forms") && (
                <div className="bg-card border border-border/80 rounded-2xl shadow-2xs relative">
                  {/* Table Control Toolbar */}
                  <div className="p-4 border-b border-border/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                          <span>Target Form Links</span>
                          <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                            {targetUrlsList.length} {targetUrlsList.length === 1 ? "Link" : "Links"}
                          </Badge>
                        </h2>
                      </div>
                    </div>

                    {/* Actions & Quick Add */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Search Filter */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={urlSearchQuery}
                          onChange={(e) => setUrlSearchQuery(e.target.value)}
                          placeholder="Filter links..."
                          className="bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary w-36 sm:w-44"
                        />
                      </div>

                      {/* Quick Add URL Inline */}
                      <div className="flex items-center gap-1 flex-1 sm:flex-initial">
                        <input
                          type="url"
                          value={quickUrlInput}
                          onChange={(e) => setQuickUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddQuickUrl();
                          }}
                          placeholder="https://example.com/register"
                          className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary w-48 sm:w-60"
                        />
                        <button
                          type="button"
                          onClick={handleAddQuickUrl}
                          disabled={!quickUrlInput.trim()}
                          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-2xs transition-all shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bulk Paste Dialog Trigger */}
                      <button
                        type="button"
                        onClick={() => setShowBulkUrlModal(true)}
                        className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Bulk Paste</span>
                      </button>

                      {/* Import from Saved Events Dropdown */}
                      {events.length > 0 && (
                        <ThemedDropdown<string>
                          value=""
                          onChange={(url) => {
                            if (url) handleImportEventUrl({ target: { value: url } } as any);
                          }}
                          placeholder="+ Import Event..."
                          direction="down"
                          align="right"
                          icon={<Database className="w-3 h-3 text-primary" />}
                          className="w-40 sm:w-48 shrink-0"
                          options={events.map((ev) => ({
                            value: ev.url,
                            label: ev.title,
                            sublabel: ev.url,
                            badge: "Event",
                          }))}
                        />
                      )}

                      {targetUrlsList.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllUrls}
                          className="px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer shrink-0"
                          title="Clear all URLs"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Forms Table Container */}
                  <div className="overflow-x-auto max-h-72 custom-scrollbar rounded-b-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-muted/40 sticky top-0 z-10 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4 w-12 text-center">#</th>
                          <th className="py-2.5 px-4 w-44">Domain / Platform</th>
                          <th className="py-2.5 px-4">Target Form URL</th>
                          <th className="py-2.5 px-4 w-28 text-center">Security</th>
                          <th className="py-2.5 px-4 w-28 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredUrls.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-muted-foreground">
                              <Globe className="w-6 h-6 mx-auto opacity-30 text-primary mb-2" />
                              <p className="font-medium text-xs">No form links added yet.</p>
                              <p className="text-[11px] text-muted-foreground/70">
                                Paste a URL above, import from events, or click "Bulk Paste".
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredUrls.map((url, idx) => {
                            const originalIdx = targetUrlsList.indexOf(url);
                            const domain = getDomainFromUrl(url);
                            const isHttps = url.startsWith("https://");

                            return (
                              <tr
                                key={idx}
                                className="hover:bg-muted/30 transition-colors group"
                              >
                                <td className="py-2.5 px-4 text-center font-mono text-muted-foreground font-semibold">
                                  {originalIdx + 1}
                                </td>
                                <td className="py-2.5 px-4 font-medium">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/50 text-[11px] font-mono">
                                    <Globe className="w-3 h-3 text-primary shrink-0" />
                                    <span className="truncate max-w-[120px]">{domain}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 font-mono text-[11px] text-foreground">
                                  <div className="flex items-center gap-2 group/copy">
                                    <span className="truncate max-w-md" title={url}>
                                      {url}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(url, "url", idx)}
                                      className="text-muted-foreground hover:text-foreground opacity-0 group-hover/copy:opacity-100 transition-opacity p-0.5"
                                      title="Copy URL"
                                    >
                                      {copiedUrlIndex === idx ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <Badge
                                    variant={isHttps ? "outline" : "warning"}
                                    className="text-[9px] font-mono py-0 px-1.5"
                                  >
                                    {isHttps ? "HTTPS" : "HTTP"}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                      title="Open URL in new tab"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditUrl(originalIdx)}
                                      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                      title="Edit URL"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveUrl(originalIdx)}
                                      className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      title="Remove URL"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TABLE 2: PEOPLE & ATTENDEE PROFILES */}
              {(activeTableView === "both" || activeTableView === "people") && (
                <div className="bg-card border border-border/80 rounded-2xl shadow-2xs relative">
                  {/* Table Control Toolbar */}
                  <div className="p-4 border-b border-border/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                          <span>People & Form Profiles</span>
                          <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                            {matrixProfiles.length}{" "}
                            {matrixProfiles.length === 1 ? "Person" : "People"}
                          </Badge>
                        </h2>
                      </div>
                    </div>

                    {/* Actions & Add Person */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Search Filter */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={peopleSearchQuery}
                          onChange={(e) => setPeopleSearchQuery(e.target.value)}
                          placeholder="Filter people..."
                          className="bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary w-36 sm:w-44"
                        />
                      </div>

                      {/* Add Person CTA */}
                      <button
                        type="button"
                        onClick={handleOpenAddProfile}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Person</span>
                      </button>

                      {/* Import All Roster */}
                      {attendees.length > 0 && (
                        <button
                          type="button"
                          onClick={handleImportAllRoster}
                          className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all shrink-0"
                        >
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>Import Roster ({attendees.length})</span>
                        </button>
                      )}

                      {/* Import Single Attendee */}
                      {attendees.length > 0 && (
                        <ThemedDropdown<string>
                          value=""
                          onChange={(id) => {
                            if (id) handleImportSingleRosterAttendee({ target: { value: id } } as any);
                          }}
                          placeholder="+ Member..."
                          direction="down"
                          align="right"
                          icon={<Users className="w-3 h-3 text-primary" />}
                          className="w-36 sm:w-44 shrink-0"
                          options={attendees.map((a) => ({
                            value: a.id,
                            label: a.name,
                            sublabel: a.email,
                            badge: a.company || "Roster",
                          }))}
                        />
                      )}

                      {matrixProfiles.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllProfiles}
                          className="px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer shrink-0"
                          title="Clear all people"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* People Table Container */}
                  <div className="overflow-x-auto max-h-80 custom-scrollbar rounded-b-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-muted/40 sticky top-0 z-10 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Attendee Name</th>
                          <th className="py-2.5 px-4">Email Address</th>
                          <th className="py-2.5 px-4">Phone</th>
                          <th className="py-2.5 px-4">Organization / Role</th>
                          <th className="py-2.5 px-4">Custom Pitch / Note</th>
                          <th className="py-2.5 px-4 w-24 text-center">Status</th>
                          <th className="py-2.5 px-4 w-20 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredProfiles.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-muted-foreground">
                              <Users className="w-6 h-6 mx-auto opacity-30 text-primary mb-2" />
                              <p className="font-medium text-xs">No attendee profiles added yet.</p>
                              <p className="text-[11px] text-muted-foreground/70">
                                Click "Add Person", import from your Team Roster, or drop a document above.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredProfiles.map((p, idx) => {
                            const originalIdx = matrixProfiles.indexOf(p);
                            const hasDb = Boolean(p.id && !p.id.startsWith("local-") && !p.id.startsWith("uploaded-"));

                            return (
                              <tr
                                key={p.id || idx}
                                className="hover:bg-muted/30 transition-colors group"
                              >
                                <td className="py-2.5 px-4 font-medium text-foreground">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {p.name.slice(0, 1).toUpperCase()}
                                    </div>
                                    <span className="font-semibold text-foreground truncate max-w-[140px]">
                                      {p.name || "Unnamed"}
                                    </span>
                                    {p.lumaSessionKey && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium flex items-center gap-1 shrink-0" title="Authenticated Luma session active">
                                        <Key className="w-2.5 h-2.5" /> Luma Auth
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                                  <div className="flex items-center gap-1.5 group/copy">
                                    <span className="truncate max-w-[160px] text-foreground">
                                      {p.email}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(p.email, "email", idx)}
                                      className="text-muted-foreground hover:text-foreground opacity-0 group-hover/copy:opacity-100 transition-opacity p-0.5"
                                      title="Copy email"
                                    >
                                      {copiedEmailIndex === idx ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-muted-foreground font-mono text-[11px]">
                                  {p.phone || <span className="text-muted-foreground/40">—</span>}
                                </td>
                                <td className="py-2.5 px-4 text-muted-foreground">
                                  {p.company || p.role ? (
                                    <div className="flex items-center gap-1 text-[11px] truncate max-w-[160px]">
                                      {p.company && (
                                        <span className="font-medium text-foreground">
                                          {p.company}
                                        </span>
                                      )}
                                      {p.company && p.role && <span>·</span>}
                                      {p.role && <span>{p.role}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-muted-foreground">
                                  {p.message || p.pitch ? (
                                    <span
                                      className="truncate block max-w-[180px] italic text-[11px]"
                                      title={p.message || p.pitch}
                                    >
                                      "{p.message || p.pitch}"
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <Badge
                                    variant={hasDb ? "secondary" : "outline"}
                                    className="text-[9px] py-0 px-1 font-mono"
                                  >
                                    {hasDb ? "DB Roster" : "Batch Local"}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditProfile(p, originalIdx)}
                                      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                      title="Edit attendee"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveProfile(originalIdx)}
                                      className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      title="Remove attendee"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 5. DOCKED AUTOMATION EXECUTION CONSOLE */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Automation Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  {/* Distribution Pairing Mode */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>Distribution Mode</span>
                    </label>
                    <ThemedDropdown<"cartesian" | "pairwise">
                      value={pairingMode}
                      onChange={(val) => setPairingMode(val)}
                      direction="up"
                      icon={<Layers className="w-3.5 h-3.5 text-primary" />}
                      options={[
                        {
                          value: "cartesian",
                          label: "All Forms × All People",
                          sublabel: `${targetUrlsList.length} Forms × ${matrixProfiles.length} People (${calculatedTotalTasks} tasks total)`,
                          badge: "Full Matrix",
                          badgeVariant: "secondary",
                          icon: <Layers className="w-3.5 h-3.5 text-primary" />,
                        },
                        {
                          value: "pairwise",
                          label: "Pairwise 1:1 Matching",
                          sublabel: `Form #N pairs with Person #N (${calculatedTotalTasks} tasks total)`,
                          badge: "1:1 Direct",
                          badgeVariant: "outline",
                          icon: <CheckSquare className="w-3.5 h-3.5 text-primary" />,
                        },
                      ]}
                    />
                  </div>

                  {/* Anti-Bot Delay */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Anti-Bot Delay</span>
                    </label>
                    <ThemedDropdown<number>
                      value={pacingDelaySec}
                      onChange={(val) => setPacingDelaySec(val)}
                      direction="up"
                      icon={<Clock className="w-3.5 h-3.5 text-primary" />}
                      options={[
                        {
                          value: 8,
                          label: "8s Pacing (Recommended)",
                          sublabel: "Human mouse simulation & field typing jitter",
                          badge: "Recommended",
                          badgeVariant: "secondary",
                          icon: <Clock className="w-3.5 h-3.5 text-emerald-500" />,
                        },
                        {
                          value: 5,
                          label: "5s Pacing (Fast Turbo)",
                          sublabel: "Higher throughput for simple forms and trusted IPs",
                          badge: "Fast Mode",
                          badgeVariant: "outline",
                          icon: <Zap className="w-3.5 h-3.5 text-amber-500" />,
                        },
                        {
                          value: 15,
                          label: "15s Pacing (Stealth Guard)",
                          sublabel: "Heavy human pauses to evade Cloudflare / bot shields",
                          badge: "Stealth",
                          badgeVariant: "warning",
                          icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />,
                        },
                        {
                          value: 25,
                          label: "25s Pacing (Ultra-Safe)",
                          sublabel: "Maximum breather intervals for strict enterprise portals",
                          badge: "Ultra-Safe",
                          badgeVariant: "outline",
                          icon: <Clock className="w-3.5 h-3.5 text-purple-500" />,
                        },
                      ]}
                    />
                  </div>

                  {/* Visual Mode Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      {isVisualMode ? (
                        <Eye className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span>Browser Mode</span>
                    </label>
                    <button
                      type="button"
                      onClick={onToggleVisualMode}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isVisualMode
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                          : "bg-background border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{isVisualMode ? "👁️ Watching Live Window" : "Stealth Headless"}</span>
                      <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-muted/60">
                        {isVisualMode ? "ON" : "OFF"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Primary Launch Action */}
                <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                  {isMatrixRunning ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePauseResume}
                        className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {isMatrixPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current text-emerald-500" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5 text-amber-500" />
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
                      className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Bulk Automation ({calculatedTotalTasks} Tasks)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress & Live Status Banner */}
              {matrixStatus && (
                <div className="p-4 rounded-xl bg-background border border-border/80 space-y-3 animate-in fade-in">
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
                      <div className="text-[11px] font-semibold text-muted-foreground">Successes</div>
                      <div className="text-sm font-bold text-emerald-500">
                        {matrixStatus.progress.successCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-[11px] font-semibold text-muted-foreground">Failures</div>
                      <div className="text-sm font-bold text-rose-500">
                        {matrixStatus.progress.failedCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-[11px] font-semibold text-muted-foreground">Active Form</div>
                      <div className="text-xs font-mono font-medium truncate text-foreground">
                        {matrixStatus.currentEvent?.title || "Idle"}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-[11px] font-semibold text-muted-foreground">Active Person</div>
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
        {/* TAB 2: SINGLE FORM STUDIO (Focused Single-Target Inspection)       */}
        {/* ================================================================== */}
        {activeTab === "single" && (
          <div className="space-y-6">
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-2xs space-y-4">
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
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleInspect()}
                  disabled={isInspecting || !targetUrl.trim()}
                  className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs shrink-0"
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
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs shrink-0"
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

              {/* Saved Form Templates */}
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
              <div className="lg:col-span-6 bg-card border border-border/80 rounded-2xl p-5 shadow-2xs space-y-4">
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

                {showAddFieldForm && (
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <div className="text-xs font-bold text-foreground">Add New Payload Field</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Field key (e.g. linkedin, city)"
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

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {Object.keys(formData).length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                      No fields configured. Inspect a form to auto-detect fields.
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
                        {key === "message" || key === "pitch" || key.includes("question") ? (
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
              <div className="lg:col-span-6 bg-card border border-border/80 rounded-2xl p-5 shadow-2xs space-y-4">
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
        {/* TAB 3: INBUILT LIVE BROWSER & HUMAN TAKEOVER                       */}
        {/* ================================================================== */}
        {activeTab === "live" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border/80 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Inbuilt Chromium Screencast & Human Takeover Console
                  </h3>
                  <Badge
                    variant={
                      runnerStatus?.isHumanInterventionNeeded
                        ? "destructive"
                        : runnerStatus?.isRunning
                        ? "success"
                        : "secondary"
                    }
                  >
                    {runnerStatus?.isHumanInterventionNeeded
                      ? "⚠️ Verify Human Required"
                      : runnerStatus?.isRunning
                      ? "Active Stream"
                      : "Standby"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Watch autonomous browser interactions in real-time, solve anti-bot puzzles or Cloudflare challenges, and control live execution.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {runnerStatus?.isRunning ? (
                  <>
                    {runnerStatus.isPaused ? (
                      <button
                        onClick={async () => {
                          await fetch("/api/automation/resume", { method: "POST" });
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume</span>
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await fetch("/api/automation/pause", { method: "POST" });
                        }}
                        className="px-3.5 py-1.5 rounded-xl border border-amber-500 text-amber-600 hover:bg-amber-500/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Pause</span>
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        await fetch("/api/automation/stop", { method: "POST" });
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Execution</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setActiveTab("single")}
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch New Automation</span>
                  </button>
                )}
              </div>
            </div>

            <LiveBrowserScreen
              initialStatus={runnerStatus}
              className="w-full shadow-md"
            />
          </div>
        )}

        {/* ================================================================== */}
        {/* MODAL: BULK PASTE FORM URLS                                        */}
        {/* ================================================================== */}
        {showBulkUrlModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Bulk Paste Form Links
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkUrlModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  title="Close modal"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground text-[11px]">
                  Paste multiple links (one per line, comma-separated, or mixed text). The system will automatically extract all valid web URLs.
                </p>
                <textarea
                  value={bulkUrlInputText}
                  onChange={(e) => setBulkUrlInputText(e.target.value)}
                  rows={7}
                  placeholder="https://example.com/form1&#10;https://example.com/form2&#10;https://mowli.in/&#10;https://forms.google.com/..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs font-mono text-foreground outline-none focus:border-primary resize-y"
                />
                <div className="text-[11px] font-mono text-muted-foreground flex justify-between">
                  <span>
                    Detected:{" "}
                    {(bulkUrlInputText.match(/https?:\/\/[^\s"'<>]+/g) || []).length} valid links
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowBulkUrlModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAddUrls}
                  disabled={!bulkUrlInputText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  Add Links to Table
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* MODAL: ADD / EDIT PERSON PROFILE                                   */}
        {/* ================================================================== */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {editingProfileIndex !== null ? "Edit Attendee Profile" : "Add Attendee Profile"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  title="Close modal"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-foreground">Full Name *</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="e.g. Alex Morgan"
                    className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground">Email Address *</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={profileForm.phone || ""}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-foreground">Company / Organization</label>
                    <input
                      type="text"
                      value={profileForm.company || ""}
                      onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                      placeholder="e.g. Stripe, OpenAI"
                      className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-foreground">Role / Title</label>
                    <input
                      type="text"
                      value={profileForm.role || ""}
                      onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                      placeholder="e.g. Founder, Engineer"
                      className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-foreground">Custom Message / Bio / Pitch</label>
                  <textarea
                    value={profileForm.message || ""}
                    onChange={(e) => setProfileForm({ ...profileForm, message: e.target.value })}
                    rows={2}
                    placeholder="Custom response text to submit in feedback or question fields..."
                    className="w-full mt-1 bg-background border border-border rounded-xl p-2.5 text-foreground outline-none focus:border-primary resize-none text-xs"
                  />
                </div>

                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div>
                    <label className="font-semibold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-primary" />
                        Luma Session Key (Cloud & Render Auth)
                      </span>
                      {profileForm.lumaSessionKey && (
                        <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={profileForm.lumaSessionKey || ""}
                      onChange={(e) => setProfileForm({ ...profileForm, lumaSessionKey: e.target.value })}
                      placeholder="usr-Kq5EPNNY9... (from luma.auth-session-key cookie)"
                      className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Bypasses Cloudflare Turnstile blocks automatically during headless cloud and Render runs.
                    </p>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground">Residential Proxy URL (Optional)</label>
                    <input
                      type="text"
                      value={profileForm.proxyUrl || ""}
                      onChange={(e) => setProfileForm({ ...profileForm, proxyUrl: e.target.value })}
                      placeholder="http://user:pass@ip:port"
                      className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncProfileToDatabase}
                    onChange={(e) => setSyncProfileToDatabase(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="text-muted-foreground text-[11px]">
                    Persist to Team Roster Database (available across all sessions)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={!profileForm.name.trim() || !profileForm.email.trim()}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {editingProfileIndex !== null ? "Update Profile" : "Save Profile"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* MODAL: EDIT TARGET URL                                             */}
        {/* ================================================================== */}
        {editingUrlIndex !== null && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
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
                <label className="font-semibold text-foreground">Target URL</label>
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
                  className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditUrl}
                  disabled={!editingUrlValue.trim()}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-2xs"
                >
                  Update Target URL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* MODAL: SAVE FORM TEMPLATE                                          */}
        {/* ================================================================== */}
        {showSaveTemplateModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
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
                <label className="font-semibold text-foreground">Template Name</label>
                <input
                  type="text"
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  placeholder="e.g. Mowli Contact Form"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!templateNameInput.trim()}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-2xs"
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
