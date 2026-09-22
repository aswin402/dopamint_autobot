import "dotenv/config";
import {
  extractPersona,
  getQAMemory,
  getAttendeeContext,
  normalizeQuestionKey,
  AttendeePersona,
} from "./persona";
import { getMiniMaxClient, defaultModel } from "../ai/minimax";

export interface FormFieldPrompt {
  id?: string;
  label: string;
  placeholder?: string;
  nameAttr?: string;
  type: "text" | "textarea" | "select" | "combobox" | "radio" | "checkbox";
  options?: string[]; // available choices if dropdown or radio
  isRequired?: boolean;
}

export interface EventContext {
  title?: string;
  description?: string;
  host?: string;
  url?: string;
}

export interface FieldResolutionResult {
  value: string;
  confidence: number; // 0.0 to 1.0
  shouldRemember: boolean; // true if this answer should be cached in qaMemory
  reasoning: string;
  requiresHumanIntervention: boolean; // true if confidence < 0.70 on required field
  matchedFrom: "fastpath" | "qa_memory" | "persona" | "llm" | "unknown";
}

/**
 * Determines whether a field is required, checking the isRequired flag and text markers (*, required, 필수).
 */
export function isFieldRequired(field: FormFieldPrompt): boolean {
  if (field.isRequired !== undefined) {
    return Boolean(field.isRequired);
  }
  const text = `${field.label || ""} ${field.placeholder || ""}`;
  return /\*|\((required|필수)\)|\[(required|필수)\]|\b필수\b/i.test(text);
}

const QUESTION_STOPWORDS = new Set([
  "what",
  "is",
  "are",
  "your",
  "you",
  "please",
  "enter",
  "provide",
  "do",
  "the",
  "a",
  "an",
  "handle",
  "id",
  "link",
  "url",
  "of",
  "to",
  "in",
  "for",
  "on",
  "with",
  "my",
  "any",
  "which",
  "give",
  "tell",
]);

/**
 * Calculates string similarity using word token overlap, containment, and character bigram Dice coefficient.
 * Filters out generic question stopwords to prevent false positives across distinct domain tokens.
 * Returns a score between 0.0 and 1.0.
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeQuestionKey(str1);
  const s2 = normalizeQuestionKey(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  // Tokenize words (length > 1)
  const tokens1 = s1.split(" ").filter((w) => w.length > 1);
  const tokens2 = s2.split(" ").filter((w) => w.length > 1);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  // Filter stopwords for distinct domain token comparison
  const contentTokens1 = tokens1.filter((w) => !QUESTION_STOPWORDS.has(w));
  const contentTokens2 = tokens2.filter((w) => !QUESTION_STOPWORDS.has(w));

  // If both queries have distinctive content tokens, ensure they overlap
  // e.g. "what is your discord" vs "what is your telegram handle" => 0 overlap on [discord] vs [telegram]
  if (contentTokens1.length > 0 && contentTokens2.length > 0) {
    const cSet1 = new Set(contentTokens1);
    const cSet2 = new Set(contentTokens2);
    let cIntersection = 0;
    for (const t of cSet1) {
      if (cSet2.has(t)) cIntersection++;
    }

    // If distinctive content tokens have zero overlap, reject false positive match
    if (cIntersection === 0) return 0;

    const cUnion = new Set([...contentTokens1, ...contentTokens2]).size;
    const cJaccard = cUnion > 0 ? cIntersection / cUnion : 0;
    const cContainment = cIntersection / Math.min(cSet1.size, cSet2.size);

    if (cContainment >= 0.8 && cIntersection >= 1) {
      return Math.max(0.85, cJaccard);
    }
    return cJaccard;
  }

  // Fallback for non-stopword or non-space languages (e.g. Korean / CJK)
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let intersection = 0;
  for (const t of set1) {
    if (set2.has(t)) intersection++;
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  const containment = intersection / Math.min(set1.size, set2.size);

  // Bigram Dice coefficient
  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let bgOverlap = 0;
  for (const [bg, count] of bg1.entries()) {
    if (bg2.has(bg)) {
      bgOverlap += Math.min(count, bg2.get(bg)!);
    }
  }
  const totalBg = Math.max(0, s1.length - 1) + Math.max(0, s2.length - 1);
  const dice = totalBg > 0 ? (2 * bgOverlap) / totalBg : 0;

  if (containment >= 0.8 && intersection >= 2) {
    return Math.max(0.85, Math.max(jaccard, dice));
  }

  return Math.max(jaccard, dice);
}

/**
 * Safely parses wallets JSON or returns string.
 */
