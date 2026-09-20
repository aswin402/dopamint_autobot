"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  X,
  Bot,
  User,
  Sparkles,
  ArrowUp,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  CornerDownLeft,
  Play,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  showActionButton?: boolean;
}

interface ChatGPTViewProps {
  onTriggerAutomation?: (eventIds?: number[]) => void;
  attendees: any[];
  events: any[];
  refreshData: () => void;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  selectedAttendeeName?: string;
}

const PROMPT_SUGGESTIONS = [
  {
    title: "Live Batch Registration",
    desc: "Register Aswin Vishal for upcoming side events and watch live",
    prompt: "Start batch registration for Aswin Vishal across the upcoming open events in visual browser mode.",
  },
  {
    title: "Pipeline Status",
    desc: "Check registration confirmations & pending waitlists",
    prompt: "Provide a complete breakdown of registered events vs waitlisted events.",
  },
  {
    title: "Anti-Bot & Form Audit",
    desc: "Identify events requiring Web3 wallets or Turnstile verification",
    prompt: "Which events have custom questions or require external wallet verification?",
  },
  {
    title: "File Ingestion",
    desc: "Import attendee roster from .csv, .docx, .xlsx, or .md",
    prompt: "How can I upload a new team member roster spreadsheet to sync automatically?",
  },
];

export const ChatGPTView: React.FC<ChatGPTViewProps> = ({
  onTriggerAutomation,
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [input]);

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

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setIsStreaming(true);

    try {
      // Stream or call backend chat API (Hono :4000)
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

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.triggered) {
        refreshData();
      }

      const isRegistrationIntent = /register|batch|automate|start|fill|run/i.test(text);

      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.response || "I have received your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        showActionButton: !data.triggered && isRegistrationIntent,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Failed to get AI response: ${err.message || "Network error"}. Please ensure the Hono backend is running on port 4000.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const newAtt: Attachment = {
      id: `att-${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    };

    setAttachments((prev) => [...prev, newAtt]);

    // Also automatically ingest to backend if spreadsheet or doc
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full max-w-4xl mx-auto px-4 relative">
      {/* Messages Scroll Area or Welcome Hero */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          /* Welcome Hero (ChatGPT style) */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto px-4 py-8 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                How can Dopamint assist your event operations?
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Ask about real-time registration status, trigger autonomous batches,
                or upload spreadsheets to sync team credentials.
              </p>
            </div>

            {/* Quick Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-4 text-left">
              {PROMPT_SUGGESTIONS.map((item, idx) => (
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
                className={`flex flex-col max-w-[85%] ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Attachments preview */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs text-foreground font-medium"
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
                            className="rounded-xl text-xs gap-1.5 h-8 bg-card border-border"
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

                  {msg.role === "assistant" && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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

        {/* Streaming / Thinking indicator */}
        {isStreaming && (
          <div className="flex gap-3 text-sm items-center">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-card border border-border rounded-tl-sm flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span>MiniMax is reasoning...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Upload Banner feedback */}
      {uploadFeedback && (
        <div className="p-2.5 mb-2 rounded-xl bg-muted border border-border text-xs text-foreground flex items-center justify-between">
          <span>{uploadFeedback}</span>
          <button
            onClick={() => setUploadFeedback(null)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Bottom Input Area (ChatGPT Style) */}
      <div className="pb-6 pt-2">
        <div className="relative bg-card rounded-[22px] border border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-sm">
          {/* Selected Attachments Bar */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3 border-b border-border/50 pb-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-xs text-foreground"
                >
                  <Paperclip className="w-3 h-3 text-primary" />
                  <span className="truncate max-w-[140px] font-medium">
                    {att.name}
                  </span>
                  <button
                    onClick={() =>
                      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                    }
                    className="p-0.5 hover:text-destructive rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea & Controls */}
          <div className="flex items-end px-3 py-2 gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              accept=".csv,.xlsx,.docx,.md,.txt"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 mb-0.5"
              title="Attach document (.csv, .xlsx, .docx, .md)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or enter instructions for Dopamint..."
              className="flex-1 bg-transparent resize-none border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/70 py-2 min-h-[40px] max-h-[160px] leading-relaxed"
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={(!input.trim() && attachments.length === 0) || isStreaming}
              className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 mb-1 hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Send prompt"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/70 mt-2">
          Dopamint AI Co-Pilot is grounded in real-time attendee data, forms, and SQLite state.
        </p>
      </div>
    </div>
  );
};
