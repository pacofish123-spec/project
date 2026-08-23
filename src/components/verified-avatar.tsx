"use client";

import { BadgeCheck, UserRound } from "lucide-react";

// Shared avatar rendering for every place a person's photo shows up
// (own profile card, host chip/popover, renter popover) — adds the
// small IG-style checkmark overlay when their identity is verified, on
// top of the "ID verified" pill these callers already render next to
// the name. size drives both the circle and the badge/icon scale;
// "large" matches the existing .host-avatar.large modifier.
export function VerifiedAvatar({
  avatarUrl,
  verified,
  size = "default",
  alt = "",
}: {
  avatarUrl: string | null | undefined;
  verified?: boolean;
  size?: "default" | "large";
  alt?: string;
}) {
  return (
    <span className={`host-avatar verified-avatar ${size === "large" ? "large" : ""}`}>
      {avatarUrl ? <img src={avatarUrl} alt={alt} /> : <UserRound size={size === "large" ? 30 : 20} />}
      {verified && (
        <span className="verified-avatar-badge" aria-hidden="true">
          <BadgeCheck size={size === "large" ? 16 : 13} />
        </span>
      )}
    </span>
  );
}
