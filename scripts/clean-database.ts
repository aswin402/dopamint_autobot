import { prisma } from "../lib/prisma";

async function cleanDatabase() {
  console.log("🧹 Purging all mock data and seeded records from database...");

  const delRegs = await prisma.registration.deleteMany();
  const delEvents = await prisma.event.deleteMany();
  const delAttendees = await prisma.attendee.deleteMany();

  console.log(`✅ Deleted ${delRegs.count} mock registrations.`);
  console.log(`✅ Deleted ${delEvents.count} mock events.`);
  console.log(`✅ Deleted ${delAttendees.count} mock attendees.`);

  const delSheets = await prisma.sheetConfig.deleteMany();
  console.log(`✅ Deleted ${delSheets.count} spreadsheet configurations.`);

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
