import { prisma } from "../lib/prisma";

async function cleanDatabase() {
  console.log("🧹 Purging all mock data and seeded records from database...");

  const delRegs = await prisma.registration.deleteMany();
  const delEvents = await prisma.event.deleteMany();
  const delAttendees = await prisma.attendee.deleteMany();

  console.log(`✅ Deleted ${delRegs.count} mock registrations.`);
  console.log(`✅ Deleted ${delEvents.count} mock events.`);
  console.log(`✅ Deleted ${delAttendees.count} mock attendees.`);

  // Ensure default clean sheet configuration exists
  await prisma.sheetConfig.upsert({
    where: { id: "default-sheet-config" },
    update: {},
    create: {
      id: "default-sheet-config",
      name: "Primary Registration Sheet",
      spreadsheetUrl:
        process.env.GOOGLE_SHEET_URL ||
        "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
      sheetName: "Registrations",
      syncDirection: "two_way",
      autoSync: false,
      frequency: "manual",
      isActive: true,
      lastStatus: "ready",
      lastMessage: "Connected to Google Sheets",
    },
  });

  console.log("✨ Database is now 100% clean and ready for real user prompts, links, and documents.");
}

cleanDatabase()
  .catch((err) => {
    console.error("❌ Error cleaning database:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
