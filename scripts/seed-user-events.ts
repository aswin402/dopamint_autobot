import prisma from "../lib/prisma";

async function main() {
  console.log("🌱 Seeding Aswin Vishal profile and 6 Luma events...");

  // 1. Create or upsert attendee
  const attendee = await prisma.attendee.upsert({
    where: { email: "aswinvishal402@gmail.com" },
    create: {
      name: "Aswin Vishal",
      firstName: "Aswin",
      lastName: "Vishal",
      email: "aswinvishal402@gmail.com",
      phone: "+91 9384812345",
      company: "Dopamint",
      role: "Full Stack Engineer & AI Developer",
      telegram: "@aswinvishal",
      twitter: "@aswinvishal",
      linkedin: "https://linkedin.com/in/aswinvishal",
      website: "https://dopamint.xyz",
      country: "South Korea",
      pitch: "Building autonomous AI agent platforms and decentralized data compute.",
      wallets: JSON.stringify({
        evm: "0x71C8366420A09260b5e143F7396CE352360C7236",
        solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        xrp: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
      }),
    },
    update: {
      name: "Aswin Vishal",
      firstName: "Aswin",
      lastName: "Vishal",
      phone: "+91 9384812345",
      company: "Dopamint",
      role: "Full Stack Engineer & AI Developer",
      telegram: "@aswinvishal",
      twitter: "@aswinvishal",
      linkedin: "https://linkedin.com/in/aswinvishal",
      website: "https://dopamint.xyz",
      country: "South Korea",
      pitch: "Building autonomous AI agent platforms and decentralized data compute.",
      wallets: JSON.stringify({
        evm: "0x71C8366420A09260b5e143F7396CE352360C7236",
        solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        xrp: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
      }),
    },
  });

  console.log(`✅ Attendee seeded: ${attendee.name} (${attendee.email}) - ID: ${attendee.id}`);

  // 2. Seed 6 events
  const eventsData = [
    {
      id: 101,
      title: "Singing Sign, 제1회 사인 가왕은 바로 누구? Sign x Tangem x MAGA",
      url: "https://luma.com/ep5vcjq3",
      date: "Oct 2",
      platform: "luma",
      isLuma: true,
      soldOut: false,
      requireApproval: false,
    },
    {
      id: 102,
      title: "[ONLINE] KBW 2026: Recap & Insights For Those Who Missed - GetBlock",
      url: "https://luma.com/ro90pc44",
      date: "Oct 2",
      platform: "luma",
      isLuma: true,
      soldOut: false,
      requireApproval: false,
    },
    {
      id: 103,
      title: "XRP Seoul 2026 - XRPL Korea",
      url: "https://luma.com/wm5ub5wk",
      date: "Oct 3",
      platform: "luma",
      isLuma: true,
      soldOut: false,
      requireApproval: true,
    },
    {
      id: 104,
      title: "Collectible Con Korea 2026: Day 2 - The Concept Labs, ShardLab, Hashed",
      url: "https://luma.com/cc-korea-2026-day-2",
      date: "Oct 3",
      platform: "luma",
      isLuma: true,
      soldOut: false,
      requireApproval: false,
    },
    {
      id: 105,
      title: "[Lambda256] Join the Blockchain Node Crew - Lambda256",
      url: "https://luma.com/e9vm2gbc",
      date: "Oct 3",
      platform: "luma",
      isLuma: true,
      soldOut: false,
      requireApproval: true,
    },
    {
      id: 106,
      title: "XRP Seoul 2026 VIP Afterparty - XRPL Korea",
      url: "https://luma.com/q0wmg82n",
      date: "Oct 3",
      platform: "luma",
      isLuma: true,
      soldOut: false,
      requireApproval: true,
    },
  ];

  for (const ev of eventsData) {
    const record = await prisma.event.upsert({
      where: { id: ev.id },
      create: ev,
      update: ev,
    });
    console.log(`✅ Event seeded: [${record.id}] ${record.title}`);
  }

  console.log("✨ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
