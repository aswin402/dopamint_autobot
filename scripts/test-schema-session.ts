import prisma from "../lib/prisma";

async function main() {
  console.log("Testing schema migration and session key persistence...");

  const attendee = await prisma.attendee.findFirst({
    where: { email: "aswinvishal402@gmail.com" },
  });

  if (!attendee) {
    throw new Error("Attendee not found");
  }

  console.log(`✅ Attendee queried: ${attendee.name} (${attendee.email})`);
  console.log(`🔑 Stored lumaSessionKey: ${attendee.lumaSessionKey ? attendee.lumaSessionKey.slice(0, 10) + "..." : "none"}`);
  console.log(`🌐 Stored proxyUrl: ${attendee.proxyUrl || "none"}`);

  if (attendee.lumaSessionKey && attendee.lumaSessionKey.startsWith("usr-")) {
    console.log("🎉 SUCCESS: Task 1 verification passed (valid session key found)!");
  } else {
    throw new Error("Verification failed: valid lumaSessionKey not found on attendee");
  }
}

main()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
