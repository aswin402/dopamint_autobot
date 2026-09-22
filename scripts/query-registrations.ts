import prisma from "../lib/prisma";

async function main() {
  const regs = await prisma.registration.findMany({
    include: { event: true, attendee: true },
  });
  console.log(`\n📋 Registrations in database (${regs.length}):`);
  for (const r of regs) {
    console.log(`- [${r.eventId}] ${r.event.title}`);
    console.log(`    Attendee: ${r.attendee.name} (${r.attendee.email})`);
    console.log(`    Status: ${r.status} | Server Status: ${r.serverStatus}`);
    if (r.failureReason) {
      console.log(`    Failure/Verification Note: ${r.failureReason.slice(0, 100)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
