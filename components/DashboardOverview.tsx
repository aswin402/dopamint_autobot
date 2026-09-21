"use client";

import React from "react";
import {
  Zap,
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardOverviewProps {
  metrics: {
    totalEvents: number;
    totalAttendees: number;
    totalConfirmed: number;
    totalWaitlisted: number;
    completionRate: number;
  };
  attendees: any[];
  events: any[];
  recentRegistrations: any[];
  onNavigateTab: (tab: "automations" | "chat" | "team" | "sheets") => void;
  onSelectAttendee: (id: string) => void;
  selectedAttendeeId: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  metrics,
  attendees,
  events,
  recentRegistrations,
  onNavigateTab,
  onSelectAttendee,
  selectedAttendeeId,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Hero Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl relative overflow-hidden shadow-2xs">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <Badge variant="olive" className="text-[11px]">
              Autonomous Agent Platform
            </Badge>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              AaaS Operations
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Form Automation & Event Operations
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground max-w-xl leading-relaxed">
            Delegate multi-platform form submissions, monitor autonomous registration batches, and
            interact with your dedicated AI Agent Co-Pilot.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Button
            onClick={() => onNavigateTab("automations")}
            className="rounded-2xl gap-2 font-semibold shadow-xs"
          >
            <Zap className="w-4 h-4" />
            <span>Launch Batch</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigateTab("chat")}
            className="rounded-2xl gap-2 border-border"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Ask AI</span>
          </Button>
        </div>
      </div>

      {/* 4 Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <Card className="rounded-3xl border-border bg-card shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Discovered Events
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.totalEvents}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>Across all integrated platforms & URLs</span>
            </p>
          </CardContent>
        </Card>

        {/* Confirmed Registrations */}
        <Card className="rounded-3xl border-border bg-card shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Confirmed Tickets
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground flex items-baseline gap-2">
              <span>{metrics.totalConfirmed}</span>
              <span className="text-xs font-medium text-emerald-600">
                Confirmed
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Direct instant registrations
            </p>
          </CardContent>
        </Card>

        {/* Waitlist / Approvals */}
        <Card className="rounded-3xl border-border bg-card shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Waitlists & Pending
            </CardTitle>
            <Clock className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground flex items-baseline gap-2">
              <span>{metrics.totalWaitlisted}</span>
              <span className="text-xs font-medium text-amber-600">
                Waitlisted
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Approval forms submitted
            </p>
          </CardContent>
        </Card>

        {/* Active Team Attendees */}
        <Card className="rounded-3xl border-border bg-card shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Team Roster
            </CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.totalAttendees}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Profiles ready with credentials
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Roster Quick Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground tracking-tight">
            Team Members
          </h3>
          <button
            onClick={() => onNavigateTab("team")}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Manage All ({attendees.length})</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {attendees.map((attendee) => {
            const isSelected = selectedAttendeeId === attendee.id;
            return (
              <button
                key={attendee.id}
                onClick={() => onSelectAttendee(attendee.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent border-primary/50 ring-2 ring-primary/20 shadow-2xs"
                    : "bg-card border-border hover:bg-muted/50"
                }`}
              >
                <div className="font-semibold text-xs text-foreground truncate">
                  {attendee.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {attendee.role || attendee.company}
                </div>
                <div className="text-[10px] text-muted-foreground/80 truncate mt-1">
                  {attendee.email}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity & Registrations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground tracking-tight">
            Recent Registration Outcomes
          </h3>
          <button
            onClick={() => onNavigateTab("automations")}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>View Full Automation Deck</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xs">
          {recentRegistrations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No recent registrations recorded yet. Select an event in Automations to begin.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentRegistrations.slice(0, 5).map((reg) => (
                <div
                  key={reg.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate max-w-lg">
                      {reg.eventTitle || `Event #${reg.eventId}`}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>{reg.attendeeName}</span>
                      <span>•</span>
                      <span>{new Date(reg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        reg.status === "confirmed_success"
                          ? "success"
                          : reg.status === "waitlist_joined"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[11px]"
                    >
                      {reg.status === "confirmed_success"
                        ? "Confirmed"
                        : reg.status === "waitlist_joined"
                        ? "Waitlist"
                        : reg.status === "in_progress"
                        ? "In Progress"
                        : reg.status === "failed"
                        ? "Failed"
                        : reg.status || "Queued"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
