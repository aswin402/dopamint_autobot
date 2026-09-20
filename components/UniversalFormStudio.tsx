"use client";

import React, { useState } from "react";
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
  Check,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetectedField, InspectionResult } from "@/lib/automation/runner";

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
  });

  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchSuccess, setLaunchSuccess] = useState<boolean | null>(null);

  // Quick preset URLs
  const presets = [
    { label: "Mowli.in Contact Form", url: "https://mowli.in/" },
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

  // Launch universal automation
  const handleLaunch = async () => {
    if (!targetUrl || !targetUrl.startsWith("http")) {
      setInspectError("A valid target URL is required to launch automation");
      return;
    }

    setIsLaunching(true);
    setLaunchMessage(null);
    setLaunchSuccess(null);

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
        `🚀 Form automation launched for ${targetUrl} [${
          isVisualMode ? "Visual Headed Browser Mode" : "Headless Stealth Mode"
        }]. Live execution is streaming in the monitor panel!`
      );
      onLaunchSuccess?.();
    } catch (err: any) {
      setLaunchSuccess(false);
      setLaunchMessage(`⚠️ Launch error: ${err.message}`);
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
        company: attendee.company || "",
        role: attendee.role || "",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Universal Form Studio
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              Zero-Hardcoding
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Autonomous web form filling engine. Analyzes target DOM structures, maps semantic fields dynamically, and executes humanized submissions with anti-bot evasion.
          </p>
        </div>

        {/* Visual Mode Toggle */}
        <div className="flex items-center gap-3 self-end md:self-auto bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            {isVisualMode ? (
              <>
                <Eye className="w-3.5 h-3.5 text-primary" /> Visual Window
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Headless Mode
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onToggleVisualMode}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
              isVisualMode ? "bg-primary" : "bg-muted"
            }`}
            title="Toggle between on-screen physical browser and background headless mode"
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
      <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-primary" />
          Target Form URL
        </label>

        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/contact or https://mowli.in/"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => handleInspect()}
            disabled={isInspecting || !targetUrl.trim()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
          >
            {isInspecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>Inspecting DOM...</span>
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
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
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

        {/* Presets */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <span className="text-xs text-muted-foreground">Quick Target:</span>
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
            <span>{launchMessage}</span>
          </div>
        )}
      </div>

      {/* Grid: Form Schema & Payload Data */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Payload Configuration */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              Submission Payload
            </h2>

            {attendees.length > 0 && (
              <select
                onChange={handleSelectAttendee}
                defaultValue=""
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-1 text-foreground outline-none focus:border-primary cursor-pointer"
              >
                <option value="" disabled>
                  Fill from Team Roster...
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
            Values passed to the semantic matcher. Key matching occurs dynamically without hardcoding.
          </p>

          <div className="space-y-3.5 pt-1">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name
              </label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Aswin Vishal"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground outline-none focus:border-primary transition-all"
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
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground outline-none focus:border-primary transition-all"
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
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground outline-none focus:border-primary transition-all"
              />
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
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground outline-none focus:border-primary transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Detected Interactive DOM Schema */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Live DOM Schema Inspector
              </h2>
              {inspectionResult && (
                <span className="text-xs text-muted-foreground font-mono">
                  {inspectionResult.fields.length} fields detected
                </span>
              )}
            </div>

            {inspectionResult ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground truncate max-w-[280px]">
                    {inspectionResult.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    Submit Action: {inspectionResult.submitText || "Found"}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {inspectionResult.fields.map((field) => {
                    const mappedValue =
                      (field.suggestedKey && formData[field.suggestedKey]) ||
                      formData[field.name] ||
                      "";

                    return (
                      <div
                        key={field.index}
                        className="p-3 rounded-xl bg-background border border-border/80 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
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
                            Key: <span className="font-mono text-primary">{field.suggestedKey}</span>
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
                    No Target Inspected Yet
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Click <strong>Inspect Form</strong> above to dynamically extract all interactive form fields, placeholders, and submission triggers from {targetUrl}.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Call to Action */}
          <div className="pt-4 border-t border-border mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Anti-Bot Stealth: <span className="text-emerald-500 font-medium">Active (Evasion Masked)</span>
            </span>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={isLaunching || !targetUrl}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
            >
              <span>Launch Live</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