function extractWalletAddress(wallets: any, promptText: string): string {
  if (!wallets) return "";
  if (typeof wallets === "string") {
    try {
      wallets = JSON.parse(wallets);
    } catch {
      return wallets;
    }
  }

  if (typeof wallets === "object" && wallets !== null) {
    // Normalize keys to lowercase for case-insensitive lookup
    const normalizedWallets: Record<string, string> = {};
    for (const [k, v] of Object.entries(wallets)) {
      if (v !== undefined && v !== null) {
        normalizedWallets[k.toLowerCase().trim()] = String(v);
      }
    }

    const isSolana = /solana|sol\b|phantom/i.test(promptText);
    const isEvm = /evm|eth|ethereum|erc20|metamask|0x/i.test(promptText);
    const isXrp = /xrp|ripple/i.test(promptText);

    if (isSolana && (normalizedWallets.solana || normalizedWallets.sol || normalizedWallets.phantom)) {
      return normalizedWallets.solana || normalizedWallets.sol || normalizedWallets.phantom;
    }
    if (isEvm && (normalizedWallets.evm || normalizedWallets.eth || normalizedWallets.ethereum || normalizedWallets.metamask)) {
      return normalizedWallets.evm || normalizedWallets.eth || normalizedWallets.ethereum || normalizedWallets.metamask;
    }
    if (isXrp && (normalizedWallets.xrp || normalizedWallets.ripple)) {
      return normalizedWallets.xrp || normalizedWallets.ripple;
    }

    return (
      normalizedWallets.evm ||
      normalizedWallets.solana ||
      normalizedWallets.eth ||
      normalizedWallets.sol ||
      normalizedWallets.xrp ||
      Object.values(normalizedWallets)[0] ||
      ""
    );
  }

  return String(wallets);
}

/**
 * Matches an option from a list of options based on attendee attributes.
 */
function findMatchingOption(options: string[], targetValue?: string): string | undefined {
  if (!options || options.length === 0 || !targetValue) return undefined;
  const targetNorm = targetValue.trim().toLowerCase();

  // 1. Exact case-insensitive match
  const exact = options.find((opt) => opt.trim().toLowerCase() === targetNorm);
  if (exact) return exact;

  // 2. Inclusion match (either option includes target or target includes option)
  const inclusion = options.find((opt) => {
    const o = opt.trim().toLowerCase();
    return o.includes(targetNorm) || targetNorm.includes(o);
  });
  if (inclusion) return inclusion;

  return undefined;
}

/**
 * Layer 1: Fast-Path Regex Layer
 * Directly matches standard profile fields without AI latency.
 */
