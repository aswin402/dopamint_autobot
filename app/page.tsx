"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import AutomationDeck from "@/components/AutomationDeck";

export default function Home() {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalEvents: 148,
    totalAttendees: 6,
    totalConfirmed: 688,
    completionRate: 99,
  });
  const [runnerStatus, setRunnerStatus] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    recentLogs: any[];
  }>({
    isRunning: false,
    isPaused: false,
    recentLogs: [],
  });
  const [activeTab, setActiveTab] = useState<"matrix" | "logs" | "nonsubmitted" | "team">("matrix");
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  // Fetch initial data
  const fetchEventsData = async () => {
    setIsLoadingEvents(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
        setAttendees(data.attendees || []);
        if (data.metrics) setMetrics(data.metrics);
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
      const data = await res.json();
      setRunnerStatus(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchEventsData();
    fetchRunnerStatus();
    const interval = setInterval(fetchRunnerStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartAutomation = async () => {
    try {
      await fetch("/api/automation/start", { method: "POST" });
      fetchRunnerStatus();
      setActiveTab("logs");
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
      if (data.success) {
        alert("🎉 Google Sheets synchronized successfully!");
      } else {
        alert(`Sync error: ${data.error || "Unknown"}`);
      }
    } catch (e: any) {
      alert(`Sync error: ${e.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <Header
        metrics={metrics}
        runnerStatus={runnerStatus}
        onSyncSheets={handleSyncSheets}
        isSyncingSheets={isSyncingSheets}
      />

      {/* Main Workspace Split Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Conversational Chat & File Ingestion (38%) */}
        <div className="w-full md:w-[38%] h-[50vh] md:h-full shrink-0">
          <ChatPanel
            onStartAutomation={handleStartAutomation}
            onSyncSheets={handleSyncSheets}
            onSelectTab={setActiveTab}
          />
        </div>

        {/* Right Side: Automation Control Deck & Real-Time Matrix (62%) */}
        <div className="flex-1 h-[50vh] md:h-full overflow-hidden">
          <AutomationDeck
            attendees={attendees}
            events={events}
            metrics={metrics}
            runnerStatus={runnerStatus}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onStartAutomation={handleStartAutomation}
            onPauseAutomation={handlePauseAutomation}
            onResumeAutomation={handleResumeAutomation}
            onStopAutomation={handleStopAutomation}
            onRefreshEvents={fetchEventsData}
            isLoadingEvents={isLoadingEvents}
          />
        </div>
      </main>
    </div>
  );
}
