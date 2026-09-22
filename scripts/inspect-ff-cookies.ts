import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");
const cookieDb = path.join(ffDir, "cookies.sqlite");
const tempDb = path.join(process.cwd(), "temp-ff-cookies-inspect.sqlite");
fs.copyFileSync(cookieDb, tempDb);

const db = new Database(tempDb, { readonly: true });
const rows: any[] = db.prepare("SELECT host, name, value, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies WHERE host LIKE '%luma%' OR host LIKE '%lu.ma%'").all();
db.close();
fs.unlinkSync(tempDb);

console.log("Firefox Luma Cookies:", JSON.stringify(rows, null, 2));
