"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  User,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Upload,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Save,
  Rocket,
  Check,
  Globe,
  Wallet,
  Send,
  Loader2,
  AlertCircle,
  Plus,
  Key,
  Shield,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Attendee {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company: string;
  role: string;
  telegram?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  website?: string | null;
  pitch?: string | null;
  wallets?: string | null;
  lumaSessionKey?: string | null;
  registrations?: any[];
}

interface EventItem {
  id: number;
  title: string;
  url: string;
  date?: string | null;
  category?: string | null;
  platform?: string;
  isLuma?: boolean;
  soldOut?: boolean;
  requireApproval?: boolean;
  registrations?: any[];
}

interface UserFormPageProps {
  attendees: Attendee[];
  events: EventItem[];
  selectedAttendeeId: string;
  onSelectAttendee: (id: string) => void;
  onRefreshData: () => Promise<void> | void;
  onStartAutomation: (eventIds: number[]) => Promise<void> | void;
  onNavigateToLive: () => void;
  isVisualMode?: boolean;
  onToggleVisualMode?: () => void;
}

export function UserFormPage({
  attendees,
  events,
  selectedAttendeeId,
  onSelectAttendee,
  onRefreshData,
  onStartAutomation,
  onNavigateToLive,
  isVisualMode = false,
  onToggleVisualMode,
}: UserFormPageProps) {
  const currentAttendee = useMemo(() => {
    return attendees.find((a) => a.id === selectedAttendeeId) || attendees[0] || null;
  }, [attendees, selectedAttendeeId]);

  // Attendee profile form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [telegram, setTelegram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [pitch, setPitch] = useState("");
  const [evmWallet, setEvmWallet] = useState("");
  const [solWallet, setSolWallet] = useState("");
  const [lumaSessionKey, setLumaSessionKey] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // File upload state for auto-populating bio/roster
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isParsingDoc, setIsParsingDoc] = useState(false);

  // Selected events state
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Group events by admin-curated category
  const eventsByCategory = useMemo(() => {
    const groups: Record<string, EventItem[]> = {};
    events.forEach((ev) => {
      const cat = ev.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ev);
    });
    return groups;
  }, [events]);

  const categories = useMemo(() => {
    return Object.keys(eventsByCategory).sort();
  }, [eventsByCategory]);

  // Sync form inputs when attendee changes
  useEffect(() => {
    if (currentAttendee) {
      setName(currentAttendee.name || "");
      setEmail(currentAttendee.email || "");
      setPhone(currentAttendee.phone || "");
      setCompany(currentAttendee.company || "");
      setRole(currentAttendee.role || "");
      setTelegram(currentAttendee.telegram || "");
      setTwitter(currentAttendee.twitter || "");
      setLinkedin(currentAttendee.linkedin || "");
      setWebsite(currentAttendee.website || "");
      setPitch(currentAttendee.pitch || "");
      setLumaSessionKey(currentAttendee.lumaSessionKey || "");

      if (currentAttendee.wallets) {
        try {
          const w = typeof currentAttendee.wallets === "string" ? JSON.parse(currentAttendee.wallets) : currentAttendee.wallets;
          setEvmWallet(w.evm || "");
          setSolWallet(w.solana || "");
        } catch {
          setEvmWallet(currentAttendee.wallets);
        }
      } else {
        setEvmWallet("");
        setSolWallet("");
      }
    }
  }, [currentAttendee]);

  // Initialize expanded categories and select all by default if none selected
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    categories.forEach((cat) => {
      initialExpanded[cat] = true;
    });
    setExpandedCategories(initialExpanded);

    if (selectedEventIds.length === 0 && events.length > 0) {
      setSelectedEventIds(events.map((e) => e.id));
    }
  }, [categories, events]);

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleEventSelect = (id: number) => {
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleCategorySelectAll = (cat: string) => {
    const catEventIds = (eventsByCategory[cat] || []).map((e) => e.id);
    const allSelected = catEventIds.every((id) => selectedEventIds.includes(id));

    if (allSelected) {
      setSelectedEventIds((prev) => prev.filter((id) => !catEventIds.includes(id)));
    } else {
      setSelectedEventIds((prev) => Array.from(new Set([...prev, ...catEventIds])));
    }
  };

  const isCategoryFullySelected = (cat: string) => {
    const catEventIds = (eventsByCategory[cat] || []).map((e) => e.id);
    return catEventIds.length > 0 && catEventIds.every((id) => selectedEventIds.includes(id));
  };

  // Save Attendee Profile
  const handleSaveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      setProfileFeedback({ type: "error", message: "Name and email are required." });
      return;
    }

    setIsSavingProfile(true);
    setProfileFeedback(null);
    try {
      const walletsObj: Record<string, string> = {};
      if (evmWallet) walletsObj.evm = evmWallet.trim();
      if (solWallet) walletsObj.solana = solWallet.trim();

      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          company: company.trim() || "Independent",
          role: role.trim() || "Attendee",
          telegram: telegram.trim(),
          twitter: twitter.trim(),
          linkedin: linkedin.trim(),
          website: website.trim(),
          pitch: pitch.trim(),
          wallets: Object.keys(walletsObj).length > 0 ? JSON.stringify(walletsObj) : null,
          lumaSessionKey: lumaSessionKey.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to save profile.");
      setProfileFeedback({ type: "success", message: "Profile saved successfully." });
      await onRefreshData();
      setTimeout(() => setProfileFeedback(null), 4000);
    } catch (err: any) {
      setProfileFeedback({ type: "error", message: err.message || "Failed to save profile." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Upload Doc / Resume / Bio to Auto-fill form
  const handleBioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDoc(true);
    setProfileFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "attendees");

      const res = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.attendees || data.attendees.length === 0) {
        throw new Error(data.error || "No attendee profile details could be parsed from file.");
      }

      const parsed = data.attendees[0];
      if (parsed.name) setName(parsed.name);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.phone) setPhone(parsed.phone);
      if (parsed.company) setCompany(parsed.company);
      if (parsed.role) setRole(parsed.role);
      if (parsed.telegram) setTelegram(parsed.telegram);
      if (parsed.twitter) setTwitter(parsed.twitter);
      if (parsed.linkedin) setLinkedin(parsed.linkedin);
      if (parsed.website) setWebsite(parsed.website);
      if (parsed.pitch) setPitch(parsed.pitch);
      if (parsed.wallets?.evm) setEvmWallet(parsed.wallets.evm);
      if (parsed.wallets?.solana) setSolWallet(parsed.wallets.solana);

      setProfileFeedback({
        type: "success",
        message: `Auto-populated profile from ${file.name}! Please review and click Save Profile.`,
      });
      setShowAdvanced(true);
    } catch (err: any) {
      setProfileFeedback({ type: "error", message: err.message || "Failed to parse document." });
    } finally {
      setIsParsingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Launch Automation
  const handleLaunch = async () => {
    if (selectedEventIds.length === 0) {
      alert("Please select at least one Luma event to register.");
      return;
    }

    await onStartAutomation(selectedEventIds);
    onNavigateToLive();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto custom-scrollbar p-6 space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Autonomous Luma Event Registration
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review your profile information and select curated Luma events to submit automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Team Member Switcher */}
        {attendees.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Attendee:</span>
            <select
              value={selectedAttendeeId || currentAttendee?.id}
              onChange={(e) => onSelectAttendee(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer"
            >
              {attendees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Profile Feedback Toast */}
      {profileFeedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 ${
            profileFeedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          {profileFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{profileFeedback.message}</span>
        </div>
      )}

      {/* SECTION 1: ATTENDEE DATA FORM (Minimal & Elegant) */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Attendee Profile Details
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Our AI uses these fields to auto-fill form questions accurately.
              </span>
            </div>
          </div>

          {/* Auto-fill from Document Button */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleBioFileUpload}
              accept=".xlsx,.xls,.csv,.docx,.pdf,.md,.txt"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingDoc}
              className="text-xs h-8 rounded-xl border-dashed border-primary/40 hover:border-primary text-primary hover:bg-primary/10 gap-1.5 cursor-pointer shadow-2xs"
            >
              {isParsingDoc ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Auto-Fill from Doc / Bio</span>
            </Button>
          </div>
        </div>

        {/* Primary Contact Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aswin Vishal"
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aswin@example.com"
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 93848 12345"
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Company / Project</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Dopamint AI"
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Job Title / Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Full Stack Engineer"
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Telegram Handle</label>
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@aswinvishal"
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Collapsible Advanced: Socials, Web3 Wallets, Luma Key */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <span>{showAdvanced ? "Hide Web3 & Social Profiles" : "Add Web3 Wallets & Social Profiles"}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">X / Twitter</label>
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@aswinvishal"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">LinkedIn URL</label>
                <input
                  type="text"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Website / Portfolio</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://openledger.xyz"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Wallet className="w-3 h-3 text-emerald-500" />
                  <span>EVM Wallet Address</span>
                </label>
                <input
                  type="text"
                  value={evmWallet}
                  onChange={(e) => setEvmWallet(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground font-mono placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Wallet className="w-3 h-3 text-indigo-400" />
                  <span>Solana Wallet Address</span>
                </label>
                <input
                  type="text"
                  value={solWallet}
                  onChange={(e) => setSolWallet(e.target.value)}
                  placeholder="Base58 Solana address..."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground font-mono placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-amber-500" />
                  <span>Luma Session Key (Optional)</span>
                </label>
                <input
                  type="password"
                  value={lumaSessionKey}
                  onChange={(e) => setLumaSessionKey(e.target.value)}
                  placeholder="usr-..."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground font-mono placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                />
              </div>

              <div className="col-span-full space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Short Pitch / Bio (Answers &quot;Why do you want to attend?&quot;)
                </label>
                <textarea
                  rows={2}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="AI developer building autonomous agents and smart contract tooling for Ethereum and Solana."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Save Profile Button */}
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className="text-xs h-9 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 cursor-pointer shadow-xs"
          >
            {isSavingProfile ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Profile</span>
          </Button>
        </div>
      </div>

      {/* SECTION 2: CURATED LUMA EVENTS (Grouped by Admin Categories) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider font-mono">
              Curated Events for Automation ({events.length})
            </h2>
          </div>
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">{selectedEventIds.length}</strong> of {events.length} selected
          </div>
        </div>

        {/* Categories Accordion */}
        <div className="space-y-3">
          {categories.map((cat) => {
            const catEvents = eventsByCategory[cat] || [];
            const isExpanded = expandedCategories[cat] ?? true;
            const isAllCatSelected = isCategoryFullySelected(cat);
            const selectedInCatCount = catEvents.filter((e) => selectedEventIds.includes(e.id)).length;

            return (
              <div
                key={cat}
                className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs"
              >
                {/* Category Header */}
                <div className="px-5 py-3.5 bg-muted/30 border-b border-border/60 flex items-center justify-between gap-3">
                  <div
                    onClick={() => toggleCategoryExpand(cat)}
                    className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 select-none"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-xs font-bold text-foreground tracking-tight">
                      {cat}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-border bg-background">
                      {selectedInCatCount}/{catEvents.length} Selected
                    </Badge>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCategorySelectAll(cat)}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer shrink-0"
                  >
                    {isAllCatSelected ? "Deselect All" : "Select All in Category"}
                  </button>
                </div>

                {/* Event Items in Category */}
                {isExpanded && (
                  <div className="divide-y divide-border/60">
                    {catEvents.map((ev) => {
                      const isSelected = selectedEventIds.includes(ev.id);
                      const isRegistered = ev.registrations && ev.registrations.length > 0;

                      return (
                        <div
                          key={ev.id}
                          onClick={() => toggleEventSelect(ev.id)}
                          className={`p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none ${
                            isSelected ? "bg-primary/[0.04]" : "hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by div onClick
                              className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                            />
                            <div className="min-w-0 space-y-0.5">
                              <span className="text-xs font-semibold text-foreground block truncate">
                                {ev.title}
                              </span>
                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <span className="truncate max-w-xs">{ev.url}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                                {ev.date && <span>📅 {ev.date}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isRegistered && (
                              <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-bold">
                                ✓ Registered
                              </Badge>
                            )}
                            {ev.requireApproval && (
                              <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10">
                                Approval Req.
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* STICKY BOTTOM LAUNCH BAR */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-[268px] sm:right-6 z-40">
        <div className="p-4 rounded-2xl bg-card/95 border border-primary/40 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Ready to Automate: <span className="text-primary">{selectedEventIds.length} Luma Events</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Target Attendee: <strong className="text-foreground">{name || currentAttendee?.name}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onToggleVisualMode && (
              <button
                type="button"
                onClick={onToggleVisualMode}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isVisualMode
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                    : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                }`}
                title="Toggle visual Chromium window vs background stealth"
              >
                {isVisualMode ? "🖥️ Desktop Window ON" : "🥷 Background Stealth"}
              </button>
            )}

            <Button
              onClick={handleLaunch}
              disabled={selectedEventIds.length === 0}
              className="flex-1 sm:flex-initial h-10 px-5 rounded-xl text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg shadow-primary/20"
            >
              <Rocket className="w-4 h-4" />
              <span>Start Autonomous Registration 🚀</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
