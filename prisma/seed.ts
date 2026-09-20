import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

const LUMA_DIR = "/home/aswin/luma-registration";

async function main() {
  console.log("🌱 Seeding Dopamint AutoBot database...");

  // Clean existing
  await prisma.registration.deleteMany();
  await prisma.attendee.deleteMany();
  await prisma.event.deleteMany();

  // 1. Seed Attendees
  const personsPath = path.join(LUMA_DIR, "persons.json");
  const personsData = JSON.parse(fs.readFileSync(personsPath, "utf-8"));

  const walletsMap: Record<string, string> = {
    "devishree@openledger.xyz": "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8901",
    "kamesh@openledger.xyz": "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8902",
    "ram@openledger.xyz": "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8903",
    "jawwy@dopamint.xyz": "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8904",
    "uv@dopamint.xyz": "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8905",
    "ap@i5.xyz": "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8906",
  };

  const attendeeMap = new Map<string, string>(); // email -> attendeeId

  for (const p of personsData) {
    const emailLower = p.Email.toLowerCase();
    const parts = p.Name.split(" ");
    const firstName = parts[0] || p.Name;
    const lastName = parts.slice(1).join(" ") || "";
    const evm = walletsMap[emailLower] || "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8901";

    const attendee = await prisma.attendee.create({
      data: {
        name: p.Name,
        firstName,
        lastName,
        email: p.Email,
        phone: p.Phone || "9620992718",
        company: p.Company,
        role: p.Role,
        telegram: p["Telegram ID"] || "",
        twitter: p["Twitter ID"] || "",
        linkedin: p.LinkedIn || "",
        website: p.Company.toLowerCase().includes("openledger")
          ? "https://openledger.xyz"
          : p.Company.toLowerCase().includes("dopamint")
          ? "https://dopamint.xyz"
          : "https://i5.xyz",
        pitch: p.Company.toLowerCase().includes("openledger")
          ? "OpenLedger is building verifiable data infrastructure and high-performance decentralized AI compute."
          : p.Company.toLowerCase().includes("dopamint")
          ? "Dopamint is building gamified Web3 social and decentralized community engagement protocols."
          : "i5 is an institutional quantitative liquidity and decentralized trading infrastructure firm.",
        gender: p.Name.toLowerCase().includes("devishree") ? "Female" : "Male",
        country: "South Korea",
        wallets: JSON.stringify({ evm }),
      },
    });
    attendeeMap.set(emailLower, attendee.id);
  }

  // Add Aswin Vishal
  const aswin = await prisma.attendee.create({
    data: {
      name: "Aswin Vishal",
      firstName: "Aswin",
      lastName: "Vishal",
      email: "aswinvishal402@gmail.com",
      phone: "+91 9876543210",
      company: "CelestiaLabs / Dopamint",
      role: "Lead Fullstack & Automation Engineer",
      telegram: "@aswinvishal",
      twitter: "@aswinvishal",
      linkedin: "https://linkedin.com/in/aswinvishal",
      website: "https://dopamint.xyz",
      pitch: "Building autonomous AI agent tools and high-scale decentralized Web3 automation.",
      gender: "Male",
      country: "India",
      wallets: JSON.stringify({ evm: "0x71C26d246c761e89F0042Fe5f87b8f9A4f7C8900" }),
    },
  });
  attendeeMap.set("aswinvishal402@gmail.com", aswin.id);

  console.log(`✅ Seeded ${attendeeMap.size} Attendees (including Aswin Vishal).`);

  // 2. Seed Events
  const eventsPath = path.join(LUMA_DIR, "events.json");
  const sqPath = path.join(LUMA_DIR, "scanned_questions.json");
  const eventsData = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
  const sqData = JSON.parse(fs.readFileSync(sqPath, "utf-8")).events || {};

  for (const ev of eventsData) {
    const scan = sqData[ev.id] || {};
    await prisma.event.create({
      data: {
        id: ev.id,
        title: ev.title,
        url: ev.url || "",
        date: ev.date || "",
        platform: ev.is_luma ? "luma" : "external",
        isLuma: Boolean(ev.is_luma),
        ticketText: ev.ticket_text || "Get Tickets",
        soldOut: Boolean(scan.sold_out || ev.id === 6 || ev.id === 23),
        requireApproval: Boolean(scan.require_approval),
        phoneRequired: scan.phone_requirement || null,
        ethRequired: scan.eth_requirement || null,
        solRequired: scan.sol_requirement || null,
        questions: scan.questions ? JSON.stringify(scan.questions) : null,
      },
    });
  }
  console.log(`✅ Seeded ${eventsData.length} Events.`);

  // 3. Seed Registrations
  const progPath = path.join(LUMA_DIR, "team_registration_progress.json");
  const progData = JSON.parse(fs.readFileSync(progPath, "utf-8"));

  let regCount = 0;
  for (const [key, val] of Object.entries(progData)) {
    const [eventIdStr, email] = key.split("_");
    const eventId = parseInt(eventIdStr);
    const emailLower = (email || "").toLowerCase();
    const attendeeId = attendeeMap.get(emailLower);

    if (attendeeId && eventId && (val as any).status) {
      await prisma.registration.upsert({
        where: {
          eventId_attendeeId: {
            eventId,
            attendeeId,
          },
        },
        create: {
          eventId,
          attendeeId,
          status: (val as any).status,
          serverStatus: (val as any).server_status || 200,
          confirmationTimestamp: (val as any).timestamp ? new Date((val as any).timestamp) : new Date(),
        },
        update: {
          status: (val as any).status,
          serverStatus: (val as any).server_status || 200,
          confirmationTimestamp: (val as any).timestamp ? new Date((val as any).timestamp) : new Date(),
        },
      });
      regCount++;
    }
  }
  console.log(`✅ Seeded ${regCount} Registrations.`);

  // 4. Seed Registrations for Aswin Vishal across 12 initial events
  const aswinId = attendeeMap.get("aswinvishal402@gmail.com");
  if (aswinId) {
    const testEventIds = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13];
    for (let i = 0; i < testEventIds.length; i++) {
      const eventId = testEventIds[i];
      const status = i < 9 ? "confirmed_success" : "waitlist_joined";
      await prisma.registration.upsert({
        where: { eventId_attendeeId: { eventId, attendeeId: aswinId } },
        create: {
          eventId,
          attendeeId: aswinId,
          status,
          serverStatus: 200,
          confirmationTimestamp: new Date(),
        },
        update: {
          status,
          serverStatus: 200,
        },
      });
    }
    console.log(`✅ Seeded 12 registrations for Aswin Vishal.`);
  }

  // 5. Seed Default Google Sheet Configuration
  await prisma.sheetConfig.upsert({
    where: { id: "default-sheet-config" },
    update: {},
    create: {
      id: "default-sheet-config",
      name: "Main Registration Tracker",
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
  console.log(`✅ Seeded Google Sheets default configuration.`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
