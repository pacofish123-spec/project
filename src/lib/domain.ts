export type AccountType = "personal" | "business" | "mixed";

export type Capability =
  | "can_rent"
  | "can_host_personally"
  | "can_host_for_business"
  | "can_manage_business"
  | "can_manage_fleet"
  | "can_receive_payouts"
  | "can_manage_platform";

export type HostType = "individual" | "business";

export type VerificationStatus =
  | "not_started"
  | "pending"
  | "in_review"
  | "verified"
  | "failed"
  | "requires_information"
  | "expired";

export type DuplicateMatchLevel =
  | "NO_MATCH"
  | "POSSIBLE_MATCH"
  | "STRONG_MATCH"
  | "CONFIRMED_MATCH";

export interface UserIdentity {
  userId: string;
  email?: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  normalizedName?: string;
  dateOfBirth?: string;
}

export interface VehicleOwnership {
  ownerUserId: string;
  hostType: HostType;
  businessId?: string;
}

export interface UserCapabilities {
  accountType: AccountType;
  capabilities: Capability[];
}

export interface CountryConfig {
  code: string;
  name: string;
  currencies: string[];
  languages: string[];
  timezone: string;
  measurementSystem: "metric" | "imperial";
  destinations: string[];
  airports: string[];
}