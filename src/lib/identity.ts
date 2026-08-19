import type { DuplicateMatchLevel, UserIdentity } from "./domain";

export interface RegistrationIdentity {
  email: string;
  phone?: string;
  name?: string;
  dateOfBirth?: string;
}

export interface IdentityMatch {
  level: DuplicateMatchLevel;
  reasons: Array<"verified_email" | "verified_phone" | "name_and_birth_date">;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string, defaultCountryCode = "1"): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && defaultCountryCode) return `${defaultCountryCode}${digits}`;
  return digits;
}

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function matchRegistrationIdentity(
  registration: RegistrationIdentity,
  existing: UserIdentity,
): IdentityMatch {
  const reasons: IdentityMatch["reasons"] = [];
  const emailMatches = Boolean(existing.email) && normalizeEmail(registration.email) === normalizeEmail(existing.email!);
  const phoneMatches = Boolean(registration.phone && existing.phone) && normalizePhone(registration.phone!) === normalizePhone(existing.phone!);
  const nameAndBirthDateMatch = Boolean(registration.name && registration.dateOfBirth && existing.normalizedName && existing.dateOfBirth)
    && normalizeName(registration.name!) === existing.normalizedName
    && registration.dateOfBirth === existing.dateOfBirth;

  if (emailMatches && existing.emailVerified) reasons.push("verified_email");
  if (phoneMatches && existing.phoneVerified) reasons.push("verified_phone");
  if (nameAndBirthDateMatch) reasons.push("name_and_birth_date");

  if (reasons.includes("verified_email") && reasons.includes("verified_phone")) {
    return { level: "CONFIRMED_MATCH", reasons };
  }
  if (reasons.includes("verified_email") || reasons.includes("verified_phone")) {
    return { level: "STRONG_MATCH", reasons };
  }
  if (reasons.includes("name_and_birth_date")) {
    return { level: "POSSIBLE_MATCH", reasons };
  }
  return { level: "NO_MATCH", reasons };
}

export function getSafeDuplicateMessage(level: DuplicateMatchLevel): string {
  if (level === "NO_MATCH") return "You can continue creating your yoRento account.";
  if (level === "POSSIBLE_MATCH") return "We may already have an account that matches some of your information. Please verify whether you already have a yoRento account.";
  return "If an account matches the information provided, we will help you recover it.";
}