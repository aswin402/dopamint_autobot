import "dotenv/config";
import prisma from "../lib/prisma";
import {
  resolveFormField,
  FormFieldPrompt,
  EventContext,
  calculateSimilarity,
  isFieldRequired,
} from "../lib/automation/field-resolver";
import { savePersona, saveAnswerToMemory } from "../lib/automation/persona";

async function runTests() {
  console.log("🧪 [Task 2 Test] Testing LLM Form Field Resolver Engine...\n");

  const testEmail = "aswinvishal402@gmail.com";
  let attendee = await prisma.attendee.findUnique({ where: { email: testEmail } });

  if (!attendee) {
    console.log(`Creating attendee record for ${testEmail}...`);
    attendee = await prisma.attendee.create({
      data: {
        name: "Aswin Vishal",
        email: testEmail,
        company: "Celestialabs",
        role: "Lead Engineer",
        phone: "+82 10-1234-5678",
        twitter: "@aswinvishal",
        telegram: "@aswinvishal",
        linkedin: "https://linkedin.com/in/aswinvishal",
        website: "https://dopamint.xyz",
        country: "South Korea",
      },
    });
  }

  // Ensure persona & qaMemory are fully populated
  await savePersona(attendee.id, {
    discord: "@aswin402",
    github: "https://github.com/aswin402",
    primaryTrack: "Developer",
    skills: ["Rust", "TypeScript", "AI"],
    ageGroup: "20대",
    tshirtSize: "XL",
    gender: "Male / 남성",
    bio: "AI & Systems Engineer building autonomous form bots.",
  });

  await saveAnswerToMemory(attendee.id, "what is your discord", "@aswin402");

  // Reload attendee with updated metadata
  attendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  if (!attendee) throw new Error("Attendee not found after setup!");

  console.log(`👤 Testing with attendee: ${attendee.name} (${attendee.email})`);
  console.log(`   Twitter: ${attendee.twitter}`);
  console.log(`   Role: ${attendee.role}`);

  const sampleEvent: EventContext = {
    title: "AI Node Developer Workshop & Hackathon",
    description: "Hands-on builder workshop on autonomous AI agents and nodes.",
    host: "Celestialabs",
    url: "https://lu.ma/ai-node-dev-workshop",
  };

  let passedScenarios = 0;

  // -------------------------------------------------------------
  // Scenario 1: Static / fast-path match (Twitter handle -> @aswinvishal)
  // -------------------------------------------------------------
  console.log("\n🧪 --- Scenario 1: Static / Fast-Path Match ---");
  const field1: FormFieldPrompt = {
    label: "Twitter handle",
    type: "text",
    isRequired: true,
  };
  const res1 = await resolveFormField(field1, attendee, sampleEvent);
  console.log("Result 1:", JSON.stringify(res1, null, 2));

  if (res1.value !== "@aswinvishal") {
    throw new Error(`Scenario 1 Failed: Expected '@aswinvishal', got '${res1.value}'`);
  }
  if (res1.matchedFrom !== "fastpath") {
    throw new Error(`Scenario 1 Failed: Expected matchedFrom 'fastpath', got '${res1.matchedFrom}'`);
  }
  if (res1.confidence < 0.70 || res1.requiresHumanIntervention) {
    throw new Error(`Scenario 1 Failed: Expected high confidence and requiresHumanIntervention false`);
  }
  console.log("✅ Scenario 1 Passed: Fast-path Twitter handle resolved directly.");
  passedScenarios++;

  // -------------------------------------------------------------
  // Scenario 2: Learned Q&A memory match (What is your Discord username? -> @aswin402)
  // -------------------------------------------------------------
  console.log("\n🧪 --- Scenario 2: Learned Q&A Memory Match ---");
  const field2: FormFieldPrompt = {
    label: "What is your Discord username? *",
    type: "text",
  };
  const res2 = await resolveFormField(field2, attendee, sampleEvent);
  console.log("Result 2:", JSON.stringify(res2, null, 2));

  if (res2.value !== "@aswin402") {
    throw new Error(`Scenario 2 Failed: Expected '@aswin402', got '${res2.value}'`);
  }
  if (res2.matchedFrom !== "qa_memory") {
    throw new Error(`Scenario 2 Failed: Expected matchedFrom 'qa_memory', got '${res2.matchedFrom}'`);
  }
  if (res2.confidence < 0.70 || res2.requiresHumanIntervention) {
    throw new Error(`Scenario 2 Failed: Expected high confidence and requiresHumanIntervention false`);
  }
  console.log("✅ Scenario 2 Passed: Learned Q&A memory match resolved successfully via fuzzy key matching.");
  passedScenarios++;

  // -------------------------------------------------------------
  // Scenario 3: Dropdown role match (What best describes your role? -> Builder)
  // -------------------------------------------------------------
  console.log("\n🧪 --- Scenario 3: Dropdown Role Match ---");
  const field3: FormFieldPrompt = {
    label: "What best describes your role?",
    type: "select",
    options: ["Builder", "VC", "Media", "Student"],
    isRequired: true,
  };
  const res3 = await resolveFormField(field3, attendee, sampleEvent);
  console.log("Result 3:", JSON.stringify(res3, null, 2));

  if (res3.value !== "Builder") {
    throw new Error(`Scenario 3 Failed: Expected 'Builder', got '${res3.value}'`);
  }
  if (res3.confidence < 0.70 || res3.requiresHumanIntervention) {
    throw new Error(`Scenario 3 Failed: Expected high confidence >= 0.70 and requiresHumanIntervention false`);
  }
  console.log(`✅ Scenario 3 Passed: Role dropdown resolved to "${res3.value}" (matchedFrom: ${res3.matchedFrom}).`);
  passedScenarios++;

  // -------------------------------------------------------------
  // Scenario 4: Multilingual Korean choice match (연령대를 선택해주세요 -> 20대)
  // -------------------------------------------------------------
  console.log("\n🧪 --- Scenario 4: Multilingual Korean Choice Match ---");
  const field4: FormFieldPrompt = {
    label: "연령대를 선택해주세요 (필수)",
    type: "radio",
    options: ["10대", "20대", "30대", "40대 이상"],
  };
  const res4 = await resolveFormField(field4, attendee, sampleEvent);
  console.log("Result 4:", JSON.stringify(res4, null, 2));

  if (res4.value !== "20대") {
    throw new Error(`Scenario 4 Failed: Expected '20대', got '${res4.value}'`);
  }
  if (res4.confidence < 0.70 || res4.requiresHumanIntervention) {
    throw new Error(`Scenario 4 Failed: Expected high confidence >= 0.70 and requiresHumanIntervention false`);
  }
  console.log(`✅ Scenario 4 Passed: Multilingual Korean option resolved to "${res4.value}" (matchedFrom: ${res4.matchedFrom}).`);
  passedScenarios++;

  // -------------------------------------------------------------
  // Scenario 5: Required unknown question with no match (Enter VIP secret passphrase * -> confidence < 0.70 & intervention needed)
  // -------------------------------------------------------------
  console.log("\n🧪 --- Scenario 5: Required Unknown Question (Safety Gate Check) ---");
  const field5: FormFieldPrompt = {
    label: "Enter VIP secret passphrase *",
    type: "text",
    isRequired: true,
  };
  const res5 = await resolveFormField(field5, attendee, sampleEvent);
  console.log("Result 5:", JSON.stringify(res5, null, 2));

  if (res5.confidence >= 0.70) {
    throw new Error(`Scenario 5 Failed: Expected confidence < 0.70, got ${res5.confidence}`);
  }
  if (!res5.requiresHumanIntervention) {
    throw new Error(`Scenario 5 Failed: Expected requiresHumanIntervention true for required unknown secret`);
  }
  if (res5.matchedFrom !== "unknown") {
    throw new Error(`Scenario 5 Failed: Expected matchedFrom 'unknown', got '${res5.matchedFrom}'`);
  }
  console.log("✅ Scenario 5 Passed: Safety Gate correctly flagged required unknown field for human intervention.");
  passedScenarios++;

  // -------------------------------------------------------------
  // Scenario 6: Open essay synthesis grounded in attendee & event
  // -------------------------------------------------------------
  console.log("\n🧪 --- Scenario 6: Open Essay Grounded Synthesis ---");
  const field6: FormFieldPrompt = {
    label: "Why do you want to join this AI node developer workshop?",
    type: "textarea",
    isRequired: true,
  };
  const res6 = await resolveFormField(field6, attendee, sampleEvent);
  console.log("Result 6:", JSON.stringify(res6, null, 2));

  if (!res6.value || res6.value.length < 15) {
    throw new Error(`Scenario 6 Failed: Expected coherent essay response, got '${res6.value}'`);
  }
  if (res6.confidence < 0.70 || res6.requiresHumanIntervention) {
    throw new Error(`Scenario 6 Failed: Expected confidence >= 0.70 for synthesized response`);
  }
  console.log(`✅ Scenario 6 Passed: Contextual essay synthesized with length ${res6.value.length} chars.`);
  passedScenarios++;

  console.log(`\n🎉 ALL ${passedScenarios} SCENARIOS PASSED SUCCESSFULLY! Task 2 Field Resolver Engine verified.\n`);
}

runTests()
  .catch((err) => {
    console.error("\n❌ Field Resolver Test Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
