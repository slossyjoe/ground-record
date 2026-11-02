import type { Verification } from "./types";

export const VERIFICATION_LABEL: Record<Verification, string> = {
  "multi-source": "Multiple outlets",
  "single-source": "Single source",
  disputed: "Disputed",
  unverified: "Unverified",
};

export const VERIFICATION_HELP: Record<Verification, string> = {
  "multi-source":
    "More than one independent outlet published a closely matching account in this pull. That means the claim was widely reported. It does not mean it was confirmed on the ground.",
  "single-source": "Only one outlet in this pull is carrying this item.",
  disputed: "The accounts do not agree. Both are shown. This page does not pick one.",
  unverified:
    "No independent check is attached. Every sample card is unverified, because the sample text was written for the layout.",
};

export const WEAPON_LABEL: Record<string, string> = {
  artillery: "Artillery",
  drone: "Drone",
  missile: "Missile",
  armor: "Armored vehicle",
  "small-arms": "Small arms",
  air: "Aircraft",
  naval: "Naval",
  other: "Other weapon",
};

export function weaponLabel(type?: string | null): string {
  if (!type) return "Weapon";
  return WEAPON_LABEL[type] ?? type;
}
