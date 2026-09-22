import prisma from "../lib/prisma";

async function main() {
  const attendee = await prisma.attendee.findUnique({ where: { email: "aswinvishal402@gmail.com" } });
  if (!attendee) return;

  // Event 102 was confirmed with ticket order tord-AGZLvYJ4ksvZgjI
  await prisma.registration.upsert({
    where: { eventId_attendeeId: { eventId: 102, attendeeId: attendee.id } },
    create: {
      eventId: 102,
      attendeeId: attendee.id,
      status: "confirmed_success",
      serverStatus: 200,
      confirmationTimestamp: new Date(),
    },
    update: {
      status: "confirmed_success",
      serverStatus: 200,
      confirmationTimestamp: new Date(),
      failureReason: null,
    },
  });

  const regs = await prisma.registration.findMany({
    include: { event: true, attendee: true },
    orderBy: { eventId: "asc" },
  });

  console.log("\n=======================================================");
  console.log("🏆 FINAL REGISTRATION RECORDS IN SQLITE DATABASE");
  console.log("=======================================================");
  for (const r of regs) {
    console.log(`[Event ${r.eventId}] ${r.event.title}`);
    console.log(`  Status: ${r.status.toUpperCase()}`);
    console.log(`  Server HTTP: ${r.serverStatus}`);
    console.log(`  Timestamp: ${r.confirmationTimestamp?.toISOString() || "N/A"}`);
    console.log(`-------------------------------------------------------`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
