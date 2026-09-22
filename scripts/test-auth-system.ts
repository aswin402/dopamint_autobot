// scripts/test-auth-system.ts
import prisma from "../lib/prisma";
import { hashPassword, comparePassword } from "../lib/auth-utils";
import { signToken, verifyToken } from "../lib/jwt";

async function runAuthTests() {
  console.log("==================================================");
  console.log("🔐 Testing User Authentication & Multi-Tenant Scoping");
  console.log("==================================================");

  const testEmail = `test_user_${Date.now()}@dopamint.ai`;
  const testPassword = "SuperSecretPassword123!";
  const testName = "Morgan Alex";

  // Test 1: Password hashing and comparison
  console.log("\n[Test 1] Password Hashing & Verification");
  const hashed = await hashPassword(testPassword);
  const isMatch = await comparePassword(testPassword, hashed);
  const isWrong = await comparePassword("WrongPassword", hashed);
  console.log("-> Password match:", isMatch);
  console.log("-> Wrong password rejected:", !isWrong);
  if (!isMatch || isWrong) throw new Error("Password verification failed");

  // Test 2: JWT token generation and verification
  console.log("\n[Test 2] JWT Sign & Verification");
  const token = signToken({
    userId: "test-user-id-123",
    email: testEmail,
    role: "user",
  });
  const verified = verifyToken(token);
  console.log("-> Token decoded userId:", verified?.userId);
  console.log("-> Token decoded email:", verified?.email);
  if (verified?.userId !== "test-user-id-123") throw new Error("JWT decoding failed");

  // Test 3: User Database Model & Creation
  console.log("\n[Test 3] Prisma User Creation");
  const user = await prisma.user.create({
    data: {
      name: testName,
      email: testEmail,
      password: hashed,
      role: "user",
    },
  });
  console.log("-> User created in DB:", user.id, user.name, user.email);

  // Test 4: Attaching Scoped Automation Session to User
  console.log("\n[Test 4] Scoped Automation Session Linkage");
  const session = await prisma.automationJob.create({
    data: {
      userId: user.id,
      title: "User's Scoped Form Run",
      status: "idle",
      targetUrl: "https://mowli.in/",
      messages: JSON.stringify([
        { role: "user", content: "Automate form for Morgan" },
        { role: "assistant", content: "Form successfully filled." },
      ]),
    },
  });
  console.log("-> Automation session created:", session.id, "bound to userId:", session.userId);

  // Test 5: Querying Scoped Data
  console.log("\n[Test 5] Querying User's Isolated Sessions");
  const userSessions = await prisma.automationJob.findMany({
    where: { userId: user.id },
  });
  console.log("-> Sessions found for user:", userSessions.length);
  if (userSessions.length !== 1) throw new Error("Session query isolation mismatch");

  // Cleanup
  await prisma.automationJob.delete({ where: { id: session.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("\n-> Cleaned up test records.");

  console.log("\n==================================================");
  console.log("🎉 ALL AUTHENTICATION & DATA SCOPING TESTS PASSED!");
  console.log("==================================================");
}

runAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Auth test error:", err);
    process.exit(1);
  });
