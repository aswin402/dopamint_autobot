"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Zap,
  Users,
  FileSpreadsheet,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Globe,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  User as UserIcon,
  Tv,
  FileText,
  Layers,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";

export type NavTab =
  | "chat"
  | "form"
  | "live"
  | "admin_events"
  | "dashboard"
  | "automations"
  | "form_runner"
  | "team"
  | "sheets";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  honoStatus: "online" | "offline" | "checking";
  activeJobRunning: boolean;
  onNewTask?: () => void;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  runnerStatus?: {
    isRunning: boolean;
    isPaused: boolean;
    isHeadless?: boolean;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  honoStatus,
  activeJobRunning,
  onNewTask,
  isVisualMode = false,
  onToggleVisualMode,
  runnerStatus,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isAdmin = user?.role === "admin";

  // Role-based Navigation Items
  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = useMemo(() => {
    if (isAdmin) {
      return [
        {
          id: "admin_events",
          label: "Event Registry",
          icon: <Layers className="w-4.5 h-4.5 flex-shrink-0" />,
        },
        {
          id: "live",
          label: "Live Monitor",
          icon: <Tv className="w-4.5 h-4.5 flex-shrink-0" />,
          badge: activeJobRunning ? "LIVE" : undefined,
        },
        {
          id: "chat",
          label: "AI Copilot",
          icon: <MessageSquare className="w-4.5 h-4.5 flex-shrink-0" />,
        },
        {
          id: "form",
          label: "User Form Preview",
          icon: <FileText className="w-4.5 h-4.5 flex-shrink-0" />,
        },
      ];
    }

    // STRICTLY 3 PAGES FOR USER
    return [
      {
        id: "chat",
        label: "AI Assistant",
        icon: <MessageSquare className="w-4.5 h-4.5 flex-shrink-0" />,
      },
      {
        id: "form",
        label: "Register & Events",
        icon: <FileText className="w-4.5 h-4.5 flex-shrink-0" />,
      },
      {
        id: "live",
        label: "Live Monitor",
        icon: <Tv className="w-4.5 h-4.5 flex-shrink-0" />,
        badge: activeJobRunning ? "LIVE" : undefined,
      },
    ];
  }, [isAdmin, activeJobRunning]);

  return (
    <aside
      className={`h-screen bg-card border-r border-border flex flex-col justify-between p-3 transition-all duration-300 ease-in-out flex-shrink-0 z-30 select-none ${
        isCollapsed ? "w-[72px]" : "w-[248px]"
      }`}
    >
      {/* Top Brand & Navigation */}
      <div className="space-y-3.5">
        {/* Brand Header */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              onClick={() => setActiveTab(isAdmin ? "admin_events" : "form")}
              className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer shadow-2xs relative"
              title={isAdmin ? "dopamint - Admin Event Registry" : "dopamint - Register & Events"}
            >
              <Sparkles className="w-5 h-5 text-primary" />
              {activeJobRunning && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
            <div
              onClick={() => setActiveTab(isAdmin ? "admin_events" : "form")}
              className="flex items-center gap-2.5 cursor-pointer overflow-hidden group"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 group-hover:bg-primary/20 transition-all shadow-2xs relative">
                <Sparkles className="w-5 h-5 text-primary" />
                {activeJobRunning && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-foreground">
                    dopamint
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                      isAdmin
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-primary/20 text-primary border border-primary/30"
                    }`}
                  >
                    {isAdmin ? "ADMIN" : "USER"}
                  </span>
                  {runnerStatus?.isRunning ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse uppercase">
                      {runnerStatus.isPaused ? "Paused" : runnerStatus.isHeadless === false ? "Live" : "Active"}
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase">
                      Online
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Automation Agent
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* New Action CTA */}
        {!isCollapsed ? (
          <button
            onClick={onNewTask || (() => setActiveTab("chat"))}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Task / Prompt</span>
          </button>
        ) : (
          <button
            onClick={onNewTask || (() => setActiveTab("chat"))}
            className="w-full flex items-center justify-center p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            title="New Task / Prompt"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center py-2 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-accent text-primary font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                } ${isCollapsed ? "justify-center" : "justify-between"}`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {!isCollapsed && item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Watch Live, User Account & Theme */}
      <div className="space-y-2.5 pt-2.5 border-t border-border">
        {/* Watch Live Visual Browser Toggle */}
        {onToggleVisualMode && (
          <div>
            {!isCollapsed ? (
              <button
                type="button"
                onClick={onToggleVisualMode}
                className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                  isVisualMode
                    ? "bg-amber-500/10 border-amber-500/30 text-foreground shadow-2xs"
                    : "bg-card border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={
                  isVisualMode
                    ? "Visual Browser ON: Chromium window opens on your screen"
                    : "Visual Browser OFF: Runs silently in background"
                }
              >
                <div className="flex items-center gap-2.5">
                  {isVisualMode ? (
                    <Eye className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-foreground text-xs leading-tight">
                      Watch Live
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {isVisualMode ? "Window visible" : "Stealth mode"}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    isVisualMode
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isVisualMode ? "ON" : "OFF"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleVisualMode}
                className={`w-full flex items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                  isVisualMode
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-500 shadow-2xs"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title={
                  isVisualMode
                    ? "Visual Browser ON: Chromium visible"
                    : "Visual Browser OFF: Headless background"
                }
              >
                {isVisualMode ? (
                  <Eye className="w-4 h-4 text-amber-500 animate-pulse" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        )}

        {/* User Account Row */}
        {isAuthenticated && user ? (
          <div>
            {!isCollapsed ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/80 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {user.name ? user.name.slice(0, 1).toUpperCase() : "U"}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground truncate max-w-[125px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[125px]">
                      {user.email}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer flex-shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logout()}
                className="w-full flex items-center justify-center p-2 rounded-xl bg-muted/40 border border-border/80 text-primary hover:text-rose-500 hover:border-rose-500/30 transition-colors cursor-pointer"
                title={`${user.name} (${user.email}) - Click to Sign Out`}
              >
                <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center font-bold text-xs">
                  {user.name ? user.name.slice(0, 1).toUpperCase() : "U"}
                </div>
              </button>
            )}
          </div>
        ) : (
          <div>
            {!isCollapsed ? (
              <button
                type="button"
                onClick={openAuthModal}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="w-full flex items-center justify-center p-2 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-all cursor-pointer shadow-2xs"
                title="Sign In / Register"
              >
                <LogIn className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Theme Switcher & Engine Status */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={`w-full flex items-center p-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
          title="Toggle Theme"
        >
          <div className="flex items-center gap-2.5">
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 flex-shrink-0" />
            )}
            {!isCollapsed && (
              <span>{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  honoStatus === "online" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
                title={`Engine ${honoStatus}`}
              />
              <span className="text-[10px] text-muted-foreground capitalize">
                {theme}
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
