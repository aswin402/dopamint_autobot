import prisma from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users in DB count:", users.length);
  for (const u of users) {
    console.log(`User: ${u.name} (${u.email}) - Role: ${u.role}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
