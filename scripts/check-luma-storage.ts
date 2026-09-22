import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");

// Check storage folders
const storageDir = path.join(ffDir, "storage/default");
if (fs.existsSync(storageDir)) {
  const folders = fs.readdirSync(storageDir).filter(f => f.includes("luma") || f.includes("lu.ma"));
  console.log("Matching storage folders:", folders);

  for (const f of folders) {
    const lsFile = path.join(storageDir, f, "ls/data.sqlite");
    if (fs.existsSync(lsFile)) {
      console.log(`Reading localStorage from ${lsFile}...`);
      const temp = path.join(process.cwd(), "temp-ls.sqlite");
      fs.copyFileSync(lsFile, temp);
      const db = new Database(temp, { readonly: true });
      const rows = db.prepare("SELECT key, utf16_length, conversion_type FROM data").all();
      console.log(`Keys in ${f}:`, rows.map((r: any) => r.key));
      db.close();
      fs.unlinkSync(temp);
    }
  }
} else {
  console.log("No storage/default directory found.");
}
