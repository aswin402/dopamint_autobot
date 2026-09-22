import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function checkLogin() {
  console.log("Checking login state in .browser-profile...");
  const profileDir = path.resolve(process.cwd(), ".browser-profile");
  
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  await page.goto("https://luma.com/home", { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(3000);

  const cookies = await context.cookies("https://luma.com");
  console.log(`Total Luma cookies in .browser-profile: ${cookies.length}`);
  const authCookies = cookies.filter(c => /auth|token|session|user/i.test(c.name));
  console.log("Auth-like cookies:", authCookies.map(c => ({ name: c.name, domain: c.domain, expires: c.expires })));

  const bodyText = await page.locator("body").innerText();
  const hasSignIn = /Sign In/i.test(bodyText);
  const title = await page.title();
  console.log(`Page Title: ${title}`);
  console.log(`Has "Sign In" button: ${hasSignIn}`);

  // Also check if user profile or avatar is present
  const userAvatar = await page.locator("img[alt*='avatar'], img[alt*='profile'], [aria-label*='account'], [aria-label*='profile']").count();
  console.log(`User avatar/profile elements found: ${userAvatar}`);

  await context.close();
}

checkLogin().catch(console.error);
