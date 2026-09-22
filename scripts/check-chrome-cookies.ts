import fs from "fs";
import path from "path";

// Check if any chrome cookie file mentions luma
const chromeCookiePath = path.resolve(process.env.HOME || "", ".config/google-chrome/Default/Network/Cookies");
if (fs.existsSync(chromeCookiePath)) {
  const content = fs.readFileSync(chromeCookiePath);
  const hasLuma = content.includes(Buffer.from("luma.com")) || content.includes(Buffer.from("lu.ma"));
  console.log(`Google Chrome Default profile exists. Contains luma.com string: ${hasLuma}`);
} else {
  console.log("No Google Chrome cookie file found.");
}
