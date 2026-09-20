"use client";

import React, { useState } from "react";
import {
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  Code,
  CheckCircle2,
  Table,
  Users,
  Ticket,
  Calendar,
} from "lucide-react";
import {
  downloadExcel,
  downloadCSV,
  downloadMarkdown,
  downloadJSON,
  printOrSavePDF,
} from "@/lib/export-data";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  attendees: any[];
  initialDataset?: "matrix" | "confirmed" | "roster" | "events";
}

type DatasetType = "matrix" | "confirmed" | "roster" | "events";
type FormatType = "xlsx" | "csv" | "md" | "pdf" | "json";

export default function ExportModal({
  isOpen,
  onClose,
  events,
  attendees,
  initialDataset = "matrix",
}: ExportModalProps) {
  const [selectedDataset, setSelectedDataset] = useState<DatasetType>(initialDataset);
  const [selectedFormat, setSelectedFormat] = useState<FormatType>("xlsx");
  const [isExporting, setIsExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    setSuccessMessage(null);

    try {
      const timestamp = new Date().toISOString().split("T")[0];

      if (selectedDataset === "matrix") {
        // Build matrix data
        const matrixRows = events.map((ev) => {
          const row: Record<string, any> = {
            "Event ID": ev.id,
            "Event Title": ev.title,
            "Date": ev.date || "TBD",
            "URL": ev.url,
            "Sold Out": ev.soldOut ? "Yes" : "No",
          };
          attendees.forEach((a) => {
            const reg = ev.registrations?.find((r: any) => r.attendeeId === a.id);
            row[a.name] = reg?.status || (ev.soldOut ? "Closed" : "Not Registered");
          });
          return row;
        });

        const filename = `dopamint_event_matrix_${timestamp}`;
        if (selectedFormat === "xlsx") {
          downloadExcel(filename, [{ name: "Event Matrix", data: matrixRows }]);
        } else if (selectedFormat === "csv") {
          downloadCSV(filename, matrixRows);
        } else if (selectedFormat === "md") {
          downloadMarkdown(filename, "Event Registration Matrix", matrixRows);
        } else if (selectedFormat === "json") {
          downloadJSON(filename, matrixRows);
        } else if (selectedFormat === "pdf") {
          printOrSavePDF("Event Registration Matrix", matrixRows);
        }
      } else if (selectedDataset === "confirmed") {
        // Confirmed passes
        const confirmedRows: Record<string, any>[] = [];
        events.forEach((ev) => {
          (ev.registrations || []).forEach((r: any) => {
            if (r.status === "confirmed_success") {
              const a = attendees.find((att) => att.id === r.attendeeId);
              confirmedRows.push({
                "Attendee Name": a?.name || "Unknown",
                "Email": a?.email || "",
                "Event ID": ev.id,
                "Event Title": ev.title,
                "Date": ev.date || "TBD",
                "Status": "CONFIRMED PASS",
                "Event URL": ev.url,
                "Confirmed At": r.updatedAt || r.createdAt || new Date().toISOString(),
              });
            }
          });
        });

        const filename = `dopamint_confirmed_passes_${timestamp}`;
        if (selectedFormat === "xlsx") {
          downloadExcel(filename, [{ name: "Confirmed Passes", data: confirmedRows }]);
        } else if (selectedFormat === "csv") {
          downloadCSV(filename, confirmedRows);
        } else if (selectedFormat === "md") {
          downloadMarkdown(filename, "Confirmed Event Passes", confirmedRows);
        } else if (selectedFormat === "json") {
          downloadJSON(filename, confirmedRows);
        } else if (selectedFormat === "pdf") {
          printOrSavePDF("Confirmed Event Passes", confirmedRows);
        }
      } else if (selectedDataset === "roster") {
        // Team Roster
        const rosterRows = attendees.map((a) => ({
          "Name": a.name,
          "Email": a.email,
          "Role": a.role || "",
          "Company": a.company || "",
          "Phone": a.phone || "",
          "Telegram": a.telegram || "",
          "Twitter": a.twitter || "",
          "LinkedIn": a.linkedin || "",
          "Wallets": a.wallets || "",
          "Pitch": a.pitch || "",
        }));

        const filename = `dopamint_team_roster_${timestamp}`;
        if (selectedFormat === "xlsx") {
          downloadExcel(filename, [{ name: "Team Roster", data: rosterRows }]);
        } else if (selectedFormat === "csv") {
          downloadCSV(filename, rosterRows);
        } else if (selectedFormat === "md") {
          downloadMarkdown(filename, "Team Member Profiles & Roster", rosterRows);
        } else if (selectedFormat === "json") {
          downloadJSON(filename, rosterRows);
        } else if (selectedFormat === "pdf") {
          printOrSavePDF("Team Member Profiles & Roster", rosterRows);
        }
      } else if (selectedDataset === "events") {
        // Events catalog
        const eventRows = events.map((ev) => {
          const confirmedCount = (ev.registrations || []).filter(
            (r: any) => r.status === "confirmed_success"
          ).length;
          return {
            "ID": ev.id,
            "Title": ev.title,
            "Date": ev.date || "TBD",
            "Platform": ev.platform || "luma",
            "Status": ev.soldOut ? "Sold Out / Closed" : "Open",
            "Confirmed Members": confirmedCount,
            "URL": ev.url,
          };
        });

        const filename = `dopamint_events_catalog_${timestamp}`;
        if (selectedFormat === "xlsx") {
          downloadExcel(filename, [{ name: "Events Catalog", data: eventRows }]);
        } else if (selectedFormat === "csv") {
          downloadCSV(filename, eventRows);
        } else if (selectedFormat === "md") {
          downloadMarkdown(filename, "Events Catalog & Links", eventRows);
        } else if (selectedFormat === "json") {
          downloadJSON(filename, eventRows);
        } else if (selectedFormat === "pdf") {
          printOrSavePDF("Events Catalog & Links", eventRows);
        }
      }

      setSuccessMessage(`Successfully exported as .${selectedFormat.toUpperCase()}!`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const datasets = [
    {
      id: "matrix" as DatasetType,
      label: "Full Registration Matrix",
      desc: "Comprehensive table of all events and member statuses",
      icon: Table,
      count: `${events.length} events × ${attendees.length} members`,
    },
    {
      id: "confirmed" as DatasetType,
      label: "Confirmed Passes Only",
      desc: "Attendee-event pairings with confirmed tickets",
      icon: Ticket,
      count: "Verified Passes",
    },
    {
      id: "roster" as DatasetType,
      label: "Team Roster & Profiles",
      desc: "Contacts, socials, wallets, and pitch details",
      icon: Users,
      count: `${attendees.length} Members`,
    },
    {
      id: "events" as DatasetType,
      label: "Events Catalog",
      desc: "Full directory of event links, dates, and status",
      icon: Calendar,
      count: `${events.length} Events`,
    },
  ];

  const formats = [
    {
      id: "xlsx" as FormatType,
      name: "Excel Spreadsheet",
      ext: ".xlsx",
      desc: "Full workbook formatted with sheets",
      icon: FileSpreadsheet,
    },
    {
      id: "csv" as FormatType,
      name: "CSV Delimited",
      ext: ".csv",
      desc: "Raw comma-separated tabular values",
      icon: FileText,
    },
    {
      id: "md" as FormatType,
      name: "Markdown Table",
      ext: ".md",
      desc: "GitHub-flavored markdown for documentation",
      icon: FileText,
    },
    {
      id: "pdf" as FormatType,
      name: "Printable / PDF",
      ext: ".pdf",
      desc: "Clean printable document with print dialogue",
      icon: Printer,
    },
    {
      id: "json" as FormatType,
      name: "JSON Structured",
      ext: ".json",
      desc: "Raw JSON array for automated scripts",
      icon: Code,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent text-primary flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Export Data</h2>
              <p className="text-xs text-muted-foreground">
                Download registration records, team rosters, and event sheets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Step 1: Select Dataset */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              1. Select Dataset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {datasets.map((d) => {
                const isSelected = selectedDataset === d.id;
                const Icon = d.icon;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDataset(d.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? "bg-accent border-primary/50 ring-2 ring-primary/20"
                        : "bg-card border-border hover:border-border/80 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-xs font-bold text-foreground">{d.label}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{d.desc}</p>
                    <span className="text-[10px] font-mono text-primary/80 font-medium">
                      {d.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Format */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              2. Select Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {formats.map((f) => {
                const isSelected = selectedFormat === f.id;
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFormat(f.id)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accent border-primary/50 ring-2 ring-primary/20"
                        : "bg-card border-border hover:border-border/80 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-[10px] font-mono font-bold uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {f.ext}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-foreground truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{f.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? "Generating..." : `Export .${selectedFormat.toUpperCase()}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
