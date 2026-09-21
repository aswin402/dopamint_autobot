"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { EASE_OUT, SPRING_PRESS, SPRING_SWAP, SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ApprovalStatus =
  | "pending"
  | "submitting"
  | "approved"
  | "rejected"
  | "changes-requested";

export interface ApprovalOption {
  id: string;
  label: string;
  description?: string;
}

export interface AgentApprovalCardProps {
  title?: string;
  description?: string;
  challengeType?: "turnstile" | "captcha" | "pre-submit" | "custom";
  previewUrl?: string;
  previewData?: Record<string, any>;
  options?: ApprovalOption[];
  status?: ApprovalStatus;
  onApprove: (data?: any) => void | Promise<void>;
  onReject: () => void;
  onRequestChanges?: (feedback: string) => void;
  className?: string;
}

/**
 * AgentApprovalCard (inspired by beui.dev/components/agents/approval-card)
 * A human-in-the-loop decision surface for Cloudflare Turnstile verification,
 * CAPTCHA checkpoints, and pre-submission confirmation.
 */
export function AgentApprovalCard({
  title = "Human Intervention Required",
  description = "A bot-detection or verification challenge requires user confirmation before proceeding.",
  challengeType = "turnstile",
  previewUrl,
  previewData,
  options = [],
  status: initialStatus = "pending",
  onApprove,
  onReject,
  onRequestChanges,
  className,
}: AgentApprovalCardProps) {
  const reduce = useReducedMotion() ?? false;
  const [status, setStatus] = useState<ApprovalStatus>(initialStatus);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(options[0]?.id || "");
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  const handleApproveClick = async () => {
    setStatus("submitting");
    try {
      await onApprove({
        selectedOption: selectedOptionId,
        feedback: feedbackText,
      });
      setStatus("approved");
    } catch {
      setStatus("pending");
    }
  };

  const handleRejectClick = () => {
    setStatus("rejected");
    onReject();
  };

  const isInteractive =
    status === "pending" ||
    status === "changes-requested" ||
    status === "submitting";

  return (
    <div
      data-slot="agent-approval-card"
      className={cn(
        "rounded-2xl border p-4 bg-gradient-to-b from-card to-card/90 backdrop-blur-md shadow-sm text-xs transition-all",
        status === "approved"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : status === "rejected"
          ? "border-rose-500/30 bg-rose-500/5"
          : challengeType === "turnstile" || challengeType === "captcha"
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border/80",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon Badge */}
        <div
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
            status === "approved"
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : status === "rejected"
              ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
              : challengeType === "turnstile"
              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-primary/10 text-primary"
          )}
        >
          {status === "approved" ? (
            <ShieldCheck className="w-4 h-4" />
          ) : status === "rejected" ? (
            <X className="w-4 h-4" />
          ) : status === "submitting" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : challengeType === "turnstile" ? (
            <Lock className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {title}
            </h4>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0",
                status === "approved"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : status === "rejected"
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                  : status === "submitting"
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              )}
            >
              {status === "submitting"
                ? "Submitting..."
                : status === "approved"
                ? "Verified"
                : status === "rejected"
                ? "Rejected"
                : "Action Needed"}
            </span>
          </div>

          <p className="text-muted-foreground leading-relaxed">{description}</p>

          {/* Form preview data summary */}
          {previewData && Object.keys(previewData).length > 0 && (
            <div className="mt-2 p-2.5 rounded-xl bg-muted/60 border border-border/70 text-[11px] space-y-1">
              <span className="font-semibold text-foreground block text-[10px] uppercase tracking-wider text-muted-foreground">
                Target Payload:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                {Object.entries(previewData).map(([key, val]) => (
                  <div key={key} className="truncate">
                    <span className="font-medium text-foreground">{key}: </span>
                    <span>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Radio / Option Selection */}
          {options.length > 0 && isInteractive && (
            <div className="mt-2 space-y-1.5">
              {options.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={cn(
                    "flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none",
                    selectedOptionId === opt.id
                      ? "border-primary/50 bg-primary/10 text-foreground font-semibold"
                      : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                      selectedOptionId === opt.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {selectedOptionId === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs block leading-tight">{opt.label}</span>
                    {opt.description && (
                      <span className="text-[10px] text-muted-foreground block">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Modification Input */}
          <AnimatePresence>
            {showFeedbackInput && isInteractive && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING_LAYOUT}
                className="pt-2"
              >
                <input
                  type="text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Enter instruction or modified payload fields..."
                  className="w-full px-3 py-1.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons Bar */}
          {isInteractive && (
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleApproveClick}
                disabled={status === "submitting"}
                className="h-8 px-3.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Continue</span>
                  </>
                )}
              </Button>

              {onRequestChanges && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                  className="h-8 px-3 rounded-xl text-xs gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 text-muted-foreground" />
                  <span>{showFeedbackInput ? "Hide Details" : "Edit / Change"}</span>
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={handleRejectClick}
                className="h-8 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Cancel / Skip</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
