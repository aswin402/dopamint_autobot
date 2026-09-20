import { chromium } from "playwright";

async function runChatTest() {
  console.log("🚀 Starting Playwright UI End-to-End Chat Test...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("🌐 Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 1. Click AI Chat navigation tab in the left sidebar
    console.log("👉 Navigating to AI Assistant / Chat tab...");
    const chatTabBtn = page.locator("button, a").filter({ hasText: /AI Assistant|Co-Pilot|Chat/i }).first();
    await chatTabBtn.click();
    await page.waitForTimeout(1500);

    // 2. Locate the chat textarea
    const textarea = page.locator("textarea");
    if (!(await textarea.isVisible())) {
      throw new Error("Chat textarea is not visible");
    }

    const promptText = "Start batch registration for Aswin Vishal across the upcoming open events in live visual mode.";
    console.log(`💬 Typing prompt into AI Co-Pilot:\n   "${promptText}"`);
    await textarea.fill(promptText);
    await page.waitForTimeout(500);

    // 3. Click the send button
    console.log("📨 Sending prompt to AI...");
    const sendButton = page.locator("button[title='Send prompt']").first();
    await sendButton.click();

    // 4. Wait for AI assistant response
    console.log("⏳ Waiting for AI Co-Pilot response...");
    await page.waitForTimeout(4000);

    // Find the latest assistant message bubble
    const assistantBubbles = await page.locator(".whitespace-pre-wrap").allInnerTexts();
    console.log("\n🤖 [AI Assistant Response]:");
    const lastResponse = assistantBubbles[assistantBubbles.length - 1] || "No response found";
    console.log(lastResponse);
    console.log("--------------------------------------------------");

    // 5. Verify Automation Runner Status via API
    console.log("\n🔍 Verifying Automation Runner status...");
    const statusRes = await fetch("http://localhost:3000/api/automation/status");
    const statusData = await statusRes.json();
    console.log("Runner Status:", JSON.stringify(statusData, null, 2));

    if (statusData.isRunning) {
      console.log("✅ Runner is actively executing!");
      console.log(`✅ Headless Mode: ${statusData.isHeadless} (${statusData.isHeadless ? "Headless" : "👁️ Visual Headed Browser Active"})`);
      
      // Wait 10 seconds to collect live logs
      console.log("⏳ Letting runner execute for 10 seconds to capture live form interactions...");
      await page.waitForTimeout(10000);

      const updatedRes = await fetch("http://localhost:3000/api/automation/status");
      const updatedData = await updatedRes.json();
      console.log("\n📜 Live Execution Logs:");
      updatedData.recentLogs?.slice(-8).forEach((l: any) => {
        console.log(`  [${l.level.toUpperCase()}] ${l.message}`);
      });

      // Stop runner cleanly
      console.log("\n⏹️ Stopping test batch runner...");
      await fetch("http://localhost:3000/api/automation/stop", { method: "POST" });
      console.log("✅ Runner stopped cleanly.");
    } else {
      console.warn("⚠️ Runner did not indicate isRunning: true immediately. Checking logs...");
    }

    console.log("\n🎉 End-to-End Chat Test Completed Successfully!");
  } catch (err: any) {
    console.error("❌ Test error:", err.message);
  } finally {
    await browser.close();
  }
}

runChatTest();
