import prisma from "../lib/prisma";
import {
  extractPersona,
  getQAMemory,
  saveAnswerToMemory,
  removeAnswerFromMemory,
  savePersona,
  getAttendeeContext,
  buildAttendeeMetadata,
  normalizeQuestionKey,
  AttendeePersona,
  QAMemoryStore,
} from "../lib/automation/persona";

async function runTest() {
  console.log("🧪 [Task 1 Test] Testing Dynamic Persona & Learned Q&A Memory Model...\n");

  const testEmail = "aswinvishal402@gmail.com";

  // 1. Ensure attendee exists in DB
  let attendee = await prisma.attendee.findUnique({
    where: { email: testEmail },
  });

  if (!attendee) {
    console.log(`Creating test attendee for ${testEmail}...`);
    attendee = await prisma.attendee.create({
      data: {
        name: "Aswin Vishal",
        email: testEmail,
        company: "Celestialabs",
        role: "Lead Engineer",
        phone: "+82 10-1234-5678",
      },
    });
  }

  console.log(`👤 Using attendee: ${attendee.name} <${attendee.email}> (ID: ${attendee.id})`);

  // 2. Define test persona and QA memory per requirements
  const samplePersona: AttendeePersona = {
    discord: "@aswin402",
    github: "https://github.com/aswin402",
    primaryTrack: "Developer",
    skills: ["Rust", "TypeScript", "AI"],
    ageGroup: "20대",
    tshirtSize: "XL",
    gender: "Male / 남성",
    bio: "AI & Systems Engineer building autonomous form bots.",
  };

  const sampleQAMemory: QAMemoryStore = {
    "what is your discord": "@aswin402",
  };

  console.log("\n📝 Step A: Saving Persona via savePersona()...");
  await savePersona(attendee.id, samplePersona);

  console.log("📝 Step B: Saving Q&A Memory via saveAnswerToMemory()...");
  for (const [q, a] of Object.entries(sampleQAMemory)) {
    await saveAnswerToMemory(attendee.id, q, a);
  }

  // Also test question key normalization with punctuation and mixed casing
  console.log("📝 Step C: Testing Question Normalization (What is your GitHub URL? *)...");
  await saveAnswerToMemory(attendee.id, "What is your GitHub URL? *", "https://github.com/aswin402");

  // 3. Read back from database
  console.log("\n🔍 Step D: Reading back attendee from Prisma DB...");
  const readBack = await prisma.attendee.findUnique({
    where: { email: testEmail },
  });

  if (!readBack) {
    throw new Error(`Attendee ${testEmail} could not be retrieved from DB!`);
  }

  console.log("Raw stored metadata JSON in DB:");
  console.log(readBack.metadata);

  // 4. Assertions and Verifications
  console.log("\n🔬 Step E: Verifying extracted persona attributes...");
  const extractedPersona = extractPersona(readBack);

  console.log("Extracted Persona:", JSON.stringify(extractedPersona, null, 2));

  if (extractedPersona.discord !== "@aswin402") {
    throw new Error(`Expected discord to be '@aswin402', got '${extractedPersona.discord}'`);
  }
  if (extractedPersona.github !== "https://github.com/aswin402") {
    throw new Error(`Expected github to be 'https://github.com/aswin402', got '${extractedPersona.github}'`);
  }
  if (extractedPersona.primaryTrack !== "Developer") {
    throw new Error(`Expected primaryTrack to be 'Developer', got '${extractedPersona.primaryTrack}'`);
  }
  if (!extractedPersona.skills || !extractedPersona.skills.includes("Rust") || !extractedPersona.skills.includes("TypeScript") || !extractedPersona.skills.includes("AI")) {
    throw new Error(`Expected skills to include Rust, TypeScript, AI, got: ${JSON.stringify(extractedPersona.skills)}`);
  }
  if (extractedPersona.ageGroup !== "20대") {
    throw new Error(`Expected ageGroup to be '20대', got '${extractedPersona.ageGroup}'`);
  }
  console.log("✅ All persona fields (discord, github, primaryTrack, skills, ageGroup) verified!");

  console.log("\n🔬 Step F: Verifying learned Q&A memory store...");
  const extractedMemory = getQAMemory(readBack);
  console.log("Extracted Memory:", JSON.stringify(extractedMemory, null, 2));

  if (extractedMemory["what is your discord"] !== "@aswin402") {
    throw new Error(`Expected 'what is your discord' to be '@aswin402', got '${extractedMemory["what is your discord"]}'`);
  }
  if (extractedMemory["what is your github url"] !== "https://github.com/aswin402") {
    throw new Error(`Expected normalized key 'what is your github url' to be 'https://github.com/aswin402', got '${extractedMemory["what is your github url"]}'`);
  }
  console.log("✅ Learned Q&A memory pairs verified accurately!");

  console.log("\n🔬 Step G: Testing removeAnswerFromMemory()...");
  await removeAnswerFromMemory(readBack.id, "what is your github url");
  const readBackAfterDelete = await prisma.attendee.findUnique({ where: { id: readBack.id } });
  const memoryAfterDelete = getQAMemory(readBackAfterDelete);
  if (memoryAfterDelete["what is your github url"]) {
    throw new Error("Expected 'what is your github url' to be deleted!");
  }
  if (memoryAfterDelete["what is your discord"] !== "@aswin402") {
    throw new Error("Expected 'what is your discord' to still persist!");
  }
  console.log("✅ Q&A memory key removal verified!");

  console.log("\n🔬 Step H: Testing buildAttendeeMetadata helper...");
  const testPayload = {
    persona: {
      tshirtSize: "2XL" as const,
    },
    qaMemory: {
      "what is your favorite framework": "Next.js",
    },
  };
  const mergedMetaStr = buildAttendeeMetadata(readBackAfterDelete?.metadata, testPayload);
  const parsedMerged = JSON.parse(mergedMetaStr);
  if (parsedMerged.persona.discord !== "@aswin402" || parsedMerged.persona.tshirtSize !== "2XL") {
    throw new Error("buildAttendeeMetadata failed to merge persona fields!");
  }
  if (parsedMerged.qaMemory["what is your favorite framework"] !== "Next.js") {
    throw new Error("buildAttendeeMetadata failed to include qaMemory!");
  }
  console.log("✅ buildAttendeeMetadata correctly merged existing and incoming attributes!");

  console.log("\n🔬 Step I: Testing getAttendeeContext for LLM synthesis...");
  const contextStr = getAttendeeContext(readBackAfterDelete);
  console.log("--- Generated LLM Attendee Context ---");
  console.log(contextStr);
  console.log("--------------------------------------");

  if (!contextStr.includes("@aswin402")) throw new Error("Context missing discord handle");
  if (!contextStr.includes("Developer")) throw new Error("Context missing primary track");
  if (!contextStr.includes("Rust, TypeScript, AI")) throw new Error("Context missing skills");
  if (!contextStr.includes("20대")) throw new Error("Context missing age bracket");
  if (!contextStr.includes("Learned Q&A Memory:")) throw new Error("Context missing QA memory block");
  console.log("✅ LLM Attendee Context accurately generated!");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Task 1 Persona & Learned Memory Model verified.\n");
}

runTest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