function tryFastPathMatch(field: FormFieldPrompt, attendee: any): FieldResolutionResult | null {
  if (!attendee) return null;

  const combined = `${field.label || ""} ${field.placeholder || ""} ${field.nameAttr || ""} ${field.id || ""}`.trim();
  const lowerCombined = combined.toLowerCase();
  const hasOptions = Array.isArray(field.options) && field.options.length > 0;

  // 0. Terms of Service / Privacy Agreement Checkboxes
  if (
    field.type === "checkbox" ||
    /\b(terms|privacy|policy|agree|agreement|consent|약관|동의|개인정보)\b/i.test(combined)
  ) {
    if (/\b(terms|privacy|policy|agree|agreement|consent|약관|동의|개인정보)\b/i.test(combined)) {
      return {
        value: "true",
        confidence: 0.99,
        shouldRemember: false,
        reasoning: "Fast-path auto-consent for terms of service / privacy policy agreement",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 1. Email
  if (
    (field.type as string) === "email" ||
    /\b(email|e-mail|이메일)\b/i.test(combined) ||
    field.nameAttr?.toLowerCase() === "email"
  ) {
    if (attendee.email) {
      return {
        value: attendee.email,
        confidence: 0.99,
        shouldRemember: false,
        reasoning: "Fast-path regex match for email address",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 2. First Name (only when explicitly requested, e.g. "First Name", "Given Name", or "이름 (First Name)")
  if (
    (/\b(first\s*name|given\s*name)\b/i.test(combined) || /이름\s*\(first/i.test(combined)) &&
    !/last\s*name|surname|family|성\b|user\s*name/i.test(combined)
  ) {
    const firstName = attendee.firstName || attendee.name?.split(" ")[0] || "";
    if (firstName) {
      return {
        value: firstName,
        confidence: 0.98,
        shouldRemember: false,
        reasoning: "Fast-path regex match for first name",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 3. Last Name
  if (/\b(last\s*name|surname|family\s*name)\b/i.test(combined) || /^(성|성씨)$/i.test(combined.trim())) {
    const parts = (attendee.name || "").trim().split(/\s+/);
    const lastName = attendee.lastName || (parts.length > 1 ? parts.slice(1).join(" ") : "");
    if (lastName) {
      return {
        value: lastName,
        confidence: 0.98,
        shouldRemember: false,
        reasoning: "Fast-path regex match for last name",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 4. Full Name (including Korean single-field "이름" or "성명")
  if (
    (/\b(full\s*name|your\s*name|legal\s*name|성명)\b/i.test(combined) ||
      combined === "이름" ||
      /^이름\s*[\*]?$/i.test(field.label.trim()) ||
      (/\bname\b/i.test(combined) && !/first|given|last|surname|user\s*name|handle|nick|project|company|event|organization|rep\b/i.test(combined))) &&
    !hasOptions
  ) {
    if (attendee.name) {
      return {
        value: attendee.name,
        confidence: 0.98,
        shouldRemember: false,
        reasoning: "Fast-path regex match for full name",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 5. Phone / Mobile
  if (
    (field.type as string) === "tel" ||
    /\b(phone|mobile|tel|cell|contact\s*number|phone\s*number|전화|핸드폰|연락처)\b/i.test(combined)
  ) {
    const phone = attendee.phone || attendee.mobile || attendee.number || "";
    if (phone) {
      return {
        value: phone,
        confidence: 0.98,
        shouldRemember: false,
        reasoning: "Fast-path regex match for phone number",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 6. Twitter / X Handle
  if (
    /\b(twitter|x\s*handle|x\s*username|x\s*profile|twitter\s*handle|twitter\s*username|x\.com|twitter\.com)\b/i.test(
      combined
    ) ||
    (/(^|\s)x(\s|$|\*)/i.test(combined) && /handle|username|profile|account/i.test(combined))
  ) {
    if (hasOptions) {
      const match = findMatchingOption(field.options!, attendee.twitter);
      if (match) {
        return {
          value: match,
          confidence: 0.98,
          shouldRemember: false,
          reasoning: `Fast-path match for Twitter option: "${match}"`,
          requiresHumanIntervention: false,
          matchedFrom: "fastpath",
        };
      }
      // If choices exist (e.g. ["Yes", "No"]), let it fall through to option matching
    } else if (attendee.twitter) {
      return {
        value: attendee.twitter,
        confidence: 0.98,
        shouldRemember: false,
        reasoning: "Fast-path regex match for Twitter/X handle",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 7. Telegram Handle
  if (/\b(telegram|tg\s*handle|tg\s*username|tg\b|telegram\s*handle|t\.me)\b/i.test(combined)) {
    if (hasOptions) {
      const match = findMatchingOption(field.options!, attendee.telegram);
      if (match) {
        return {
          value: match,
          confidence: 0.98,
          shouldRemember: false,
          reasoning: `Fast-path match for Telegram option: "${match}"`,
          requiresHumanIntervention: false,
          matchedFrom: "fastpath",
        };
      }
      // If choices exist (e.g. ["Yes", "No"]), let it fall through to option matching
    } else if (attendee.telegram) {
      return {
        value: attendee.telegram,
        confidence: 0.98,
        shouldRemember: false,
        reasoning: "Fast-path regex match for Telegram handle",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 8. LinkedIn
  if (/\b(linkedin|linkedin\s*url|linkedin\s*profile|링크드인)\b/i.test(combined)) {
    if (hasOptions) {
      const match = findMatchingOption(field.options!, attendee.linkedin);
      if (match) {
        return {
          value: match,
          confidence: 0.98,
          shouldRemember: false,
          reasoning: `Fast-path match for LinkedIn option: "${match}"`,
          requiresHumanIntervention: false,
          matchedFrom: "fastpath",
        };
      }
    } else if (attendee.linkedin) {
      return {
        value: attendee.linkedin,
        confidence: 0.98,
        shouldRemember: false,
        reasoning: "Fast-path regex match for LinkedIn profile",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 9. Website / Portfolio
  if (
    /\b(website|portfolio|personal\s*site|personal\s*website|home\s*page|web\s*url|블로그|웹사이트)\b/i.test(
      combined
    )
  ) {
    if (attendee.website) {
      return {
        value: attendee.website,
        confidence: 0.95,
        shouldRemember: false,
        reasoning: "Fast-path regex match for website",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 10. Company / Organization (only if not a select/radio with unmatching options)
  if (/\b(company|organization|firm|employer|workplace|affiliated\s*with|affiliation|소속|회사)\b/i.test(combined)) {
    if (hasOptions) {
      const match = findMatchingOption(field.options!, attendee.company);
      if (match) {
        return {
          value: match,
          confidence: 0.95,
          shouldRemember: false,
          reasoning: `Fast-path match for company option: "${match}"`,
          requiresHumanIntervention: false,
          matchedFrom: "fastpath",
        };
      }
    } else if (attendee.company) {
      return {
        value: attendee.company,
        confidence: 0.95,
        shouldRemember: false,
        reasoning: "Fast-path regex match for company",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 11. Role / Job Title (text input only; dropdowns handled in option reasoning layer)
  if (
    !hasOptions &&
    /\b(job\s*title|current\s*role|your\s*role|designation|profession|직책|직업)\b/i.test(combined) &&
    !/describe|track|category/i.test(combined)
  ) {
    if (attendee.role) {
      return {
        value: attendee.role,
        confidence: 0.95,
        shouldRemember: false,
        reasoning: "Fast-path regex match for role/title",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 12. Crypto Wallets
  if (/\b(wallet|evm|solana|eth\s*address|crypto\s*address|erc20|web3\s*address|지갑)\b/i.test(combined)) {
    const walletAddress = extractWalletAddress(attendee.wallets, combined);
    if (walletAddress) {
      return {
        value: walletAddress,
        confidence: 0.95,
        shouldRemember: false,
        reasoning: "Fast-path match for cryptocurrency wallet address",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  // 13. Country / Location
  if (/\b(country|nation|location|residence|국가|거주국)\b/i.test(combined)) {
    if (hasOptions) {
      const match = findMatchingOption(field.options!, attendee.country);
      if (match) {
        return {
          value: match,
          confidence: 0.95,
          shouldRemember: false,
          reasoning: `Fast-path match for country option: "${match}"`,
          requiresHumanIntervention: false,
          matchedFrom: "fastpath",
        };
      }
    } else if (attendee.country) {
      return {
        value: attendee.country,
        confidence: 0.95,
        shouldRemember: false,
        reasoning: "Fast-path regex match for country",
        requiresHumanIntervention: false,
        matchedFrom: "fastpath",
      };
    }
  }

  return null;
}

/**
 * Layer 2A: Learned Q&A Memory Layer
 * Checks persistent qaMemory with normalized and fuzzy key matching.
 */
function tryQAMemoryMatch(
  field: FormFieldPrompt,
  attendee: any
): FieldResolutionResult | null {
  const qaMemory = getQAMemory(attendee);
  const keys = Object.keys(qaMemory);
  if (keys.length === 0) return null;

  const normalizedPrompt = normalizeQuestionKey(field.label || field.placeholder || "");
  if (!normalizedPrompt) return null;

  // 1. Direct exact match
  if (qaMemory[normalizedPrompt]) {
    const rawValue = qaMemory[normalizedPrompt];
    const finalValue = field.options && field.options.length > 0
      ? findMatchingOption(field.options, rawValue) || rawValue
      : rawValue;

    return {
      value: finalValue,
      confidence: 1.0,
      shouldRemember: false,
      reasoning: `Exact learned Q&A memory match for "${normalizedPrompt}"`,
      requiresHumanIntervention: false,
      matchedFrom: "qa_memory",
    };
  }

  // 2. Fuzzy key similarity match
  let bestKey = "";
  let highestSim = 0;

  for (const key of keys) {
    const sim = calculateSimilarity(normalizedPrompt, key);
    if (sim > highestSim) {
      highestSim = sim;
      bestKey = key;
    }
  }

  if (highestSim >= 0.75 && bestKey) {
    const rawValue = qaMemory[bestKey];
    const finalValue = field.options && field.options.length > 0
      ? findMatchingOption(field.options, rawValue) || rawValue
      : rawValue;

    return {
      value: finalValue,
      confidence: Math.min(0.96, Math.max(0.85, highestSim)),
      shouldRemember: false,
      reasoning: `Fuzzy matched learned Q&A memory key "${bestKey}" (similarity: ${(highestSim * 100).toFixed(0)}%)`,
      requiresHumanIntervention: false,
      matchedFrom: "qa_memory",
    };
  }

  return null;
}

/**
 * Layer 2B: Extended Persona Layer
 * Checks persona attributes (discord, github, tshirtSize, gender, ageGroup, skills, diet).
 */
function tryPersonaMatch(
  field: FormFieldPrompt,
  attendee: any
): FieldResolutionResult | null {
  const persona = extractPersona(attendee);
  const combined = `${field.label || ""} ${field.placeholder || ""} ${field.nameAttr || ""} ${field.id || ""}`;
  const hasOptions = Array.isArray(field.options) && field.options.length > 0;

  // Discord
  if (/\b(discord|디스코드)\b/i.test(combined) && persona.discord) {
    if (hasOptions) {
      const match = findMatchingOption(field.options!, persona.discord);
      if (match) {
        return {
          value: match,
          confidence: 0.96,
          shouldRemember: false,
          reasoning: `Matched Discord option "${match}" from attendee persona`,
          requiresHumanIntervention: false,
          matchedFrom: "persona",
        };
      }
      // If choices exist (e.g. ["Yes", "No"]), let it fall through to option matching
    } else {
      return {
        value: persona.discord,
        confidence: 0.96,
        shouldRemember: false,
        reasoning: "Matched Discord handle from attendee persona",
        requiresHumanIntervention: false,
        matchedFrom: "persona",
      };
    }
  }

  // GitHub
  if (/\b(github|git\s*hub|깃허브|깃헙)\b/i.test(combined) && persona.github) {
    if (hasOptions) {
      const match = findMatchingOption(field.options!, persona.github);
      if (match) {
        return {
          value: match,
          confidence: 0.96,
          shouldRemember: false,
          reasoning: `Matched GitHub option "${match}" from attendee persona`,
          requiresHumanIntervention: false,
          matchedFrom: "persona",
        };
      }
      // If choices exist (e.g. ["Yes", "No"]), let it fall through to option matching
    } else {
      return {
        value: persona.github,
        confidence: 0.96,
        shouldRemember: false,
        reasoning: "Matched GitHub profile from attendee persona",
        requiresHumanIntervention: false,
        matchedFrom: "persona",
      };
    }
  }

  // T-Shirt Size
  if (/\b(t-?shirt|shirt\s*size|clothing\s*size|티셔츠)\b/i.test(combined) && persona.tshirtSize) {
    const val = hasOptions ? findMatchingOption(field.options!, persona.tshirtSize) || persona.tshirtSize : persona.tshirtSize;
    return {
      value: val,
      confidence: 0.95,
      shouldRemember: false,
      reasoning: `Matched T-shirt size "${val}" from attendee persona`,
      requiresHumanIntervention: false,
      matchedFrom: "persona",
    };
  }

  // Gender / Sex
  if (/\b(gender|sex|성별)\b/i.test(combined)) {
    const gender = persona.gender || attendee.gender;
    if (gender) {
      let val = gender;
      if (hasOptions) {
        // Handle multilingual matching (e.g. Male / 남성)
        const match = findMatchingOption(field.options!, gender) ||
          (/남|male/i.test(gender) ? field.options!.find(o => /남|male/i.test(o)) : undefined) ||
          (/여|female/i.test(gender) ? field.options!.find(o => /여|female/i.test(o)) : undefined);
        if (match) val = match;
      }
      return {
        value: val,
        confidence: 0.95,
        shouldRemember: false,
        reasoning: `Matched gender "${val}" from attendee persona`,
        requiresHumanIntervention: false,
        matchedFrom: "persona",
      };
    }
  }

  // Age Group / Age Bracket
  if (/\b(age|age\s*group|age\s*bracket|연령|연령대|나이)\b/i.test(combined) && persona.ageGroup) {
    let val = persona.ageGroup;
    if (hasOptions) {
      const match = findMatchingOption(field.options!, persona.ageGroup) ||
        field.options!.find(o => {
          const num = (persona.ageGroup || "").replace(/[^0-9]/g, "");
          return num && o.includes(num);
        });
      if (match) val = match;
    }
    return {
      value: val,
      confidence: 0.96,
      shouldRemember: false,
      reasoning: `Matched age group "${val}" from attendee persona`,
      requiresHumanIntervention: false,
      matchedFrom: "persona",
    };
  }

  // Dietary Preferences
  if (/\b(diet|dietary|vegan|vegetarian|식단|식사)\b/i.test(combined) && persona.diet) {
    const val = hasOptions ? findMatchingOption(field.options!, persona.diet) || persona.diet : persona.diet;
    return {
      value: val,
      confidence: 0.95,
      shouldRemember: false,
      reasoning: `Matched dietary preference "${val}" from attendee persona`,
      requiresHumanIntervention: false,
      matchedFrom: "persona",
    };
  }

  // Primary Track / Focus
  if (/\b(track|primary\s*track|builder\s*track|role\s*category|분야|트랙)\b/i.test(combined) && persona.primaryTrack) {
    const val = hasOptions ? findMatchingOption(field.options!, persona.primaryTrack) || persona.primaryTrack : persona.primaryTrack;
    return {
      value: val,
      confidence: 0.95,
      shouldRemember: false,
      reasoning: `Matched primary track "${val}" from attendee persona`,
      requiresHumanIntervention: false,
      matchedFrom: "persona",
    };
  }

  return null;
}

/**
 * Deterministic Semantic Matching Engine (Layer 3 fallback).
 * Intelligently maps options (e.g. role categories, Korean options, skills) without requiring external LLM network calls.
 */
function resolveDeterministicFallback(
  field: FormFieldPrompt,
  attendee: any,
  event?: EventContext,
  isRequired: boolean = false
): FieldResolutionResult {
  const combined = `${field.label || ""} ${field.placeholder || ""}`.trim();
  const persona = extractPersona(attendee);

  // 1. Dropdown / Choice Option Matching
  if (field.options && field.options.length > 0) {
    const options = field.options;

    // A. Role / Track question matching
    if (/role|describe|who\s*are\s*you|identity|track|profile|position|occupation|직무|직업|분야/i.test(combined)) {
      const attendeeRole = (attendee.role || "").toLowerCase();
      const track = (persona.primaryTrack || "").toLowerCase();
      const skills = (persona.skills || []).map((s) => s.toLowerCase());

      const isDeveloper =
        track === "developer" ||
        /engineer|developer|dev|programmer|builder|architect|coder|software|tech|cto|full\s*stack/i.test(attendeeRole) ||
        skills.some((s) => /rust|typescript|javascript|python|solidity|go|c\+\+|node|react/i.test(s));

      const isInvestor =
        track === "investor" ||
        /investor|vc|venture|capital|angel|partner/i.test(attendeeRole);

      const isFounder =
        track === "founder" ||
        /founder|ceo|co-founder|executive|entrepreneur/i.test(attendeeRole);

      const isStudent =
        track === "student" ||
        /student|university|academic|intern|phd/i.test(attendeeRole);

      const isMedia =
        track === "community" ||
        /media|press|journalist|writer|content|community|marketing/i.test(attendeeRole);

      for (const opt of options) {
        const lowerOpt = opt.toLowerCase();
        if (isDeveloper && /builder|developer|engineer|dev|creator|hacker|개발자|엔지니어/i.test(lowerOpt)) {
          return {
            value: opt,
            confidence: 0.95,
            shouldRemember: true,
            reasoning: `Matched role option "${opt}" based on attendee developer track and engineering role`,
            requiresHumanIntervention: false,
            matchedFrom: "llm",
          };
        }
        if (isInvestor && /investor|vc|venture|capital|투자자/i.test(lowerOpt)) {
          return {
            value: opt,
            confidence: 0.95,
            shouldRemember: true,
            reasoning: `Matched role option "${opt}" based on investor background`,
            requiresHumanIntervention: false,
            matchedFrom: "llm",
          };
        }
        if (isFounder && /founder|ceo|entrepreneur|창업자|대표/i.test(lowerOpt)) {
          return {
            value: opt,
            confidence: 0.95,
            shouldRemember: true,
            reasoning: `Matched role option "${opt}" based on founder background`,
            requiresHumanIntervention: false,
            matchedFrom: "llm",
          };
        }
        if (isStudent && /student|university|academic|학생|대학생/i.test(lowerOpt)) {
          return {
            value: opt,
            confidence: 0.95,
            shouldRemember: true,
            reasoning: `Matched role option "${opt}" based on student background`,
            requiresHumanIntervention: false,
            matchedFrom: "llm",
          };
        }
        if (isMedia && /media|press|community|미디어|커뮤니티/i.test(lowerOpt)) {
          return {
            value: opt,
            confidence: 0.95,
            shouldRemember: true,
            reasoning: `Matched role option "${opt}" based on media/community background`,
            requiresHumanIntervention: false,
            matchedFrom: "llm",
          };
        }
      }
    }

    // B. Age Group Korean / English matching
    if (/연령|나이|age/i.test(combined) && persona.ageGroup) {
      const ageNum = persona.ageGroup.replace(/[^0-9]/g, "");
      const match = options.find((opt) => opt.includes(persona.ageGroup!) || (ageNum && opt.includes(ageNum)));
      if (match) {
        return {
          value: match,
          confidence: 0.96,
          shouldRemember: true,
          reasoning: `Matched age group option "${match}" for persona age ${persona.ageGroup}`,
          requiresHumanIntervention: false,
          matchedFrom: "llm",
        };
      }
    }

    // C. General Options matching with Persona Skills / Interests / Attributes
    for (const opt of options) {
      const lowerOpt = opt.toLowerCase();
      if (persona.skills?.some((s) => lowerOpt.includes(s.toLowerCase()) || s.toLowerCase().includes(lowerOpt))) {
        return {
          value: opt,
          confidence: 0.90,
          shouldRemember: true,
          reasoning: `Matched option "${opt}" based on attendee skill set`,
          requiresHumanIntervention: false,
          matchedFrom: "llm",
        };
      }
      if (persona.interests?.some((i) => lowerOpt.includes(i.toLowerCase()) || i.toLowerCase().includes(lowerOpt))) {
        return {
          value: opt,
          confidence: 0.88,
          shouldRemember: true,
          reasoning: `Matched option "${opt}" based on attendee interests`,
          requiresHumanIntervention: false,
          matchedFrom: "llm",
        };
      }
    }

    // D. Boolean Yes / No or Confirmation Choice Matching
    const hasYes = options.find((opt) => /^(yes|예|네|true)$/i.test(opt.trim()));
    const hasNo = options.find((opt) => /^(no|아니오|아니요|false)$/i.test(opt.trim()));
    if (hasYes && hasNo) {
      let isAffirmative = false;
      if (/telegram|tg\b/i.test(combined) && attendee.telegram) isAffirmative = true;
      if (/twitter|x\b/i.test(combined) && attendee.twitter) isAffirmative = true;
      if (/discord/i.test(combined) && persona.discord) isAffirmative = true;
      if (/github/i.test(combined) && persona.github) isAffirmative = true;
      if (/linkedin/i.test(combined) && attendee.linkedin) isAffirmative = true;
      if (/wallet|crypto/i.test(combined) && attendee.wallets) isAffirmative = true;

      const selected = isAffirmative ? hasYes : hasNo;
      return {
        value: selected,
        confidence: 0.95,
        shouldRemember: true,
        reasoning: `Matched option "${selected}" based on attendee profile data for "${field.label}"`,
        requiresHumanIntervention: false,
        matchedFrom: "llm",
      };
    }
  }

  // 2. Secret passphrases, VIP invite codes, private PINs with no match (Checked before open text / textarea)
  if (
    /passphrase|secret|invite\s*code|vip\s*code|passcode|pin\b|private\s*key|referral\s*code|access\s*code|password|초대\s*코드|비밀번호/i.test(
      combined
    )
  ) {
    return {
      value: "",
      confidence: 0.0,
      shouldRemember: false,
      reasoning: `Private secret or VIP passphrase requested for "${field.label}", requiring manual input`,
      requiresHumanIntervention: isRequired,
      matchedFrom: "unknown",
    };
  }

  // 3. Open Text / Motivation / Pitch / Essay
  if (
    /why\s*do\s*you\s*want|why\s*attend|what\s*brings\s*you|what\s*are\s*you\s*building|pitch|project\s*description|introduce\s*yourself|what\s*would\s*you\s*like\s*to\s*learn|지원\s*동기|참여\s*목적/i.test(
      combined
    ) ||
    field.type === "textarea"
  ) {
    const role = attendee.role || "Developer";
    const company = attendee.company || "Celestialabs";
    const skillsList = (persona.skills || []).slice(0, 3).join(", ");
    const eventTitle = event?.title || "this event";

    let essay = "";
    if (persona.bio) {
      essay = `${persona.bio} Looking forward to connecting and collaborating at ${eventTitle}.`;
    } else {
      essay = `As a ${role} at ${company}${skillsList ? ` specializing in ${skillsList}` : ""}, I am excited to participate in ${eventTitle} to collaborate with other builders and contribute to the ecosystem.`;
    }

    return {
      value: essay,
      confidence: 0.90,
      shouldRemember: false, // Do not pollute qaMemory with event-specific essay responses
      reasoning: `Synthesized contextual attendee pitch tailored to event "${eventTitle}"`,
      requiresHumanIntervention: false,
      matchedFrom: "llm",
    };
  }

  // 4. Default Unknown
  return {
    value: "",
    confidence: 0.0,
    shouldRemember: false,
    reasoning: `No profile data, learned memory, or options matched for question: "${field.label}"`,
    requiresHumanIntervention: isRequired,
    matchedFrom: "unknown",
  };
}

/**
 * Layer 3: LLM Reasoning Layer using MiniMax / OpenAI
 */
async function resolveViaLLM(
  field: FormFieldPrompt,
  attendee: any,
  event?: EventContext,
  isRequired: boolean = false
): Promise<FieldResolutionResult> {
  const apiKey = process.env.MINIMAX_API_KEY || "";
  if (!apiKey || apiKey === "dummy_key_for_initialization") {
    return resolveDeterministicFallback(field, attendee, event, isRequired);
  }

  const combined = `${field.label || ""} ${field.placeholder || ""}`.trim();

  // If asking for secret passwords or VIP codes that are absent from attendee context,
  // don't hallucinate credentials.
  if (
    /passphrase|secret|invite\s*code|vip\s*code|passcode|pin\b|private\s*key|referral\s*code|access\s*code|password|초대\s*코드|비밀번호/i.test(
      combined
    )
  ) {
    return {
      value: "",
      confidence: 0.0,
      shouldRemember: false,
      reasoning: `Field "${field.label}" requires a private secret or VIP code not in attendee profile`,
      requiresHumanIntervention: isRequired,
      matchedFrom: "unknown",
    };
  }

  const client = getMiniMaxClient();
  const attendeeContext = getAttendeeContext(attendee);
  const eventContext = event
    ? `Event Title: ${event.title || ""}\nDescription: ${event.description || ""}\nHost: ${event.host || ""}`
    : "None provided";

  try {
    if (field.options && field.options.length > 0) {
      // Dropdown / Option Resolution via LLM
      const prompt = `Field Question: "${field.label}"
Placeholder: "${field.placeholder || ""}"
Available Options: ${JSON.stringify(field.options)}

Attendee Profile:
${attendeeContext}

Event Context:
${eventContext}

Select the single best matching option from Available Options for this attendee.
Respond ONLY with a JSON object in this format:
{"selectedOption": "string", "confidence": number, "reasoning": "string"}`;

      const res = await client.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: "system",
            content:
              "You are Dopamint Form Field Resolver AI. Select the most accurate option from Available Options based on the attendee profile. The selectedOption must be an exact item from Available Options. If no options match, return low confidence.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      });

      const text = res.choices[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const chosen = (parsed.selectedOption || "").trim();

        // Validate that chosen option exists in field.options (exact or fuzzy match)
        let matched = field.options.find((opt) => opt.toLowerCase() === chosen.toLowerCase());
        if (!matched) {
          matched = findMatchingOption(field.options, chosen);
        }

        if (matched) {
          const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.85;
          return {
            value: matched,
            confidence,
            shouldRemember: true,
            reasoning: parsed.reasoning || `LLM selected option "${matched}"`,
            requiresHumanIntervention: confidence < 0.70 && isRequired,
            matchedFrom: "llm",
          };
        } else {
          // If the LLM returned an option not in field.options, try deterministic fallback
          const fallback = resolveDeterministicFallback(field, attendee, event, isRequired);
          if (fallback.value && field.options.includes(fallback.value)) {
            return fallback;
          }
          // If no valid option can be resolved, reject invalid option
          return {
            value: "",
            confidence: 0.30,
            shouldRemember: false,
            reasoning: `LLM suggested invalid option "${chosen}" not present in field.options`,
            requiresHumanIntervention: isRequired,
            matchedFrom: "unknown",
          };
        }
      }
    } else {
      // Open Text / Essay Resolution via LLM
      const prompt = `Field Question: "${field.label}"
Placeholder: "${field.placeholder || ""}"

Attendee Profile:
${attendeeContext}

Event Context:
${eventContext}

Generate a crisp, compelling 1-2 sentence response grounded in the attendee's role, company, skills, and bio, tailored to the event. If the question asks for private secrets, passcodes, or credentials not in the context, return an empty value and confidence 0.0.
Respond ONLY with a JSON object in this format:
{"value": "string", "confidence": number, "reasoning": "string"}`;

      const res = await client.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: "system",
            content:
              "You are Dopamint Form Field Resolver AI. Generate concise, high-impact responses for open form questions.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });

      const text = res.choices[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.85;
        const value = parsed.value || "";

        // Event-specific answers should not pollute global qaMemory
        const isEventSpecific = Boolean(event?.title) || /why\s*do\s*you\s*want|why\s*attend|what\s*brings\s*you/i.test(field.label);

        return {
          value,
          confidence,
          shouldRemember: isEventSpecific ? false : Boolean(value),
          reasoning: parsed.reasoning || "LLM generated contextual answer",
          requiresHumanIntervention: confidence < 0.70 && isRequired,
          matchedFrom: value ? "llm" : "unknown",
        };
      }
    }
  } catch (err: any) {
    console.warn(`[FieldResolver] LLM call failed, falling back to deterministic matching: ${err.message}`);
  }

  return resolveDeterministicFallback(field, attendee, event, isRequired);
}

/**
 * Universal Form Field Resolver Engine
 * Orchestrates Fast-Path -> Learned Memory -> Persona -> LLM / Semantic Reasoning -> Safety Gate.
 */
export async function resolveFormField(
  field: FormFieldPrompt,
  attendee: any,
  event?: EventContext
): Promise<FieldResolutionResult> {
  const isRequired = isFieldRequired(field);

  // Layer 1: Fast-Path Regex Layer (Direct mappings for Name, Email, Phone, Socials, Wallets)
  const fastPathResult = tryFastPathMatch(field, attendee);
  if (fastPathResult) {
    return {
      ...fastPathResult,
      requiresHumanIntervention: fastPathResult.confidence < 0.70 && isRequired,
    };
  }

  // Layer 2A: Learned Q&A Memory Layer
  const qaMemoryResult = tryQAMemoryMatch(field, attendee);
  if (qaMemoryResult) {
    return {
      ...qaMemoryResult,
      requiresHumanIntervention: qaMemoryResult.confidence < 0.70 && isRequired,
    };
  }

  // Layer 2B: Extended Persona Layer
  const personaResult = tryPersonaMatch(field, attendee);
  if (personaResult) {
    return {
      ...personaResult,
      requiresHumanIntervention: personaResult.confidence < 0.70 && isRequired,
    };
  }

  // Layer 3: LLM Reasoning Layer & Deterministic Semantic Fallback
  const llmResult = await resolveViaLLM(field, attendee, event, isRequired);
  return {
    ...llmResult,
    requiresHumanIntervention: llmResult.confidence < 0.70 && isRequired,
  };
}
