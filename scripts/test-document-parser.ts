import {
  parseDocumentBuffer,
  extractEventsFromDocument,
  extractAttendeesFromDocument,
} from "../lib/document-parser";

async function runTests() {
  console.log("==========================================");
  console.log("🧪 Testing Document Parser & Ingestion Engine");
  console.log("==========================================");

  // Test 1: Markdown text with Luma Events
  console.log("\n[Test 1] Parsing Markdown / Text with Luma links");
  const markdownSample = `
# Korea Blockchain Week 2026 Curated Side Events
Join us for the best hackathons and networking nights!

- [KBW Official Kickoff Party](https://lu.ma/kbw-kickoff-2026) - Sept 1, 2026 @ Gangnam
- Vitalik & Friends ETH Seoul Hacker House: https://lu.ma/eth-seoul-vitalik-2026
- AI Agent & Web3 Hackathon Demo Day (https://lu.ma/ai-agent-hack-seoul)
  `;

  const parsedMd = await parseDocumentBuffer(Buffer.from(markdownSample), "kbw-events.md");
  const extractedEvents = extractEventsFromDocument(parsedMd, "Korea Blockchain Week");
  console.log(`-> Extracted ${extractedEvents.length} events from markdown:`);
  extractedEvents.forEach((ev) => {
    console.log(`   * ${ev.title} (${ev.category}) -> ${ev.url}`);
  });

  if (extractedEvents.length !== 3) {
    throw new Error(`Expected 3 events, got ${extractedEvents.length}`);
  }

  // Test 2: Text / Doc format with Attendee profile
  console.log("\n[Test 2] Parsing Attendee Bio / Roster text");
  const attendeeSample = `
Name: Aswin Vishal
Email: aswinvishal402@gmail.com
Phone: +91 9384812345
Company: Dopamint AI
Role: Full Stack AI Engineer
Telegram: @aswinvishal
Twitter: @aswinvishal
Website: https://openledger.xyz
EVM Wallet: 0x71C84177c86bf1121d51B42323e271424E62a048
  `;

  const parsedDoc = await parseDocumentBuffer(Buffer.from(attendeeSample), "aswin-profile.txt");
  const extractedAttendees = extractAttendeesFromDocument(parsedDoc);
  console.log(`-> Extracted ${extractedAttendees.length} attendee profiles:`);
  extractedAttendees.forEach((att) => {
    console.log(`   * ${att.name} <${att.email}> at ${att.company} (EVM: ${att.wallets?.evm})`);
  });

  if (extractedAttendees.length !== 1 || !extractedAttendees[0].wallets?.evm) {
    throw new Error("Failed to extract attendee profile properly");
  }

  console.log("\n✅ Document Parser passed all verification checks!");
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
