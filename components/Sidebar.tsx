"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
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
  Activity,
  Plus,
  Sparkles,
  Globe,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";

export type NavTab = "dashboard" | "automations" | "form_runner" | "chat" | "team" | "sheets";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  honoStatus: "online" | "offline" | "checking";
  activeJobRunning: boolean;
  onNewTask?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  honoStatus,
  activeJobRunning,
  onNewTask,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();

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

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5 flex-shrink-0" />,
    },
    {
      id: "automations",
      label: "Automations",
      icon: <Zap className="w-5 h-5 flex-shrink-0" />,
      badge: activeJobRunning ? "LIVE" : undefined,
    },
    {
      id: "form_runner",
      label: "Form Studio",
      icon: <Globe className="w-5 h-5 flex-shrink-0" />,
    },
    {
      id: "chat",
      label: "AI Assistant",
      icon: <MessageSquare className="w-5 h-5 flex-shrink-0" />,
    },
    {
      id: "team",
      label: "Team Roster",
      icon: <Users className="w-5 h-5 flex-shrink-0" />,
    },
    {
      id: "sheets",
      label: "Sheets Sync",
      icon: <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />,
    },
  ];

  return (
    <aside
      className={`h-screen bg-card border-r border-border flex flex-col justify-between p-3 transition-all duration-300 ease-in-out flex-shrink-0 z-30 select-none ${
        isCollapsed ? "w-[72px]" : "w-[240px]"
      }`}
    >
      {/* Top Brand Header */}
      <div className="space-y-4">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer shadow-2xs"
              title="dopamint - Dashboard"
            >
              <Sparkles className="w-5 h-5 text-primary" />
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
          <div className="flex items-center justify-between px-1 py-1">
            <div
              onClick={() => setActiveTab("dashboard")}
              className="flex items-center gap-2.5 cursor-pointer overflow-hidden group"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 group-hover:bg-primary/20 transition-all shadow-2xs">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-foreground">
                  dopamint
                </span>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
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

        {/* Nav Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
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

      {/* Bottom Section: Theme Switcher */}
      <div className="pt-3 border-t border-border">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={`w-full flex items-center p-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
          title="Toggle Theme"
        >
          <div className="flex items-center gap-3">
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
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Operational" />
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
