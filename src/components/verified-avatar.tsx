"use client";

import Image from "next/image";
import { BadgeCheck, UserRound } from "lucide-react";

// Shared avatar rendering for every place a person's photo shows up
// (header account button, own profile card, host chip/popover, renter
// popover) — adds the small IG-style checkmark overlay plus a thin
// ring around the whole photo when their identity is verified, on top
// of the "ID verified" pill these callers already render next to the
// name. size drives both the circle and the badge/icon scale; "large"
// matches the existing .host-avatar.large modifier.
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
    <span className={`host-avatar verified-avatar ${size === "large" ? "large" : ""} ${verified ? "is-verified" : ""}`}>
      {avatarUrl ? <Image src={avatarUrl} alt={alt} width={size === "large" ? 56 : 40} height={size === "large" ? 56 : 40} /> : <UserRound size={size === "large" ? 30 : 20} />}
      {verified && (
        <span className="verified-avatar-badge" aria-hidden="true">
          <BadgeCheck size={size === "large" ? 16 : 13} />
        </span>
      )}
    </span>
  );
}
