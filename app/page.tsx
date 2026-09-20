"use client";

import React, { useState, useEffect } from "react";
import { Sidebar, NavTab } from "@/components/Sidebar";
import Header from "@/components/Header";
import { DashboardOverview } from "@/components/DashboardOverview";
import AutomationDeck from "@/components/AutomationDeck";
import { ChatGPTView } from "@/components/ChatGPTView";
import { TeamRoster } from "@/components/TeamRoster";
import { SheetsSyncView } from "@/components/SheetsSyncView";

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [activeDeckTab, setActiveDeckTab] = useState<"matrix" | "logs" | "nonsubmitted">("matrix");

  const [attendees, setAttendees] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>("");

  const [metrics, setMetrics] = useState({
    totalEvents: 148,
    totalAttendees: 6,
    totalConfirmed: 688,
    totalWaitlisted: 42,
    completionRate: 99,
  });

  const [runnerStatus, setRunnerStatus] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    isHeadless?: boolean;
    recentLogs: any[];
  }>({
    isRunning: false,
    isPaused: false,
    isHeadless: true,
    recentLogs: [],
  });

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

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return "Dashboard Overview";
      case "automations":
        return "Form Automation Deck";
      case "chat":
        return "AI Assistant & Co-Pilot";
      case "team":
        return "Team Roster";
      case "sheets":
        return "Google Sheets Sync";
      default:
        return "Dopamint AutoBot";
    }
  };

  return (
    <div className="flex h-screen w-screen max-w-[100vw] bg-background text-foreground overflow-hidden antialiased font-sans transition-colors duration-200">
      {/* 1. Left Minimalist Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        honoStatus={honoStatus}
        activeJobRunning={runnerStatus.isRunning}
        onNewTask={() => {
          setActiveTab("chat");
        }}
      />

      {/* 2. Main Workspace Canvas */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-background relative overflow-hidden">
        {/* Top Header */}
        <Header
          activeTitle={getActiveTabTitle()}
          subtitle="Dopamint Autonomous Form Engine • MiniMax M2.5 Grounded"
          selectedAttendeeName={selectedAttendee?.name}
          runnerStatus={runnerStatus}
          isVisualMode={isVisualMode}
          onToggleVisualMode={toggleVisualMode}
          onSyncSheets={handleSyncSheets}
          isSyncingSheets={isSyncingSheets}
        />

        {/* Dynamic Center Canvas */}
        <main className="flex-1 flex flex-col h-[calc(100vh-4rem)] min-w-0 overflow-hidden relative">
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
            />
          )}

          {activeTab === "chat" && (
            <ChatGPTView
              onTriggerAutomation={handleStartAutomation}
              attendees={attendees}
              events={events}
              refreshData={fetchEventsData}
            />
          )}

          {activeTab === "team" && (
            <TeamRoster
              attendees={attendees}
              refreshData={fetchEventsData}
              selectedAttendeeId={selectedAttendeeId}
              onSelectAttendee={(id) => setSelectedAttendeeId(id)}
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
    </div>
  );
}
