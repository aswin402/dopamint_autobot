"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface CenterMorphModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

const CENTER_FOLDED_CLIP = "inset(48% 48% 48% 48% round 28px)";
const CENTER_OPEN_CLIP = "inset(0% 0% 0% 0% round 28px)";

const CENTER_UNFOLD_EASE = [0.2, 0, 0.2, 1] as const;
const CENTER_UNFOLD_TRANSITION = {
  duration: 0.38,
  ease: CENTER_UNFOLD_EASE,
} as const;

/**
 * CenterMorphModal (inspired by beui.dev/components/motion/center-morph-modal)
 * Composable modal whose full-size surface unfolds directly outward from its exact center,
 * then folds back with an inset close control.
 */
export function CenterMorphModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  maxWidth = "max-w-2xl",
}: CenterMorphModalProps) {
  const reduce = useReducedMotion() ?? false;
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key and scroll locking
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.25, ease: EASE_OUT }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-md cursor-pointer"
          />

          {/* Morph Container */}
          <div className="fixed inset-4 z-[101] pointer-events-none flex items-center justify-center overflow-y-auto">
            <div className="flex w-full flex-col items-center py-6">
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                tabIndex={-1}
                initial={
                  reduce
                    ? { opacity: 0, scale: 0.95 }
                    : { opacity: 1, clipPath: CENTER_FOLDED_CLIP }
                }
                animate={
                  reduce
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 1, clipPath: CENTER_OPEN_CLIP }
                }
                exit={
                  reduce
                    ? { opacity: 0, scale: 0.95 }
                    : { opacity: 1, clipPath: CENTER_FOLDED_CLIP }
                }
                transition={
                  reduce
                    ? { duration: 0.15, ease: EASE_OUT }
                    : CENTER_UNFOLD_TRANSITION
                }
                className={cn(
                  "pointer-events-auto relative w-full origin-center overflow-hidden rounded-[28px] border border-border bg-card text-card-foreground shadow-2xl will-change-[clip-path]",
                  maxWidth,
                  className
                )}
              >
                {/* Header */}
                {(title || description) ? (
                  <div className="px-6 pt-5 pb-3 border-b border-border/60 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      {title && (
                        <h3 id={titleId} className="text-base font-bold text-foreground">
                          {title}
                        </h3>
                      )}
                      {description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      aria-label="Close modal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Body Content */}
                <div className="p-6 max-h-[75vh] overflow-y-auto sleek-scrollbar">
                  {children}
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
