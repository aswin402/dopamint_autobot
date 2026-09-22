import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");
const cookieDb = path.join(ffDir, "cookies.sqlite");

console.log("Checking Firefox cookies at:", cookieDb);

if (fs.existsSync(cookieDb)) {
  // Copy to temp to avoid lock
  const tempDb = path.join(process.cwd(), "temp-cookies.sqlite");
  fs.copyFileSync(cookieDb, tempDb);

  const db = new Database(tempDb, { readonly: true });
  const rows = db.prepare("SELECT host, name, value, path, expiry, isSecure, isHttpOnly FROM moz_cookies WHERE host LIKE '%luma%' OR host LIKE '%lu.ma%'").all();
  console.log(`Found ${rows.length} Luma cookies in Firefox!`);
  for (const r of rows) {
    console.log(`- Host: ${r.host} | Name: ${r.name} | Value: ${r.value ? r.value.slice(0, 35) + '...' : '(empty)'}`);
  }

  db.close();
  fs.unlinkSync(tempDb);
} else {
  console.log("Firefox cookies.sqlite not found.");
}
