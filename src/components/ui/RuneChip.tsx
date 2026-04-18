import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const chip = cva("rune-chip", {
  variants: {
    tone: {
      neutral:  "bg-obsidian-500 border border-obsidian-400 text-ash-200",
      ember:    "bg-ember-500/15 border border-ember-500/40 text-ember-glow",
      rune:     "bg-rune-500/15 border border-rune-500/40 text-rune-glow",
      spectral: "bg-spectral-500/15 border border-spectral-500/40 text-spectral-glow",
      crimson:  "bg-crimson-500/15 border border-crimson-500/40 text-crimson-400",
      gold:     "bg-gold-500/15 border border-gold-500/40 text-gold-400",
      success:  "bg-success/15 border border-success/40 text-success",
      warning:  "bg-warning/15 border border-warning/40 text-warning",
      danger:   "bg-danger/15 border border-danger/40 text-danger",
    },
    pulse: { true: "animate-pulse-rune", false: "" },
  },
  defaultVariants: { tone: "neutral", pulse: false },
});

export interface RuneChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chip> {}

export function RuneChip({ className, tone, pulse, children, ...props }: RuneChipProps) {
  return (
    <span className={cn(chip({ tone, pulse }), className)} {...props}>
      {children}
    </span>
  );
}
