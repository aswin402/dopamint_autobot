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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TeamRosterProps {
  attendees: any[];
  refreshData: () => void;
  selectedAttendeeId: string;
  onSelectAttendee: (id: string) => void;
}

export const TeamRoster: React.FC<TeamRosterProps> = ({
  attendees,
  refreshData,
  selectedAttendeeId,
  onSelectAttendee,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        <div className="flex items-center gap-2">
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
            className="rounded-2xl gap-2 text-xs border-border bg-card hover:bg-muted"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span>{isUploading ? "Uploading..." : "Import Roster File"}</span>
          </Button>
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
              className={`rounded-3xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-accent border-primary/40 ring-2 ring-primary/20 shadow-xs"
                  : "bg-card border-border hover:border-border/80 shadow-2xs"
              }`}
              onClick={() => onSelectAttendee(a.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <CardTitle className="text-sm font-bold text-foreground truncate">
                      {a.name}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <Building className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span>{a.company}</span>
                      <span>•</span>
                      <span className="font-medium text-foreground">{a.role}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge variant="olive" className="text-[10px] flex-shrink-0">
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-2 pt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-mono text-[11px] truncate">
                    {a.email}
                  </span>
                </div>

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
    </div>
  );
};
