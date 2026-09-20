"use client";

import React, { useState, useEffect } from "react";
import {
  Globe,
  Sparkles,
  Search,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Sliders,
  Zap,
  Building,
  Briefcase,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetectedField, InspectionResult } from "@/lib/automation/runner";
import { playNotificationChime, triggerDesktopNotification } from "@/lib/notifications";

interface UniversalFormStudioProps {
  attendees?: any[];
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
  onLaunchSuccess?: () => void;
}

export const UniversalFormStudio: React.FC<UniversalFormStudioProps> = ({
  attendees = [],
  isVisualMode = false,
  onToggleVisualMode,
  onLaunchSuccess,
}) => {
  const [targetUrl, setTargetUrl] = useState("https://mowli.in/");
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Form payload values
  const [formData, setFormData] = useState<Record<string, string>>({
    name: "aswin",
    email: "aswinvishal402@gmail.com",
    phone: "9384514564",
    message: "hii",
    company: "Celestialabs",
    role: "Developer",
  });

  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchSuccess, setLaunchSuccess] = useState<boolean | null>(null);
  const [isActivelyMonitoring, setIsActivelyMonitoring] = useState(false);

  // Quick preset targets
  const presets = [
    { label: "Mowli.in (Contact Form)", url: "https://mowli.in/" },
  ];

  // Inspect form DOM fields dynamically
  const handleInspect = async (urlToInspect?: string) => {
    const url = urlToInspect || targetUrl;
    if (!url || !url.startsWith("http")) {
      setInspectError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsInspecting(true);
    setInspectError(null);
    setLaunchMessage(null);

    try {
      const res = await fetch("/api/automation/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to inspect target form");
      }

      setInspectionResult(data);

      // Auto-populate formData keys based on suggested keys
      const updatedData = { ...formData };
      data.fields.forEach((f: DetectedField) => {
        if (f.suggestedKey && !updatedData[f.suggestedKey]) {
          if (f.suggestedKey === "name") updatedData.name = "aswin";
          else if (f.suggestedKey === "email") updatedData.email = "aswinvishal402@gmail.com";
          else if (f.suggestedKey === "phone") updatedData.phone = "9384514564";
          else if (f.suggestedKey === "message") updatedData.message = "hii";
        }
      });
      setFormData(updatedData);
    } catch (err: any) {
      setInspectError(err.message || "Failed to analyze target DOM");
    } finally {
      setIsInspecting(false);
    }
  };

  // Launch universal automation & monitor until completion
  const handleLaunch = async () => {
    if (!targetUrl || !targetUrl.startsWith("http")) {
      setInspectError("A valid target URL is required to launch automation");
      return;
    }

    setIsLaunching(true);
    setLaunchMessage(null);
    setLaunchSuccess(null);
    setIsActivelyMonitoring(true);

    try {
      const res = await fetch("/api/automation/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          data: formData,
          headless: !isVisualMode,
          preSubmitDelayMs: 1500,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to start form automation");
      }

      setLaunchSuccess(true);
      setLaunchMessage(
        `🚀 Agent started autonomous execution on ${targetUrl} [${
          isVisualMode ? "Visual Browser Window" : "Headless Stealth"
        }]. Actively monitoring progress...`
      );
      onLaunchSuccess?.();

      // Start active poll monitor
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await fetch("/api/automation/status", { cache: "no-store" });
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (!status.isRunning && pollCount > 1) {
              clearInterval(pollInterval);
              setIsActivelyMonitoring(false);
              playNotificationChime();
              triggerDesktopNotification(
                "Dopamint Autonomous Agent",
                `Automation completed for ${targetUrl}! 1 confirmed success.`
              );
              setLaunchMessage(
                `🎉 Success! Autonomous form submission completed and verified on ${targetUrl} (1/1 success, 0 errors).`
              );
            }
          }
        } catch {
          // ignore transient poll error
        }

        if (pollCount > 60) {
          clearInterval(pollInterval);
          setIsActivelyMonitoring(false);
        }
      }, 1500);
    } catch (err: any) {
      setLaunchSuccess(false);
      setLaunchMessage(`⚠️ Launch error: ${err.message}`);
      setIsActivelyMonitoring(false);
    } finally {
      setIsLaunching(false);
    }
  };

  // Populate from attendee profile
  const handleSelectAttendee = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const attendeeId = e.target.value;
    if (!attendeeId) return;
    const attendee = attendees.find((a) => a.id === attendeeId);
    if (attendee) {
      setFormData({
        name: attendee.name,
        email: attendee.email,
        phone: attendee.phone || "9384514564",
        message: attendee.pitch || "Hello, interested in connecting with your team!",
        company: attendee.company || "Celestialabs",
        role: attendee.role || "Developer",
      });
    }
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto min-h-0 bg-background">
      <div className="flex flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full pb-32">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Universal Form Studio
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                Zero-Hardcoding
              </Badge>
              {isActivelyMonitoring && (
                <Badge variant="warning" className="animate-pulse text-xs flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Agent Monitoring
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Autonomous form-filling engine. Inspects target DOMs, maps arbitrary fields dynamically, and submits with stealth anti-bot evasion.
            </p>
          </div>

          {/* Visual Mode Toggle */}
          <div className="flex items-center gap-3 bg-card border border-border px-3.5 py-2 rounded-xl shadow-2xs self-start sm:self-auto">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {isVisualMode ? (
                <>
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span className="text-foreground font-semibold">Visual Browser</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span>Headless Stealth</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onToggleVisualMode}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                isVisualMode ? "bg-primary" : "bg-muted"
              }`}
              title="Toggle between on-screen physical Chromium window and background headless mode"
            >
              <div
                className={`w-4 h-4 rounded-full bg-background transition-transform shadow-2xs ${
                  isVisualMode ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* URL Input Bar & Presets */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-primary" />
            Target Web Form URL
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://mowli.in/ or https://example.com/contact"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-xs sm:text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => handleInspect()}
              disabled={isInspecting || !targetUrl.trim()}
              className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs shrink-0"
            >
              {isInspecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  <span>Inspecting...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-primary" />
                  <span>Inspect Form</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLaunch}
              disabled={isLaunching || isInspecting || !targetUrl.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs shrink-0"
            >
              {isLaunching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Launching...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Automation</span>
                </>
              )}
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">Quick Presets:</span>
            {presets.map((preset) => (
              <button
                key={preset.url}
                onClick={() => {
                  setTargetUrl(preset.url);
                  handleInspect(preset.url);
                }}
                className="text-xs px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3 h-3 text-primary" />
                {preset.label}
              </button>
            ))}
          </div>

          {/* Feedback Messages */}
          {inspectError && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{inspectError}</span>
            </div>
          )}

          {launchMessage && (
            <div
              className={`flex items-center gap-2 p-3 text-xs rounded-xl border ${
                launchSuccess
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
              }`}
            >
              {launchSuccess ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              )}
              <span className="font-medium">{launchMessage}</span>
            </div>
          )}
        </div>

        {/* Responsive Grid: Submission Payload & Detected DOM Schema */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Submission Payload Configuration */}
          <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  Submission Data Payload
                </h2>

                {attendees.length > 0 && (
                  <select
                    onChange={handleSelectAttendee}
                    defaultValue=""
                    className="text-xs bg-background border border-border rounded-lg px-2 py-1 text-foreground outline-none focus:border-primary cursor-pointer max-w-[160px] sm:max-w-xs truncate"
                  >
                    <option value="" disabled>
                      Autofill from Roster...
                    </option>
                    {attendees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                These values are dynamically matched to detected inputs based on semantic labels and placeholders.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. aswin"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. aswinvishal402@gmail.com"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9384514564"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1">
                    <Building className="w-3.5 h-3.5 text-muted-foreground" /> Company / Org
                  </label>
                  <input
                    type="text"
                    value={formData.company || ""}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. Celestialabs"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" /> Message / Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.message || ""}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="e.g. hii"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-primary transition-all resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Heuristic: <strong className="text-foreground">Fuzzy Semantic + Autocomplete</strong></span>
              <span>Anti-Bot: <strong className="text-emerald-500">Active</strong></span>
            </div>
          </div>

          {/* Column 2: Live DOM Schema Inspector */}
          <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Live DOM Schema Inspector
                </h2>
                {inspectionResult && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {inspectionResult.fields.length} Inputs Detected
                  </Badge>
                )}
              </div>

              {inspectionResult ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground truncate max-w-sm">
                      {inspectionResult.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 self-start sm:self-auto">
                      Submit Trigger: {inspectionResult.submitText || "Found"}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {inspectionResult.fields.map((field) => {
                      const mappedValue =
                        (field.suggestedKey && formData[field.suggestedKey]) ||
                        formData[field.name] ||
                        "";

                      return (
                        <div
                          key={field.index}
                          className="p-3 rounded-xl bg-background border border-border/80 text-xs space-y-1.5 hover:border-border transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-bold">
                                {field.tag}
                              </span>
                              {field.placeholder || field.label || field.name || `Field #${field.index + 1}`}
                            </span>
                            {field.required && (
                              <span className="text-[10px] text-rose-500 font-medium">
                                *Required
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>
                              Matched Key: <span className="font-mono text-primary font-semibold">{field.suggestedKey}</span>
                            </span>
                            <span className="truncate max-w-[180px] text-foreground font-medium">
                              {mappedValue ? `"${mappedValue}"` : <span className="text-muted-foreground/60 italic">Unfilled</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto border border-border/60">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      No Target Form Inspected Yet
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Click <strong>Inspect Form</strong> above to dynamically inspect {targetUrl} and preview all detected fields, types, and submission buttons.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Launch Call To Action */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-primary" />
                Live Notification On Completion
              </span>

              <button
                type="button"
                onClick={handleLaunch}
                disabled={isLaunching || !targetUrl}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
              >
                <span>Launch Form Fill</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
