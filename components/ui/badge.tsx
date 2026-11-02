import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border bg-card text-foreground normal-case tracking-normal font-medium",
        sample: "border-dashed border-[#a07a32] bg-[#fbf3df] text-[#6d4e16]",
        live: "border-[#1e3a34] bg-[#e7f2ec] text-[#1e3a34]",
        reference: "border-[#8d867a] bg-[#f3f0ea] text-[#3f3b35]",
        multi: "border-transparent bg-[#e5f2ea] text-[#1d4d32] normal-case tracking-normal",
        single: "border-transparent bg-[#f4ead6] text-[#6d4e16] normal-case tracking-normal",
        disputed: "border-transparent bg-[#f6e4df] text-[#7a3328] normal-case tracking-normal",
        unverified: "border-transparent bg-[#ece7df] text-[#4e4942] normal-case tracking-normal",
        active: "border-transparent bg-[#1e3a34] text-[#f4f1ea] normal-case tracking-normal",
        armistice: "border-transparent bg-[#8a6232] text-[#fffaf2] normal-case tracking-normal",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
