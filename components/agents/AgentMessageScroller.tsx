"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowDown, Radio } from "lucide-react";
import { EASE_OUT, SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface AgentMessageScrollerProps {
  children: ReactNode;
  followOutput?: boolean;
  followThreshold?: number;
  smooth?: boolean;
  onFollowChange?: (following: boolean) => void;
  className?: string;
  viewportClassName?: string;
  isStreaming?: boolean;
}

/**
 * AgentMessageScroller (inspired by beui.dev/components/agents/message-scroller)
 * A reader-aware conversation viewport that follows streamed output at the live edge
 * and gracefully releases control when the reader scrolls away to inspect history/diagnostics.
 */
export function AgentMessageScroller({
  children,
  followOutput = true,
  followThreshold = 64,
  smooth = true,
  onFollowChange,
  className,
  viewportClassName,
  isStreaming = false,
}: AgentMessageScrollerProps) {
  const reduce = useReducedMotion() ?? false;
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const programmaticScrollRef = useRef(false);
  const lastScrollHeightRef = useRef(0);

  const setFollowing = useCallback(
    (following: boolean) => {
      setIsAtBottom(following);
      if (following) {
        setHasUnread(false);
      }
      onFollowChange?.(following);
    },
    [onFollowChange]
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      programmaticScrollRef.current = true;
      const targetTop = viewport.scrollHeight - viewport.clientHeight;

      if (typeof viewport.scrollTo === "function") {
        viewport.scrollTo({
          top: targetTop,
          behavior: reduce ? "auto" : behavior,
        });
      } else {
        viewport.scrollTop = targetTop;
      }

      setFollowing(true);

      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 350);
    },
    [reduce, setFollowing]
  );

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || programmaticScrollRef.current) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    const nearBottom = distanceFromBottom <= followThreshold;
    if (nearBottom !== isAtBottom) {
      setFollowing(nearBottom);
    }
  }, [followThreshold, isAtBottom, setFollowing]);

  // Handle new content while streaming or appending
  useEffect(() => {
    const content = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      const scrollHeight = viewport.scrollHeight;
      const hasGrown = scrollHeight > lastScrollHeightRef.current;
      lastScrollHeightRef.current = scrollHeight;

      if (isAtBottom && followOutput) {
        scrollToBottom(smooth ? "smooth" : "auto");
      } else if (!isAtBottom && hasGrown) {
        setHasUnread(true);
      }
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [followOutput, isAtBottom, scrollToBottom, smooth]);

  // Initial layout scroll
  useLayoutEffect(() => {
    if (followOutput) {
      scrollToBottom("auto");
    }
  }, [followOutput, scrollToBottom]);

  return (
    <div
      data-slot="agent-message-scroller"
      className={cn("relative flex flex-col flex-1 min-h-0 w-full overflow-hidden", className)}
    >
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain sleek-scrollbar outline-none",
          viewportClassName
        )}
      >
        <div ref={contentRef} role="log" aria-live="polite" className="pb-4">
          {children}
        </div>
      </div>

      {/* Floating Scroll-to-bottom indicator pill */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={SPRING_SWAP}
            className="absolute bottom-3 right-6 z-30 pointer-events-auto"
          >
            <motion.button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              whileTap={reduce ? undefined : { scale: 0.94 }}
              transition={SPRING_PRESS}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md border transition-colors cursor-pointer",
                hasUnread || isStreaming
                  ? "bg-primary text-primary-foreground border-primary/40 shadow-primary/20"
                  : "bg-background/90 text-foreground border-border hover:bg-muted"
              )}
            >
              {hasUnread || isStreaming ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground" />
                </span>
              ) : (
                <ArrowDown className="w-3.5 h-3.5" />
              )}
              <span>{hasUnread ? "New live activity" : "Resume stream"}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
