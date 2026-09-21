"use client";

import React, { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type AgentTaskStatus = "pending" | "in-progress" | "completed" | "failed";

export interface AgentTaskStep {
  id: string;
  title: string;
  description?: string;
  status: AgentTaskStatus;
  duration?: string;
  details?: ReactNode;
}

export interface AgentTaskListProps {
  title?: string;
  steps: AgentTaskStep[];
  targetUrl?: string;
  isCollapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  onStepClick?: (step: AgentTaskStep) => void;
}

/**
 * AgentTaskList (Combines beui.dev/components/agents/todo-list & @smoothui/ai-task-list)
 * Displays the agent's real-time step-by-step execution roadmap with animated progress lines,
 * morphing status badges, drawn SVG checkmarks, and collapsible execution diagnostics.
 */
export function AgentTaskList({
  title = "Autonomous Execution Plan",
  steps,
  targetUrl,
  isCollapsible = true,
  defaultOpen = true,
  className,
  onStepClick,
}: AgentTaskListProps) {
  const reduce = useReducedMotion() ?? false;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const inProgressCount = steps.filter((s) => s.status === "in-progress").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;
  const isAllComplete = steps.length > 0 && completedCount === steps.length;
  const percentComplete = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div
      data-slot="agent-task-list"
      className={cn(
        "rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md overflow-hidden shadow-sm text-xs transition-all",
        className
      )}
    >
      {/* Header Bar */}
      <div
        onClick={() => isCollapsible && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between p-3 select-none transition-colors",
          isCollapsible ? "cursor-pointer hover:bg-muted/40" : ""
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0",
              isAllComplete
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : inProgressCount > 0
                ? "bg-primary/15 text-primary"
                : failedCount > 0
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isAllComplete ? (
              <Check className="w-3.5 h-3.5" />
            ) : inProgressCount > 0 ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : failedCount > 0 ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : (
              <Layers className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground truncate">{title}</span>
              {targetUrl && (
                <span className="text-[10px] text-muted-foreground/80 truncate max-w-[140px] hidden sm:inline">
                  {targetUrl.replace(/^https?:\/\//, "")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Progress pill with animated roll */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-foreground">
            <span
              className={cn(
                "font-semibold tabular-nums",
                isAllComplete
                  ? "text-emerald-600 dark:text-emerald-400"
                  : inProgressCount > 0
                  ? "text-primary"
                  : ""
              )}
            >
              {completedCount}/{steps.length}
            </span>
            <span className="text-muted-foreground/60">({percentComplete}%)</span>
          </div>

          {isCollapsible && (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={reduce ? { duration: 0 } : SPRING_SWAP}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="w-full bg-muted/50 h-0.5 overflow-hidden">
        <motion.div
          className={cn(
            "h-full transition-all duration-300",
            isAllComplete
              ? "bg-emerald-500"
              : failedCount > 0
              ? "bg-rose-500"
              : "bg-primary"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentComplete}%` }}
          transition={{ ease: EASE_OUT, duration: 0.3 }}
        />
      </div>

      {/* Steps List Disclosure */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={SPRING_LAYOUT}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="p-3 space-y-2">
              {steps.map((step, idx) => {
                const isExpanded = expandedStepId === step.id;
                const isLast = idx === steps.length - 1;

                return (
                  <div key={step.id} className="relative">
                    {/* Vertical connector line */}
                    {!isLast && (
                      <div
                        className={cn(
                          "absolute left-3 top-6 w-0.5 -bottom-2.5 transition-colors z-0",
                          step.status === "completed"
                            ? "bg-emerald-500/30 dark:bg-emerald-500/20"
                            : "bg-border/60"
                        )}
                      />
                    )}

                    <div
                      onClick={() => {
                        onStepClick?.(step);
                        if (step.details) {
                          setExpandedStepId(isExpanded ? null : step.id);
                        }
                      }}
                      className={cn(
                        "relative z-10 flex items-start gap-2.5 p-2 rounded-xl transition-all select-none",
                        step.details ? "cursor-pointer hover:bg-muted/50" : "",
                        step.status === "in-progress" ? "bg-primary/5 border border-primary/20" : ""
                      )}
                    >
                      {/* Step Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {step.status === "completed" ? (
                          <motion.div
                            initial={reduce ? { scale: 1 } : { scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={SPRING_SWAP}
                            className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xs"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                              <motion.path
                                d="M5 13l4 4L19 7"
                                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.25, ease: EASE_OUT }}
                              />
                            </svg>
                          </motion.div>
                        ) : step.status === "in-progress" ? (
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          </div>
                        ) : step.status === "failed" ? (
                          <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-xs">
                            <XCircle className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center bg-background text-muted-foreground/60 text-[10px] font-medium">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "font-medium leading-tight",
                              step.status === "completed"
                                ? "text-muted-foreground line-through decoration-muted-foreground/40"
                                : step.status === "in-progress"
                                ? "text-foreground font-semibold"
                                : step.status === "failed"
                                ? "text-rose-600 dark:text-rose-400 font-semibold"
                                : "text-muted-foreground"
                            )}
                          >
                            {step.title}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {step.duration && (
                              <span className="text-[10px] text-muted-foreground/70 tabular-nums flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {step.duration}
                              </span>
                            )}
                            {step.details && (
                              <ChevronRight
                                className={cn(
                                  "w-3.5 h-3.5 text-muted-foreground/60 transition-transform",
                                  isExpanded ? "rotate-90 text-foreground" : ""
                                )}
                              />
                            )}
                          </div>
                        </div>

                        {step.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                            {step.description}
                          </p>
                        )}

                        {/* Collapsible Step Details */}
                        <AnimatePresence initial={false}>
                          {isExpanded && step.details && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={SPRING_LAYOUT}
                              className="mt-2 p-2.5 rounded-xl bg-background/80 border border-border/70 text-[11px] text-foreground font-mono overflow-x-auto shadow-inner"
                            >
                              {step.details}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
