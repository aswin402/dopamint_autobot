import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface CheckResult {
  category: string;
  name: string;
  passed: boolean;
  details: string;
}

async function runCloudReadinessVerification() {
  console.log("==================================================");
  console.log("🔍 DOPAMINT AUTOBOT: CLOUD & RENDER READINESS AUDIT");
  console.log("==================================================\n");

  const results: CheckResult[] = [];

  // 1. Prisma Schemas
  try {
    execSync("npx prisma validate --schema=prisma/schema.prisma", { stdio: "pipe" });
    results.push({
      category: "Database",
      name: "SQLite Schema (prisma/schema.prisma)",
      passed: true,
      details: "Valid Prisma schema syntax with lumaSessionKey and proxyUrl.",
    });
  } catch (err: any) {
    results.push({
      category: "Database",
      name: "SQLite Schema",
      passed: false,
      details: err.message,
    });
  }

  try {
    execSync("npx prisma validate --schema=prisma/schema.postgresql.prisma", { stdio: "pipe" });
    results.push({
      category: "Database",
      name: "PostgreSQL Schema (prisma/schema.postgresql.prisma)",
      passed: true,
      details: "Valid PostgreSQL schema syntax ready for Render managed DB.",
    });
  } catch (err: any) {
    results.push({
      category: "Database",
      name: "PostgreSQL Schema",
      passed: false,
      details: err.message,
    });
  }

  // 2. Database Connectivity & Attendee Session
  try {
    const attendee = await prisma.attendee.findFirst({
      where: { email: "aswinvishal402@gmail.com" },
    });

    if (attendee && attendee.lumaSessionKey) {
      results.push({
        category: "Auth & Session",
        name: "Luma Session Key Persistence",
        passed: true,
        details: `Attendee '${attendee.name}' has active session key (${attendee.lumaSessionKey.slice(0, 16)}...).`,
      });
    } else {
      results.push({
        category: "Auth & Session",
        name: "Luma Session Key Persistence",
        passed: false,
        details: "No attendee found with an active lumaSessionKey.",
      });
    }
  } catch (err: any) {
    results.push({
      category: "Auth & Session",
      name: "Database Query",
      passed: false,
      details: err.message,
    });
  }

  // 3. Dockerfile & Container Architecture
  const dockerfilePath = path.join(process.cwd(), "Dockerfile");
  const entrypointPath = path.join(process.cwd(), "docker-entrypoint.sh");
  const renderYamlPath = path.join(process.cwd(), "render.yaml");

  if (fs.existsSync(dockerfilePath)) {
    const dockerfileContent = fs.readFileSync(dockerfilePath, "utf-8");
    const hasXvfb = dockerfileContent.includes("xvfb");
    const hasPlaywright = dockerfileContent.includes("playwright install");
    const hasEntrypoint = dockerfileContent.includes("ENTRYPOINT");

    results.push({
      category: "Container",
      name: "Dockerfile Specifications",
      passed: hasXvfb && hasPlaywright && hasEntrypoint,
      details: `xvfb: ${hasXvfb ? "YES" : "NO"}, Playwright Chromium: ${hasPlaywright ? "YES" : "NO"}, Entrypoint: ${hasEntrypoint ? "YES" : "NO"}.`,
    });
  } else {
    results.push({
      category: "Container",
      name: "Dockerfile",
      passed: false,
      details: "Dockerfile not found.",
    });
  }

  if (fs.existsSync(entrypointPath)) {
    const entrypointContent = fs.readFileSync(entrypointPath, "utf-8");
    const hasXvfbStart = entrypointContent.includes("Xvfb :99");
    const hasDbPush = entrypointContent.includes("prisma db push");

    results.push({
      category: "Container",
      name: "docker-entrypoint.sh",
      passed: hasXvfbStart && hasDbPush,
      details: `Virtual display startup: ${hasXvfbStart ? "YES" : "NO"}, Auto DB sync: ${hasDbPush ? "YES" : "NO"}.`,
    });
  } else {
    results.push({
      category: "Container",
      name: "docker-entrypoint.sh",
      passed: false,
      details: "docker-entrypoint.sh not found.",
    });
  }

  if (fs.existsSync(renderYamlPath)) {
    const renderYamlContent = fs.readFileSync(renderYamlPath, "utf-8");
    const hasService = renderYamlContent.includes("dopamint-automation-backend");
    const hasPostgres = renderYamlContent.includes("dopamint-postgres");

    results.push({
      category: "Deployment",
      name: "render.yaml Blueprint",
      passed: hasService && hasPostgres,
      details: `Backend Web Service: ${hasService ? "YES" : "NO"}, Managed PostgreSQL: ${hasPostgres ? "YES" : "NO"}.`,
    });
  } else {
    results.push({
      category: "Deployment",
      name: "render.yaml Blueprint",
      passed: false,
      details: "render.yaml not found.",
    });
  }

  // 4. Live Backend / Frontend Health
  try {
    const backendRes = await fetch("http://localhost:4000/api/attendees");
    results.push({
      category: "Services",
      name: "Hono Backend API (:4000)",
      passed: backendRes.ok,
      details: `HTTP Status: ${backendRes.status} ${backendRes.statusText}`,
    });
  } catch (err: any) {
    results.push({
      category: "Services",
      name: "Hono Backend API (:4000)",
      passed: false,
      details: `Could not reach backend: ${err.message}`,
    });
  }

  try {
    const frontendRes = await fetch("http://localhost:3000");
    results.push({
      category: "Services",
      name: "Next.js Frontend (:3000)",
      passed: frontendRes.ok,
      details: `HTTP Status: ${frontendRes.status} ${frontendRes.statusText}`,
    });
  } catch (err: any) {
    results.push({
      category: "Services",
      name: "Next.js Frontend (:3000)",
      passed: false,
      details: `Could not reach frontend: ${err.message}`,
    });
  }

  // Print results
  console.log("--------------------------------------------------");
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✅ PASS" : "❌ FAIL";
    if (!r.passed) allPassed = false;
    console.log(`${icon} [${r.category}] ${r.name}`);
    console.log(`       ↳ ${r.details}`);
  }
  console.log("--------------------------------------------------\n");

  if (allPassed) {
    console.log("🎉 ALL CHECKS PASSED: The codebase is 100% cloud-ready for Render deployment!");
  } else {
    console.log("⚠️ Some checks failed. Please review the failed items above.");
  }

  await prisma.$disconnect();
}

runCloudReadinessVerification().catch((e) => {
  console.error("Verification error:", e);
  process.exit(1);
});
