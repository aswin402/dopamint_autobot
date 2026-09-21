"use client";

import React, { useState, useRef } from "react";
import {
  Users,
  Mail,
  Phone,
  Send,
  Globe,
  Wallet,
  Upload,
  FileSpreadsheet,
  Check,
  Building,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Attendee {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone?: string;
  telegram?: string;
  twitter?: string;
  linkedin?: string;
  wallets?: string;
  pitch?: string;
}

interface TeamRosterProps {
  attendees: Attendee[];
  refreshData: () => void;
  selectedAttendeeId: string;
  onSelectAttendee: (id: string) => void;
  onOpenExport?: () => void;
}

export const TeamRoster: React.FC<TeamRosterProps> = ({
  attendees,
  refreshData,
  selectedAttendeeId,
  onSelectAttendee,
  onOpenExport,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CRUD State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    role: "",
    company: "",
    phone: "",
    telegram: "",
    twitter: "",
    linkedin: "",
    wallets: "",
    pitch: "",
  });

  const [deleteConfirmAttendee, setDeleteConfirmAttendee] = useState<Attendee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingId(null);
    setFormState({
      name: "",
      email: "",
      role: "",
      company: "",
      phone: "",
      telegram: "",
      twitter: "",
      linkedin: "",
      wallets: "",
      pitch: "",
    });
    setIsMemberModalOpen(true);
  };

  const handleOpenEdit = (a: Attendee, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode("edit");
    setEditingId(a.id);
    setFormState({
      name: a.name || "",
      email: a.email || "",
      role: a.role || "",
      company: a.company || "",
      phone: a.phone || "",
      telegram: a.telegram || "",
      twitter: a.twitter || "",
      linkedin: a.linkedin || "",
      wallets: a.wallets || "",
      pitch: a.pitch || "",
    });
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.email.trim()) {
      alert("Name and Email are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/attendees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create member");
      } else {
        const res = await fetch(`/api/attendees/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update member");
      }

      setIsMemberModalOpen(false);
      refreshData();
    } catch (err: any) {
      alert(err.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteConfirmAttendee) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/attendees/${deleteConfirmAttendee.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete member");

      setDeleteConfirmAttendee(null);
      refreshData();
    } catch (err: any) {
      alert(err.message || "Failed to delete member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(`Processing ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setUploadMessage(
          `✅ Successfully imported ${json.filename}! Synced ${json.newAttendeesCount || 0} team members.`
        );
        refreshData();
      } else {
        setUploadMessage(`⚠️ Upload error: ${json.error}`);
      }
    } catch (err: any) {
      setUploadMessage(`⚠️ Ingestion failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadMessage(null), 6000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header and Ingestion Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Team Roster</span>
            <Badge variant="secondary" className="text-xs">
              {attendees.length} Members
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Attendee profiles used for autonomous form filling, question resolution, and ticket claims.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Member Button */}
          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="rounded-2xl gap-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </Button>

          {/* Import File Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".csv,.xlsx,.docx,.md,.txt"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            variant="outline"
            size="sm"
            className="rounded-2xl gap-1.5 text-xs border-border bg-card hover:bg-muted cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span>{isUploading ? "Uploading..." : "Import Roster"}</span>
          </Button>

          {/* Export Roster Button */}
          {onOpenExport && (
            <Button
              onClick={onOpenExport}
              variant="outline"
              size="sm"
              className="rounded-2xl gap-1.5 text-xs border-border bg-card hover:bg-muted text-foreground cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Export</span>
            </Button>
          )}
        </div>
      </div>

      {uploadMessage && (
        <div className="p-3 rounded-2xl bg-muted border border-border text-xs text-foreground font-medium">
          {uploadMessage}
        </div>
      )}

      {/* Attendee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {attendees.map((a) => {
          const isSelected = selectedAttendeeId === a.id;
          return (
            <Card
              key={a.id}
              className={`rounded-3xl border transition-all cursor-pointer relative group ${
                isSelected
                  ? "bg-accent border-primary/40 ring-2 ring-primary/20 shadow-xs"
                  : "bg-card border-border hover:border-border/80 shadow-2xs"
              }`}
              onClick={() => onSelectAttendee(a.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <CardTitle className="text-sm font-bold text-foreground truncate">
                      {a.name}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <Building className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span>{a.company || "Independent"}</span>
                      <span>•</span>
                      <span className="font-medium text-foreground">{a.role || "Attendee"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && (
                      <Badge variant="olive" className="text-[10px]">
                        Active
                      </Badge>
                    )}
                    {/* Action buttons */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(a, e)}
                      title="Edit attendee profile"
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmAttendee(a);
                      }}
                      title="Delete attendee"
                      className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 pt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-mono text-[11px] truncate">
                    {a.email}
                  </span>
                </div>

                {a.phone && (
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{a.phone}</span>
                  </div>
                )}

                {a.telegram && (
                  <div className="flex items-center gap-2 truncate">
                    <Send className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{a.telegram}</span>
                  </div>
                )}

                {a.wallets && (
                  <div className="flex items-center gap-2 truncate">
                    <Wallet className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {a.wallets}
                    </span>
                  </div>
                )}

                {a.pitch && (
                  <p className="text-[11px] text-muted-foreground/80 line-clamp-2 pt-1 border-t border-border/60">
                    "{a.pitch}"
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Member Create / Edit Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-accent text-primary flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {modalMode === "create" ? "Add Team Member" : "Edit Team Member"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Manage attendee details used for automated event registration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    placeholder="e.g. alex@company.com"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Role / Title</label>
                  <input
                    type="text"
                    value={formState.role}
                    onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                    placeholder="e.g. Operations Lead"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Company</label>
                  <input
                    type="text"
                    value={formState.company}
                    onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    placeholder="e.g. +1 555-0199"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Telegram Handle</label>
                  <input
                    type="text"
                    value={formState.telegram}
                    onChange={(e) => setFormState({ ...formState, telegram: e.target.value })}
                    placeholder="e.g. @telegram_handle"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Twitter / X Handle</label>
                  <input
                    type="text"
                    value={formState.twitter}
                    onChange={(e) => setFormState({ ...formState, twitter: e.target.value })}
                    placeholder="e.g. @twitter_handle"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">LinkedIn URL</label>
                  <input
                    type="text"
                    value={formState.linkedin}
                    onChange={(e) => setFormState({ ...formState, linkedin: e.target.value })}
                    placeholder="e.g. linkedin.com/in/..."
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Crypto Wallets</label>
                <input
                  type="text"
                  value={formState.wallets}
                  onChange={(e) => setFormState({ ...formState, wallets: e.target.value })}
                  placeholder="e.g. 0x... or Solana pubkey"
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Company Pitch / Bio</label>
                <textarea
                  rows={3}
                  value={formState.pitch}
                  onChange={(e) => setFormState({ ...formState, pitch: e.target.value })}
                  placeholder="Brief pitch used when event forms ask 'Tell us about your project/reason for attending'..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Create Member"
                    : "Update Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmAttendee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Delete Team Member?</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove <span className="font-semibold text-foreground">{deleteConfirmAttendee.name}</span>? All of their registration statuses will also be cleaned up.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteConfirmAttendee(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMember}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
