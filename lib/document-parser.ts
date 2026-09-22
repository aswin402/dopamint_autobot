import * as xlsx from "xlsx";
import Papa from "papaparse";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export interface ExtractedEvent {
  title: string;
  url: string;
  date?: string;
  category?: string;
  platform?: string;
  soldOut?: boolean;
  requireApproval?: boolean;
}

export interface ExtractedAttendee {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  telegram?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
  pitch?: string;
  wallets?: { evm?: string; solana?: string; [key: string]: any };
  country?: string;
}

export interface ParsedDocumentResult {
  rawText: string;
  rows?: Record<string, any>[];
  fileName: string;
  fileType: string;
}

/**
 * Universal text/document parser supporting .xlsx, .xls, .csv, .docx, .pdf, .md, .txt
 */
export async function parseDocumentBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParsedDocumentResult> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // 1. Excel Spreadsheets (.xlsx, .xls)
  if (ext === "xlsx" || ext === "xls") {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const allRows: Record<string, any>[] = [];
    const textPieces: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonRows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      allRows.push(...jsonRows);
      const csv = xlsx.utils.sheet_to_csv(sheet);
      textPieces.push(csv);
    }

    return {
      rawText: textPieces.join("\n\n"),
      rows: allRows,
      fileName,
      fileType: ext,
    };
  }

  // 2. CSV
  if (ext === "csv") {
    const text = buffer.toString("utf-8");
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return {
      rawText: text,
      rows: parsed.data || [],
      fileName,
      fileType: "csv",
    };
  }

  // 3. Word Document (.docx)
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return {
      rawText: result.value || "",
      fileName,
      fileType: "docx",
    };
  }

  // 4. PDF Document (.pdf)
  if (ext === "pdf") {
    try {
      const parser: any = new PDFParse({ data: buffer });
      const res = await parser.getText();
      const text = typeof res === "string" ? res : res?.text || "";
      return {
        rawText: text,
        fileName,
        fileType: "pdf",
      };
    } catch (e: any) {
      console.warn("PDF parse error, fallback to raw buffer string:", e.message);
      return {
        rawText: buffer.toString("utf-8"),
        fileName,
        fileType: "pdf",
      };
    }
  }

  // 5. Markdown (.md) & Text (.txt)
  return {
    rawText: buffer.toString("utf-8"),
    fileName,
    fileType: ext || "txt",
  };
}

/**
 * Fetch and parse a public Google Sheet as CSV
 */
