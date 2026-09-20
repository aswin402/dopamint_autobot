"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  FileSpreadsheet,
  FileText,
  FileCode,
  Bot,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
  timestamp: string;
}

interface ChatPanelProps {
  onStartAutomation: () => void;
  onSyncSheets: () => void;
  onSelectTab: (tab: "matrix" | "logs" | "nonsubmitted" | "team") => void;
}

export default function ChatPanel({
  onStartAutomation,
  onSyncSheets,
  onSelectTab,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `👋 **Welcome to Dopamint AutoBot!**\n\nI am your autonomous Agent-as-a-Service for web form registrations and attendee management.\n\n- 📊 **Current Matrix:** 6 team members across 148 tracked events.\n- 🏆 **Confirmed Registrations:** 688 verified submissions in the database.\n- 📎 **Multi-format Ingestion:** You can chat naturally or drop \`.xlsx\`, \`.csv\`, \`.docx\`, or \`.md\` files anytime.\n\nHow would you like to proceed?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() && attachedFiles.length === 0) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      attachments: attachedFiles.map((f) => f.name),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedFiles([]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.response,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `⚠️ Failed to communicate with AI server: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setAttachedFiles((prev) => [
          ...prev,
          { name: file.name, type: data.fileType },
        ]);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `📄 **Attachment Processed: \`${file.name}\`**\n\n- File Type: **${data.fileType.toUpperCase()}**\n- ${data.summary}\n- Imported: **${data.importedEvents} events**, **${data.importedAttendees} attendees** into database.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getFileIcon = (type: string) => {
    if (type === "spreadsheet" || type.includes("xls") || type.includes("csv"))
      return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />;
    if (type === "docx" || type.includes("doc"))
      return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    return <FileCode className="w-3.5 h-3.5 text-cyan-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80">
      {/* Panel Title Bar */}
      <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Agent Chat & Ingestion
          </span>
        </div>
        <span className="text-[11px] text-slate-400">MiniMax AI Engine</span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${
              m.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gradient-to-tr from-cyan-600 to-purple-600 text-white shadow-md shadow-cyan-500/10"
              }`}
            >
              {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-indigo-600/90 text-white rounded-tr-none shadow-sm"
                  : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm backdrop-blur-sm"
              }`}
            >
              {/* Attachments pill */}
              {m.attachments && m.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {m.attachments.map((att, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300"
                    >
                      <Paperclip className="w-3 h-3 text-cyan-400" />
                      <span>{att}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Message text formatted with basic markdown */}
              <div className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm font-normal">
                {m.content.split("\n").map((line, idx) => {
                  if (line.startsWith("- ")) {
                    return (
                      <li key={idx} className="ml-3 list-disc">
                        {line.replace("- ", "")}
                      </li>
                    );
                  }
                  return <p key={idx}>{line}</p>;
                })}
              </div>

              <div
                className={`text-[10px] mt-1.5 text-right ${
                  m.role === "user" ? "text-indigo-200" : "text-slate-500"
                }`}
              >
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 items-center text-slate-400 text-xs">
            <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Bot className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px] text-slate-400">MiniMax is reasoning...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Action Chips */}
      <div className="px-4 py-2 border-t border-slate-900 bg-slate-950/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <button
          onClick={() => handleSendMessage("Launch automation for verified events")}
          className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>🚀 Run Automation</span>
        </button>
        <button
          onClick={() => onSelectTab("nonsubmitted")}
          className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>📋 Non-Submitted Events</span>
        </button>
        <button
          onClick={onSyncSheets}
          className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-emerald-300 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>🔄 Sync Sheets</span>
        </button>
        <button
          onClick={() => onSelectTab("team")}
          className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>👥 Team Personas</span>
        </button>
      </div>

      {/* Staged Attachments Preview */}
      {attachedFiles.length > 0 && (
        <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400">Attached:</span>
          {attachedFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200"
            >
              {getFileIcon(f.type)}
              <span className="max-w-[150px] truncate">{f.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 bg-slate-900/40 border-t border-slate-800/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-cyan-500/50 transition-all shadow-inner"
        >
          {/* File Upload Trigger */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".xlsx,.xls,.csv,.docx,.md,.txt"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Attach file (.xlsx, .csv, .docx, .md)"
            className="text-slate-400 hover:text-cyan-400 transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          {/* Textarea / Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instruct AutoBot or drop .xlsx, .csv, .docx, .md..."
            className="flex-1 bg-transparent border-none text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() && attachedFiles.length === 0}
            className="w-8 h-8 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-cyan-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-2">
          Accepts spreadsheets (.xlsx, .csv), docs (.docx), agendas (.md), and live links.
        </p>
      </div>
    </div>
  );
}
