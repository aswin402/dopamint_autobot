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
  fileType: "spreadsheet" | "csv" | "docx" | "markdown" | "pdf" | "unknown";
  rawText?: string;
  events: ExtractedEvent[];
  attendees: ExtractedAttendee[];
  summary: string;
}

/**
 * Universal Multi-Format Document Ingestion Engine
 * Ingests .xlsx, .xls, .csv, .docx, .md, .pdf, and raw text
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const events: ExtractedEvent[] = [];
  const attendees: ExtractedAttendee[] = [];

  // Helper for unique URL tracking
  const seenUrls = new Set<string>();
  const addEventUrl = (rawUrl: string, title?: string) => {
    const clean = rawUrl.replace(/[),;.'"]+$/, "").trim();
    if (clean.startsWith("http") && !seenUrls.has(clean)) {
      seenUrls.add(clean);
      events.push({
        id: events.length + 1,
        title: title || `Target Form #${events.length + 1}`,
        url: clean,
        platform: clean.includes("luma.com")
          ? "luma"
          : clean.includes("google.com/forms")
          ? "google_forms"
          : "web_form",
      });
    }
  };

function getRowValue(row: Record<string, any>, possibleKeys: string[]): string {
  const rowKeys = Object.keys(row);
  for (const pk of possibleKeys) {
    const foundKey = rowKeys.find((k) => k.trim().toLowerCase() === pk.toLowerCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const val = String(row[foundKey]).trim();
      if (val) return val;
    }
  }
  return "";
}

  // 1. Spreadsheets (.xlsx, .xls)
  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    rows.forEach((row, idx) => {
      const title = getRowValue(row, ["event name", "title", "event", "name", "form", "target"]);
      let url = getRowValue(row, ["target url", "form link", "event link", "link", "url", "form url", "website", "form", "target"]);
      if (!url) {
        for (const val of Object.values(row)) {
          if (val && typeof val === "string" && val.trim().startsWith("http")) {
            url = val.trim();
            break;
          }
        }
      }
      if (url && url.startsWith("http")) {
        addEventUrl(url, title || `Form #${events.length + 1}`);
      }

      const email = getRowValue(row, ["email", "e-mail", "mail", "contact email"]);
      if (email && email.includes("@")) {
        const name = getRowValue(row, ["name", "full name", "attendee", "person", "first name", "user"]) || email.split("@")[0].replace(/[._-]/g, " ");
        const phone = getRowValue(row, ["phone", "mobile", "number", "tel", "cell", "contact"]);
        const company = getRowValue(row, ["company", "organization", "org", "firm", "business"]);
        const role = getRowValue(row, ["role", "title", "designation", "position"]);
        const pitch = getRowValue(row, ["message", "notes", "pitch", "inquiry", "query", "bio", "comment"]);
        const telegram = getRowValue(row, ["telegram id", "telegram", "tg"]);
        const twitter = getRowValue(row, ["twitter id", "twitter", "x"]);
        const linkedin = getRowValue(row, ["linkedin", "linkedin url"]);

        attendees.push({
          name,
          email,
          phone: phone || undefined,
          company: company || "Celestialabs",
          role: role || "Member",
          pitch: pitch || undefined,
          telegram: telegram || undefined,
          twitter: twitter || undefined,
          linkedin: linkedin || undefined,
        });
      }
    });

    return {
      fileType: "spreadsheet",
      events,
      attendees,
      summary: `Parsed spreadsheet ${filename}: extracted ${events.length} target URLs and ${attendees.length} people records across sheet '${firstSheetName}'.`,
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
      const title = getRowValue(row, ["event name", "title", "event", "name", "form", "target"]);
      let url = getRowValue(row, ["target url", "form link", "event link", "link", "url", "form url", "website", "form", "target"]);
      if (!url) {
        for (const val of Object.values(row)) {
          if (val && typeof val === "string" && val.trim().startsWith("http")) {
            url = val.trim();
            break;
          }
        }
      }
      if (url && url.startsWith("http")) {
        addEventUrl(url, title || `Form #${events.length + 1}`);
      }

      const email = getRowValue(row, ["email", "e-mail", "mail", "contact email"]);
      if (email && email.includes("@")) {
        const name = getRowValue(row, ["name", "full name", "attendee", "person", "first name", "user"]) || email.split("@")[0].replace(/[._-]/g, " ");
        const phone = getRowValue(row, ["phone", "mobile", "number", "tel", "cell", "contact"]);
        const company = getRowValue(row, ["company", "organization", "org", "firm", "business"]);
        const role = getRowValue(row, ["role", "title", "designation", "position"]);
        const pitch = getRowValue(row, ["message", "notes", "pitch", "inquiry", "query", "bio", "comment"]);
        const telegram = getRowValue(row, ["telegram id", "telegram", "tg"]);
        const twitter = getRowValue(row, ["twitter id", "twitter", "x"]);
        const linkedin = getRowValue(row, ["linkedin", "linkedin url"]);

        attendees.push({
          name,
          email,
          phone: phone || undefined,
          company: company || "Celestialabs",
          role: role || "Member",
          pitch: pitch || undefined,
          telegram: telegram || undefined,
          twitter: twitter || undefined,
          linkedin: linkedin || undefined,
        });
      }
    });

    return {
      fileType: "csv",
      events,
      attendees,
      summary: `Parsed CSV ${filename}: found ${events.length} target URLs and ${attendees.length} people records.`,
    };
  }

function extractAttendeesFromText(text: string): ExtractedAttendee[] {
  const attendees: ExtractedAttendee[] = [];
  const seenEmails = new Set<string>();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      const email = emailMatch[1].trim();
      const emailLower = email.toLowerCase();
      if (seenEmails.has(emailLower)) continue;
      seenEmails.add(emailLower);

      // Phone regex
      const phoneMatch = line.match(
        /(?:phone|tel|mobile|cell|contact)?\s*[:=]?\s*(\+?\d{1,3}[-.\s]?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}|\b\d{10}\b)/i
      );
      const phone = phoneMatch ? phoneMatch[1].trim() : undefined;

      // Name extraction
      let name = "";
      const namePrefixMatch = line.match(
        /(?:name|full\s*name|attendee|person|contact)\s*[:=]\s*([a-zA-Z\s.-]+?)(?:,|;|\n|\.|\bemail\b|\bphone\b|$)/i
      );
      if (namePrefixMatch && namePrefixMatch[1].trim()) {
        name = namePrefixMatch[1].trim();
      } else {
        const tokens = line.split(/[,;\t|]/).map((t) => t.trim());
        for (const token of tokens) {
          if (
            token &&
            !token.includes("@") &&
            !token.startsWith("http") &&
            !/\d{5,}/.test(token) &&
            token.length >= 2 &&
            token.length <= 40
          ) {
            name = token;
            break;
          }
        }
      }
      if (!name) {
        name = email.split("@")[0].replace(/[._-]/g, " ");
      }

      // Message / Notes / Pitch extraction
      let pitch = "";
      const msgMatch = line.match(
        /(?:message|msg|notes|note|pitch|inquiry|query)\s*[:=]\s*["']?([^"';]+)["']?/i
      );
      if (msgMatch && msgMatch[1].trim()) {
        pitch = msgMatch[1].trim();
      }

      // Company extraction
      let company = "Celestialabs";
      const compMatch = line.match(/(?:company|org|organization|firm)\s*[:=]\s*([a-zA-Z0-9\s.-]+?)(?:,|;|\n|$)/i);
      if (compMatch && compMatch[1].trim()) {
        company = compMatch[1].trim();
      }

      // Role extraction
      let role = "Member";
      const roleMatch = line.match(/(?:role|title|position)\s*[:=]\s*([a-zA-Z0-9\s.-]+?)(?:,|;|\n|$)/i);
      if (roleMatch && roleMatch[1].trim()) {
        role = roleMatch[1].trim();
      }

      attendees.push({
        name,
        email,
        phone,
        company,
        role,
        pitch: pitch || undefined,
      });
    }
  }

  // Fallback for isolated emails if line scanning missed any
  const fallbackEmails = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || [];
  for (const em of fallbackEmails) {
    const emLower = em.toLowerCase();
    if (!seenEmails.has(emLower)) {
      seenEmails.add(emLower);
      attendees.push({
        name: em.split("@")[0].replace(/[._-]/g, " "),
        email: em,
        company: "Celestialabs",
        role: "Member",
      });
    }
  }

  return attendees;
}

  // 3. Word Documents (.docx)
  if (ext === "docx") {
    const { value: text } = await mammoth.extractRawText({ buffer });

    // Extract any URLs found in the text
    const urlRegex = /(https?:\/\/[^\s"'<>\)\]]+)/g;
    const urls = text.match(urlRegex) || [];
    urls.forEach((u, i) => addEventUrl(u, `Document Target #${i + 1}`));

    const attendees = extractAttendeesFromText(text);

    return {
      fileType: "docx",
      rawText: text,
      events,
      attendees,
      summary: `Parsed Word Document ${filename}: extracted ${events.length} target URLs and ${attendees.length} contact records.`,
    };
  }

  // 4. Markdown & Plain Text (.md, .txt)
  if (ext === "md" || ext === "txt") {
    const content = buffer.toString("utf-8");
    const lines = content.split("\n");

    lines.forEach((line) => {
      const mdLinkMatch = line.match(/\[(.*?)\]\((https?:\/\/.*?)\)/);
      if (mdLinkMatch) {
        addEventUrl(mdLinkMatch[2], mdLinkMatch[1]);
      } else {
        const bareUrlMatch = line.match(/(https?:\/\/[^\s"'<>\)\]]+)/);
        if (bareUrlMatch) {
          addEventUrl(bareUrlMatch[1]);
        }
      }
    });

    const attendees = extractAttendeesFromText(content);

    return {
      fileType: "markdown",
      rawText: content,
      events,
      attendees,
      summary: `Parsed Markdown/Text ${filename}: extracted ${events.length} target URLs and ${attendees.length} contact records.`,
    };
  }

  // 5. PDF Documents (.pdf)
  if (ext === "pdf") {
    let pdfText = "";
    try {
      const { PDFParse } = require("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const res = await parser.getText();
      pdfText = res.text || "";
      await parser.destroy();
    } catch {
      pdfText = buffer.toString("latin1");
    }

    // Extract all URLs
    const urlRegex = /(https?:\/\/[^\s"'<>\)\]]+)/g;
    const urls = pdfText.match(urlRegex) || [];
    urls.forEach((u, i) => addEventUrl(u, `PDF Target #${i + 1}`));

    const attendees = extractAttendeesFromText(pdfText);

    return {
      fileType: "pdf",
      rawText: pdfText,
      events,
      attendees,
      summary: `Parsed PDF Document ${filename}: extracted ${events.length} target URLs and ${attendees.length} contact records.`,
    };
  }

  return {
    fileType: "unknown",
    events: [],
    attendees: [],
    summary: `Unsupported file extension .${ext}`,
  };
}
