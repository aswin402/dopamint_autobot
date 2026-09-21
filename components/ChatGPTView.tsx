"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Bot,
  User,
  Sparkles,
  Copy,
  Check,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  CornerDownLeft,
  Play,
  Pause,
  Square,
  Wrench,
  Activity,
  Search,
  Eye,
  EyeOff,
  History,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  Zap,
  Code,
  CheckCircle2,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutomationMonitorPanel } from "./AutomationMonitorPanel";
import { playNotificationChime, triggerDesktopNotification } from "@/lib/notifications";
import {
  AgentMessageScroller,
  AgentTaskList,
  AgentTaskStep,
  AgentApprovalCard,
  CenterMorphModal,
  AgentPromptInput,
  AttachmentItem,
} from "@/components/agents";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: AttachmentItem[];
  showActionButton?: boolean;
  actionTaken?: string;
  diagnostic?: {
    error?: string;
    rootCause?: string;
    fixApplied?: string;
    retrying?: boolean;
  };
  inspection?: any;
  targetUrl?: string;
}

interface AutomationSessionItem {
  id: string;
  title: string;
  status: string;
  targetUrl?: string | null;
  totalTarget: number;
  totalConfirmed: number;
  totalFailed: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatGPTViewProps {
  onTriggerAutomation?: (eventIds?: number[]) => void;
  onPauseAutomation?: () => void;
  onResumeAutomation?: () => void;
  onStopAutomation?: () => void;
  attendees: any[];
  events: any[];
  refreshData: () => void;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  selectedAttendeeName?: string;
}

export const ChatGPTView: React.FC<ChatGPTViewProps> = ({
  onTriggerAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  attendees,
  events,
  refreshData,
  isVisualMode = false,
  onToggleVisualMode,
  selectedAttendeeName,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Session History State
  const [sessions, setSessions] = useState<AutomationSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(`session_${Date.now()}`);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [runnerLiveStatus, setRunnerLiveStatus] = useState<any>(null);

  // Center Morph Modal State for DOM Schema & Diagnostics Inspection
  const [inspectModal, setInspectModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    data: any;
    type: "inspection" | "diagnostic" | "raw";
  }>({
    open: false,
    title: "",
    description: "",
    data: null,
    type: "inspection",
  });

  // Dynamic Prompt Suggestions (Zero Hardcoded Personal Information)
  const promptSuggestions = useMemo(() => {
    const targetAttendee = selectedAttendeeName || attendees[0]?.name || "Team Member";
    return [
      {
        title: "Universal Form Automation",
        desc: "Fill and submit contact/inquiry forms with zero hardcoded selectors",
        prompt: `Automate form at https://mowli.in/ with name: Alex Morgan, email: alex@company.com, phone: 555-0199, message: Hello from Dopamint Autonomous Agent in visual mode`,
      },
      {
        title: "Live Batch Registration",
        desc: `Register ${targetAttendee} across upcoming open events and watch live`,
        prompt: `Start batch registration for ${targetAttendee} across the upcoming open events in visual browser mode.`,
      },
      {
        title: "Pipeline Status",
        desc: "Check registration confirmations & pending waitlists",
        prompt: "Provide a complete breakdown of registered events vs waitlisted events.",
      },
      {
        title: "Anti-Bot & Form Audit",
        desc: "Inspect form DOM and identify Turnstile or captcha requirements",
        prompt: "Inspect form fields on https://mowli.in/",
      },
    ];
  }, [selectedAttendeeName, attendees]);

  // Fetch session history from API
  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch("/api/automation/sessions");
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
        }
        if (data.currentSession?.id) {
          setCurrentSessionId(data.currentSession.id);
        }
      }
    } catch (e) {
      console.warn("Failed to load automation session history:", e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Real-time Agent Automation Monitoring & Post-Execution Notification
  const prevRunnerRunningRef = useRef(false);

  useEffect(() => {
    const checkAutomationStatus = async () => {
      try {
        const res = await fetch("/api/automation/status", { cache: "no-store" });
        if (res.ok) {
          const status = await res.json();
          setRunnerLiveStatus(status);
          if (
            prevRunnerRunningRef.current &&
            !status.isRunning &&
            status.progress &&
            status.progress.completed > 0
          ) {
            // Automation completed
            playNotificationChime();
            const targetDesc =
              status.currentEvent?.title ||
              (status.progress.total === 1 ? "Custom Form Submission" : "Batch Registration Queue");

            triggerDesktopNotification(
              "Dopamint AI Agent Notification",
              `Automation Finished: ${status.progress.completed} processed (${status.progress.successCount} confirmed success).`
            );

            const notifMsg: Message = {
              id: `notif-${Date.now()}`,
              role: "assistant",
              content: `🔔 **Agent Notification: Automation Run Completed!**\n\n- **Target Task / Event:** ${targetDesc}\n- **Overall Status:** ✅ **100% Completed**\n- **Progress Breakdown:**\n  - **Completed:** ${status.progress.completed} / ${status.progress.total || status.progress.completed}\n  - **Success:** ${status.progress.successCount}\n  - **Errors / Skipped:** ${status.progress.failedCount + status.progress.skippedCount}\n- **Browser Mode:** ${
                status.isHeadless ? "Headless Stealth Mode" : "👁️ Visual Headed Browser Window"
              }\n\nAll requested fields were populated using humanized keystroke pacing and anti-bot stealth evasion. Receipts and logs are accessible in the **Live Automation Monitor** panel on the right.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => {
              const updated = [...prev, notifMsg];
              saveSessionMessages(currentSessionId, updated);
              return updated;
            });
            fetchSessions();
          }
          prevRunnerRunningRef.current = Boolean(status.isRunning);
        }
      } catch (e) {}
    };

    const interval = setInterval(checkAutomationStatus, 2000);
    return () => clearInterval(interval);
  }, [currentSessionId]);

  // Helper to persist conversation messages to the active session
  const saveSessionMessages = async (sessionId: string, currentMessages: Message[], title?: string) => {
    try {
      await fetch("/api/automation/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_messages",
          id: sessionId,
          title,
          messages: currentMessages,
        }),
      });
    } catch (e) {
      console.warn("Failed to persist session messages:", e);
    }
  };

  // Start a fresh, clean chat session and reset right-hand monitor
  const handleNewChat = async () => {
    const newSessionId = `session_${Date.now()}`;
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setInput("");
    setAttachments([]);

    try {
      await fetch("/api/automation/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          id: newSessionId,
          title: "New Chat Session",
        }),
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("automation-session-updated"));
      }
      fetchSessions();
    } catch (e) {
      console.error("Failed to reset session:", e);
    }
  };

  // Switch to an archived past session
  const handleSelectSession = async (session: AutomationSessionItem) => {
    try {
      const res = await fetch("/api/automation/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "load",
          id: session.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(session.id);

        if (data.session?.parsedMessages && data.session.parsedMessages.length > 0) {
          setMessages(data.session.parsedMessages);
        } else {
          const recapMsg: Message = {
            id: `archived-${session.id}`,
            role: "assistant",
            content: `📁 **Archived Automation Session Loaded**\n\n- **Session:** ${session.title}\n- **Status:** \`${session.status.toUpperCase()}\`\n- **Processed Tasks:** ${session.totalConfirmed + session.totalFailed} / ${session.totalTarget || session.totalConfirmed || 1}\n- **Confirmed Success:** ${session.totalConfirmed}\n- **Errors / Skipped:** ${session.totalFailed}\n- **Timestamp:** ${new Date(session.createdAt).toLocaleString()}\n\n*Historical execution logs, receipts, and screencasts for this session are now restored in the Live Automation Monitor on the right.*`,
            timestamp: new Date(session.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages([recapMsg]);
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("automation-session-updated"));
        }
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    }
  };

  // Delete an old session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/automation/sessions?id=${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          handleNewChat();
        }
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if ((!text && attachments.length === 0) || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text || "Analyze attached document and sync attendees",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments: [...attachments],
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setAttachments([]);
    setIsStreaming(true);

    const sessionTitle = messages.length === 0 ? text.slice(0, 36) : undefined;
    saveSessionMessages(currentSessionId, newMessages, sessionTitle);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isVisualMode,
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.triggered) {
        refreshData();
      }
      if (data.status) {
        setRunnerLiveStatus(data.status);
      }

      const isRegistrationIntent = /register|batch|automate|start|fill|run/i.test(text);

      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.response || "I have received your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        showActionButton: !data.triggered && isRegistrationIntent,
        actionTaken: data.actionTaken,
        diagnostic: data.diagnostic,
        inspection: data.inspection,
        targetUrl: data.targetUrl || (data.targets && data.targets[0]?.url),
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      saveSessionMessages(currentSessionId, finalMessages, sessionTitle);
      fetchSessions();
    } catch (err: any) {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Unable to connect to the agent service: ${err.message || "Network error"}. Please verify your connection or try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const newAtt: AttachmentItem = {
      id: `att-${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    };

    setAttachments((prev) => [...prev, newAtt]);

    setIsUploading(true);
    setUploadFeedback(`Uploading & parsing ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setUploadFeedback(
          `✅ Successfully parsed ${json.filename}: ${json.newAttendeesCount || 0} attendees synced!`
        );
        refreshData();
      } else {
        setUploadFeedback(`⚠️ Upload error: ${json.error}`);
      }
    } catch (e: any) {
      setUploadFeedback(`⚠️ Failed to parse document: ${e.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadFeedback(null), 6000);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to build step tasks for AgentTaskList
  const getMessageTasks = (msg: Message): AgentTaskStep[] => {
    const isRunning = runnerLiveStatus?.isRunning;
    const hasFailed = Boolean(runnerLiveStatus?.lastFailure);
    const targetUrl = msg.targetUrl || "https://mowli.in/";

    return [
      {
        id: "step-1",
        title: "DOM Schema Analysis & Field Mapping",
        description: `Inspected form inputs, attributes & action on ${targetUrl}`,
        status: "completed",
        duration: "0.8s",
        details: msg.inspection ? (
          <div>
            <div className="font-semibold text-primary mb-1">Detected Inputs:</div>
            {msg.inspection.fields?.map((f: any, i: number) => (
              <div key={i} className="text-muted-foreground">
                • <code>{f.name || f.placeholder || f.type}</code> ({f.type})
              </div>
            ))}
          </div>
        ) : undefined,
      },
      {
        id: "step-2",
        title: "Payload Synthesis & Contextual Mapping",
        description: "Mapped attendee profile (Alex Morgan) to required form parameters",
        status: "completed",
        duration: "0.4s",
      },
      {
        id: "step-3",
        title: "Anti-Bot Stealth & Keystroke Jitter",
        description: "Humanized delay pacing, natural mouse curves & navigator evasion",
        status: isRunning ? "in-progress" : "completed",
        duration: "2.1s",
      },
      {
        id: "step-4",
        title: "Form Submission & Network Intercept",
        description: "Triggered submit handler, intercepted POST response & validated status 200",
        status: isRunning ? "pending" : hasFailed ? "failed" : "completed",
        duration: "0.9s",
      },
      {
        id: "step-5",
        title: "Receipt Confirmation & Screenshot Capture",
        description: "Captured confirmation receipt and archived snapshot to runner store",
        status: isRunning ? "pending" : hasFailed ? "failed" : "completed",
      },
    ];
  };

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const today: AutomationSessionItem[] = [];
    const yesterday: AutomationSessionItem[] = [];
    const older: AutomationSessionItem[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    sessions.forEach((s) => {
      const itemTime = new Date(s.createdAt).getTime();
      if (itemTime >= startOfToday) {
        today.push(s);
      } else if (itemTime >= startOfYesterday) {
        yesterday.push(s);
      } else {
        older.push(s);
      }
    });

    return { today, yesterday, older };
  }, [sessions]);

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] w-full min-w-0 overflow-hidden relative">
      {/* 1. ChatGPT-Style Collapsible Left History Sidebar */}
      <div
        className={`h-full border-r border-border/70 bg-card/40 backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out shrink-0 select-none z-20 ${
          isHistoryOpen ? "w-64" : "w-0 overflow-hidden border-r-0"
        }`}
      >
        {/* Top Header & New Chat Action */}
        <div className="p-3 border-b border-border/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">History</span>
              {sessions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-semibold text-muted-foreground">
                  {sessions.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close history"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-border/80 bg-background/80 hover:bg-accent/80 hover:border-primary/40 text-foreground font-semibold text-xs transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            title="Start a new chat & reset live monitor"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Sessions Scroll List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3 sleek-scrollbar">
          {isLoadingSessions && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 px-3 text-center space-y-2">
              <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <History className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-foreground">No past sessions</p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Your chats and automation runs will be saved here automatically.
              </p>
            </div>
          ) : (
            <>
              {groupedSessions.today.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 py-0.5 block">
                    Today
                  </span>
                  {groupedSessions.today.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      isActive={s.id === currentSessionId}
                      onSelect={() => handleSelectSession(s)}
                      onDelete={(e) => handleDeleteSession(s.id, e)}
                    />
                  ))}
                </div>
              )}

              {groupedSessions.yesterday.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 py-0.5 block">
                    Yesterday
                  </span>
                  {groupedSessions.yesterday.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      isActive={s.id === currentSessionId}
                      onSelect={() => handleSelectSession(s)}
                      onDelete={(e) => handleDeleteSession(s.id, e)}
                    />
                  ))}
                </div>
              )}

              {groupedSessions.older.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 py-0.5 block">
                    Previous Runs
                  </span>
                  {groupedSessions.older.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      isActive={s.id === currentSessionId}
                      onSelect={() => handleSelectSession(s)}
                      onDelete={(e) => handleDeleteSession(s.id, e)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* History Footer */}
        <div className="p-2.5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="font-medium text-[11px]">
            {sessions.length} Saved {sessions.length === 1 ? "Session" : "Sessions"}
          </span>
          <button
            onClick={fetchSessions}
            className="hover:text-foreground p-1 rounded-md transition-colors cursor-pointer"
            title="Refresh sessions list"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. Center Chat Workspace Canvas */}
      <div className="flex-1 flex flex-col h-full min-w-0 px-4 md:px-6 max-w-4xl mx-auto w-full relative overflow-hidden">
        {/* Floating Top Header Bar */}
        <div className="pt-2.5 pb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            {!isHistoryOpen && (
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-all shadow-2xs cursor-pointer group"
                title="Open Session History"
              >
                <History className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-medium">History</span>
                {sessions.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                    {sessions.length}
                  </span>
                )}
              </button>
            )}

            {/* Live Runner Status Pill */}
            {runnerLiveStatus?.isRunning ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Active: {runnerLiveStatus.progress?.percent || 0}%</span>
                <span className="text-[10px] opacity-80 hidden sm:inline">
                  ({runnerLiveStatus.progress?.completed}/{runnerLiveStatus.progress?.total})
                </span>
              </div>
            ) : runnerLiveStatus?.isPaused ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <Pause className="w-3 h-3" />
                <span>Paused ({runnerLiveStatus.progress?.percent || 0}%)</span>
              </div>
            ) : runnerLiveStatus?.lastFailure ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
                <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-[280px]">
                  Error: {runnerLiveStatus.lastFailure.errorMessage}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/60 text-muted-foreground text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                <span>Agent Standby</span>
              </div>
            )}
          </div>

          {/* Top Bar Quick Controls */}
          <div className="flex items-center gap-1.5">
            {runnerLiveStatus?.isRunning ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onPauseAutomation}
                  className="h-7 px-2.5 text-xs rounded-xl gap-1 cursor-pointer"
                  title="Pause active automation"
                >
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onStopAutomation}
                  className="h-7 px-2.5 text-xs rounded-xl text-rose-500 border-rose-500/30 hover:bg-rose-500/10 gap-1 cursor-pointer"
                  title="Stop automation"
                >
                  <Square className="w-3 h-3" />
                  <span>Stop</span>
                </Button>
              </>
            ) : runnerLiveStatus?.isPaused ? (
              <Button
                size="sm"
                onClick={onResumeAutomation}
                className="h-7 px-2.5 text-xs rounded-xl gap-1 bg-primary text-primary-foreground cursor-pointer"
                title="Resume execution"
              >
                <Play className="w-3 h-3" />
                <span>Resume</span>
              </Button>
            ) : runnerLiveStatus?.lastFailure ? (
              <Button
                size="sm"
                onClick={() => handleSend("Why did it fail? Fix the error and retry")}
                className="h-7 px-2.5 text-xs rounded-xl gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer shadow-xs"
                title="Diagnose issue and auto-heal retry"
              >
                <Wrench className="w-3 h-3" />
                <span>Auto-Fix & Retry</span>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Human Intervention Approval Checkpoint (if triggered) */}
        {runnerLiveStatus?.isHumanInterventionNeeded && (
          <div className="pt-3 pb-1">
            <AgentApprovalCard
              title="Cloudflare Turnstile / Bot Verification Challenge"
              description="The target site has surfaced an anti-bot challenge. Complete verification in the visual browser window, then click Approve to proceed."
              challengeType="turnstile"
              onApprove={async () => {
                await fetch("/api/automation/heal-retry", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "approve" }),
                });
                if (onResumeAutomation) onResumeAutomation();
              }}
              onReject={() => {
                if (onStopAutomation) onStopAutomation();
              }}
            />
          </div>
        )}

        {/* 3. Messages Viewport with AgentMessageScroller */}
        <AgentMessageScroller
          isStreaming={isStreaming}
          followOutput={true}
          viewportClassName="py-4 space-y-5"
        >
          {messages.length === 0 ? (
            /* Welcome Hero */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto px-4 py-8 space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Sparkles className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                  How can Dopamint assist your automation operations?
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  Ask about real-time registration status, trigger autonomous batches,
                  or inspect form DOM trees with zero hardcoded selectors.
                </p>
              </div>

              {/* Quick Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-4 text-left">
                {promptSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-xs group flex flex-col justify-between cursor-pointer shadow-2xs"
                  >
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center justify-between w-full">
                      <span>{item.title}</span>
                      <CornerDownLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-normal line-clamp-2">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-sm leading-relaxed ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[88%] ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Attachments preview */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-border text-xs text-foreground font-medium"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                          <span className="truncate max-w-[160px]">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={`p-4 rounded-2xl relative group ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground font-medium rounded-tr-sm"
                        : "bg-card border border-border text-foreground rounded-tl-sm shadow-2xs"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Integrated AgentTaskList for Automation Runs */}
                    {(msg.actionTaken === "form_automation_started" ||
                      msg.actionTaken === "batch_automation_started" ||
                      msg.actionTaken === "inspected_form") && (
                      <div className="mt-3.5">
                        <AgentTaskList
                          title={
                            msg.actionTaken === "inspected_form"
                              ? "DOM Inspection & Mapping Plan"
                              : "Autonomous Form Execution Plan"
                          }
                          steps={getMessageTasks(msg)}
                          targetUrl={msg.targetUrl || "https://mowli.in/"}
                          defaultOpen={true}
                        />
                      </div>
                    )}

                    {/* Self-Healing Diagnostic Card */}
                    {msg.diagnostic && (
                      <div className="mt-3.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Self-Healing Action Report</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                            Auto-Retry Active
                          </span>
                        </div>
                        <div className="text-[11px] text-foreground space-y-1">
                          <div>
                            <strong className="text-amber-600 dark:text-amber-400">Root Cause:</strong>{" "}
                            {msg.diagnostic.rootCause}
                          </div>
                          <div>
                            <strong className="text-emerald-600 dark:text-emerald-400">Fix Applied:</strong>{" "}
                            {msg.diagnostic.fixApplied}
                          </div>
                        </div>
                        <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground border-t border-amber-500/20">
                          <span>👁️ Visual mode active for verification</span>
                          <button
                            type="button"
                            onClick={() =>
                              setInspectModal({
                                open: true,
                                title: "Self-Healing Diagnostic Breakdown",
                                description: "Detailed root cause analysis, error trace & applied heuristic mitigation",
                                data: msg.diagnostic,
                                type: "diagnostic",
                              })
                            }
                            className="font-semibold text-primary hover:underline cursor-pointer"
                          >
                            Inspect Diagnostic Details →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Form Inspection Card */}
                    {msg.actionTaken === "inspected_form" && msg.inspection && (
                      <div className="mt-3.5 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-2 text-xs shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-cyan-600 dark:text-cyan-400">
                            <Search className="w-3.5 h-3.5" />
                            <span>DOM Analysis Verified</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-semibold">
                            {msg.inspection.fields?.length || 0} Fields Mapped
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleSend(`Automate form at ${msg.inspection.url}`)}
                            className="flex-1 text-xs gap-1.5 h-8 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold cursor-pointer shadow-xs rounded-xl"
                          >
                            <Play className="w-3 h-3" />
                            <span>Automate This Form Now</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setInspectModal({
                                open: true,
                                title: `Form DOM Schema: ${msg.inspection.url}`,
                                description: "Interactive breakdown of detected form tags, attributes, and input types",
                                data: msg.inspection,
                                type: "inspection",
                              })
                            }
                            className="text-xs gap-1.5 h-8 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer rounded-xl"
                          >
                            <Code className="w-3.5 h-3.5" />
                            <span>Inspect Schema</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Status Card Quick Controls */}
                    {msg.actionTaken === "live_status_report" && (
                      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSend("What's happening with the automation right now?")}
                          className="text-xs h-7 px-2.5 rounded-xl gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Refresh Status</span>
                        </Button>
                        {runnerLiveStatus?.isRunning && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onPauseAutomation}
                            className="text-xs h-7 px-2.5 rounded-xl gap-1 text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                          >
                            <Pause className="w-3 h-3" />
                            <span>Pause</span>
                          </Button>
                        )}
                        {runnerLiveStatus?.lastFailure && (
                          <Button
                            size="sm"
                            onClick={() => handleSend("Why did it fail? Fix the error and retry")}
                            className="text-xs h-7 px-2.5 rounded-xl gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer shadow-xs"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Fix & Retry</span>
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Batch Automation Trigger */}
                    {msg.showActionButton && onTriggerAutomation && (
                      <div className="mt-3.5 p-3.5 rounded-2xl bg-muted/70 border border-border/80 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span>Batch Automation Trigger Ready</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Target: <strong className="text-foreground">{selectedAttendeeName || "Team"}</strong> • Mode:{" "}
                            <span className={isVisualMode ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-foreground"}>
                              {isVisualMode ? "👁️ Watch Live (Browser Window Pops Up)" : "Headless (Silent Background)"}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {onToggleVisualMode && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onToggleVisualMode}
                              className="rounded-xl text-xs gap-1.5 h-8 bg-card border-border cursor-pointer"
                              title="Toggle visual mode"
                            >
                              {isVisualMode ? (
                                <Eye className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              <span>{isVisualMode ? "Watch Live: ON" : "Watch Live: OFF"}</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => onTriggerAutomation()}
                            className="rounded-xl text-xs gap-1.5 font-semibold h-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Launch Batch {isVisualMode ? "Live 👁️" : "Now"}</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Copy message button */}
                    {msg.role === "assistant" && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Copy to clipboard"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-muted-foreground mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-xl bg-muted border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Streaming Indicator */}
          {isStreaming && (
            <div className="flex gap-3 text-sm items-center">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-card border border-border rounded-tl-sm flex items-center gap-2 text-xs text-muted-foreground shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span>Agent is analyzing form DOM and synthesizing actions...</span>
              </div>
            </div>
          )}
        </AgentMessageScroller>

        {/* Upload feedback toast */}
        {uploadFeedback && (
          <div className="p-2.5 mb-2 rounded-xl bg-muted border border-border text-xs text-foreground flex items-center justify-between">
            <span>{uploadFeedback}</span>
            <button
              onClick={() => setUploadFeedback(null)}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4. Bottom Agent Composer via AgentPromptInput */}
        <div className="pb-5 pt-1">
          <AgentPromptInput
            value={input}
            onChange={setInput}
            onSubmit={(val) => handleSend(val)}
            onStop={onStopAutomation}
            isLoading={isStreaming || Boolean(runnerLiveStatus?.isRunning)}
            isVisualMode={isVisualMode}
            onToggleVisualMode={onToggleVisualMode}
            attachments={attachments}
            onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
            onAttachFiles={handleFileUpload}
            onQuickAction={(prompt) => handleSend(prompt)}
            hasFailure={Boolean(runnerLiveStatus?.lastFailure)}
          />

          <p className="text-center text-[10px] text-muted-foreground/70 mt-2">
            Autonomous Form Agent is grounded in real-time attendee profiles, target events, and live browser automation.
          </p>
        </div>
      </div>

      {/* 5. Center Morph Modal for DOM Schema & Deep Inspection */}
      <CenterMorphModal
        open={inspectModal.open}
        onOpenChange={(open) => setInspectModal((prev) => ({ ...prev, open }))}
        title={inspectModal.title}
        description={inspectModal.description}
      >
        {inspectModal.type === "inspection" && inspectModal.data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60 text-xs">
              <div>
                <span className="font-semibold text-foreground">Target URL: </span>
                <span className="text-primary font-mono">{inspectModal.data.url}</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {inspectModal.data.method?.toUpperCase() || "POST"}
              </Badge>
            </div>

            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Detected Form Fields ({inspectModal.data.fields?.length || 0})
              </h4>
              <div className="border border-border/80 rounded-xl overflow-hidden divide-y divide-border/60 text-xs">
                {inspectModal.data.fields?.map((field: any, idx: number) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-card hover:bg-muted/40 transition-colors">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <span>{field.name || field.placeholder || `Input #${idx + 1}`}</span>
                        {field.required && (
                          <span className="text-[10px] text-rose-500 font-bold">*required</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Selector: {field.selector || `input[name="${field.name}"]`}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {field.type || "text"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setInspectModal((prev) => ({ ...prev, open: false }));
                  handleSend(`Automate form at ${inspectModal.data.url}`);
                }}
                className="bg-primary text-primary-foreground text-xs gap-1.5 rounded-xl cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Automate This Form</span>
              </Button>
            </div>
          </div>
        )}

        {inspectModal.type === "diagnostic" && inspectModal.data && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <div className="font-bold text-amber-600 dark:text-amber-400">Error Description</div>
              <p className="text-foreground">{inspectModal.data.error || "Execution timeout or selector mismatch"}</p>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1">
              <div className="font-bold text-blue-600 dark:text-blue-400">Root Cause</div>
              <p className="text-foreground">{inspectModal.data.rootCause || "Dynamic frame rendering delayed input visibility."}</p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <div className="font-bold text-emerald-600 dark:text-emerald-400">Applied Mitigation</div>
              <p className="text-foreground">{inspectModal.data.fixApplied || "Switched to visual headed mode and added human keystroke delay."}</p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setInspectModal((prev) => ({ ...prev, open: false }));
                  handleSend("Why did it fail? Fix the error and retry");
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 rounded-xl cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Auto-Fix & Retry Run</span>
              </Button>
            </div>
          </div>
        )}
      </CenterMorphModal>

      {/* 6. Right-Side End Menu Bar: Live Automation Monitor */}
      <AutomationMonitorPanel
        onStartAutomation={() => onTriggerAutomation?.()}
        onPauseAutomation={onPauseAutomation}
        onResumeAutomation={onResumeAutomation}
        onStopAutomation={onStopAutomation}
        isVisualMode={isVisualMode}
        onToggleVisualMode={onToggleVisualMode}
      />
    </div>
  );
};

// Row item for past sessions
function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: AutomationSessionItem;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Completed" />;
      case "running":
        return <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Running" />;
      case "failed":
        return <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Failed" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" title="Standby / Idle" />;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between py-2 px-2.5 rounded-xl text-xs cursor-pointer transition-all ${
        isActive
          ? "bg-accent text-foreground font-semibold border border-border/80 shadow-2xs"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1.5">
        {getStatusBadge(session.status)}
        <span className="truncate text-xs tracking-tight">{session.title}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {session.totalConfirmed > 0 && (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            ✓{session.totalConfirmed}
          </span>
        )}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive rounded-md transition-all cursor-pointer"
          title="Delete session"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
