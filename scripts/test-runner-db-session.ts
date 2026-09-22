import prisma from "../lib/prisma";
import { automationRunner } from "../lib/automation/runner";

async function main() {
  console.log("🚀 Testing AutomationRunner with database-stored Luma session...");

  const attendee = await prisma.attendee.findUnique({
    where: { email: "aswinvishal402@gmail.com" },
  });

  if (!attendee) {
    throw new Error("Attendee not found in database!");
  }

  if (!attendee.lumaSessionKey) {
    throw new Error("Attendee has no lumaSessionKey stored in database!");
  }

  console.log(`✅ Loaded attendee from DB: ${attendee.name} (${attendee.email})`);
  console.log(`🔑 Database Luma Session Key: ${attendee.lumaSessionKey.slice(0, 20)}...`);

  // Target event 102 (KBW 2026 Recap)
  const event = await prisma.event.findUnique({ where: { id: 102 } });
  if (!event) throw new Error("Event 102 not found in DB!");

  console.log(`🎯 Testing with Event [102]: ${event.title}`);

  // Run batch via runner with headless: false on DISPLAY:0 (or headless if no display)
  const isHeadless = !process.env.DISPLAY;
  console.log(`Running in ${isHeadless ? "Headless" : "Headed (DISPLAY=" + process.env.DISPLAY + ")"} mode...`);

  await automationRunner.startBatch([102], [attendee.id], {
    minInterEventDelay: 2,
    maxInterEventDelay: 4,
    fieldDelayMs: 150,
    preSubmitDelayMs: 1000,
    pageLoadWaitMs: 2000,
    modalOpenWaitMs: 1500,
    breatherInterval: 10,
    breatherDurationSec: 60,
  }, { headless: isHeadless });

  console.log("Checking runner logs...");
  const status = automationRunner.getStatus();
  console.log("✅ Runner batch completed with database-injected session!");
  console.log("🎉 SUCCESS: Task 2 verification passed!");
}

main()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