export async function parseGoogleSheetUrl(url: string): Promise<ParsedDocumentResult> {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("Invalid Google Sheets URL. Could not extract spreadsheet ID.");
  }
  const sheetId = match[1];
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV (Status ${res.status}). Ensure the sheet is public or 'Anyone with link can view'.`);
  }
  const csvText = await res.text();
  const parsed = Papa.parse<Record<string, any>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return {
    rawText: csvText,
    rows: parsed.data || [],
    fileName: `google-sheet-${sheetId}.csv`,
    fileType: "google_sheet",
  };
}

/**
 * Extract Luma & Web3 Events from parsed document
 */
export function extractEventsFromDocument(
  doc: ParsedDocumentResult,
  defaultCategory: string = "General"
): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];
  const seenUrls = new Set<string>();

  const cleanLumaUrl = (raw: string) => {
    let u = raw.trim();
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
      u = `https://${u}`;
    }
    // Clean trailing slashes, tracking query params
    try {
      const parsed = new URL(u);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
    } catch {
      return u;
    }
  };

  const inferCategory = (title: string, url: string, explicitCat?: string): string => {
    if (explicitCat && explicitCat.trim()) return explicitCat.trim();
    const text = `${title} ${url}`.toLowerCase();
    if (text.includes("kbw") || text.includes("korea blockchain week") || text.includes("seoul")) {
      return "Korea Blockchain Week";
    }
    if (text.includes("eth") || text.includes("ethereum") || text.includes("vitalik") || text.includes("web3")) {
      return "ETH Seoul & Web3";
    }
    if (text.includes("ai") || text.includes("agent") || text.includes("hack") || text.includes("buidl")) {
      return "AI & Hackathons";
    }
    if (text.includes("vip") || text.includes("dinner") || text.includes("night") || text.includes("party") || text.includes("rooftop") || text.includes("afterparty")) {
      return "VIP & Side Events";
    }
    return defaultCategory || "General";
  };

  const titleFromSlug = (url: string): string => {
    const slug = url.split("/").pop() || "Event";
    return slug
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Path A: Check table rows if available (e.g. from Excel, CSV, Google Sheet)
  if (doc.rows && doc.rows.length > 0) {
    for (const row of doc.rows) {
      let foundUrl = "";
      let foundTitle = "";
      let foundDate = "";
      let foundCategory = "";

      for (const [key, rawVal] of Object.entries(row)) {
        const val = String(rawVal || "").trim();
        const lKey = key.toLowerCase();

        if (
          val.includes("lu.ma/") ||
          val.includes("luma.com/") ||
          lKey.includes("url") ||
          lKey.includes("link") ||
          lKey.includes("luma")
        ) {
          if (val.includes("lu.ma/") || val.includes("luma.com/")) {
            foundUrl = cleanLumaUrl(val);
          }
        }

        if (
          lKey.includes("title") ||
          lKey.includes("event") ||
          lKey.includes("name") ||
          lKey === "topic"
        ) {
          if (!val.startsWith("http")) foundTitle = val;
        }

        if (lKey.includes("date") || lKey.includes("time") || lKey.includes("schedule")) {
          foundDate = val;
        }

        if (lKey.includes("category") || lKey.includes("track") || lKey.includes("type") || lKey.includes("tag")) {
          foundCategory = val;
        }
      }

      if (foundUrl && !seenUrls.has(foundUrl)) {
        seenUrls.add(foundUrl);
        const title = foundTitle || titleFromSlug(foundUrl);
        events.push({
          title,
          url: foundUrl,
          date: foundDate || "",
          category: inferCategory(title, foundUrl, foundCategory),
          platform: "luma",
        });
      }
    }
  }

  // Path B: Regex match across rawText (handles Word docs, PDFs, Markdown, and text pastes)
  const lumaRegex = /(?:https?:\/\/)?(?:www\.)?(?:lu\.ma|luma\.com)\/[a-zA-Z0-9_\-]+/gi;
  const matches = doc.rawText.match(lumaRegex) || [];

  for (const rawMatch of matches) {
    const url = cleanLumaUrl(rawMatch);
    if (!seenUrls.has(url)) {
      seenUrls.add(url);

      // Attempt to extract title from nearby lines
      let title = "";
      let date = "";
      let category = "";

      const lines = doc.rawText.split(/\r?\n/);
      const lineIdx = lines.findIndex((l) => l.includes(rawMatch));

      if (lineIdx !== -1) {
        const currentLine = lines[lineIdx];
        // Check if markdown link format: [Title](url)
        const mdLinkMatch = currentLine.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (mdLinkMatch && mdLinkMatch[2].includes(rawMatch)) {
          title = mdLinkMatch[1].trim();
        } else {
          // Check line before or current line stripped of url
          const lineWithoutUrl = currentLine.replace(rawMatch, "").replace(/[()\[\]\-—|:]/g, " ").trim();
          if (lineWithoutUrl.length > 5) {
            title = lineWithoutUrl;
          } else if (lineIdx > 0 && lines[lineIdx - 1].trim().length > 3) {
            title = lines[lineIdx - 1].replace(/[#*>\-]/g, "").trim();
          }
        }

        // Look for date in current or adjacent lines
        for (let offset = -1; offset <= 2; offset++) {
          const l = lines[lineIdx + offset] || "";
          if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|202\d|\d{1,2}\/\d{1,2})\b/i.test(l)) {
            date = l.replace(/[#*>\-]/g, "").trim();
            break;
          }
        }
      }

      const finalTitle = title || titleFromSlug(url);
      events.push({
        title: finalTitle,
        url,
        date: date || "",
        category: inferCategory(finalTitle, url, category),
        platform: "luma",
      });
    }
  }

  return events;
}

/**
 * Extract Attendee & Team Roster profiles from parsed document
 */
export function extractAttendeesFromDocument(doc: ParsedDocumentResult): ExtractedAttendee[] {
  const attendees: ExtractedAttendee[] = [];
  const seenEmails = new Set<string>();

  // Helper to normalize phone
  const cleanPhone = (val: string) => {
    return val.replace(/[^\d+()-\s]/g, "").trim();
  };

  // Helper to extract Ethereum and Solana wallet addresses
  const extractWallets = (text: string) => {
    const wallets: Record<string, string> = {};
    const evmMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (evmMatch) wallets.evm = evmMatch[0];
    const solMatch = text.match(/\b[1-9A-HJ-NP-za-km-z]{32,44}\b/);
    if (solMatch && (!evmMatch || solMatch[0] !== evmMatch[0])) {
      wallets.solana = solMatch[0];
    }
    return Object.keys(wallets).length > 0 ? wallets : undefined;
  };

  // Path A: Check table rows if available
  if (doc.rows && doc.rows.length > 0) {
    for (const row of doc.rows) {
      let name = "";
      let email = "";
      let phone = "";
      let company = "";
      let role = "";
      let telegram = "";
      let twitter = "";
      let linkedin = "";
      let website = "";
      let pitch = "";
      let evmWallet = "";
      let solWallet = "";

      for (const [key, rawVal] of Object.entries(row)) {
        const val = String(rawVal || "").trim();
        const lKey = key.toLowerCase();

        if (lKey.includes("name") || lKey === "attendee" || lKey === "member" || lKey === "full name") {
          if (!name) name = val;
        } else if (lKey.includes("first") && !name) {
          name = val;
        } else if (lKey.includes("last") && name) {
          name = `${name} ${val}`.trim();
        }

        if (lKey.includes("email") || (val.includes("@") && val.includes("."))) {
          if (val.includes("@") && !email) email = val.toLowerCase();
        }

        if (lKey.includes("phone") || lKey.includes("mobile") || lKey.includes("tel")) {
          phone = cleanPhone(val);
        }

        if (lKey.includes("company") || lKey.includes("org") || lKey.includes("project")) {
          company = val;
        }

        if (lKey.includes("role") || lKey.includes("title") || lKey.includes("position") || lKey.includes("job")) {
          role = val;
        }

        if (lKey.includes("telegram") || lKey.includes("tg")) {
          telegram = val.startsWith("@") ? val : `@${val}`;
        }

        if (lKey.includes("twitter") || lKey.includes("x.com") || lKey === "x") {
          twitter = val.startsWith("@") ? val : `@${val}`;
        }

        if (lKey.includes("linkedin")) {
          linkedin = val;
        }

        if (lKey.includes("website") || lKey.includes("url") || lKey.includes("portfolio")) {
          if (!val.includes("lu.ma")) website = val;
        }

        if (lKey.includes("pitch") || lKey.includes("bio") || lKey.includes("about") || lKey.includes("description")) {
          pitch = val;
        }

        if (lKey.includes("evm") || lKey.includes("eth") || lKey.includes("wallet")) {
          if (val.startsWith("0x")) evmWallet = val;
        }
        if (lKey.includes("sol") || lKey.includes("solana")) {
          solWallet = val;
        }
      }

      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        const wallets: Record<string, string> = {};
        if (evmWallet) wallets.evm = evmWallet;
        if (solWallet) wallets.solana = solWallet;

        attendees.push({
          name: name || email.split("@")[0].replace(/[._-]/g, " "),
          email,
          phone: phone || undefined,
          company: company || "Independent",
          role: role || "Attendee",
          telegram: telegram || undefined,
          twitter: twitter || undefined,
          linkedin: linkedin || undefined,
          website: website || undefined,
          pitch: pitch || undefined,
          wallets: Object.keys(wallets).length > 0 ? wallets : undefined,
        });
      }
    }
  }

  // Path B: Regex match across rawText for text/markdown/pdf/doc
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = doc.rawText.match(emailRegex) || [];

  for (const rawEmail of emails) {
    const email = rawEmail.toLowerCase().trim();
    if (!seenEmails.has(email)) {
      seenEmails.add(email);

      // Search surrounding lines for details
      const lines = doc.rawText.split(/\r?\n/);
      const emailLineIdx = lines.findIndex((l) => l.toLowerCase().includes(email));

      let name = "";
      let phone = "";
      let company = "";
      let role = "";
      let tg = "";
      let tw = "";
      let web = "";

      const start = Math.max(0, emailLineIdx - 5);
      const end = Math.min(lines.length - 1, emailLineIdx + 8);

      for (let i = start; i <= end; i++) {
        const line = lines[i].trim();
        const lLine = line.toLowerCase();

        if (lLine.startsWith("name:") || lLine.startsWith("attendee:")) {
          name = line.split(":")[1]?.trim() || "";
        }
        if (lLine.startsWith("company:") || lLine.startsWith("organization:")) {
          company = line.split(":")[1]?.trim() || "";
        }
        if (lLine.startsWith("role:") || lLine.startsWith("title:")) {
          role = line.split(":")[1]?.trim() || "";
        }
        if (lLine.startsWith("phone:") || lLine.startsWith("tel:")) {
          phone = cleanPhone(line.split(":")[1]?.trim() || "");
        }
        if (lLine.startsWith("telegram:") || lLine.startsWith("tg:")) {
          const t = line.split(":")[1]?.trim() || "";
          tg = t.startsWith("@") ? t : `@${t}`;
        }
        if (lLine.startsWith("twitter:") || lLine.startsWith("x:")) {
          const t = line.split(":")[1]?.trim() || "";
          tw = t.startsWith("@") ? t : `@${t}`;
        }
        if (lLine.startsWith("website:") || lLine.startsWith("site:")) {
          web = line.split(":")[1]?.trim() || "";
        }
      }

      const wallets = extractWallets(lines.slice(start, end + 1).join(" "));

      attendees.push({
        name: name || email.split("@")[0].replace(/[._-]/g, " "),
        email,
        phone: phone || undefined,
        company: company || "Independent",
        role: role || "Attendee",
        telegram: tg || undefined,
        twitter: tw || undefined,
        website: web || undefined,
        wallets,
      });
    }
  }

  return attendees;
}
