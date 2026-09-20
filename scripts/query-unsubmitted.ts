import { prisma } from "../lib/prisma";

async function main() {
  const attendees = await prisma.attendee.findMany();
  console.log(`Found ${attendees.length} Attendees:`);
  attendees.forEach((a) => console.log(` - ${a.name} (${a.email}) [${a.company}]`));

  const events = await prisma.event.findMany({
    include: { registrations: true },
    orderBy: { id: "asc" },
  });

  const unsubmittedMap = new Map<number, any>();

  for (const ev of events) {
    if (ev.soldOut) continue;
    const confirmedCount = ev.registrations.filter((r) => r.status === "confirmed_success").length;
    if (confirmedCount < attendees.length) {
      unsubmittedMap.set(ev.id, {
        id: ev.id,
        title: ev.title,
        url: ev.url,
        isLuma: ev.isLuma,
        questions: ev.questions ? JSON.parse(ev.questions) : [],
        confirmedCount,
        missingAttendees: attendees
          .filter((a) => !ev.registrations.some((r) => r.attendeeId === a.id && r.status === "confirmed_success"))
          .map((a) => a.name),
      });
    }
  }

  console.log(`\nFound ${unsubmittedMap.size} non-submitted or partially submitted events:`);
  Array.from(unsubmittedMap.values()).slice(0, 15).forEach((item) => {
    console.log(`\n[Event #${item.id}] ${item.title}`);
    console.log(`  URL: ${item.url}`);
    console.log(`  Confirmed: ${item.confirmedCount}/${attendees.length}`);
    console.log(`  Missing: ${item.missingAttendees.join(", ")}`);
    console.log(`  Questions: ${item.questions.map((q: any) => q.label || q.question || q).join(" | ")}`);
  });
}

main().catch(console.error);
