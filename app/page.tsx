"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sidebar, NavTab } from "@/components/Sidebar";
import { DashboardOverview } from "@/components/DashboardOverview";
import AutomationDeck from "@/components/AutomationDeck";
import { ChatGPTView } from "@/components/ChatGPTView";
import { TeamRoster } from "@/components/TeamRoster";
import { SheetsSyncView } from "@/components/SheetsSyncView";
import { UniversalFormStudio } from "@/components/UniversalFormStudio";
import { GlobalChatBar } from "@/components/GlobalChatBar";
import ExportModal from "@/components/ExportModal";
import { playNotificationChime, triggerDesktopNotification } from "@/lib/notifications";
import { CheckCircle2, Bell, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [activeDeckTab, setActiveDeckTab] = useState<"matrix" | "logs" | "nonsubmitted">("matrix");

  const [attendees, setAttendees] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>("");

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDataset, setExportDataset] = useState<"matrix" | "confirmed" | "roster" | "events">("matrix");

  const openExportModal = (dataset: "matrix" | "confirmed" | "roster" | "events" = "matrix") => {
    setExportDataset(dataset);
    setIsExportModalOpen(true);
  };

  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    totalAttendees: 0,
    totalConfirmed: 0,
    totalWaitlisted: 0,
    completionRate: 0,
  });

  const [runnerStatus, setRunnerStatus] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    isHeadless?: boolean;
    currentEvent?: any;
    progress?: {
      completed: number;
      total: number;
      percent: number;
      successCount: number;
      failedCount: number;
      waitlistCount: number;
      skippedCount: number;
      remainingCount: number;
    };
    recentLogs: any[];
  }>({
    isRunning: false,
    isPaused: false,
    isHeadless: true,
    recentLogs: [],
  });

  const [completionBanner, setCompletionBanner] = useState<{
    show: boolean;
    title: string;
    message: string;
    successCount: number;
    failedCount: number;
  } | null>(null);

  const prevRunnerRunningRef = useRef(false);

  // Monitor runner completion and trigger global notification
  useEffect(() => {
    if (
      prevRunnerRunningRef.current &&
      !runnerStatus.isRunning &&
      runnerStatus.progress &&
      runnerStatus.progress.completed > 0
    ) {
      playNotificationChime();
      triggerDesktopNotification(
        "Dopamint AI Agent Notification",
        `Automation Run Complete: ${runnerStatus.progress.completed} processed (${runnerStatus.progress.successCount} confirmed success).`
      );
      setCompletionBanner({
        show: true,
        title: "Automation Completed",
        message: `Successfully processed ${runnerStatus.progress.completed} items (${runnerStatus.progress.successCount} confirmed, ${runnerStatus.progress.failedCount} errors). Verified with anti-bot evasion.`,
        successCount: runnerStatus.progress.successCount,
        failedCount: runnerStatus.progress.failedCount,
      });

      const timer = setTimeout(() => {
        setCompletionBanner(null);
      }, 9000);
      return () => clearTimeout(timer);
    }
    prevRunnerRunningRef.current = Boolean(runnerStatus.isRunning);
  }, [runnerStatus.isRunning]);

  const [isVisualMode, setIsVisualMode] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("autobot_visual_mode");
      if (saved !== null) {
        setIsVisualMode(saved === "true");
      }
    } catch {}
  }, []);

  const toggleVisualMode = () => {
    setIsVisualMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("autobot_visual_mode", String(next));
      } catch {}
      return next;
    });
  };

  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [honoStatus, setHonoStatus] = useState<"online" | "offline" | "checking">("checking");

  // Check Hono backend health
  const checkHonoHealth = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const res = await fetch(`${backendUrl}/health`, {
        cache: "no-store",
      }).catch(() => null);

      if (res && res.ok) {
        setHonoStatus("online");
      } else {
        // Test Next.js transparent proxy
        const proxyRes = await fetch("/api/automation/status", {
          cache: "no-store",
        }).catch(() => null);
        setHonoStatus(proxyRes && proxyRes.ok ? "online" : "offline");
      }
    } catch {
      setHonoStatus("offline");
    }
  };

  // Fetch initial data
  const fetchEventsData = async () => {
    setIsLoadingEvents(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
        setAttendees(data.attendees || []);
        if (data.attendees && data.attendees.length > 0 && !selectedAttendeeId) {
          setSelectedAttendeeId(data.attendees[0].id);
        }

        // Build recent registrations
        const recents: any[] = [];
        for (const ev of data.events) {
          if (ev.registrations && ev.registrations.length > 0) {
            for (const r of ev.registrations) {
              const att = data.attendees?.find((a: any) => a.id === r.attendeeId);
              recents.push({
                id: r.id || `${ev.id}-${r.attendeeId}`,
                eventId: ev.id,
                eventTitle: ev.title,
                attendeeName: att?.name || "Team Member",
                status: r.status,
                createdAt: r.createdAt || new Date().toISOString(),
              });
            }
          }
        }
        setRecentRegistrations(recents);

        // Count confirmed & waitlisted
        const confirmed = recents.filter((r) => r.status === "confirmed_success").length;
        const waitlisted = recents.filter((r) => r.status === "waitlist_joined").length;

        setMetrics({
          totalEvents: data.events.length,
          totalAttendees: (data.attendees || []).length,
          totalConfirmed: confirmed,
          totalWaitlisted: waitlisted,
          completionRate: data.events.length > 0 ? Math.round((confirmed / data.events.length) * 100) : 0,
        });
      }
    } catch (e) {
      console.error("Failed to load events data:", e);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Poll runner status
  const fetchRunnerStatus = async () => {
    try {
      const res = await fetch("/api/automation/status");
      if (res.ok) {
        const data = await res.json();
        setRunnerStatus(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchEventsData();
    fetchRunnerStatus();
    checkHonoHealth();

    const runnerInterval = setInterval(fetchRunnerStatus, 2500);
    const healthInterval = setInterval(checkHonoHealth, 10000);

    return () => {
      clearInterval(runnerInterval);
      clearInterval(healthInterval);
    };
  }, []);

  const handleStartAutomation = async (eventIds?: number[]) => {
    try {
      const payload: any = {
        headless: !isVisualMode,
      };
      if (eventIds && eventIds.length > 0) {
        payload.eventIds = eventIds;
      }
      if (selectedAttendeeId) {
        payload.attendeeIds = [selectedAttendeeId];
      }

      await fetch("/api/automation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      fetchRunnerStatus();
      setActiveTab("automations");
      setActiveDeckTab("logs");
    } catch (e) {
      alert("Failed to start automation");
    }
  };

  const handlePauseAutomation = async () => {
    try {
      await fetch("/api/automation/pause", { method: "POST" });
      fetchRunnerStatus();
    } catch (e) {}
  };

  const handleResumeAutomation = async () => {
    try {
      await fetch("/api/automation/resume", { method: "POST" });
      fetchRunnerStatus();
    } catch (e) {}
  };

  const handleStopAutomation = async () => {
    try {
      await fetch("/api/automation/stop", { method: "POST" });
      fetchRunnerStatus();
    } catch (e) {}
  };

  const handleSyncSheets = async () => {
    setIsSyncingSheets(true);
    try {
      const res = await fetch("/api/sheets/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
    } catch (e: any) {
      setSyncResult({
        success: false,
        message: e.message || "Failed to trigger sheets sync",
      });
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const selectedAttendee = attendees.find((a) => a.id === selectedAttendeeId);

  return (
    <div className="flex h-screen w-screen max-w-[100vw] bg-background text-foreground overflow-hidden antialiased font-sans transition-colors duration-200">
      {/* 1. Left Minimalist Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        honoStatus={honoStatus}
        activeJobRunning={runnerStatus.isRunning}
        isVisualMode={isVisualMode}
        onToggleVisualMode={toggleVisualMode}
        runnerStatus={runnerStatus}
        onNewTask={async () => {
          setActiveTab("chat");
          try {
            await fetch("/api/automation/sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "reset", title: "New Chat Session" }),
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("automation-session-updated"));
            }
          } catch (e) {}
        }}
      />

      {/* 2. Main Workspace Canvas (Full Height) */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-background relative overflow-hidden">
        {/* Dynamic Center Canvas */}
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          {activeTab === "dashboard" && (
            <DashboardOverview
              metrics={metrics}
              attendees={attendees}
              events={events}
              recentRegistrations={recentRegistrations}
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                if (tab === "automations") setActiveDeckTab("matrix");
              }}
              onSelectAttendee={(id) => setSelectedAttendeeId(id)}
              selectedAttendeeId={selectedAttendeeId}
            />
          )}

          {activeTab === "automations" && (
            <AutomationDeck
              attendees={attendees}
              events={events}
              metrics={metrics}
              runnerStatus={runnerStatus}
              isVisualMode={isVisualMode}
              onToggleVisualMode={toggleVisualMode}
              activeDeckTab={activeDeckTab}
              setActiveDeckTab={setActiveDeckTab}
              onStartAutomation={handleStartAutomation}
              onPauseAutomation={handlePauseAutomation}
              onResumeAutomation={handleResumeAutomation}
              onStopAutomation={handleStopAutomation}
              onRefreshEvents={fetchEventsData}
              isLoadingEvents={isLoadingEvents}
              selectedAttendeeId={selectedAttendeeId}
              onOpenExport={openExportModal}
            />
          )}

          {activeTab === "form_runner" && (
            <UniversalFormStudio
              attendees={attendees}
              events={events}
              onRefreshData={fetchEventsData}
              isVisualMode={isVisualMode}
              onToggleVisualMode={toggleVisualMode}
              onLaunchSuccess={() => {
                fetchEventsData();
              }}
            />
          )}

          {activeTab === "chat" && (
            <ChatGPTView
              onTriggerAutomation={handleStartAutomation}
              onPauseAutomation={handlePauseAutomation}
              onResumeAutomation={handleResumeAutomation}
              onStopAutomation={handleStopAutomation}
              attendees={attendees}
              events={events}
              refreshData={fetchEventsData}
              isVisualMode={isVisualMode}
              onToggleVisualMode={toggleVisualMode}
              selectedAttendeeName={selectedAttendee?.name}
            />
          )}

          {activeTab === "team" && (
            <TeamRoster
              attendees={attendees}
              refreshData={fetchEventsData}
              selectedAttendeeId={selectedAttendeeId}
              onSelectAttendee={(id) => setSelectedAttendeeId(id)}
              onOpenExport={() => openExportModal("roster")}
            />
          )}

          {activeTab === "sheets" && (
            <SheetsSyncView
              onSyncSheets={handleSyncSheets}
              isSyncing={isSyncingSheets}
              syncResult={syncResult}
            />
          )}
        </main>
      </div>

      {/* 3. Global Floating AI Assistant & Chatbar */}
      <GlobalChatBar
        activeTab={activeTab}
        onNavigateTab={setActiveTab}
        runnerStatus={runnerStatus}
        attendees={attendees}
        events={events}
        onTriggerAutomation={handleStartAutomation}
        onPauseAutomation={handlePauseAutomation}
        onResumeAutomation={handleResumeAutomation}
        onStopAutomation={handleStopAutomation}
        isVisualMode={isVisualMode}
        onToggleVisualMode={toggleVisualMode}
        refreshData={fetchEventsData}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        events={events}
        attendees={attendees}
        initialDataset={exportDataset}
      />

      {/* Floating Global Completion Notification */}
      {completionBanner && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300 p-4 rounded-2xl bg-card border border-emerald-500/40 shadow-2xl flex items-start gap-3.5 backdrop-blur-xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>{completionBanner.title}</span>
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-bold">
                  100% Done
                </Badge>
              </h4>
              <button
                type="button"
                onClick={() => setCompletionBanner(null)}
                className="text-muted-foreground hover:text-foreground text-xs p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {completionBanner.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
