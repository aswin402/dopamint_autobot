import * as XLSX from "xlsx";
import Papa from "papaparse";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExcel(
  filename: string,
  sheets: { name: string; data: Record<string, any>[] }[]
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.data);
    XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function downloadCSV(filename: string, data: Record<string, any>[]) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

export function downloadMarkdown(
  filename: string,
  title: string,
  data: Record<string, any>[]
) {
  let md = `# ${title}\n\n*Generated on ${new Date().toLocaleString()} by Dopamint AutoBot*\n\n`;
  if (!data || data.length === 0) {
    md += "_No records found._\n";
  } else {
    const headers = Object.keys(data[0]);
    md += `| ${headers.join(" | ")} |\n`;
    md += `| ${headers.map(() => "---").join(" | ")} |\n`;
    data.forEach((row) => {
      md += `| ${headers
        .map((h) => String(row[h] ?? "").replace(/\|/g, "\\|"))
        .join(" | ")} |\n`;
    });
    md += `\n**Total Rows:** ${data.length}\n`;
  }
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
  triggerDownload(blob, `${filename}.md`);
}

export function downloadJSON(filename: string, data: any) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  triggerDownload(blob, `${filename}.json`);
}

export function printOrSavePDF(title: string, data: Record<string, any>[]) {
  if (!data || data.length === 0) {
    alert("No data available to export as PDF/Printable document.");
    return;
  }

  const headers = Object.keys(data[0]);
  const rowsHtml = data
    .map(
      (row) =>
        `<tr>${headers
          .map((h) => `<td>${escapeHtml(String(row[h] ?? ""))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to open the printable PDF preview.");
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - Dopamint AutoBot Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 24px;
      color: #1a1a1a;
      background: #ffffff;
    }
    .header {
      border-bottom: 2px solid #485442;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      color: #485442;
    }
    .sub {
      font-size: 11px;
      color: #666;
    }
    h1 {
      font-size: 18px;
      margin: 4px 0 0 0;
      color: #111;
    }
    .meta {
      font-size: 11px;
      color: #777;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 12px;
    }
    th, td {
      border: 1px solid #e2e4e0;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background-color: #f6f7f5;
      font-weight: 600;
      color: #333;
    }
    tr:nth-child(even) {
      background-color: #fafbfa;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #eee;
      font-size: 10px;
      color: #888;
      display: flex;
      justify-content: space-between;
    }
    .no-print {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
    }
    .btn {
      background: #485442;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-secondary {
      background: #eee;
      color: #333;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        margin: 0;
        padding: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
  </div>
  <div class="header">
    <div>
      <div class="brand">DOPAMINT AUTOBOT</div>
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="sub">
      Exported: ${new Date().toLocaleString()}<br>
      Total Items: ${data.length}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    <span>Autonomous Event Form Registration Engine</span>
    <span>Page 1</span>
  </div>
  <script>
    window.onload = function() {
      // Auto-prompt print if query param specifies
      if (window.location.search.includes("autoprint=true")) {
        window.print();
      }
    };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
