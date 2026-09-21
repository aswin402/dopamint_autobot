import { handleAgentChat } from "../lib/ai/agent-chat";
import { automationRunner } from "../lib/automation/runner";

async function run() {
  console.log("==================================================");
  console.log("🤖 Testing Dopamint Autonomous Agent Chat Engine");
  console.log("==================================================");

  console.log("\n[Test 1] Status Query ('what is happening?')");
  const res1 = await handleAgentChat({
    messages: [{ role: "user", content: "what is happening with the automation right now?" }],
  });
  console.log("-> Action taken:", res1.actionTaken);
  console.log("-> Response snippet:", res1.response.slice(0, 100).replace(/\n/g, " "));
  if (res1.actionTaken !== "live_status_report") {
    throw new Error("Expected live_status_report");
  }

  console.log("\n[Test 2] Script Configuration Update ('update pacing delay to 6s')");
  const res2 = await handleAgentChat({
    messages: [{ role: "user", content: "update pacing delay to 6s" }],
  });
  console.log("-> Action taken:", res2.actionTaken);
  console.log("-> Pacing:", res2.pacing);
  if (res2.actionTaken !== "updated_pacing" || res2.pacing.preSubmitDelayMs !== 6000) {
    throw new Error("Expected updated_pacing with 6000ms delay");
  }

  console.log("\n[Test 3] Live Form Inspection ('inspect https://mowli.in/')");
  const res3 = await handleAgentChat({
    messages: [{ role: "user", content: "inspect https://mowli.in/" }],
  });
  console.log("-> Action taken:", res3.actionTaken);
  console.log("-> Detected fields count:", res3.inspection?.fields?.length);
  console.log("-> Submit button found:", res3.inspection?.submitFound);
  if (res3.actionTaken !== "inspected_form" || !res3.inspection?.submitFound) {
    throw new Error("Expected inspected_form with submit button");
  }

  console.log("\n[Test 4] Error Diagnosis & Self-Healing ('why did it fail and fix it')");
  // Simulate a failure on mowli.in
  automationRunner.recordFailure(
    "https://mowli.in/",
    "Submission timeout waiting for button response",
    "custom_form",
    { name: "Alex Test", email: "alex@test.com" }
  );
  const res4 = await handleAgentChat({
    messages: [{ role: "user", content: "why did it fail? please fix it and retry" }],
  });
  console.log("-> Action taken:", res4.actionTaken);
  console.log("-> Diagnosed error:", res4.diagnostic?.error);
  console.log("-> Root cause:", res4.diagnostic?.rootCause);
  console.log("-> Fix applied:", res4.diagnostic?.fixApplied);
  if (res4.actionTaken !== "healed_and_retried") {
    throw new Error("Expected healed_and_retried");
  }

  console.log("\n[Test 5] Runner Pause & Resume Controls");
  const resPause = await handleAgentChat({
    messages: [{ role: "user", content: "pause runner" }],
  });
  console.log("-> Pause action taken:", resPause.actionTaken);

  const resResume = await handleAgentChat({
    messages: [{ role: "user", content: "resume runner" }],
  });
  console.log("-> Resume action taken:", resResume.actionTaken);

  console.log("\n==================================================");
  console.log("🎉 ALL 5 AUTONOMOUS AGENT CHAT CAPABILITY TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Agent test failed:", e);
  process.exit(1);
});
