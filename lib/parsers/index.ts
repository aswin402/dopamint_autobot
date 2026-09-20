import * as XLSX from "xlsx";
import Papa from "papaparse";
import mammoth from "mammoth";

export interface ExtractedEvent {
  id?: number;
  title: string;
  url: string;
  date?: string;
  ticketText?: string;
  platform?: string;
}

export interface ExtractedAttendee {
  name: string;
  email: string;
  phone?: string;
  company: string;
  role: string;
  telegram?: string;
  twitter?: string;
  linkedin?: string;
  pitch?: string;
  wallets?: Record<string, string>;
}

export interface ParseResult {
  fileType: "spreadsheet" | "csv" | "docx" | "markdown" | "unknown";
  rawText?: string;
  events: ExtractedEvent[];
  attendees: ExtractedAttendee[];
  summary: string;
}

/**
 * Universal Multi-Format Document Ingestion Engine
 * Ingests .xlsx, .xls, .csv, .docx, .md, and raw text
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const events: ExtractedEvent[] = [];
  const attendees: ExtractedAttendee[] = [];

  // 1. Spreadsheets (.xlsx, .xls)
  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    rows.forEach((row, idx) => {
      // Look for event-like keys
      const title = row["Event Name"] || row["Title"] || row["Event"] || row["name"] || "";
      const url = row["Event Link"] || row["Link"] || row["URL"] || row["url"] || "";
      const date = row["Date"] || row["date"] || "";

      if (url && String(url).startsWith("http")) {
        events.push({
          id: idx + 1,
          title: String(title).trim() || `Event #${idx + 1}`,
          url: String(url).trim(),
          date: String(date).trim(),
          platform: String(url).includes("luma.com") ? "luma" : "external",
        });
      }

      // Look for attendee-like keys
      const name = row["Name"] || row["Attendee"] || row["Full Name"];
      const email = row["Email"] || row["E-mail"];
      if (email && String(email).includes("@")) {
        attendees.push({
          name: String(name || "Team Member").trim(),
          email: String(email).trim(),
          phone: String(row["Phone"] || "").trim(),
          company: String(row["Company"] || "OpenLedger").trim(),
          role: String(row["Role"] || "Core Contributor").trim(),
          telegram: String(row["Telegram ID"] || row["Telegram"] || "").trim(),
          twitter: String(row["Twitter ID"] || row["Twitter"] || "").trim(),
          linkedin: String(row["LinkedIn"] || "").trim(),
        });
      }
    });

    return {
      fileType: "spreadsheet",
      events,
      attendees,
      summary: `Parsed spreadsheet ${filename}: extracted ${events.length} events and ${attendees.length} attendees across sheet '${firstSheetName}'.`,
    };
  }

  // 2. CSV / TSV (.csv, .tsv)
  if (ext === "csv" || ext === "tsv") {
    const content = buffer.toString("utf-8");
    const parsed = Papa.parse<Record<string, any>>(content, {
      header: true,
      skipEmptyLines: true,
    });

    parsed.data.forEach((row, idx) => {
      const title = row["Event Name"] || row["Title"] || row["Event"] || row["title"] || "";
      const url = row["Event Link"] || row["Link"] || row["URL"] || row["url"] || "";
      const date = row["Date"] || row["date"] || "";

      if (url && String(url).startsWith("http")) {
        events.push({
          id: idx + 1,
          title: String(title).trim() || `Event #${idx + 1}`,
          url: String(url).trim(),
          date: String(date).trim(),
          platform: String(url).includes("luma.com") ? "luma" : "external",
        });
      }

      const email = row["Email"] || row["email"];
      if (email && String(email).includes("@")) {
        attendees.push({
          name: String(row["Name"] || "Team Member").trim(),
          email: String(email).trim(),
          phone: String(row["Phone"] || "").trim(),
          company: String(row["Company"] || "OpenLedger").trim(),
          role: String(row["Role"] || "Core Contributor").trim(),
          telegram: String(row["Telegram ID"] || row["Telegram"] || "").trim(),
          twitter: String(row["Twitter ID"] || row["Twitter"] || "").trim(),
        });
      }
    });

    return {
      fileType: "csv",
      events,
      attendees,
      summary: `Parsed CSV ${filename}: found ${events.length} events and ${attendees.length} attendees.`,
    };
  }

  // 3. Word Documents (.docx)
  if (ext === "docx") {
    const { value: text } = await mammoth.extractRawText({ buffer });
    // Extract any URLs found in the text
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];

    urls.forEach((u, i) => {
      if (u.includes("luma.com") || u.includes("eventbrite") || u.includes("tickets.")) {
        events.push({
          id: i + 1,
          title: `Document Event #${i + 1}`,
          url: u.replace(/[),;.]+$/, ""),
          platform: u.includes("luma.com") ? "luma" : "external",
        });
      }
    });

    return {
      fileType: "docx",
      rawText: text,
      events,
      attendees,
      summary: `Parsed Word Document ${filename}: extracted ${text.length} characters and ${events.length} event links.`,
    };
  }

  // 4. Markdown & Plain Text (.md, .txt)
  if (ext === "md" || ext === "txt") {
    const content = buffer.toString("utf-8");
    const lines = content.split("\n");

    lines.forEach((line, i) => {
      // Look for markdown links [Title](https://...)
      const mdLinkMatch = line.match(/\[(.*?)\]\((https?:\/\/.*?)\)/);
      if (mdLinkMatch) {
        events.push({
          id: events.length + 1,
          title: mdLinkMatch[1].trim(),
          url: mdLinkMatch[2].trim(),
          platform: mdLinkMatch[2].includes("luma.com") ? "luma" : "external",
        });
      } else {
        // Fallback bare URL
        const bareUrlMatch = line.match(/(https?:\/\/(?:luma\.com|eventbrite)[^\s]+)/);
        if (bareUrlMatch) {
          events.push({
            id: events.length + 1,
            title: `Markdown Event #${events.length + 1}`,
            url: bareUrlMatch[1].trim(),
            platform: "luma",
          });
        }
      }
    });

    return {
      fileType: "markdown",
      rawText: content,
      events,
      attendees,
      summary: `Parsed Markdown/Text ${filename}: extracted ${events.length} event links.`,
    };
  }

  return {
    fileType: "unknown",
    events: [],
    attendees: [],
    summary: `Unsupported file extension .${ext}`,
  };
}
