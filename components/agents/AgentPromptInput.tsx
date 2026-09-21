"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  Square,
  Paperclip,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Command,
  Layers,
  ChevronDown,
  Play,
  Wrench,
  Search,
  Activity,
} from "lucide-react";
import { EASE_OUT, SPRING_PRESS, SPRING_SWAP, SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export interface AgentPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  attachments?: AttachmentItem[];
  onRemoveAttachment?: (id: string) => void;
  onAttachFiles?: (files: FileList | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onQuickAction?: (actionPrompt: string) => void;
  hasFailure?: boolean;
}

/**
 * AgentPromptInput (inspired by beui.dev/components/agents/prompt-input & transitions.dev)
 * An auto-growing agent composer with browser mode pills, animated send/stop states,
 * attachment chips tray, and rapid action triggers.
 */
export function AgentPromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading = false,
  isVisualMode = false,
  onToggleVisualMode,
  attachments = [],
  onRemoveAttachment,
  onAttachFiles,
  placeholder = "Ask Dopamint Agent or paste form link to automate...",
  disabled = false,
  className,
  onQuickAction,
  hasFailure = false,
}: AgentPromptInputProps) {
  const reduce = useReducedMotion() ?? false;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea to fit content up to 180px
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 42), 180);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (isLoading) {
      onStop?.();
      return;
    }
    const trimmed = value.trim();
    if (!trimmed && attachments.length === 0) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = (Boolean(value.trim()) || attachments.length > 0) && !disabled;

  return (
    <div
      data-slot="agent-prompt-input"
      className={cn("w-full space-y-2 select-none", className)}
    >
      {/* Quick Action Pills above the input bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sleek-scrollbar">
        <motion.button
          type="button"
          whileTap={reduce ? undefined : { scale: 0.95 }}
          onClick={() => onQuickAction?.("What's happening with the automation right now?")}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card hover:bg-muted border border-border/80 text-xs text-muted-foreground hover:text-foreground shrink-0 transition-all shadow-2xs cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span>Status Check</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={reduce ? undefined : { scale: 0.95 }}
          onClick={() => onQuickAction?.("Why did it fail? Fix the error and retry")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs shrink-0 transition-all shadow-2xs cursor-pointer",
            hasFailure
              ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold"
              : "bg-card hover:bg-muted border-border/80 text-muted-foreground hover:text-foreground"
          )}
        >
          <Wrench className="w-3.5 h-3.5 text-amber-500" />
          <span>Fix & Retry</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={reduce ? undefined : { scale: 0.95 }}
          onClick={() => onQuickAction?.("Inspect form fields on https://mowli.in/")}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card hover:bg-muted border border-border/80 text-xs text-muted-foreground hover:text-foreground shrink-0 transition-all shadow-2xs cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-cyan-500" />
          <span>Inspect Form</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={reduce ? undefined : { scale: 0.95 }}
          onClick={() =>
            onQuickAction?.(
              "Automate form at https://mowli.in/ with name: Alex Morgan, email: alex@company.com, phone: 555-0199, message: Hello from Dopamint Autonomous Agent in visual mode"
            )
          }
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card hover:bg-muted border border-border/80 text-xs text-muted-foreground hover:text-foreground shrink-0 transition-all shadow-2xs cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 text-emerald-500" />
          <span>Run (mowli.in)</span>
        </motion.button>
      </div>

      {/* Main Composer Box */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "relative rounded-[22px] border bg-card backdrop-blur-xl transition-all shadow-sm",
          isFocused
            ? "border-primary/50 ring-2 ring-primary/10 shadow-md"
            : "border-border/80 hover:border-border",
          disabled && "opacity-60"
        )}
      >
        {/* Attachments Tray */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_LAYOUT}
              className="flex flex-wrap gap-2 px-3.5 pt-3 pb-1 border-b border-border/50"
            >
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/80 border border-border text-xs text-foreground font-medium"
                >
                  <Paperclip className="w-3 h-3 text-primary" />
                  <span className="truncate max-w-[150px]">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment?.(att.id)}
                    className="p-0.5 hover:text-destructive rounded-full cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Input Row */}
        <div className="flex items-start px-3 py-2 gap-2">
          {/* File Upload Trigger */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => onAttachFiles?.(e.target.files)}
            className="hidden"
            accept=".csv,.xlsx,.docx,.md,.txt"
          />

          <motion.button
            type="button"
            whileTap={reduce ? undefined : { scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0 mt-0.5 cursor-pointer"
            title="Attach document (.csv, .xlsx, .docx, .md)"
          >
            <Paperclip className="w-4 h-4" />
          </motion.button>

          {/* Growing Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent resize-none border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/60 py-1.5 min-h-[40px] max-h-[180px] leading-relaxed sleek-scrollbar"
          />
        </div>

        {/* Bottom Control Bar: Mode Toggle Pill + Model Badge + Send/Stop Button */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 border-t border-border/40">
          <div className="flex items-center gap-2">
            {/* Visual Headed Browser Mode Pill */}
            {onToggleVisualMode && (
              <motion.button
                type="button"
                onClick={onToggleVisualMode}
                whileTap={reduce ? undefined : { scale: 0.94 }}
                transition={SPRING_PRESS}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                  isVisualMode
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold"
                    : "bg-muted/60 border-border/60 text-muted-foreground hover:text-foreground"
                )}
                title="Toggle between real-time desktop browser window and silent background execution"
              >
                {isVisualMode ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span>Visual Window: ON</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Stealth Headless</span>
                  </>
                )}
              </motion.button>
            )}

            {/* Agent Engine Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 text-[10px] text-muted-foreground font-mono">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Dopamint AI Engine</span>
            </div>
          </div>

          {/* Animated Send / Stop Morph Button */}
          <motion.button
            type="submit"
            disabled={isLoading ? !onStop : !canSubmit}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={SPRING_PRESS}
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs",
              isLoading
                ? "bg-rose-500 hover:bg-rose-600 text-white"
                : canSubmit
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
            )}
            title={isLoading ? "Stop generation / task" : "Send prompt (Enter)"}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {isLoading ? (
                <motion.div
                  key="stop"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  transition={SPRING_SWAP}
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </motion.div>
              ) : (
                <motion.div
                  key="send"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  transition={SPRING_SWAP}
                >
                  <ArrowUp className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </form>
    </div>
  );
}
