import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth-utils";

async function main() {
  console.log("Seeding or verifying admin user...");
  const adminEmail = "admin@dopamint.ai";
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  const passwordHash = await hashPassword("admin123");

  if (existing) {
    const updated = await prisma.user.update({
      where: { email: adminEmail },
      data: {
        role: "admin",
        password: passwordHash,
      },
    });
    console.log("Updated existing admin user:", updated.email, "role:", updated.role);
  } else {
    const created = await prisma.user.create({
      data: {
        name: "Luma Events Admin",
        email: adminEmail,
        password: passwordHash,
        role: "admin",
      },
    });
    console.log("Created admin user:", created.email, "role:", created.role);
  }

  // Also ensure regular user exists
  const userEmail = "user@dopamint.ai";
  const userPasswordHash = await hashPassword("user123");
  const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        name: "Aswin Vishal (Attendee)",
        email: userEmail,
        password: userPasswordHash,
        role: "user",
      },
    });
    console.log("Created regular user: user@dopamint.ai (password: user123)");
  } else {
    await prisma.user.update({
      where: { email: userEmail },
      data: { password: userPasswordHash, role: "user" },
    });
    console.log("Updated regular user: user@dopamint.ai (password: user123)");
  }

  // Also categorize existing events if they don't have a category
  const uncategorized = await prisma.event.findMany({
    where: { OR: [{ category: null }, { category: "" }] },
  });

  if (uncategorized.length > 0) {
    console.log(`Categorizing ${uncategorized.length} existing events...`);
    for (const ev of uncategorized) {
      let cat = "Korea Blockchain Week";
      if (ev.title.toLowerCase().includes("eth") || ev.title.toLowerCase().includes("ethereum")) {
        cat = "ETH Seoul & Web3";
      } else if (ev.title.toLowerCase().includes("ai") || ev.title.toLowerCase().includes("hack")) {
        cat = "AI & Hackathons";
      } else if (ev.title.toLowerCase().includes("vip") || ev.title.toLowerCase().includes("dinner") || ev.title.toLowerCase().includes("night")) {
        cat = "VIP & Side Events";
      }
      await prisma.event.update({
        where: { id: ev.id },
        data: { category: cat },
      });
    }
  }

  console.log("Admin seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
