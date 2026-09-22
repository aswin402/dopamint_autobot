import prisma from "../prisma";

export interface AttendeePersona {
  discord?: string;
  github?: string;
  primaryTrack?: "Developer" | "Founder" | "Investor" | "Community" | "Student" | "Other";
  skills?: string[];
  interests?: string[];
  tshirtSize?: "XS" | "S" | "M" | "L" | "XL" | "2XL";
  diet?: string;
  gender?: string;
  ageGroup?: string;
  bio?: string;
}

export interface QAMemoryStore {
  [normalizedQuestion: string]: string;
}

export interface ExtendedMetadata {
  persona?: AttendeePersona;
  qaMemory?: QAMemoryStore;
  [key: string]: any;
}

/**
 * Normalizes question strings for uniform hashmap storage and semantic matching.
 * e.g., "What is your Discord handle? *" -> "what is your discord handle"
 */
export function normalizeQuestionKey(question: string): string {
  if (!question) return "";
  return question
    .toLowerCase()
    .replace(/[*?:!#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Safely parses any JSON string or returns an empty object.
 */
function safeParseJson(data: any): Record<string, any> {
  if (!data) return {};
  if (typeof data === "object") return data;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Extracts and consolidates persona attributes from an attendee object or its metadata JSON.
 */
export function extractPersona(attendee: any): AttendeePersona {
  if (!attendee) return {};

  const metadata = safeParseJson(attendee.metadata);
  const persona = metadata.persona || {};

  const parseArray = (val: any): string[] | undefined => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim()) {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return undefined;
  };

  return {
    discord: persona.discord ?? attendee.discord ?? undefined,
    github: persona.github ?? attendee.github ?? undefined,
    primaryTrack: persona.primaryTrack ?? attendee.primaryTrack ?? undefined,
    skills: parseArray(persona.skills) ?? parseArray(attendee.skills) ?? undefined,
    interests: parseArray(persona.interests) ?? parseArray(attendee.interests) ?? undefined,
    tshirtSize: persona.tshirtSize ?? attendee.tshirtSize ?? undefined,
    diet: persona.diet ?? attendee.diet ?? undefined,
    gender: persona.gender ?? attendee.gender ?? undefined,
    ageGroup: persona.ageGroup ?? attendee.ageGroup ?? undefined,
    bio: persona.bio ?? attendee.bio ?? attendee.pitch ?? undefined,
  };
}

/**
 * Retrieves the learned Q&A memory dictionary from an attendee record.
 */
export function getQAMemory(attendee: any): QAMemoryStore {
  if (!attendee) return {};

  const metadata = safeParseJson(attendee.metadata);
  const memory = metadata.qaMemory || attendee.qaMemory;

  if (memory && typeof memory === "object" && !Array.isArray(memory)) {
    return { ...memory };
  }
  return {};
}

/**
 * Saves or updates an answer into the attendee's persistent learned Q&A memory.
 */
export async function saveAnswerToMemory(
  attendeeId: string,
  question: string,
  answer: string
): Promise<void> {
  let attendee = await prisma.attendee.findUnique({ where: { id: attendeeId } });
  if (!attendee) {
    attendee = await prisma.attendee.findUnique({ where: { email: attendeeId } });
  }
  if (!attendee) {
    throw new Error(`Attendee not found: ${attendeeId}`);
  }

  const normKey = normalizeQuestionKey(question);
  const metadata: ExtendedMetadata = safeParseJson(attendee.metadata);

  if (!metadata.qaMemory || typeof metadata.qaMemory !== "object") {
    metadata.qaMemory = {};
  }
  metadata.qaMemory[normKey] = answer;

  await prisma.attendee.update({
    where: { id: attendee.id },
    data: {
      metadata: JSON.stringify(metadata),
    },
  });
}

/**
 * Removes a learned question-answer pair from memory.
 */
export async function removeAnswerFromMemory(
  attendeeId: string,
  question: string
): Promise<void> {
  let attendee = await prisma.attendee.findUnique({ where: { id: attendeeId } });
  if (!attendee) {
    attendee = await prisma.attendee.findUnique({ where: { email: attendeeId } });
  }
  if (!attendee) {
    throw new Error(`Attendee not found: ${attendeeId}`);
  }

  const normKey = normalizeQuestionKey(question);
  const metadata: ExtendedMetadata = safeParseJson(attendee.metadata);

  if (metadata.qaMemory && typeof metadata.qaMemory === "object") {
    delete metadata.qaMemory[normKey];
    delete metadata.qaMemory[question];
  }

  await prisma.attendee.update({
    where: { id: attendee.id },
    data: {
      metadata: JSON.stringify(metadata),
    },
  });
}

/**
 * Updates or merges persona attributes into an attendee's metadata JSON.
 */
export async function savePersona(
  attendeeId: string,
  personaUpdates: Partial<AttendeePersona>
): Promise<void> {
  let attendee = await prisma.attendee.findUnique({ where: { id: attendeeId } });
  if (!attendee) {
    attendee = await prisma.attendee.findUnique({ where: { email: attendeeId } });
  }
  if (!attendee) {
    throw new Error(`Attendee not found: ${attendeeId}`);
  }

  const metadata: ExtendedMetadata = safeParseJson(attendee.metadata);
  const currentPersona = metadata.persona || {};

  metadata.persona = {
    ...currentPersona,
    ...personaUpdates,
  };

  const extraUpdate: any = {};
  if (personaUpdates.gender !== undefined) {
    extraUpdate.gender = personaUpdates.gender;
  }
  if (personaUpdates.bio !== undefined && !attendee.pitch) {
    extraUpdate.pitch = personaUpdates.bio;
  }

  await prisma.attendee.update({
    where: { id: attendee.id },
    data: {
      metadata: JSON.stringify(metadata),
      ...extraUpdate,
    },
  });
}

/**
 * Merges existing metadata with incoming body/persona/qaMemory updates.
 */
export function buildAttendeeMetadata(
  existingMetaStr: string | null | undefined,
  incoming: {
    metadata?: any;
    persona?: AttendeePersona;
    qaMemory?: QAMemoryStore;
    [key: string]: any;
  }
): string {
  const existing: ExtendedMetadata = safeParseJson(existingMetaStr);
  const incomingMeta: Record<string, any> = safeParseJson(incoming.metadata);

  const merged: ExtendedMetadata = {
    ...existing,
    ...incomingMeta,
  };

  // Merge persona
  const mergedPersona: AttendeePersona = {
    ...(existing.persona || {}),
    ...(incomingMeta.persona || {}),
    ...(incoming.persona || {}),
  };

  // Support direct persona fields passed in payload
  const directPersonaFields: (keyof AttendeePersona)[] = [
    "discord",
    "github",
    "primaryTrack",
    "skills",
    "interests",
    "tshirtSize",
    "diet",
    "gender",
    "ageGroup",
    "bio",
  ];
  for (const field of directPersonaFields) {
    if (incoming[field] !== undefined) {
      (mergedPersona as any)[field] = incoming[field];
    }
  }

  if (Object.keys(mergedPersona).length > 0) {
    merged.persona = mergedPersona;
  }

  // Handle qaMemory (allow explicit override or merge)
  if (incoming.qaMemory !== undefined || incomingMeta.qaMemory !== undefined) {
    merged.qaMemory = {
      ...(incoming.qaMemory !== undefined ? incoming.qaMemory : incomingMeta.qaMemory),
    };
  } else if (existing.qaMemory) {
    merged.qaMemory = existing.qaMemory;
  }

  return JSON.stringify(merged);
}

/**
 * Formats a concise, structured markdown summary of the attendee's profile,
 * persona, and learned Q&A memory for consumption by LLM prompts.
 */
export function getAttendeeContext(attendee: any): string {
  if (!attendee) return "";

  const persona = extractPersona(attendee);
  const qaMemory = getQAMemory(attendee);

  const lines: string[] = [
    `Name: ${attendee.name || ""}`,
    `Email: ${attendee.email || ""}`,
    `Company: ${attendee.company || ""}`,
    `Role: ${attendee.role || ""}`,
  ];

  if (attendee.phone) lines.push(`Phone: ${attendee.phone}`);
  if (persona.primaryTrack) lines.push(`Primary Track: ${persona.primaryTrack}`);
  if (persona.skills && persona.skills.length > 0) {
    lines.push(`Skills: ${persona.skills.join(", ")}`);
  }
  if (persona.interests && persona.interests.length > 0) {
    lines.push(`Interests: ${persona.interests.join(", ")}`);
  }
  if (persona.discord) lines.push(`Discord: ${persona.discord}`);
  if (persona.github) lines.push(`GitHub: ${persona.github}`);
  if (attendee.telegram) lines.push(`Telegram: ${attendee.telegram}`);
  if (attendee.twitter) lines.push(`Twitter/X: ${attendee.twitter}`);
  if (attendee.linkedin) lines.push(`LinkedIn: ${attendee.linkedin}`);
  if (attendee.website) lines.push(`Website: ${attendee.website}`);
  if (persona.tshirtSize) lines.push(`T-Shirt Size: ${persona.tshirtSize}`);
  if (persona.diet) lines.push(`Dietary Preference: ${persona.diet}`);
  if (persona.gender || attendee.gender) {
    lines.push(`Gender: ${persona.gender || attendee.gender}`);
  }
  if (persona.ageGroup) lines.push(`Age Bracket: ${persona.ageGroup}`);
  if (persona.bio || attendee.pitch) {
    lines.push(`Bio/Pitch: ${persona.bio || attendee.pitch}`);
  }
  if (attendee.country) lines.push(`Country: ${attendee.country}`);
  if (attendee.wallets) {
    lines.push(`Wallets: ${typeof attendee.wallets === "string" ? attendee.wallets : JSON.stringify(attendee.wallets)}`);
  }

  const memoryKeys = Object.keys(qaMemory);
  if (memoryKeys.length > 0) {
    lines.push(`Learned Q&A Memory:`);
    for (const key of memoryKeys) {
      lines.push(`- Q: "${key}" => A: "${qaMemory[key]}"`);
    }
  }

  return lines.join("\n");
}
