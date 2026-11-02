import { Badge } from "@/components/ui/badge";
import { VERIFICATION_HELP, VERIFICATION_LABEL } from "@/lib/labels";
import type { Origin, Verification } from "@/lib/types";

const verificationVariant = {
  "multi-source": "multi",
  "single-source": "single",
  disputed: "disputed",
  unverified: "unverified",
} as const;

export function VerificationBadge({ level }: { level: Verification }) {
  return (
    <Badge variant={verificationVariant[level]} title={VERIFICATION_HELP[level]}>
      {VERIFICATION_LABEL[level]}
    </Badge>
  );
}

export function OriginBadge({ origin }: { origin: Origin }) {
  if (origin === "live") return <Badge variant="live">From the latest pull</Badge>;
  if (origin === "reference") return <Badge variant="reference">Reference</Badge>;
  return <Badge variant="sample">Sample</Badge>;
}
