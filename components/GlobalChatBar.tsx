"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  User,
  Send,
  X,
  ChevronUp,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Square,
  Wrench,
  Search,
  Activity,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowUp,
  RefreshCw,
  Clock,
  ChevronRight,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AgentTaskList,
  AgentTaskStep,
  AgentApprovalCard,
} from "@/components/agents";
import { playNotificationChime } from "@/lib/notifications";
import { NavTab } from "./Sidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actionTaken?: string;
  diagnostic?: {
    error?: string;
    rootCause?: string;
    fixApplied?: string;
    retrying?: boolean;
  };
  showApproval?: boolean;
  approvalData?: any;
}

interface GlobalChatBarProps {
  activeTab: NavTab;
  onNavigateTab: (tab: NavTab) => void;
  runnerStatus?: {
    isRunning: boolean;
    isPaused: boolean;
    isHeadless?: boolean;
    progress?: {
      completed: number;
      total: number;
      percent: number;
      successCount: number;
      failedCount: number;
    };
  };
  attendees: any[];
  events: any[];
  onTriggerAutomation?: (eventIds?: number[]) => void;
  onPauseAutomation?: () => void;
  onResumeAutomation?: () => void;
  onStopAutomation?: () => void;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  refreshData?: () => void;
}

export const GlobalChatBar: React.FC<GlobalChatBarProps> = ({
  activeTab,
  onNavigateTab,
  runnerStatus,
  attendees,
  events,
  onTriggerAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  isVisualMode = false,
  onToggleVisualMode,
  refreshData,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 **Hello! I am your Autonomous Form & Workflow AI Agent.**\n\nI can run registrations, inspect form DOM schemas, auto-fill profiles, evade anti-bot checks, and monitor tasks across the site. What would you like me to do?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [activeTaskSteps, setActiveTaskSteps] = useState<AgentTaskStep[]>([
    {
      id: "step-1",
      title: "Agent Standby & Health Check",
      description: "Connected to autonomous browser automation engine.",
      status: "completed",
    },
    {
      id: "step-2",
      title: "DOM Schema & Anti-Bot Inspection",
      description: "Extracting selectors and bot-mitigation rules.",
      status: "pending",
    },
    {
      id: "step-3",
      title: "Payload & Team Roster Matching",
      description: "Mapping fields to candidate profiles.",
      status: "pending",
    },
    {
      id: "step-4",
      title: "Browser Execution & Verification",
      description: "Simulating human interaction and confirming success.",
      status: "pending",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Global keyboard shortcut: ⌘J or Ctrl+J to toggle assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setIsMinimized(false);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Update task list based on live runner progress
  useEffect(() => {
    if (runnerStatus?.isRunning) {
      const completed = runnerStatus.progress?.completed || 0;
      const total = runnerStatus.progress?.total || 1;
      setActiveTaskSteps([
        {
          id: "step-1",
          title: "Engine Initialization",
          description: isVisualMode ? "Chromium Screencast Active" : "Stealth Headless Mode",
          status: "completed",
        },
        {
          id: "step-2",
          title: "Browser Pacing & Anti-Bot Shield",
          description: "Simulating bezier curves and jitter delays.",
          status: "completed",
        },
        {
          id: "step-3",
          title: `Executing Automation (${completed}/${total})`,
          description: `${runnerStatus.progress?.successCount || 0} confirmed, ${runnerStatus.progress?.failedCount || 0} failed`,
          status: "in-progress",
        },
        {
          id: "step-4",
          title: "Verification & Database Sync",
          description: "Syncing confirmation receipts and sheets.",
          status: "pending",
        },
      ]);
    }
  }, [runnerStatus?.isRunning, runnerStatus?.progress?.completed, isVisualMode]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setIsOpen(true);
    setIsMinimized(false);

    // Update active task progression
    setActiveTaskSteps((prev) =>
      prev.map((step, idx) =>
        idx === 0
          ? { ...step, status: "completed" }
          : idx === 1
          ? { ...step, status: "in-progress" }
          : { ...step, status: "pending" }
      )
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isVisualMode,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const data = await res.json();
      playNotificationChime();

      if (data.triggered && refreshData) {
        refreshData();
      }

      const isBatchIntent = /batch|matrix|register|start all/i.test(text);

      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.response || "Task processed successfully.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actionTaken: data.actionTaken,
        diagnostic: data.diagnostic,
        showApproval: isBatchIntent && !data.triggered,
        approvalData: {
          title: "Batch Automation Approval",
          description: `Ready to dispatch ${attendees.length} attendee profiles across ${events.length} target forms with anti-bot evasion.`,
          previewUrl: events[0]?.url,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);

      setActiveTaskSteps((prev) =>
        prev.map((step) => ({ ...step, status: "completed" }))
      );
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Agent connection issue: ${err.message || "Failed to contact backend"}. Please verify server status.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const quickActionPrompts = [
    {
      label: "⚡ System Health",
      prompt: "Check system health and verify Hono backend, database, and browser engine status.",
    },
    {
      label: "🚀 Run Matrix",
      prompt: "Start autonomous matrix registration for all attendees across saved target forms.",
    },
    {
      label: "🔍 Inspect Form",
      prompt: "Inspect the latest target form link, analyze DOM fields, and check for Cloudflare bot shields.",
    },
    {
      label: "👥 Auto-Fill Roster",
      prompt: "Review team roster profiles and match payload fields for upcoming event registrations.",
    },
    {
      label: "🛠️ Self-Heal & Retry",
      prompt: "Diagnose recent failed automation attempts, analyze root causes, and re-run with anti-bot adjustments.",
    },
  ];

  // If user is on the dedicated full chat screen, do not show the bottom bar to avoid duplication
  if (activeTab === "chat") {
    return null;
  }

  return (
    <>
      {/* ==================================================================== */}
      {/* 1. DOCKED / FLOATING QUICK CHATBAR                                   */}
      {/* ==================================================================== */}
      {!isMinimized ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl p-2 sm:p-2.5 transition-all">
            {/* Input Row */}
            <div className="flex items-center gap-2">
              {/* Agent Status Pill */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 transition-all cursor-pointer shrink-0"
                title="Open AI Assistant Drawer (⌘J)"
              >
                <div className="relative">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                      runnerStatus?.isRunning
                        ? "bg-amber-500 animate-pulse"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>
                <span className="text-[11px] font-bold tracking-tight hidden sm:inline">
                  {runnerStatus?.isRunning ? "Running..." : "AI Agent"}
                </span>
              </button>

              {/* Input Field */}
              <div className="relative flex-1 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask agent, run automation, or fix errors... (⌘J)"
                  className="w-full bg-background border border-border rounded-xl pl-3 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all font-sans"
                />
                <kbd className="hidden md:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/60 border border-border rounded">
                  ↵
                </kbd>
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                className="w-8 h-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-all shadow-xs shrink-0"
                title="Send command"
                aria-label="Send"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Expand to Flyout Drawer Button */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="Expand Assistant Panel (⌘J)"
                aria-label="Expand"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              {/* Close / Minimize Cross Button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="Minimize chatbar"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Chips Row */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto custom-scrollbar pt-0.5 pb-0.5 px-0.5">
              {quickActionPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q.prompt)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-all whitespace-nowrap cursor-pointer shrink-0"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Minimized Floating Pill */
        <button
          type="button"
          onClick={() => {
            setIsMinimized(false);
            setIsOpen(true);
          }}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-xl hover:border-primary/50 text-foreground transition-all cursor-pointer group"
          title="Open AI Agent Assistant (⌘J)"
        >
          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="text-xs font-bold text-foreground">AI Agent</span>
          <Badge variant="secondary" className="font-mono text-[9px] px-1 py-0">
            ⌘J
          </Badge>
        </button>
      )}

      {/* ==================================================================== */}
      {/* 2. INTERACTIVE SLIDE-OVER ASSISTANT DRAWER                           */}
      {/* ==================================================================== */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop (Click outside to close) */}
          <div
            className="fixed inset-0 bg-background/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-full sm:w-[480px] lg:w-[540px] h-full bg-card border-l border-border shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Dopamint AI Agent</h3>
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                      {runnerStatus?.isRunning ? "Live Executing" : "Autonomous"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Real-time execution, self-healing & browser control
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1">
                {/* Fullscreen Chat Studio */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateTab("chat");
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Open Fullscreen AI Studio"
                  aria-label="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* Normal Cross Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Close assistant (Esc)"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Task Execution Map */}
            <div className="p-3 bg-muted/20 border-b border-border/80">
              <AgentTaskList
                title="Real-Time Execution Plan"
                steps={activeTaskSteps}
                isCollapsible={true}
                defaultOpen={true}
              />
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                        isUser
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-muted text-primary border border-border"
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-tr-xs"
                          : "bg-muted/40 border border-border/70 text-foreground rounded-tl-xs shadow-2xs"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Approval Card if triggered */}
                      {msg.showApproval && (
                        <div className="mt-3">
                          <AgentApprovalCard
                            title="Confirm Batch Execution"
                            description={msg.approvalData?.description}
                            previewUrl={msg.approvalData?.previewUrl}
                            challengeType="pre-submit"
                            onApprove={async () => {
                              if (onTriggerAutomation) {
                                onTriggerAutomation();
                              }
                            }}
                            onReject={() => {
                              setMessages((prev) => [
                                ...prev,
                                {
                                  id: `reject-${Date.now()}`,
                                  role: "assistant",
                                  content: "Execution cancelled by user request.",
                                  timestamp: new Date().toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }),
                                },
                              ]);
                            }}
                          />
                        </div>
                      )}

                      {/* Diagnostic Error Banner if present */}
                      {msg.diagnostic?.error && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Diagnostic Detection</span>
                          </div>
                          <div>{msg.diagnostic.error}</div>
                          {msg.diagnostic.fixApplied && (
                            <div className="text-muted-foreground font-mono text-[10px]">
                              Applied Fix: {msg.diagnostic.fixApplied}
                            </div>
                          )}
                        </div>
                      )}

                      <div
                        className={`text-[9px] mt-1.5 text-right font-mono opacity-70 ${
                          isUser ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span>Agent is analyzing DOM, checking anti-bot shields, and preparing response...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Drawer Input Composer */}
            <div className="p-3 border-t border-border bg-card space-y-2 shrink-0">
              {/* Quick Actions in Drawer */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                {quickActionPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(q.prompt)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 transition-all whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Composer Box */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Give instructions to AI agent..."
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming}
                  className="px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                <span>Autonomous Browser & Form Agent</span>
                <span>ESC to close • ⌘J to toggle</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
